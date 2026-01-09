import crypto from 'crypto';
import medicationStatementTemplate from '../../shared/templates/medicationStatement.json' with { type: 'json' };
import type { CanonicalMedicationStatement, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface MedicationStatementMapperArgs {
  medicationStatements?: CanonicalMedicationStatement[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapMedicationStatements({
  medicationStatements,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: MedicationStatementMapperArgs) {
  if (!medicationStatements || medicationStatements.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < medicationStatements.length; index++) {
    const source = medicationStatements[index];
    const medicationStatement = structuredClone(medicationStatementTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    medicationStatement.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${medicationStatement.id}`;
    medicationStatement.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'MedicationStatement',
      {
        identifier: source.id || source.identifier || medicationStatement.id,
        id: medicationStatement.id
      },
      fullUrl
    );

    medicationStatement.status = source.status || 'recorded';

    if (source.category?.length) {
      medicationStatement.category = source.category.map(cat => ({
        coding: [{
          system: cat.system,
          code: cat.code,
          display: cat.display
        }],
        text: cat.display
      }));
    } else {
      medicationStatement.category = undefined;
    }

    if (source.medicationCodeableConcept || source.medicationReference) {
      medicationStatement.medication = {};
      if (source.medicationCodeableConcept) {
        const coding = (source.medicationCodeableConcept.coding || []).map((c: any) => {
          const system = String(c.system || '');
          const isRxNorm = system.includes('rxnorm');
          return {
            system: c.system,
            code: c.code,
            display: isRxNorm ? undefined : c.display
          };
        });
        medicationStatement.medication.concept = {
          coding,
          text: source.medicationCodeableConcept.text || ''
        };
      }
      if (source.medicationReference) {
        medicationStatement.medication.reference = {
          reference: resolveRef('Medication', source.medicationReference) || `Medication/${source.medicationReference}`
        };
      }
    } else {
      medicationStatement.medication = undefined;
    }

    if (source.subject) {
      medicationStatement.subject = {
        reference: resolveRef('Patient', source.subject) || `Patient/${source.subject}`
      };
    } else if (patientFullUrl) {
      medicationStatement.subject = { reference: patientFullUrl };
    } else {
      medicationStatement.subject = undefined;
    }

    if (source.encounter) {
      medicationStatement.encounter = {
        reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}`
      };
    } else if (encounterFullUrl) {
      medicationStatement.encounter = { reference: encounterFullUrl };
    } else {
      medicationStatement.encounter = undefined;
    }

    if (source.effectiveDateTime) {
      medicationStatement.effectiveDateTime = source.effectiveDateTime;
      medicationStatement.effectivePeriod = undefined;
      medicationStatement.effectiveTiming = undefined;
    } else if (source.effectivePeriod) {
      medicationStatement.effectivePeriod = {
        start: source.effectivePeriod.start,
        end: source.effectivePeriod.end
      };
      medicationStatement.effectiveDateTime = undefined;
      medicationStatement.effectiveTiming = undefined;
    } else {
      medicationStatement.effectiveDateTime = undefined;
      medicationStatement.effectivePeriod = undefined;
      medicationStatement.effectiveTiming = undefined;
    }

    medicationStatement.dateAsserted = source.dateAsserted || undefined;

    if (source.author) {
      medicationStatement.author = {
        reference: resolveRef('Practitioner', source.author) || `Practitioner/${source.author}`
      };
    } else {
      medicationStatement.author = undefined;
    }

    if (source.informationSource?.length) {
      medicationStatement.informationSource = source.informationSource.map(sourceId => ({
        reference: resolveRef('Organization', sourceId) || `Organization/${sourceId}`
      }));
    } else {
      medicationStatement.informationSource = undefined;
    }

    if (source.reason?.length) {
      medicationStatement.reason = source.reason.map(reason => {
        if (reason.reference) {
          return { reference: reason.reference };
        }
        if (reason.code) {
          return {
            concept: {
              coding: [{
                system: reason.code.system,
                code: reason.code.code,
                display: reason.code.display
              }],
              text: reason.code.display
            }
          };
        }
        return null;
      }).filter(Boolean);
    } else {
      medicationStatement.reason = undefined;
    }

    medicationStatement.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    medicationStatement.relatedClinicalInformation = source.relatedClinicalInformation?.length
      ? source.relatedClinicalInformation.map(ref => ({ reference: ref }))
      : undefined;

    medicationStatement.dosage = source.dosage?.length
      ? source.dosage.map(dosage => mapDosage(dosage))
      : undefined;

    if (source.adherence) {
      medicationStatement.adherence = {
        code: source.adherence.code ? {
          coding: [{
            system: source.adherence.code.system,
            code: source.adherence.code.code,
            display: source.adherence.code.display
          }],
          text: source.adherence.code.display
        } : undefined,
        reason: source.adherence.reason ? {
          coding: [{
            system: source.adherence.reason.system,
            code: source.adherence.reason.code,
            display: source.adherence.reason.display
          }],
          text: source.adherence.reason.display
        } : undefined
      };
    } else {
      medicationStatement.adherence = undefined;
    }

    const statementSummary = medicationStatement.medication?.concept?.text || medicationStatement.id;
    if (statementSummary) medicationStatement.text = makeNarrative('MedicationStatement', statementSummary);

    if (operation === 'delete') {
      medicationStatement.status = 'entered-in-error';
    }

    const entry: any = {
      resource: medicationStatement,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `MedicationStatement?identifier=${identifierSystem}|${identifierValue || medicationStatement.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `MedicationStatement/${medicationStatement.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}

type CanonicalDosage = NonNullable<CanonicalMedicationStatement['dosage']>[number];

function mapDosage(dosage: CanonicalDosage) {
  const mapped: any = {
    text: dosage.text,
    timing: dosage.timing,
    route: dosage.route
  };

  if (dosage.doseQuantity && (dosage.doseQuantity.value !== undefined || dosage.doseQuantity.unit)) {
    mapped.doseAndRate = [{
      doseQuantity: {
        value: dosage.doseQuantity.value,
        unit: dosage.doseQuantity.unit
      }
    }];
  }

  return mapped;
}
