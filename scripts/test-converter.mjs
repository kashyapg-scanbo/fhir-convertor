#!/usr/bin/env node
/**
 * Comprehensive Test Tool for Legacy Data to FHIR R5 Converter
 * 
 * Usage:
 *   node scripts/test-converter.mjs <input-file> [--format=hl7v2|cda|json] [--validate] [--output=output.json]
 *   node scripts/test-converter.mjs --example=hl7v2
 *   node scripts/test-converter.mjs --example=json
 *   node scripts/test-converter.mjs --example=cda
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import FormData from 'form-data';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOCAL_CONVERTER = process.env.LOCAL_URL || 'http://localhost:3000/convert';
const VALIDATOR_URL = 'https://validator.fhir.org/validate';

// Example inputs for testing
const EXAMPLES = {
  hl7v2: `MSH|^~\\&|RAD|HOSP|EHR|HOSP|202401011230||ORU^R01|MSG00002|P|2.5.1
PID|1||123456^^^HOSP^MR||DOE^JOHN||19800101|M
OBR|1||ORDER123|CTCHEST^CT Chest|||202401011100
OBX|1|ED|DICOM^DICOM Study||^DICOM^URI^https://example.com/images/ct-chest-scan.dcm`,

  json: JSON.stringify({
    patient: {
      id: 'P1',
      firstName: 'John',
      lastName: 'Doe',
      gender: 'male',
      birthDate: '1980-01-01',
      address: {
        line1: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        country: 'USA'
      },
      contacts: [
        { type: 'phone', value: '555-1234' },
        { type: 'email', value: 'john.doe@example.com' }
      ]
    },
    documentReferences: [{
      id: 'DOC1',
      format: 'pdf',
      url: 'https://example.com/report.pdf',
      date: '2024-01-15',
      description: 'Medical Report'
    }],
    observations: [{
      code: '8867-4',
      codeSystem: 'LOINC',
      display: 'Heart rate',
      value: 78,
      unit: '/min',
      recordedDateTime: '2024-01-15T10:00:00Z'
    }]
  }, null, 2),

  cda: `<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocumnt xmlns="urn:hl7-org:v3">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <templateId roote="2.16.840.1.113883.10.20.22.1.1"/>
  <id root="2.16.840.1.113883.19" extension="123456"/>
  <code code="34133-9" codeSystem="2.16.840.1.113883.6.1" displayName="Summarization of Episode Note"/>
  <title>Clinical Document</title>
  <effectiveTime value="20240115100000"/>
  <confidentialityCode code="N" codeSystem="2.16.840.1.113883.5.25"/>
  <recordTarget>
    <patientRole>
      <id extension="123456" root="2.16.840.1.113883.19"/>
      <patient>
        <name>
          <given>John</given>
          <family>Doe</family>
        </name>
        <administrativeGenderCode code="M" codeSystem="2.16.840.1.113883.5.1"/>
        <birthTime value="19800101"/>
      </patient>
    </patientRole>
  </recordTarget>
</ClinicalDocumnt>`
};

async function convertInput(input, format) {
  console.log(`\n🔄 Converting ${format || 'auto-detected'} input...`);
  
  const body = JSON.stringify({ 
    input: input, 
    format: format 
  });

  try {
    const res = await fetch(LOCAL_CONVERTER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Converter returned ${res.status}: ${errorText}`);
    }

    const bundle = await res.json();
    
    if (!bundle || bundle.resourceType !== 'Bundle') {
      throw new Error('Response is not a FHIR Bundle');
    }

    console.log(`✅ Conversion successful!`);
    console.log(`   Bundle type: ${bundle.type}`);
    console.log(`   Entries: ${bundle.entry?.length || 0}`);
    console.log(`   Resources: ${bundle.entry?.map(e => e.resource?.resourceType).filter(Boolean).join(', ') || 'none'}`);
    
    return bundle;
  } catch (error) {
    console.error(`❌ Conversion failed: ${error.message}`);
    throw error;
  }
}

async function validateBundle(bundle) {
  console.log(`\n🔍 Validating bundle with FHIR Validator (${VALIDATOR_URL})...`);
  
  // Save bundle first
  const outputDir = path.join(__dirname, '..', 'tmp');
  fs.mkdirSync(outputDir, { recursive: true });
  const bundlePath = path.join(outputDir, 'test-bundle.json');
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
  console.log(`   Saved bundle to: ${bundlePath}`);

  // Try to validate via API
  const endpoints = [
    'https://validator.fhir.org/validate',
    'https://validator.fhir.org/validator'
  ];

  let validationResult = null;
  let lastError = null;

  for (const endpoint of endpoints) {
    try {
      // Try JSON POST
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/fhir+json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(bundle)
      });

      const text = await res.text();
      
      try {
        const json = JSON.parse(text);
        validationResult = json;
        break;
      } catch (e) {
        // Not JSON, try next endpoint
        lastError = `Endpoint ${endpoint} returned non-JSON: ${text.substring(0, 100)}`;
        continue;
      }
    } catch (err) {
      lastError = err.message;
      continue;
    }
  }

  if (validationResult) {
    const issues = validationResult.issue || validationResult.operationOutcome?.issue || [];
    const summary = {
      fatal: 0,
      error: 0,
      warning: 0,
      information: 0
    };

    issues.forEach(issue => {
      const sev = (issue.severity || '').toLowerCase();
      if (sev.includes('fatal')) summary.fatal++;
      else if (sev.includes('error')) summary.error++;
      else if (sev.includes('warning')) summary.warning++;
      else if (sev.includes('information') || sev.includes('info')) summary.information++;
    });

    console.log(`\n📊 Validation Summary:`);
    console.log(`   Fatal: ${summary.fatal}`);
    console.log(`   Errors: ${summary.error}`);
    console.log(`   Warnings: ${summary.warning}`);
    console.log(`   Information: ${summary.information}`);

    if (issues.length > 0) {
      console.log(`\n⚠️  Top Issues (showing first 10):`);
      issues.slice(0, 10).forEach((issue, idx) => {
        const location = issue.location?.join(', ') || 'N/A';
        const message = issue.details?.text || issue.diagnostics || issue.expression || JSON.stringify(issue);
        console.log(`   ${idx + 1}. [${issue.severity}] ${location}: ${message}`);
      });
    }

    // Save validation result
    const validationPath = path.join(outputDir, 'test-validation-result.json');
    fs.writeFileSync(validationPath, JSON.stringify(validationResult, null, 2));
    console.log(`   Saved validation result to: ${validationPath}`);

    if (summary.fatal > 0 || summary.error > 0) {
      console.log(`\n❌ Validation found errors. Please review the issues above.`);
      return false;
    } else {
      console.log(`\n✅ Validation passed (no fatal/error issues).`);
      return true;
    }
  } else {
    console.log(`\n⚠️  Could not validate via API (${lastError})`);
    console.log(`   Bundle saved to: ${bundlePath}`);
    console.log(`   Please validate manually at: https://validator.fhir.org/`);
    console.log(`   Upload the file: ${bundlePath}`);
    return null;
  }
}

function printUsage() {
  console.log(`
Usage:
  node scripts/test-converter.mjs <input-file> [options]
  node scripts/test-converter.mjs --example=<format> [options]

Options:
  --format=<format>     Force format: hl7v2, cda, or json (auto-detected if not provided)
  --validate            Validate output with FHIR Validator
  --output=<file>      Save output to file (default: tmp/test-bundle.json)
  --example=<format>    Use example input (hl7v2, json, or cda)

Examples:
  # Test with HL7v2 file
  node scripts/test-converter.mjs input.hl7 --format=hl7v2 --validate

  # Test with JSON file
  node scripts/test-converter.mjs input.json --format=json --validate

  # Use example and validate
  node scripts/test-converter.mjs --example=hl7v2 --validate

  # Test and save output
  node scripts/test-converter.mjs input.hl7 --output=my-bundle.json
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  let input = null;
  let format = null;
  let shouldValidate = false;
  let outputFile = null;
  let useExample = null;

  // Parse arguments
  for (const arg of args) {
    if (arg.startsWith('--format=')) {
      format = arg.split('=')[1];
    } else if (arg.startsWith('--output=')) {
      outputFile = arg.split('=')[1];
    } else if (arg.startsWith('--example=')) {
      useExample = arg.split('=')[1];
    } else if (arg === '--validate') {
      shouldValidate = true;
    } else if (!arg.startsWith('--')) {
      input = arg;
    }
  }

  // Use example if specified
  if (useExample) {
    if (!EXAMPLES[useExample]) {
      console.error(`❌ Unknown example format: ${useExample}`);
      console.error(`   Available: ${Object.keys(EXAMPLES).join(', ')}`);
      process.exit(1);
    }
    input = EXAMPLES[useExample];
    format = format || useExample;
    console.log(`📝 Using ${useExample} example input`);
  } else if (input) {
    // Read from file
    try {
      const inputPath = path.isAbsolute(input) ? input : path.join(process.cwd(), input);
      input = fs.readFileSync(inputPath, 'utf-8');
      console.log(`📄 Read input from: ${inputPath}`);
    } catch (error) {
      console.error(`❌ Failed to read input file: ${error.message}`);
      process.exit(1);
    }
  } else {
    console.error(`❌ No input provided. Use --example=<format> or provide a file path.`);
    printUsage();
    process.exit(1);
  }

  try {
    // Convert
    const bundle = await convertInput(input, format);

    // Save output
    const outputDir = path.join(__dirname, '..', 'tmp');
    fs.mkdirSync(outputDir, { recursive: true });
    const savePath = outputFile 
      ? (path.isAbsolute(outputFile) ? outputFile : path.join(process.cwd(), outputFile))
      : path.join(outputDir, 'test-bundle.json');
    
    fs.writeFileSync(savePath, JSON.stringify(bundle, null, 2));
    console.log(`\n💾 Bundle saved to: ${savePath}`);

    // Validate if requested
    if (shouldValidate) {
      await validateBundle(bundle);
    } else {
      console.log(`\n💡 Tip: Add --validate flag to validate with FHIR Validator`);
      console.log(`   Or validate manually at: https://validator.fhir.org/`);
      console.log(`   Upload file: ${savePath}`);
    }

    console.log(`\n✅ Test completed successfully!`);
  } catch (error) {
    console.error(`\n❌ Test failed: ${error.message}`);
    process.exit(1);
  }
}

main();

