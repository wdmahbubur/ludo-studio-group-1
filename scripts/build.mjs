import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = path.join(root, 'dist');
await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });
for (const entry of ['index.html', 'src', 'assets']) {
  await fs.cp(path.join(root, entry), path.join(dist, entry), { recursive: true });
}
console.log('Built dist/ for static hosting.');
