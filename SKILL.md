---
name: "doubao-image-toolkit"
description: "豆包 AI 生图 + 去水印 + AI 超分 + 抠图 一站式工具箱。支持豆包 Web 端生成图片、OpenCV 去水印、Real-ESRGAN 超分放大、rembg 抠图去背景。"
instructions: |
  本 skill 提供 6 个独立指令：

  ## 生图
  - `/doubao-web` — 豆包 AI 生图（原图，2-5MB）
  - `/doubao-web-preview` — 豆包 AI 生图（预览，~100KB）

  ## 后处理
  - `/doubao-image-clean` — 去水印 + 超分放大
  - `/remove-bg` — AI 抠图去背景（支持多模型）

  ## 流水线
  - `/doubao-image-pipeline` — 生图→去水印→抠图（原图）
  - `/doubao-image-pipeline-preview` — 生图→去水印→抠图（预览）

  每个指令的具体用法参见 `skills/` 目录下对应的 skill 文件。

  ## 安装
  运行 `install.bat` 一键安装，或手动执行：
  ```bash
  cd doubao-gen && npm install && npx playwright install chromium && cd ..
  pip install -r requirements.txt
  ```
---

# 豆包 AI 图片工具箱

安装后可用 6 个 Skill 指令，详见 [README.md](README.md)。

运行 `install.bat` 一键安装所有依赖和 skill 文件。
