#!/bin/sh
set -eu
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"; cd "$HERE"; FAIL=0
VERSION="$(cat VERSION 2>/dev/null | tr -d '\r\n')"; [ -n "$VERSION" ] || { echo 'VERSION missing' >&2; exit 1; }

for F in $(find package/mrouter -type f \( -path '*/usr/libexec/*' -o -path '*/etc/init.d/*' -o -path '*/etc/uci-defaults/*' \)); do sh -n "$F" || FAIL=1; done
if command -v node >/dev/null 2>&1; then for F in $(find package/mrouter -type f -name '*.js'); do node --check "$F" >/dev/null || FAIL=1; done; else echo 'NOTE: node not installed; JavaScript syntax check skipped.'; fi

python3 tools/compile-ui.py || FAIL=1
python3 - <<'PY2'
import json
files=[
'package/mrouter/luci-app-mrouter/root/usr/share/luci/menu.d/mrouter.json',
'package/mrouter/luci-app-mrouter/root/usr/share/luci/menu.d/mrouter-next.json',
'package/mrouter/luci-app-mrouter/root/usr/share/luci/menu.d/zz-mrouter-yaml.json',
'package/mrouter/luci-app-mrouter/root/usr/share/rpcd/acl.d/mrouter.json',
'package/mrouter/mrouter-setup/root/usr/share/luci/menu.d/mrouter-setup.json',
'package/mrouter/mrouter-setup/root/usr/share/rpcd/acl.d/mrouter-setup.json',
'package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui/navigation.json',
'package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui/pages.json',
'package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui/appearance.json',
'package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui/login.json',
'package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui/actions.json',
'package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui/schema.json',
'package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui/user-config.json']
for f in files:
    with open(f,encoding='utf-8') as h: json.load(h)
print('JSON: OK')
PY2
python3 tools/audit-ui.py || FAIL=1

if find package -type f | grep -E '(-s2[5-9]\.js$|_v[0-9]|tailscaled\.state|(^|/)shadow$|dropbear_.*_host_key|auth\.txt$|\.(pem|key)$)'; then echo 'Forbidden stale/secret-looking file found' >&2; FAIL=1; fi

for F in \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui/schema-runtime.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui/yaml-lite.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui/mrouter-shell.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui/mrouter-shell.css \
 package/mrouter/luci-app-mrouter/ui-src/navigation.yaml \
 package/mrouter/luci-app-mrouter/ui-src/pages.yaml \
 package/mrouter/luci-app-mrouter/ui-src/appearance.yaml \
 package/mrouter/luci-app-mrouter/ui-src/login.yaml \
 package/mrouter/luci-app-mrouter/ui-src/actions.yaml \
 package/mrouter/luci-app-mrouter/ui-src/schema.yaml \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-ui-config \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-ui-action \
 tools/compile-ui.py tools/audit-ui.py build/mrouter-v1.diffconfig; do [ -f "$F" ] || { echo "Required native UI file missing: $F" >&2; FAIL=1; }; done

COUNT="$(find package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter-yaml -type f -name '*.js' | wc -l | tr -d ' ')"
[ "$COUNT" -ge 38 ] || { echo "Expected at least 38 generated YAML routes, found $COUNT" >&2; FAIL=1; }

! grep -R -E 'type:[[:space:]]*legacy|view\.mrouter\.' package/mrouter/luci-app-mrouter/ui-src package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter-yaml >/dev/null 2>&1 || { echo 'Legacy frontend reference remains' >&2; FAIL=1; }
grep -Fq 'rm -rf $(1)/www/luci-static/resources/view/mrouter' package/mrouter/luci-app-mrouter/Makefile || { echo 'Legacy view tree is not excluded from APK' >&2; FAIL=1; }
! grep -R "menu-material" package/mrouter/luci-theme-mrouter/ucode/template/themes/mrouter package/mrouter/luci-app-mrouter/htdocs/luci-static/mrouter-ui >/dev/null 2>&1 || { echo 'menu-material reference remains' >&2; FAIL=1; }

for Y in appearance navigation pages login actions schema; do grep -q '^version: 1$' "package/mrouter/luci-app-mrouter/ui-src/$Y.yaml" || { echo "$Y.yaml malformed" >&2; FAIL=1; }; done
for P in luci-app-mrouter luci-theme-mrouter mrouter-core mrouter-setup mrouter-os; do MF="package/mrouter/$P/Makefile"; grep -q "^PKG_NAME:=$P$" "$MF" || FAIL=1; grep -q "^PKG_VERSION:=$VERSION$" "$MF" || FAIL=1; grep -q '^define Build/Compile$' "$MF" || FAIL=1; done
for P in mrouter-core luci-app-mrouter luci-theme-mrouter mrouter-setup mrouter-os; do grep -q "^CONFIG_PACKAGE_${P}=y$" build/mrouter-v1.diffconfig || { echo "Build seed missing $P" >&2; FAIL=1; }; done
for X in strongswan collectd travelmate smartdns stubby sing-box xray-core zerotier v2raya vnstat2 netifyd; do if grep -Eq "^CONFIG_PACKAGE_${X}=y" build/mrouter-v1.diffconfig; then echo "Unexpected removed package selected: $X" >&2; FAIL=1; fi; done

CHANNEL="$(sed -n 's/^MROUTER_CHANNEL="\(.*\)"/\1/p' package/mrouter/mrouter-core/files/etc/mrouter-release)"; case "$CHANNEL" in development|stable) ;; *) echo "Invalid release channel: $CHANNEL" >&2; FAIL=1;; esac
SCHEMA="$(sed -n 's/^MROUTER_SCHEMA="\(.*\)"/\1/p' package/mrouter/mrouter-core/files/etc/mrouter-release)"; grep -q "TARGET_SCHEMA=$SCHEMA" package/mrouter/mrouter-core/files/usr/libexec/mrouter-migrate || { echo 'Schema mismatch between release metadata and migrator' >&2; FAIL=1; }

[ "$FAIL" = 0 ] || exit 1
echo "Mrouter native YAML package validation $VERSION: OK"
