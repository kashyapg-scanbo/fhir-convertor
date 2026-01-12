import crypto from 'crypto';
import carePlanTemplate from '../../shared/templates/carePlan.json' with { type: 'json' };
import type { CanonicalCarePlan, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface CarePlanMapperArgs {
  carePlans?: CanonicalCarePlan[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapCarePlans({
  carePlans,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: CarePlanMapperArgs) {
  if (!carePlans || carePlans.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of carePlans) {
    const carePlan = structuredClone(carePlanTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    carePlan.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${carePlan.id}`;
    carePlan.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'CarePlan',
      {
        identifier: source.id || source.identifier || carePlan.id,
        id: carePlan.id
      },
      fullUrl
    );

    carePlan.instantiatesCanonical = source.instantiatesCanonical?.length ? source.instantiatesCanonical : undefined;
    carePlan.instantiatesUri = source.instantiatesUri?.length ? source.instantiatesUri : undefined;
    carePlan.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({ reference: resolveRef('CarePlan', ref) || `CarePlan/${ref}` }))
      : undefined;
    carePlan.replaces = source.replaces?.length
      ? source.replaces.map(ref => ({ reference: resolveRef('CarePlan', ref) || `CarePlan/${ref}` }))
      : undefined;
    carePlan.partOf = source.partOf?.length
      ? source.partOf.map(ref => ({ reference: resolveRef('CarePlan', ref) || `CarePlan/${ref}` }))
      : undefined;

    carePlan.status = source.status || 'active';
    carePlan.intent = source.intent || 'plan';

    carePlan.category = source.category?.length
      ? source.category.map(cat => mapCodeableConcept(cat))
      : undefined;

    carePlan.title = source.title || undefined;
    carePlan.description = source.description || undefined;

    if (source.subject) {
      carePlan.subject = {
        reference: resolveSubjectRef(resolveRef, source.subject) || `Patient/${source.subject}`
      };
    } else if (patientFullUrl) {
      carePlan.subject = { reference: patientFullUrl };
    } else {
      carePlan.subject = undefined;
    }

    if (source.encounter) {
      carePlan.encounter = { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` };
    } else if (encounterFullUrl) {
      carePlan.encounter = { reference: encounterFullUrl };
    } else {
      carePlan.encounter = undefined;
    }

    carePlan.period = source.period
      ? { start: source.period.start, end: source.period.end }
      : undefined;

    carePlan.created = source.created || undefined;

    carePlan.custodian = source.custodian
      ? { reference: resolveCustodianRef(resolveRef, source.custodian) }
      : undefined;

    carePlan.contributor = source.contributor?.length
      ? source.contributor.map(ref => ({ reference: resolveContributorRef(resolveRef, ref) }))
      : undefined;

    carePlan.careTeam = source.careTeam?.length
      ? source.careTeam.map(ref => ({ reference: resolveRef('CareTeam', ref) || `CareTeam/${ref}` }))
      : undefined;

    carePlan.addresses = source.addresses?.length
      ? source.addresses.map(address => mapCodeableReference(resolveRef, address, 'Condition'))
      : undefined;

    carePlan.supportingInfo = source.supportingInfo?.length
      ? source.supportingInfo.map(ref => ({ reference: normalizeReference(resolveRef, ref) }))
      : undefined;

    carePlan.goal = source.goal?.length
      ? source.goal.map(ref => ({ reference: resolveRef('Goal', ref) || `Goal/${ref}` }))
      : undefined;

    carePlan.activity = source.activity?.length
      ? source.activity.map(activity => ({
        performedActivity: activity.performedActivity?.length
          ? activity.performedActivity.map(performed => mapCodeableReference(resolveRef, performed, 'Procedure'))
          : undefined,
        progress: activity.progress?.length
          ? activity.progress.map(text => ({ text }))
          : undefined,
        plannedActivityReference: activity.plannedActivityReference
          ? { reference: normalizeReference(resolveRef, activity.plannedActivityReference) }
          : undefined
      }))
      : undefined;

    carePlan.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    const summary = carePlan.title || carePlan.description || carePlan.id;
    if (summary) carePlan.text = makeNarrative('CarePlan', summary);

    if (operation === 'delete') {
      carePlan.status = 'entered-in-error';
    }

    const entry: any = {
      resource: carePlan,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `CarePlan?identifier=${identifierSystem}|${identifierValue || carePlan.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `CarePlan/${carePlan.id}`
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

function normalizeReference(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, value: string) {
  if (!value) return undefined;
  if (value.includes('/')) return value;
  return resolveRef('Resource', value) || value;
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

function resolveCustodianRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Organization', id) ||
    resolveRef('CareTeam', id) ||
    resolveRef('Patient', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('RelatedPerson', id) ||
    resolveRef('Device', id) ||
    `Organization/${id}`
  );
}

function resolveContributorRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('CareTeam', id) ||
    resolveRef('Device', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('RelatedPerson', id) ||
    `Organization/${id}`
  );
}
