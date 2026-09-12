#!/bin/sh
set -eu
SRC="${1:-$HOME/openwrt-x86/source}"
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
[ -d "$SRC" ] || { echo "OpenWrt source not found: $SRC" >&2; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_ROOT="$SRC/.mrouter-backups"
mkdir -p "$BACKUP_ROOT"

# Older installers mistakenly kept source backups under package/. OpenWrt scans
# package/ recursively, so those copies can define the same packages twice.
# Move every old Mrouter backup out of the package discovery tree first.
for OLD in "$SRC"/package/mrouter.before-* "$SRC"/package/mrouter.before-v12-*; do
    [ -e "$OLD" ] || continue
    BASE="$(basename "$OLD")"
    mv "$OLD" "$BACKUP_ROOT/${BASE}-${STAMP}"
done

if [ -d "$SRC/package/mrouter" ]; then
    mv "$SRC/package/mrouter" "$BACKUP_ROOT/mrouter-before-v1-$STAMP"
fi

mkdir -p "$SRC/package"
cp -a "$HERE/package/mrouter" "$SRC/package/mrouter"
cp "$HERE/build/mrouter-v1.diffconfig" "$SRC/mrouter-v1.diffconfig"

# The package tree changed. Force OpenWrt to rediscover it on next defconfig.
rm -f "$SRC"/tmp/.packageinfo "$SRC"/tmp/.packagedeps "$SRC"/tmp/.packageauxvars "$SRC"/tmp/.config-package.in 2>/dev/null || true

echo "Installed Mrouter-OS v1.0 source into: $SRC/package/mrouter"
echo "Old Mrouter source backups: $BACKUP_ROOT"
echo "Config seed: $SRC/mrouter-v1.diffconfig"
