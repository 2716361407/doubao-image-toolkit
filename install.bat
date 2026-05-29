@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   Doubao Image Toolkit - 安装
echo ==========================================
echo.

REM 获取当前目录（toolkit 根目录）
set "TOOLKIT=%~dp0"
set "TOOLKIT=%TOOLKIT:~0,-1%"
echo Toolkit: %TOOLKIT%
echo.

REM 将 Windows 路径转成正斜杠
set "TOOLKIT_FWD=%TOOLKIT:\=/%"

REM 目标 skills 目录
if not defined SKILLS_DIR set "SKILLS_DIR=%USERPROFILE%\.agents\skills"

echo Skills 目录: %SKILLS_DIR%
echo.

REM 安装 Node.js 依赖
echo [1/4] 安装 Node.js 依赖...
cd /d "%TOOLKIT%\doubao-gen"
call npm install --silent
call npx playwright install chromium
cd /d "%TOOLKIT%"

REM 安装 Python 依赖
echo [2/4] 安装 Python 依赖...
pip install -r "%TOOLKIT%\requirements.txt" -q

REM 复制 skill 文件
echo [3/4] 安装 Skill 文件...
if not exist "%SKILLS_DIR%" mkdir "%SKILLS_DIR%"

REM 格式: "源文件名" "目标文件名"
set SKILL_LIST=doubao-web#doubao-web;doubao-web-preview#doubao-web-preview;doubao-image-clean#doubao-image-clean;remove-bg#remove-bg;pipeline#doubao-image-pipeline;pipeline-preview#doubao-image-pipeline-preview

for %%p in (%SKILL_LIST%) do (
    for /f "tokens=1,2 delims=#" %%a in ("%%p") do (
        echo   安装 %%b ...
        powershell -Command "(Get-Content '%TOOLKIT%\skills\%%a.md') -replace '<TOOLKIT>', '%TOOLKIT_FWD%' | Set-Content '%SKILLS_DIR%\%%b.md' -Encoding UTF8"
    )
)

echo.
echo [4/4] 完成!
echo.
echo 已安装以下 Skill 指令:
echo   /doubao-web                    豆包 AI 生图（原图）
echo   /doubao-web-preview            豆包 AI 生图（预览）
echo   /doubao-image-clean            去水印 + 超分
echo   /remove-bg                     AI 抠图（多模型）
echo   /doubao-image-pipeline         生图→去水印→抠图（原图）
echo   /doubao-image-pipeline-preview 生图→去水印→抠图（预览）
echo.
echo 提示: 首次使用 /doubao-web 需要先登录豆包，请运行:
echo   npx --prefix %TOOLKIT%/doubao-gen ts-node --project %TOOLKIT%/doubao-gen/tsconfig.json %TOOLKIT%/doubao-gen/scripts/main.ts "测试" --ui
echo.
pause
