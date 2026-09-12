# Architecture

Mrouter-OS v1.0.0 layers a modern management experience on OpenWrt 25.12.5 rather than replacing OpenWrt internals.

## Packages

- `mrouter-core`: status/action helpers, services, UCI defaults and migrations. Hardware-neutral and non-destructive.
- `luci-app-mrouter`: everyday Mrouter UI and modern Advanced views.
- `luci-theme-mrouter`: templates, branding and shared design system.
- `mrouter-setup`: explicit first-run setup and safe optional two-port profile.
- `mrouter-os`: meta-package depending on the complete suite.

## Source of truth

Network roles, interfaces, subnets, firewall zones, routes, DHCP state and service status are read from live OpenWrt UCI/runtime state. Mrouter configuration stores Mrouter-specific preferences, not a competing copy of the network topology.

## UI model

The main navigation is Internet, Clients, IoT Clients, VPN, Services, Protection and Advanced. Advanced provides plain-language controls for common router tasks. Expert LuCI remains accessible for DSA, unusual VLAN layouts and other low-level functions.

The Firewall view presents zone relationships; Routing separates default/traffic routes from static routes; Traffic Control presents SQM/CAKE as simple Smart Queue controls; Diagnostics presents structured tests rather than a raw command box.

## Safety

Package installation must not change the user's WAN/LAN mapping, addresses, DHCP, firewall or VLAN layout. Setup changes are explicit, backed up, and do not silently restart networking. Normal stock LuCI pages keep their own Apply/Rollback safeguards.
