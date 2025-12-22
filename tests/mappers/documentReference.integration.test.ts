import { describe, it, expect } from 'vitest';
import { mapDocumentReferences } from '../../src/modules/mappers/documentReference.mapper.js';
import { FullUrlRegistry } from '../../src/modules/mappers/fullUrlRegistry.js';
import type { CanonicalDocumentReference } from '../../src/shared/types/canonical.types.js';

describe('DocumentReference Mapper - Integration Test', () => {
  it('should automatically convert legacy document types to FHIR R5 contentTypes', () => {
    // Create a registry and resolver
    const registry = new FullUrlRegistry();
    const resolveRef = (resourceType: string, idOrIdentifier?: string) => {
      return `${resourceType}/${idOrIdentifier || 'test-id'}`;
    };
    const patientFullUrl = 'Patient/patient-123';

    // Test case 1: PDF document with format field
    const documentReferences: CanonicalDocumentReference[] = [
      {
        id: 'doc-1',
        status: 'current',
        subject: 'patient-123',
        date: '2024-01-15',
        description: 'Medical Report PDF',
        content: [
          {
            attachment: {
              format: 'pdf', // Legacy format
              url: 'https://example.com/reports/medical-report.pdf',
              title: 'Medical Report'
            }
          }
        ]
      },
      // Test case 2: DICOM image with URL extension
      {
        id: 'doc-2',
        status: 'current',
        subject: 'patient-123',
        date: '2024-01-15',
        description: 'DICOM Scan',
        content: [
          {
            attachment: {
              url: 'https://example.com/images/scan.dcm', // Extension in URL
              title: 'CT Scan'
            }
          }
        ]
      },
      // Test case 3: JPEG image with format field
      {
        id: 'doc-3',
        status: 'current',
        subject: 'patient-123',
        date: '2024-01-15',
        description: 'X-Ray Image',
        content: [
          {
            attachment: {
              format: 'jpeg',
              data: 'base64encodedimagedata',
              title: 'Chest X-Ray'
            }
          }
        ]
      },
      // Test case 4: HL7 message with format field
      {
        id: 'doc-4',
        status: 'current',
        subject: 'patient-123',
        date: '2024-01-15',
        description: 'HL7 Message',
        content: [
          {
            attachment: {
              format: 'hl7',
              data: 'base64encodedhl7data',
              title: 'HL7 ADT Message'
            }
          }
        ]
      },
      // Test case 5: Legacy contentType that needs conversion
      {
        id: 'doc-5',
        status: 'current',
        subject: 'patient-123',
        date: '2024-01-15',
        description: 'CDA Document',
        content: [
          {
            attachment: {
              contentType: 'cda', // Legacy format name
              data: 'base64encodedxml',
              title: 'Clinical Document'
            }
          }
        ]
      },
      // Test case 6: MIME type with parameters
      {
        id: 'doc-6',
        status: 'current',
        subject: 'patient-123',
        date: '2024-01-15',
        description: 'CSV Data',
        content: [
          {
            attachment: {
              contentType: 'text/csv; charset=utf-8', // MIME with params
              url: 'https://example.com/data.csv',
              title: 'Patient Data'
            }
          }
        ]
      }
    ];

    // Map document references
    const entries = mapDocumentReferences({
      documentReferences,
      registry,
      resolveRef,
      patientFullUrl
    });

    // Verify results
    expect(entries).toHaveLength(6);

    // Test 1: PDF should be converted to application/pdf
    const pdfEntry = entries[0];
    expect(pdfEntry.resource.content[0].attachment.contentType).toBe('application/pdf');
    expect(pdfEntry.resource.content[0].attachment.url).toBe('https://example.com/reports/medical-report.pdf');
    expect(pdfEntry.resource.content[0].attachment.title).toBe('Medical Report');

    // Test 2: DICOM should be detected from .dcm extension
    const dicomEntry = entries[1];
    expect(dicomEntry.resource.content[0].attachment.contentType).toBe('application/dicom');
    expect(dicomEntry.resource.content[0].attachment.url).toBe('https://example.com/images/scan.dcm');

    // Test 3: JPEG should be converted to image/jpeg
    const jpegEntry = entries[2];
    expect(jpegEntry.resource.content[0].attachment.contentType).toBe('image/jpeg');
    expect(jpegEntry.resource.content[0].attachment.data).toBe('base64encodedimagedata');

    // Test 4: HL7 should be converted to x-application/hl7-v2+er7
    const hl7Entry = entries[3];
    expect(hl7Entry.resource.content[0].attachment.contentType).toBe('x-application/hl7-v2+er7');

    // Test 5: CDA should be converted to application/xml
    const cdaEntry = entries[4];
    expect(cdaEntry.resource.content[0].attachment.contentType).toBe('application/xml');

    // Test 6: CSV MIME type should be normalized (parameters removed)
    const csvEntry = entries[5];
    expect(csvEntry.resource.content[0].attachment.contentType).toBe('text/csv');
  });

  it('should handle document with multiple content items', () => {
    const registry = new FullUrlRegistry();
    const resolveRef = (resourceType: string, idOrIdentifier?: string) => {
      return `${resourceType}/${idOrIdentifier || 'test-id'}`;
    };
    const patientFullUrl = 'Patient/patient-123';

    const documentReferences: CanonicalDocumentReference[] = [
      {
        id: 'doc-multi',
        status: 'current',
        subject: 'patient-123',
        date: '2024-01-15',
        description: 'Multi-format Document',
        content: [
          {
            attachment: {
              format: 'pdf',
              url: 'https://example.com/doc1.pdf',
              title: 'Document 1'
            }
          },
          {
            attachment: {
              format: 'dicom',
              url: 'https://example.com/scan.dcm',
              title: 'Scan 1'
            }
          },
          {
            attachment: {
              format: 'jpeg',
              url: 'https://example.com/image.jpg',
              title: 'Image 1'
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

    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry.resource.content).toHaveLength(3);
    expect(entry.resource.content[0].attachment.contentType).toBe('application/pdf');
    expect(entry.resource.content[1].attachment.contentType).toBe('application/dicom');
    expect(entry.resource.content[2].attachment.contentType).toBe('image/jpeg');
  });

  it('should handle unknown document types with fallback', () => {
    const registry = new FullUrlRegistry();
    const resolveRef = (resourceType: string, idOrIdentifier?: string) => {
      return `${resourceType}/${idOrIdentifier || 'test-id'}`;
    };
    const patientFullUrl = 'Patient/patient-123';

    const documentReferences: CanonicalDocumentReference[] = [
      {
        id: 'doc-unknown',
        status: 'current',
        subject: 'patient-123',
        date: '2024-01-15',
        description: 'Unknown Format Document',
        content: [
          {
            attachment: {
              format: 'unknown-format-xyz', // Unknown format
              url: 'https://example.com/file.xyz',
              title: 'Unknown File'
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

    expect(entries).toHaveLength(1);
    const entry = entries[0];
    // Should fallback to application/octet-stream
    expect(entry.resource.content[0].attachment.contentType).toBe('application/octet-stream');
  });
});

