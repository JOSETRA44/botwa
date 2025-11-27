@echo off
echo ========================================
echo  Iniciando WhatsApp Bot Completo
echo ========================================
echo.
echo Abriendo panel web y bot...
echo.

start "Panel Web - http://localhost:3000" cmd /k "echo Panel Web iniciado en http://localhost:3000 && echo. && node server.js"

timeout /t 2 /nobreak >nul

start "WhatsApp Bot" cmd /k "echo WhatsApp Bot iniciado && echo Escanea el codigo QR si es la primera vez && echo. && node bot.js"

echo.
echo ========================================
echo  Servicios iniciados:
echo ========================================
echo.
echo [1] Panel Web: http://localhost:3000
echo [2] WhatsApp Bot: Revisa la otra ventana
echo.
echo Para detener: Cierra las ventanas o presiona Ctrl+C
echo.
pause
