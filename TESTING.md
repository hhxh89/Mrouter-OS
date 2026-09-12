# Testing Mrouter-OS v1.0.0

Use a disposable router/VM and keep a hypervisor snapshot before installation.

## Recommended test environment

Use a disposable two-interface OpenWrt 25.12.5 VM or supported physical router.

Before installation:

- record the existing LAN and WAN configuration;
- create a configuration backup or VM snapshot;
- confirm Internet and DNS connectivity;
- verify the router is reachable through a management interface.

After installation, verify that existing networking remains unchanged unless a setup change was explicitly requested.

## Install test

On a clean OpenWrt 25.12.5 VM, copy all five APKs to `/tmp` and install them together:

```sh
apk add --allow-untrusted \
  /tmp/mrouter-core-1.0.0-r1.apk \
  /tmp/luci-app-mrouter-1.0.0-r1.apk \
  /tmp/luci-theme-mrouter-1.0.0-r1.apk \
  /tmp/mrouter-setup-1.0.0-r1.apk \
  /tmp/mrouter-os-1.0.0-r1.apk

/usr/libexec/mrouter-migrate
```

Do not reboot immediately. Confirm saved and live network state first.

## Required smoke tests

- Setup -> **Keep Current OpenWrt Network** does not alter network/DHCP/firewall.
- Setup changes to a clear completed state with a route to the Internet dashboard.
- Internet shows the real WAN path and LAN management address.
- Clients excludes WAN gateway/router addresses and uses the best available client name.
- IoT page shows **Not configured** when no IoT network exists.
- VPN dashboard reports Tailscale login/connected state consistently.
- Local Services accepts a name such as `Home Assistant` and both `192.168.11.103` and `http://192.168.11.103` forms.
- Content Filter labels are separated correctly and quick-block presets work.
- Advanced -> Port Assignment reads actual UCI roles and current LAN subnet.
- Advanced -> Networks, DHCP & DNS, Firewall, Routing, Traffic Control and Diagnostics load without JavaScript errors.
- Administration pages load, and Expert LuCI links remain available.
- Password success state removes any stale "No password set" warning and notification Dismiss works.
- Reboot only after the saved network configuration is verified; then confirm network persistence.

## Release gate

Do not label v1.0.0 stable until package compilation, fresh-install smoke testing, one reboot-persistence test, and rollback/recovery testing pass.
