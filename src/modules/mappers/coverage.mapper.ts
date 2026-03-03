import crypto from 'crypto';
import coverageTemplate from '../../shared/templates/coverage.json' with { type: 'json' };
import type { CanonicalCoverage, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface CoverageMapperArgs {
  coverages?: CanonicalCoverage[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapCoverages({
  coverages,
  operation,
  registry,
  resolveRef
}: CoverageMapperArgs) {
  if (!coverages || coverages.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < coverages.length; index++) {
    const source = coverages[index];
    const coverage = structuredClone(coverageTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    coverage.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${coverage.id}`;
    coverage.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'Coverage',
      {
        identifier: source.id || source.identifier?.[0]?.value || coverage.id,
        id: coverage.id
      },
      fullUrl
    );

    coverage.status = source.status || undefined;
    coverage.kind = source.kind || undefined;
    coverage.paymentBy = source.paymentBy?.length
      ? source.paymentBy.map(entry => ({
        party: entry.party
          ? { reference: resolveAnyRef(resolveRef, ['Organization', 'Patient', 'RelatedPerson'], entry.party) }
          : undefined,
        responsibility: entry.responsibility || undefined
      }))
      : undefined;
    coverage.type = mapCodeableConcept(source.type);
    coverage.policyHolder = source.policyHolder
      ? { reference: resolveAnyRef(resolveRef, ['Organization', 'Patient', 'RelatedPerson'], source.policyHolder) }
      : undefined;
    coverage.subscriber = source.subscriber
      ? { reference: resolveAnyRef(resolveRef, ['Patient', 'RelatedPerson'], source.subscriber) }
      : undefined;
    coverage.subscriberId = source.subscriberId?.length
      ? source.subscriberId.map(mapIdentifier).filter(Boolean)
      : undefined;
    coverage.beneficiary = source.beneficiary
      ? { reference: resolveRef('Patient', source.beneficiary) || `Patient/${source.beneficiary}` }
      : undefined;
    coverage.dependent = source.dependent || undefined;
    coverage.relationship = mapCodeableConcept(source.relationship);
    coverage.period = mapPeriod(source.period);
    coverage.insurer = source.insurer
      ? { reference: resolveRef('Organization', source.insurer) || `Organization/${source.insurer}` }
      : undefined;
    coverage.class = source.class?.length
      ? source.class.map(entry => ({
        type: mapCodeableConcept(entry.type),
        value: entry.value ? mapIdentifier(entry.value) : undefined,
        name: entry.name || undefined
      }))
      : undefined;
    coverage.order = source.order ?? undefined;
    coverage.network = source.network || undefined;
    coverage.costToBeneficiary = source.costToBeneficiary?.length
      ? source.costToBeneficiary.map(cost => ({
        type: mapCodeableConcept(cost.type),
        category: mapCodeableConcept(cost.category),
        network: mapCodeableConcept(cost.network),
        unit: mapCodeableConcept(cost.unit),
        term: mapCodeableConcept(cost.term),
        valueQuantity: mapQuantity(cost.valueQuantity),
        valueMoney: mapMoney(cost.valueMoney),
        exception: cost.exception?.length
          ? cost.exception.map(ex => ({
            type: mapCodeableConcept(ex.type),
            period: mapPeriod(ex.period)
          }))
          : undefined
      }))
      : undefined;
    coverage.subrogation = source.subrogation ?? undefined;
    coverage.contract = source.contract?.length
      ? source.contract.map(ref => ({ reference: resolveRef('Contract', ref) || `Contract/${ref}` }))
      : undefined;
    coverage.insurancePlan = source.insurancePlan
      ? { reference: resolveRef('InsurancePlan', source.insurancePlan) || `InsurancePlan/${source.insurancePlan}` }
      : undefined;

    const summary = coverage.identifier?.[0]?.value || coverage.id;
    if (summary) coverage.text = makeNarrative('Coverage', summary);

    if (operation === 'delete') {
      coverage.status = 'entered-in-error';
    }

    const entry: any = {
      resource: coverage,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Coverage?identifier=${identifierSystem}|${identifierValue || coverage.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Coverage/${coverage.id}`
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

function mapMoney(source?: { value?: number; currency?: string }) {
  if (!source || source.value === undefined && !source.currency) return undefined;
  return {
    value: source.value,
    currency: source.currency
  };
}

function mapQuantity(source?: { value?: number; unit?: string; system?: string; code?: string }) {
  if (!source || source.value === undefined && !source.unit && !source.system && !source.code) return undefined;
  return {
    value: source.value,
    unit: source.unit,
    system: source.system,
    code: source.code
  };
}

function mapPeriod(source?: { start?: string; end?: string }) {
  if (!source || (!source.start && !source.end)) return undefined;
  return {
    start: source.start,
    end: source.end
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
