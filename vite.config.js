import { defineConfig } from 'vite';

// game.js and the art live in public/ and are served as-is; only src/ (the AWS client) is bundled
export default defineConfig({
  // Relative URLs, so the game also works under a path prefix
  // (stevenbower.com proxies it at /thanksgiving/).
  base: './',
  build: { assetsDir: 'bundle' },
  server: { host: true },
});
