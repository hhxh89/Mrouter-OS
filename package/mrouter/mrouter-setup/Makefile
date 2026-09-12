include $(TOPDIR)/rules.mk

PKG_NAME:=mrouter-setup
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/mrouter-setup
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Mrouter-OS safe first-run setup
  DEPENDS:=+mrouter-core +luci-base +rpcd-mod-file
endef

define Package/mrouter-setup/description
 Safe, explicit first-run network setup for Mrouter-OS. Installing Mrouter never rewrites WAN/LAN automatically.
endef

define Build/Compile
endef

define Package/mrouter-setup/install
	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_BIN) ./files/usr/libexec/mrouter-setup $(1)/usr/libexec/mrouter-setup
	$(INSTALL_DIR) $(1)/www
	$(CP) ./htdocs/* $(1)/www/
	$(INSTALL_DIR) $(1)/
	$(CP) ./root/* $(1)/
endef

define Package/mrouter-setup/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache*
	rm -rf /tmp/luci-modulecache/* 2>/dev/null || true
	/etc/init.d/rpcd reload 2>/dev/null || true
}
exit 0
endef

$(eval $(call BuildPackage,mrouter-setup))
