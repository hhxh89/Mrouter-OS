#!/bin/sh
set -eu
SRC="${1:-$HOME/openwrt-x86/source}"
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
JOBS="${JOBS:-4}"
OUT="${OUT:-$HOME/mrouter-packages}"
VERSION="$(cat "$HERE/VERSION" 2>/dev/null | tr -d '\r\n')"
[ -n "$VERSION" ] || { echo 'VERSION file is empty' >&2; exit 1; }
[ -d "$SRC" ] || { echo "OpenWrt source not found: $SRC" >&2; exit 1; }
python3 "$HERE/tools/compile-ui.py"
"$HERE/validate-source.sh"
"$HERE/install-into-openwrt.sh" "$SRC"
cd "$SRC"
rm -f tmp/.packageinfo tmp/.packagedeps tmp/.packageauxvars tmp/.config-package.in 2>/dev/null || true
for P in mrouter-core luci-app-mrouter luci-theme-mrouter mrouter-setup mrouter-os; do
    sed -i -e "/^CONFIG_PACKAGE_${P}=/d" -e "/^# CONFIG_PACKAGE_${P} is not set$/d" .config
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
rm -rf "$OUT"; mkdir -p "$OUT"
for P in mrouter-core luci-app-mrouter luci-theme-mrouter mrouter-setup mrouter-os; do
    F="$(find bin/packages -type f -name "$P-$VERSION-r1.apk" -print -quit)"
    [ -n "$F" ] || { echo "Built APK not found for $P ($VERSION-r1)" >&2; exit 1; }
    cp "$F" "$OUT/"
done
(cd "$OUT" && sha256sum *.apk > SHA256SUMS)
echo; echo "Mrouter package suite $VERSION ready: $OUT"; ls -lh "$OUT"; echo; cat "$OUT/SHA256SUMS"
