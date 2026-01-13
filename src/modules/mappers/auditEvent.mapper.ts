import crypto from 'crypto';
import auditEventTemplate from '../../shared/templates/auditEvent.json' with { type: 'json' };
import type { CanonicalAuditEvent, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface AuditEventMapperArgs {
  auditEvents?: CanonicalAuditEvent[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef?: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapAuditEvents({
  auditEvents,
  operation,
  registry,
  resolveRef
}: AuditEventMapperArgs) {
  if (!auditEvents || auditEvents.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of auditEvents) {
    const auditEvent = structuredClone(auditEventTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id;

    auditEvent.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${auditEvent.id}`;

    registry.register(
      'AuditEvent',
      {
        identifier: source.id || auditEvent.id,
        id: auditEvent.id
      },
      fullUrl
    );

    auditEvent.category = source.category
      ? [{ text: source.category }]
      : undefined;
    auditEvent.code = source.code
      ? { text: source.code }
      : undefined;
    auditEvent.action = source.action || undefined;
    auditEvent.severity = source.severity || undefined;
    auditEvent.recorded = source.recorded || undefined;

    auditEvent.agent = source.agent?.map(agent => ({
      role: agent.role ? [{ text: agent.role }] : undefined,
      who: agent.who ? { reference: resolveRef?.('Practitioner', agent.who) || agent.who } : undefined,
      requestor: agent.requestor
    }));

    const summary = auditEvent.code?.text || auditEvent.id;
    if (summary) auditEvent.text = makeNarrative('AuditEvent', summary);

    const entry: any = {
      resource: auditEvent,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `AuditEvent?identifier=${identifierSystem}|${identifierValue || auditEvent.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `AuditEvent/${auditEvent.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
