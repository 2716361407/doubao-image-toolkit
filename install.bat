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

REM 正斜杠路径
set "TOOLKIT_FWD=%TOOLKIT:\=/%"

REM ==========================================
REM 检测 AI 平台，确定 skills 安装目录
REM ==========================================
set "SKILLS_DIR="

REM 如果用户指定了 --platform，直接使用
for %%a in (%*) do (
    if "%%a"=="--reasonix"    set "SKILLS_DIR=%USERPROFILE%\.agents\skills"
    if "%%a"=="--claude"      set "SKILLS_DIR=%USERPROFILE%\.claude\skills"
    if "%%a"=="--codex"       set "SKILLS_DIR=%USERPROFILE%\.codex\commands"
)

REM 自动检测已安装的平台
if "%SKILLS_DIR%"=="" (
    if exist "%USERPROFILE%\.agents"     set "SKILLS_DIR=%USERPROFILE%\.agents\skills"
)
if "%SKILLS_DIR%"=="" (
    if exist "%USERPROFILE%\.claude"     set "SKILLS_DIR=%USERPROFILE%\.claude\skills"
)
if "%SKILLS_DIR%"=="" (
    if exist "%USERPROFILE%\.codex"      set "SKILLS_DIR=%USERPROFILE%\.codex\commands"
)

REM 都没检测到，询问用户
if "%SKILLS_DIR%"=="" (
    echo.
    echo 未检测到 AI 平台，请选择:
    echo   1. Reasonix Code   (-^> %%USERPROFILE%%\.agents\skills^)
    echo   2. Claude Code     (-^> %%USERPROFILE%%\.claude\skills^)
    echo   3. Codex / OpenAI  (-^> %%USERPROFILE%%\.codex\commands^)
    echo.
    set /p CHOICE="输入数字 (1-3): "
    if "!CHOICE!"=="1" set "SKILLS_DIR=%USERPROFILE%\.agents\skills"
    if "!CHOICE!"=="2" set "SKILLS_DIR=%USERPROFILE%\.claude\skills"
    if "!CHOICE!"=="3" set "SKILLS_DIR=%USERPROFILE%\.codex\commands"
)

if "%SKILLS_DIR%"=="" (
    echo 无效选择，退出
    exit /b 1
)

echo Skills 目录: %SKILLS_DIR%
echo.

REM ==========================================
REM 安装依赖
REM ==========================================
echo [1/3] 安装 Node.js 依赖...
cd /d "%TOOLKIT%\doubao-gen"
call npm install --silent
call npx playwright install chromium
cd /d "%TOOLKIT%"

echo [2/3] 安装 Python 依赖...
pip install -r "%TOOLKIT%\requirements.txt" -q

REM ==========================================
REM 安装 skill 文件
REM ==========================================
echo [3/3] 安装 Skill 文件...
if not exist "%SKILLS_DIR%" mkdir "%SKILLS_DIR%"

set SKILL_LIST=doubao-web#doubao-web;doubao-web-preview#doubao-web-preview;doubao-image-clean#doubao-image-clean;remove-bg#remove-bg;pipeline#doubao-image-pipeline;pipeline-preview#doubao-image-pipeline-preview

for %%p in (%SKILL_LIST%) do (
    for /f "tokens=1,2 delims=#" %%a in ("%%p") do (
        echo   安装 /%%b ...
        powershell -Command "(Get-Content '%TOOLKIT%\skills\%%a.md') -replace '<TOOLKIT>', '%TOOLKIT_FWD%' | Set-Content '%SKILLS_DIR%\%%b.md' -Encoding UTF8"
    )
)

echo.
echo ==========================================
echo   安装完成!
echo ==========================================
echo.
echo 已安装指令:
echo   /doubao-web                    豆包 AI 生图（原图）
echo   /doubao-web-preview            豆包 AI 生图（预览）
echo   /doubao-image-clean            去水印 + 超分
echo   /remove-bg                     AI 抠图（多模型）
echo   /doubao-image-pipeline         生图→去水印→抠图（原图）
echo   /doubao-image-pipeline-preview 生图→去水印→抠图（预览）
echo.
echo 提示: 首次使用 /doubao-web 需要先登录豆包:
echo   npx --prefix %TOOLKIT%/doubao-gen ts-node --project %TOOLKIT%/doubao-gen/tsconfig.json %TOOLKIT%/doubao-gen/scripts/main.ts "测试" --ui
echo.
pause
