---
name: cospec-preflight
description: "Use only before starting a cospec workflow to verify that external dependencies (product knowledge base, IPD, Demo endpoint) are reachable. Probes each service's root URL via HTTP GET and reports status. Do not use for any other purpose; never upload, create, or sync artifacts."
---

# cospec Preflight —— 依赖连通性体检

**Skill 标识**: `cospec-preflight`

其他 skill 通过 `cospec-preflight` 引用本 skill。

## 职责

执行 cospec 工作流之前，探测三个外部依赖是否连通，避免用户做到一半（如 `sync-to-ipd`、`generate-demo`）才发现服务不可达。

| 依赖 | 探测地址 | 地址来源 |
|---|---|---|
| 知识库 | `GET ${KB_SERVER_URL}/`（默认 `http://product-kb.sangfor.com/`） | env `KB_SERVER_URL`，同 `product-kb-server` |
| IPD | `GET http://ipd.sangfor.com/` | 硬编码，同 `ipd_api.js` |
| Demo | `GET ${FRIEREN_DEMO_BASE_URL}/`（默认 `http://ui.sangfor.com.cn/`） | env `FRIEREN_DEMO_BASE_URL`，同 `generate-demo` |

**判定**：拿到任何 HTTP 响应（任意状态码，含 404/302/500）即"连通"；超时 / 域名解析失败 / 连接被拒绝即"不通"，并给出分类原因。

**只读**：只发 GET 根路径请求，不上传、不创建、不同步任何产物；不读取或打印任何凭证（token / HMAC 密钥）。

## 何时被调用

主要由 `brainstorming` 在路由确认后、调用 workflow 之前自动调用；用户也可直接 `/cospec-preflight` 手动体检。

## 执行

Resolve the directory containing this `SKILL.md` as `<skill-dir>`. Do not hardcode an installation path. In Claude Code, the script is available at `${CLAUDE_PLUGIN_ROOT}/skills/cospec-preflight/scripts/cospec-preflight.mjs`.

```bash
node <skill-dir>/scripts/cospec-preflight.mjs --target all
# 或单目标：--target kb | ipd | demo
```

脚本输出 JSON 报告：`{ ok, summary, results: [{ name, label, ok, status?, code?, error?, impact? }] }`。三个目标**并行**探测，每个 5 秒超时，总耗时 ≈ 最慢一项。无论是否有不通项，脚本始终 `exit 0`。

## 报告与处置

逐项向用户转述结果：

- ✅ **连通**：标注服务名 + 状态码。
- ❌ **不通**：标注服务名 + 原因（连接超时 / 域名解析失败 / 连接被拒绝 / 连接被重置）+ **影响**（如"IPD 不通 → sync-to-ipd 同步 TR1/TR2 产物将不可用"）。

**警告，不阻塞，但必须停下等用户确认**：报告本身就是警告——preflight 不强制阻止工作流（不因某项不通而中止），但**报告后必须立即停下，询问用户"是否继续进入工作流？"，等用户明确回复"继续"后才进入 workflow**。禁止报告后自动往下走（不读配置、不进 step1）。即使三项全通也要停下等确认；有不通项时，提示用户可选择先修网络或继续。

## 红线

- preflight 不强制阻塞（不因某项不通而中止工作流），但**报告后必须停下让用户确认是否继续**——禁止报告后自动往下走（不读配置、不进 step1、不调 workflow）。
- 禁止读取、打印或外泄任何凭证（IPD token、Demo HMAC 密钥）。
- 禁止除 `GET /` 之外的任何写操作（不 POST Demo handoff、不上传 KB、不 sync IPD）。
- 禁止用目录扫描或本地文件存在性替代网络连通探测。
