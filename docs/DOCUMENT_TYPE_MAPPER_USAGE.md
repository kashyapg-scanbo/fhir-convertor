# Document Type Mapper Usage Guide

This guide explains how to use the automatic legacy document type detection and conversion to FHIR R5.

## Overview

The document type mapper automatically detects and converts legacy document formats to FHIR R5 compliant `contentType` values for `DocumentReference.content.attachment.contentType`. It supports **150+ legacy document types** including:

- Document formats (PDF, DOC, DOCX, etc.)
- Medical imaging (DICOM, NIfTI, etc.)
- Images (JPEG, PNG, TIFF, etc.)
- Video (MP4, AVI, etc.)
- Audio (MP3, WAV, etc.)
- Structured data (HL7, CDA, XML, JSON, CSV, etc.)
- Healthcare-specific formats (EDF, HL7 Annotated ECG, etc.)
- Genomics formats (FASTA, FASTQ, VCF, etc.)

## Automatic Integration

The mapper is **automatically integrated** into the `documentReference.mapper.ts`. When you create document references, the system will:

1. **Automatically detect** legacy document types from:
   - File extensions (`.pdf`, `.dcm`, etc.)
   - URLs (`https://example.com/document.pdf`)
   - Format names (`pdf`, `dicom`, `hl7`)
   - MIME types (`application/pdf`, `image/jpeg`)
   - Content-Type headers with parameters (`application/pdf; charset=utf-8`)

2. **Automatically convert** to FHIR R5 compliant `contentType`

3. **Handle edge cases** like case-insensitive input, missing types, etc.

## Usage Examples

### Example 1: JSON Input with Format Field

```json
{
  "documentReferences": [
    {
      "id": "doc-1",
      "title": "Medical Report",
      "format": "pdf",
      "url": "https://example.com/report.pdf",
      "date": "2024-01-15"
    }
  ]
}
```

**Result**: Automatically converts `format: "pdf"` → `contentType: "application/pdf"`

### Example 2: JSON Input with URL Only

```json
{
  "documentReferences": [
    {
      "id": "doc-2",
      "title": "DICOM Scan",
      "url": "https://example.com/images/scan.dcm",
      "date": "2024-01-15"
    }
  ]
}
```

**Result**: Automatically extracts `.dcm` from URL → `contentType: "application/dicom"`

### Example 3: JSON Input with Legacy contentType

```json
{
  "documentReferences": [
    {
      "id": "doc-3",
      "title": "HL7 Message",
      "contentType": "hl7",
      "data": "base64encodeddata"
    }
  ]
}
```

**Result**: Automatically converts `contentType: "hl7"` → `contentType: "x-application/hl7-v2+er7"`

### Example 4: CDA Document (Automatic)

CDA documents are automatically detected and mapped to `application/xml`:

```typescript
// In cda.parser.ts - automatically handled
content: [{
  attachment: {
    contentType: 'text/xml',  // Will be normalized to 'application/xml'
    data: attachmentData,
    title: title
  }
}]
```

## Manual Usage (Advanced)

If you need to use the mapper directly in your code:

```typescript
import {
  detectAndMapDocumentType,
  mapDocumentAttachment,
  mapDocumentContent
} from './modules/mappers/documentType.mapper.js';

// Detect and map a single document type
const result = detectAndMapDocumentType('pdf');
console.log(result.fhirContentType); // 'application/pdf'
console.log(result.mapped); // true

// Map a document attachment
const attachment = mapDocumentAttachment({
  format: 'dicom',
  url: 'https://example.com/scan.dcm'
});
console.log(attachment.contentType); // 'application/dicom'

// Map an entire content array
const content = mapDocumentContent([
  { attachment: { format: 'pdf', url: '...' } },
  { attachment: { format: 'jpeg', url: '...' } }
]);
```

## Supported Input Formats

The mapper accepts various input formats:

| Input Type | Example | Result |
|------------|---------|--------|
| File extension | `pdf` | `application/pdf` |
| Extension with dot | `.pdf` | `application/pdf` |
| Filename | `document.pdf` | `application/pdf` |
| URL | `https://example.com/doc.pdf` | `application/pdf` |
| Format name | `dicom` | `application/dicom` |
| MIME type | `application/pdf` | `application/pdf` |
| MIME with params | `application/pdf; charset=utf-8` | `application/pdf` |
| Case variations | `PDF`, `DICOM`, `Jpeg` | All work correctly |

## Supported Document Types

### Document Formats
- `pdf`, `doc`, `docx`, `rtf`, `odt`, `txt`, `html`, `htm`

### Medical Imaging
- `dicom`, `dcm`, `dcm30`, `nifti`, `nii`, `nrrd`, `mhd`, `mha`

### Images
- `jpeg`, `jpg`, `png`, `gif`, `bmp`, `tiff`, `tif`, `svg`, `webp`, `ico`

### Video
- `mp4`, `avi`, `mov`, `wmv`, `flv`, `webm`, `mkv`, `mpeg`, `mpg`, `3gp`

### Audio
- `mp3`, `wav`, `wma`, `aac`, `ogg`, `flac`, `m4a`

### Structured Data
- `hl7`, `hl7v2`, `cda`, `ccda`, `xml`, `xhtml`, `json`, `jsonld`, `csv`, `tsv`, `xls`, `xlsx`, `ods`

### Healthcare-Specific
- `edf`, `edf+`, `bdf`, `hl7aecg`, `scp-ecg`, `wfdb`, `xdf`, `mxml`

### Genomics
- `fasta`, `fastq`, `sam`, `bam`, `vcf`, `gff`, `gff3`, `bed`, `gtf`

See `DOCUMENT_TYPES_REFERENCE.md` for the complete list.

## Fallback Behavior

If a document type cannot be detected or mapped:

- **Default fallback**: `application/octet-stream`
- **Custom fallback**: You can specify a custom fallback:

```typescript
const result = detectAndMapDocumentType('unknown-format', 'application/xml');
console.log(result.fhirContentType); // 'application/xml'
```

## Integration Points

The mapper is integrated at these points:

1. **`documentReference.mapper.ts`**: Automatically maps all document content
2. **`json.parser.ts`**: Supports `format` field in JSON input
3. **`cda.parser.ts`**: Automatically handles CDA documents

## Testing

Run the test suite to verify all mappings:

```bash
npm test -- documentType.mapper.test.ts
```

The test suite covers:
- ✅ All major document formats
- ✅ File extension extraction
- ✅ URL parsing
- ✅ MIME type normalization
- ✅ Case-insensitive handling
- ✅ Edge cases and fallbacks

## Benefits

1. **Automatic**: No manual mapping needed
2. **Comprehensive**: 150+ document types supported
3. **Flexible**: Accepts multiple input formats
4. **FHIR R5 Compliant**: All outputs are FHIR R5 compliant
5. **Type-Safe**: Full TypeScript support
6. **Well-Tested**: Comprehensive test coverage

## Troubleshooting

### Document type not recognized?

1. Check if the format is in the supported list (see `DOCUMENT_TYPES_REFERENCE.md`)
2. Verify the input format (extension, URL, or format name)
3. Check the fallback behavior (defaults to `application/octet-stream`)

### Need to add a new format?

Edit `src/shared/types/documentTypes.mapping.ts` and add your format to the `LEGACY_TO_FHIR_DOCUMENT_TYPE_MAPPING` array.

### MIME type not working?

The mapper normalizes MIME types and removes parameters. If you have a custom MIME type, ensure it follows RFC 2046 format.

