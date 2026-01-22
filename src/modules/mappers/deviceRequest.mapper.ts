import crypto from 'crypto';
import deviceRequestTemplate from '../../shared/templates/deviceRequest.json' with { type: 'json' };
import type { CanonicalDeviceRequest, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface DeviceRequestMapperArgs {
  deviceRequests?: CanonicalDeviceRequest[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapDeviceRequests({
  deviceRequests,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: DeviceRequestMapperArgs) {
  if (!deviceRequests || deviceRequests.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of deviceRequests) {
    const request = structuredClone(deviceRequestTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    request.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${request.id}`;
    request.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'DeviceRequest',
      {
        identifier: source.id || source.identifier?.[0]?.value || request.id,
        id: request.id
      },
      fullUrl
    );

    request.instantiatesCanonical = source.instantiatesCanonical?.length ? source.instantiatesCanonical : undefined;
    request.instantiatesUri = source.instantiatesUri?.length ? source.instantiatesUri : undefined;
    request.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({ reference: resolveAnyRef(resolveRef, ['CarePlan', 'DeviceRequest'], ref) }))
      : undefined;
    request.replaces = source.replaces?.length
      ? source.replaces.map(ref => ({ reference: resolveRef('DeviceRequest', ref) || `DeviceRequest/${ref}` }))
      : undefined;

    request.groupIdentifier = source.groupIdentifier
      ? mapIdentifier(source.groupIdentifier)
      : undefined;

    request.status = source.status || 'active';
    request.intent = source.intent || 'order';
    request.priority = source.priority || undefined;
    request.doNotPerform = source.doNotPerform ?? undefined;

    if (source.codeCodeableConcept || source.codeReference) {
      request.code = {};
      if (source.codeCodeableConcept) {
        request.code.concept = mapCodeableConcept(source.codeCodeableConcept);
      }
      if (source.codeReference) {
        request.code.reference = {
          reference: resolveAnyRef(resolveRef, ['Device', 'DeviceDefinition'], source.codeReference)
        };
      }
    } else {
      request.code = undefined;
    }

    request.quantity = source.quantity !== undefined ? { value: source.quantity } : undefined;

    request.parameter = source.parameter?.length
      ? source.parameter.map(param => ({
        code: mapCodeableConcept(param.code),
        valueCodeableConcept: mapCodeableConcept(param.valueCodeableConcept),
        valueQuantity: param.valueQuantity ? {
          value: param.valueQuantity.value,
          unit: param.valueQuantity.unit,
          system: param.valueQuantity.system,
          code: param.valueQuantity.code
        } : undefined,
        valueBoolean: param.valueBoolean ?? undefined
      }))
      : undefined;

    if (source.subject) {
      request.subject = {
        reference: resolveAnyRef(resolveRef, ['Device', 'Group', 'Location', 'Patient'], source.subject)
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
      request.occurrenceTiming = undefined;
    } else if (source.occurrencePeriod) {
      request.occurrencePeriod = {
        start: source.occurrencePeriod.start,
        end: source.occurrencePeriod.end
      };
      request.occurrenceDateTime = undefined;
      request.occurrenceTiming = undefined;
    } else if (source.occurrenceTiming) {
      request.occurrenceTiming = { code: { text: source.occurrenceTiming } };
      request.occurrenceDateTime = undefined;
      request.occurrencePeriod = undefined;
    } else {
      request.occurrenceDateTime = undefined;
      request.occurrencePeriod = undefined;
      request.occurrenceTiming = undefined;
    }

    request.authoredOn = source.authoredOn || undefined;

    request.requester = source.requester
      ? { reference: resolveRequesterRef(resolveRef, source.requester) }
      : undefined;

    request.performer = source.performer
      ? { reference: resolvePerformerRef(resolveRef, source.performer) }
      : undefined;

    request.reason = source.reason?.length
      ? source.reason.map(ref => ({ reference: resolveReasonRef(resolveRef, ref) }))
      : undefined;

    request.asNeeded = source.asNeeded ?? undefined;
    request.asNeededFor = source.asNeededFor ? mapCodeableConcept(source.asNeededFor) : undefined;

    request.insurance = source.insurance?.length
      ? source.insurance.map(ref => ({ reference: resolveAnyRef(resolveRef, ['ClaimResponse', 'Coverage'], ref) }))
      : undefined;

    request.supportingInfo = source.supportingInfo?.length
      ? source.supportingInfo.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    request.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;

    request.relevantHistory = source.relevantHistory?.length
      ? source.relevantHistory.map(ref => ({ reference: resolveRef('Provenance', ref) || `Provenance/${ref}` }))
      : undefined;

    const summary = request.code?.concept?.text || request.id;
    if (summary) request.text = makeNarrative('DeviceRequest', summary);

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
        url: `DeviceRequest?identifier=${identifierSystem}|${identifierValue || request.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `DeviceRequest/${request.id}`
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

function resolveRequesterRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Device', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    `Practitioner/${id}`
  );
}

function resolvePerformerRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('CareTeam', id) ||
    resolveRef('Device', id) ||
    resolveRef('HealthcareService', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('RelatedPerson', id) ||
    `Practitioner/${id}`
  );
}

function resolveReasonRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Condition', id) ||
    resolveRef('DiagnosticReport', id) ||
    resolveRef('DocumentReference', id) ||
    resolveRef('Observation', id) ||
    `Condition/${id}`
  );
}

function normalizeReference(value: string) {
  if (!value) return undefined;
  return value;
}
