import crypto from 'crypto';
import flagTemplate from '../../shared/templates/flag.json' with { type: 'json' };
import type { CanonicalFlag, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface FlagMapperArgs {
  flags?: CanonicalFlag[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapFlags({
  flags,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: FlagMapperArgs) {
  if (!flags || flags.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of flags) {
    const flag = structuredClone(flagTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    flag.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${flag.id}`;
    flag.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'Flag',
      {
        identifier: source.id || source.identifier?.[0]?.value || flag.id,
        id: flag.id
      },
      fullUrl
    );

    flag.status = source.status || undefined;
    flag.category = source.category?.length ? source.category.map(mapCodeableConcept).filter(Boolean) : undefined;
    flag.code = source.code ? mapCodeableConcept(source.code) : undefined;

    if (source.subject) {
      flag.subject = { reference: resolveSubjectRef(resolveRef, source.subject) };
    } else if (patientFullUrl) {
      flag.subject = { reference: patientFullUrl };
    } else {
      flag.subject = undefined;
    }

    flag.period = source.period ? { start: source.period.start, end: source.period.end } : undefined;

    if (source.encounter) {
      flag.encounter = { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` };
    } else if (encounterFullUrl) {
      flag.encounter = { reference: encounterFullUrl };
    } else {
      flag.encounter = undefined;
    }

    flag.author = source.author ? { reference: resolveAuthorRef(resolveRef, source.author) } : undefined;

    const summary = flag.code?.text || flag.status || flag.id;
    if (summary) flag.text = makeNarrative('Flag', summary);

    if (operation === 'delete') {
      flag.status = 'entered-in-error';
    }

    const entry: any = {
      resource: flag,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Flag?identifier=${identifierSystem}|${identifierValue || flag.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Flag/${flag.id}`
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

function mapIdentifier(source?: { system?: string; value?: string; type?: { system?: string; code?: string; display?: string } }) {
  if (!source || (!source.system && !source.value && !source.type)) return undefined;
  return {
    system: source.system,
    value: source.value,
    type: source.type ? mapCodeableConcept(source.type) : undefined
  };
}

function resolveSubjectRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Patient', id) ||
    resolveRef('Group', id) ||
    resolveRef('Location', id) ||
    resolveRef('Medication', id) ||
    resolveRef('Organization', id) ||
    resolveRef('PlanDefinition', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('Procedure', id) ||
    resolveRef('RelatedPerson', id) ||
    `Patient/${id}`
  );
}

function resolveAuthorRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Device', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('RelatedPerson', id) ||
    `Practitioner/${id}`
  );
}
