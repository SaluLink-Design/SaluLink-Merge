#!/usr/bin/env node
/**
 * Validates that every Discovery catalogue condition has CIB registration rules.
 * Run: node frontend/scripts/validate-cib-catalogue.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rulesPath = join(__dirname, '../../shared/data/cib-registration-rules.json');

const CATALOGUE = [
  'Asthma',
  'Cardiac Failure',
  'Cardiomyopathy',
  'Chronic Obstructive Pulmonary Disease',
  'Chronic Renal Disease',
  'Diabetes Mellitus Type 1',
  'Diabetes Mellitus Type 2',
  'Epilepsy',
  'Haemophilia',
  'Hyperlipidaemia',
  'Hypertension',
  'Hypothyroidism',
];

const normalize = (s) => s.trim().toLowerCase();

const data = JSON.parse(readFileSync(rulesPath, 'utf8'));
const ruleNames = new Set(data.conditions.map((c) => normalize(c.condition)));
const missing = CATALOGUE.filter((c) => !ruleNames.has(normalize(c)));

if (missing.length > 0) {
  console.error('Missing CIB rules for catalogue conditions:', missing.join(', '));
  process.exit(1);
}

console.log(`OK: all ${CATALOGUE.length} catalogue conditions have CIB registration rules.`);
