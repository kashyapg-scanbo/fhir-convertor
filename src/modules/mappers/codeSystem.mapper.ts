import crypto from 'crypto';
import codeSystemTemplate from '../../shared/templates/codeSystem.json' with { type: 'json' };
import type { CanonicalCodeSystem, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface CodeSystemMapperArgs {
  codeSystems?: CanonicalCodeSystem[];
  operation?: OperationType;
  registry: FullUrlRegistry;
}

export function mapCodeSystems({
  codeSystems,
  operation,
  registry
}: CodeSystemMapperArgs) {
  if (!codeSystems || codeSystems.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of codeSystems) {
    const codeSystem = structuredClone(codeSystemTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    codeSystem.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${codeSystem.id}`;
    codeSystem.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'CodeSystem',
      {
        identifier: source.id || source.identifier || codeSystem.id,
        id: codeSystem.id
      },
      fullUrl
    );

    codeSystem.url = source.url || undefined;
    codeSystem.version = source.version || undefined;
    codeSystem.name = source.name || undefined;
    codeSystem.title = source.title || undefined;
    codeSystem.status = source.status || 'active';
    codeSystem.date = source.date || undefined;
    codeSystem.publisher = source.publisher || undefined;
    codeSystem.description = source.description || undefined;
    codeSystem.content = source.content || undefined;
    codeSystem.caseSensitive = source.caseSensitive ?? undefined;

    codeSystem.concept = source.concept?.length
      ? source.concept.map(concept => ({
        code: concept.code,
        display: concept.display,
        definition: concept.definition
      }))
      : undefined;

    const summary = codeSystem.title || codeSystem.name || codeSystem.id;
    if (summary) codeSystem.text = makeNarrative('CodeSystem', summary);

    if (operation === 'delete') {
      codeSystem.status = 'retired';
    }

    const entry: any = {
      resource: codeSystem,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `CodeSystem?identifier=${identifierSystem}|${identifierValue || codeSystem.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `CodeSystem/${codeSystem.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
