import crypto from 'crypto';
import groupTemplate from '../../shared/templates/group.json' with { type: 'json' };
import type { CanonicalGroup, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface GroupMapperArgs {
  groups?: CanonicalGroup[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapGroups({ groups, operation, registry, resolveRef }: GroupMapperArgs) {
  if (!groups || groups.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of groups) {
    const group = structuredClone(groupTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    group.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${group.id}`;
    group.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'Group',
      {
        identifier: source.id || source.identifier?.[0]?.value || group.id,
        id: group.id
      },
      fullUrl
    );

    group.active = source.active ?? undefined;
    group.type = source.type || undefined;
    group.membership = source.membership || undefined;
    group.code = source.code ? mapCodeableConcept(source.code) : undefined;
    group.name = source.name || undefined;
    group.description = source.description || undefined;
    group.quantity = source.quantity ?? undefined;
    group.managingEntity = source.managingEntity
      ? { reference: resolveAnyRef(resolveRef, managingEntityTypes, source.managingEntity) }
      : undefined;

    group.characteristic = source.characteristic?.length
      ? source.characteristic.map(characteristic => ({
          code: characteristic.code ? mapCodeableConcept(characteristic.code) : undefined,
          valueCodeableConcept: characteristic.valueCodeableConcept
            ? mapCodeableConcept(characteristic.valueCodeableConcept)
            : undefined,
          valueBoolean: characteristic.valueBoolean ?? undefined,
          valueQuantity: characteristic.valueQuantity
            ? mapQuantity(characteristic.valueQuantity)
            : undefined,
          valueRange: characteristic.valueRange
            ? {
                low: characteristic.valueRange.low,
                high: characteristic.valueRange.high
              }
            : undefined,
          valueReference: characteristic.valueReference
            ? { reference: normalizeReference(characteristic.valueReference) }
            : undefined,
          exclude: characteristic.exclude ?? undefined,
          period: characteristic.period ? { ...characteristic.period } : undefined
        }))
      : undefined;

    group.member = source.member?.length
      ? source.member.map(member => ({
          entity: member.entity
            ? { reference: resolveAnyRef(resolveRef, memberEntityTypes, member.entity) }
            : undefined,
          period: member.period ? { ...member.period } : undefined,
          inactive: member.inactive ?? undefined
        }))
      : undefined;

    const summary = group.name || group.code?.text || group.id;
    if (summary) group.text = makeNarrative('Group', summary);

    if (operation === 'delete') {
      group.active = false;
    }

    const entry: any = {
      resource: group,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Group?identifier=${identifierSystem}|${identifierValue || group.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Group/${group.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}

const managingEntityTypes = [
  'Organization',
  'Practitioner',
  'PractitionerRole',
  'RelatedPerson'
];

const memberEntityTypes = [
  'CareTeam',
  'Device',
  'Group',
  'HealthcareService',
  'Location',
  'Organization',
  'Patient',
  'Practitioner',
  'PractitionerRole',
  'RelatedPerson',
  'Specimen'
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

function mapQuantity(source?: { value?: number; unit?: string; system?: string; code?: string }) {
  if (!source) return undefined;
  return {
    value: source.value,
    unit: source.unit,
    system: source.system,
    code: source.code
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
  allowed: string[],
  value: string
) {
  if (!value) return value;
  const normalized = normalizeReference(value);
  const [type, id] = normalized.split('/');
  if (id && allowed.includes(type)) {
    return resolveRef(type, id) || normalized;
  }
  for (const resourceType of allowed) {
    const resolved = resolveRef(resourceType, value);
    if (resolved) return resolved;
  }
  return normalized;
}

function normalizeReference(value: string) {
  return value.trim().replace(/^#/, '');
}
