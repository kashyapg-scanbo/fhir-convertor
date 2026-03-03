# Quick Test Guide - Document Type Mapper

## ✅ Run the Quick Test

To verify that the document type mapper is working correctly, run:

```bash
npm test -- document-mapper-quick-test.test.ts
```

## What the Test Covers

The test verifies:

1. **10 Basic Format Conversions:**
   - ✅ PDF → `application/pdf`
   - ✅ DICOM → `application/dicom`
   - ✅ JPEG → `image/jpeg`
   - ✅ HL7 → `x-application/hl7-v2+er7`
   - ✅ CDA → `application/xml`
   - ✅ Filename extraction (`document.pdf`)
   - ✅ URL extension extraction (`https://example.com/scan.dcm`)
   - ✅ MIME type normalization (`application/pdf; charset=utf-8`)
   - ✅ CSV → `text/csv`
   - ✅ EDF → `application/edf`

2. **Document Attachment Mapping:**
   - ✅ Format field detection
   - ✅ URL extension detection
   - ✅ Legacy contentType conversion

3. **Full DocumentReference Integration:**
   - ✅ Complete end-to-end conversion
   - ✅ Multiple document types in one request
   - ✅ FHIR R5 compliant output

## Expected Output

When you run the test, you should see:

```
✓ tests/mappers/document-mapper-quick-test.test.ts  (3 tests) 7ms

🎉 ALL TESTS PASSED! Document mapper is working correctly! 🎉
```

## Test Your Own Document Types

You can test any legacy document type by modifying the test file or creating your own test:

```typescript
import { detectAndMapDocumentType } from '../../src/modules/mappers/documentType.mapper.js';

// Test any format
const result = detectAndMapDocumentType('your-format-here');
console.log(result.fhirContentType); // FHIR R5 contentType
```

## Supported Formats

The mapper supports **150+ document types**. See `DOCUMENT_TYPES_REFERENCE.md` for the complete list.

## Troubleshooting

If tests fail:
1. Make sure all dependencies are installed: `npm install`
2. Check that TypeScript compiles: `npx tsc --noEmit`
3. Verify the mapper file exists: `src/modules/mappers/documentType.mapper.ts`

