/**
 * Document Type Mapper Utility
 * 
 * Automatically detects and converts legacy document types to FHIR R5 contentTypes
 * Supports various input formats: file extensions, URLs, MIME types, format names
 */

import { getFhirContentType, LEGACY_TO_FHIR_DOCUMENT_TYPE_MAPPING } from '../../shared/types/documentTypes.mapping.js';

export interface DocumentTypeDetectionResult {
  /** Detected legacy format (e.g., 'pdf', 'dicom') */
  legacyType?: string;
  /** FHIR R5 compliant contentType */
  fhirContentType: string;
  /** Whether the type was successfully mapped */
  mapped: boolean;
  /** Original input value */
  original: string;
}

/**
 * Extract file extension from a filename or URL
 */
function extractFileExtension(input: string): string | undefined {
  if (!input) return undefined;

  // Remove query parameters and fragments from URLs
  const cleanInput = input.split('?')[0].split('#')[0];

  // Extract extension (handle both .ext and ext formats)
  const match = cleanInput.match(/\.([a-z0-9]+)$/i);
  if (match) {
    return match[1].toLowerCase();
  }

  // If no extension found but input looks like a format name, return as-is
  if (/^[a-z0-9]+$/i.test(cleanInput)) {
    return cleanInput.toLowerCase();
  }

  return undefined;
}

/**
 * Detect if input is already a MIME type
 */
function isMimeType(input: string): boolean {
  if (!input) return false;
  
  const normalized = input.toLowerCase().trim();
  
  // Common MIME type patterns
  const mimePatterns = [
    /^[a-z]+\/[a-z0-9][a-z0-9_\.\-\+]*[a-z0-9]$/i,  // Standard: type/subtype
    /^[a-z]+\/[a-z0-9][a-z0-9_\.\-\+]*[a-z0-9]\+[a-z]+$/i,  // With suffix: type/subtype+suffix
    /^x-[a-z0-9][a-z0-9_\.\-\+]*[a-z0-9]\/[a-z0-9][a-z0-9_\.\-\+]*[a-z0-9]$/i,  // x- prefix
  ];

  return mimePatterns.some(pattern => pattern.test(normalized));
}

/**
 * Normalize MIME type to standard format
 */
function normalizeMimeType(mimeType: string): string {
  if (!mimeType) return mimeType;
  
  const normalized = mimeType.toLowerCase().trim();
  
  // Common MIME type corrections
  const corrections: Record<string, string> = {
    'text/xml': 'application/xml',
    'application/xml; charset=utf-8': 'application/xml',
    'application/json; charset=utf-8': 'application/json',
    'text/csv; charset=utf-8': 'text/csv',
  };

  // Remove charset and other parameters
  const baseMime = normalized.split(';')[0].trim();
  
  return corrections[baseMime] || baseMime;
}

/**
 * Detect document type from various input formats and convert to FHIR R5 contentType
 * 
 * Supports:
 * - File extensions: 'pdf', '.pdf', 'document.pdf'
 * - URLs: 'https://example.com/document.pdf'
 * - MIME types: 'application/pdf', 'image/jpeg'
 * - Format names: 'dicom', 'DICOM', 'hl7', 'cda'
 * - Content-Type headers: 'application/pdf; charset=utf-8'
 * 
 * @param input - Document type identifier (extension, URL, MIME type, or format name)
 * @param fallbackContentType - Optional fallback if detection fails (default: 'application/octet-stream')
 * @returns Detection result with FHIR R5 contentType
 */
