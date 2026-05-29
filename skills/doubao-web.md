---
name: "doubao-web"
description: "豆包 AI 生图 — 通过 Playwright 控制浏览器在豆包 Web 端自动生成图片。支持原图/预览、比例控制。"
---

# 豆包 AI 生图

通过 Playwright 自动化控制浏览器，在豆包 (doubao.com) Web 端生成图片。

## 使用方式

```bash
# 基础生图
npx --prefix <TOOLKIT>/doubao-gen ts-node --project <TOOLKIT>/doubao-gen/tsconfig.json <TOOLKIT>/doubao-gen/scripts/main.ts "提示词"

# 指定比例和画质
... "提示词" --ratio=1:1 --quality=original --output=D:/Pictures/my.png
```

## 参数

| 参数 | 说明 | 默认 |
|------|------|------|
| `prompt` | 图片描述 | 必填 |
| `--quality=original` | 高清原图 2-5MB | original |
| `--quality=preview` | 快速预览 ~100KB | - |
| `--ratio=1:1` | 比例 | - |
| `--output=<path>` | 保存路径 | generated.png |
| `--ui` | 显示浏览器窗口 | 无头 |

## 比例选项

1:1 头像 | 2:3 自拍 | 3:4 经典 | 4:3 配图 | 9:16 手机壁纸 | 16:9 桌面壁纸

## 首次使用

需要先用 `--ui` 登录一次豆包，后续登录态自动保存：
```bash
... "测试" --ui
```

## 输出
生图完成后显示图片保存路径和文件大小。
