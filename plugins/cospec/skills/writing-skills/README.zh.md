# Writing Skills — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

**编写 skill 就是对流程文档做测试驱动开发（TDD）。**

先写测试场景（用子代理做压力测试），看它失败（记录基线行为），写 skill（文档），看测试通过（代理遵循），重构（堵漏洞）。

**核心原则：** 如果没有看到代理在没有 skill 时失败，就不知道 skill 是否教了对的东西。

## 什么是 Skill

**Skill 是：** 经过验证的技术、模式、工具的参考指南

**Skill 不是：** 关于你如何解决某个问题的叙述

## SKILL.md 结构

### Frontmatter（YAML）

- 两个必填字段：`name` 和 `description`
- 总计最多 1024 字符
- `name`：仅用字母、数字、连字符
- `description`：第三人称，**只描述何时使用（不描述做什么）**，以"Use when..."开头

### 文档结构

```markdown
---
name: Skill-Name
description: Use when [触发条件和症状]
---

# Skill Name

## Overview
## When to Use
## Core Pattern
## Quick Reference
## Common Mistakes
```

## Claude Search Optimization (CSO)

**description = 何时使用，不是 skill 做什么**

```yaml
# 错误：总结了工作流
description: Use when executing plans - dispatches subagent per task with code review

# 正确：只描述触发条件
description: Use when executing implementation plans with independent tasks
```

## 目录结构

```
skills/
  skill-name/
    SKILL.md              # 主参考文档（必需）
    supporting-file.*     # 仅在需要时添加
```

## 铁律（同 TDD）

```
没有先失败的测试，就不能写 Skill
```

适用于新 skill 和现有 skill 的编辑。

## RED-GREEN-REFACTOR 循环

| 阶段 | 操作 |
|------|------|
| **RED**（基线） | 用子代理运行压力场景，不加载 skill，记录行为 |
| **GREEN**（最小 skill） | 写 skill 针对那些合理化借口，重跑场景，验证代理遵循 |
| **REFACTOR**（堵漏洞） | 代理找到新借口？加显式对策。反复测试直到无懈可击 |

## 流程图使用规则

- **使用流程图：** 非显而易见的决策点、流程循环、"何时用 A vs B"
- **不使用流程图：** 参考资料、代码示例、线性指令

## 代码示例

**一个优秀示例胜过多个平庸示例。** 选择最相关的语言。

## Skill 创建检查清单

### RED 阶段
- [ ] 创建压力场景
- [ ] 不加 skill 运行 — 记录基线
- [ ] 识别失败模式

### GREEN 阶段
- [ ] 名称只用字母、数字、连字符
- [ ] YAML frontmatter 包含 name 和 description
- [ ] description 以"Use when..."开头
- [ ] 针对基线失败编写
- [ ] 加载 skill 运行 — 验证遵循

### REFACTOR 阶段
- [ ] 识别新的合理化借口
- [ ] 添加显式对策
- [ ] 构建合理化表
- [ ] 反复测试直到无懈可击

### 部署
- [ ] 提交 skill 到 git

## 底线

**创建 skill 就是对流程文档做 TDD。** 同样的铁律、同样的循环。
