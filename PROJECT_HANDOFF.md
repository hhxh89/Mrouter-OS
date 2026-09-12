# Mrouter-OS v1.0.0 project handoff

## Target
A package-first OpenWrt 25.12.5 router distribution with a modern Mrouter UI, while preserving Expert LuCI for low-level work.

## Package tree
`package/mrouter/{mrouter-core,luci-app-mrouter,luci-theme-mrouter,mrouter-setup,mrouter-os}`.

## Critical safety rule
Installing Mrouter must never silently rewrite the existing network. Existing installs should use Setup -> **Keep Current OpenWrt Network**. Optional two-port setup is explicit and creates a backup before writing configuration.

## v1 Advanced redesign
Network Settings provides Port Assignment, Networks, DHCP & DNS, Firewall, Routing, Traffic Control and Diagnostics. Administration provides Device Settings, Administrator Account, SSH Access, SSH Keys, Web Access, Startup & Services, Scheduled Tasks and Backup & Firmware. System Health, System Log, Processes, Terminal and Package Manager remain under Advanced. Expert LuCI links expose the stock OpenWrt pages when required.

## Important v1 fixes
- Port roles/subnets are derived from live UCI/runtime state.
- IoT defaults are not shown as if configured.
- WAN gateway/router IPs are excluded from client lists.
- Client naming uses DHCP/static hostname hints when available.
- Tailscale dashboard state parsing is corrected.
- Local Services validates normal names and normalizes pasted URLs.
- Setup has a clear completed state.
- Internet topology uses the LAN management address where appropriate.
- Content Filter labels, WireGuard stale wording, OpenVPN control prerequisites and password/notification UX are corrected.

## Build
Use `JOBS=4 ./build-packages.sh ~/openwrt-x86/source`. Expected output is `~/mrouter-v1-packages/` with five `1.0.0-r1` APKs and `SHA256SUMS`.

## Testing VM
Release testing should use a disposable two-interface OpenWrt 25.12.5 system with a snapshot or equivalent rollback point before package installation.

## Release status
Mrouter-OS v1.0.0 completed package compilation, clean-install testing and reboot-persistence testing before promotion to the stable release.
