#!/usr/bin/env node
import fetch from 'node-fetch';
import fs from 'fs';
import { spawnSync } from 'child_process';

const LOCAL_CONVERTER = process.env.LOCAL_URL || 'http://localhost:3000/convert';
const VALIDATOR_JAR = process.env.FHIR_VALIDATOR_JAR || 'tools/validator_cli.jar';
const JAVA_BIN = process.env.JAVA_BIN || 'java';

async function fetchBundle() {
  const sample = {
    patient: {
      id: 'P1',
      identifier: 'PATID1234',
      name: { family: 'JONES', given: ['WILLIAM', 'A'] },
      gender: 'male',
      birthDate: '1961-06-15'
    }
  };

  const res = await fetch(LOCAL_CONVERTER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: JSON.stringify(sample), format: 'json' })
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Local converter returned ${res.status}: ${txt}`);
  }

  return res.json();
}

async function main() {
  try {
    const bundle = await fetchBundle();
    fs.mkdirSync('tmp', { recursive: true });
    const bundlePath = 'tmp/last-converted-bundle.json';
    fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));

    if (!fs.existsSync(VALIDATOR_JAR)) {
      console.error(`FHIR validator jar not found at: ${VALIDATOR_JAR}`);
      console.error('Set FHIR_VALIDATOR_JAR to your validator_cli.jar path and rerun.');
      process.exit(2);
    }

    console.log(`Validating with HL7 validator offline (tx=n/a): ${bundlePath}`);
    const args = ['-jar', VALIDATOR_JAR, bundlePath, '-version', '5.0', '-tx', 'n/a'];
    const result = spawnSync(JAVA_BIN, args, { stdio: 'inherit' });

    if (result.status !== 0) {
      process.exit(result.status || 1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Offline validation failed:', err.message || err);
    process.exit(3);
  }
}

await main();
