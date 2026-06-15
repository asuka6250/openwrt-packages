#!/bin/bash

sed -i 's/^[ \t]*default n/\tdefault y/g'  luci-app-passwall/Makefile
