# Mrouter-OS v1.0 Security Baseline

- OpenWrt base pinned to 25.12.5 for this RC.
- Firewall4/nftables only; old StrongSwan/IPsec holes removed.
- No default WAN-side LuCI/SSH exposure.
- Root password warning remains visible until a password is set.
- IoT is bidirectionally isolated from LAN.
- Tailscale and WireGuard do not bridge remote users into IoT.
- OpenVPN imports are treated as privileged/untrusted input and reject command/script/plugin/management directives and unsafe bundle paths.
- DDNS provider output is not sourced as shell code.
- RPC ACL read permissions execute status-only wrappers; mutators require write permission.
- Parental and content-filter state use dedicated nftables tables so they do not patch firewall4-owned tables.
- Protection profile input is constrained before being passed to UCI/nftables; MAC/IP/domain values are validated.
- Forced DNS can prevent ordinary port-53 and DoT/853 bypass. Arbitrary DoH over HTTPS cannot be reliably identified without DPI and is not falsely claimed as blocked.
- AdGuard Home stays in front of dnsmasq-full only when its upstream has been explicitly changed to the local dnsmasq layer, preserving PBR/domain-filter semantics.
- DPI/NetifyD is omitted from the stable base image to reduce attack surface, CPU overhead and external signature dependencies.
- Unused privileged web apps and network daemons are omitted rather than merely hidden.
- The uploaded VM108 backup is confidential and must never be committed. It contains host keys, password hashes and VPN/Tailscale state.
