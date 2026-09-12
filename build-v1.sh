#!/bin/sh
set -eu
SRC="${1:-$HOME/openwrt-x86/source}"
JOBS="${JOBS:-4}"
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$SRC"
[ -f mrouter-v1.diffconfig ] || { echo "mrouter-v1.diffconfig missing" >&2; exit 1; }
[ -d package/mrouter ] || { echo "package/mrouter missing" >&2; exit 1; }

# Mrouter source backups must never live below package/: OpenWrt scans that tree
# recursively and duplicate package definitions can make menuconfig/defconfig
# silently drop the intended package.
if find package -maxdepth 1 -type d -name 'mrouter.before-*' -print -quit | grep -q .; then
    echo 'Old Mrouter backup found under package/. Re-run install-into-openwrt.sh v1.0 to move it out.' >&2
    exit 1
fi

# Reproducibility guard: v1.0 is audited against the OpenWrt v25.12.5 tree.
# If this is a git checkout, refuse to silently build against another release.
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    BASE_TAG="$(git describe --tags --exact-match HEAD 2>/dev/null || true)"
    [ "$BASE_TAG" = "v25.12.5" ] || {
        echo "Expected OpenWrt git tag v25.12.5, found: ${BASE_TAG:-untagged commit}" >&2
        echo "Checkout v25.12.5 before building Mrouter-OS v1.0.0." >&2
        exit 1
    }
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
[ -f .config ] && cp .config ".config.before-mrouter-v1-$STAMP"
cp mrouter-v1.diffconfig .config
# Local packages were just copied into package/mrouter. Drop only generated
# package metadata so OpenWrt cannot reuse a stale cache from the pre-Mrouter tree.
rm -f tmp/.packageinfo tmp/.packagedeps tmp/.packageauxvars tmp/.config-package.in 2>/dev/null || true
make defconfig

grep -q 'Package: luci-app-mrouter' tmp/.packageinfo 2>/dev/null || { echo 'luci-app-mrouter was not discovered in package metadata' >&2; exit 1; }
grep -q 'Package: luci-theme-mrouter' tmp/.packageinfo 2>/dev/null || { echo 'luci-theme-mrouter was not discovered in package metadata' >&2; exit 1; }
grep -q 'Package: mrouter-setup' tmp/.packageinfo 2>/dev/null || { echo 'mrouter-setup was not discovered in package metadata' >&2; exit 1; }
grep -q 'Package: mrouter-os' tmp/.packageinfo 2>/dev/null || { echo 'mrouter-os was not discovered in package metadata' >&2; exit 1; }

for REQUIRED in CONFIG_PACKAGE_mrouter-core CONFIG_PACKAGE_luci-app-mrouter CONFIG_PACKAGE_luci-theme-mrouter CONFIG_PACKAGE_mrouter-setup CONFIG_PACKAGE_mrouter-os CONFIG_PACKAGE_dnsmasq-full CONFIG_PACKAGE_pbr CONFIG_PACKAGE_nlbwmon CONFIG_PACKAGE_tailscale CONFIG_PACKAGE_openvpn-openssl; do
    grep -q "^${REQUIRED}=y" .config || { echo "Required option missing after defconfig: $REQUIRED" >&2; exit 1; }
done
grep -q '^CONFIG_PACKAGE_dnsmasq_full_nftset=y' .config || { echo 'dnsmasq-full nftset support missing' >&2; exit 1; }

for BAD in \
 CONFIG_PACKAGE_strongswan CONFIG_PACKAGE_luci-app-strongswan-swanctl CONFIG_PACKAGE_swanmon \
 CONFIG_PACKAGE_collectd CONFIG_PACKAGE_luci-app-statistics CONFIG_PACKAGE_rrdtool1 \
 CONFIG_PACKAGE_vnstat2 CONFIG_PACKAGE_netifyd CONFIG_PACKAGE_mwan3 CONFIG_PACKAGE_luci-app-mwan3 \
 CONFIG_PACKAGE_miniupnpd-nftables CONFIG_PACKAGE_luci-app-upnp \
 CONFIG_PACKAGE_travelmate CONFIG_PACKAGE_luci-app-travelmate \
 CONFIG_PACKAGE_smartdns CONFIG_PACKAGE_stubby CONFIG_PACKAGE_getdns \
 CONFIG_PACKAGE_sing-box CONFIG_PACKAGE_xray-core CONFIG_PACKAGE_v2raya CONFIG_PACKAGE_zerotier \
 CONFIG_PACKAGE_openconnect CONFIG_PACKAGE_openfortivpn CONFIG_PACKAGE_watchcat CONFIG_PACKAGE_irqbalance; do
    if grep -q "^${BAD}=y" .config; then echo "Unexpected package re-selected: $BAD" >&2; exit 1; fi
done

make package/mrouter-core/compile V=s
make package/luci-app-mrouter/compile V=s
make package/luci-theme-mrouter/compile V=s
make package/mrouter-setup/compile V=s
make package/mrouter-os/compile V=s
make -j"$JOBS" V=s

OUT="$HERE/release"
rm -rf "$OUT"; mkdir -p "$OUT"
for F in bin/targets/x86/64/*combined*.img.gz bin/targets/x86/64/*combined*.img; do
    [ -f "$F" ] || continue
    B="$(basename "$F")"
    cp "$F" "$OUT/Mrouter-OS-v1.0.0-${B#openwrt-*x86-64-generic-}"
done
cp .config "$OUT/mrouter-v1-resolved.config"
./scripts/diffconfig.sh > "$OUT/mrouter-v1-resolved.diffconfig"

# Capture the exact source/feed revisions used for this firmware. Do not update
# feeds here: a release build must record the checkout it used, not move it.
{
    echo "Mrouter-OS: 1.0.0"
    echo "Expected OpenWrt: v25.12.5"
    if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        echo "OpenWrt HEAD: $(git rev-parse HEAD 2>/dev/null || true)"
        echo "OpenWrt tag: $(git describe --tags --exact-match HEAD 2>/dev/null || true)"
    fi
    for D in feeds/*; do
        [ -d "$D/.git" ] || continue
        echo "Feed $(basename "$D"): $(git -C "$D" rev-parse HEAD 2>/dev/null || true)"
    done
} > "$OUT/BUILD_ENVIRONMENT.txt"

(cd "$OUT" && sha256sum Mrouter-OS-* > SHA256SUMS)

echo
echo 'Build complete. v1.0 artifacts:'
ls -lh "$OUT"
