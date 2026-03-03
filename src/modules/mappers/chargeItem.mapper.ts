import crypto from 'crypto';
import chargeItemTemplate from '../../shared/templates/chargeItem.json' with { type: 'json' };
import type { CanonicalChargeItem, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ChargeItemMapperArgs {
  chargeItems?: CanonicalChargeItem[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapChargeItems({
  chargeItems,
  operation,
  registry,
  resolveRef
}: ChargeItemMapperArgs) {
  if (!chargeItems || chargeItems.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < chargeItems.length; index++) {
    const source = chargeItems[index];
    const chargeItem = structuredClone(chargeItemTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    chargeItem.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${chargeItem.id}`;

    chargeItem.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'ChargeItem',
      {
        identifier: source.id || source.identifier?.[0]?.value || chargeItem.id,
        id: chargeItem.id
      },
      fullUrl
    );

    chargeItem.definitionUri = source.definitionUri?.length ? source.definitionUri : undefined;
    chargeItem.definitionCanonical = source.definitionCanonical?.length ? source.definitionCanonical : undefined;
    chargeItem.status = source.status || undefined;
    chargeItem.partOf = source.partOf?.length
      ? source.partOf.map(id => ({
        reference: resolveRef('ChargeItem', id) || `ChargeItem/${id}`
      }))
      : undefined;
    chargeItem.code = mapCodeableConcept(source.code);
    chargeItem.subject = source.subject
      ? { reference: resolveAnyRef(resolveRef, ['Group', 'Patient'], source.subject) }
      : undefined;
    chargeItem.encounter = source.encounter
      ? { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` }
      : undefined;
    chargeItem.occurrenceDateTime = source.occurrenceDateTime || undefined;
    chargeItem.occurrencePeriod = mapPeriod(source.occurrencePeriod);
    chargeItem.occurrenceTiming = source.occurrenceTiming || undefined;
    chargeItem.performer = source.performer?.length
      ? source.performer.map(entry => ({
        function: mapCodeableConcept(entry.function),
        actor: entry.actor
          ? { reference: resolveAnyRef(resolveRef, [
            'CareTeam',
            'Device',
            'HealthcareService',
            'Organization',
            'Patient',
            'Practitioner',
            'PractitionerRole',
            'RelatedPerson'
          ], entry.actor) }
          : undefined
      }))
      : undefined;
    chargeItem.performingOrganization = source.performingOrganization
      ? { reference: resolveRef('Organization', source.performingOrganization) || `Organization/${source.performingOrganization}` }
      : undefined;
    chargeItem.requestingOrganization = source.requestingOrganization
      ? { reference: resolveRef('Organization', source.requestingOrganization) || `Organization/${source.requestingOrganization}` }
      : undefined;
    chargeItem.costCenter = source.costCenter
      ? { reference: resolveRef('Organization', source.costCenter) || `Organization/${source.costCenter}` }
      : undefined;
    chargeItem.quantity = mapQuantity(source.quantity);
    chargeItem.bodysite = source.bodysite?.length ? source.bodysite.map(mapCodeableConcept).filter(Boolean) : undefined;
    chargeItem.unitPriceComponent = mapMonetaryComponent(source.unitPriceComponent);
    chargeItem.totalPriceComponent = mapMonetaryComponent(source.totalPriceComponent);
    chargeItem.overrideReason = mapCodeableConcept(source.overrideReason);
    chargeItem.enterer = source.enterer
      ? { reference: resolveAnyRef(resolveRef, [
        'Device',
        'Organization',
        'Patient',
        'Practitioner',
        'PractitionerRole',
        'RelatedPerson'
      ], source.enterer) }
      : undefined;
    chargeItem.enteredDate = source.enteredDate || undefined;
    chargeItem.reason = source.reason?.length ? source.reason.map(mapCodeableConcept).filter(Boolean) : undefined;
    chargeItem.service = source.service?.length
      ? source.service.map(entry => mapCodeableReference(entry, resolveRef, [
        'DiagnosticReport',
        'ImagingStudy',
        'Immunization',
        'MedicationAdministration',
        'MedicationDispense',
        'MedicationRequest',
        'Observation',
        'Procedure',
        'ServiceRequest',
        'SupplyDelivery'
      ]))
      : undefined;
    chargeItem.product = source.product?.length
      ? source.product.map(entry => mapCodeableReference(entry, resolveRef, ['Device', 'Medication', 'Substance']))
      : undefined;
    chargeItem.account = source.account?.length
      ? source.account.map(id => ({
        reference: resolveRef('Account', id) || `Account/${id}`
      }))
      : undefined;
    chargeItem.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;
    chargeItem.supportingInformation = source.supportingInformation?.length
      ? source.supportingInformation.map(ref => ({ reference: ref }))
      : undefined;

    const summary = chargeItem.code?.text || chargeItem.identifier?.[0]?.value || chargeItem.id;
    if (summary) chargeItem.text = makeNarrative('ChargeItem', summary);

    if (operation === 'delete') {
      chargeItem.status = 'entered-in-error';
    }

    const entry: any = {
      resource: chargeItem,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `ChargeItem?identifier=${identifierSystem}|${identifierValue || chargeItem.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `ChargeItem/${chargeItem.id}`
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

function mapPeriod(source?: { start?: string; end?: string }) {
  if (!source || (!source.start && !source.end)) return undefined;
  return {
    start: source.start,
    end: source.end
  };
}

function mapQuantity(source?: { value?: number; unit?: string; system?: string; code?: string }) {
  if (!source || (source.value === undefined && !source.unit && !source.system && !source.code)) return undefined;
  return {
    value: source.value,
    unit: source.unit,
    system: source.system,
    code: source.code
  };
}

function mapMonetaryComponent(source?: { amount?: { value?: number; currency?: string } }) {
  if (!source || (!source.amount?.value && !source.amount?.currency)) return undefined;
  return {
    amount: {
      value: source.amount?.value,
      currency: source.amount?.currency
    }
  };
}

function mapCodeableReference(
  source: { reference?: string; code?: { system?: string; code?: string; display?: string } } | undefined,
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined,
  resourceTypes: string[]
) {
  if (!source) return undefined;
  const reference = source.reference
    ? resolveAnyRef(resolveRef, resourceTypes, source.reference)
    : undefined;
  const concept = mapCodeableConcept(source.code);
  if (!reference && !concept) return undefined;
  return {
    reference: reference ? { reference } : undefined,
    concept
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
