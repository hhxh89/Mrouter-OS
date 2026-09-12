# Build

Mrouter-OS v1.0.0 is audited against OpenWrt **25.12.5**.

## Package-first build (recommended)

```bash
cd ~/mrouter-os-v1
./validate-source.sh
JOBS=4 ./build-packages.sh ~/openwrt-x86/source
```

`build-packages.sh` installs the package sources into the OpenWrt tree, refreshes package metadata, enables all five Mrouter packages in the existing `.config`, builds only those packages, and writes the APKs plus `SHA256SUMS` to `~/mrouter-v1-packages/`.

The installer keeps old Mrouter source backups under `.mrouter-backups/` outside `package/`; this prevents OpenWrt from discovering duplicate package definitions.

## Full x86-64 firmware build

Only use a full build when testing changes to the OpenWrt base, kernel, image layout or release image:

```bash
./install-into-openwrt.sh ~/openwrt-x86/source
JOBS=4 ./build-v1.sh ~/openwrt-x86/source
```

The full-build seed is `build/mrouter-v1.diffconfig`.

## Never put secrets in the source tree

Do not copy router backups, `/etc/shadow`, Dropbear/SSH private host keys, Tailscale state, WireGuard private keys, VPN credentials, API tokens, AdGuard credentials, or other runtime secrets into this repository.
