import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(desktopRoot, '..', '..');
const source = resolve(repoRoot, 'apps', 'web', 'dist');
const target = resolve(desktopRoot, 'web');

await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await cp(source, target, { recursive: true });
