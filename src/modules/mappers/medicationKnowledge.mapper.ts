import crypto from 'crypto';
import medicationKnowledgeTemplate from '../../shared/templates/medicationKnowledge.json' with { type: 'json' };
import type { CanonicalMedicationKnowledge, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface MedicationKnowledgeMapperArgs {
  medicationKnowledges?: CanonicalMedicationKnowledge[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapMedicationKnowledges({
  medicationKnowledges,
  operation,
  registry,
  resolveRef
}: MedicationKnowledgeMapperArgs) {
  if (!medicationKnowledges || medicationKnowledges.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of medicationKnowledges) {
    const medicationKnowledge = structuredClone(medicationKnowledgeTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    medicationKnowledge.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${medicationKnowledge.id}`;

    medicationKnowledge.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'MedicationKnowledge',
      { identifier: source.id || source.identifier?.[0]?.value || medicationKnowledge.id, id: medicationKnowledge.id },
      fullUrl
    );

    medicationKnowledge.code = source.code ? mapCodeableConcept(source.code) : undefined;
    medicationKnowledge.status = source.status || undefined;
    medicationKnowledge.author = source.author
      ? { reference: resolveRef('Organization', source.author) || normalizeReference(source.author) }
      : undefined;
    medicationKnowledge.intendedJurisdiction = source.intendedJurisdiction?.map(mapCodeableConcept).filter(Boolean);
    medicationKnowledge.name = source.name?.length ? source.name : undefined;

    medicationKnowledge.relatedMedicationKnowledge = source.relatedMedicationKnowledge?.map(rel => ({
      type: rel.type ? mapCodeableConcept(rel.type) : undefined,
      reference: rel.reference?.map(ref => ({
        reference: resolveRef('MedicationKnowledge', ref) || normalizeReference(ref)
      }))
    }));

    medicationKnowledge.associatedMedication = source.associatedMedication?.map(ref => ({
      reference: resolveRef('Medication', ref) || normalizeReference(ref)
    }));

    medicationKnowledge.productType = source.productType?.map(mapCodeableConcept).filter(Boolean);

    medicationKnowledge.monograph = source.monograph?.map(item => ({
      type: item.type ? mapCodeableConcept(item.type) : undefined,
      source: item.source
        ? { reference: resolveRef('DocumentReference', item.source) || normalizeReference(item.source) }
        : undefined
    }));

    medicationKnowledge.preparationInstruction = source.preparationInstruction || undefined;

    medicationKnowledge.cost = source.cost?.map(cost => ({
      effectiveDate: cost.effectiveDate?.map(date => ({
        start: date.start,
        end: date.end
      })),
      type: cost.type ? mapCodeableConcept(cost.type) : undefined,
      source: cost.source,
      cost: cost.costMoney
        ? { value: cost.costMoney.value, currency: cost.costMoney.currency }
        : undefined,
      costCodeableConcept: cost.costCodeableConcept ? mapCodeableConcept(cost.costCodeableConcept) : undefined
    }));

    medicationKnowledge.monitoringProgram = source.monitoringProgram?.map(program => ({
      type: program.type ? mapCodeableConcept(program.type) : undefined,
      name: program.name
    }));

    medicationKnowledge.medicineClassification = source.medicineClassification?.map(item => ({
      type: item.type ? mapCodeableConcept(item.type) : undefined,
      sourceString: item.sourceString,
      sourceUri: item.sourceUri,
      classification: item.classification?.map(mapCodeableConcept).filter(Boolean)
    }));

    medicationKnowledge.packaging = source.packaging?.map(pack => ({
      cost: pack.cost?.map(cost => ({
        effectiveDate: cost.effectiveDate?.map(date => ({ start: date.start, end: date.end })),
        type: cost.type ? mapCodeableConcept(cost.type) : undefined,
        source: cost.source,
        cost: cost.costMoney
          ? { value: cost.costMoney.value, currency: cost.costMoney.currency }
          : undefined,
        costCodeableConcept: cost.costCodeableConcept ? mapCodeableConcept(cost.costCodeableConcept) : undefined
      })),
      packagedProduct: pack.packagedProduct
        ? { reference: resolveRef('PackagedProductDefinition', pack.packagedProduct) || normalizeReference(pack.packagedProduct) }
        : undefined
    }));

    medicationKnowledge.clinicalUseIssue = source.clinicalUseIssue?.map(ref => ({
      reference: resolveRef('ClinicalUseDefinition', ref) || normalizeReference(ref)
    }));

    medicationKnowledge.storageGuideline = source.storageGuideline?.map(item => ({
      reference: item.reference,
      note: item.note?.map(text => ({ text })),
      stabilityDuration: item.stabilityDuration
        ? { value: item.stabilityDuration.value, unit: item.stabilityDuration.unit }
        : undefined,
      environmentalSetting: item.environmentalSetting?.map(setting => ({
        type: setting.type ? mapCodeableConcept(setting.type) : undefined,
        valueQuantity: setting.valueQuantity,
        valueRange: setting.valueRange,
        valueCodeableConcept: setting.valueCodeableConcept ? mapCodeableConcept(setting.valueCodeableConcept) : undefined
      }))
    }));

    medicationKnowledge.regulatory = source.regulatory?.map(reg => ({
      regulatoryAuthority: reg.regulatoryAuthority
        ? { reference: resolveRef('Organization', reg.regulatoryAuthority) || normalizeReference(reg.regulatoryAuthority) }
        : undefined,
      substitution: reg.substitution?.map(sub => ({
        type: sub.type ? mapCodeableConcept(sub.type) : undefined,
        allowed: sub.allowed
      })),
      schedule: reg.schedule?.map(mapCodeableConcept).filter(Boolean),
      maxDispense: reg.maxDispense
        ? {
            quantity: reg.maxDispense.quantity,
            period: reg.maxDispense.period
          }
        : undefined
    }));

    medicationKnowledge.definitional = source.definitional
      ? {
          definition: source.definitional.definition?.map(ref => ({
            reference: resolveRef('MedicinalProductDefinition', ref) || normalizeReference(ref)
          })),
          doseForm: source.definitional.doseForm ? mapCodeableConcept(source.definitional.doseForm) : undefined,
          intendedRoute: source.definitional.intendedRoute?.map(mapCodeableConcept).filter(Boolean),
          ingredient: source.definitional.ingredient?.map(ing => ({
            item: ing.itemReference
              ? { reference: resolveRef('Substance', ing.itemReference) || normalizeReference(ing.itemReference) }
              : (ing.itemCodeableConcept ? { concept: mapCodeableConcept(ing.itemCodeableConcept) } : undefined),
            type: ing.type ? mapCodeableConcept(ing.type) : undefined,
            strengthRatio: ing.strengthRatio,
            strengthCodeableConcept: ing.strengthCodeableConcept ? mapCodeableConcept(ing.strengthCodeableConcept) : undefined,
            strengthQuantity: ing.strengthQuantity
          })),
          drugCharacteristic: source.definitional.drugCharacteristic?.map(char => ({
            type: char.type ? mapCodeableConcept(char.type) : undefined,
            valueCodeableConcept: char.valueCodeableConcept ? mapCodeableConcept(char.valueCodeableConcept) : undefined,
            valueString: char.valueString,
            valueQuantity: char.valueQuantity,
            valueBase64Binary: char.valueBase64Binary,
            valueAttachment: char.valueAttachment
          }))
        }
      : undefined;

    const summary = source.code?.display || source.code?.code || source.name?.[0];
    if (summary) medicationKnowledge.text = makeNarrative('MedicationKnowledge', summary);

    if (operation === 'delete') {
      medicationKnowledge.status = 'entered-in-error';
    }

    const entry: any = { resource: medicationKnowledge, fullUrl };
    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `MedicationKnowledge?identifier=${identifierSystem}|${identifierValue || medicationKnowledge.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = { method: 'PUT', url: `MedicationKnowledge/${medicationKnowledge.id}` };
    }

    entries.push(entry);
  }

  return entries;
}

function mapCodeableConcept(source?: { system?: string; code?: string; display?: string }) {
  if (!source) return undefined;
  return {
    coding: (source.system || source.code || source.display) ? [{
      system: source.system,
      code: source.code,
      display: source.display
    }] : undefined,
    text: source.display || source.code
  };
}

function mapIdentifier(source?: { system?: string; value?: string; type?: { system?: string; code?: string; display?: string } }) {
  if (!source || (!source.system && !source.value && !source.type)) return undefined;
  return {
    system: source.system,
    value: source.value,
    type: source.type ? mapCodeableConcept(source.type) : undefined
  };
}

function normalizeReference(value: string) {
  return value.trim().replace(/^#/, '');
}
