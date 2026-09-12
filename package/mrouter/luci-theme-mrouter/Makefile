include $(TOPDIR)/rules.mk

PKG_NAME:=luci-theme-mrouter
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-theme-mrouter
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=Themes
  TITLE:=Mrouter-OS Theme
  DEPENDS:=+luci-base +luci-theme-material
endef

define Package/luci-theme-mrouter/description
 Mrouter-OS responsive iOS-inspired theme layered on the upstream Material assets.
endef

define Build/Compile
endef

define Package/luci-theme-mrouter/install
	$(INSTALL_DIR) $(1)/www
	$(CP) ./htdocs/* $(1)/www/
	$(INSTALL_DIR) $(1)/usr/share/ucode/luci
	$(CP) ./ucode/* $(1)/usr/share/ucode/luci/
	$(INSTALL_DIR) $(1)/
	$(CP) ./root/* $(1)/
endef

define Package/luci-theme-mrouter/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	rm -f /tmp/luci-indexcache*
	rm -rf /tmp/luci-modulecache/* 2>/dev/null || true
	/etc/init.d/rpcd reload 2>/dev/null || true
}
exit 0
endef

define Package/luci-theme-mrouter/postrm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	uci -q delete luci.themes.Mrouter
	uci commit luci
}
exit 0
endef

$(eval $(call BuildPackage,luci-theme-mrouter))
