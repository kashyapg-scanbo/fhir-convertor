import crypto from 'crypto';
import valueSetTemplate from '../../shared/templates/valueSet.json' with { type: 'json' };
import type { CanonicalValueSet, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ValueSetMapperArgs {
  valueSets?: CanonicalValueSet[];
  operation?: OperationType;
  registry: FullUrlRegistry;
}

export function mapValueSets({
  valueSets,
  operation,
  registry
}: ValueSetMapperArgs) {
  if (!valueSets || valueSets.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of valueSets) {
    const valueSet = structuredClone(valueSetTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    valueSet.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${valueSet.id}`;
    valueSet.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'ValueSet',
      {
        identifier: source.id || source.identifier || valueSet.id,
        id: valueSet.id
      },
      fullUrl
    );

    valueSet.url = source.url || undefined;
    valueSet.version = source.version || undefined;
    valueSet.name = source.name || undefined;
    valueSet.title = source.title || undefined;
    valueSet.status = source.status || 'active';
    valueSet.date = source.date || undefined;
    valueSet.publisher = source.publisher || undefined;
    valueSet.description = source.description || undefined;

    const includes = source.compose?.include || [];
    valueSet.compose = includes.length
      ? {
        include: includes.map(include => ({
          system: include.system,
          concept: include.concept?.map(concept => ({
            code: concept.code,
            display: concept.display
          }))
        }))
      }
      : undefined;

    const contains = source.expansion?.contains || [];
    valueSet.expansion = contains.length
      ? {
        contains: contains.map(item => ({
          system: item.system,
          code: item.code,
          display: item.display
        }))
      }
      : undefined;

    const summary = valueSet.title || valueSet.name || valueSet.id;
    if (summary) valueSet.text = makeNarrative('ValueSet', summary);

    if (operation === 'delete') {
      valueSet.status = 'retired';
    }

    const entry: any = {
      resource: valueSet,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `ValueSet?identifier=${identifierSystem}|${identifierValue || valueSet.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `ValueSet/${valueSet.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
