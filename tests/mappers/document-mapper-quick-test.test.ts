import { describe, it, expect } from 'vitest';
import { detectAndMapDocumentType, mapDocumentAttachment } from '../../src/modules/mappers/documentType.mapper.js';
import { mapDocumentReferences } from '../../src/modules/mappers/documentReference.mapper.js';
import { FullUrlRegistry } from '../../src/modules/mappers/fullUrlRegistry.js';
import type { CanonicalDocumentReference } from '../../src/shared/types/canonical.types.js';

/**
 * QUICK TEST - Run this to verify document mapper is working
 * 
 * Run with: npm test -- document-mapper-quick-test.test.ts
 */
describe('Document Mapper - Quick Verification Test', () => {
  it('✅ Should convert legacy document types to FHIR R5 - COMPREHENSIVE TEST', () => {
    console.log('\n🧪 Testing Document Type Mapper\n');
    console.log('='.repeat(70));

    // Test Case 1: PDF Document
    const pdfResult = detectAndMapDocumentType('pdf');
    console.log('✅ Test 1: PDF format');
    console.log(`   Input: "pdf" → Output: "${pdfResult.fhirContentType}"`);
    expect(pdfResult.fhirContentType).toBe('application/pdf');
    expect(pdfResult.mapped).toBe(true);

    // Test Case 2: DICOM Medical Imaging
    const dicomResult = detectAndMapDocumentType('dicom');
    console.log('✅ Test 2: DICOM medical imaging');
    console.log(`   Input: "dicom" → Output: "${dicomResult.fhirContentType}"`);
    expect(dicomResult.fhirContentType).toBe('application/dicom');
    expect(dicomResult.mapped).toBe(true);

    // Test Case 3: JPEG Image
    const jpegResult = detectAndMapDocumentType('jpeg');
    console.log('✅ Test 3: JPEG image');
    console.log(`   Input: "jpeg" → Output: "${jpegResult.fhirContentType}"`);
    expect(jpegResult.fhirContentType).toBe('image/jpeg');
    expect(jpegResult.mapped).toBe(true);

    // Test Case 4: HL7 Message
    const hl7Result = detectAndMapDocumentType('hl7');
    console.log('✅ Test 4: HL7 message');
    console.log(`   Input: "hl7" → Output: "${hl7Result.fhirContentType}"`);
    expect(hl7Result.fhirContentType).toBe('x-application/hl7-v2+er7');
    expect(hl7Result.mapped).toBe(true);

    // Test Case 5: CDA Document
    const cdaResult = detectAndMapDocumentType('cda');
    console.log('✅ Test 5: CDA document');
    console.log(`   Input: "cda" → Output: "${cdaResult.fhirContentType}"`);
    expect(cdaResult.fhirContentType).toBe('application/xml');
    expect(cdaResult.mapped).toBe(true);

    // Test Case 6: Filename with extension
    const filenameResult = detectAndMapDocumentType('document.pdf');
    console.log('✅ Test 6: PDF filename');
    console.log(`   Input: "document.pdf" → Output: "${filenameResult.fhirContentType}"`);
    expect(filenameResult.fhirContentType).toBe('application/pdf');
    expect(filenameResult.mapped).toBe(true);

    // Test Case 7: URL with extension
    const urlResult = detectAndMapDocumentType('https://example.com/scan.dcm');
    console.log('✅ Test 7: DICOM URL');
    console.log(`   Input: "https://example.com/scan.dcm" → Output: "${urlResult.fhirContentType}"`);
    expect(urlResult.fhirContentType).toBe('application/dicom');
    expect(urlResult.mapped).toBe(true);

    // Test Case 8: MIME type with parameters
    const mimeResult = detectAndMapDocumentType('application/pdf; charset=utf-8');
    console.log('✅ Test 8: MIME type with parameters');
    console.log(`   Input: "application/pdf; charset=utf-8" → Output: "${mimeResult.fhirContentType}"`);
    expect(mimeResult.fhirContentType).toBe('application/pdf');
    expect(mimeResult.mapped).toBe(true);

    // Test Case 9: CSV format
    const csvResult = detectAndMapDocumentType('csv');
    console.log('✅ Test 9: CSV format');
    console.log(`   Input: "csv" → Output: "${csvResult.fhirContentType}"`);
    expect(csvResult.fhirContentType).toBe('text/csv');
    expect(csvResult.mapped).toBe(true);

    // Test Case 10: EDF (EEG/ECG format)
    const edfResult = detectAndMapDocumentType('edf');
    console.log('✅ Test 10: EDF (EEG/ECG) format');
    console.log(`   Input: "edf" → Output: "${edfResult.fhirContentType}"`);
    expect(edfResult.fhirContentType).toBe('application/edf');
    expect(edfResult.mapped).toBe(true);

    console.log('\n' + '='.repeat(70));
    console.log('✅ All 10 basic tests passed!\n');
  });

  it('✅ Should map document attachments correctly', () => {
    console.log('\n📦 Testing Document Attachment Mapping:\n');

    // Test 1: Attachment with format field
    const attachment1 = mapDocumentAttachment({
      format: 'pdf',
      url: 'https://example.com/doc.pdf',
      title: 'Medical Report'
    });
    console.log('✅ Attachment with format field');
    console.log(`   Format: "pdf" → contentType: "${attachment1.contentType}"`);
    expect(attachment1.contentType).toBe('application/pdf');
    expect(attachment1.url).toBe('https://example.com/doc.pdf');
    expect(attachment1.title).toBe('Medical Report');

    // Test 2: Attachment with URL extension
    const attachment2 = mapDocumentAttachment({
      url: 'https://example.com/images/scan.dcm'
    });
    console.log('✅ Attachment with URL extension');
    console.log(`   URL: "scan.dcm" → contentType: "${attachment2.contentType}"`);
    expect(attachment2.contentType).toBe('application/dicom');

    // Test 3: Attachment with legacy contentType
    const attachment3 = mapDocumentAttachment({
      contentType: 'hl7',
      data: 'base64data'
    });
    console.log('✅ Attachment with legacy contentType');
    console.log(`   contentType: "hl7" → "${attachment3.contentType}"`);
    expect(attachment3.contentType).toBe('x-application/hl7-v2+er7');

    console.log('\n✅ All attachment mapping tests passed!\n');
  });

  it('✅ Should work with full DocumentReference mapping', () => {
    console.log('\n📄 Testing Full DocumentReference Integration:\n');

    const registry = new FullUrlRegistry();
    const resolveRef = (resourceType: string, idOrIdentifier?: string) => {
      return `${resourceType}/${idOrIdentifier || 'test-id'}`;
    };
    const patientFullUrl = 'Patient/patient-123';

    const documentReferences: CanonicalDocumentReference[] = [
      {
        id: 'doc-test-1',
        status: 'current',
        subject: 'patient-123',
        date: '2024-01-15',
        description: 'Test PDF Document',
        content: [
          {
            attachment: {
              format: 'pdf', // Legacy format
              url: 'https://example.com/report.pdf',
              title: 'Medical Report'
            }
          }
        ]
      },
      {
        id: 'doc-test-2',
        status: 'current',
        subject: 'patient-123',
        date: '2024-01-15',
        description: 'Test DICOM Scan',
        content: [
          {
            attachment: {
              url: 'https://example.com/scan.dcm', // Extension in URL
              title: 'CT Scan'
            }
          }
        ]
      },
      {
        id: 'doc-test-3',
        status: 'current',
        subject: 'patient-123',
        date: '2024-01-15',
        description: 'Test HL7 Message',
        content: [
          {
            attachment: {
              format: 'hl7',
              data: 'base64encodeddata',
              title: 'HL7 ADT Message'
            }
          }
        ]
      }
    ];

    const entries = mapDocumentReferences({
      documentReferences,
      registry,
      resolveRef,
      patientFullUrl
    });

    expect(entries).toHaveLength(3);

    // Verify PDF conversion
    console.log('✅ Document 1: PDF with format field');
    console.log(`   Format: "pdf" → contentType: "${entries[0].resource.content[0].attachment.contentType}"`);
    expect(entries[0].resource.content[0].attachment.contentType).toBe('application/pdf');

    // Verify DICOM conversion
    console.log('✅ Document 2: DICOM from URL extension');
    console.log(`   URL: "scan.dcm" → contentType: "${entries[1].resource.content[0].attachment.contentType}"`);
    expect(entries[1].resource.content[0].attachment.contentType).toBe('application/dicom');

    // Verify HL7 conversion
    console.log('✅ Document 3: HL7 with format field');
    console.log(`   Format: "hl7" → contentType: "${entries[2].resource.content[0].attachment.contentType}"`);
    expect(entries[2].resource.content[0].attachment.contentType).toBe('x-application/hl7-v2+er7');

    console.log('\n✅ Full DocumentReference integration test passed!\n');
    console.log('='.repeat(70));
    console.log('\n🎉 ALL TESTS PASSED! Document mapper is working correctly! 🎉\n');
  });
});

