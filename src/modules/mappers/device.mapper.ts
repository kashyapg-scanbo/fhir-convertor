import crypto from 'crypto';
import deviceTemplate from '../../shared/templates/device.json' with { type: 'json' };
import type { CanonicalDevice, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface DeviceMapperArgs {
  devices?: CanonicalDevice[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapDevices({
  devices,
  operation,
  registry,
  resolveRef
}: DeviceMapperArgs) {
  if (!devices || devices.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < devices.length; index++) {
    const source = devices[index];
    const device = structuredClone(deviceTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    device.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${device.id}`;

    device.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'Device',
      {
        identifier: source.id || source.identifier?.[0]?.value || device.id,
        id: device.id
      },
      fullUrl
    );

    device.displayName = source.displayName || undefined;
    device.definition = mapCodeableReference(source.definition, resolveRef, ['DeviceDefinition']);
    device.udiCarrier = source.udiCarrier?.length
      ? source.udiCarrier.map(udi => ({
        deviceIdentifier: udi.deviceIdentifier,
        issuer: udi.issuer,
        jurisdiction: udi.jurisdiction,
        carrierAIDC: udi.carrierAIDC,
        carrierHRF: udi.carrierHRF,
        entryType: udi.entryType
      }))
      : undefined;
    device.status = source.status || undefined;
    device.availabilityStatus = mapCodeableConcept(source.availabilityStatus);
    device.manufacturer = source.manufacturer || undefined;
    device.manufactureDate = source.manufactureDate || undefined;
    device.expirationDate = source.expirationDate || undefined;
    device.lotNumber = source.lotNumber || undefined;
    device.serialNumber = source.serialNumber || undefined;
    device.name = source.name?.length
      ? source.name.map(entry => ({
        value: entry.value,
        type: entry.type,
        display: entry.display ?? undefined
      }))
      : undefined;
    device.modelNumber = source.modelNumber || undefined;
    device.partNumber = source.partNumber || undefined;
    device.category = source.category?.length ? source.category.map(mapCodeableConcept).filter(Boolean) : undefined;
    device.type = source.type?.length ? source.type.map(mapCodeableConcept).filter(Boolean) : undefined;
    device.version = source.version?.length
      ? source.version.map(ver => ({
        type: mapCodeableConcept(ver.type),
        component: ver.component ? { system: ver.component.system, value: ver.component.value } : undefined,
        installDate: ver.installDate,
        value: ver.value
      }))
      : undefined;
    device.conformsTo = source.conformsTo?.length
      ? source.conformsTo.map(conf => ({
        category: mapCodeableConcept(conf.category),
        specification: mapCodeableConcept(conf.specification),
        version: conf.version
      }))
      : undefined;
    device.property = source.property?.length
      ? source.property.map(prop => ({
        type: mapCodeableConcept(prop.type),
        valueQuantity: mapQuantity(prop.valueQuantity),
        valueCodeableConcept: mapCodeableConcept(prop.valueCodeableConcept),
        valueString: prop.valueString,
        valueBoolean: prop.valueBoolean,
        valueInteger: prop.valueInteger,
        valueRange: prop.valueRange
          ? {
            low: prop.valueRange.low,
            high: prop.valueRange.high
          }
          : undefined,
        valueAttachment: prop.valueAttachment
          ? {
            contentType: prop.valueAttachment.contentType,
            url: prop.valueAttachment.url,
            title: prop.valueAttachment.title
          }
          : undefined
      }))
      : undefined;
    device.mode = mapCodeableConcept(source.mode);
    device.cycle = mapQuantity(source.cycle);
    device.duration = mapQuantity(source.duration);
    device.owner = source.owner
      ? { reference: resolveRef('Organization', source.owner) || `Organization/${source.owner}` }
      : undefined;
    device.contact = source.contact?.length
      ? source.contact.map(contact => ({
        system: contact.system,
        value: contact.value,
        use: contact.use
      }))
      : undefined;
    device.location = source.location
      ? { reference: resolveRef('Location', source.location) || `Location/${source.location}` }
      : undefined;
    device.url = source.url || undefined;
    device.endpoint = source.endpoint?.length
      ? source.endpoint.map(id => ({ reference: resolveRef('Endpoint', id) || `Endpoint/${id}` }))
      : undefined;
    device.gateway = source.gateway?.length
      ? source.gateway.map(entry => mapCodeableReference(entry, resolveRef, ['Device']))
      : undefined;
    device.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;
    device.safety = source.safety?.length ? source.safety.map(mapCodeableConcept).filter(Boolean) : undefined;
    device.parent = source.parent
      ? { reference: resolveRef('Device', source.parent) || `Device/${source.parent}` }
      : undefined;

    const summary = device.displayName || device.identifier?.[0]?.value || device.id;
    if (summary) device.text = makeNarrative('Device', summary);

    if (operation === 'delete') {
      device.status = 'entered-in-error';
    }

    const entry: any = {
      resource: device,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Device?identifier=${identifierSystem}|${identifierValue || device.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Device/${device.id}`
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

function mapQuantity(source?: { value?: number; unit?: string; system?: string; code?: string }) {
  if (!source || (source.value === undefined && !source.unit && !source.system && !source.code)) return undefined;
  return {
    value: source.value,
    unit: source.unit,
    system: source.system,
    code: source.code
  };
}

function mapCodeableReference(
  source: { reference?: string; code?: { system?: string; code?: string; display?: string } } | undefined,
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined,
  resourceTypes: string[]
) {
  if (!source) return undefined;
  const reference = source.reference
    ? resolveAnyRef(resolveRef, resourceTypes, source.reference)
    : undefined;
  const concept = mapCodeableConcept(source.code);
  if (!reference && !concept) return undefined;
  return {
    reference: reference ? { reference } : undefined,
    concept
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
