---
name: "remove-bg"
description: "AI 抠图去背景 — 基于 rembg (u2net) 深度学习模型。支持单张或批量，输出透明 PNG。"
---

# AI 抠图去背景

基于 rembg (u2net) 自动去除图片背景，输出透明 PNG。

## 使用方式

```bash
# 单张图片
python <TOOLKIT>/image-tools/remove_bg.py <input> [output]

# 批量处理整个目录
python <TOOLKIT>/image-tools/remove_bg.py <directory>

# 指定模型
python <TOOLKIT>/image-tools/remove_bg.py <input> <output> -m <model>
```

## 模型选项

| 模型 | 说明 |
|------|------|
| `u2net` | 默认通用模型 |
| `u2netp` | 轻量快速 |
| `u2net_human_seg` | 人像专用 |
| `u2net_cloth_seg` | 服装专用 |
| `silueta` | 剪影风格 |
| `isnet-general-use` | 高精度通用 |

## 输出

- 单文件: `<name>_bg.png`（同目录）或指定输出路径
- 目录: `bg_removed/` 子文件夹
