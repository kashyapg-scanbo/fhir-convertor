import crypto from 'crypto';
import communicationRequestTemplate from '../../shared/templates/communicationRequest.json' with { type: 'json' };
import type { CanonicalCommunicationRequest, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface CommunicationRequestMapperArgs {
  communicationRequests?: CanonicalCommunicationRequest[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapCommunicationRequests({
  communicationRequests,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: CommunicationRequestMapperArgs) {
  if (!communicationRequests || communicationRequests.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of communicationRequests) {
    const request = structuredClone(communicationRequestTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    request.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${request.id}`;
    request.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'CommunicationRequest',
      {
        identifier: source.id || source.identifier || request.id,
        id: request.id
      },
      fullUrl
    );

    request.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    request.replaces = source.replaces?.length
      ? source.replaces.map(ref => ({ reference: resolveRef('CommunicationRequest', ref) || `CommunicationRequest/${ref}` }))
      : undefined;

    request.groupIdentifier = source.groupIdentifier ? { value: source.groupIdentifier } : undefined;

    request.status = source.status || 'active';
    request.statusReason = source.statusReason ? mapCodeableConcept(source.statusReason) : undefined;
    request.intent = source.intent || 'order';

    request.category = source.category?.length
      ? source.category.map(cat => mapCodeableConcept(cat))
      : undefined;

    request.priority = source.priority || undefined;
    request.doNotPerform = source.doNotPerform ?? undefined;

    request.medium = source.medium?.length
      ? source.medium.map(med => mapCodeableConcept(med))
      : undefined;

    if (source.subject) {
      request.subject = { reference: resolveSubjectRef(resolveRef, source.subject) || `Patient/${source.subject}` };
    } else if (patientFullUrl) {
      request.subject = { reference: patientFullUrl };
    } else {
      request.subject = undefined;
    }

    request.about = source.about?.length
      ? source.about.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    if (source.encounter) {
      request.encounter = { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` };
    } else if (encounterFullUrl) {
      request.encounter = { reference: encounterFullUrl };
    } else {
      request.encounter = undefined;
    }

    request.payload = source.payload?.length
      ? source.payload.map(text => ({ contentCodeableConcept: { text } }))
      : undefined;

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

    request.authoredOn = source.authoredOn || undefined;

    request.requester = source.requester
      ? { reference: resolveRequesterRef(resolveRef, source.requester) }
      : undefined;

    request.recipient = source.recipient?.length
      ? source.recipient.map(ref => ({ reference: resolveRecipientRef(resolveRef, ref) }))
      : undefined;

    request.informationProvider = source.informationProvider?.length
      ? source.informationProvider.map(ref => ({ reference: resolveInformationProviderRef(resolveRef, ref) }))
      : undefined;

    request.reason = source.reason?.length
      ? source.reason.map(reason => ({ concept: { text: reason } }))
      : undefined;

    request.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    const summary = request.payload?.[0]?.contentCodeableConcept?.text || request.id;
    if (summary) request.text = makeNarrative('CommunicationRequest', summary);

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
        url: `CommunicationRequest?identifier=${identifierSystem}|${identifierValue || request.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `CommunicationRequest/${request.id}`
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

function normalizeReference(value: string) {
  if (!value) return value;
  return value.includes('/') ? value : value;
}

function resolveSubjectRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Patient', id) ||
    resolveRef('Group', id)
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

function resolveRecipientRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('CareTeam', id) ||
    resolveRef('Device', id) ||
    resolveRef('Endpoint', id) ||
    resolveRef('Group', id) ||
    resolveRef('HealthcareService', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('RelatedPerson', id) ||
    `Patient/${id}`
  );
}

function resolveInformationProviderRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Device', id) ||
    resolveRef('Endpoint', id) ||
    resolveRef('HealthcareService', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('RelatedPerson', id) ||
    `Practitioner/${id}`
  );
}
