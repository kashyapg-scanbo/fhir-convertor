import crypto from 'crypto';
import terminologyCapabilitiesTemplate from '../../shared/templates/terminologyCapabilities.json' with { type: 'json' };
import type { CanonicalTerminologyCapabilities, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface TerminologyCapabilitiesMapperArgs {
  terminologyCapabilities?: CanonicalTerminologyCapabilities[];
  operation?: OperationType;
  registry: FullUrlRegistry;
}

export function mapTerminologyCapabilities({
  terminologyCapabilities,
  operation,
  registry
}: TerminologyCapabilitiesMapperArgs) {
  if (!terminologyCapabilities || terminologyCapabilities.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of terminologyCapabilities) {
    const terminologyCapabilitiesResource = structuredClone(terminologyCapabilitiesTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    terminologyCapabilitiesResource.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${terminologyCapabilitiesResource.id}`;
    terminologyCapabilitiesResource.identifier = identifierValue
      ? [{ system: identifierSystem, value: identifierValue }]
      : undefined;

    registry.register(
      'TerminologyCapabilities',
      {
        identifier: source.id || source.identifier || terminologyCapabilitiesResource.id,
        id: terminologyCapabilitiesResource.id
      },
      fullUrl
    );

    terminologyCapabilitiesResource.url = source.url || undefined;
    terminologyCapabilitiesResource.version = source.version || undefined;
    terminologyCapabilitiesResource.name = source.name || undefined;
    terminologyCapabilitiesResource.title = source.title || undefined;
    terminologyCapabilitiesResource.status = source.status || 'active';
    terminologyCapabilitiesResource.date = source.date || undefined;
    terminologyCapabilitiesResource.publisher = source.publisher || undefined;
    terminologyCapabilitiesResource.description = source.description || undefined;
    terminologyCapabilitiesResource.kind = source.kind || undefined;
    terminologyCapabilitiesResource.codeSearch = source.codeSearch || undefined;

    const summary = terminologyCapabilitiesResource.title || terminologyCapabilitiesResource.name || terminologyCapabilitiesResource.id;
    if (summary) terminologyCapabilitiesResource.text = makeNarrative('TerminologyCapabilities', summary);

    if (operation === 'delete') {
      terminologyCapabilitiesResource.status = 'retired';
    }

    const entry: any = {
      resource: terminologyCapabilitiesResource,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `TerminologyCapabilities?identifier=${identifierSystem}|${identifierValue || terminologyCapabilitiesResource.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `TerminologyCapabilities/${terminologyCapabilitiesResource.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
