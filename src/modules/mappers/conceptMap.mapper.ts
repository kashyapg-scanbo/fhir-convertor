import crypto from 'crypto';
import conceptMapTemplate from '../../shared/templates/conceptMap.json' with { type: 'json' };
import type { CanonicalConceptMap, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ConceptMapMapperArgs {
  conceptMaps?: CanonicalConceptMap[];
  operation?: OperationType;
  registry: FullUrlRegistry;
}

export function mapConceptMaps({
  conceptMaps,
  operation,
  registry
}: ConceptMapMapperArgs) {
  if (!conceptMaps || conceptMaps.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of conceptMaps) {
    const conceptMap = structuredClone(conceptMapTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    conceptMap.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${conceptMap.id}`;
    conceptMap.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'ConceptMap',
      {
        identifier: source.id || source.identifier || conceptMap.id,
        id: conceptMap.id
      },
      fullUrl
    );

    conceptMap.url = source.url || undefined;
    conceptMap.version = source.version || undefined;
    conceptMap.name = source.name || undefined;
    conceptMap.title = source.title || undefined;
    conceptMap.status = source.status || 'active';
    conceptMap.date = source.date || undefined;
    conceptMap.publisher = source.publisher || undefined;
    conceptMap.description = source.description || undefined;
    conceptMap.sourceScopeUri = source.sourceScope || undefined;
    conceptMap.targetScopeUri = source.targetScope || undefined;

    conceptMap.group = source.group?.length
      ? source.group.map(group => ({
        source: group.source,
        target: group.target,
        element: group.element?.map(element => ({
          code: element.code,
          display: element.display,
          target: element.target?.map(target => ({
            code: target.code,
            display: target.display,
            relationship: target.relationship
          }))
        }))
      }))
      : undefined;

    const summary = conceptMap.title || conceptMap.name || conceptMap.id;
    if (summary) conceptMap.text = makeNarrative('ConceptMap', summary);

    if (operation === 'delete') {
      conceptMap.status = 'retired';
    }

    const entry: any = {
      resource: conceptMap,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `ConceptMap?identifier=${identifierSystem}|${identifierValue || conceptMap.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `ConceptMap/${conceptMap.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
