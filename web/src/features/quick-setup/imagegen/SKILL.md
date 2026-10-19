---
name: wukongai-imagegen
description: Generate or edit images through the user's configured WukongAi API from Codex on Windows. Use when the user selects WukongAi API image generation, including a WukongAi-provider session without a built-in image tool.
---

# 悟空Ai API 生图

此技能通过客户已配置的悟空Ai API 调用 `gpt-image-2`。聊天模型和图片模型是独立能力。未指定悟空Ai、且有内置图片工具时，按系统 imagegen 技能处理。

首次使用或遇到鉴权问题，运行本技能 `scripts/run.ps1 -Check`。该检查不生成图片。权限不足时说明具体错误；不要把密钥发到聊天里，不要改成 OpenAI 官方地址或其他模型。

生成图片：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<本技能目录>/scripts/run.ps1" -Prompt "用户的绘画需求" -Out "<当前工作目录>/output/imagegen/result.png"
```

编辑已有图片：增加 `-Image "<原图的绝对路径>"`，并在提示中明确保留内容与修改范围。需要较长提示时先写 UTF-8 提示文件，用 `-PromptFile` 代替 `-Prompt`。

脚本调用未修改的 OpenAI imagegen 备用 CLI；密钥在本机通过 DPAPI 解密后仅传入子进程环境，不会写进命令行。不要直接运行或输出 `read-key.ps1` 的结果。

用户请求生成图片即授权该次 API 生图；不要求重复确认同一操作。每次只生成完成请求所需的数量。遇到权限、余额、模型不存在等错误时停止，说明实际 API 错误，不循环重试或静默换模型。透明背景不能在此模型下承诺，需另行说明可用方案。

完成后检查输出文件并在聊天中用绝对路径展示图片，说明使用悟空Ai API。更换服务或密钥时重新运行悟空Ai生图配置 BAT。
