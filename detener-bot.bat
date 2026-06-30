@echo off
echo ========================================
echo   DETENER BOT
echo ========================================
echo.
echo Deteniendo todos los procesos de Node.js...
echo.

REM Detener todos los procesos de node
taskkill /F /IM node.exe 2>nul

if %errorlevel% equ 0 (
    echo [OK] Bot detenido correctamente
) else (
    echo [INFO] No se encontraron procesos de Node.js corriendo
)

echo.
pause
