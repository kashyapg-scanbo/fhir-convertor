import crypto from 'crypto';
import accountTemplate from '../../shared/templates/account.json' with { type: 'json' };
import type { CanonicalAccount, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface AccountMapperArgs {
  accounts?: CanonicalAccount[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapAccounts({
  accounts,
  operation,
  registry,
  resolveRef
}: AccountMapperArgs) {
  if (!accounts || accounts.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < accounts.length; index++) {
    const source = accounts[index];
    const account = structuredClone(accountTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    account.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${account.id}`;

    account.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'Account',
      {
        identifier: source.id || source.identifier?.[0]?.value || account.id,
        id: account.id
      },
      fullUrl
    );

    account.status = source.status || undefined;
    account.billingStatus = mapCodeableConcept(source.billingStatus);
    account.type = mapCodeableConcept(source.type);
    account.name = source.name || undefined;
    account.subject = source.subject?.length
      ? source.subject
        .map(value => resolveAnyRef(resolveRef, [
          'Device',
          'HealthcareService',
          'Location',
          'Organization',
          'Patient',
          'Practitioner',
          'PractitionerRole'
        ], value))
        .filter((reference): reference is string => Boolean(reference))
        .map(reference => ({ reference }))
      : undefined;
    account.servicePeriod = mapPeriod(source.servicePeriod);
    account.coverage = source.coverage?.length
      ? source.coverage.map(entry => ({
        coverage: entry.coverage
          ? { reference: resolveRef('Coverage', entry.coverage) || `Coverage/${entry.coverage}` }
          : undefined,
        priority: entry.priority ?? undefined
      }))
      : undefined;
    account.owner = source.owner
      ? { reference: resolveRef('Organization', source.owner) || `Organization/${source.owner}` }
      : undefined;
    account.description = source.description || undefined;
    account.guarantor = source.guarantor?.length
      ? source.guarantor.map(entry => ({
        party: entry.party
          ? { reference: resolveAnyRef(resolveRef, ['Organization', 'Patient', 'RelatedPerson'], entry.party) }
          : undefined,
        onHold: entry.onHold ?? undefined,
        period: mapPeriod(entry.period)
      }))
      : undefined;
    account.diagnosis = source.diagnosis?.length
      ? source.diagnosis.map(entry => ({
        sequence: entry.sequence ?? undefined,
        condition: mapCodeableReference(entry.condition, resolveRef, 'Condition'),
        dateOfDiagnosis: entry.dateOfDiagnosis || undefined,
        type: entry.type?.map(mapCodeableConcept).filter(Boolean),
        onAdmission: entry.onAdmission ?? undefined,
        packageCode: entry.packageCode?.map(mapCodeableConcept).filter(Boolean)
      }))
      : undefined;
    account.procedure = source.procedure?.length
      ? source.procedure.map(entry => ({
        sequence: entry.sequence ?? undefined,
        code: mapCodeableReference(entry.code, resolveRef, 'Procedure'),
        dateOfService: entry.dateOfService || undefined,
        type: entry.type?.map(mapCodeableConcept).filter(Boolean),
        packageCode: entry.packageCode?.map(mapCodeableConcept).filter(Boolean),
        device: entry.device?.map(id => ({
          reference: resolveRef('Device', id) || `Device/${id}`
        }))
      }))
      : undefined;
    account.relatedAccount = source.relatedAccount?.length
      ? source.relatedAccount.map(entry => ({
        relationship: mapCodeableConcept(entry.relationship),
        account: entry.account
          ? { reference: resolveRef('Account', entry.account) || `Account/${entry.account}` }
          : undefined
      }))
      : undefined;
    account.currency = mapCodeableConcept(source.currency);
    account.balance = source.balance?.length
      ? source.balance.map(entry => ({
        aggregate: mapCodeableConcept(entry.aggregate),
        term: mapCodeableConcept(entry.term),
        estimate: entry.estimate ?? undefined,
        amount: mapMoney(entry.amount)
      }))
      : undefined;
    account.calculatedAt = source.calculatedAt || undefined;

    const summary = account.name || account.identifier?.[0]?.value || account.id;
    if (summary) account.text = makeNarrative('Account', summary);

    if (operation === 'delete') {
      account.status = 'entered-in-error';
    }

    const entry: any = {
      resource: account,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Account?identifier=${identifierSystem}|${identifierValue || account.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Account/${account.id}`
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

function mapMoney(source?: { value?: number; currency?: string }) {
  if (!source || (source.value === undefined && !source.currency)) return undefined;
  return {
    value: source.value,
    currency: source.currency
  };
}

function mapCodeableReference(
  source: { reference?: string; code?: { system?: string; code?: string; display?: string } } | undefined,
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined,
  resourceType: string
) {
  if (!source) return undefined;
  const referenceValue = source.reference
    ? resolveRef(resourceType, source.reference) || `${resourceType}/${source.reference}`
    : undefined;
  const concept = mapCodeableConcept(source.code);
  if (!referenceValue && !concept) return undefined;
  return {
    reference: referenceValue,
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
