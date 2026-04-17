// @ts-ignore Node built-ins are available at runtime; this repo does not include explicit Node typings.
import { EventEmitter } from 'events';
import { defineConfig } from 'astro/config';
import komorebi from 'komorebi-theme';

// Astro/Vite attaches many FS watchers in dev on Windows once the migrated content set grows.
// Raising the shared listener cap avoids noisy MaxListeners warnings without affecting behavior.
EventEmitter.defaultMaxListeners = 32;

export default defineConfig({
  site: 'https://xrefme.cn',
  integrations: [komorebi()],
});
