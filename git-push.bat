@echo off
REM ============================================================
REM  KOPERASI 527 - One-Click Git Push
REM  Letakkan file ini di root folder project koperasi-527
REM ============================================================

echo.
echo ========================================
echo  KOPERASI 527 - Git Push to GitHub
echo ========================================
echo.

REM Cek apakah folder ini repo git
if not exist ".git" (
    echo [ERROR] Folder ini bukan git repository.
    echo Jalankan script ini di dalam folder project koperasi-527.
    pause
    exit /b 1
)

REM Tampilkan status
echo [STATUS] File yang berubah:
echo ----------------------------------------
git status --short
echo ----------------------------------------
echo.

REM Cek apakah ada perubahan
git diff --quiet HEAD 2>nul
if %errorlevel% equ 0 (
    git diff --cached --quiet 2>nul
    if !errorlevel! equ 0 (
        echo [INFO] Tidak ada perubahan untuk di-commit.
        pause
        exit /b 0
    )
)

REM Tanya commit message
echo.
set /p COMMIT_MSG="Commit message (Enter untuk default 'Update'): "
if "%COMMIT_MSG%"=="" set COMMIT_MSG=Update

REM Add, commit, push
echo.
echo [1/3] git add .
git add .

echo.
echo [2/3] git commit -m "%COMMIT_MSG%"
git commit -m "%COMMIT_MSG%"

echo.
echo [3/3] git push
git push

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Push gagal. Mungkin perlu pull dulu:
    echo   git pull --rebase
    echo Lalu push ulang:
    echo   git push
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Push SELESAI!
echo  Netlify akan auto-deploy dalam ~15 detik.
echo  Cek: https://koperasi-527.netlify.app
echo ========================================
echo.

REM Buka Netlify deploys page
echo Buka halaman deploy Netlify? (y/n)
set /p OPEN_NETLIFY=
if /i "%OPEN_NETLIFY%"=="y" (
    start https://app.netlify.com/sites/koperasi-527/deploys
)

pause
