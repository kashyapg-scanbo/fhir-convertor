# Unified Mapper Guide

## Overview

The **Unified Mapper** (`convertLegacyData`) is the main entry point that converts **ANY** legacy document format into FHIR R5. It handles multiple input formats and automatically detects/converts various document types within those formats.

## Key Answer to Your Question

**Q: Are legacy documents always in pipe data (HL7v2) or different types?**

**A: Legacy documents can come in THREE different input formats:**
1. **HL7v2** - Pipe-delimited text format (e.g., `MSH|^~\&|...`)
2. **CDA** - XML Clinical Document Architecture
3. **JSON** - Custom structured JSON format

**All three formats are converted to the same unified `CanonicalModel`, then to FHIR Bundle.**

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Input Formats                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐             │
│  │  HL7v2   │    │   CDA    │    │   JSON   │             │
│  │ (pipes)  │    │   (XML)  │    │          │             │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘             │
│       │              │               │                     │
│       └──────────────┼───────────────┘                     │
│                      │                                     │
│              ┌───────▼────────┐                           │
│              │   Parsers      │                           │
│              │  (parseHL7,    │                           │
│              │   parseCDA,    │                           │
│              │ parseCustomJSON)│                           │
│              └───────┬────────┘                           │
│                      │                                     │
│              ┌───────▼────────┐                           │
│              │ CanonicalModel │                           │
│              │  (Unified      │                           │
│              │   Structure)   │                           │
│              └───────┬────────┘                           │
│                      │                                     │
│              ┌───────▼────────┐                           │
│              │  FHIR Mapper   │                           │
│              │(mapCanonicalTo │                           │
│              │     FHIR)      │                           │
│              └───────┬────────┘                           │
│                      │                                     │
│              ┌───────▼────────┐                           │
│              │  FHIR R5 Bundle│                           │
│              └────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## Document Types Within Inputs

Regardless of the input format (HL7v2, CDA, or JSON), document references can contain **various document types**:

- **Documents**: PDF, DOC, DOCX, RTF, TXT
- **Medical Imaging**: DICOM, NIfTI, DICOMDIR
- **Images**: JPEG, PNG, TIFF, GIF, BMP
- **Video**: MP4, AVI, MOV, WMV
- **Audio**: MP3, WAV, OGG, AAC
- **Structured Data**: HL7, CDA, XML, JSON, CSV
- **Genomics**: FASTA, FASTQ, VCF, SAM
- **And 150+ other types** (automatically detected and converted)

## How It Works

### 1. Format Detection
The system automatically detects the input format:
- **HL7v2**: Starts with `MSH|` or contains pipe-delimited segments
- **CDA**: Starts with `<?xml` or contains `<ClinicalDocument>`
- **JSON**: Starts with `{` or `[`

### 2. Parsing
Each format has its own parser:
- `parseHL7()` - Parses HL7v2 pipe-delimited format
- `parseCDA()` - Parses XML CDA format
- `parseCustomJSON()` - Parses custom JSON structure

### 3. Canonical Model
All parsers convert to the same `CanonicalModel` structure:
```typescript
{
  patient: CanonicalPatient,
  encounter?: CanonicalEncounter,
  documentReferences?: CanonicalDocumentReference[],
  observations?: CanonicalObservation[],
  // ... other resources
}
```

### 4. Document Type Detection
When document references are processed:
- The `documentType.mapper` automatically detects document types from:
  - File extensions (`.pdf`, `.dcm`, etc.)
  - URLs (`https://example.com/document.pdf`)
  - Format names (`pdf`, `dicom`, `hl7`)
  - MIME types (`application/pdf`, `image/jpeg`)
  - Content-Type headers with parameters

### 5. FHIR Conversion
The `mapCanonicalToFHIR()` function converts the canonical model to FHIR R5 Bundle, with all document types properly mapped to FHIR-compliant `contentType` values.

## Usage Examples

### Example 1: HL7v2 with DICOM Document
```typescript
const hl7Input = `MSH|^~\&|RAD|HOSP|EHR|HOSP|202401011230||ORU^R01|MSG00002|P|2.5.1
PID|1||123456^^^HOSP^MR||DOE^JOHN||19800101|M
OBR|1||ORDER123|CTCHEST^CT Chest|||202401011100
OBX|1|ED|DICOM^DICOM Study||^DICOM^URI^https://example.com/images/ct-chest-scan.dcm`;

const bundle = await convertLegacyData(hl7Input);
// Automatically detects .dcm extension → converts to application/dicom
```

### Example 2: JSON with PDF Document
```typescript
const jsonInput = JSON.stringify({
  patient: {
    firstName: "John",
    lastName: "Doe"
  },
  documentReferences: [{
    format: 'pdf',  // Legacy format field
    url: 'https://example.com/report.pdf',
    date: '2024-01-15'
  }]
});

const bundle = await convertLegacyData(jsonInput, 'json');
// Automatically detects 'pdf' format → converts to application/pdf
```

### Example 3: CDA with Image Document
```typescript
const cdaInput = `<?xml version="1.0"?>
<ClinicalDocument>
  <!-- ... CDA content ... -->
  <documentReference>
    <url>https://example.com/xray.jpg</url>
  </documentReference>
</ClinicalDocument>`;

const bundle = await convertLegacyData(cdaInput);
// Automatically detects .jpg extension → converts to image/jpeg
```

## Key Functions

### Main Entry Point
```typescript
convertLegacyData(input: string, format?: InputFormat): Promise<FHIRBundle>
```

This is the **unified mapper** that handles all document types and formats.

### Format Detection
```typescript
detectInputFormat(input: string): InputFormat
```

Automatically detects the input format.

## Summary

- ✅ **Legacy documents are NOT always in pipe data** - they can be HL7v2, CDA, or JSON
- ✅ **All formats are converted to the same CanonicalModel** - unified structure
- ✅ **Document types are automatically detected** - 150+ types supported
- ✅ **One function handles everything** - `convertLegacyData()` is your overall mapper

The system is already designed as a unified mapper that can handle any type of document data and convert it to FHIR!









