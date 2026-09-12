# Mrouter-OS v1.0.0

Mrouter-OS is a package-first OpenWrt 25.12.5 router experience. It keeps OpenWrt underneath, but replaces the everyday management experience with a simpler Mrouter interface for Internet, clients, VPN, protection, services and advanced administration.

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

All packages use version `1.0.0`. This source bundle is a **v1.0.0 candidate** until its APKs have compiled and passed the VM109 smoke test.

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
