# Upgrade strategy

Mrouter-OS is package-first.

For the first v1.0.0 candidate test, use a **clean OpenWrt 25.12.5 installation**. Earlier test packages used version `12.0.0_rc3`, which sorts above `1.0.0`; rolling VM109 back to its clean snapshot is safer than forcing an APK version downgrade.

For later v1 updates, upgrade the five Mrouter APKs together and run `/usr/libexec/mrouter-migrate`. Migrations must remain idempotent and preserve user network, DNS, VPN, PBR, IoT and service choices.

Use a full sysupgrade only when the OpenWrt base, kernel, image layout or firmware-level defaults have changed.
