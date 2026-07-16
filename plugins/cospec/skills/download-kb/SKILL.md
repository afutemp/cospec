---
name: download-kb
description: 将预置的知识库下载到当前工作目录，并自动配置到 cospec.config.json。当前支持 `vdi`。
allowed-tools: Bash Read Glob Write
---

# Download KB

**Skill 标识**: `download-kb`

其他 skill 通过 `download-kb` 引用本 skill。

## When To Use

当用户希望把一份预置的产品知识库放到当前工作目录时使用。常见场景：

- 首次使用 `product-kb-query` 前，需要先把知识库下载到本地。
- 想用 `vdi` 知识库作为 `product-kb-query` 的查询来源。
- 需要把示例知识库复制到项目目录中再做修改。

## Inputs

调用时传入一个参数：**知识库名称**。

当前支持：

| 名称 | 说明 | 目标目录 |
| :--- | :--- | :--- |
| `vdi` | 基于 VDC 5.9.8 EN 控制台梳理的产品规划知识库 | `./vdi-kb/` |

示例调用：

```
/download-kb vdi
```

## Workflow

1. **解析参数**：读取调用时传入的知识库名称 `kb_name`。
2. **查找源路径**：根据内置映射表找到对应源目录（相对于本 skill 目录）。
   - `vdi` → `$SKILL_DIR/assets/vdi-kb/`
3. **检查源目录**：如果源目录不存在或为空，返回错误并说明当前支持的名称。
4. **确定目标路径**：目标为当前工作目录下的 `./<kb_name>-kb/`（例如 `./vdi-kb/`）。
5. **处理目录冲突**：
   - 如果目标目录已存在：询问用户是否覆盖，或让用户先删除/重命名旧目录。
   - 如果目标目录不存在：直接复制。
6. **执行复制**：使用 `Bash cp -r` 将源目录复制到目标路径。
7. **自动配置 `cospec.config.json`**：
   1. **定位插件根目录**：插件根 = 本 skill 目录往上 2 级（`skills/<name>/` → 上 2 级），即 `$CLAUDE_PLUGIN_ROOT`，也就是插件被实际加载的位置（本地开发安装时可能就是源码仓库，普通安装时是 cache 目录）。**不要写死任何绝对路径。**
   2. 读取并更新 `<plugin-root>/cospec.config.json`（插件自带，一定存在）：
      - `kb.skill` 设置为 `"product-kb-query"`（若当前为 `null` 或未设置）。
      - `kb.localPath` 设置为下载后 KB 目录的**绝对路径**（当前工作目录 + `vdi-kb/`），因为 KB 在用户项目里、config 在插件根，相对路径无法跨目录解析。
   3. 使用 `Write` 或 `Bash` 写回 `<plugin-root>/cospec.config.json`。
   4. 报告写入的 config 文件绝对路径，让用户知道改的是哪个文件。
   > 注意：此配置写在插件根，插件升级（重新 clone）时会被重置为默认值。升级后需重新运行 `/download-kb vdi` 配置。
8. **输出结果**：报告复制成功、目标路径、配置结果。

## Output Contract

输出一个简洁的状态报告，包含：

1. 下载的知识库名称。
2. 源路径与目标路径。
3. 目标目录中的顶层文件/文件夹列表（可用 `ls` 或 `tree` 风格展示）。
4. `cospec.config.json` 的配置结果，并标注实际写入的 config 文件绝对路径。

示例输出：

```markdown
✅ 已下载 `vdi` 知识库到当前目录：

源：`$SKILL_DIR/assets/vdi-kb/`
目标：`./vdi-kb/`

目录结构：
```text
vdi-kb/
├── README.md
├── 00-综述/
├── 01-用户与机会/
├── 02-规划与范围/
├── 03-功能规划/
├── 04-质量与约束/
├── 05-协作与依赖/
├── 06-验证与反馈/
└── 附录/
```

✅ 已自动配置（插件根 = 本 skill 目录往上 2 级）：
`<plugin-root>/cospec.config.json`：
```json
"kb": {
  "skill": "product-kb-query",
  "localPath": "<当前工作目录绝对路径>/vdi-kb/"
}
```
```

## Acceptance Criteria

- 只复制预置知识库，不修改源目录。
- 目标目录已存在时不擅自覆盖，先询问用户。
- 不支持的知识库名称明确告知用户当前仅支持 `vdi`。
- 复制完成后自动配置 `cospec.config.json`；找不到 config 文件时明确提示用户手动配置。

## Extension Points

本 skill 读取并更新 `cospec.config.json` 的 `kb` 字段，将其指向下载后的知识库目录。

## Resources

- 示例知识库源：`$SKILL_DIR/assets/vdi-kb/`
- 相关 skill：`product-kb-query`
