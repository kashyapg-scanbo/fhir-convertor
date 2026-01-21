import crypto from 'crypto';
import claimResponseTemplate from '../../shared/templates/claimResponse.json' with { type: 'json' };
import type { CanonicalClaimResponse, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ClaimResponseMapperArgs {
  claimResponses?: CanonicalClaimResponse[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapClaimResponses({
  claimResponses,
  operation,
  registry,
  resolveRef
}: ClaimResponseMapperArgs) {
  if (!claimResponses || claimResponses.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < claimResponses.length; index++) {
    const source = claimResponses[index];
    const response = structuredClone(claimResponseTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    response.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${response.id}`;
    response.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'ClaimResponse',
      {
        identifier: source.id || source.identifier?.[0]?.value || response.id,
        id: response.id
      },
      fullUrl
    );

    response.traceNumber = source.traceNumber?.length ? source.traceNumber.map(mapIdentifier).filter(Boolean) : undefined;
    response.status = source.status || undefined;
    response.type = mapCodeableConcept(source.type);
    response.subType = mapCodeableConcept(source.subType);
    response.use = source.use || undefined;
    response.patient = source.patient ? { reference: resolveRef('Patient', source.patient) || `Patient/${source.patient}` } : undefined;
    response.created = source.created || undefined;
    response.insurer = source.insurer ? { reference: resolveRef('Organization', source.insurer) || `Organization/${source.insurer}` } : undefined;
    response.requestor = source.requestor
      ? { reference: resolveAnyRef(resolveRef, ['Organization', 'Practitioner', 'PractitionerRole'], source.requestor) }
      : undefined;
    response.request = source.request ? { reference: resolveRef('Claim', source.request) || `Claim/${source.request}` } : undefined;
    response.outcome = source.outcome || undefined;
    response.decision = mapCodeableConcept(source.decision);
    response.disposition = source.disposition || undefined;
    response.preAuthRef = source.preAuthRef || undefined;
    response.preAuthPeriod = mapPeriod(source.preAuthPeriod);
    response.event = source.event?.length
      ? source.event.map(evt => ({
        type: mapCodeableConcept(evt.type),
        whenDateTime: evt.whenDateTime || undefined,
        whenPeriod: mapPeriod(evt.whenPeriod)
      }))
      : undefined;
    response.payeeType = mapCodeableConcept(source.payeeType);
    response.encounter = source.encounter?.length
      ? source.encounter.map(ref => ({ reference: resolveRef('Encounter', ref) || `Encounter/${ref}` }))
      : undefined;
    response.diagnosisRelatedGroup = mapCodeableConcept(source.diagnosisRelatedGroup);
    response.item = source.item?.length ? source.item.map(item => mapItem(item, resolveRef)) : undefined;
    response.addItem = source.addItem?.length ? source.addItem.map(item => mapAddItem(item, resolveRef)) : undefined;
    response.adjudication = source.adjudication?.length ? source.adjudication.map(mapAdjudication).filter(Boolean) : undefined;
    response.total = source.total?.length
      ? source.total.map(total => ({
        category: mapCodeableConcept(total.category),
        amount: mapMoney(total.amount)
      }))
      : undefined;
    response.payment = source.payment ? {
      type: mapCodeableConcept(source.payment.type),
      adjustment: mapMoney(source.payment.adjustment),
      adjustmentReason: mapCodeableConcept(source.payment.adjustmentReason),
      date: source.payment.date || undefined,
      amount: mapMoney(source.payment.amount),
      identifier: mapIdentifier(source.payment.identifier)
    } : undefined;
    response.fundsReserve = mapCodeableConcept(source.fundsReserve);
    response.formCode = mapCodeableConcept(source.formCode);
    response.form = mapAttachment(source.form);
    response.processNote = source.processNote?.length
      ? source.processNote.map(note => ({
        number: note.number ?? undefined,
        type: mapCodeableConcept(note.type),
        text: note.text || undefined,
        language: mapCodeableConcept(note.language)
      }))
      : undefined;
    response.communicationRequest = source.communicationRequest?.length
      ? source.communicationRequest.map(ref => ({ reference: resolveRef('CommunicationRequest', ref) || `CommunicationRequest/${ref}` }))
      : undefined;
    response.insurance = source.insurance?.length
      ? source.insurance.map(ins => ({
        sequence: ins.sequence ?? undefined,
        focal: ins.focal ?? undefined,
        coverage: ins.coverage ? { reference: resolveRef('Coverage', ins.coverage) || `Coverage/${ins.coverage}` } : undefined,
        businessArrangement: ins.businessArrangement || undefined,
        claimResponse: ins.claimResponse ? { reference: resolveRef('ClaimResponse', ins.claimResponse) || `ClaimResponse/${ins.claimResponse}` } : undefined
      }))
      : undefined;
    response.error = source.error?.length
      ? source.error.map(err => ({
        itemSequence: err.itemSequence ?? undefined,
        detailSequence: err.detailSequence ?? undefined,
        subDetailSequence: err.subDetailSequence ?? undefined,
        code: mapCodeableConcept(err.code),
        expression: err.expression?.length ? err.expression : undefined
      }))
      : undefined;

    const responseSummary = response.identifier?.[0]?.value || response.id;
    if (responseSummary) response.text = makeNarrative('ClaimResponse', responseSummary);

    if (operation === 'delete') {
      response.status = 'entered-in-error';
    }

    const entry: any = {
      resource: response,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `ClaimResponse?identifier=${identifierSystem}|${identifierValue || response.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `ClaimResponse/${response.id}`
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

function mapAdjudication(entry: NonNullable<CanonicalClaimResponse['adjudication']>[number]) {
  return {
    category: mapCodeableConcept(entry.category),
    reason: mapCodeableConcept(entry.reason),
    amount: mapMoney(entry.amount),
    quantity: mapQuantity(entry.quantity)
  };
}

function mapReviewOutcome(entry?: {
  decision?: { system?: string; code?: string; display?: string };
  reason?: Array<{ system?: string; code?: string; display?: string }>;
  preAuthRef?: string;
  preAuthPeriod?: { start?: string; end?: string };
}) {
  if (!entry) return undefined;
  return {
    decision: mapCodeableConcept(entry.decision),
    reason: entry.reason?.length ? entry.reason.map(mapCodeableConcept) : undefined,
    preAuthRef: entry.preAuthRef || undefined,
    preAuthPeriod: mapPeriod(entry.preAuthPeriod)
  };
}

function mapItem(item: NonNullable<CanonicalClaimResponse['item']>[number], resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined) {
  return {
    itemSequence: item.itemSequence,
    traceNumber: item.traceNumber?.length ? item.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    noteNumber: item.noteNumber?.length ? item.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(item.reviewOutcome),
    adjudication: item.adjudication?.length ? item.adjudication.map(mapAdjudication).filter(Boolean) : undefined,
    detail: item.detail?.length ? item.detail.map(detail => mapDetail(detail, resolveRef)) : undefined
  };
}

function mapDetail(
  detail: NonNullable<CanonicalClaimResponse['item']>[number]['detail'][number],
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined
) {
  return {
    detailSequence: detail.detailSequence,
    traceNumber: detail.traceNumber?.length ? detail.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    noteNumber: detail.noteNumber?.length ? detail.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(detail.reviewOutcome),
    adjudication: detail.adjudication?.length ? detail.adjudication.map(mapAdjudication).filter(Boolean) : undefined,
    subDetail: detail.subDetail?.length ? detail.subDetail.map(sub => mapSubDetail(sub, resolveRef)) : undefined
  };
}

function mapSubDetail(
  subDetail: NonNullable<NonNullable<CanonicalClaimResponse['item']>[number]['detail'][number]['subDetail']>[number],
  _resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined
) {
  return {
    subDetailSequence: subDetail.subDetailSequence,
    traceNumber: subDetail.traceNumber?.length ? subDetail.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    noteNumber: subDetail.noteNumber?.length ? subDetail.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(subDetail.reviewOutcome),
    adjudication: subDetail.adjudication?.length ? subDetail.adjudication.map(mapAdjudication).filter(Boolean) : undefined
  };
}

function mapAddItem(
  item: NonNullable<CanonicalClaimResponse['addItem']>[number],
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined
) {
  return {
    itemSequence: item.itemSequence?.length ? item.itemSequence : undefined,
    detailSequence: item.detailSequence?.length ? item.detailSequence : undefined,
    subdetailSequence: item.subdetailSequence?.length ? item.subdetailSequence : undefined,
    traceNumber: item.traceNumber?.length ? item.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    provider: item.provider?.length
      ? item.provider.map(ref => ({ reference: resolveAnyRef(resolveRef, ['Organization', 'Practitioner', 'PractitionerRole'], ref) }))
      : undefined,
    revenue: mapCodeableConcept(item.revenue),
    productOrService: mapCodeableConcept(item.productOrService),
    productOrServiceEnd: mapCodeableConcept(item.productOrServiceEnd),
    request: item.request?.length
      ? item.request.map(ref => ({ reference: resolveAnyRef(resolveRef, ['DeviceRequest', 'MedicationRequest', 'NutritionOrder', 'ServiceRequest', 'SupplyRequest', 'VisionPrescription'], ref) }))
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
    quantity: mapQuantity(item.quantity),
    unitPrice: mapMoney(item.unitPrice),
    factor: item.factor ?? undefined,
    tax: mapMoney(item.tax),
    net: mapMoney(item.net),
    bodySite: item.bodySite?.length
      ? item.bodySite.map(site => ({
        site: site.site?.length ? site.site.map(concept => ({ concept: mapCodeableConcept(concept) })) : undefined,
        subSite: site.subSite?.length ? site.subSite.map(mapCodeableConcept) : undefined
      }))
      : undefined,
    noteNumber: item.noteNumber?.length ? item.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(item.reviewOutcome),
    adjudication: item.adjudication?.length ? item.adjudication.map(mapAdjudication).filter(Boolean) : undefined,
    detail: item.detail?.length ? item.detail.map(detail => mapAddItemDetail(detail, resolveRef)) : undefined
  };
}

function mapAddItemDetail(
  detail: NonNullable<CanonicalClaimResponse['addItem']>[number]['detail'][number],
  _resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined
) {
  return {
    traceNumber: detail.traceNumber?.length ? detail.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    revenue: mapCodeableConcept(detail.revenue),
    productOrService: mapCodeableConcept(detail.productOrService),
    productOrServiceEnd: mapCodeableConcept(detail.productOrServiceEnd),
    modifier: detail.modifier?.length ? detail.modifier.map(mapCodeableConcept) : undefined,
    quantity: mapQuantity(detail.quantity),
    unitPrice: mapMoney(detail.unitPrice),
    factor: detail.factor ?? undefined,
    tax: mapMoney(detail.tax),
    net: mapMoney(detail.net),
    noteNumber: detail.noteNumber?.length ? detail.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(detail.reviewOutcome),
    adjudication: detail.adjudication?.length ? detail.adjudication.map(mapAdjudication).filter(Boolean) : undefined,
    subDetail: detail.subDetail?.length ? detail.subDetail.map(mapAddItemSubDetail) : undefined
  };
}

function mapAddItemSubDetail(
  subDetail: NonNullable<NonNullable<CanonicalClaimResponse['addItem']>[number]['detail'][number]['subDetail']>[number]
) {
  return {
    traceNumber: subDetail.traceNumber?.length ? subDetail.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    revenue: mapCodeableConcept(subDetail.revenue),
    productOrService: mapCodeableConcept(subDetail.productOrService),
    productOrServiceEnd: mapCodeableConcept(subDetail.productOrServiceEnd),
    modifier: subDetail.modifier?.length ? subDetail.modifier.map(mapCodeableConcept) : undefined,
    quantity: mapQuantity(subDetail.quantity),
    unitPrice: mapMoney(subDetail.unitPrice),
    factor: subDetail.factor ?? undefined,
    tax: mapMoney(subDetail.tax),
    net: mapMoney(subDetail.net),
    noteNumber: subDetail.noteNumber?.length ? subDetail.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(subDetail.reviewOutcome),
    adjudication: subDetail.adjudication?.length ? subDetail.adjudication.map(mapAdjudication).filter(Boolean) : undefined
  };
}
