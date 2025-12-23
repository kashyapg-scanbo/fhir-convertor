import { parseHL7 } from '../parsers/hl7.parser.js';
import { buildCanonical } from '../builders/canonical.builder.js';
import { parseCDA } from '../parsers/cda.parser.js';
import { parseCustomJSON } from '../parsers/json.parser.js';
import { mapCanonicalToFHIR, FhirVersion } from '../mappers/fhir.mapper.js';
import { CanonicalModel } from '../../shared/types/canonical.types.js';
import { parseR4 } from '../parsers/r4.parser.js';
import { parseHL7v3 } from '../parsers/hl7v3.parser.js';
import { parseBinary } from '../parsers/binary.parser.js';
import { isLegacyTypeSupported } from '../../shared/types/documentTypes.mapping.js';
import { parseCsv } from '../parsers/csv.parser.js';
import { parseExcel } from '../parsers/excel.parser.js';

export type InputFormat = 'hl7v2' | 'cda' | 'json' | 'fhir-r4' | 'hl7v3' | 'csv' | 'xlsx' | 'xls' | string;

export type FhirOutputVersion = FhirVersion;

/**
 * Detect input format based on content
 */
export function detectInputFormat(input: string): InputFormat {
  const trimmed = input.trim();

  // CDA typically starts with XML declaration or <ClinicalDocument
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<ClinicalDocument') || trimmed.includes('<ClinicalDocument')) {
    return 'cda';
  }

  // R4 Detection
  if (trimmed.includes('"resourceType"')) {
    return 'fhir-r4';
  }

  // JSON typically starts with { or [
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }

  // CSV typically has commas and newlines with no XML/HL7 markers
  if (
    trimmed.includes(',') &&
    trimmed.includes('\n') &&
    !trimmed.startsWith('<') &&
    !trimmed.startsWith('MSH|') &&
    !trimmed.split('\n').some(line => line.trim().match(/^[A-Z]{2,4}\|/))
  ) {
    return 'csv';
  }

  // HL7 v3 (non-CDA) - usually has PRPA or other interaction IDs, and no ClinicalDocument
  if (trimmed.startsWith('<?xml') && !trimmed.includes('<ClinicalDocument') && trimmed.includes('urn:hl7-org:v3')) {
    return 'hl7v3';
  }

  // HL7 v2 typically starts with MSH|
  if (trimmed.startsWith('MSH|') || trimmed.split('\n').some(line => line.trim().match(/^[A-Z]{2,4}\|/))) {
    return 'hl7v2';
  }

  // Default to HL7v2 for backward compatibility
  return 'hl7v2';
}

/**
 * Convert legacy data (HL7v2, CDA, or JSON) to FHIR Bundle
 */
export async function convertLegacyData(
  input: string,
  format?: InputFormat,
  fhirVersion: FhirOutputVersion = 'r5'
): Promise<any> {
  const detectedFormat = format || detectInputFormat(input);

  console.log(detectedFormat, 'detectedFormat')
  let canonical: CanonicalModel;

  switch (detectedFormat) {
    case 'hl7v2':

      const parsed = parseHL7(input);
      canonical = buildCanonical(parsed);
      break;

    case 'cda':
      canonical = parseCDA(input);
      break;

    case 'json':
      canonical = parseCustomJSON(input);
      break;

    case 'fhir-r4':
      canonical = parseR4(input);
      break;

    case 'hl7v3':

      canonical = parseHL7v3(input);
      break;

    case 'csv':
      canonical = parseCsv(input);
      break;

    case 'xlsx':
    case 'xls':
      canonical = parseExcel(input);
      break;

    default:
      // Check if it's a supported binary/legacy type
      if (isLegacyTypeSupported(detectedFormat)) {
        canonical = parseBinary(input, detectedFormat);
      } else {
        throw new Error(`Unsupported input format: ${detectedFormat}`);
      }
  }

  return mapCanonicalToFHIR(canonical, fhirVersion);
}
