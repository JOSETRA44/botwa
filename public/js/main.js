// Punto de entrada del panel: conecta cada módulo con su parte del DOM.

import { initTabs } from './tabs.js';
import { initStatus } from './status.js';
import { initLogs } from './logs.js';
import { initConfig } from './config.js';
import { initKnowledge } from './knowledge.js';

initTabs();
initStatus();
initLogs();
initConfig();
initKnowledge();
