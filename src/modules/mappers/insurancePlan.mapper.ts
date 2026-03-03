import crypto from 'crypto';
import insurancePlanTemplate from '../../shared/templates/insurancePlan.json' with { type: 'json' };
import type { CanonicalInsurancePlan, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface InsurancePlanMapperArgs {
  insurancePlans?: CanonicalInsurancePlan[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapInsurancePlans({
  insurancePlans,
  operation,
  registry,
  resolveRef
}: InsurancePlanMapperArgs) {
  if (!insurancePlans || insurancePlans.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of insurancePlans) {
    const plan = structuredClone(insurancePlanTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    plan.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${plan.id}`;

    plan.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'InsurancePlan',
      { identifier: source.id || source.identifier?.[0]?.value || plan.id, id: plan.id },
      fullUrl
    );

    plan.status = source.status || undefined;
    plan.type = source.type?.map(mapCodeableConcept);
    plan.name = source.name || undefined;
    plan.alias = source.alias?.length ? source.alias : undefined;
    plan.period = source.period ? { ...source.period } : undefined;
    plan.ownedBy = source.ownedBy
      ? { reference: resolveRef('Organization', source.ownedBy) || normalizeReference(source.ownedBy) }
      : undefined;
    plan.administeredBy = source.administeredBy
      ? { reference: resolveRef('Organization', source.administeredBy) || normalizeReference(source.administeredBy) }
      : undefined;
    plan.coverageArea = source.coverageArea?.map(ref => ({
      reference: resolveRef('Location', ref) || normalizeReference(ref)
    }));
    plan.contact = source.contact?.map(contact => ({
      name: contact.name,
      telecom: contact.telecom
    }));
    plan.endpoint = source.endpoint?.map(ref => ({
      reference: resolveRef('Endpoint', ref) || normalizeReference(ref)
    }));
    plan.network = source.network?.map(ref => ({
      reference: resolveRef('Organization', ref) || normalizeReference(ref)
    }));

    plan.coverage = source.coverage?.map(item => ({
      type: item.type ? mapCodeableConcept(item.type) : undefined,
      network: item.network?.map(ref => ({
        reference: resolveRef('Organization', ref) || normalizeReference(ref)
      })),
      benefit: item.benefit?.map(benefit => ({
        type: benefit.type ? mapCodeableConcept(benefit.type) : undefined,
        requirement: benefit.requirement,
        limit: benefit.limit?.map(limit => ({
          value: limit.value ? mapQuantity(limit.value) : undefined,
          code: limit.code ? mapCodeableConcept(limit.code) : undefined
        }))
      }))
    }));

    plan.plan = source.plan?.map(item => ({
      identifier: item.identifier?.map(mapIdentifier).filter(Boolean),
      type: item.type ? mapCodeableConcept(item.type) : undefined,
      coverageArea: item.coverageArea?.map(ref => ({
        reference: resolveRef('Location', ref) || normalizeReference(ref)
      })),
      network: item.network?.map(ref => ({
        reference: resolveRef('Organization', ref) || normalizeReference(ref)
      })),
      generalCost: item.generalCost?.map(cost => ({
        type: cost.type ? mapCodeableConcept(cost.type) : undefined,
        groupSize: cost.groupSize,
        cost: cost.cost,
        comment: cost.comment
      })),
      specificCost: item.specificCost?.map(cost => ({
        category: cost.category ? mapCodeableConcept(cost.category) : undefined,
        benefit: cost.benefit?.map(benefit => ({
          type: benefit.type ? mapCodeableConcept(benefit.type) : undefined,
          cost: benefit.cost?.map(costItem => ({
            type: costItem.type ? mapCodeableConcept(costItem.type) : undefined,
            applicability: costItem.applicability ? mapCodeableConcept(costItem.applicability) : undefined,
            qualifiers: costItem.qualifiers?.map(mapCodeableConcept),
            value: costItem.value ? mapQuantity(costItem.value) : undefined
          }))
        }))
      }))
    }));

    const summary = plan.name || plan.id;
    if (summary) plan.text = makeNarrative('InsurancePlan', summary);

    if (operation === 'delete') {
      plan.status = 'entered-in-error';
    }

    const entry: any = { resource: plan, fullUrl };
    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `InsurancePlan?identifier=${identifierSystem}|${identifierValue || plan.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = { method: 'PUT', url: `InsurancePlan/${plan.id}` };
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

function mapQuantity(source: { value?: number; unit?: string; system?: string; code?: string }) {
  return {
    value: source.value,
    unit: source.unit,
    system: source.system,
    code: source.code
  };
}

function normalizeReference(value: string) {
  return value.trim().replace(/^#/, '');
}
