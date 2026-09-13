include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-mrouter
PKG_VERSION:=1.1.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-mrouter
  SECTION:=luci
  CATEGORY:=LuCI
  TITLE:=Mrouter-OS management interface
  DEPENDS:=+luci-base +rpcd-mod-file +cgi-io +mrouter-core +luci-mod-network +luci-mod-system +luci-mod-status +luci-app-firewall +luci-app-sqm +luci-app-package-manager
endef

define Package/luci-app-mrouter/description
 Native YAML-driven Mrouter-OS management interface for Internet, clients, wireless, VPN, protection, services, events and advanced administration.
endef

define Build/Compile
endef

define Package/luci-app-mrouter/install
	$(INSTALL_DIR) $(1)/www
	$(CP) ./htdocs/* $(1)/www/
	# Old handwritten LuCI views remain in source temporarily as migration reference only.
	# They are deliberately excluded from the APK; every shipped Mrouter route is generated from YAML.
	rm -rf $(1)/www/luci-static/resources/view/mrouter
	$(INSTALL_DIR) $(1)/
	$(CP) ./root/* $(1)/
endef

define Package/luci-app-mrouter/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || { rm -f /tmp/luci-indexcache*; rm -rf /tmp/luci-modulecache/* 2>/dev/null || true; /etc/init.d/rpcd reload 2>/dev/null || true; }
exit 0
endef

$(eval $(call BuildPackage,luci-app-mrouter))
