import { defineConfig } from 'genbumppush';

export default defineConfig({
  release: 'major',
  files: ['package.json', 'Cargo.toml'],
  hooks: {
    before: ['vp check', 'vp run typecheck', 'vp run test'],
  },
  github: {
    enabled: true,
  },
});
