# LAN Speed 三页重做审计

本记录对应 `1.1.2-r1` 重做前的审计，不把当前实现当作可接受基线。范围是同一主题内的实时状态、运行诊断和 LAN Speed 配置三页，以及诊断/配置页使用的 RPC、UCI 和 `sysdevices` 契约。

## 运行诊断

| 方面 | 已确认问题 | 重做要求 |
| --- | --- | --- |
| 信息架构 | 外层 section 内再放 status card、evidence panel、检查 row，根因和受影响指标重复出现 | 顶层 section 与实时状态使用相同标题/节奏；内部只用无框 rows、table、details，按“总览→数据路径→健康/RPC→告警/报告”组织 |
| 数据契约 | `collection.state=stale` 会被前端判非法；只验证诊断契约，其他 RPC 的 null/错误形状可被当成成功；诊断成功会掩盖其他 endpoint 硬失败 | 所有 endpoint 独立严格校验；保留版本、服务、采集代次、年龄、configured/effective 路径、错误 code/category/stage/retriable；不跨 endpoint 洗绿 |
| 状态流程 | 首屏必须等六个 RPC 才渲染，真实 loading 不可见；无超时、取消、并发保护；旧值无年龄上限 | `loading/success/empty/stale/degraded/error/invalid` 资源状态，request id 和超时，有限 retained，部分失败与全失败可区分，失败后可重试并恢复 |
| 诊断内容 | 告警重复、公共消息泛化、接口零流量和未采样混淆，报告丢失结构化错误上下文 | RPC 分项错误、采集质量/新鲜度、数据路径、接口/连接健康、info/warning/critical 根因去重、版本一致性、白名单脱敏报告与预览 |
| 视觉/交互 | 三主题同一 grid 薄换皮，存在卡中卡、未定义 surface token、移动长内容与 Argon 安全色缺口 | 每主题独立布局与控件；颜色/状态/focus/hover/disabled 仅从原生变量派生；桌面/移动无溢出并支持键盘 |

## LAN Speed 配置

| 方面 | 已确认问题 | 重做要求 |
| --- | --- | --- |
| 字段覆盖 | 页面只读写 8 项，漏掉刷新/历史/上限、legacy collector、BPF/CT 开关和 exclude | 覆盖所有当前可操作字段；legacy collector、`ifname`、`interface_include`、`interface_exclude`、`observe` 只在读写契约中透明保留，不在 UI 暴露或形成第二套编辑流程 |
| 依赖与校验 | 数字使用 `parseInt` 静默修正；IPv6 网段不校验；show/hide、BPF/NSS/CT 能力没有真正禁用 | 字段级错误、严格整数/CIDR/list 校验、依赖禁用和能力 gating；无效值不能保存 |
| 接口流程 | sysdevices 异步返回会覆盖编辑；无 request token；all-off 与 daemon 语义冲突；orphan/上限/原因不可见 | `loading/ready/empty/degraded/error`；扫描代次防旧响应；off/observe/collect 语义明确；显示 orphan、限制和 eligibility reason |
| 保存/应用 | 接口和参数分两次 RPC，失败会回滚整个 UCI 包的既有暂存；无应用后验证和成功态 | 使用 LuCI 本地变更集，只触碰页面字段；保存、应用、重置有明确反馈；应用后验证 status/sysdevices，失败保留可恢复编辑 |
| 视觉/响应式 | 上下两套框体，checkbox 点击区域过小，异常态没有语义样式，Argon 截图未覆盖滚动内容 | 与实时状态同一页壳和间距语法；单层 section；控件最小触达区、移动端可用；三主题独立实现并逐张审图 |

## 验收状态机

诊断资源：`idle -> loading -> success | empty | stale | degraded | error | invalid`；配置页：`loading -> ready | empty | degraded | hard-error`，编辑保存：`clean -> dirty -> validating -> staging -> staged -> applying -> verified | apply-error`。任何旧请求不得覆盖较新的 request id；报告只允许来自白名单字段，不复制客户端身份、接口名或底层路径。
