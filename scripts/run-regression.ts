import fs from 'fs/promises';
import path from 'path';
import { convertLegacyData } from '../src/modules/pipeline/convert.pipeline.ts';
import { getFormatForFile, normalizeBundle, stableStringify } from './regression.utils.ts';

const args = process.argv.slice(2);
const inputRoot = getArgValue(args, '--input') || 'exmaple';
const outputRoot = getArgValue(args, '--out') || 'tmp/regression';

async function main() {
  const inputDir = path.resolve(inputRoot);
  const outputDir = path.resolve(outputRoot);
  const files = await listFiles(inputDir);

  if (files.length === 0) {
    console.error(`No files found under ${inputDir}`);
    process.exit(1);
  }

  await fs.mkdir(outputDir, { recursive: true });
  let successCount = 0;
  let failureCount = 0;

  for (const filePath of files) {
    const format = getFormatForFile(filePath, inputDir);
    if (!format) {
      console.warn(`Skipping unsupported file: ${filePath}`);
      continue;
    }

    try {
      const input = await readInput(filePath, format);
      const bundle = await convertLegacyData(input, format, 'r5');
      const normalized = normalizeBundle(bundle);

      const rel = path.relative(inputDir, filePath);
      const outputPath = path.resolve(outputDir, replaceExt(rel, '.json'));
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, stableStringify(normalized), 'utf8');
      successCount += 1;
    } catch (err: any) {
      failureCount += 1;
      console.error(`Failed to convert ${filePath}: ${err?.message || err}`);
    }
  }

  console.log(`Converted ${successCount} files to ${outputDir}. Failures: ${failureCount}.`);
  if (failureCount > 0) process.exit(1);
}

async function listFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function readInput(filePath: string, format: string): Promise<string> {
  if (format === 'xlsx' || format === 'xls') {
    const buf = await fs.readFile(filePath);
    return buf.toString('base64');
  }
  return fs.readFile(filePath, 'utf8');
}

function replaceExt(filePath: string, newExt: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${newExt}`);
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
