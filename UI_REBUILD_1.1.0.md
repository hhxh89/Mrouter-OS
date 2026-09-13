# Mrouter 1.1.0 UI rebuild

This branch replaces the inherited Material interaction layer with a Mrouter-owned LuCI shell while keeping LuCI routing, ACLs, RPC and all Mrouter backend helpers.

## Confirmed issues from test VM

1. Sidebar can lock after rapid repeated clicks on expandable groups such as VPN, Services, Protection and Advanced.
2. Selecting text and then clicking can leave the page/sidebar unresponsive until refresh.
3. Session/login transitions can render a stale or dead login page; the current theme sysauth/header path does not use LuCI's current blank-page login pattern.
4. The theme still loads `menu-material` and imports Material CSS, so Mrouter interaction behaviour is still coupled to upstream Material.
5. Events can show a red notification containing a successful helper payload such as `STATUS|1|1|1|1`.
6. DHCP scope fields can overflow cards and scope labels can run together.
7. Setup must disappear when `mrouter.system.setup_complete=1` and Keep Current Settings must persist that state.
8. Login page must be Mrouter-owned and must not show the large outer card.
9. Live-tested Internet/OpenVPN/WireGuard/Tailscale/Policy/VPN Dashboard behaviour must be preserved during the shell rebuild.

## Rebuild rules

- Do not replace OpenWrt's network stack.
- Do not rewrite existing WAN/LAN/DHCP/firewall settings during install.
- Keep LuCI dispatcher, session/authentication, ACL and view APIs.
- Remove Mrouter runtime dependence on `menu-material`.
- Do not use invisible desktop overlays.
- Desktop sidebar state must be deterministic and safe under rapid clicking and text selection.
- Mobile overlay exists only below the mobile breakpoint and must always be dismissible.
- Login uses a blank-page theme template compatible with the current LuCI dispatcher.
- Preserve Expert LuCI as fallback.

## Test gates before a new APK build

- 100 rapid sidebar parent/submenu clicks without lock.
- Select text repeatedly on content and sidebar; navigation remains responsive.
- Logout -> custom Mrouter login -> login -> dashboard works repeatedly.
- Restart rpcd/uhttpd while logged in -> session recovery/login remains usable.
- Events save/clear never exposes raw `STATUS|...` as an error.
- DHCP layout remains inside cards at desktop/tablet/mobile widths.
- Setup hides after Keep Current Settings.
- All LuCI JS passes syntax checks and package source validation passes.
