import crypto from 'crypto';
import endpointTemplate from '../../shared/templates/endpoint.json' with { type: 'json' };
import type { CanonicalEndpoint, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface EndpointMapperArgs {
  endpoints?: CanonicalEndpoint[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapEndpoints({
  endpoints,
  operation,
  registry,
  resolveRef
}: EndpointMapperArgs) {
  if (!endpoints || endpoints.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < endpoints.length; index++) {
    const source = endpoints[index];
    const endpoint = structuredClone(endpointTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    endpoint.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${endpoint.id}`;

    endpoint.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'Endpoint',
      {
        identifier: source.id || source.identifier?.[0]?.value || endpoint.id,
        id: endpoint.id
      },
      fullUrl
    );

    endpoint.status = source.status || undefined;
    endpoint.connectionType = source.connectionType?.length
      ? source.connectionType.map(mapCodeableConcept).filter(Boolean)
      : undefined;
    endpoint.name = source.name || undefined;
    endpoint.description = source.description || undefined;
    endpoint.environmentType = source.environmentType?.length
      ? source.environmentType.map(mapCodeableConcept).filter(Boolean)
      : undefined;
    endpoint.managingOrganization = source.managingOrganization
      ? { reference: resolveRef('Organization', source.managingOrganization) || `Organization/${source.managingOrganization}` }
      : undefined;
    endpoint.contact = source.contact?.length
      ? source.contact.map(contact => ({
        system: contact.system,
        value: contact.value,
        use: contact.use
      }))
      : undefined;
    endpoint.period = mapPeriod(source.period);
    endpoint.payload = source.payload?.length
      ? source.payload.map(payload => ({
        type: payload.type?.length ? payload.type.map(mapCodeableConcept).filter(Boolean) : undefined,
        mimeType: payload.mimeType?.length ? payload.mimeType : undefined
      }))
      : undefined;
    endpoint.address = source.address || undefined;
    endpoint.header = source.header?.length ? source.header : undefined;

    const summary = endpoint.name || endpoint.address || endpoint.identifier?.[0]?.value || endpoint.id;
    if (summary) endpoint.text = makeNarrative('Endpoint', summary);

    if (operation === 'delete') {
      endpoint.status = 'entered-in-error';
    }

    const entry: any = {
      resource: endpoint,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Endpoint?identifier=${identifierSystem}|${identifierValue || endpoint.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Endpoint/${endpoint.id}`
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

function mapPeriod(source?: { start?: string; end?: string }) {
  if (!source || (!source.start && !source.end)) return undefined;
  return {
    start: source.start,
    end: source.end
  };
}
