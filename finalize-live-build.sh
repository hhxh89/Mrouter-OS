#!/usr/bin/env bash
set -euo pipefail

REPO="$(pwd)"
SRC="${SRC:-$HOME/openwrt-x86/source}"
OUT="${OUT:-$HOME/mrouter-1.1.0-packages}"
LIVE="${LIVE:-$HOME/Downloads/mrouter-live-parity.tar.gz}"
ACTIVE="${ACTIVE:-$HOME/Downloads/mrouter-active-pages.tar.gz}"
WORK="${WORK:-/tmp/mrouter-finalize-$$}"
LIVE_DIR="$WORK/live"
ACTIVE_DIR="$WORK/active"
VIEW="$REPO/package/mrouter/luci-app-mrouter/htdocs/luci-static/resources/view/mrouter"
CORE="$REPO/package/mrouter/mrouter-core/files/usr/libexec"
THEME="$REPO/package/mrouter/luci-theme-mrouter/htdocs/luci-static/mrouter"

trap 'rc=$?; echo; echo "===== FINALIZE FAILED (rc=$rc) ====="; echo "Work dir kept at: $WORK"; exit $rc' ERR

need(){ [ -e "$1" ] || { echo "Missing: $1" >&2; exit 1; }; }

need "$LIVE"
need "$ACTIVE"
need "$SRC"

mkdir -p "$LIVE_DIR" "$ACTIVE_DIR"

tar -xzf "$LIVE" -C "$LIVE_DIR" --strip-components=1
tar -xzf "$ACTIVE" -C "$ACTIVE_DIR" --strip-components=1

echo "===== APPLY LIVE-TESTED PAGES ====="
cp "$ACTIVE_DIR/internet-s25.js" "$VIEW/internet.js"
cp "$ACTIVE_DIR/openvpn-s25.js" "$VIEW/openvpn.js"
cp "$ACTIVE_DIR/wireguard-s27.js" "$VIEW/wireguard.js"
cp "$ACTIVE_DIR/tailscale-s26.js" "$VIEW/tailscale.js"
cp "$ACTIVE_DIR/policy-s26.js" "$VIEW/policy.js"
cp "$ACTIVE_DIR/vpn-dashboard-s25.js" "$VIEW/vpn-dashboard.js"

echo "===== APPLY LIVE-TESTED HELPERS ====="
cp "$LIVE_DIR/usr/libexec/mrouter-traffic-live" "$CORE/mrouter-traffic-live"
cp "$LIVE_DIR/usr/libexec/mrouter-openvpn" "$CORE/mrouter-openvpn"
chmod +x "$CORE/mrouter-traffic-live" "$CORE/mrouter-openvpn"

echo "===== MERGE LIVE CSS ====="
cp "$THEME/custom.css" "$WORK/package-custom.css"
cat "$WORK/package-custom.css" "$LIVE_DIR/www/luci-static/mrouter/custom.css" > "$THEME/custom.css"

cat > "$THEME/login-flat.css" <<'EOF'
body.node-main-login .mrouter-login-map {
    margin-left: 0 !important;
    margin-right: 0 !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
}
EOF

cat > "$THEME/cascade.css" <<'EOF'
@import url('/luci-static/material/cascade.css');
@import url('/luci-static/mrouter/custom.css');
@import url('/luci-static/mrouter/layout-fixes.css');
@import url('/luci-static/mrouter/login-flat.css');
EOF

find "$VIEW" -type f \( -name '*-s25.js' -o -name '*-s26.js' -o -name '*-s27.js' \) -exec rm -f {} \;

echo "===== JAVASCRIPT SYNTAX ====="
for F in "$VIEW"/*.js; do
  node --check "$F" >/dev/null
  echo "OK $(basename "$F")"
done

echo "===== SHELL SYNTAX ====="
while IFS= read -r -d '' F; do
  sh -n "$F"
done < <(find "$REPO/package/mrouter" -type f \( -path '*/usr/libexec/*' -o -path '*/etc/init.d/*' -o -path '*/etc/uci-defaults/*' \) -print0)
echo "ALL SHELL: OK"

echo "===== JSON ====="
python3 - <<'PY'
import json
from pathlib import Path
root=Path.cwd()
for f in [
root/'package/mrouter/luci-app-mrouter/root/usr/share/luci/menu.d/mrouter.json',
root/'package/mrouter/luci-app-mrouter/root/usr/share/luci/menu.d/mrouter-next.json',
root/'package/mrouter/luci-app-mrouter/root/usr/share/rpcd/acl.d/mrouter.json',
root/'package/mrouter/mrouter-setup/root/usr/share/luci/menu.d/mrouter-setup.json',
root/'package/mrouter/mrouter-setup/root/usr/share/rpcd/acl.d/mrouter-setup.json']:
    if f.exists():
        json.load(f.open(encoding='utf-8'))
        print('OK', f.name)
print('JSON: OK')
PY

echo "===== FEATURE CHECK ====="
grep -q "Network Topology" "$VIEW/internet.js"
grep -q "Live Traffic" "$VIEW/internet.js"
grep -q "mrouter-status-wireguard-client" "$VIEW/wireguard.js"
grep -q "VPN Clients" "$VIEW/wireguard.js"
grep -q "Austria" "$VIEW/policy.js"
grep -q "mrouter-openvpn" "$VIEW/openvpn.js"
grep -q "mrouter-tailscale" "$VIEW/tailscale.js"
grep -q "mrouter-login-map" "$THEME/login-flat.css"
grep -q "layout-fixes.css" "$THEME/cascade.css"
echo "LIVE PARITY CORE FEATURES: OK"

chmod +x validate-source.sh build-packages.sh install-into-openwrt.sh
./validate-source.sh

git diff --check

echo "===== BUILD ====="
rm -rf "$OUT"
mkdir -p "$OUT"
OUT="$OUT" JOBS="$(nproc)" ./build-packages.sh "$SRC"

echo "===== OUTPUT ====="
ls -lh "$OUT"

FAIL=0
for P in mrouter-core luci-app-mrouter luci-theme-mrouter mrouter-setup mrouter-os; do
  F="$OUT/${P}-1.1.0-r1.apk"
  if [ -f "$F" ]; then echo "OK   $(basename "$F")"; else echo "MISS $P"; FAIL=1; fi
done

[ -f "$OUT/SHA256SUMS" ] && cat "$OUT/SHA256SUMS" || true
[ "$FAIL" = 0 ] || exit 1

echo "===== DONE ====="
echo "$OUT"
