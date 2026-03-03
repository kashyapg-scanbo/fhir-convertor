import crypto from 'crypto';
import careTeamTemplate from '../../shared/templates/careTeam.json' with { type: 'json' };
import type { CanonicalCareTeam, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface CareTeamMapperArgs {
  careTeams?: CanonicalCareTeam[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
}

export function mapCareTeams({
  careTeams,
  operation,
  registry,
  resolveRef,
  patientFullUrl
}: CareTeamMapperArgs) {
  if (!careTeams || careTeams.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of careTeams) {
    const careTeam = structuredClone(careTeamTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    careTeam.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${careTeam.id}`;
    careTeam.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'CareTeam',
      {
        identifier: source.id || source.identifier || careTeam.id,
        id: careTeam.id
      },
      fullUrl
    );

    careTeam.status = source.status || 'active';

    careTeam.category = source.category?.length
      ? source.category.map(cat => mapCodeableConcept(cat))
      : undefined;

    careTeam.name = source.name || undefined;

    if (source.subject) {
      careTeam.subject = {
        reference: resolveSubjectRef(resolveRef, source.subject) || `Patient/${source.subject}`
      };
    } else if (patientFullUrl) {
      careTeam.subject = { reference: patientFullUrl };
    } else {
      careTeam.subject = undefined;
    }

    careTeam.period = source.period
      ? { start: source.period.start, end: source.period.end }
      : undefined;

    careTeam.participant = source.participant?.length
      ? source.participant.map(participant => ({
        role: participant.role ? mapCodeableConcept(participant.role) : undefined,
        member: participant.member
          ? { reference: resolveParticipantRef(resolveRef, participant.member) }
          : undefined,
        onBehalfOf: participant.onBehalfOf
          ? { reference: resolveRef('Organization', participant.onBehalfOf) || `Organization/${participant.onBehalfOf}` }
          : undefined,
        coveragePeriod: participant.coveragePeriod
          ? { start: participant.coveragePeriod.start, end: participant.coveragePeriod.end }
          : undefined
      }))
      : undefined;

    careTeam.reason = source.reason?.length
      ? source.reason.map(reason => mapCodeableReference(resolveRef, reason, 'Condition'))
      : undefined;

    careTeam.managingOrganization = source.managingOrganization?.length
      ? source.managingOrganization.map(orgId => ({
        reference: resolveRef('Organization', orgId) || `Organization/${orgId}`
      }))
      : undefined;

    careTeam.telecom = source.telecom?.length
      ? source.telecom.map(contact => ({
        system: contact.system,
        value: contact.value,
        use: contact.use
      }))
      : undefined;

    careTeam.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    const summary = careTeam.name || careTeam.id;
    if (summary) careTeam.text = makeNarrative('CareTeam', summary);

    if (operation === 'delete') {
      careTeam.status = 'entered-in-error';
    }

    const entry: any = {
      resource: careTeam,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `CareTeam?identifier=${identifierSystem}|${identifierValue || careTeam.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `CareTeam/${careTeam.id}`
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

function mapCodeableReference(
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined,
  value: any,
  defaultType: string
) {
  if (!value) return undefined;
  if (typeof value === 'string') {
    if (value.includes('/')) return { reference: value };
    const resolved = resolveRef(defaultType, value);
    if (resolved) return { reference: resolved };
    return { concept: { text: value } };
  }

  const reference = value.reference
    ? resolveRef(defaultType, value.reference) || value.reference
    : undefined;
  const concept = value.code
    ? mapCodeableConcept(value.code)
    : undefined;

  return {
    reference,
    concept
  };
}

function resolveSubjectRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return resolveRef('Patient', id) || resolveRef('Group', id);
}

function resolveParticipantRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('CareTeam', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('RelatedPerson', id) ||
    `Practitioner/${id}`
  );
}
