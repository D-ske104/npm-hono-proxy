import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '../test-project');

const targets = [
  path.join(projectDir, 'node_modules'),
  path.join(projectDir, 'package-lock.json'),
  path.join(projectDir, 'yarn.lock'),
  path.join(projectDir, 'pnpm-lock.yaml'),
];

console.log('🧹 Cleaning playground test-project...');

targets.forEach(target => {
  if (fs.existsSync(target)) {
    try {
      fs.rmSync(target, { recursive: true, force: true });
      console.log(`   Deleted: ${path.relative(projectDir, target)}`);
    } catch (e) {
      console.error(`   Failed to delete ${path.relative(projectDir, target)}:`, e.message);
    }
  }
});

console.log('✨ Cleaned.');
