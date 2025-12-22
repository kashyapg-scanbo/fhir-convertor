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

    medication.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${medication.id}`;

    registry.register(
      'Medication',
      {
        identifier: source.id || source.identifier || medication.id,
        id: medication.id
      },
      fullUrl
    );

    if (source.code) {
      medication.code.coding = source.code.coding || [];
      medication.code.text = source.code.text || '';
    }

    if (source.form) {
      medication.doseForm.coding = source.form.coding || [];
    }

    medication.status = source.status || 'active';

    if (source.manufacturer) {
      medication.marketingAuthorizationHolder.reference = resolveRef('Organization', source.manufacturer) || `Organization/${source.manufacturer}`;
    }

    if (source.amount) {
      medication.totalVolume = {
        value: source.amount.value,
        unit: source.amount.unit
      };
    }

    if (source.code?.text) {
      medication.text = makeNarrative('Medication', source.code.text);
    }

    if (operation === 'delete') {
      medication.status = 'inactive';
    }

    const entry: any = {
      resource: medication,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Medication?identifier=urn:hl7-org:v2|${medication.id}`
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
