import { describe, it, expect } from 'vitest';
import {
  detectAndMapDocumentType,
  mapDocumentAttachment,
  mapDocumentContent,
  getDocumentTypeInfo
} from '../../src/modules/mappers/documentType.mapper.js';

describe('DocumentTypeMapper', () => {
  describe('detectAndMapDocumentType', () => {
    it('should map common document formats', () => {
      expect(detectAndMapDocumentType('pdf')).toEqual({
        legacyType: 'pdf',
        fhirContentType: 'application/pdf',
        mapped: true,
        original: 'pdf'
      });

      expect(detectAndMapDocumentType('dicom')).toEqual({
        legacyType: 'dicom',
        fhirContentType: 'application/dicom',
        mapped: true,
        original: 'dicom'
      });

      expect(detectAndMapDocumentType('jpeg')).toEqual({
        legacyType: 'jpeg',
        fhirContentType: 'image/jpeg',
        mapped: true,
        original: 'jpeg'
      });
    });

    it('should handle file extensions with dot', () => {
      expect(detectAndMapDocumentType('.pdf')).toEqual({
        legacyType: 'pdf',
        fhirContentType: 'application/pdf',
        mapped: true,
        original: '.pdf'
      });
    });

    it('should extract extension from filenames', () => {
      expect(detectAndMapDocumentType('document.pdf')).toEqual({
        legacyType: 'pdf',
        fhirContentType: 'application/pdf',
        mapped: true,
        original: 'document.pdf'
      });

      expect(detectAndMapDocumentType('scan.dcm')).toEqual({
        legacyType: 'dcm',
        fhirContentType: 'application/dicom',
        mapped: true,
        original: 'scan.dcm'
      });
    });

    it('should extract extension from URLs', () => {
      expect(detectAndMapDocumentType('https://example.com/document.pdf')).toEqual({
        legacyType: 'pdf',
        fhirContentType: 'application/pdf',
        mapped: true,
        original: 'https://example.com/document.pdf'
      });

      expect(detectAndMapDocumentType('https://example.com/images/scan.dcm?token=123')).toEqual({
        legacyType: 'dcm',
        fhirContentType: 'application/dicom',
        mapped: true,
        original: 'https://example.com/images/scan.dcm?token=123'
      });
    });

    it('should handle MIME types', () => {
      expect(detectAndMapDocumentType('application/pdf')).toEqual({
        legacyType: 'application/pdf',
        fhirContentType: 'application/pdf',
        mapped: true,
        original: 'application/pdf'
      });

      expect(detectAndMapDocumentType('image/jpeg')).toEqual({
        legacyType: 'image/jpeg',
        fhirContentType: 'image/jpeg',
        mapped: true,
        original: 'image/jpeg'
      });
    });

    it('should normalize MIME types with parameters', () => {
      expect(detectAndMapDocumentType('application/pdf; charset=utf-8')).toEqual({
        legacyType: 'application/pdf',
        fhirContentType: 'application/pdf',
        mapped: true,
        original: 'application/pdf; charset=utf-8'
      });
    });

    it('should handle healthcare-specific formats', () => {
      expect(detectAndMapDocumentType('hl7')).toEqual({
        legacyType: 'hl7',
        fhirContentType: 'x-application/hl7-v2+er7',
        mapped: true,
        original: 'hl7'
      });

      expect(detectAndMapDocumentType('cda')).toEqual({
        legacyType: 'cda',
        fhirContentType: 'application/xml',
        mapped: true,
        original: 'cda'
      });

      expect(detectAndMapDocumentType('edf')).toEqual({
        legacyType: 'edf',
        fhirContentType: 'application/edf',
        mapped: true,
        original: 'edf'
      });
    });

    it('should handle case-insensitive input', () => {
      expect(detectAndMapDocumentType('PDF')).toEqual({
        legacyType: 'pdf',
        fhirContentType: 'application/pdf',
        mapped: true,
        original: 'PDF'
      });

      expect(detectAndMapDocumentType('DICOM')).toEqual({
        legacyType: 'dicom',
        fhirContentType: 'application/dicom',
        mapped: true,
        original: 'DICOM'
      });
    });

    it('should return fallback for unknown types', () => {
      expect(detectAndMapDocumentType('unknown-format')).toEqual({
        fhirContentType: 'application/octet-stream',
        mapped: false,
        original: 'unknown-format'
      });
    });

    it('should handle null/undefined/empty input', () => {
      expect(detectAndMapDocumentType(null)).toEqual({
        fhirContentType: 'application/octet-stream',
        mapped: false,
        original: ''
      });

      expect(detectAndMapDocumentType(undefined)).toEqual({
        fhirContentType: 'application/octet-stream',
        mapped: false,
        original: ''
      });

      expect(detectAndMapDocumentType('')).toEqual({
        fhirContentType: 'application/octet-stream',
        mapped: false,
        original: ''
      });
    });
  });

  describe('mapDocumentAttachment', () => {
    it('should map attachment with contentType', () => {
      const attachment = {
        contentType: 'application/pdf',
        url: 'https://example.com/doc.pdf',
        title: 'Test Document',
        data: 'base64data'
      };

      const result = mapDocumentAttachment(attachment);
      expect(result.contentType).toBe('application/pdf');
      expect(result.url).toBe('https://example.com/doc.pdf');
      expect(result.title).toBe('Test Document');
      expect(result.data).toBe('base64data');
    });

    it('should detect type from format field', () => {
      const attachment = {
        format: 'pdf',
        url: 'https://example.com/doc.pdf'
      };

      const result = mapDocumentAttachment(attachment);
      expect(result.contentType).toBe('application/pdf');
    });

    it('should detect type from URL extension', () => {
      const attachment = {
        url: 'https://example.com/scan.dcm'
      };

      const result = mapDocumentAttachment(attachment);
      expect(result.contentType).toBe('application/dicom');
    });

    it('should use formatHint when provided', () => {
      const attachment = {
        contentType: 'text/plain' // Wrong type
      };

      const result = mapDocumentAttachment(attachment, 'pdf');
      expect(result.contentType).toBe('application/pdf');
    });

    it('should prioritize formatHint over other fields', () => {
      const attachment = {
        format: 'jpeg',
        contentType: 'image/png',
        url: 'https://example.com/image.gif'
      };

      const result = mapDocumentAttachment(attachment, 'pdf');
      expect(result.contentType).toBe('application/pdf');
    });
  });

  describe('mapDocumentContent', () => {
    it('should map content array with legacy types', () => {
      const content = [
        {
          attachment: {
            format: 'pdf',
            url: 'https://example.com/doc.pdf'
          }
        },
        {
          attachment: {
            format: 'dicom',
            url: 'https://example.com/scan.dcm'
          }
        }
      ];

      const result = mapDocumentContent(content);
      expect(result).toHaveLength(2);
      expect(result[0].attachment.contentType).toBe('application/pdf');
      expect(result[1].attachment.contentType).toBe('application/dicom');
    });

    it('should handle empty content array', () => {
      expect(mapDocumentContent([])).toEqual([]);
    });

    it('should handle undefined content', () => {
      expect(mapDocumentContent(undefined)).toEqual([]);
    });
  });

  describe('getDocumentTypeInfo', () => {
    it('should return detection result and supported types', () => {
      const info = getDocumentTypeInfo('pdf');
      expect(info.detected.mapped).toBe(true);
      expect(info.detected.fhirContentType).toBe('application/pdf');
      expect(info.allSupportedTypes).toContain('pdf');
      expect(info.allSupportedTypes).toContain('dicom');
      expect(info.allSupportedTypes).toContain('jpeg');
    });
  });

  describe('Comprehensive format coverage', () => {
    const testCases = [
      { input: 'pdf', expected: 'application/pdf' },
      { input: 'dicom', expected: 'application/dicom' },
      { input: 'jpeg', expected: 'image/jpeg' },
      { input: 'png', expected: 'image/png' },
      { input: 'mp4', expected: 'video/mp4' },
      { input: 'mp3', expected: 'audio/mpeg' },
      { input: 'xml', expected: 'application/xml' },
      { input: 'json', expected: 'application/json' },
      { input: 'csv', expected: 'text/csv' },
      { input: 'txt', expected: 'text/plain' },
      { input: 'hl7', expected: 'x-application/hl7-v2+er7' },
      { input: 'cda', expected: 'application/xml' },
      { input: 'edf', expected: 'application/edf' },
      { input: 'nifti', expected: 'application/nifti' },
      { input: 'fasta', expected: 'text/x-fasta' },
      { input: 'vcf', expected: 'text/x-vcf' }
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should map ${input} to ${expected}`, () => {
        const result = detectAndMapDocumentType(input);
        expect(result.fhirContentType).toBe(expected);
        expect(result.mapped).toBe(true);
      });
    });
  });
});

