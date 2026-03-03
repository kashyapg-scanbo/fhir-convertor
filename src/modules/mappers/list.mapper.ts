import crypto from 'crypto';
import listTemplate from '../../shared/templates/list.json' with { type: 'json' };
import type { CanonicalList, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ListMapperArgs {
  lists?: CanonicalList[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapLists({
  lists,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: ListMapperArgs) {
  if (!lists || lists.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of lists) {
    const list = structuredClone(listTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    list.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${list.id}`;
    list.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'List',
      {
        identifier: source.id || source.identifier?.[0]?.value || list.id,
        id: list.id
      },
      fullUrl
    );

    list.status = source.status || undefined;
    list.mode = source.mode || undefined;
    list.title = source.title || undefined;
    list.code = source.code ? mapCodeableConcept(source.code) : undefined;

    if (source.subject?.length) {
      list.subject = source.subject.map(ref => ({ reference: resolveAnyRef(resolveRef, subjectResourceTypes, ref) }));
    } else if (patientFullUrl) {
      list.subject = [{ reference: patientFullUrl }];
    } else {
      list.subject = undefined;
    }

    if (source.encounter) {
      list.encounter = { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` };
    } else if (encounterFullUrl) {
      list.encounter = { reference: encounterFullUrl };
    } else {
      list.encounter = undefined;
    }

    list.date = source.date || undefined;

    list.source = source.source
      ? { reference: resolveAnyRef(resolveRef, sourceResourceTypes, source.source) }
      : undefined;

    list.orderedBy = source.orderedBy ? mapCodeableConcept(source.orderedBy) : undefined;

    list.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;

    list.entry = source.entry?.length
      ? source.entry.map(entry => ({
          flag: entry.flag ? mapCodeableConcept(entry.flag) : undefined,
          deleted: entry.deleted ?? undefined,
          date: entry.date || undefined,
          item: entry.item ? { reference: normalizeReference(entry.item) } : undefined
        }))
      : undefined;

    list.emptyReason = source.emptyReason ? mapCodeableConcept(source.emptyReason) : undefined;

    const summary = list.title || list.code?.text || list.id;
    if (summary) list.text = makeNarrative('List', summary);

    if (operation === 'delete') {
      list.status = 'entered-in-error';
    }

    const entry: any = {
      resource: list,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `List?identifier=${identifierSystem}|${identifierValue || list.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `List/${list.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}

const subjectResourceTypes = [
  'Group',
  'Location',
  'Medication',
  'Organization',
  'Patient',
  'PlanDefinition',
  'Practitioner',
  'PractitionerRole',
  'Procedure',
  'RelatedPerson'
];

const sourceResourceTypes = [
  'CareTeam',
  'Device',
  'Organization',
  'Patient',
  'Practitioner',
  'PractitionerRole',
  'RelatedPerson'
];

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

function resolveAnyRef(
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined,
  resourceTypes: string[],
  value: string
) {
  if (!value) return undefined;
  if (value.includes('/')) return value;
  for (const resourceType of resourceTypes) {
    const resolved = resolveRef(resourceType, value);
    if (resolved) return resolved;
  }
  return resourceTypes.length > 0 ? `${resourceTypes[0]}/${value}` : value;
}

function normalizeReference(value: string) {
  if (!value) return value;
  return value.includes('/') ? value : value;
}
