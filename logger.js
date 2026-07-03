// Logger de aplicación persistente — independiente del pino "silent" que
// auth/loginQR.js y auth/loginPhone.js le pasan a Baileys (ese solo silencia
// los logs internos de la librería). Este captura a disco los errores que
// hoy solo van a console.error y se pierden cuando el proceso corre vía
// start /B sin redirección de stdout.
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const appLogger = pino(
  { level: 'info' },
  pino.destination({ dest: path.join(__dirname, 'app.log'), sync: false })
);
