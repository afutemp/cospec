---
name: product-kb-server
description: 管理 kb-server 知识库：列出、下载文档、上传附件。使用此 skill 当用户提到知识库、kb-server、下载文档、上传文件到知识库、同步知识库内容、拉取产品文档、获取知识库列表、manage knowledge base、download kb、upload documents 等操作时。即使用户没有明确说"知识库管理"，只要涉及从 kb-server 获取或更新文档内容，都应该触发此 skill。
---

## product-kb-server

通过 kb-server REST API 管理知识库：查看列表、下载文档到本地、上传文件。

### 基本用法

所有命令通过同一个脚本执行，支持环境变量或命令行参数配置服务器地址和认证：

```bash
./skills/product-kb-server/scripts/product-kb-server.cjs <command> [options]
```

**为什么用脚本而不是直接 curl？** 脚本封装了 KB 名称解析（支持名称或 ID）、错误处理、格式转换，避免每次手动拼接 API 路径和处理 tar.gz 解压。

### 命令

| 命令 | 用途 | 需要认证 |
|------|------|:------:|
| `list` | 列出所有知识库名称和描述 | 否 |
| `check-update` | 检查本地知识库是否有新版本 | 否 |
| `download` | 下载单个知识库归档并解压到本地目录（会自动跳过已是最新的版本） | 否 |
| `upload` | 上传文件作为知识库附件 | 是 (admin) |

### 认证

两种方式均可，推荐使用 API KEY（永久有效，不需要每次登录）：

**方式一：API KEY（推荐）** — 在 kb-server 控制台 "个人设置" 页面复制 API KEY：

```bash
export KB_AUTH_TOKEN=kb_key_xxxxxxxxxxxxxxxx
```

**方式二：登录获取 Token**（24h 过期）：

```bash
TOKEN=$(curl -s -X POST $KB_SERVER_URL/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
```

### 下载知识库流程

- **一次只下载一个知识库**，不要引导用户同时下载多个。
- **不要默认使用任何固定知识库名称**。如果用户没有指定知识库名称，先调用 `list` 获取所有可用知识库及其 description。
- `list` 输出格式为 `NAME\tDESCRIPTION`（制表符分隔），便于 Agent 解析。

**1. 列出所有知识库：**

```bash
./skills/product-kb-server/scripts/product-kb-server.cjs list
```

**2. 根据上下文匹配并确认：**

解析 `list` 结果，获取每个知识库的 `NAME` 和 `DESCRIPTION`。

- **如果用户前文已经明确提到某个知识库名称**：直接使用该名称，无需再 list/确认。
- **如果没有明确名称，尝试匹配：**
  - 将用户当前问题、前文对话中的关键词（产品名、模块、功能、场景等）与各知识库的 `DESCRIPTION` 进行语义匹配。
  - 如果匹配到一个明显最相关的知识库，**向用户确认**，不要直接下载：
    > "根据你的需求，最匹配的知识库是 `vdi`（<一句话描述>），是否正确？"
  - 用户确认后，再执行 `download`。
- **如果匹配不到或不确定：**
  - 列出所有知识库的 `NAME`，询问用户：
    > "找到以下知识库，请选择要下载哪一个：`vdi` / `xxx` / `yyy`"

**3. 下载用户指定的单个知识库：**

```bash
./skills/product-kb-server/scripts/product-kb-server.cjs download \
  --kb <kb-name-or-id>
# 默认解压到 ~/.cospec/kb/<kb-name>/
```

下载前会自动检查本地版本：

- 在下载目录下维护一个 `.kb-version` 文件，记录服务器返回的 `current_version_id`。
- 如果本地版本与服务器 `current_version_id` 一致，跳过下载，提示"已是最新"。
- 如果本地没有该知识库，或版本不一致，则删除旧目录并重新下载，然后写入新的 `.kb-version`。

如果需要自定义本地目录，仍可使用 `--output`：

```bash
./skills/product-kb-server/scripts/product-kb-server.cjs download \
  --kb <kb-name-or-id> --output ./docs
```

`download` 命令完成后会**自动配置**插件根目录的 `cospec.config.json`：

- 设置 `kb.skill` 为 `product-kb-query`（仅在未设置时）
- 设置 `kb.localPath` 为下载目录的绝对路径（默认 `~/.cospec/kb/<kb-name>/`）

用户无需手动修改配置即可使用 `product-kb-query`。

### 示例

**检查是否有更新：**

```bash
./skills/product-kb-server/scripts/product-kb-server.cjs check-update --kb <kb-name-or-id>
# 输出示例：
# [check-update] vdi: up to date (ver_f5a0672adb)
# [check-update] vdi: update available (ver_xxx -> ver_yyy)
```

**上传 Markdown 文档：**

```bash
./skills/product-kb-server/scripts/product-kb-server.cjs upload \
  --kb <kb-name-or-id> --files "./docs/*.md" --token "$KB_AUTH_TOKEN"
```

**连接指定服务器：**

```bash
# 方式一：命令行参数
./skills/product-kb-server/scripts/product-kb-server.cjs list --server http://10.6.100.230

# 方式二：环境变量
export KB_SERVER_URL=http://10.6.100.230
export KB_AUTH_TOKEN=kb_key_xxxxxxxxxxxxxxxx
./skills/product-kb-server/scripts/product-kb-server.cjs download --kb <kb-name-or-id>
./skills/product-kb-server/scripts/product-kb-server.cjs download --kb <kb-name-or-id> --output ./docs
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `KB_SERVER_URL` | kb-server 地址 | `http://10.6.100.230` |
| `KB_AUTH_TOKEN` | API KEY 或登录 Token | (空) |
