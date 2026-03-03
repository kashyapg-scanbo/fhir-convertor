# Global Healthcare Legacy Document Types → FHIR R5 Mapping Reference

This document provides a comprehensive list of legacy document types commonly used in global healthcare systems and their corresponding FHIR R5 `contentType` mappings for `DocumentReference.content.attachment.contentType`.

Note: `contentType` is resolved dynamically at runtime based on the input (format name, file extension, URL, or MIME type). The mapper normalizes and converts to the correct FHIR value using `getFhirContentType`, with a fallback to `application/octet-stream` when unknown.

## Quick Reference Table

### Document Formats
| Legacy Format | FHIR R5 contentType | Description |
|--------------|---------------------|-------------|
| `pdf` | `application/pdf` | Portable Document Format |
| `doc` | `application/msword` | Microsoft Word Document (legacy) |
| `docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Microsoft Word Document (OpenXML) |
| `rtf` | `application/rtf` | Rich Text Format |
| `odt` | `application/vnd.oasis.opendocument.text` | OpenDocument Text |
| `txt` | `text/plain` | Plain Text |
| `html` / `htm` | `text/html` | HyperText Markup Language |

### Medical Imaging Formats
| Legacy Format | FHIR R5 contentType | Description |
|--------------|---------------------|-------------|
| `dicom` / `dcm` / `dcm30` | `application/dicom` | Digital Imaging and Communications in Medicine |
| `nifti` / `nii` | `application/nifti` | Neuroimaging Informatics Technology Initiative |
| `nrrd` | `application/nrrd` | Nearly Raw Raster Data |
| `mhd` | `application/x-mhd` | MetaImage Header Data |
| `mha` | `application/x-mha` | MetaImage Header and Data |

### Standard Image Formats
| Legacy Format | FHIR R5 contentType | Description |
|--------------|---------------------|-------------|
| `jpeg` / `jpg` | `image/jpeg` | JPEG Image |
| `png` | `image/png` | Portable Network Graphics |
| `gif` | `image/gif` | Graphics Interchange Format |
| `bmp` | `image/bmp` | Bitmap Image |
| `tiff` / `tif` | `image/tiff` | Tagged Image File Format |
| `svg` | `image/svg+xml` | Scalable Vector Graphics |
| `webp` | `image/webp` | WebP Image |
| `ico` | `image/x-icon` | Icon Image |

### Video Formats
| Legacy Format | FHIR R5 contentType | Description |
|--------------|---------------------|-------------|
| `mp4` | `video/mp4` | MPEG-4 Video |
| `avi` | `video/x-msvideo` | Audio Video Interleave |
| `mov` | `video/quicktime` | QuickTime Video |
| `wmv` | `video/x-ms-wmv` | Windows Media Video |
| `flv` | `video/x-flv` | Flash Video |
| `webm` | `video/webm` | WebM Video |
| `mkv` | `video/x-matroska` | Matroska Video |
| `mpeg` / `mpg` | `video/mpeg` | MPEG Video |
| `3gp` | `video/3gpp` | 3GPP Video |

### Audio Formats
| Legacy Format | FHIR R5 contentType | Description |
|--------------|---------------------|-------------|
| `mp3` | `audio/mpeg` | MPEG Audio Layer 3 |
| `wav` | `audio/wav` | Waveform Audio |
| `wma` | `audio/x-ms-wma` | Windows Media Audio |
| `aac` | `audio/aac` | Advanced Audio Coding |
| `ogg` | `audio/ogg` | Ogg Vorbis Audio |
| `flac` | `audio/flac` | Free Lossless Audio Codec |
| `m4a` | `audio/mp4` | MPEG-4 Audio |

### Structured Data Formats (HL7, CDA, etc.)
| Legacy Format | FHIR R5 contentType | Description |
|--------------|---------------------|-------------|
| `hl7` / `hl7v2` | `x-application/hl7-v2+er7` | HL7 Version 2 Message |
| `cda` | `application/xml` | HL7 Clinical Document Architecture |
| `ccda` | `application/xml` | HL7 Consolidated CDA |
| `xml` | `application/xml` | Extensible Markup Language |
| `xhtml` | `application/xhtml+xml` | Extensible HyperText Markup Language |
| `json` | `application/json` | JavaScript Object Notation |
| `jsonld` | `application/ld+json` | JSON-LD (Linked Data) |
| `csv` | `text/csv` | Comma-Separated Values |
| `tsv` | `text/tab-separated-values` | Tab-Separated Values |
| `xls` | `application/vnd.ms-excel` | Microsoft Excel Spreadsheet (legacy) |
| `xlsx` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | Microsoft Excel Spreadsheet (OpenXML) |
| `ods` | `application/vnd.oasis.opendocument.spreadsheet` | OpenDocument Spreadsheet |

### Archive/Compression Formats
| Legacy Format | FHIR R5 contentType | Description |
|--------------|---------------------|-------------|
| `zip` | `application/zip` | ZIP Archive |
| `rar` | `application/x-rar-compressed` | RAR Archive |
| `7z` | `application/x-7z-compressed` | 7-Zip Archive |
| `tar` | `application/x-tar` | TAR Archive |
| `gz` | `application/gzip` | GZIP Compressed |
| `bz2` | `application/x-bzip2` | BZIP2 Compressed |

### Presentation Formats
| Legacy Format | FHIR R5 contentType | Description |
|--------------|---------------------|-------------|
| `ppt` | `application/vnd.ms-powerpoint` | Microsoft PowerPoint (legacy) |
| `pptx` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | Microsoft PowerPoint (OpenXML) |
| `odp` | `application/vnd.oasis.opendocument.presentation` | OpenDocument Presentation |

### Specialized Healthcare Formats
| Legacy Format | FHIR R5 contentType | Description |
|--------------|---------------------|-------------|
| `edf` / `edf+` | `application/edf` | European Data Format (EEG/ECG) |
| `bdf` | `application/bdf` | Biosemi Data Format |
| `hl7aecg` | `application/x-hl7-aecg+xml` | HL7 Annotated ECG |
| `scp-ecg` | `application/x-scp-ecg` | Standard Communications Protocol for Computer-assisted Electrocardiography |
| `wfdb` | `application/x-wfdb` | Waveform Database Format |
| `xdf` | `application/x-xdf` | eXtensible Data Format |
| `mxml` | `application/x-musicxml+xml` | MusicXML (sometimes used for medical waveforms) |

### Genomics/Bioinformatics Formats
| Legacy Format | FHIR R5 contentType | Description |
|--------------|---------------------|-------------|
| `fasta` | `text/x-fasta` | FASTA Sequence Format |
| `fastq` | `text/x-fastq` | FASTQ Sequence Format |
| `sam` | `text/x-sam` | Sequence Alignment/Map Format |
| `bam` | `application/x-bam` | Binary Alignment/Map Format |
| `vcf` | `text/x-vcf` | Variant Call Format |
| `gff` / `gff3` | `text/x-gff3` | General Feature Format |
| `bed` | `text/x-bed` | Browser Extensible Data Format |
| `gtf` | `text/x-gtf` | Gene Transfer Format |

### Other Common Formats
| Legacy Format | FHIR R5 contentType | Description |
|--------------|---------------------|-------------|
| `ps` / `eps` | `application/postscript` | PostScript / Encapsulated PostScript |
| `epub` | `application/epub+zip` | Electronic Publication |
| `mobi` | `application/x-mobipocket-ebook` | Mobipocket eBook |
| `fb2` | `application/x-fictionbook+xml` | FictionBook eBook |

## Usage

The mapping is available as a TypeScript module at `src/shared/types/documentTypes.mapping.ts`:

```typescript
import { getFhirContentType, isLegacyTypeSupported } from './shared/types/documentTypes.mapping.js';

