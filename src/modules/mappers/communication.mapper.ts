import crypto from 'crypto';
import communicationTemplate from '../../shared/templates/communication.json' with { type: 'json' };
import type { CanonicalCommunication, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface CommunicationMapperArgs {
  communications?: CanonicalCommunication[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapCommunications({
  communications,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: CommunicationMapperArgs) {
  if (!communications || communications.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of communications) {
    const communication = structuredClone(communicationTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    communication.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${communication.id}`;
    communication.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'Communication',
      {
        identifier: source.id || source.identifier || communication.id,
        id: communication.id
      },
      fullUrl
    );

    communication.instantiatesCanonical = source.instantiatesCanonical?.length ? source.instantiatesCanonical : undefined;
    communication.instantiatesUri = source.instantiatesUri?.length ? source.instantiatesUri : undefined;

    communication.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    communication.partOf = source.partOf?.length
      ? source.partOf.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    communication.inResponseTo = source.inResponseTo?.length
      ? source.inResponseTo.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    communication.status = source.status || 'completed';
    communication.statusReason = source.statusReason ? mapCodeableConcept(source.statusReason) : undefined;

    communication.category = source.category?.length
      ? source.category.map(cat => mapCodeableConcept(cat))
      : undefined;

    communication.priority = source.priority || undefined;

    communication.medium = source.medium?.length
      ? source.medium.map(med => mapCodeableConcept(med))
      : undefined;

    if (source.subject) {
      communication.subject = { reference: resolveSubjectRef(resolveRef, source.subject) || `Patient/${source.subject}` };
    } else if (patientFullUrl) {
      communication.subject = { reference: patientFullUrl };
    } else {
      communication.subject = undefined;
    }

    communication.topic = source.topic ? mapCodeableConcept(source.topic) : undefined;

    communication.about = source.about?.length
      ? source.about.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    if (source.encounter) {
      communication.encounter = { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` };
    } else if (encounterFullUrl) {
      communication.encounter = { reference: encounterFullUrl };
    } else {
      communication.encounter = undefined;
    }

    communication.sent = source.sent || undefined;
    communication.received = source.received || undefined;

    communication.recipient = source.recipient?.length
      ? source.recipient.map(ref => ({ reference: resolveRecipientRef(resolveRef, ref) }))
      : undefined;

    communication.sender = source.sender
      ? { reference: resolveSenderRef(resolveRef, source.sender) }
      : undefined;

    communication.reason = source.reason?.length
      ? source.reason.map(reason => ({ concept: { text: reason } }))
      : undefined;

    communication.payload = source.payload?.length
      ? source.payload.map(text => ({ contentCodeableConcept: { text } }))
      : undefined;

    communication.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    const summary = communication.topic?.text || communication.payload?.[0]?.contentCodeableConcept?.text || communication.id;
    if (summary) communication.text = makeNarrative('Communication', summary);

    if (operation === 'delete') {
      communication.status = 'entered-in-error';
    }

    const entry: any = {
      resource: communication,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Communication?identifier=${identifierSystem}|${identifierValue || communication.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Communication/${communication.id}`
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

function resolveRecipientRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('CareTeam', id) ||
    resolveRef('Device', id) ||
    resolveRef('Endpoint', id) ||
    resolveRef('Group', id) ||
    resolveRef('HealthcareService', id) ||
    resolveRef('Location', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('RelatedPerson', id) ||
    `Patient/${id}`
  );
}

function resolveSenderRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('CareTeam', id) ||
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
