---
name: "doubao-image-pipeline-preview"
description: "豆包图片一键流水线（预览模式）— 生图 → 去水印 → 抠图，使用预览画质快速出图。"
---

# 豆包图片一键流水线（预览模式）

与 /doubao-image-pipeline 相同，但使用 `--quality preview` 快速出图。

## 使用方式

```bash
python <TOOLKIT>/image-tools/pipeline.py "提示词" -o <output.png> --quality preview [--ratio 1:1]
```

## 参数

| 参数 | 说明 | 默认 |
|------|------|------|
| `prompt` | 图片描述（必填） | - |
| `-o <path>` | 输出路径 | - |
| `--ratio 1:1` | 图片比例 | - |

## 流程

1. 豆包 Web 端 AI 生图（预览模式，~100KB）
2. OpenCV 智能检测并修复水印
3. rembg (u2net) AI 抠图去背景

## 说明

预览模式约 13s 出图。如需高清原图请用 /doubao-image-pipeline。
