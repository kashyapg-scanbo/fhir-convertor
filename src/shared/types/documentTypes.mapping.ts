/**
 * Global Healthcare Legacy Document Types → FHIR R5 contentType Mapping
 * 
 * This mapping provides comprehensive coverage of legacy document formats
 * commonly used in global healthcare systems for conversion to FHIR R5.
 * 
 * Reference: FHIR R5 DocumentReference.content.attachment.contentType
 * Standard: RFC 2046 (MIME types)
 */

export interface DocumentTypeMapping {
  /** Legacy format identifier (file extension or format name) */
  legacy: string;
  /** FHIR R5 compliant MIME type */
  fhirContentType: string;
  /** Description of the format */
  description: string;
  /** Category: document, image, video, audio, structured-data, etc. */
  category: string;
}

/**
 * Comprehensive mapping of legacy healthcare document types to FHIR R5 contentTypes
 */
export const LEGACY_TO_FHIR_DOCUMENT_TYPE_MAPPING: DocumentTypeMapping[] = [
  // ============================================
  // DOCUMENT FORMATS
  // ============================================
  {
    legacy: 'pdf',
    fhirContentType: 'application/pdf',
    description: 'Portable Document Format',
    category: 'document'
  },
  {
    legacy: 'doc',
    fhirContentType: 'application/msword',
    description: 'Microsoft Word Document (legacy)',
    category: 'document'
  },
  {
    legacy: 'docx',
    fhirContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    description: 'Microsoft Word Document (OpenXML)',
    category: 'document'
  },
  {
    legacy: 'rtf',
    fhirContentType: 'application/rtf',
    description: 'Rich Text Format',
    category: 'document'
  },
  {
    legacy: 'odt',
    fhirContentType: 'application/vnd.oasis.opendocument.text',
    description: 'OpenDocument Text',
    category: 'document'
  },
  {
    legacy: 'txt',
    fhirContentType: 'text/plain',
    description: 'Plain Text',
    category: 'document'
  },
  {
    legacy: 'html',
    fhirContentType: 'text/html',
    description: 'HyperText Markup Language',
    category: 'document'
  },
  {
    legacy: 'htm',
    fhirContentType: 'text/html',
    description: 'HyperText Markup Language',
    category: 'document'
  },

  // ============================================
  // MEDICAL IMAGING FORMATS (DICOM & Others)
  // ============================================
  {
    legacy: 'dicom',
    fhirContentType: 'application/dicom',
    description: 'Digital Imaging and Communications in Medicine',
    category: 'medical-imaging'
  },
  {
    legacy: 'dcm',
    fhirContentType: 'application/dicom',
    description: 'DICOM file extension',
    category: 'medical-imaging'
  },
  {
    legacy: 'dcm30',
    fhirContentType: 'application/dicom',
    description: 'DICOM Part 10 file',
    category: 'medical-imaging'
  },
  {
    legacy: 'nifti',
    fhirContentType: 'application/nifti',
    description: 'Neuroimaging Informatics Technology Initiative',
    category: 'medical-imaging'
  },
  {
    legacy: 'nii',
    fhirContentType: 'application/nifti',
    description: 'NIfTI file extension',
    category: 'medical-imaging'
  },
  {
    legacy: 'nrrd',
    fhirContentType: 'application/nrrd',
    description: 'Nearly Raw Raster Data',
    category: 'medical-imaging'
  },
  {
    legacy: 'mhd',
    fhirContentType: 'application/x-mhd',
    description: 'MetaImage Header Data',
    category: 'medical-imaging'
  },
  {
    legacy: 'mha',
    fhirContentType: 'application/x-mha',
    description: 'MetaImage Header and Data',
    category: 'medical-imaging'
  },

  // ============================================
  // STANDARD IMAGE FORMATS
  // ============================================
  {
    legacy: 'jpeg',
    fhirContentType: 'image/jpeg',
    description: 'JPEG Image',
    category: 'image'
  },
  {
    legacy: 'jpg',
    fhirContentType: 'image/jpeg',
    description: 'JPEG Image',
    category: 'image'
  },
  {
    legacy: 'png',
    fhirContentType: 'image/png',
    description: 'Portable Network Graphics',
    category: 'image'
  },
  {
    legacy: 'gif',
    fhirContentType: 'image/gif',
    description: 'Graphics Interchange Format',
    category: 'image'
  },
  {
    legacy: 'bmp',
    fhirContentType: 'image/bmp',
    description: 'Bitmap Image',
    category: 'image'
  },
  {
    legacy: 'tiff',
    fhirContentType: 'image/tiff',
    description: 'Tagged Image File Format',
    category: 'image'
  },
  {
    legacy: 'tif',
    fhirContentType: 'image/tiff',
    description: 'Tagged Image File Format',
    category: 'image'
  },
  {
    legacy: 'svg',
    fhirContentType: 'image/svg+xml',
    description: 'Scalable Vector Graphics',
    category: 'image'
  },
  {
    legacy: 'webp',
    fhirContentType: 'image/webp',
    description: 'WebP Image',
    category: 'image'
  },
  {
    legacy: 'ico',
    fhirContentType: 'image/x-icon',
    description: 'Icon Image',
    category: 'image'
  },

  // ============================================
  // VIDEO FORMATS
  // ============================================
  {
    legacy: 'mp4',
    fhirContentType: 'video/mp4',
    description: 'MPEG-4 Video',
    category: 'video'
  },
  {
    legacy: 'avi',
    fhirContentType: 'video/x-msvideo',
    description: 'Audio Video Interleave',
    category: 'video'
  },
  {
    legacy: 'mov',
    fhirContentType: 'video/quicktime',
    description: 'QuickTime Video',
    category: 'video'
  },
  {
    legacy: 'wmv',
    fhirContentType: 'video/x-ms-wmv',
    description: 'Windows Media Video',
    category: 'video'
  },
  {
    legacy: 'flv',
    fhirContentType: 'video/x-flv',
    description: 'Flash Video',
    category: 'video'
  },
  {
    legacy: 'webm',
    fhirContentType: 'video/webm',
    description: 'WebM Video',
    category: 'video'
  },
  {
    legacy: 'mkv',
    fhirContentType: 'video/x-matroska',
    description: 'Matroska Video',
    category: 'video'
  },
  {
    legacy: 'mpeg',
    fhirContentType: 'video/mpeg',
    description: 'MPEG Video',
    category: 'video'
  },
  {
    legacy: 'mpg',
    fhirContentType: 'video/mpeg',
    description: 'MPEG Video',
    category: 'video'
  },
  {
    legacy: '3gp',
    fhirContentType: 'video/3gpp',
    description: '3GPP Video',
    category: 'video'
  },

  // ============================================
  // AUDIO FORMATS
  // ============================================
  {
    legacy: 'mp3',
    fhirContentType: 'audio/mpeg',
    description: 'MPEG Audio Layer 3',
    category: 'audio'
  },
  {
    legacy: 'wav',
    fhirContentType: 'audio/wav',
    description: 'Waveform Audio',
    category: 'audio'
  },
  {
    legacy: 'wma',
    fhirContentType: 'audio/x-ms-wma',
    description: 'Windows Media Audio',
    category: 'audio'
  },
  {
    legacy: 'aac',
    fhirContentType: 'audio/aac',
    description: 'Advanced Audio Coding',
    category: 'audio'
  },
  {
    legacy: 'ogg',
    fhirContentType: 'audio/ogg',
    description: 'Ogg Vorbis Audio',
    category: 'audio'
  },
  {
    legacy: 'flac',
    fhirContentType: 'audio/flac',
    description: 'Free Lossless Audio Codec',
    category: 'audio'
  },
  {
    legacy: 'm4a',
    fhirContentType: 'audio/mp4',
    description: 'MPEG-4 Audio',
    category: 'audio'
  },

  // ============================================
  // STRUCTURED DATA FORMATS (HL7, CDA, etc.)
  // ============================================
  {
    legacy: 'hl7',
    fhirContentType: 'x-application/hl7-v2+er7',
    description: 'HL7 Version 2 Message',
    category: 'structured-data'
  },
  {
    legacy: 'hl7v2',
    fhirContentType: 'x-application/hl7-v2+er7',
    description: 'HL7 Version 2 Message',
    category: 'structured-data'
  },
  {
    legacy: 'cda',
    fhirContentType: 'application/xml',
    description: 'HL7 Clinical Document Architecture',
    category: 'structured-data'
  },
  {
    legacy: 'ccda',
    fhirContentType: 'application/xml',
    description: 'HL7 Consolidated CDA',
    category: 'structured-data'
  },
  {
    legacy: 'xml',
    fhirContentType: 'application/xml',
    description: 'Extensible Markup Language',
    category: 'structured-data'
  },
  {
    legacy: 'xhtml',
    fhirContentType: 'application/xhtml+xml',
    description: 'Extensible HyperText Markup Language',
    category: 'structured-data'
  },
  {
    legacy: 'json',
    fhirContentType: 'application/json',
    description: 'JavaScript Object Notation',
    category: 'structured-data'
  },
  {
    legacy: 'jsonld',
    fhirContentType: 'application/ld+json',
    description: 'JSON-LD (Linked Data)',
    category: 'structured-data'
  },
  {
    legacy: 'csv',
    fhirContentType: 'text/csv',
    description: 'Comma-Separated Values',
    category: 'structured-data'
  },
  {
    legacy: 'tsv',
    fhirContentType: 'text/tab-separated-values',
    description: 'Tab-Separated Values',
    category: 'structured-data'
  },
  {
    legacy: 'xls',
    fhirContentType: 'application/vnd.ms-excel',
    description: 'Microsoft Excel Spreadsheet (legacy)',
    category: 'structured-data'
  },
  {
    legacy: 'xlsx',
    fhirContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    description: 'Microsoft Excel Spreadsheet (OpenXML)',
    category: 'structured-data'
  },
  {
    legacy: 'ods',
    fhirContentType: 'application/vnd.oasis.opendocument.spreadsheet',
    description: 'OpenDocument Spreadsheet',
    category: 'structured-data'
  },

  // ============================================
  // ARCHIVE/COMPRESSION FORMATS
  // ============================================
  {
    legacy: 'zip',
    fhirContentType: 'application/zip',
    description: 'ZIP Archive',
    category: 'archive'
  },
  {
    legacy: 'rar',
    fhirContentType: 'application/x-rar-compressed',
    description: 'RAR Archive',
    category: 'archive'
  },
  {
    legacy: '7z',
    fhirContentType: 'application/x-7z-compressed',
    description: '7-Zip Archive',
    category: 'archive'
  },
  {
    legacy: 'tar',
    fhirContentType: 'application/x-tar',
    description: 'TAR Archive',
    category: 'archive'
  },
  {
    legacy: 'gz',
    fhirContentType: 'application/gzip',
    description: 'GZIP Compressed',
    category: 'archive'
  },
  {
    legacy: 'bz2',
    fhirContentType: 'application/x-bzip2',
    description: 'BZIP2 Compressed',
    category: 'archive'
  },

  // ============================================
  // PRESENTATION FORMATS
  // ============================================
  {
    legacy: 'ppt',
    fhirContentType: 'application/vnd.ms-powerpoint',
    description: 'Microsoft PowerPoint (legacy)',
    category: 'presentation'
  },
  {
    legacy: 'pptx',
    fhirContentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    description: 'Microsoft PowerPoint (OpenXML)',
    category: 'presentation'
  },
  {
    legacy: 'odp',
    fhirContentType: 'application/vnd.oasis.opendocument.presentation',
    description: 'OpenDocument Presentation',
    category: 'presentation'
  },

  // ============================================
  // SPECIALIZED HEALTHCARE FORMATS
  // ============================================
  {
    legacy: 'edf',
    fhirContentType: 'application/edf',
    description: 'European Data Format (EEG/ECG)',
    category: 'medical-data'
  },
  {
    legacy: 'edf+',
    fhirContentType: 'application/edf',
    description: 'European Data Format Plus',
    category: 'medical-data'
  },
  {
    legacy: 'bdf',
    fhirContentType: 'application/bdf',
    description: 'Biosemi Data Format',
    category: 'medical-data'
  },
  {
    legacy: 'hl7aecg',
    fhirContentType: 'application/x-hl7-aecg+xml',
    description: 'HL7 Annotated ECG',
    category: 'medical-data'
  },
  {
    legacy: 'scp-ecg',
    fhirContentType: 'application/x-scp-ecg',
    description: 'Standard Communications Protocol for Computer-assisted Electrocardiography',
    category: 'medical-data'
  },
  {
    legacy: 'wfdb',
    fhirContentType: 'application/x-wfdb',
    description: 'Waveform Database Format',
    category: 'medical-data'
  },
  {
    legacy: 'xdf',
    fhirContentType: 'application/x-xdf',
    description: 'eXtensible Data Format',
    category: 'medical-data'
  },
  {
    legacy: 'mxml',
    fhirContentType: 'application/x-musicxml+xml',
    description: 'MusicXML (sometimes used for medical waveforms)',
    category: 'medical-data'
  },

  // ============================================
  // GENOMICS/BIOINFORMATICS FORMATS
  // ============================================
  {
    legacy: 'fasta',
    fhirContentType: 'text/x-fasta',
    description: 'FASTA Sequence Format',
    category: 'genomics'
  },
  {
    legacy: 'fastq',
    fhirContentType: 'text/x-fastq',
    description: 'FASTQ Sequence Format',
    category: 'genomics'
  },
  {
    legacy: 'sam',
    fhirContentType: 'text/x-sam',
    description: 'Sequence Alignment/Map Format',
    category: 'genomics'
  },
  {
    legacy: 'bam',
    fhirContentType: 'application/x-bam',
    description: 'Binary Alignment/Map Format',
    category: 'genomics'
  },
  {
    legacy: 'vcf',
    fhirContentType: 'text/x-vcf',
    description: 'Variant Call Format',
    category: 'genomics'
  },
  {
    legacy: 'gff',
    fhirContentType: 'text/x-gff3',
    description: 'General Feature Format',
    category: 'genomics'
  },
  {
    legacy: 'gff3',
    fhirContentType: 'text/x-gff3',
    description: 'General Feature Format Version 3',
    category: 'genomics'
  },
  {
    legacy: 'bed',
    fhirContentType: 'text/x-bed',
    description: 'Browser Extensible Data Format',
    category: 'genomics'
  },
  {
    legacy: 'gtf',
    fhirContentType: 'text/x-gtf',
    description: 'Gene Transfer Format',
    category: 'genomics'
  },

  // ============================================
  // OTHER COMMON FORMATS
  // ============================================
  {
    legacy: 'ps',
    fhirContentType: 'application/postscript',
    description: 'PostScript',
    category: 'document'
  },
  {
    legacy: 'eps',
    fhirContentType: 'application/postscript',
    description: 'Encapsulated PostScript',
    category: 'document'
  },
  {
    legacy: 'epub',
    fhirContentType: 'application/epub+zip',
    description: 'Electronic Publication',
    category: 'document'
  },
  {
    legacy: 'mobi',
    fhirContentType: 'application/x-mobipocket-ebook',
    description: 'Mobipocket eBook',
    category: 'document'
  },
  {
    legacy: 'fb2',
    fhirContentType: 'application/x-fictionbook+xml',
    description: 'FictionBook eBook',
    category: 'document'
  }
];

