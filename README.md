# 豆包 AI 图片工具箱

一站式图片生成与处理工具集：豆包 AI 生图 → 去水印 → AI 超分 → 抠图去背景。

## 三个核心能力

### 1. 豆包生图
Playwright 自动化控制浏览器，在豆包 Web 端生成图片。支持原图/预览两种模式。

### 2. 去水印 + 超分
OpenCV 智能检测豆包水印区域并 inpaint 修复。支持 PIL Lanczos 3× 或 Real-ESRGAN 4× AI 超分。

### 3. AI 抠图
基于 rembg (u2net) 深度学习模型，自动去除背景输出透明 PNG。

## 安装

```bash
git clone https://github.com/2716361407/doubao-image-toolkit.git
cd doubao-image-toolkit
install.bat
```

`install.bat` 自动完成：npm 依赖 → Playwright 浏览器 → Python 依赖 → 注册 6 个 Skill 指令。

## Skill 指令使用教程

安装后在 AI 助手（Claude Code、Codex 等）中直接使用 `/` 调用：

### `/doubao-web` — 豆包 AI 生图（原图）

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `prompt` | 是 | 图片描述 | `一只金色凤凰` |
| `--quality=original` | 否 | 原图模式（默认） | 2-5MB |
| `--ratio=` | 否 | 图片比例 | `1:1` `16:9` `9:16` `4:3` `3:4` `2:3` |
| `--output=` | 否 | 保存路径 | `D:/Pics/cat.png` |
| `--ui` | 否 | 显示浏览器窗口 | 首次登录必用 |

```
/doubao-web 一只赛博朋克猫
/doubao-web 金色凤凰 --ratio=16:9
/doubao-web 可爱柴犬 --output=D:/Pics/dog.png
/doubao-web 测试 --ui（首次登录）
```

---

### `/doubao-web-preview` — 豆包 AI 生图（预览）

参数同 `/doubao-web`，但默认 `--quality=preview`，出图更快（~13s），文件更小（~100KB）。

```
/doubao-web-preview 一只猫
/doubao-web-preview 金色图标 --ratio=1:1
```

---

### `/doubao-image-clean` — 去水印 + 超分

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `input` | 是 | 输入图片路径 | `D:/Pics/cat.png` |
| `output` | 是 | 输出图片路径 | `D:/Pics/cat_clean.png` |
| `--scale N` | 否 | 放大倍数（默认 3） | `--scale 4` |
| `--ai` | 否 | 使用 Real-ESRGAN 4× AI 超分 | `--ai` |

```
/doubao-image-clean cat.png cat_clean.png
/doubao-image-clean cat.png cat_4x.png --scale 4
/doubao-image-clean cat.png cat_ai.png --ai（需先 python install_realesrgan.py）
```

---

### `/remove-bg` — AI 抠图

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `input` | 是 | 图片或目录 | `cat.png` 或 `D:/Pics/` |
| `output` | 否 | 输出路径 | 默认 `<name>_bg.png` |
| `-m <model>` | 否 | AI 模型（默认 u2net） | `-m isnet-general-use` |

**可用模型：**

| 模型 | 说明 |
|------|------|
| `u2net` | 默认通用 |
| `u2netp` | 轻量快速 |
| `u2net_human_seg` | 人像专用 |
| `u2net_cloth_seg` | 服装专用 |
| `silueta` | 剪影风格 |
| `isnet-general-use` | 高精度通用 |

```
/remove-bg cat.png
/remove-bg cat.png cat_bg.png
/remove-bg D:/Pictures/icons/（批量处理整个目录）
/remove-bg photo.png photo_bg.png -m isnet-general-use
```

---

### `/doubao-image-pipeline` — 生图→去水印→抠图（原图）

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `prompt` | 是 | 图片描述 | `金色宠物蛋` |
| `-o <path>` | 是 | 输出路径 | `-o egg.png` |
| `--quality=original` | 否 | 原图模式（默认） | 2-5MB |
| `--ratio=` | 否 | 图片比例 | `--ratio 1:1` |

```
/doubao-image-pipeline 金色宠物蛋, 纯白背景 -o egg.png
/doubao-image-pipeline 火焰图标 --ratio 1:1 -o fire.png
```

---

### `/doubao-image-pipeline-preview` — 生图→去水印→抠图（预览）

参数同 `/doubao-image-pipeline`，使用预览画质快速出图。

```
/doubao-image-pipeline-preview 金色图标 -o icon.png
/doubao-image-pipeline-preview 猫咪头像 --ratio 1:1 -o cat.png
```

---

## 命令行直接使用（不使用 Skill）

也可以直接在终端执行底层脚本：

```bash
# 生图
npx --prefix doubao-gen ts-node --project doubao-gen/tsconfig.json doubao-gen/scripts/main.ts "提示词"

# 去水印
python image-tools/clean.py input.png output.png --scale 3

# 抠图
python image-tools/remove_bg.py input.png

# 流水线
python image-tools/pipeline.py "提示词" -o output.png
```

## 目录结构

```
doubao-image-toolkit/
├── SKILL.md                    # AI skill 定义
├── doubao-gen/                 # 豆包生图 (Node.js + Playwright)
│   ├── package.json
│   └── scripts/
│       ├── main.ts             # CLI 入口
│       └── doubao-webapi/
│           └── client.ts       # 核心客户端
├── image-tools/                # 图片处理 (Python)
│   ├── clean.py                # 去水印 + 超分
│   ├── remove_bg.py            # 抠图
│   └── pipeline.py             # 一键流水线
└── realesrgan/                 # AI 超分模型 (可选)
```

## License

MIT
