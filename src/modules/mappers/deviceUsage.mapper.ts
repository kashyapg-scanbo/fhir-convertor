import crypto from 'crypto';
import deviceUsageTemplate from '../../shared/templates/deviceUsage.json' with { type: 'json' };
import type { CanonicalDeviceUsage, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface DeviceUsageMapperArgs {
  deviceUsages?: CanonicalDeviceUsage[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapDeviceUsages({
  deviceUsages,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: DeviceUsageMapperArgs) {
  if (!deviceUsages || deviceUsages.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of deviceUsages) {
    const usage = structuredClone(deviceUsageTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    usage.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${usage.id}`;
    usage.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'DeviceUsage',
      {
        identifier: source.id || source.identifier?.[0]?.value || usage.id,
        id: usage.id
      },
      fullUrl
    );

    usage.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({ reference: resolveRef('ServiceRequest', ref) || `ServiceRequest/${ref}` }))
      : undefined;
    usage.status = source.status || undefined;
    usage.category = source.category?.length ? source.category.map(mapCodeableConcept).filter(Boolean) : undefined;

    if (source.patient) {
      usage.patient = { reference: resolveRef('Patient', source.patient) || `Patient/${source.patient}` };
    } else if (patientFullUrl) {
      usage.patient = { reference: patientFullUrl };
    } else {
      usage.patient = undefined;
    }

    usage.derivedFrom = source.derivedFrom?.length
      ? source.derivedFrom.map(ref => ({ reference: resolveAnyRef(resolveRef, ['Claim', 'DocumentReference', 'Observation', 'Procedure', 'QuestionnaireResponse', 'ServiceRequest'], ref) }))
      : undefined;

    if (source.context) {
      usage.context = {
        reference: resolveAnyRef(resolveRef, ['Encounter', 'EpisodeOfCare'], source.context)
      };
    } else if (encounterFullUrl) {
      usage.context = { reference: encounterFullUrl };
    } else {
      usage.context = undefined;
    }

    if (source.timingDateTime) {
      usage.timingDateTime = source.timingDateTime;
      usage.timingPeriod = undefined;
      usage.timingTiming = undefined;
    } else if (source.timingPeriod) {
      usage.timingPeriod = {
        start: source.timingPeriod.start,
        end: source.timingPeriod.end
      };
      usage.timingDateTime = undefined;
      usage.timingTiming = undefined;
    } else if (source.timingTiming) {
      usage.timingTiming = { code: { text: source.timingTiming } };
      usage.timingDateTime = undefined;
      usage.timingPeriod = undefined;
    } else {
      usage.timingDateTime = undefined;
      usage.timingPeriod = undefined;
      usage.timingTiming = undefined;
    }

    usage.dateAsserted = source.dateAsserted || undefined;
    usage.usageStatus = mapCodeableConcept(source.usageStatus);
    usage.usageReason = source.usageReason?.length ? source.usageReason.map(mapCodeableConcept).filter(Boolean) : undefined;
    usage.adherence = source.adherence ? {
      code: mapCodeableConcept(source.adherence.code),
      reason: source.adherence.reason?.length ? source.adherence.reason.map(mapCodeableConcept).filter(Boolean) : undefined
    } : undefined;

    usage.informationSource = source.informationSource
      ? { reference: resolveInformationSourceRef(resolveRef, source.informationSource) }
      : undefined;

    if (source.deviceCodeableConcept || source.deviceReference) {
      usage.device = {};
      if (source.deviceCodeableConcept) {
        usage.device.concept = mapCodeableConcept(source.deviceCodeableConcept);
      }
      if (source.deviceReference) {
        usage.device.reference = {
          reference: resolveAnyRef(resolveRef, ['Device', 'DeviceDefinition'], source.deviceReference)
        };
      }
    } else {
      usage.device = undefined;
    }

    usage.reason = source.reason?.length
      ? source.reason.map(ref => ({ reference: resolveAnyRef(resolveRef, ['Condition', 'DiagnosticReport', 'DocumentReference', 'Observation', 'Procedure'], ref) }))
      : undefined;

    usage.bodySite = source.bodySite
      ? { reference: resolveRef('BodyStructure', source.bodySite) || `BodyStructure/${source.bodySite}` }
      : undefined;

    usage.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;

    const summary = usage.device?.concept?.text || usage.id;
    if (summary) usage.text = makeNarrative('DeviceUsage', summary);

    if (operation === 'delete') {
      usage.status = 'entered-in-error';
    }

    const entry: any = {
      resource: usage,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `DeviceUsage?identifier=${identifierSystem}|${identifierValue || usage.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `DeviceUsage/${usage.id}`
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

function resolveInformationSourceRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('RelatedPerson', id) ||
    `Practitioner/${id}`
  );
}