// Get FHIR contentType for a legacy format
const contentType = getFhirContentType('pdf'); // Returns: 'application/pdf'

// Check if a format is supported
if (isLegacyTypeSupported('dicom')) {
  // Handle DICOM document
}
```

## Categories

The document types are organized into the following categories:

- **document** - Standard document formats (PDF, Word, etc.)
- **medical-imaging** - Medical imaging formats (DICOM, NIfTI, etc.)
- **image** - Standard image formats (JPEG, PNG, etc.)
- **video** - Video formats
- **audio** - Audio formats
- **structured-data** - Structured data formats (HL7, CDA, JSON, etc.)
- **archive** - Archive/compression formats
- **presentation** - Presentation formats
- **medical-data** - Specialized healthcare data formats (ECG, EEG, etc.)
- **genomics** - Genomics/bioinformatics formats

## Total Count

**150+ legacy document types** mapped to FHIR R5 contentTypes, covering:
- Standard document formats
- Medical imaging (DICOM, NIfTI, etc.)
- Healthcare-specific formats (HL7, CDA, ECG, etc.)
- Genomics/bioinformatics formats
- Multimedia formats (images, video, audio)
- Structured data formats

## Notes

- All MIME types follow RFC 2046 standards
- FHIR R5 compliant contentTypes for `DocumentReference.content.attachment.contentType`
- Case-insensitive lookup (e.g., 'PDF', 'pdf', '.pdf' all work)
- Extensible - new formats can be added to the mapping array
