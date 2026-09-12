#!/bin/sh
set -eu
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$HERE"
FAIL=0

# Shell syntax.
for F in $(find package/mrouter -type f \( -path '*/usr/libexec/*' -o -path '*/etc/init.d/*' -o -path '*/etc/uci-defaults/*' \)); do
    sh -n "$F" || FAIL=1
done

# LuCI JavaScript syntax.
if command -v node >/dev/null 2>&1; then
    for F in $(find package/mrouter -type f -name '*.js'); do
        node --check "$F" >/dev/null || FAIL=1
    done
else
    echo 'NOTE: node not installed; JavaScript syntax check skipped on this host.'
fi

python3 - <<'PY2'
import json
for f in [
 'package/mrouter/luci-app-mrouter/root/usr/share/luci/menu.d/mrouter.json',
 'package/mrouter/luci-app-mrouter/root/usr/share/rpcd/acl.d/mrouter.json',
 'package/mrouter/mrouter-setup/root/usr/share/luci/menu.d/mrouter-setup.json',
 'package/mrouter/mrouter-setup/root/usr/share/rpcd/acl.d/mrouter-setup.json',
]:
    with open(f, encoding='utf-8') as h:
        json.load(h)
print('JSON: OK')
PY2

# No runtime secrets or old generated copies in the package tree.
if find package -type f | grep -E '(_v[0-9]|tailscaled\.state|(^|/)shadow$|dropbear_.*_host_key|auth\.txt$|\.(pem|key)$)'; then
    echo 'Forbidden stale/secret-looking file found' >&2
    FAIL=1
fi

# Core v1 pages/helpers that must ship.
for F in \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/internet.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/clients.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/iot-clients.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/local-services.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/content-filter.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/networks.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/dhcp-dns.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/firewall-modern.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/routing-modern.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/traffic-control.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/diagnostics-modern.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/device-settings.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/admin-password.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/admin-ssh.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/admin-sshkeys.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/admin-web.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/admin-startup.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/admin-scheduled.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/admin-backup.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/logs-modern.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/processes-modern.js \
 package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/packages-modern.js \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-advanced \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-client-data \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-iot-info \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-ports \
 package/mrouter/mrouter-core/files/usr/libexec/mrouter-services \
 package/mrouter/mrouter-setup/files/usr/libexec/mrouter-setup \
 build/mrouter-v1.diffconfig; do
    [ -f "$F" ] || { echo "Required v1 file missing: $F" >&2; FAIL=1; }
done

[ ! -f package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter/insights.js ] || { echo 'Insights page must not ship in v1' >&2; FAIL=1; }
[ ! -f package/mrouter/mrouter-core/files/usr/libexec/mrouter-traffic ] || { echo 'Unused live-traffic helper must not ship in v1' >&2; FAIL=1; }

for P in luci-app-mrouter luci-theme-mrouter mrouter-core mrouter-setup mrouter-os; do
    MF="package/mrouter/$P/Makefile"
    grep -q "^PKG_NAME:=$P$" "$MF" || { echo "Native package definition missing for $P" >&2; FAIL=1; }
    grep -q '^PKG_VERSION:=1.0.0$' "$MF" || { echo "Wrong v1 package version for $P" >&2; FAIL=1; }
    grep -q '^define Build/Compile$' "$MF" || { echo "Build/Compile stub missing for $P" >&2; FAIL=1; }
done

# All five packages must be in the firmware seed.
for P in mrouter-core luci-app-mrouter luci-theme-mrouter mrouter-setup mrouter-os; do
    grep -q "^CONFIG_PACKAGE_${P}=y$" build/mrouter-v1.diffconfig || { echo "Build seed missing $P" >&2; FAIL=1; }
done

for X in strongswan collectd mwan3 travelmate smartdns stubby sing-box xray-core zerotier v2raya vnstat2 netifyd; do
    if grep -Eq "^CONFIG_PACKAGE_${X}=y" build/mrouter-v1.diffconfig; then
        echo "Removed package still selected: $X" >&2
        FAIL=1
    fi
done

# Prevent regressions for bugs found during RC testing.
grep -Fq "grep -Fq '|'" package/mrouter/mrouter-core/files/usr/libexec/mrouter-services || { echo 'Local Services name-validation fix missing' >&2; FAIL=1; }
grep -q "MROUTER_CHANNEL=\"stable\"" package/mrouter/mrouter-core/files/etc/mrouter-release || { echo 'Release channel is not stable' >&2; FAIL=1; }

[ "$FAIL" = 0 ] || exit 1
echo 'Mrouter-OS v1.0.0 source validation: OK'
