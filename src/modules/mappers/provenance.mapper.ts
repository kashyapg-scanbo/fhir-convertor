import crypto from 'crypto';
import provenanceTemplate from '../../shared/templates/provenance.json' with { type: 'json' };
import type { CanonicalProvenance, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ProvenanceMapperArgs {
  provenances?: CanonicalProvenance[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef?: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapProvenances({
  provenances,
  operation,
  registry,
  resolveRef
}: ProvenanceMapperArgs) {
  if (!provenances || provenances.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of provenances) {
    const provenance = structuredClone(provenanceTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id;

    provenance.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${provenance.id}`;

    registry.register(
      'Provenance',
      {
        identifier: source.id || provenance.id,
        id: provenance.id
      },
      fullUrl
    );

    provenance.target = source.target?.map(target => ({
      reference: target
    }));
    provenance.recorded = source.recorded || undefined;
    provenance.activity = source.activity
      ? { text: source.activity }
      : undefined;

    provenance.agent = source.agent?.map(agent => ({
      role: agent.role ? [{ text: agent.role }] : undefined,
      who: agent.who ? { reference: resolveRef?.('Practitioner', agent.who) || agent.who } : undefined
    }));

    const summary = provenance.activity?.text || provenance.id;
    if (summary) provenance.text = makeNarrative('Provenance', summary);

    const entry: any = {
      resource: provenance,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Provenance?identifier=${identifierSystem}|${identifierValue || provenance.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Provenance/${provenance.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
