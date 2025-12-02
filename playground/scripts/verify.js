import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '../test-project');
const nodeModulesDir = path.join(projectDir, 'node_modules');

console.log('🔍 Verifying installation...');

if (!fs.existsSync(nodeModulesDir)) {
  console.error('❌ node_modules not found. Installation failed.');
  process.exit(1);
}

// Check for the specific dependency we expect
const targetPackage = process.argv[2] || 'hono';
const targetPkg = path.join(nodeModulesDir, targetPackage, 'package.json');
if (!fs.existsSync(targetPkg)) {
  console.error(`❌ ${targetPackage} package not found in node_modules.`);
  process.exit(1);
}

console.log('✅ Verification PASSED. Package installed successfully.');
