#!/bin/bash

TARGET_FILE="luci-app-lanspeed/applications/luci-app-lanspeed/root/usr/share/luci/menu.d/luci-app-lanspeed.json"
if [ -f "$TARGET_FILE" ]; then
  jq '."admin/status/lanspeed".title = "实时流量"' "$TARGET_FILE" > tmp.json && mv tmp.json "$TARGET_FILE"
fi

sed -i 's/ifup|ifupdate)/ifup)/g' luci-app-lanspeed/net/lanspeedd/files/etc/hotplug.d/iface/90-lanspeedd
# sed -i '/\[ -x \/etc\/init.d\/lanspeedd \]/a [ "$INTERFACE" = "wan6" ] && exit 0' luci-app-lanspeed/net/lanspeedd/files/etc/hotplug.d/iface/90-lanspeedd
