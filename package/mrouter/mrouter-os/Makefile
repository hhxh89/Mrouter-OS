include $(TOPDIR)/rules.mk

PKG_NAME:=mrouter-os
PKG_VERSION:=1.0.0
PKG_RELEASE:=1
PKG_LICENSE:=Apache-2.0
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/mrouter-os
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Mrouter-OS complete package suite
  DEPENDS:=+mrouter-core +luci-app-mrouter +luci-theme-mrouter +mrouter-setup
endef

define Package/mrouter-os/description
 Meta-package for the complete Mrouter-OS interface, core services, theme and safe setup wizard.
endef

define Build/Compile
endef

define Package/mrouter-os/install
	true
endef

$(eval $(call BuildPackage,mrouter-os))
