import crypto from 'crypto';
import namingSystemTemplate from '../../shared/templates/namingSystem.json' with { type: 'json' };
import type { CanonicalNamingSystem, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface NamingSystemMapperArgs {
  namingSystems?: CanonicalNamingSystem[];
  operation?: OperationType;
  registry: FullUrlRegistry;
}

export function mapNamingSystems({
  namingSystems,
  operation,
  registry
}: NamingSystemMapperArgs) {
  if (!namingSystems || namingSystems.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of namingSystems) {
    const namingSystem = structuredClone(namingSystemTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    namingSystem.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${namingSystem.id}`;
    namingSystem.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'NamingSystem',
      {
        identifier: source.id || source.identifier || namingSystem.id,
        id: namingSystem.id
      },
      fullUrl
    );

    namingSystem.url = source.url || undefined;
    namingSystem.version = source.version || undefined;
    namingSystem.name = source.name || undefined;
    namingSystem.title = source.title || undefined;
    namingSystem.status = source.status || 'active';
    namingSystem.kind = source.kind || undefined;
    namingSystem.date = source.date || undefined;
    namingSystem.publisher = source.publisher || undefined;
    namingSystem.responsible = source.responsible || undefined;
    namingSystem.description = source.description || undefined;
    namingSystem.usage = source.usage || undefined;

    namingSystem.uniqueId = source.uniqueId?.length
      ? source.uniqueId.map(uniqueId => ({
        type: uniqueId.type,
        value: uniqueId.value,
        preferred: uniqueId.preferred
      }))
      : undefined;

    const summary = namingSystem.title || namingSystem.name || namingSystem.id;
    if (summary) namingSystem.text = makeNarrative('NamingSystem', summary);

    if (operation === 'delete') {
      namingSystem.status = 'retired';
    }

    const entry: any = {
      resource: namingSystem,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `NamingSystem?identifier=${identifierSystem}|${identifierValue || namingSystem.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `NamingSystem/${namingSystem.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
