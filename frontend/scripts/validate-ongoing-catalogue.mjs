#!/usr/bin/env node
/**
 * Validates that ongoing management basket codes in Treatment Basket.csv
 * have explicit entries in ongoing-basket-rules.json (warns on missing).
 * Run: node frontend/scripts/validate-ongoing-catalogue.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const csvPath = join(__dirname, '../public/Treatment Basket.csv');
const rulesPath = join(__dirname, '../public/ongoing-basket-rules.json');

const normalizeCode = (code) => code.trim().split(/\s+/)[0];

const csv = readFileSync(csvPath, 'utf8');
const lines = csv.split(/\r?\n/).slice(1);
const ongoingCodes = new Set();

for (const line of lines) {
  if (!line.trim()) continue;
  const cols = line.split(',');
  const ongoingCode = cols[6]?.trim();
  const ongoingDesc = cols[5]?.trim();
  if (ongoingCode && ongoingDesc) {
    ongoingCodes.add(normalizeCode(ongoingCode));
  }
}

const rules = JSON.parse(readFileSync(rulesPath, 'utf8'));
const ruleCodes = new Set(rules.items.map((item) => normalizeCode(item.code)));
const missing = [...ongoingCodes].filter((code) => !ruleCodes.has(code)).sort();

if (missing.length > 0) {
  console.warn(
    `Warning: ${missing.length} ongoing basket code(s) use defaults (no explicit rule):`,
    missing.join(', ')
  );
}

console.log(
  `OK: validated ${ongoingCodes.size} ongoing basket codes; ${ruleCodes.size} explicit rules defined.`
);
