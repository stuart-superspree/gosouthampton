@echo off
setlocal
REM Publish this folder to GitHub. Double-click to run.
REM First time: make an EMPTY repository at https://github.com/new
REM (no README, no .gitignore, no licence) and copy its URL.
REM After that: double-click again whenever something changes.
REM Railway redeploys by itself each time new code reaches GitHub.

cd /d "%~dp0"
echo.
echo   Southampton RouteLoop: publish to GitHub
echo.

where git >nul 2>nul
if errorlevel 1 goto nogit

if exist ".git" goto haverepo
git init -b main
if errorlevel 1 goto fail
:haverepo

git config user.email >nul 2>nul
if not errorlevel 1 goto haveuser
set /p GITNAME="  Your name for the commit history: "
set /p GITEMAIL="  Your email (the one on your GitHub account): "
git config user.name "%GITNAME%"
git config user.email "%GITEMAIL%"
:haveuser

git add -A
if errorlevel 1 goto fail
git diff --cached --quiet
if not errorlevel 1 goto nothingnew
git commit -m "Southampton RouteLoop city centre demo"
if errorlevel 1 goto fail
:nothingnew

git remote get-url origin >nul 2>nul
if not errorlevel 1 goto haveremote
echo.
set /p REPOURL="  Paste your GitHub repository URL, then press Enter: "
if "%REPOURL%"=="" goto fail
git remote add origin "%REPOURL%"
if errorlevel 1 goto fail
:haveremote

echo.
echo   Sending to:
git remote get-url origin
git branch -M main
git push -u origin main
if errorlevel 1 goto fail

echo.
echo   Done. The code is on GitHub.
echo   If Railway is connected to this repository, it redeploys in a minute or two.
echo.
pause
exit /b 0

:nogit
echo   Git is not installed on this computer.
echo   Install it from https://git-scm.com/download/win and run this again,
echo   or use GitHub Desktop instead (see DEPLOY.md).
echo.
pause
exit /b 1

:fail
echo.
echo   That did not work. Read the message above, or follow DEPLOY.md step by step.
echo   If GitHub rejected the push, the repository on GitHub is probably not empty:
echo   make a new one with nothing ticked, then run this again.
echo.
pause
exit /b 1
