@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

cd /d "%~dp0"
title DATN - He Thong Quan Ly Nhan Su va Cham Cong FaceID - NTU

echo ============================================================================
echo   KHOI DONG FULL HE THONG CHAM CONG FACE ID - DAI HOC NGUYEN TRAI - NTU
echo ============================================================================
echo.

:: 1. Kiem tra Node.js & node_modules
where node >nul 2>&1
if errorlevel 1 (
    echo [LOI] Khong tim thay Node.js. Vui long cai dat Node.js truoc khi chay!
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [1/4] Dang cai dat thu vien Node.js bang npm install...
    call npm install
    if errorlevel 1 (
        echo [LOI] npm install that bai!
        pause
        exit /b 1
    )
) else (
    echo [1/4] Thu vien Node.js da san sang.
)

:: 2. Khoi dong Docker Desktop & ha tang MinIO / Redis (+ SQL Server neu local chua chay)
echo [2/4] Dang kiem tra ha tang MinIO, Redis va SQL Server...
call :ensure_docker_infra

:: Tu dong gan REDIS_URL neu Redis dang chay tai 127.0.0.1:6379
powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', 6379); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    if "%REDIS_URL%"=="" set "REDIS_URL=redis://127.0.0.1:6379"
)

:: 3. Xac dinh moi truong Python cho Face AI Service
echo [3/4] Dang kiem tra Python Face AI Service...
set "FACE_CMD="
if exist ".venv\Scripts\python.exe" (
    set "FACE_CMD=.venv\Scripts\python.exe -m uvicorn app:app --app-dir face-service --reload-dir face-service --host 127.0.0.1 --port 8001 --reload --log-level warning"
) else if exist "face-service\.venv\Scripts\python.exe" (
    set "FACE_CMD=face-service\.venv\Scripts\python.exe -m uvicorn app:app --app-dir face-service --reload-dir face-service --host 127.0.0.1 --port 8001 --reload --log-level warning"
) else (
    py -3.12 --version >nul 2>&1
    if not errorlevel 1 (
        set "FACE_CMD=py -3.12 -m uvicorn app:app --app-dir face-service --reload-dir face-service --host 127.0.0.1 --port 8001 --reload --log-level warning"
    ) else (
        set "FACE_CMD=python -m uvicorn app:app --app-dir face-service --reload-dir face-service --host 127.0.0.1 --port 8001 --reload --log-level warning"
    )
)
set "NO_ALBUMENTATIONS_UPDATE=1"

echo.
echo [4/4] Dang khoi dong Backend + Frontend + Face AI Service...
echo ----------------------------------------------------------------------------
echo   * Giao dien Web (Frontend) : http://localhost:5173
echo   * Backend Express API      : http://localhost:5000
echo   * Tai lieu Swagger API     : http://localhost:5000/tai-lieu-api
echo   * Face AI Service (FastAPI): http://127.0.0.1:8001/docs
echo   * MinIO Console (neu bat)  : http://localhost:9003 (minioadmin / minioadmin)
echo   Nhan Ctrl+C hoac dong cua so nay de tat dong thoi tat ca dich vu.
echo ----------------------------------------------------------------------------
echo.

:: Tu dong mo trinh duyet sau 6 giay
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 6; Start-Process 'http://localhost:5173'"

if exist "node_modules\.bin\concurrently.cmd" (
    call "node_modules\.bin\concurrently.cmd" -k -n "SERVER,CLIENT,FACE" -c "cyan.bold,magenta.bold,yellow.bold" "npm run dev:server" "npm run dev:client" "!FACE_CMD!"
) else (
    call npx concurrently -k -n "SERVER,CLIENT,FACE" -c "cyan.bold,magenta.bold,yellow.bold" "npm run dev:server" "npm run dev:client" "!FACE_CMD!"
)

echo.
echo He thong da dung.
pause
exit /b 0

:: ----------------------------------------------------------------------------
:: Ham phu: Tu dong bat Docker Desktop va cac container ha tang neu kha dung
:: ----------------------------------------------------------------------------
:ensure_docker_infra
where docker >nul 2>&1
if errorlevel 1 (
    echo [CANH BAO] Khong tim thay Docker CLI. Bo qua buoc bat container.
    exit /b 0
)

docker info >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
        echo       - Dang mo Docker Desktop, vui long doi...
        start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
        for /L %%i in (1,1,20) do (
            docker info >nul 2>&1
            if not errorlevel 1 goto :docker_ready
            ping -n 4 127.0.0.1 >nul
        )
    )
)

:docker_ready
docker info >nul 2>&1
if errorlevel 1 (
    echo [CANH BAO] Docker chua san sang. He thong se dung SQL Server local + Local Storage Fallback.
    exit /b 0
)

echo       - Dang bat container MinIO va Redis...
docker compose up -d minio redis >nul 2>&1

powershell -NoProfile -Command "try { $c = New-Object Net.Sockets.TcpClient('127.0.0.1', 1433); $c.Close(); exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    echo       - Cong 1433 chua co SQL Server local, dang bat container SQL Server...
    docker compose up -d sqlserver >nul 2>&1
) else (
    echo       - SQL Server local da san sang tai cong 1433.
)
exit /b 0
