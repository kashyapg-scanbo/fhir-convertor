import crypto from 'crypto';
import claimTemplate from '../../shared/templates/claim.json' with { type: 'json' };
import type { CanonicalClaim, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ClaimMapperArgs {
  claims?: CanonicalClaim[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapClaims({
  claims,
  operation,
  registry,
  resolveRef
}: ClaimMapperArgs) {
  if (!claims || claims.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < claims.length; index++) {
    const source = claims[index];
    const claim = structuredClone(claimTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    claim.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${claim.id}`;
    claim.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'Claim',
      {
        identifier: source.id || source.identifier?.[0]?.value || claim.id,
        id: claim.id
      },
      fullUrl
    );

    claim.traceNumber = source.traceNumber?.length ? source.traceNumber.map(mapIdentifier).filter(Boolean) : undefined;
    claim.status = source.status || undefined;
    claim.type = mapCodeableConcept(source.type);
    claim.subType = mapCodeableConcept(source.subType);
    claim.use = source.use || undefined;
    claim.patient = source.patient ? { reference: resolveRef('Patient', source.patient) || `Patient/${source.patient}` } : undefined;
    claim.billablePeriod = mapPeriod(source.billablePeriod);
    claim.created = source.created || undefined;
    claim.enterer = source.enterer ? { reference: resolveAnyRef(resolveRef, ['Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], source.enterer) } : undefined;
    claim.insurer = source.insurer ? { reference: resolveRef('Organization', source.insurer) || `Organization/${source.insurer}` } : undefined;
    claim.provider = source.provider ? { reference: resolveAnyRef(resolveRef, ['Organization', 'Practitioner', 'PractitionerRole'], source.provider) } : undefined;
    claim.priority = mapCodeableConcept(source.priority);
    claim.fundsReserve = mapCodeableConcept(source.fundsReserve);
    claim.related = source.related?.length
      ? source.related.map(rel => ({
        claim: rel.claim ? { reference: resolveRef('Claim', rel.claim) || `Claim/${rel.claim}` } : undefined,
        relationship: mapCodeableConcept(rel.relationship),
        reference: rel.reference ? mapIdentifier(rel.reference) : undefined
      }))
      : undefined;
    claim.prescription = source.prescription
      ? { reference: resolveAnyRef(resolveRef, ['DeviceRequest', 'MedicationRequest', 'VisionPrescription'], source.prescription) }
      : undefined;
    claim.originalPrescription = source.originalPrescription
      ? { reference: resolveAnyRef(resolveRef, ['DeviceRequest', 'MedicationRequest', 'VisionPrescription'], source.originalPrescription) }
      : undefined;
    claim.payee = source.payee ? {
      type: mapCodeableConcept(source.payee.type),
      party: source.payee.party ? { reference: resolveAnyRef(resolveRef, ['Organization', 'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], source.payee.party) } : undefined
    } : undefined;
    claim.referral = source.referral ? { reference: resolveRef('ServiceRequest', source.referral) || `ServiceRequest/${source.referral}` } : undefined;
    claim.encounter = source.encounter?.length
      ? source.encounter.map(ref => ({ reference: resolveRef('Encounter', ref) || `Encounter/${ref}` }))
      : undefined;
    claim.facility = source.facility
      ? { reference: resolveAnyRef(resolveRef, ['Location', 'Organization'], source.facility) }
      : undefined;
    claim.diagnosisRelatedGroup = mapCodeableConcept(source.diagnosisRelatedGroup);
    claim.event = source.event?.length
      ? source.event.map(evt => ({
        type: mapCodeableConcept(evt.type),
        whenDateTime: evt.whenDateTime || undefined,
        whenPeriod: mapPeriod(evt.whenPeriod)
      }))
      : undefined;
    claim.careTeam = source.careTeam?.length
      ? source.careTeam.map(team => ({
        sequence: team.sequence,
        provider: team.provider ? { reference: resolveAnyRef(resolveRef, ['Organization', 'Practitioner', 'PractitionerRole'], team.provider) } : undefined,
        responsible: team.responsible ?? undefined,
        role: mapCodeableConcept(team.role),
        specialty: mapCodeableConcept(team.specialty)
      }))
      : undefined;
    claim.supportingInfo = source.supportingInfo?.length
      ? source.supportingInfo.map(info => ({
        sequence: info.sequence,
        category: mapCodeableConcept(info.category),
        code: mapCodeableConcept(info.code),
        timingDate: info.timingDate || undefined,
        timingPeriod: mapPeriod(info.timingPeriod),
        valueBoolean: info.valueBoolean ?? undefined,
        valueString: info.valueString || undefined,
        valueQuantity: mapQuantity(info.valueQuantity),
        valueAttachment: mapAttachment(info.valueAttachment),
        valueReference: info.valueReference ? { reference: resolveAnyRef(resolveRef, [], info.valueReference) } : undefined,
        valueIdentifier: mapIdentifier(info.valueIdentifier),
        reason: mapCodeableConcept(info.reason)
      }))
      : undefined;
    claim.diagnosis = source.diagnosis?.length
      ? source.diagnosis.map(diag => ({
        sequence: diag.sequence,
        diagnosisCodeableConcept: mapCodeableConcept(diag.diagnosisCodeableConcept),
        diagnosisReference: diag.diagnosisReference
          ? { reference: resolveRef('Condition', diag.diagnosisReference) || `Condition/${diag.diagnosisReference}` }
          : undefined,
        type: diag.type?.length ? diag.type.map(mapCodeableConcept) : undefined,
        onAdmission: mapCodeableConcept(diag.onAdmission)
      }))
      : undefined;
    claim.procedure = source.procedure?.length
      ? source.procedure.map(proc => ({
        sequence: proc.sequence,
        type: proc.type?.length ? proc.type.map(mapCodeableConcept) : undefined,
        date: proc.date || undefined,
        procedureCodeableConcept: mapCodeableConcept(proc.procedureCodeableConcept),
        procedureReference: proc.procedureReference
          ? { reference: resolveRef('Procedure', proc.procedureReference) || `Procedure/${proc.procedureReference}` }
          : undefined,
        udi: proc.udi?.length ? proc.udi.map(udi => ({ reference: resolveRef('Device', udi) || `Device/${udi}` })) : undefined
      }))
      : undefined;
    claim.insurance = source.insurance?.length
      ? source.insurance.map(ins => ({
        sequence: ins.sequence,
        focal: ins.focal ?? undefined,
        identifier: mapIdentifier(ins.identifier),
        coverage: ins.coverage ? { reference: resolveRef('Coverage', ins.coverage) || `Coverage/${ins.coverage}` } : undefined,
        businessArrangement: ins.businessArrangement || undefined,
        preAuthRef: ins.preAuthRef?.length ? ins.preAuthRef : undefined,
        claimResponse: ins.claimResponse ? { reference: resolveRef('ClaimResponse', ins.claimResponse) || `ClaimResponse/${ins.claimResponse}` } : undefined
      }))
      : undefined;
    claim.accident = source.accident ? {
      date: source.accident.date || undefined,
      type: mapCodeableConcept(source.accident.type),
      locationAddress: mapAddress(source.accident.locationAddress),
      locationReference: source.accident.locationReference
        ? { reference: resolveRef('Location', source.accident.locationReference) || `Location/${source.accident.locationReference}` }
        : undefined
    } : undefined;
    claim.patientPaid = mapMoney(source.patientPaid);
    claim.item = source.item?.length ? source.item.map(item => mapItem(item, resolveRef)) : undefined;
    claim.total = mapMoney(source.total);

    const claimSummary = claim.identifier?.[0]?.value || claim.id;
    if (claimSummary) claim.text = makeNarrative('Claim', claimSummary);

    if (operation === 'delete') {
      claim.status = 'entered-in-error';
    }

    const entry: any = {
      resource: claim,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Claim?identifier=${identifierSystem}|${identifierValue || claim.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Claim/${claim.id}`
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

function mapAttachment(source?: { contentType?: string; url?: string; title?: string; data?: string }) {
  if (!source) return undefined;
  return {
    contentType: source.contentType,
    url: source.url,
    title: source.title,
    data: source.data
  };
}

function mapAddress(source?: { line?: string[]; city?: string; state?: string; postalCode?: string; country?: string }) {
  if (!source) return undefined;
  return {
    line: source.line,
    city: source.city,
    state: source.state,
    postalCode: source.postalCode,
    country: source.country
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

type ClaimItem = NonNullable<CanonicalClaim['item']>[number];
type ClaimItemDetail = NonNullable<ClaimItem['detail']>[number];
type ClaimItemSubDetail = NonNullable<ClaimItemDetail['subDetail']>[number];

function mapItem(item: ClaimItem, resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined) {
  return {
    sequence: item.sequence,
    traceNumber: item.traceNumber?.length ? item.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    careTeamSequence: item.careTeamSequence?.length ? item.careTeamSequence : undefined,
    diagnosisSequence: item.diagnosisSequence?.length ? item.diagnosisSequence : undefined,
    procedureSequence: item.procedureSequence?.length ? item.procedureSequence : undefined,
    informationSequence: item.informationSequence?.length ? item.informationSequence : undefined,
    revenue: mapCodeableConcept(item.revenue),
    category: mapCodeableConcept(item.category),
    productOrService: mapCodeableConcept(item.productOrService),
    productOrServiceEnd: mapCodeableConcept(item.productOrServiceEnd),
    request: item.request?.length
      ? item.request.map(req => ({ reference: resolveAnyRef(resolveRef, ['DeviceRequest', 'MedicationRequest', 'NutritionOrder', 'ServiceRequest', 'SupplyRequest', 'VisionPrescription'], req) }))
      : undefined,
    modifier: item.modifier?.length ? item.modifier.map(mapCodeableConcept) : undefined,
    programCode: item.programCode?.length ? item.programCode.map(mapCodeableConcept) : undefined,
    servicedDate: item.servicedDate || undefined,
    servicedPeriod: mapPeriod(item.servicedPeriod),
    locationCodeableConcept: mapCodeableConcept(item.locationCodeableConcept),
    locationAddress: mapAddress(item.locationAddress),
    locationReference: item.locationReference
      ? { reference: resolveRef('Location', item.locationReference) || `Location/${item.locationReference}` }
      : undefined,
    patientPaid: mapMoney(item.patientPaid),
    quantity: mapQuantity(item.quantity),
    unitPrice: mapMoney(item.unitPrice),
    factor: item.factor ?? undefined,
    tax: mapMoney(item.tax),
    net: mapMoney(item.net),
    udi: item.udi?.length ? item.udi.map(id => ({ reference: resolveRef('Device', id) || `Device/${id}` })) : undefined,
    bodySite: item.bodySite?.length
      ? item.bodySite.map(site => ({
        site: site.site?.length ? site.site.map(concept => ({ concept: mapCodeableConcept(concept) })) : undefined,
        subSite: site.subSite?.length ? site.subSite.map(mapCodeableConcept) : undefined
      }))
      : undefined,
    encounter: item.encounter?.length
      ? item.encounter.map(ref => ({ reference: resolveRef('Encounter', ref) || `Encounter/${ref}` }))
      : undefined,
    detail: item.detail?.length ? item.detail.map(detail => mapDetail(detail, resolveRef)) : undefined
  };
}

function mapDetail(
  detail: ClaimItemDetail,
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined
) {
  return {
    sequence: detail.sequence,
    traceNumber: detail.traceNumber?.length ? detail.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    revenue: mapCodeableConcept(detail.revenue),
    category: mapCodeableConcept(detail.category),
    productOrService: mapCodeableConcept(detail.productOrService),
    productOrServiceEnd: mapCodeableConcept(detail.productOrServiceEnd),
    modifier: detail.modifier?.length ? detail.modifier.map(mapCodeableConcept) : undefined,
    programCode: detail.programCode?.length ? detail.programCode.map(mapCodeableConcept) : undefined,
    patientPaid: mapMoney(detail.patientPaid),
    quantity: mapQuantity(detail.quantity),
    unitPrice: mapMoney(detail.unitPrice),
    factor: detail.factor ?? undefined,
    tax: mapMoney(detail.tax),
    net: mapMoney(detail.net),
    udi: detail.udi?.length ? detail.udi.map(id => ({ reference: resolveRef('Device', id) || `Device/${id}` })) : undefined,
    subDetail: detail.subDetail?.length ? detail.subDetail.map(sub => mapSubDetail(sub, resolveRef)) : undefined
  };
}

function mapSubDetail(
  subDetail: ClaimItemSubDetail,
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined
) {
  return {
    sequence: subDetail.sequence,
    traceNumber: subDetail.traceNumber?.length ? subDetail.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    revenue: mapCodeableConcept(subDetail.revenue),
    category: mapCodeableConcept(subDetail.category),
    productOrService: mapCodeableConcept(subDetail.productOrService),
    productOrServiceEnd: mapCodeableConcept(subDetail.productOrServiceEnd),
    modifier: subDetail.modifier?.length ? subDetail.modifier.map(mapCodeableConcept) : undefined,
    programCode: subDetail.programCode?.length ? subDetail.programCode.map(mapCodeableConcept) : undefined,
    patientPaid: mapMoney(subDetail.patientPaid),
    quantity: mapQuantity(subDetail.quantity),
    unitPrice: mapMoney(subDetail.unitPrice),
    factor: subDetail.factor ?? undefined,
    tax: mapMoney(subDetail.tax),
    net: mapMoney(subDetail.net),
    udi: subDetail.udi?.length ? subDetail.udi.map(id => ({ reference: resolveRef('Device', id) || `Device/${id}` })) : undefined
  };
}
