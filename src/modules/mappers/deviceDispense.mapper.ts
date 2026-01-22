import crypto from 'crypto';
import deviceDispenseTemplate from '../../shared/templates/deviceDispense.json' with { type: 'json' };
import type { CanonicalDeviceDispense, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface DeviceDispenseMapperArgs {
  deviceDispenses?: CanonicalDeviceDispense[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapDeviceDispenses({
  deviceDispenses,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: DeviceDispenseMapperArgs) {
  if (!deviceDispenses || deviceDispenses.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of deviceDispenses) {
    const dispense = structuredClone(deviceDispenseTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    dispense.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${dispense.id}`;
    dispense.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'DeviceDispense',
      {
        identifier: source.id || source.identifier?.[0]?.value || dispense.id,
        id: dispense.id
      },
      fullUrl
    );

    dispense.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({ reference: resolveAnyRef(resolveRef, ['CarePlan', 'DeviceRequest'], ref) }))
      : undefined;
    dispense.partOf = source.partOf?.length
      ? source.partOf.map(ref => ({ reference: resolveRef('Procedure', ref) || `Procedure/${ref}` }))
      : undefined;
    dispense.status = source.status || undefined;
    dispense.statusReason = source.statusReason ? {
      concept: mapCodeableConcept(source.statusReason.concept),
      reference: source.statusReason.reference
        ? { reference: resolveRef('DetectedIssue', source.statusReason.reference) || `DetectedIssue/${source.statusReason.reference}` }
        : undefined
    } : undefined;
    dispense.category = source.category?.length ? source.category.map(mapCodeableConcept).filter(Boolean) : undefined;

    if (source.deviceCodeableConcept || source.deviceReference) {
      dispense.device = {};
      if (source.deviceCodeableConcept) {
        dispense.device.concept = mapCodeableConcept(source.deviceCodeableConcept);
      }
      if (source.deviceReference) {
        dispense.device.reference = {
          reference: resolveAnyRef(resolveRef, ['Device', 'DeviceDefinition'], source.deviceReference)
        };
      }
    } else {
      dispense.device = undefined;
    }

    if (source.subject) {
      dispense.subject = {
        reference: resolveAnyRef(resolveRef, ['Patient', 'Practitioner'], source.subject)
      };
    } else if (patientFullUrl) {
      dispense.subject = { reference: patientFullUrl };
    } else {
      dispense.subject = undefined;
    }

    if (source.encounter) {
      dispense.encounter = {
        reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}`
      };
    } else if (encounterFullUrl) {
      dispense.encounter = { reference: encounterFullUrl };
    } else {
      dispense.encounter = undefined;
    }

    dispense.receiver = source.receiver
      ? { reference: resolveAnyRef(resolveRef, ['Location', 'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], source.receiver) }
      : undefined;
    dispense.supportingInformation = source.supportingInformation?.length
      ? source.supportingInformation.map(ref => ({ reference: ref }))
      : undefined;
    dispense.performer = source.performer?.length
      ? source.performer.map(performer => ({
        function: performer.function ? mapCodeableConcept(performer.function) : undefined,
        actor: performer.actor ? { reference: resolveAnyRef(resolveRef, ['CareTeam', 'Device', 'Organization', 'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], performer.actor) } : undefined
      }))
      : undefined;
    dispense.location = source.location
      ? { reference: resolveRef('Location', source.location) || `Location/${source.location}` }
      : undefined;
    dispense.type = mapCodeableConcept(source.type);
    dispense.quantity = source.quantity ? {
      value: source.quantity.value,
      unit: source.quantity.unit,
      system: source.quantity.system,
      code: source.quantity.code
    } : undefined;
    dispense.preparedDate = source.preparedDate || undefined;
    dispense.whenHandedOver = source.whenHandedOver || undefined;
    dispense.destination = source.destination
      ? { reference: resolveRef('Location', source.destination) || `Location/${source.destination}` }
      : undefined;
    dispense.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;
    dispense.usageInstruction = source.usageInstruction || undefined;
    dispense.eventHistory = source.eventHistory?.length
      ? source.eventHistory.map(ref => ({ reference: resolveRef('Provenance', ref) || `Provenance/${ref}` }))
      : undefined;

    const summary = dispense.device?.concept?.text || dispense.id;
    if (summary) dispense.text = makeNarrative('DeviceDispense', summary);

    if (operation === 'delete') {
      dispense.status = 'entered-in-error';
    }

    const entry: any = {
      resource: dispense,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `DeviceDispense?identifier=${identifierSystem}|${identifierValue || dispense.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `DeviceDispense/${dispense.id}`
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