/**
 * Lookup FHIR R5 contentType by legacy document type
 * @param legacyType - Legacy format identifier (e.g., 'pdf', 'dicom', 'jpeg')
 * @returns FHIR R5 contentType or undefined if not found
 */
export function getFhirContentType(legacyType: string): string | undefined {
  if (!legacyType) return undefined;
  
  const normalized = legacyType.toLowerCase().trim();
  
  // Direct lookup
  const mapping = LEGACY_TO_FHIR_DOCUMENT_TYPE_MAPPING.find(
    m => m.legacy === normalized
  );
  
  if (mapping) {
    return mapping.fhirContentType;
  }
  
  // Try with dot prefix removed (e.g., '.pdf' -> 'pdf')
  if (normalized.startsWith('.')) {
    const withoutDot = normalized.substring(1);
    const mappingWithoutDot = LEGACY_TO_FHIR_DOCUMENT_TYPE_MAPPING.find(
      m => m.legacy === withoutDot
    );
    if (mappingWithoutDot) {
      return mappingWithoutDot.fhirContentType;
    }
  }
  
  return undefined;
}

/**
 * Get all document types by category
 * @param category - Category filter (e.g., 'document', 'image', 'medical-imaging')
 * @returns Array of document type mappings
 */
export function getDocumentTypesByCategory(category: string): DocumentTypeMapping[] {
  return LEGACY_TO_FHIR_DOCUMENT_TYPE_MAPPING.filter(
    m => m.category === category
  );
}

/**
 * Get all available categories
 * @returns Array of unique category names
 */
export function getDocumentTypeCategories(): string[] {
  return Array.from(
    new Set(LEGACY_TO_FHIR_DOCUMENT_TYPE_MAPPING.map(m => m.category))
  ).sort();
}

/**
 * Check if a legacy document type is supported
 * @param legacyType - Legacy format identifier
 * @returns true if the type is in the mapping
 */
export function isLegacyTypeSupported(legacyType: string): boolean {
  return getFhirContentType(legacyType) !== undefined;
}

