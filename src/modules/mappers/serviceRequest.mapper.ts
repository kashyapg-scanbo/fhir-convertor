import crypto from 'crypto';
import serviceRequestTemplate from '../../shared/templates/serviceRequest.json' with { type: 'json' };
import type { CanonicalServiceRequest, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ServiceRequestMapperArgs {
  serviceRequests?: CanonicalServiceRequest[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapServiceRequests({
  serviceRequests,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: ServiceRequestMapperArgs) {
  if (!serviceRequests || serviceRequests.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of serviceRequests) {
    const request = structuredClone(serviceRequestTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    request.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${request.id}`;
    request.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'ServiceRequest',
      {
        identifier: source.id || source.identifier || request.id,
        id: request.id
      },
      fullUrl
    );

    request.instantiatesCanonical = source.instantiatesCanonical?.length ? source.instantiatesCanonical : undefined;
    request.instantiatesUri = source.instantiatesUri?.length ? source.instantiatesUri : undefined;
    request.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({ reference: resolveRef('ServiceRequest', ref) || `ServiceRequest/${ref}` }))
      : undefined;
    request.replaces = source.replaces?.length
      ? source.replaces.map(ref => ({ reference: resolveRef('ServiceRequest', ref) || `ServiceRequest/${ref}` }))
      : undefined;

    request.requisition = source.requisition
      ? { value: source.requisition }
      : undefined;

    request.status = source.status || 'active';
    request.intent = source.intent || 'order';

    request.category = source.category?.length
      ? source.category.map(cat => mapCodeableConcept(cat))
      : undefined;

    request.priority = source.priority || undefined;
    request.doNotPerform = source.doNotPerform ?? undefined;

    request.code = source.code
      ? {
        concept: {
          coding: [{
            system: source.code.system,
            code: source.code.code,
            display: source.code.display
          }],
          text: source.code.display
        }
      }
      : undefined;

    request.quantityQuantity = source.quantityString ? { value: source.quantityString } : undefined;

    if (source.subject) {
      request.subject = {
        reference: resolveSubjectRef(resolveRef, source.subject) || `Patient/${source.subject}`
      };
    } else if (patientFullUrl) {
      request.subject = { reference: patientFullUrl };
    } else {
      request.subject = undefined;
    }

    if (source.encounter) {
      request.encounter = {
        reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}`
      };
    } else if (encounterFullUrl) {
      request.encounter = { reference: encounterFullUrl };
    } else {
      request.encounter = undefined;
    }

    if (source.occurrenceDateTime) {
      request.occurrenceDateTime = source.occurrenceDateTime;
      request.occurrencePeriod = undefined;
    } else if (source.occurrencePeriod) {
      request.occurrencePeriod = {
        start: source.occurrencePeriod.start,
        end: source.occurrencePeriod.end
      };
      request.occurrenceDateTime = undefined;
    } else {
      request.occurrenceDateTime = undefined;
      request.occurrencePeriod = undefined;
    }

    request.asNeededBoolean = source.asNeededBoolean ?? undefined;
    request.authoredOn = source.authoredOn || undefined;

    request.requester = source.requester
      ? { reference: resolveRequesterRef(resolveRef, source.requester) }
      : undefined;

    request.performerType = source.performerType ? mapCodeableConcept(source.performerType) : undefined;

    request.performer = source.performer?.length
      ? source.performer.map(ref => ({ reference: resolvePerformerRef(resolveRef, ref) }))
      : undefined;

    request.location = source.location?.length
      ? source.location.map(ref => ({ reference: resolveRef('Location', ref) || `Location/${ref}` }))
      : undefined;

    request.reason = source.reason?.length
      ? source.reason.map(ref => ({ reference: resolveReasonRef(resolveRef, ref) }))
      : undefined;

    request.supportingInfo = source.supportingInfo?.length
      ? source.supportingInfo.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    request.specimen = source.specimen?.length
      ? source.specimen.map(ref => ({ reference: resolveRef('Specimen', ref) || `Specimen/${ref}` }))
      : undefined;

    request.bodySite = source.bodySite?.length
      ? source.bodySite.map(site => mapCodeableConcept(site))
      : undefined;

    request.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    request.patientInstruction = source.patientInstruction?.length
      ? source.patientInstruction.map(instruction => ({ instructionMarkdown: instruction }))
      : undefined;

    const summary = request.code?.concept?.text || request.id;
    if (summary) request.text = makeNarrative('ServiceRequest', summary);

    if (operation === 'delete') {
      request.status = 'entered-in-error';
    }

    const entry: any = {
      resource: request,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `ServiceRequest?identifier=${identifierSystem}|${identifierValue || request.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `ServiceRequest/${request.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}

function mapCodeableConcept(source?: { system?: string; code?: string; display?: string }) {
  if (!source) return undefined;
  return {
    coding: (source.system || source.code || source.display) ? [{
      system: source.system,
      code: source.code,
      display: source.display
    }] : undefined,
    text: source.display || source.code
  };
}

function resolveSubjectRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Patient', id) ||
    resolveRef('Group', id) ||
    resolveRef('Location', id) ||
    resolveRef('Device', id)
  );
}

function resolveRequesterRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('RelatedPerson', id) ||
    resolveRef('Device', id) ||
    `Practitioner/${id}`
  );
}

function resolvePerformerRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('CareTeam', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('RelatedPerson', id) ||
    resolveRef('Device', id) ||
    `Practitioner/${id}`
  );
}

function resolveReasonRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Condition', id) ||
    resolveRef('Observation', id) ||
    resolveRef('DiagnosticReport', id) ||
    resolveRef('DocumentReference', id) ||
    `Condition/${id}`
  );
}

function normalizeReference(value: string) {
  if (!value) return undefined;
  return { reference: value };
}
