
import { CanonicalModel } from '../../shared/types/canonical.types.js';
import { getFhirContentType } from '../../shared/types/documentTypes.mapping.js';

/**
 * Parse binary/raw input (PDF, Images, etc.) into Canonical Model
 * Wraps the input in a DocumentReference
 */
export function parseBinary(input: string, format: string): CanonicalModel {
    // 1. Resolve content type
    const contentType = getFhirContentType(format) || 'application/octet-stream';

    // 2. Create canonical model with DocumentReference
    const model: CanonicalModel = {
        messageType: `BINARY-${format.toUpperCase()}`,
        patient: { name: {} },
        documentReferences: [{
            status: 'current',
            type: {
                coding: [{
                    system: 'http://loinc.org',
                    code: '68609-0', // Generic doc code
                    display: 'Summary document'
                }]
            },
            content: [{
                attachment: {
                    contentType: contentType,
                    data: input, // Assumes input is already Base64 encoded if binary
                    title: `Imported ${format.toUpperCase()} Document`,
                    format: format
                }
            }]
        }]
    };

    return model;
}
