# Changelog

## 1.0.0

- Converted Mrouter to a package-first five-package architecture with an explicit safe setup package and meta-package.
- Removed destructive automatic WAN/LAN defaults; existing OpenWrt networking is preserved unless the user explicitly chooses a setup profile.
- Added a completed-state Setup experience and safe reconfiguration flow.
- Removed Insights and the dead Internet live-traffic chart.
- Moved Tailscale under VPN and fixed its dashboard state parsing.
- Added Local Services for Home Assistant, Pi-hole, Proxmox, Immich, Jellyfin, Plex, TrueNAS, Synology, OpenMediaVault, Portainer, Grafana and custom web services.
- Fixed Local Services name validation and added pasted HTTP/HTTPS URL normalization.
- Added explicit Pi-hole/Mrouter DNS-provider switching without changing DNS merely by adding a service.
- Expanded Content Filter quick-block presets; removed misleading DPI UI and added allow-list support.
- Reworked live port-role, LAN subnet and IoT status detection to use actual OpenWrt state.
- Scoped client discovery to LAN/IoT and excluded WAN gateway/router addresses; added shared hostname hints from leases and reservations.
- Modernized Advanced networking: Networks, DHCP & DNS, Firewall zone matrix, Routing, Traffic Control and Diagnostics.
- Modernized Administration: Device Settings, Administrator Account, SSH, SSH Keys, Web Access, Startup & Services, Scheduled Tasks, Backup & Firmware, Logs, Processes and Package Manager.
- Added Expert LuCI escape hatches for low-level configuration.
- Added a modern Diagnostics self-test, ping, traceroute, DNS lookup and TCP port test.
- Added Traffic Control presets on top of SQM/CAKE.
- Fixed Internet topology management-address display and unambiguous date formatting.
- Fixed stale WireGuard text and OpenVPN prerequisite control states.
- Added notification/password-state UI fixes and Content Filter spacing corrections.
- Preserved the non-blocking Refreshing indicator and editable login username behavior.
