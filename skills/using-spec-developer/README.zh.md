# Using Spec-Developer — 中文参考说明

> 本文件仅供人阅读，不加入 AI 上下文。AI 使用的是同目录下的 `SKILL.md`（英文）。

## 概述

每次会话启动时加载的基础 skill，规定了如何发现和使用其他 skill。核心要求：**在任何响应（包括澄清问题）之前，必须先调用 Skill 工具检查是否有适用的 skill。**

子代理（subagent）模式下可跳过本 skill。

## 指令优先级

| 优先级 | 来源 |
|--------|------|
| 最高 | 用户显式指令（CLAUDE.md / 直接请求） |
| 中等 | cospec skills |
| 最低 | 默认系统提示 |

## Skill 使用规则

1. 任何响应或动作之前，先调用 Skill 工具检查
2. 使用 skill 时先声明：`Using [skill] to [purpose]`
3. 有 checklist 的 skill，逐项创建 TodoWrite 跟踪
4. 严格按 skill 内容执行，不要自行裁剪

## Skill 优先级

1. **流程型 skill 优先**（brainstorming）—— 决定如何做
2. **领域 skill 其次**（product-planning-requirement-clarification, user-journey-design, tr1-requirements-spec）—— 指导执行
