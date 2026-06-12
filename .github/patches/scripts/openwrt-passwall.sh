#!/bin/bash

sed -i 's/^[ \t]*default n/\tdefault y/g'  openwrt-passwall/luci-app-passwall/Makefile
