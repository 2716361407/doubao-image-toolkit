---
name: "doubao-web-preview"
description: "豆包 AI 生图（预览模式）— 快速生成 ~100KB 预览图。通过 Playwright 控制浏览器在豆包 Web 端自动生图。"
---

# 豆包 AI 生图（预览模式）

与 /doubao-web 相同，但默认使用 `--quality=preview` 快速出图。

## 使用方式

```bash
npx --prefix <TOOLKIT>/doubao-gen ts-node --project <TOOLKIT>/doubao-gen/tsconfig.json <TOOLKIT>/doubao-gen/scripts/main.ts "提示词" --quality=preview
```

## 参数

| 参数 | 说明 | 默认 |
|------|------|------|
| `prompt` | 图片描述 | 必填 |
| `--ratio=1:1` | 比例 | - |
| `--output=<path>` | 保存路径 | generated.png |
| `--ui` | 显示浏览器窗口 | 无头 |

## 比例选项

1:1 头像 | 2:3 自拍 | 3:4 经典 | 4:3 配图 | 9:16 手机壁纸 | 16:9 桌面壁纸

## 说明

预览模式约 13s 出图，文件 ~100KB。如需高清原图请用 /doubao-web。
