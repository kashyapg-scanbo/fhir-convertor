import crypto from 'crypto';
import medicationTemplate from '../../shared/templates/medication.json' with { type: 'json' };
import type { CanonicalMedication, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface MedicationMapperArgs {
  medications?: CanonicalMedication[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapMedications({
  medications,
  operation,
  registry,
  resolveRef
}: MedicationMapperArgs) {
  if (!medications || medications.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < medications.length; index++) {
    const source = medications[index];
    const medication = structuredClone(medicationTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    medication.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${medication.id}`;
    medication.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'Medication',
      {
        identifier: source.id || source.identifier || medication.id,
        id: medication.id
      },
      fullUrl
    );

    if (source.code) {
      const coding = (source.code.coding || []).map((c: any) => {
        const system = String(c.system || '');
        const isRxNorm = system.includes('rxnorm');
        return {
          system: c.system,
          code: c.code,
          display: isRxNorm ? undefined : c.display
        };
      });
      medication.code = {
        coding,
        text: source.code.text || undefined
      };
    } else {
      medication.code = undefined;
    }

    if (source.form) {
      medication.doseForm = {
        coding: source.form.coding || []
      };
    } else {
      medication.doseForm = undefined;
    }

    medication.status = source.status || 'active';

    if (source.manufacturer) {
      medication.marketingAuthorizationHolder = {
        reference: resolveRef('Organization', source.manufacturer) || `Organization/${source.manufacturer}`
      };
    } else {
      medication.marketingAuthorizationHolder = undefined;
    }

    if (source.amount) {
      medication.totalVolume = {
        value: source.amount.value,
        unit: source.amount.unit
      };
    } else {
      medication.totalVolume = undefined;
    }

    if (source.code?.text) {
      medication.text = makeNarrative('Medication', source.code.text);
    }

    if (operation === 'delete') {
      medication.status = 'inactive';
    }

    medication.ingredient = undefined;
    medication.batch = undefined;
    medication.definition = undefined;

    const entry: any = {
      resource: medication,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Medication?identifier=${identifierSystem}|${identifierValue || medication.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Medication/${medication.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
