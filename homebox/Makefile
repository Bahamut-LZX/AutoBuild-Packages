# SPDX-License-Identifier: MIT
#
# Copyright (C) 2026

include $(TOPDIR)/rules.mk

PKG_NAME:=homebox
PKG_VERSION:=0.1.3
PKG_RELEASE:=1

PKG_SOURCE_PROTO:=git
PKG_SOURCE_URL:=https://github.com/XGHeaven/homebox.git
PKG_SOURCE_VERSION:=v$(PKG_VERSION)
PKG_MIRROR_HASH:=skip

PKG_MAINTAINER:=Bahamut-LZX <liuzhixiong007@gmail.com>
PKG_LICENSE:=MIT
PKG_LICENSE_FILES:=LICENSE

PKG_BUILD_DEPENDS:=node/host rust/host
PKG_BUILD_PARALLEL:=1

# node/host intentionally ships the host node binary without npm/corepack, so
# pnpm is bootstrapped from its own self-contained npm tarball and driven with
# the staged host node.
PNPM_VERSION:=9.12.2
PNPM_FILE:=pnpm-$(PNPM_VERSION).tgz
PNPM_HASH:=2ef6e547b0b07d841d605240dce4d635677831148cd30f6d564b8f4f928f73d2

include $(INCLUDE_DIR)/package.mk

# rust-package.mk lives in the 'packages' feed. After './scripts/feeds update'
# it is at feeds/packages/lang/rust/, while './scripts/feeds install' adds a
# symlink at package/feeds/packages/rust/. Probe both so the package builds in
# either state (a plain update is enough in the AutoBuild cloud build).
RUST_PACKAGE_MK:=$(strip $(firstword \
	$(wildcard $(TOPDIR)/feeds/packages/lang/rust/rust-package.mk) \
	$(wildcard $(TOPDIR)/package/feeds/packages/rust/rust-package.mk)))
ifeq ($(RUST_PACKAGE_MK),)
  $(error Unable to find rust-package.mk, the 'packages' feed is not available)
endif
include $(RUST_PACKAGE_MK)

RUST_PKG_LOCKED:=1

PNPM_DIR:=$(PKG_BUILD_DIR)/.pnpm

# cargo has to be invoked inside server/
MAKE_PATH:=server

define Download/pnpm
  FILE:=$(PNPM_FILE)
  URL:=https://registry.npmjs.org/pnpm/-
  HASH:=$(PNPM_HASH)
endef
$(eval $(call Download,pnpm))

define Package/homebox
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Web Servers/Proxies
  TITLE:=Homebox - LAN speed test server
  URL:=https://github.com/XGHeaven/homebox
  # the release profile keeps panic=unwind, so the unwinder in libgcc_s.so.1
  # is a hard runtime dependency
  DEPENDS:=$(RUST_ARCH_DEPENDS) +libgcc
endef

define Package/homebox/description
  Homebox is a home network toolbox providing a browser based LAN speed test
  (ping / download / upload) that is able to saturate multi-gigabit links.
endef

define Package/homebox/conffiles
/etc/config/homebox
endef

# procd only learns a service (and, via service_triggers(), the trigger that
# reloads it when /etc/config/homebox changes) once the init script has been run
# at least once. Without this the "enabled" switch in LuCI would silently do
# nothing until the next reboot. With enabled='0' this starts no process, it
# only registers the service and its config change trigger.
define Package/homebox/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/homebox enable
	/etc/init.d/homebox start
	exit 0
}
endef

define Build/Prepare
	$(call Build/Prepare/Default)
	@[ -f $(DL_DIR)/$(PNPM_FILE) ] || { \
		echo "ERROR: $(DL_DIR)/$(PNPM_FILE) is missing."; \
		echo "       Run 'make package/$(PKG_NAME)/download' (or 'make download') first."; \
		false; \
	}
	mkdir -p $(PNPM_DIR)
	$(TAR) -xzf $(DL_DIR)/$(PNPM_FILE) -C $(PNPM_DIR) --strip-components=1
endef

# The web frontend is embedded into the server binary at compile time through
# include_dir!("../build/static"), so it has to be built before cargo runs.
define Build/Compile/Web
	( \
		set -e; \
		cd $(PKG_BUILD_DIR)/web; \
		mkdir -p $(PKG_BUILD_DIR)/.home; \
		CI=1 HOME=$(PKG_BUILD_DIR)/.home \
			node $(PNPM_DIR)/bin/pnpm.cjs install --frozen-lockfile \
				--store-dir=$(DL_DIR)/pnpm-store; \
		NODE_ENV=production HOME=$(PKG_BUILD_DIR)/.home \
			node $(PNPM_DIR)/bin/pnpm.cjs run build; \
		$(CP) $(CURDIR)/files/embed-height.js $(PKG_BUILD_DIR)/build/static/embed-height.js; \
		$(SED) 's#</body>#<script src="/static/embed-height.js"></script></body>#' \
			$(PKG_BUILD_DIR)/build/static/index.html; \
		grep -q 'static/embed-height.js' $(PKG_BUILD_DIR)/build/static/index.html; \
	)
endef

define Build/Compile
	$(call Build/Compile/Web)
	$(call Build/Compile/Cargo)
endef

define Package/homebox/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_INSTALL_DIR)/bin/homebox $(1)/usr/bin/homebox

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) $(CURDIR)/files/homebox.config $(1)/etc/config/homebox

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) $(CURDIR)/files/homebox.init $(1)/etc/init.d/homebox
endef

$(eval $(call BuildPackage,homebox))
