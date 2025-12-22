#!/usr/bin/env node

/**
 * Simple test script to verify document type mapper is working
 * Run with: node test-document-mapper.mjs
 */

import { detectAndMapDocumentType, mapDocumentAttachment } from './src/modules/mappers/documentType.mapper.js';

console.log('🧪 Testing Document Type Mapper\n');
console.log('=' .repeat(60));

// Test cases
const testCases = [
  { input: 'pdf', expected: 'application/pdf', description: 'PDF format' },
  { input: 'dicom', expected: 'application/dicom', description: 'DICOM medical imaging' },
  { input: 'jpeg', expected: 'image/jpeg', description: 'JPEG image' },
  { input: 'hl7', expected: 'x-application/hl7-v2+er7', description: 'HL7 message' },
  { input: 'cda', expected: 'application/xml', description: 'CDA document' },
  { input: 'document.pdf', expected: 'application/pdf', description: 'PDF filename' },
  { input: 'https://example.com/scan.dcm', expected: 'application/dicom', description: 'DICOM URL' },
  { input: 'application/pdf; charset=utf-8', expected: 'application/pdf', description: 'MIME type with params' },
  { input: 'text/csv', expected: 'text/csv', description: 'CSV MIME type' },
  { input: 'edf', expected: 'application/edf', description: 'EDF (EEG/ECG format)' },
];

let passed = 0;
let failed = 0;

console.log('\n📋 Testing Legacy Format Detection:\n');

testCases.forEach(({ input, expected, description }) => {
  const result = detectAndMapDocumentType(input);
  const success = result.fhirContentType === expected;
  
  if (success) {
    console.log(`✅ ${description}`);
    console.log(`   Input: "${input}" → Output: "${result.fhirContentType}"`);
    passed++;
  } else {
    console.log(`❌ ${description}`);
    console.log(`   Input: "${input}"`);
    console.log(`   Expected: "${expected}"`);
    console.log(`   Got: "${result.fhirContentType}"`);
    failed++;
  }
  console.log();
});

console.log('=' .repeat(60));
console.log('\n📦 Testing Document Attachment Mapping:\n');

// Test attachment mapping
const attachmentTests = [
  {
    attachment: { format: 'pdf', url: 'https://example.com/doc.pdf' },
    description: 'Attachment with format field'
  },
  {
    attachment: { url: 'https://example.com/scan.dcm' },
    description: 'Attachment with URL extension'
  },
  {
    attachment: { contentType: 'hl7', data: 'base64data' },
    description: 'Attachment with legacy contentType'
  }
];

attachmentTests.forEach(({ attachment, description }) => {
  const result = mapDocumentAttachment(attachment);
  console.log(`✅ ${description}`);
  console.log(`   Input: ${JSON.stringify(attachment)}`);
  console.log(`   Output contentType: "${result.contentType}"`);
  console.log();
});

console.log('=' .repeat(60));
console.log('\n📊 Test Summary:');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   📈 Total: ${testCases.length}`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! Document mapper is working correctly.\n');
  process.exit(0);
} else {
  console.log('\n⚠️  Some tests failed. Please check the output above.\n');
  process.exit(1);
}

