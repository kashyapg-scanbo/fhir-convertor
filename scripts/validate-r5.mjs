#!/usr/bin/env node
import fetch from 'node-fetch';

async function run() {
  const sample = {
    patient: {
      id: 'P1',
      identifier: 'P1',
      name: { family: 'Doe', given: ['John'] },
      gender: 'male',
      birthDate: '1980-01-01'
    }
  };

  const body = JSON.stringify({ input: JSON.stringify(sample), format: 'json' });

  try {
    const res = await fetch('http://localhost:3000/convert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    const data = await res.json();

    if (!data || data.resourceType !== 'Bundle') {
      console.error('Response is not a FHIR Bundle.');
      console.log(JSON.stringify(data, null, 2));
      process.exit(2);
    }

    console.log('Bundle received — entries:', data.entry?.length || 0);

    // Basic per-resource checks
    const problems = [];
    for (const e of data.entry || []) {
      const r = e.resource;
      if (!r || !r.resourceType) {
        problems.push('Entry missing resource or resourceType');
        continue;
      }
      if (!r.id) {
        problems.push(`${r.resourceType} resource missing id`);
      }
    }

    if (problems.length) {
      console.warn('Validation warnings:');
      problems.forEach(p => console.warn('- ' + p));
      process.exit(1);
    }

    console.log('Basic checks passed — bundle appears structurally OK.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to validate:', err.message || err);
    process.exit(3);
  }
}

run();