export function detectAndMapDocumentType(
  input: string | undefined | null,
  fallbackContentType: string = 'application/octet-stream'
): DocumentTypeDetectionResult {
  // Handle null/undefined/empty
  if (!input || typeof input !== 'string' || input.trim() === '') {
    return {
      fhirContentType: fallbackContentType,
      mapped: false,
      original: input || ''
    };
  }

  const original = input.trim();
  const normalized = original.toLowerCase();

  // Case 1: Check if it's a MIME type (with or without parameters)
  // First, extract base MIME type (remove parameters like ; charset=utf-8)
  const baseMime = normalized.split(';')[0].trim();
  if (isMimeType(baseMime)) {
    const normalizedMime = normalizeMimeType(baseMime);
    
    // Check if it's already a FHIR-compliant MIME type
    // If it's in our mapping, use it; otherwise use as-is (might already be valid)
    const fromMapping = getFhirContentType(normalizedMime);
    if (fromMapping) {
      return {
        legacyType: normalizedMime,
        fhirContentType: fromMapping,
        mapped: true,
        original
      };
    }

    // Use the normalized MIME type directly (it might be a valid FHIR contentType)
    return {
      legacyType: normalizedMime,
      fhirContentType: normalizedMime,
      mapped: true,
      original
    };
  }

  // Case 2: Extract extension from filename or URL
  const extension = extractFileExtension(original);
  if (extension) {
    const fhirType = getFhirContentType(extension);
    if (fhirType) {
      return {
        legacyType: extension,
        fhirContentType: fhirType,
        mapped: true,
        original
      };
    }
  }

  // Case 3: Direct format name lookup (e.g., 'dicom', 'hl7', 'cda')
  const directLookup = getFhirContentType(normalized);
  if (directLookup) {
    return {
      legacyType: normalized,
      fhirContentType: directLookup,
      mapped: true,
      original
    };
  }

  // Case 4: Try without leading dot
  if (normalized.startsWith('.')) {
    const withoutDot = normalized.substring(1);
    const fhirType = getFhirContentType(withoutDot);
    if (fhirType) {
      return {
        legacyType: withoutDot,
        fhirContentType: fhirType,
        mapped: true,
        original
      };
    }
  }

  // Case 5: Fallback - return original or fallback
  return {
    fhirContentType: fallbackContentType,
    mapped: false,
    original
  };
}

/**
 * Map document content attachment to FHIR R5 format
 * Automatically detects and converts contentType if needed
 * 
 * @param attachment - Document attachment object (may have legacy contentType or format)
 * @param formatHint - Optional format hint (file extension, URL, or format name)
 * @returns FHIR R5 compliant attachment object
 */
export function mapDocumentAttachment(
  attachment: {
    contentType?: string;
    url?: string;
    title?: string;
    data?: string;
    format?: string; // Legacy format field
    [key: string]: any;
  },
  formatHint?: string
): {
  contentType: string;
  url?: string;
  title?: string;
  data?: string;
} {
  // Priority: formatHint > attachment.format > attachment.contentType > url extension
  const typeSource = formatHint || attachment.format || attachment.contentType || attachment.url;
  
  const detection = detectAndMapDocumentType(typeSource);
  
  const mappedAttachment: {
    contentType: string;
    url?: string;
    title?: string;
    data?: string;
  } = {
    contentType: detection.fhirContentType
  };

  if (attachment.url) {
    mappedAttachment.url = attachment.url;
  }

  if (attachment.title) {
    mappedAttachment.title = attachment.title;
  }

  if (attachment.data) {
    mappedAttachment.data = attachment.data;
  }

  return mappedAttachment;
}

/**
 * Map entire document content array to FHIR R5 format
 * 
 * @param content - Array of document content objects
 * @returns FHIR R5 compliant content array
 */
export function mapDocumentContent(
  content?: Array<{
    attachment?: {
      contentType?: string;
      url?: string;
      title?: string;
      data?: string;
      format?: string;
      [key: string]: any;
    };
    [key: string]: any;
  }>
): Array<{
  attachment: {
    contentType: string;
    url?: string;
    title?: string;
    data?: string;
  };
}> {
  if (!content || !Array.isArray(content) || content.length === 0) {
    return [];
  }

  return content.map(item => ({
    attachment: mapDocumentAttachment(item.attachment || {})
  }));
}

/**
 * Get document type information for a given input
 * Useful for debugging and logging
 */
export function getDocumentTypeInfo(input: string | undefined | null): {
  detected: DocumentTypeDetectionResult;
  allSupportedTypes: string[];
} {
  const detected = detectAndMapDocumentType(input);
  const allSupportedTypes = LEGACY_TO_FHIR_DOCUMENT_TYPE_MAPPING.map(m => m.legacy);

  return {
    detected,
    allSupportedTypes
  };
}

