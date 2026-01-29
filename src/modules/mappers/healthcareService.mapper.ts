import crypto from 'crypto';
import healthcareServiceTemplate from '../../shared/templates/healthcareService.json' with { type: 'json' };
import type { CanonicalHealthcareService, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface HealthcareServiceMapperArgs {
  healthcareServices?: CanonicalHealthcareService[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapHealthcareServices({
  healthcareServices,
  operation,
  registry,
  resolveRef
}: HealthcareServiceMapperArgs) {
  if (!healthcareServices || healthcareServices.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of healthcareServices) {
    const service = structuredClone(healthcareServiceTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    service.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${service.id}`;

    service.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'HealthcareService',
      { identifier: source.id || source.identifier?.[0]?.value || service.id, id: service.id },
      fullUrl
    );

    service.active = source.active ?? undefined;
    service.providedBy = source.providedBy
      ? { reference: resolveRef('Organization', source.providedBy) || normalizeReference(source.providedBy) }
      : undefined;
    service.offeredIn = source.offeredIn?.map(ref => ({ reference: normalizeReference(ref) }));
    service.category = source.category?.map(mapCodeableConcept);
    service.type = source.type?.map(mapCodeableConcept);
    service.specialty = source.specialty?.map(mapCodeableConcept);
    service.location = source.location?.map(ref => ({
      reference: resolveRef('Location', ref) || normalizeReference(ref)
    }));
    service.name = source.name || undefined;
    service.comment = source.comment || undefined;
    service.extraDetails = source.extraDetails || undefined;
    service.photo = source.photo ? mapAttachment(source.photo) : undefined;
    service.contact = source.contact?.map(contact => ({
      name: contact.name,
      telecom: contact.telecom
    }));
    service.coverageArea = source.coverageArea?.map(ref => ({
      reference: resolveRef('Location', ref) || normalizeReference(ref)
    }));
    service.serviceProvisionCode = source.serviceProvisionCode?.map(mapCodeableConcept);
    service.eligibility = source.eligibility?.map(item => ({
      code: item.code ? mapCodeableConcept(item.code) : undefined,
      comment: item.comment
    }));
    service.program = source.program?.map(mapCodeableConcept);
    service.characteristic = source.characteristic?.map(mapCodeableConcept);
    service.communication = source.communication?.map(mapCodeableConcept);
    service.referralMethod = source.referralMethod?.map(mapCodeableConcept);
    service.appointmentRequired = source.appointmentRequired ?? undefined;
    service.availability = source.availability?.map(item => ({
      daysOfWeek: item.daysOfWeek,
      availableStartTime: item.availableStartTime,
      availableEndTime: item.availableEndTime,
      allDay: item.allDay,
      available: item.available
    }));
    service.endpoint = source.endpoint?.map(ref => ({
      reference: resolveRef('Endpoint', ref) || normalizeReference(ref)
    }));

    const summary = service.name || service.id;
    if (summary) service.text = makeNarrative('HealthcareService', summary);

    if (operation === 'delete') {
      service.active = false;
    }

    const entry: any = { resource: service, fullUrl };
    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `HealthcareService?identifier=${identifierSystem}|${identifierValue || service.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = { method: 'PUT', url: `HealthcareService/${service.id}` };
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

function mapAttachment(source: { contentType?: string; url?: string; title?: string; data?: string }) {
  return {
    contentType: source.contentType,
    url: source.url,
    title: source.title,
    data: source.data
  };
}

function normalizeReference(value: string) {
  return value.trim().replace(/^#/, '');
}
