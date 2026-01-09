import crypto from 'crypto';
import locationTemplate from '../../shared/templates/location.json' with { type: 'json' };
import type { CanonicalLocation, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface LocationMapperArgs {
  locations?: CanonicalLocation[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapLocations({
  locations,
  operation,
  registry,
  resolveRef
}: LocationMapperArgs) {
  if (!locations || locations.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < locations.length; index++) {
    const source = locations[index];
    const location = structuredClone(locationTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    location.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${location.id}`;
    location.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'Location',
      {
        identifier: source.id || source.identifier || location.id,
        id: location.id
      },
      fullUrl
    );

    location.status = source.status || 'active';
    location.name = source.name || undefined;
    location.alias = source.alias?.length ? source.alias : undefined;
    location.description = source.description || undefined;
    location.mode = source.mode || undefined;

    location.type = source.type?.length
      ? source.type.map(t => ({
        coding: [{
          system: t.system,
          code: t.code,
          display: t.display
        }],
        text: t.display
      }))
      : undefined;

    location.address = source.address ? {
      line: source.address.line,
      city: source.address.city,
      state: source.address.state,
      postalCode: source.address.postalCode,
      country: source.address.country
    } : undefined;

    location.position = source.position ? {
      longitude: source.position.longitude,
      latitude: source.position.latitude,
      altitude: source.position.altitude
    } : undefined;

    location.managingOrganization = source.managingOrganization ? {
      reference: resolveRef('Organization', source.managingOrganization) || `Organization/${source.managingOrganization}`
    } : undefined;

    location.partOf = source.partOf ? {
      reference: resolveRef('Location', source.partOf) || `Location/${source.partOf}`
    } : undefined;

    const locationSummary = location.name || location.id;
    if (locationSummary) location.text = makeNarrative('Location', locationSummary);

    if (operation === 'delete') {
      location.status = 'inactive';
    }

    const entry: any = {
      resource: location,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Location?identifier=${identifierSystem}|${identifierValue || location.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Location/${location.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
