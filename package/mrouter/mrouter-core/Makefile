include $(TOPDIR)/rules.mk

PKG_NAME:=mrouter-core
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/mrouter-core
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Mrouter-OS core services
  DEPENDS:=+curl +ethtool +ip-full +netcat +dnsmasq-full +nlbwmon +pbr +wireguard-tools +openvpn-openssl +tailscale +adguardhome +jsonfilter +ttyd +openssl-util +iwinfo +mwan3
endef

define Package/mrouter-core/description
 Core status, VPN, policy routing, wireless, WAN monitoring, DDNS, filtering and monitoring helpers for Mrouter-OS. Existing OpenWrt network topology is preserved unless the user explicitly changes it.
endef

define Package/mrouter-core/conffiles
/etc/config/mrouter
/etc/config/mrouterpolicy
/etc/config/mrouterddns
/etc/config/mrouterparental
/etc/config/mrouterfilter
/etc/config/mrouterservices
/etc/config/mrouterclients
/etc/config/mrouterevents
/etc/config/mrouterwan
/etc/config/mrouterwgclient
/etc/config/mrouterui
endef

define Build/Compile
	true
endef

define Package/mrouter-core/install
	$(INSTALL_DIR) $(1)/usr/libexec
	$(CP) ./files/usr/libexec/* $(1)/usr/libexec/
	$(INSTALL_DIR) $(1)/etc/init.d
	$(CP) ./files/etc/init.d/* $(1)/etc/init.d/
	$(INSTALL_DIR) $(1)/etc/config
	$(CP) ./files/etc/config/* $(1)/etc/config/
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(CP) ./files/etc/uci-defaults/* $(1)/etc/uci-defaults/
	$(INSTALL_DIR) $(1)/etc
	$(INSTALL_DATA) ./files/etc/mrouter-release $(1)/etc/mrouter-release
endef

define Package/mrouter-core/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/usr/libexec/mrouter-migrate >/dev/null 2>&1 || true
	/usr/libexec/mrouter-ui-config status >/dev/null 2>&1 || true
	/etc/init.d/mrouter-observer enable >/dev/null 2>&1 || true
	/etc/init.d/mrouter-observer restart >/dev/null 2>&1 || true
}
exit 0
endef

$(eval $(call BuildPackage,mrouter-core))
