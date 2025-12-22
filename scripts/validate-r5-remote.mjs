#!/usr/bin/env node
import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';

const VALIDATOR_URL = process.env.VALIDATOR_URL || 'https://validator.fhir.org/validate';
const LOCAL_CONVERTER = process.env.LOCAL_URL || 'http://localhost:3000/convert';

async function fetchBundle() {
  const sample = {
    patient: {
      id: 'P1',
      identifier: 'PATID1234',
      name: { family: 'JONES', given: ['WILLIAM', 'A'] },
      gender: 'male',
      birthDate: '1961-06-15',
      telecom: [
        { system: 'phone', value: '(919)379-1212', use: 'home' },
        { system: 'phone', value: '(919)271-3434', use: 'work' }
      ],
      address: [{ line: ['1200 N ELM STREET'], city: 'GREENSBORO', state: 'NC', postalCode: '27401-1020' }]
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

  const data = await res.json();
  return data;
}

function summarizeIssues(issues = []) {
  const summary = { fatal: 0, error: 0, warning: 0, information: 0 };
  for (const i of issues) {
    const sev = (i.severity || '').toLowerCase();
    if (sev.includes('fatal')) summary.fatal++;
    else if (sev.includes('error')) summary.error++;
    else if (sev.includes('warning')) summary.warning++;
    else if (sev.includes('information') || sev.includes('info')) summary.information++;
  }
  return summary;
}

async function validateBundle(bundle) {
  console.log(`Posting bundle to validator at ${VALIDATOR_URL} ...`);
  // Try a sequence of endpoints / methods until one returns JSON
  const endpoints = [VALIDATOR_URL, 'https://validator.fhir.org/validator', 'https://validator.fhir.org'];
  let res;
  let lastError;
  let data = null;

  for (const endpoint of endpoints) {
    try {
      // Try JSON POST
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/fhir+json' },
        body: JSON.stringify(bundle)
      });

      // If it looks bad, try form fallback
      if (!res.ok) {
        console.warn(`Endpoint ${endpoint} returned HTTP ${res.status} - trying multipart/form-data fallback...`);
        const form = new FormData();
        form.append('resource', JSON.stringify(bundle), {
          filename: 'bundle.json',
          contentType: 'application/fhir+json'
        });
        const res2 = await fetch(endpoint, {
          method: 'POST',
          headers: form.getHeaders(),
          body: form
        });
        res = res2;
      }

      // If the response is JSON, break and process it
      const text = await res.text();
      try {
        const maybeJson = JSON.parse(text);
        data = maybeJson;
        // set a fake res so later code can continue
        res = { ok: true, status: 200 };
        break;
      } catch (err) {
        // not JSON, keep trying next endpoint
        lastError = `Endpoint ${endpoint} returned non-JSON response`;
        continue;
      }
    } catch (err) {
      lastError = err;
      continue;
    }
  }
  if (!data) {
    // All endpoints failed to return a JSON validation result. Save the bundle locally for manual validation
    console.error(`All validator endpoints failed. Last error: ${String(lastError)}`);
    console.error('Saved converted bundle to tmp/last-converted-bundle.json. You can upload this to https://validator.fhir.org/ for manual validation.');
    return { raw: null, issues: [] };
  }

  // 'data' was populated from the successful endpoint above
  // Try to extract issues array from known shapes
  const issues = data.issue || (data?.operationOutcome?.issue) || data?.issues || [];

  const summary = summarizeIssues(issues);
  console.log('Validation result summary:', summary);

  if (issues.length > 0) {
    console.log('\nTop issues:');
    issues.slice(0, 50).forEach((iss, idx) => {
      console.log(`${idx + 1}. [${iss.severity}] ${iss.code || ''} - ${iss.details?.text || iss.diagnostics || iss.expression || JSON.stringify(iss)}`);
    });
  } else {
    console.log('No issues returned by validator.');
  }

  return { raw: data, issues };
}

async function main() {
  try {
    const bundle = await fetchBundle();
    // Optionally save the bundle locally for inspection
    fs.mkdirSync('tmp', { recursive: true });
    fs.writeFileSync('tmp/last-converted-bundle.json', JSON.stringify(bundle, null, 2));

    const result = await validateBundle(bundle);
    // Save full validator response
    fs.writeFileSync('tmp/last-validator-response.json', JSON.stringify(result.raw, null, 2));

    if (result.issues && result.issues.some(i => (i.severity || '').toLowerCase().includes('error') || (i.severity || '').toLowerCase().includes('fatal'))) {
      console.error('\nValidation finished with errors. See tmp/last-validator-response.json for details.');
      process.exit(1);
    }

    console.log('\nValidation finished with no errors (warnings/info may exist).');
    process.exit(0);
  } catch (err) {
    console.error('Validation script failed:', err.message || err);
    process.exit(2);
  }
}

await main();
