#!/bin/sh
set -eu
SRC="${1:-$HOME/openwrt-x86/source}"
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
JOBS="${JOBS:-4}"
OUT="${OUT:-$HOME/mrouter-v1-packages}"
VERSION="1.0.0"

[ -d "$SRC" ] || { echo "OpenWrt source not found: $SRC" >&2; exit 1; }
"$HERE/validate-source.sh"
"$HERE/install-into-openwrt.sh" "$SRC"

cd "$SRC"
rm -f tmp/.packageinfo tmp/.packagedeps tmp/.packageauxvars tmp/.config-package.in 2>/dev/null || true

# Package-only builds often reuse an existing OpenWrt .config. Enable all
# Mrouter packages without relying on the Linux scripts/config helper (OpenWrt
# 25.12 uses scripts/config as a directory).
for P in mrouter-core luci-app-mrouter luci-theme-mrouter mrouter-setup mrouter-os; do
    sed -i \
      -e "/^CONFIG_PACKAGE_${P}=/d" \
      -e "/^# CONFIG_PACKAGE_${P} is not set$/d" \
      .config
    echo "CONFIG_PACKAGE_${P}=y" >> .config
done

make defconfig

echo "===== ENABLED MROUTER PACKAGES ====="
grep -E '^CONFIG_PACKAGE_(mrouter-core|luci-app-mrouter|luci-theme-mrouter|mrouter-setup|mrouter-os)=y$' .config

for P in mrouter-core luci-app-mrouter luci-theme-mrouter mrouter-setup mrouter-os; do
    echo "===== BUILD $P ====="
    make "package/$P/clean" >/dev/null 2>&1 || true
    make -j"$JOBS" "package/$P/compile" V=s
done

rm -rf "$OUT"
mkdir -p "$OUT"
for P in mrouter-core luci-app-mrouter luci-theme-mrouter mrouter-setup mrouter-os; do
    F="$(find bin/packages -type f -name "$P-$VERSION-r1.apk" -print -quit)"
    [ -n "$F" ] || { echo "Built APK not found for $P ($VERSION-r1)" >&2; exit 1; }
    cp "$F" "$OUT/"
done
(cd "$OUT" && sha256sum *.apk > SHA256SUMS)

echo
echo "Mrouter-OS v1 packages ready: $OUT"
ls -lh "$OUT"
echo
cat "$OUT/SHA256SUMS"
