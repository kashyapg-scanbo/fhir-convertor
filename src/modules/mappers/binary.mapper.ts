import crypto from 'crypto';
import binaryTemplate from '../../shared/templates/binary.json' with { type: 'json' };
import type { CanonicalBinary, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface BinaryMapperArgs {
  binaries?: CanonicalBinary[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapBinaries({
  binaries,
  operation,
  registry,
  resolveRef
}: BinaryMapperArgs) {
  if (!binaries || binaries.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < binaries.length; index++) {
    const source = binaries[index];
    const binary = structuredClone(binaryTemplate) as any;

    binary.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${binary.id}`;

    registry.register(
      'Binary',
      {
        identifier: source.id || binary.id,
        id: binary.id
      },
      fullUrl
    );

    binary.contentType = source.contentType || undefined;
    binary.securityContext = source.securityContext
      ? { reference: resolveAnyRef(resolveRef, source.securityContext) }
      : undefined;
    binary.data = source.data || undefined;

    const summary = source.contentType || binary.id;
    if (summary) binary.text = makeNarrative('Binary', summary);

    if (operation === 'delete') {
      binary.data = undefined;
    }

    const entry: any = {
      resource: binary,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Binary/${binary.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Binary/${binary.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}

function resolveAnyRef(
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined,
  value: string
) {
  if (!value) return undefined;
  if (value.includes('/')) return value;
  const [resourceType, id] = value.split(':');
  if (resourceType && id) {
    const resolved = resolveRef(resourceType, id);
    return resolved || `${resourceType}/${id}`;
  }
  return value;
}
