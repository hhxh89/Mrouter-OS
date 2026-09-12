# Upgrade strategy

Mrouter-OS is package-first.

For installation or upgrade testing, use a clean OpenWrt 25.12.5 system where possible and create a configuration backup or snapshot before installing Mrouter.

For later v1 updates, upgrade the five Mrouter APKs together and run `/usr/libexec/mrouter-migrate`. Migrations must remain idempotent and preserve user network, DNS, VPN, PBR, IoT and service choices.

Use a full sysupgrade only when the OpenWrt base, kernel, image layout or firmware-level defaults have changed.
