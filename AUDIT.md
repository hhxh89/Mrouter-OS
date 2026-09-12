# Pre-v1 audit summary

The v1 source was consolidated from the earlier development candidates into one canonical five-package tree. Historical duplicate pages/helpers and the Insights/live-traffic experiments are not shipped.

Key audit outcomes carried into v1:
- no router backups, credentials, private keys, Tailscale state or other runtime secrets belong in source;
- package source backups stay outside OpenWrt `package/` so duplicate package definitions are not discovered;
- helpers expose bounded, purpose-specific status/action interfaces through the Mrouter ACL;
- existing network configuration is authoritative and is not replaced by package defaults;
- WireGuard remote access does not automatically expose IoT;
- unsupported/deprecated optional subsystems are not selected in the base build seed;
- Expert LuCI remains available rather than pretending every unusual OpenWrt topology can be represented by the simplified UI.

The v1 release gate is defined in `TESTING.md`.
