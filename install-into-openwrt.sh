#!/bin/sh
set -eu
SRC="${1:-$HOME/openwrt-x86/source}"
HERE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
VERSION="$(cat "$HERE/VERSION" 2>/dev/null | tr -d '\r\n')"
[ -n "$VERSION" ] || VERSION='development'
[ -d "$SRC" ] || { echo "OpenWrt source not found: $SRC" >&2; exit 1; }
STAMP="$(date +%Y%m%d-%H%M%S)"; BACKUP_ROOT="$SRC/.mrouter-backups"; mkdir -p "$BACKUP_ROOT"
for OLD in "$SRC"/package/mrouter.before-* "$SRC"/package/mrouter.before-v12-*; do [ -e "$OLD" ] || continue; BASE="$(basename "$OLD")"; mv "$OLD" "$BACKUP_ROOT/${BASE}-${STAMP}"; done
if [ -d "$SRC/package/mrouter" ]; then mv "$SRC/package/mrouter" "$BACKUP_ROOT/mrouter-before-$VERSION-$STAMP"; fi
mkdir -p "$SRC/package"; cp -a "$HERE/package/mrouter" "$SRC/package/mrouter"; cp "$HERE/build/mrouter-v1.diffconfig" "$SRC/mrouter-v1.diffconfig"
rm -f "$SRC"/tmp/.packageinfo "$SRC"/tmp/.packagedeps "$SRC"/tmp/.packageauxvars "$SRC"/tmp/.config-package.in 2>/dev/null || true
echo "Installed Mrouter package source $VERSION into: $SRC/package/mrouter"
echo "Old Mrouter source backups: $BACKUP_ROOT"
echo "Config seed: $SRC/mrouter-v1.diffconfig"
