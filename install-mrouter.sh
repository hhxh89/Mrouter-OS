#!/bin/sh
set -eu

MROUTER_VERSION="1.0.0"
REQUIRED_OPENWRT_VERSION="25.12.5"
REQUIRED_ARCH="x86_64"
REPOSITORY="hhxh89/Mrouter-OS"
RELEASE_BASE="https://github.com/${REPOSITORY}/releases/download/v${MROUTER_VERSION}"
SHA256SUMS_SHA256="1db67f1304281f02c6ab2011045abd2b6844ceaf401c61bd362b42cd60966fd4"
TMPDIR=""

PACKAGES="
luci-app-mrouter-1.0.0-r1.apk
luci-theme-mrouter-1.0.0-r1.apk
mrouter-core-1.0.0-r1.apk
mrouter-os-1.0.0-r1.apk
mrouter-setup-1.0.0-r1.apk
"

info() {
    printf '%s\n' "$*"
}

fail() {
    printf 'ERROR: %s\n' "$*" >&2
    exit 1
}

cleanup() {
    if [ -n "${TMPDIR:-}" ] && [ -d "$TMPDIR" ]; then
        rm -rf "$TMPDIR"
    fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' HUP TERM

[ "$(id -u)" = "0" ] || fail "Run this installer as root."

command -v apk >/dev/null 2>&1 || fail "apk was not found. Mrouter-OS v1.0.0 requires OpenWrt 25.12.5 or newer APK-based OpenWrt, and this installer is validated specifically for 25.12.5."
command -v sha256sum >/dev/null 2>&1 || fail "sha256sum is required."
command -v mktemp >/dev/null 2>&1 || fail "mktemp is required."

DETECTED_ID=""
DETECTED_VERSION=""

if [ -r /etc/os-release ]; then
    # shellcheck disable=SC1091
    . /etc/os-release
    DETECTED_ID="${ID:-}"
    DETECTED_VERSION="${VERSION_ID:-}"
fi

if [ -z "$DETECTED_VERSION" ] && [ -r /etc/openwrt_release ]; then
    # shellcheck disable=SC1091
    . /etc/openwrt_release
    DETECTED_ID="openwrt"
    DETECTED_VERSION="${DISTRIB_RELEASE:-}"
fi

[ "$DETECTED_ID" = "openwrt" ] || fail "This installer is intended for OpenWrt."
[ "$DETECTED_VERSION" = "$REQUIRED_OPENWRT_VERSION" ] || fail "Unsupported OpenWrt version: ${DETECTED_VERSION:-unknown}. Mrouter-OS v1.0.0 is validated for OpenWrt ${REQUIRED_OPENWRT_VERSION}."

DETECTED_ARCH="$(apk --print-arch 2>/dev/null | head -n 1 || true)"
[ -n "$DETECTED_ARCH" ] || DETECTED_ARCH="$(uname -m 2>/dev/null || true)"
[ "$DETECTED_ARCH" = "$REQUIRED_ARCH" ] || fail "Unsupported architecture: ${DETECTED_ARCH:-unknown}. Mrouter-OS v1.0.0 release packages are validated for ${REQUIRED_ARCH}."

if command -v wget >/dev/null 2>&1; then
    DOWNLOAD_TOOL="wget"
elif command -v curl >/dev/null 2>&1; then
    DOWNLOAD_TOOL="curl"
else
    fail "Either wget or curl is required to download the release."
fi

download_file() {
    url="$1"
    output="$2"

    if [ "$DOWNLOAD_TOOL" = "wget" ]; then
        wget -O "$output" "$url"
    else
        curl -fL --retry 3 -o "$output" "$url"
    fi
}

TMPDIR="$(mktemp -d /tmp/mrouter-install.XXXXXX)" || fail "Could not create temporary directory."
cd "$TMPDIR"

info ""
info "Mrouter-OS v${MROUTER_VERSION} Installer"
info "================================"
info "OpenWrt:      ${DETECTED_VERSION}  OK"
info "Architecture: ${DETECTED_ARCH}  OK"
info "Package mgr:  apk  OK"
info ""
info "Downloading release checksums..."

download_file "${RELEASE_BASE}/SHA256SUMS" "SHA256SUMS" || fail "Could not download SHA256SUMS."

ACTUAL_SUMS_SHA256="$(sha256sum SHA256SUMS | awk '{print $1}')"
[ "$ACTUAL_SUMS_SHA256" = "$SHA256SUMS_SHA256" ] || fail "SHA256SUMS itself did not match the checksum pinned in this installer."

info "Downloading Mrouter-OS v${MROUTER_VERSION} packages..."
for package in $PACKAGES; do
    info "  -> ${package}"
    download_file "${RELEASE_BASE}/${package}" "$package" || fail "Download failed: ${package}"
done

info ""
info "Verifying package checksums..."
sha256sum -c SHA256SUMS || fail "Package checksum verification failed. Nothing was installed."

info ""
info "Refreshing configured OpenWrt package indexes..."
apk update || fail "apk update failed. Check Internet access and configured OpenWrt repositories."

info ""
info "Installing Mrouter-OS and required dependencies..."
apk add --allow-untrusted \
    "$TMPDIR/mrouter-core-1.0.0-r1.apk" \
    "$TMPDIR/luci-app-mrouter-1.0.0-r1.apk" \
    "$TMPDIR/luci-theme-mrouter-1.0.0-r1.apk" \
    "$TMPDIR/mrouter-setup-1.0.0-r1.apk" \
    "$TMPDIR/mrouter-os-1.0.0-r1.apk" \
    || fail "Mrouter-OS installation failed."

LAN_IP="$(uci -q get network.lan.ipaddr 2>/dev/null || true)"

info ""
info "Mrouter-OS v${MROUTER_VERSION} installed successfully."
info ""
info "The installer does not run the Mrouter setup wizard automatically."
info "Your existing OpenWrt network configuration is left for the Mrouter setup flow to handle explicitly."
if [ -n "$LAN_IP" ]; then
    info "Configured LAN address: ${LAN_IP}"
fi
info "Open the router web interface and continue with Mrouter setup."
info ""
info "Release: https://github.com/${REPOSITORY}/releases/tag/v${MROUTER_VERSION}"
