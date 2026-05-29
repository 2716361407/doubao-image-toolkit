---
name: "doubao-image-pipeline"
description: "豆包图片一键流水线 — 生图 → 去水印 → 抠图 一条龙。输入提示词，输出透明背景 PNG。"
---

# 豆包图片一键流水线

生图 → 去水印 → 抠图，一步到位。

## 使用方式

```bash
python <TOOLKIT>/image-tools/pipeline.py "提示词" -o <output.png> [--ratio 1:1] [--quality preview]
```

## 参数

| 参数 | 说明 | 默认 |
|------|------|------|
| `prompt` | 图片描述（必填） | - |
| `-o <path>` | 输出路径 | - |
| `--ratio 1:1` | 图片比例 | - |
| `--quality original` | 高清原图 2-5MB | original |
| `--quality preview` | 快速预览 ~100KB | - |

## 流程

1. 豆包 Web 端 AI 生图
2. OpenCV 智能检测并修复水印
3. rembg (u2net) AI 抠图去背景

## 输出

透明背景 PNG，可直接用于游戏素材、图标等。
