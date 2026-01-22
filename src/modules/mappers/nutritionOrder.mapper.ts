import crypto from 'crypto';
import nutritionOrderTemplate from '../../shared/templates/nutritionOrder.json' with { type: 'json' };
import type { CanonicalNutritionOrder, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface NutritionOrderMapperArgs {
  nutritionOrders?: CanonicalNutritionOrder[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapNutritionOrders({
  nutritionOrders,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: NutritionOrderMapperArgs) {
  if (!nutritionOrders || nutritionOrders.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of nutritionOrders) {
    const order = structuredClone(nutritionOrderTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    order.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${order.id}`;
    order.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'NutritionOrder',
      {
        identifier: source.id || source.identifier?.[0]?.value || order.id,
        id: order.id
      },
      fullUrl
    );

    order.instantiatesCanonical = source.instantiatesCanonical?.length ? source.instantiatesCanonical : undefined;
    order.instantiatesUri = source.instantiatesUri?.length ? source.instantiatesUri : undefined;
    order.instantiates = source.instantiates?.length ? source.instantiates : undefined;
    order.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({ reference: resolveAnyRef(resolveRef, ['CarePlan', 'NutritionOrder', 'ServiceRequest'], ref) }))
      : undefined;
    order.groupIdentifier = source.groupIdentifier ? mapIdentifier(source.groupIdentifier) : undefined;

    order.status = source.status || undefined;
    order.intent = source.intent || undefined;
    order.priority = source.priority || undefined;

    if (source.subject) {
      order.subject = { reference: resolveAnyRef(resolveRef, ['Group', 'Patient'], source.subject) };
    } else if (patientFullUrl) {
      order.subject = { reference: patientFullUrl };
    } else {
      order.subject = undefined;
    }

    if (source.encounter) {
      order.encounter = { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` };
    } else if (encounterFullUrl) {
      order.encounter = { reference: encounterFullUrl };
    } else {
      order.encounter = undefined;
    }

    order.supportingInformation = source.supportingInformation?.length
      ? source.supportingInformation.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    order.dateTime = source.dateTime || undefined;

    order.orderer = source.orderer
      ? { reference: resolveAnyRef(resolveRef, ['Practitioner', 'PractitionerRole'], source.orderer) }
      : undefined;

    order.performer = source.performer?.length
      ? source.performer.map(perf => ({
          concept: perf.concept ? mapCodeableConcept(perf.concept) : undefined,
          reference: perf.reference
            ? { reference: resolveAnyRef(resolveRef, ['CareTeam', 'Organization', 'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], perf.reference) }
            : undefined
        }))
      : undefined;

    order.allergyIntolerance = source.allergyIntolerance?.length
      ? source.allergyIntolerance.map(ref => ({ reference: resolveRef('AllergyIntolerance', ref) || `AllergyIntolerance/${ref}` }))
      : undefined;

    order.foodPreferenceModifier = source.foodPreferenceModifier?.length
      ? source.foodPreferenceModifier.map(mapCodeableConcept).filter(Boolean)
      : undefined;

    order.excludeFoodModifier = source.excludeFoodModifier?.length
      ? source.excludeFoodModifier.map(mapCodeableConcept).filter(Boolean)
      : undefined;

    order.outsideFoodAllowed = source.outsideFoodAllowed ?? undefined;

    if (source.oralDiet) {
      order.oralDiet = {
        type: source.oralDiet.type?.length ? source.oralDiet.type.map(mapCodeableConcept).filter(Boolean) : undefined,
        schedule: (source.oralDiet.scheduleTiming || source.oralDiet.asNeeded !== undefined || source.oralDiet.asNeededFor) ? {
          timing: source.oralDiet.scheduleTiming ? [{ code: { text: source.oralDiet.scheduleTiming } }] : undefined,
          asNeeded: source.oralDiet.asNeeded ?? undefined,
          asNeededFor: source.oralDiet.asNeededFor ? mapCodeableConcept(source.oralDiet.asNeededFor) : undefined
        } : undefined,
        nutrient: source.oralDiet.nutrient?.length ? source.oralDiet.nutrient.map(nutrient => ({
          modifier: nutrient.modifier ? mapCodeableConcept(nutrient.modifier) : undefined,
          amount: nutrient.amount ? mapQuantity(nutrient.amount) : undefined
        })) : undefined,
        texture: source.oralDiet.texture?.length ? source.oralDiet.texture.map(texture => ({
          modifier: texture.modifier ? mapCodeableConcept(texture.modifier) : undefined,
          foodType: texture.foodType ? mapCodeableConcept(texture.foodType) : undefined
        })) : undefined,
        fluidConsistencyType: source.oralDiet.fluidConsistencyType?.length
          ? source.oralDiet.fluidConsistencyType.map(mapCodeableConcept).filter(Boolean)
          : undefined,
        instruction: source.oralDiet.instruction || undefined
      };
    } else {
      order.oralDiet = undefined;
    }

    order.supplement = source.supplement?.length
      ? source.supplement.map(item => ({
          type: item.typeCodeableConcept || item.typeReference
            ? {
                concept: item.typeCodeableConcept ? mapCodeableConcept(item.typeCodeableConcept) : undefined,
                reference: item.typeReference
                  ? { reference: resolveRef('NutritionProduct', item.typeReference) || `NutritionProduct/${item.typeReference}` }
                  : undefined
              }
            : undefined,
          productName: item.productName || undefined,
          schedule: (item.scheduleTiming || item.asNeeded !== undefined || item.asNeededFor) ? {
            timing: item.scheduleTiming ? [{ code: { text: item.scheduleTiming } }] : undefined,
            asNeeded: item.asNeeded ?? undefined,
            asNeededFor: item.asNeededFor ? mapCodeableConcept(item.asNeededFor) : undefined
          } : undefined,
          quantity: item.quantity ? mapQuantity(item.quantity) : undefined,
          instruction: item.instruction || undefined
        }))
      : undefined;

    if (source.enteralFormula) {
      order.enteralFormula = {
        baseFormulaType: source.enteralFormula.baseFormulaTypeCodeableConcept || source.enteralFormula.baseFormulaTypeReference
          ? {
              concept: source.enteralFormula.baseFormulaTypeCodeableConcept ? mapCodeableConcept(source.enteralFormula.baseFormulaTypeCodeableConcept) : undefined,
              reference: source.enteralFormula.baseFormulaTypeReference
                ? { reference: resolveRef('NutritionProduct', source.enteralFormula.baseFormulaTypeReference) || `NutritionProduct/${source.enteralFormula.baseFormulaTypeReference}` }
                : undefined
            }
          : undefined,
        baseFormulaProductName: source.enteralFormula.baseFormulaProductName || undefined,
        deliveryDevice: source.enteralFormula.deliveryDevice?.length
          ? source.enteralFormula.deliveryDevice.map(id => ({ reference: resolveRef('DeviceDefinition', id) || `DeviceDefinition/${id}` }))
          : undefined,
        additive: source.enteralFormula.additive?.length
          ? source.enteralFormula.additive.map(add => ({
              type: add.typeCodeableConcept || add.typeReference
                ? {
                    concept: add.typeCodeableConcept ? mapCodeableConcept(add.typeCodeableConcept) : undefined,
                    reference: add.typeReference
                      ? { reference: resolveRef('NutritionProduct', add.typeReference) || `NutritionProduct/${add.typeReference}` }
                      : undefined
                  }
                : undefined,
              productName: add.productName || undefined,
              quantity: add.quantity ? mapQuantity(add.quantity) : undefined
            }))
          : undefined,
        caloricDensity: source.enteralFormula.caloricDensity ? mapQuantity(source.enteralFormula.caloricDensity) : undefined,
        routeOfAdministration: source.enteralFormula.routeOfAdministration ? mapCodeableConcept(source.enteralFormula.routeOfAdministration) : undefined,
        administration: source.enteralFormula.administration?.length
          ? source.enteralFormula.administration.map(admin => ({
              schedule: (admin.scheduleTiming || admin.asNeeded !== undefined || admin.asNeededFor) ? {
                timing: admin.scheduleTiming ? [{ code: { text: admin.scheduleTiming } }] : undefined,
                asNeeded: admin.asNeeded ?? undefined,
                asNeededFor: admin.asNeededFor ? mapCodeableConcept(admin.asNeededFor) : undefined
              } : undefined,
              quantity: admin.quantity ? mapQuantity(admin.quantity) : undefined,
              rateQuantity: admin.rateQuantity ? mapQuantity(admin.rateQuantity) : undefined,
              rateRatio: admin.rateRatio || undefined
            }))
          : undefined,
        maxVolumeToDeliver: source.enteralFormula.maxVolumeToDeliver ? mapQuantity(source.enteralFormula.maxVolumeToDeliver) : undefined,
        administrationInstruction: source.enteralFormula.administrationInstruction || undefined
      };
    } else {
      order.enteralFormula = undefined;
    }

    order.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;

    const summary = order.code?.text || order.id;
    if (summary) order.text = makeNarrative('NutritionOrder', summary);

    if (operation === 'delete') {
      order.status = 'entered-in-error';
    }

    const entry: any = {
      resource: order,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `NutritionOrder?identifier=${identifierSystem}|${identifierValue || order.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `NutritionOrder/${order.id}`
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
