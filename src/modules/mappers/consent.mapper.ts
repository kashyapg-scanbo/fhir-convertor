import crypto from 'crypto';
import consentTemplate from '../../shared/templates/consent.json' with { type: 'json' };
import type { CanonicalConsent, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ConsentMapperArgs {
  consents?: CanonicalConsent[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef?: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapConsents({
  consents,
  operation,
  registry,
  resolveRef
}: ConsentMapperArgs) {
  if (!consents || consents.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of consents) {
    const consent = structuredClone(consentTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id;

    consent.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${consent.id}`;
    consent.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'Consent',
      {
        identifier: source.id || consent.id,
        id: consent.id
      },
      fullUrl
    );

    consent.status = source.status || 'active';
    consent.category = source.category ? [{ text: source.category }] : undefined;
    consent.subject = source.subject ? { reference: resolveRef?.('Patient', source.subject) || source.subject } : undefined;
    consent.date = source.date || undefined;
    consent.decision = source.decision || undefined;
    consent.grantor = source.grantor?.map(id => ({ reference: id }));
    consent.grantee = source.grantee?.map(id => ({ reference: id }));

    const summary = consent.category?.[0]?.text || consent.id;
    if (summary) consent.text = makeNarrative('Consent', summary);

    if (operation === 'delete') {
      consent.status = 'inactive';
    }

    const entry: any = {
      resource: consent,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Consent?identifier=${identifierSystem}|${identifierValue || consent.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Consent/${consent.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
