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
| `list` | 列出所有知识库名称 | 否 |
| `download` | 下载单个知识库归档并解压到本地目录 | 否 |
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
- **不要默认使用任何固定知识库名称**。如果用户没有指定知识库名称，先调用 `list` 获取所有可用知识库。
- **向用户展示列表时只显示 `NAME`**，ID、状态、版本等信息对用户选择没有意义，不要展示。
- 等待用户选择（或用户提供名称/ID）后，执行 `download`。

**1. 列出所有知识库：**

```bash
./skills/product-kb-server/scripts/product-kb-server.cjs list
# 向用户展示时只输出 NAME 列
```

**2. 下载用户指定的单个知识库：**

```bash
./skills/product-kb-server/scripts/product-kb-server.cjs download \
  --kb <kb-name-or-id> --output ./docs
# 解压后目录结构：./docs/<kb-name>/raw/*.md
```

### 示例

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
./skills/product-kb-server/scripts/product-kb-server.cjs download --kb <kb-name-or-id> --output ./docs
```

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `KB_SERVER_URL` | kb-server 地址 | `http://10.6.100.230` |
| `KB_AUTH_TOKEN` | API KEY 或登录 Token | (空) |
