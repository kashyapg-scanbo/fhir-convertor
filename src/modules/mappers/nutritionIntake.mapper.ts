import crypto from 'crypto';
import nutritionIntakeTemplate from '../../shared/templates/nutritionIntake.json' with { type: 'json' };
import type { CanonicalNutritionIntake, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface NutritionIntakeMapperArgs {
  nutritionIntakes?: CanonicalNutritionIntake[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapNutritionIntakes({
  nutritionIntakes,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: NutritionIntakeMapperArgs) {
  if (!nutritionIntakes || nutritionIntakes.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of nutritionIntakes) {
    const intake = structuredClone(nutritionIntakeTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    intake.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${intake.id}`;
    intake.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'NutritionIntake',
      {
        identifier: source.id || source.identifier?.[0]?.value || intake.id,
        id: intake.id
      },
      fullUrl
    );

    intake.instantiatesCanonical = source.instantiatesCanonical?.length ? source.instantiatesCanonical : undefined;
    intake.instantiatesUri = source.instantiatesUri?.length ? source.instantiatesUri : undefined;
    intake.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({ reference: resolveAnyRef(resolveRef, ['CarePlan', 'NutritionOrder', 'ServiceRequest'], ref) }))
      : undefined;
    intake.partOf = source.partOf?.length
      ? source.partOf.map(ref => ({ reference: resolveAnyRef(resolveRef, ['NutritionIntake', 'Observation', 'Procedure'], ref) }))
      : undefined;

    intake.status = source.status || undefined;
    intake.statusReason = source.statusReason?.length
      ? source.statusReason.map(mapCodeableConcept).filter(Boolean)
      : undefined;
    intake.code = source.code ? mapCodeableConcept(source.code) : undefined;

    if (source.subject) {
      intake.subject = { reference: resolveAnyRef(resolveRef, ['Group', 'Patient'], source.subject) };
    } else if (patientFullUrl) {
      intake.subject = { reference: patientFullUrl };
    } else {
      intake.subject = undefined;
    }

    if (source.encounter) {
      intake.encounter = { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` };
    } else if (encounterFullUrl) {
      intake.encounter = { reference: encounterFullUrl };
    } else {
      intake.encounter = undefined;
    }

    if (source.occurrenceDateTime) {
      intake.occurrenceDateTime = source.occurrenceDateTime;
      intake.occurrencePeriod = undefined;
    } else if (source.occurrencePeriod) {
      intake.occurrencePeriod = {
        start: source.occurrencePeriod.start,
        end: source.occurrencePeriod.end
      };
      intake.occurrenceDateTime = undefined;
    } else {
      intake.occurrenceDateTime = undefined;
      intake.occurrencePeriod = undefined;
    }

    intake.recorded = source.recorded || undefined;

    if (source.reportedReference) {
      intake.reportedReference = {
        reference: resolveAnyRef(resolveRef, ['Organization', 'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], source.reportedReference)
      };
      intake.reportedBoolean = undefined;
    } else if (source.reportedBoolean !== undefined) {
      intake.reportedBoolean = source.reportedBoolean;
      intake.reportedReference = undefined;
    } else {
      intake.reportedBoolean = undefined;
      intake.reportedReference = undefined;
    }

    intake.consumedItem = source.consumedItem?.length
      ? source.consumedItem.map(item => ({
          type: item.type ? mapCodeableConcept(item.type) : undefined,
          nutritionProduct: item.nutritionProductCodeableConcept || item.nutritionProductReference
            ? {
                concept: item.nutritionProductCodeableConcept ? mapCodeableConcept(item.nutritionProductCodeableConcept) : undefined,
                reference: item.nutritionProductReference
                  ? { reference: resolveRef('NutritionProduct', item.nutritionProductReference) || `NutritionProduct/${item.nutritionProductReference}` }
                  : undefined
              }
            : undefined,
          schedule: item.schedule ? { code: { text: item.schedule } } : undefined,
          amount: item.amount ? mapQuantity(item.amount) : undefined,
          rate: item.rate ? mapQuantity(item.rate) : undefined,
          notConsumed: item.notConsumed ?? undefined,
          notConsumedReason: item.notConsumedReason ? mapCodeableConcept(item.notConsumedReason) : undefined
        }))
      : undefined;

    intake.ingredientLabel = source.ingredientLabel?.length
      ? source.ingredientLabel.map(item => ({
          nutrient: item.nutrientCodeableConcept || item.nutrientReference
            ? {
                concept: item.nutrientCodeableConcept ? mapCodeableConcept(item.nutrientCodeableConcept) : undefined,
                reference: item.nutrientReference
                  ? { reference: resolveRef('Substance', item.nutrientReference) || `Substance/${item.nutrientReference}` }
                  : undefined
              }
            : undefined,
          amount: item.amount ? mapQuantity(item.amount) : undefined
        }))
      : undefined;

    intake.performer = source.performer?.length
      ? source.performer.map(performer => ({
          function: performer.function ? mapCodeableConcept(performer.function) : undefined,
          actor: performer.actor
            ? { reference: resolveAnyRef(resolveRef, ['CareTeam', 'Device', 'Organization', 'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], performer.actor) }
            : undefined
        }))
      : undefined;

    intake.location = source.location
      ? { reference: resolveRef('Location', source.location) || `Location/${source.location}` }
      : undefined;

    intake.derivedFrom = source.derivedFrom?.length
      ? source.derivedFrom.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    intake.reason = source.reason?.length
      ? source.reason.map(ref => ({ reference: resolveAnyRef(resolveRef, ['Condition', 'DiagnosticReport', 'DocumentReference', 'Observation'], ref) }))
      : undefined;

    intake.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;

    const summary = intake.code?.text || intake.id;
    if (summary) intake.text = makeNarrative('NutritionIntake', summary);

    if (operation === 'delete') {
      intake.status = 'entered-in-error';
    }

    const entry: any = {
      resource: intake,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `NutritionIntake?identifier=${identifierSystem}|${identifierValue || intake.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `NutritionIntake/${intake.id}`
      };
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

function mapQuantity(source?: { value?: number; unit?: string; system?: string; code?: string }) {
  if (!source) return undefined;
  return {
    value: source.value,
    unit: source.unit,
    system: source.system,
    code: source.code
  };
}

function resolveAnyRef(
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined,
  resourceTypes: string[],
  value: string
) {
  if (!value) return undefined;
  if (value.includes('/')) return value;
  for (const resourceType of resourceTypes) {
    const resolved = resolveRef(resourceType, value);
    if (resolved) return resolved;
  }
  return resourceTypes.length > 0 ? `${resourceTypes[0]}/${value}` : value;
}

function normalizeReference(value: string) {
  if (!value) return undefined;
  return value;
}
