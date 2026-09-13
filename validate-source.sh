#!/bin/sh
set -eu
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"; cd "$HERE"; FAIL=0
VERSION="$(cat VERSION 2>/dev/null | tr -d '\r\n')"; [ -n "$VERSION" ] || { echo 'VERSION missing' >&2; exit 1; }
for F in $(find package/mrouter -type f \( -path '*/usr/libexec/*' -o -path '*/etc/init.d/*' -o -path '*/etc/uci-defaults/*' \)); do sh -n "$F" || FAIL=1; done
if command -v node >/dev/null 2>&1; then for F in $(find package/mrouter -type f -name '*.js'); do node --check "$F" >/dev/null || FAIL=1; done; else echo 'NOTE: node not installed; JavaScript syntax check skipped.'; fi
python3 - <<'PY2'
import json
files=[
'package/mrouter/luci-app-mrouter/root/usr/share/luci/menu.d/mrouter.json',
'package/mrouter/luci-app-mrouter/root/usr/share/luci/menu.d/mrouter-next.json',
'package/mrouter/luci-app-mrouter/root/usr/share/rpcd/acl.d/mrouter.json',
'package/mrouter/mrouter-setup/root/usr/share/luci/menu.d/mrouter-setup.json',
'package/mrouter/mrouter-setup/root/usr/share/rpcd/acl.d/mrouter-setup.json']
for f in files:
    with open(f,encoding='utf-8') as h: json.load(h)
print('JSON: OK')
PY2
if find package -type f | grep -E '(-s2[5-9]\.js$|_v[0-9]|tailscaled\.state|(^|/)shadow$|dropbear_.*_host_key|auth\.txt$|\.(pem|key)$)'; then echo 'Forbidden stale/secret-looking file found' >&2; FAIL=1; fi
for F in \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/internet.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/clients.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/iot-clients.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/wireless.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/events.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/multiwan.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/support.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/vpn-dashboard.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/wireguard.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/policy.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/networks.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/dhcp-dns.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/firewall-modern.js \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-client-data \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-clients \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-wireless \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-networks \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-wan \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-events \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-wireguard-client \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-policy-monitor \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-support \
 package/mrouter/mrouter-setup/files/usr/libexec/mrouter-setup \
 build/mrouter-v1.diffconfig; do [ -f "$F" ] || { echo "Required package file missing: $F" >&2; FAIL=1; }; done
for P in luci-app-mrouter luci-theme-mrouter mrouter-core mrouter-setup mrouter-os; do MF="package/mrouter/$P/Makefile"; grep -q "^PKG_NAME:=$P$" "$MF" || { echo "Package definition missing for $P" >&2; FAIL=1; }; grep -q "^PKG_VERSION:=$VERSION$" "$MF" || { echo "Version mismatch for $P (expected $VERSION)" >&2; FAIL=1; }; grep -q '^define Build/Compile$' "$MF" || { echo "Build/Compile stub missing for $P" >&2; FAIL=1; }; done
for P in mrouter-core luci-app-mrouter luci-theme-mrouter mrouter-setup mrouter-os; do grep -q "^CONFIG_PACKAGE_${P}=y$" build/mrouter-v1.diffconfig || { echo "Build seed missing $P" >&2; FAIL=1; }; done
for X in strongswan collectd travelmate smartdns stubby sing-box xray-core zerotier v2raya vnstat2 netifyd; do if grep -Eq "^CONFIG_PACKAGE_${X}=y" build/mrouter-v1.diffconfig; then echo "Unexpected removed package selected: $X" >&2; FAIL=1; fi; done
grep -Fq "grep -Fq '|'" package/mrouter/mrouter-core/files/usr/libexec/mrouter-services || { echo 'Local Services name-validation fix missing' >&2; FAIL=1; }
CHANNEL="$(sed -n 's/^MROUTER_CHANNEL="\(.*\)"/\1/p' package/mrouter/mrouter-core/files/etc/mrouter-release)"; case "$CHANNEL" in development|stable) ;; *) echo "Invalid release channel: $CHANNEL" >&2; FAIL=1;; esac
SCHEMA="$(sed -n 's/^MROUTER_SCHEMA="\(.*\)"/\1/p' package/mrouter/mrouter-core/files/etc/mrouter-release)"; grep -q "TARGET_SCHEMA=$SCHEMA" package/mrouter/mrouter-core/files/usr/libexec/mrouter-migrate || { echo 'Schema mismatch between release metadata and migrator' >&2; FAIL=1; }
[ "$FAIL" = 0 ] || exit 1
echo "Mrouter package source validation $VERSION: OK"
