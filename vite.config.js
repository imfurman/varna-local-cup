import { defineConfig } from 'vite';
import { socialPreview } from './scripts/social-preview.mjs';

export default defineConfig({ base: './', plugins: [socialPreview()] });
