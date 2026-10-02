# SPDX-License-Identifier: MIT
#
# Copyright (C) 2026

include $(TOPDIR)/rules.mk

# Out-of-feed LuCI apps cannot derive a version from the luci git feed, so set
# one explicitly instead of falling back to "0".
PKG_VERSION:=0.1.3
PKG_RELEASE:=1

LUCI_TITLE:=LuCI support for Homebox
LUCI_DESCRIPTION:=LuCI page to control and embed the Homebox LAN speed test server.
LUCI_DEPENDS:=+luci-base +homebox
LUCI_PKGARCH:=all

PKG_LICENSE:=MIT
PKG_MAINTAINER:=Bahamut-LZX <liuzhixiong007@gmail.com>
# luci.mk fills the package MAINTAINER from LUCI_MAINTAINER, PKG_MAINTAINER alone
# would be silently ignored.
LUCI_MAINTAINER:=$(PKG_MAINTAINER)

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
