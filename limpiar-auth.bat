@echo off
title Limpiar Sesion
echo Limpiando sesion de WhatsApp...
echo.
echo IMPORTANTE: Esto solo borra la sesion, NO los archivos de codigo.
echo.

REM Borrar solo archivos de sesión, NO loginQR.js ni loginPhone.js
cd auth
for %%f in (*) do (
    if not "%%f"=="loginQR.js" if not "%%f"=="loginPhone.js" del "%%f" 2>nul
)
cd ..

echo.
echo Sesion limpiada. Los archivos de codigo se mantienen.
pause
