---
name: "doubao-image-clean"
description: "豆包生图后处理 — 去水印 + AI 超分放大。OpenCV 智能检测并修复水印区域，支持 Lanczos 3× 或 Real-ESRGAN 4× 放大。"
---

# 去水印 + 超分放大

豆包生图后处理工具：去除水印，可选 AI 超分放大。

## 使用方式

```bash
# 去水印 + 3× 放大
python <TOOLKIT>/image-tools/clean.py <input> <output> --scale 3

# 去水印 + AI 4× 超分（需先安装 Real-ESRGAN）
python <TOOLKIT>/image-tools/clean.py <input> <output> --ai
```

## 参数

| 参数 | 说明 |
|------|------|
| `input` | 输入图片路径 |
| `output` | 输出图片路径 |
| `--scale N` | 放大倍数（默认 3） |
| `--ai` | 使用 Real-ESRGAN 4× AI 超分 |

## 原理

1. **去水印**: 自适应阈值 + 连通组件检测水印文字区域 → OpenCV inpaint 修复
2. **超分**: PIL Lanczos（默认）或 Real-ESRGAN NCNN Vulkan（--ai）
