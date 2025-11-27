@echo off
echo ========================================
echo  Instalando WhatsApp Bot
echo ========================================
echo.

echo [1/3] Verificando Node.js...
node --version
if %errorlevel% neq 0 (
    echo ERROR: Node.js no esta instalado
    echo Descargalo desde: https://nodejs.org/
    pause
    exit /b 1
)
echo.

echo [2/3] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Fallo la instalacion de dependencias
    pause
    exit /b 1
)
echo.

echo [3/3] Instalacion completada!
echo.
echo ========================================
echo  Proximos pasos:
echo ========================================
echo.
echo 1. Inicia el panel web:
echo    node server.js
echo.
echo 2. Abre http://localhost:3000 y configura
echo.
echo 3. En otra terminal, inicia el bot:
echo    node bot.js
echo.
echo 4. Escanea el codigo QR con WhatsApp
echo.
echo ========================================
pause
