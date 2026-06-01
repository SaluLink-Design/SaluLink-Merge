#!/usr/bin/env node
/**
 * Copy canonical CSV datasets from shared/data into:
 * - frontend/public (Next.js static fetch)
 * - backend (FastAPI / Railway)
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'shared', 'data');
const targets = [
  join(root, 'frontend', 'public'),
  join(root, 'backend'),
];

if (!existsSync(source)) {
  console.error('Missing shared/data — add Chronic Conditions.csv, Medicine List.csv, Treatment Basket.csv');
  process.exit(1);
}

const files = readdirSync(source).filter((f) => f.endsWith('.csv'));
if (files.length === 0) {
  console.error('No CSV files in shared/data');
  process.exit(1);
}

for (const target of targets) {
  mkdirSync(target, { recursive: true });
  for (const file of files) {
    copyFileSync(join(source, file), join(target, file));
  }
  console.log(`Synced ${files.length} CSV(s) → ${target}`);
}
