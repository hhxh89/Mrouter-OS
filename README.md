# Mrouter-OS v1.0.0

Mrouter-OS is a package-first OpenWrt 25.12.5 router experience. It keeps OpenWrt underneath, but replaces the everyday management experience with a simpler Mrouter interface for Internet, clients, VPN, protection, services and advanced administration.

## Quick Install — OpenWrt 25.12.5 x86-64

Run as `root` on a supported OpenWrt 25.12.5 x86-64 router:

```bash
wget -O /tmp/install-mrouter.sh \
  https://raw.githubusercontent.com/hhxh89/Mrouter-OS/main/install-mrouter.sh

sh /tmp/install-mrouter.sh
```

The installer:

- verifies that it is running on OpenWrt 25.12.5 x86-64;
- downloads the official Mrouter-OS v1.0.0 release packages from GitHub Releases;
- verifies the pinned `SHA256SUMS` file and all five APK package checksums;
- refreshes the configured OpenWrt package indexes so dependencies can be resolved;
- installs `mrouter-core`, `luci-app-mrouter`, `luci-theme-mrouter`, `mrouter-setup` and `mrouter-os` together;
- cleans up temporary download files automatically;
- does not automatically run the Mrouter first-run network setup.

Mrouter is designed not to silently rewrite the router's existing WAN/LAN, DHCP, firewall, VLAN or IP configuration during package installation. Network changes remain an explicit setup action.

> The installer is intentionally pinned to the stable `v1.0.0` release rather than downloading arbitrary files from the latest development source.

### Manual install

If you prefer to inspect and install the release packages yourself, download the five APK files and `SHA256SUMS` from the [v1.0.0 release](https://github.com/hhxh89/Mrouter-OS/releases/tag/v1.0.0), verify the checksums, then install the APKs together with `apk add --allow-untrusted`.

## v1 principles

- Installing Mrouter **does not silently rewrite WAN/LAN, DHCP, firewall, VLAN or IP settings**.
- First-run setup is explicit. Existing OpenWrt users can choose **Keep Current OpenWrt Network**.
- Everyday pages use plain-language controls; **Expert LuCI** remains available for unusual or low-level configurations.
- UI, theme and backend changes are delivered as APK packages whenever possible. Full firmware builds are reserved for base/kernel/image changes.
- Runtime status must come from the current OpenWrt configuration and live state, not hard-coded appliance defaults.

## Packages

```text
package/mrouter/
├── mrouter-core/         # helpers, services and UCI migrations
├── luci-app-mrouter/     # Mrouter UI
├── luci-theme-mrouter/   # branding and shared design system
├── mrouter-setup/        # safe first-run setup
└── mrouter-os/           # meta-package
```

All packages use version `1.0.0`. This is the stable Mrouter-OS v1.0.0 release for OpenWrt 25.12.5.

## Build only the Mrouter packages

```bash
cd ~/mrouter-os-v1
JOBS=4 ./build-packages.sh ~/openwrt-x86/source
```

Output:

```text
~/mrouter-v1-packages/
```

Expected APKs:

```text
mrouter-core-1.0.0-r1.apk
luci-app-mrouter-1.0.0-r1.apk
luci-theme-mrouter-1.0.0-r1.apk
mrouter-setup-1.0.0-r1.apk
mrouter-os-1.0.0-r1.apk
```

See `BUILD.md` and `TESTING.md` before installing on a router.
