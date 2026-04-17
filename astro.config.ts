// @ts-ignore Node built-ins are available at runtime; this repo does not include explicit Node typings.
import { EventEmitter } from 'events';
// @ts-ignore Node built-ins are available at runtime; this repo does not include explicit Node typings.
import { env } from 'node:process';
import { defineConfig } from 'astro/config';
import komorebi from 'komorebi-theme';

// Astro/Vite attaches many FS watchers in dev on Windows once the migrated content set grows.
// Raising the shared listener cap avoids noisy MaxListeners warnings without affecting behavior.
EventEmitter.defaultMaxListeners = 32;

const githubPagesSite = 'https://jeremiah-gdut.github.io';
const githubPagesBase = '/xrefMe';
const isGitHubPagesBuild = env.GITHUB_ACTIONS === 'true';
const pagesConfig = isGitHubPagesBuild ? { base: githubPagesBase } : {};

export default defineConfig({
  // Keep local dev at `/`, but build under the repository path for GitHub Pages.
  site: githubPagesSite,
  ...pagesConfig,
  integrations: [komorebi()],
});
