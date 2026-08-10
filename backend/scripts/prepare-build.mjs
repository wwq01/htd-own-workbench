import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildDir = path.resolve(__dirname, '../../build');
fs.mkdirSync(buildDir, { recursive: true });
console.log(`Build directory ready: ${buildDir}`);
