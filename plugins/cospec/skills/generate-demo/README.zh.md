# generate-demo

`generate-demo` 将用户确认的 cospec Markdown 产物提交到 Frieren Demo handoff 接口。

插件已内置默认 Frieren 地址和共享 HMAC，安装后无需手动配置即可执行 dry-run 和后续 Demo 生成。

开发调试或私有部署时，可通过以下环境变量覆盖内置值：

```bash
export FRIEREN_DEMO_BASE_URL="https://private-demo.example.com/"
export FRIEREN_DEMO_HMAC_SECRET="<private-shared-secret>"
```

Skill 会先列出候选文档并要求选择，再执行不联网的 dry-run；只有用户确认 dry-run 中的目标主机、文件和大小后才会发送。内置默认地址使用 HTTP，发送前必须明确提示文档内容不会受到 TLS 保护。共享凭据只用于接口签名，不代表用户身份或独立授权。

独立调用示例：

```text
使用 generate-demo，把《某项目_大需求用户需求规格说明书_评审版.md》生成 Demo。
```

大需求工作流在 TR1 文档完成后、TR2 开始前询问是否进入该可选步骤；小需求工作流仍在全部规划步骤完成后询问。拒绝或 Demo 生成失败不会影响已经完成的规划产物，也不会阻止大需求继续生成 TR2。
