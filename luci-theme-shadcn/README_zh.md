<h4 align="right"><a href="README.md">English</a> | <strong>简体中文</strong></h4>
<p align="center">
    <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/logo/logo-lockup.png" width="360" alt="Shadcn LuCI Theme"/>
</p>
<p align="center"><strong>一款基于 shadcn/ui 设计语言构建的现代侧边栏 OpenWrt LuCI 主题。</strong></p>
<h4 align="center">🗂️ 侧边栏布局 | 🌗 深色/浅色模式 | 📱 移动端抽屉</h4>
<div align="center">
  <a href="https://openwrt.org"><img alt="OpenWrt" src="https://img.shields.io/badge/OpenWrt-%E2%89%A523.05-00B5E2?logo=openwrt&logoColor=white"></a>
  <a href="https://github.com/eamonxg/luci-theme-shadcn/releases/latest"><img alt="GitHub release" src="https://img.shields.io/github/v/release/eamonxg/luci-theme-shadcn"></a>
  <a href="https://github.com/eamonxg/luci-theme-shadcn/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/eamonxg/luci-theme-shadcn/total"></a>
</div>

<div align="center">
  <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/preview/login.png" alt="登录页" width="100%">
</div>

## 特性

- **侧边栏布局**：可折叠侧边栏，支持手风琴式子菜单与移动端抽屉。
- **深色/浅色模式**：内置切换按钮，偏好通过 `localStorage` 持久化，加载时无闪烁恢复。
- **shadcn/ui 设计**：语义化色彩 token、`rounded-lg` 组件、`hover:bg-muted` 交互风格。
- **现代技术栈**：Vite + TailwindCSS v4 构建，Inter 可变字体，Lucide 图标库。

## 预览

<div align="center">
  <img src="https://raw.githubusercontent.com/eamonxg/assets/master/shadcn/preview/preview.png" alt="主题预览" width="100%">
</div>

## 兼容性

- **OpenWrt**：需要 OpenWrt 23.05.0 或更高版本（依赖 ucode 模板和 LuCI JavaScript APIs）。

## 安装

OpenWrt 25.12+ 及 Snapshot 版本使用 `apk`；旧版本使用 `opkg`。

> **提示**：运行 `opkg --version` 或 `apk --version`，有输出的那个就是您设备的包管理器。

- **opkg** (OpenWrt < 25.12)：

  ```sh
  cd /tmp && uclient-fetch -O luci-theme-shadcn.ipk https://github.com/eamonxg/luci-theme-shadcn/releases/latest/download/luci-theme-shadcn_0.1.0-r20260520_all.ipk && opkg install luci-theme-shadcn.ipk
  ```

- **apk** (OpenWrt 25.12+ 及 snapshots)：

  ```sh
  cd /tmp && uclient-fetch -O luci-theme-shadcn.apk https://github.com/eamonxg/luci-theme-shadcn/releases/latest/download/luci-theme-shadcn-0.1.0-r20260520.apk && apk add --allow-untrusted luci-theme-shadcn.apk
  ```

## 许可与致谢

[Apache 2.0](LICENSE)。致谢：

- [shadcn/ui](https://github.com/shadcn-ui/ui) — 组件美学、设计 token 与交互模式
- [Lucide](https://github.com/lucide-icons/lucide) — 图标库
- [Linear](https://linear.app) — 布局与排版灵感
- [Vite](https://vite.dev/) 和 [Tailwind CSS](https://tailwindcss.com/)
- [luci-theme-bootstrap](https://github.com/openwrt/luci/tree/master/themes/luci-theme-bootstrap) — 模板结构与 LuCI 集成参考
- [Claude Code](https://claude.ai/code)
