<h4 align="right"><strong>English</strong> | <a href="README_zh.md">简体中文</a></h4>
<p align="center">
    <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/logo/logo-lockup.png" width="360" alt="Shadcn LuCI Theme"/>
</p>
<p align="center"><sub><em>The logo is really just shadcn/ui's mark — I slipped a diagonal line across it to make it look a bit more like a Wi-Fi signal (squint, tilt your head — yeah, sort of, heh).</em></sub></p>
<p align="center"><strong>A modern sidebar LuCI theme for OpenWrt, built with shadcn/ui design language.</strong></p>
<h4 align="center">🗂️ Sidebar Layout | 🌗 Dark / Light Mode | 📱 Mobile Drawer</h4>
<div align="center">
  <a href="https://openwrt.org"><img alt="OpenWrt" src="https://img.shields.io/badge/OpenWrt-%E2%89%A523.05-00B5E2?logo=openwrt&logoColor=white"></a>
  <a href="https://github.com/eamonxg/luci-theme-shadcn/releases/latest"><img alt="GitHub release" src="https://img.shields.io/github/v/release/eamonxg/luci-theme-shadcn"></a>
  <a href="https://github.com/eamonxg/luci-theme-shadcn/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/eamonxg/luci-theme-shadcn/total"></a>
</div>

<div align="center">
  <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/preview/login.png" alt="Login Page" width="100%">
</div>

## Features

- **Sidebar layout**: Collapsible sidebar with accordion sub-menus and mobile drawer.
- **Dark / Light mode**: Built-in toggle, preference persisted via `localStorage`, flash-free restore on load.
- **shadcn/ui design**: Semantic color tokens, `rounded-lg` components, `hover:bg-muted` interactions.
- **Modern stack**: Vite + TailwindCSS v4 build, Inter variable font, Lucide icons.

## Preview

<div align="center">
  <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/preview/preview.png" alt="Theme Preview" width="100%">
</div>

## Compatibility

- **OpenWrt**: Requires OpenWrt 23.05.0 or later (ucode templates + LuCI JavaScript APIs).

## Install a pre-built release

OpenWrt 25.12+ and snapshots use `apk`; older versions use `opkg`.

> **Tip**: Run `opkg --version` or `apk --version` to check which package manager your device has.

- **opkg** (OpenWrt < 25.12):

  ```sh
  cd /tmp && uclient-fetch -O luci-theme-shadcn.ipk https://github.com/eamonxg/luci-theme-shadcn/releases/latest/download/luci-theme-shadcn_0.2.0-r20260621_all.ipk && opkg install luci-theme-shadcn.ipk
  ```

- **apk** (OpenWrt 25.12+ and snapshots):

  ```sh
  cd /tmp && uclient-fetch -O luci-theme-shadcn.apk https://github.com/eamonxg/luci-theme-shadcn/releases/latest/download/luci-theme-shadcn-0.2.0-r20260621.apk && apk add --allow-untrusted luci-theme-shadcn.apk
  ```

## Build from source

Build the package yourself with the OpenWrt build system. Host prerequisites: [Build system setup](https://openwrt.org/docs/guide-developer/toolchain/install-buildsystem). The build writes the package to `bin/packages/<arch>/base/` (e.g. `bin/packages/x86_64/base/luci-theme-shadcn_*_all.ipk`); copy it to your router and install it as above.

### Via the OpenWrt buildroot

```sh
# Clone OpenWrt — the openwrt-24.10 branch builds an .ipk, the main branch builds an .apk
git clone https://github.com/openwrt/openwrt.git
cd openwrt
git checkout openwrt-24.10       # omit to stay on main (snapshots → .apk)

# Add this package and install feeds (provides luci-base)
git clone https://github.com/eamonxg/luci-theme-shadcn.git package/luci-theme-shadcn
./scripts/feeds update -a
./scripts/feeds install -a

# Select the theme in menuconfig: LuCI → Themes → luci-theme-shadcn
make menuconfig

# Build host tools + toolchain, then compile the package
make tools/install -j$(nproc)
make toolchain/install -j$(nproc)
make package/luci-theme-shadcn/compile -j$(nproc) V=s
```

### Via the prebuilt SDK (faster)

The [OpenWrt SDK](https://openwrt.org/docs/guide-developer/toolchain/using_the_sdk) bundles a prebuilt toolchain, so the `tools/install` / `toolchain/install` steps are skipped. Download the SDK for your target from [downloads.openwrt.org](https://downloads.openwrt.org) (a release SDK builds `.ipk`, a snapshot SDK builds `.apk`), extract it, then from the SDK directory:

```sh
git clone https://github.com/eamonxg/luci-theme-shadcn.git package/luci-theme-shadcn
./scripts/feeds update -a
./scripts/feeds install -a

# Select the theme in menuconfig: LuCI → Themes → luci-theme-shadcn
make menuconfig
make package/luci-theme-shadcn/compile -j$(nproc) V=s
```

## License & Acknowledgments

[Apache 2.0](LICENSE). Thanks to:

- [shadcn/ui](https://github.com/shadcn-ui/ui) — component aesthetics, tokens, and interaction patterns
- [Lucide](https://github.com/lucide-icons/lucide) — icons
- [Linear](https://linear.app) — color system inspiration
- [Vite](https://vite.dev/) and [Tailwind CSS](https://tailwindcss.com/)
- [luci-theme-bootstrap](https://github.com/openwrt/luci/tree/master/themes/luci-theme-bootstrap) — template structure and LuCI integration patterns
- [Claude Code](https://claude.ai/code)
