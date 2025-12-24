import crypto from 'crypto';
import documentReferenceTemplate from '../../shared/templates/documentReference.json' with { type: 'json' };
import type { CanonicalDocumentReference, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';
import { mapDocumentContent, mapDocumentAttachment } from './documentType.mapper.js';

interface DocumentReferenceMapperArgs {
  documentReferences?: CanonicalDocumentReference[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl: string;
}

export function mapDocumentReferences({
  documentReferences,
  operation,
  registry,
  resolveRef,
  patientFullUrl
}: DocumentReferenceMapperArgs) {
  if (!documentReferences || documentReferences.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < documentReferences.length; index++) {
    const source = documentReferences[index];
    const documentReference = structuredClone(documentReferenceTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    documentReference.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${documentReference.id}`;
    documentReference.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'DocumentReference',
      {
        identifier: source.id || source.identifier || documentReference.id,
        id: documentReference.id
      },
      fullUrl
    );

    documentReference.status = source.status || 'current';

    if (source.type) {
      documentReference.type = {
        coding: source.type.coding || []
      };
    } else {
      documentReference.type = undefined;
    }

    if (source.category) {
      documentReference.category = source.category.map((cat: any) => ({
        coding: cat.coding || []
      }));
    } else {
      documentReference.category = undefined;
    }

    if (source.subject) {
      documentReference.subject = {
        reference: resolveRef('Patient', source.subject) || `Patient/${source.subject}`
      };
    } else {
      documentReference.subject = { reference: patientFullUrl };
    }

    documentReference.date = source.date || undefined;
    if (source.description) {
      documentReference.text = makeNarrative('DocumentReference', source.description);
      documentReference.description = source.description;
    } else {
      documentReference.description = undefined;
    }

    if (source.author && source.author.length > 0) {
      documentReference.author = source.author.map((auth: string) => {
        if (auth.includes('Practitioner') || auth.includes('Organization')) {
          return { reference: auth };
        }
        const reference = resolveRef('Practitioner', auth) || resolveRef('Organization', auth);
        return { reference: reference || `Practitioner/${auth}` };
      });
    } else {
      documentReference.author = undefined;
    }

    if (source.custodian) {
      documentReference.custodian = {
        reference: resolveRef('Organization', source.custodian) || `Organization/${source.custodian}`
      };
    } else {
      documentReference.custodian = undefined;
    }

    // Map document content with automatic legacy type detection and conversion
    if (source.content) {
      // Use the document type mapper to automatically detect and convert legacy types
      // This handles legacy format detection from contentType, url, or format fields
      documentReference.content = mapDocumentContent(source.content);
    } else {
      documentReference.content = undefined;
    }

    if (source.context) {
      if (source.context.encounter) {
        documentReference.context = source.context.encounter.map((enc: string) => ({
          reference: resolveRef('Encounter', enc) || `Encounter/${enc}`
        }));
      }
      if (source.context.period) {
        documentReference.period = source.context.period;
      }
    } else {
      documentReference.context = undefined;
      documentReference.period = undefined;
    }

    if (operation === 'delete') {
      documentReference.status = 'superseded';
    }

    documentReference.version = undefined;
    documentReference.basedOn = undefined;
    documentReference.docStatus = undefined;
    documentReference.modality = undefined;
    documentReference.event = undefined;
    documentReference.bodySite = undefined;
    documentReference.facilityType = undefined;
    documentReference.practiceSetting = undefined;
    documentReference.attester = undefined;
    documentReference.relatesTo = undefined;
    documentReference.securityLabel = undefined;

    const entry: any = {
      resource: documentReference,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `DocumentReference?identifier=${identifierSystem}|${identifierValue || documentReference.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `DocumentReference/${identifierValue || documentReference.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
