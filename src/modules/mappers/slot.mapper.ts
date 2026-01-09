import crypto from 'crypto';
import slotTemplate from '../../shared/templates/slot.json' with { type: 'json' };
import type { CanonicalSlot, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface SlotMapperArgs {
  slots?: CanonicalSlot[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapSlots({
  slots,
  operation,
  registry,
  resolveRef
}: SlotMapperArgs) {
  if (!slots || slots.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < slots.length; index++) {
    const source = slots[index];
    const slot = structuredClone(slotTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    slot.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${slot.id}`;
    slot.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'Slot',
      {
        identifier: source.id || source.identifier || slot.id,
        id: slot.id
      },
      fullUrl
    );

    slot.status = source.status || 'free';
    slot.start = source.start || undefined;
    slot.end = source.end || undefined;
    slot.overbooked = source.overbooked ?? undefined;
    slot.comment = source.comment || undefined;

    slot.schedule = source.schedule ? {
      reference: resolveRef('Schedule', source.schedule) || `Schedule/${source.schedule}`
    } : undefined;

    slot.serviceCategory = source.serviceCategory?.length
      ? source.serviceCategory.map(cat => ({
        coding: [{
          system: cat.system,
          code: cat.code,
          display: cat.display
        }],
        text: cat.display
      }))
      : undefined;

    slot.serviceType = source.serviceType?.length
      ? source.serviceType.map(service => ({
        concept: {
          coding: [{
            system: service.system,
            code: service.code,
            display: service.display
          }],
          text: service.display
        }
      }))
      : undefined;

    slot.specialty = source.specialty?.length
      ? source.specialty.map(spec => ({
        coding: [{
          system: spec.system,
          code: spec.code,
          display: spec.display
        }],
        text: spec.display
      }))
      : undefined;

    slot.appointmentType = source.appointmentType?.length
      ? source.appointmentType.map(type => ({
        coding: [{
          system: type.system,
          code: type.code,
          display: type.display
        }],
        text: type.display
      }))
      : undefined;

    const slotSummary = slot.comment || slot.id;
    if (slotSummary) slot.text = makeNarrative('Slot', slotSummary);

    if (operation === 'delete') {
      slot.status = 'entered-in-error';
    }

    const entry: any = {
      resource: slot,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Slot?identifier=${identifierSystem}|${identifierValue || slot.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Slot/${slot.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
