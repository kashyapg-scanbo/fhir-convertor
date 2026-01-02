import fs from 'fs/promises';
import path from 'path';
import { normalizeBundle, stableStringify } from './regression.utils.ts';

const args = process.argv.slice(2);
const baselineRoot = getArgValue(args, '--baseline') || 'golden';
const currentRoot = getArgValue(args, '--current') || 'tmp/regression';

async function main() {
  const baselineDir = path.resolve(baselineRoot);
  const currentDir = path.resolve(currentRoot);

  const baselineFiles = await listFiles(baselineDir);
  const currentFiles = await listFiles(currentDir);

  const baselineSet = new Set(baselineFiles.map(f => path.relative(baselineDir, f)));
  const currentSet = new Set(currentFiles.map(f => path.relative(currentDir, f)));

  const missing = [...baselineSet].filter(f => !currentSet.has(f));
  const extra = [...currentSet].filter(f => !baselineSet.has(f));

  const changed: string[] = [];
  const checked = [...baselineSet].filter(f => currentSet.has(f));

  for (const rel of checked) {
    const basePath = path.join(baselineDir, rel);
    const currPath = path.join(currentDir, rel);
    const baseText = await fs.readFile(basePath, 'utf8');
    const currText = await fs.readFile(currPath, 'utf8');

    const baseJson = normalizeBundle(JSON.parse(baseText));
    const currJson = normalizeBundle(JSON.parse(currText));

    if (stableStringify(baseJson) !== stableStringify(currJson)) {
      changed.push(rel);
    }
  }

  if (missing.length === 0 && extra.length === 0 && changed.length === 0) {
    console.log('Regression check passed. No differences found.');
    return;
  }

  if (missing.length > 0) {
    console.log(`Missing outputs (${missing.length}):`);
    missing.forEach(item => console.log(`  - ${item}`));
  }

  if (extra.length > 0) {
    console.log(`Extra outputs (${extra.length}):`);
    extra.forEach(item => console.log(`  - ${item}`));
  }

  if (changed.length > 0) {
    console.log(`Changed outputs (${changed.length}):`);
    changed.forEach(item => console.log(`  - ${item}`));
  }

  process.exit(1);
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(fullPath);
    }
  }
  return files;
}

function getArgValue(args: string[], name: string): string | undefined {
  const match = args.find(arg => arg.startsWith(`${name}=`));
  if (!match) return undefined;
  return match.slice(name.length + 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
