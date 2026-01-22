import crypto from 'crypto';
import explanationOfBenefitTemplate from '../../shared/templates/explanationOfBenefit.json' with { type: 'json' };
import type { CanonicalExplanationOfBenefit, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ExplanationOfBenefitMapperArgs {
  explanationOfBenefits?: CanonicalExplanationOfBenefit[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapExplanationOfBenefits({
  explanationOfBenefits,
  operation,
  registry,
  resolveRef
}: ExplanationOfBenefitMapperArgs) {
  if (!explanationOfBenefits || explanationOfBenefits.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < explanationOfBenefits.length; index++) {
    const source = explanationOfBenefits[index];
    const eob = structuredClone(explanationOfBenefitTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    eob.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${eob.id}`;
    eob.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'ExplanationOfBenefit',
      {
        identifier: source.id || source.identifier?.[0]?.value || eob.id,
        id: eob.id
      },
      fullUrl
    );

    eob.traceNumber = source.traceNumber?.length ? source.traceNumber.map(mapIdentifier).filter(Boolean) : undefined;
    eob.status = source.status || undefined;
    eob.type = mapCodeableConcept(source.type);
    eob.subType = mapCodeableConcept(source.subType);
    eob.use = source.use || undefined;
    eob.patient = source.patient
      ? { reference: resolveRef('Patient', source.patient) || `Patient/${source.patient}` }
      : undefined;
    eob.billablePeriod = mapPeriod(source.billablePeriod);
    eob.created = source.created || undefined;
    eob.enterer = source.enterer
      ? { reference: resolveAnyRef(resolveRef, ['Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], source.enterer) }
      : undefined;
    eob.insurer = source.insurer
      ? { reference: resolveRef('Organization', source.insurer) || `Organization/${source.insurer}` }
      : undefined;
    eob.provider = source.provider
      ? { reference: resolveAnyRef(resolveRef, ['Organization', 'Practitioner', 'PractitionerRole'], source.provider) }
      : undefined;
    eob.priority = mapCodeableConcept(source.priority);
    eob.fundsReserveRequested = mapCodeableConcept(source.fundsReserveRequested);
    eob.fundsReserve = mapCodeableConcept(source.fundsReserve);
    eob.related = source.related?.length
      ? source.related.map(rel => ({
        claim: rel.claim ? { reference: resolveRef('Claim', rel.claim) || `Claim/${rel.claim}` } : undefined,
        relationship: mapCodeableConcept(rel.relationship),
        reference: rel.reference ? mapIdentifier(rel.reference) : undefined
      }))
      : undefined;
    eob.prescription = source.prescription
      ? { reference: resolveAnyRef(resolveRef, ['MedicationRequest', 'VisionPrescription'], source.prescription) }
      : undefined;
    eob.originalPrescription = source.originalPrescription
      ? { reference: resolveRef('MedicationRequest', source.originalPrescription) || `MedicationRequest/${source.originalPrescription}` }
      : undefined;
    eob.event = source.event?.length
      ? source.event.map(evt => ({
        type: mapCodeableConcept(evt.type),
        whenDateTime: evt.whenDateTime || undefined,
        whenPeriod: mapPeriod(evt.whenPeriod)
      }))
      : undefined;
    eob.payee = source.payee ? {
      type: mapCodeableConcept(source.payee.type),
      party: source.payee.party
        ? { reference: resolveAnyRef(resolveRef, ['Organization', 'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], source.payee.party) }
        : undefined
    } : undefined;
    eob.referral = source.referral
      ? { reference: resolveRef('ServiceRequest', source.referral) || `ServiceRequest/${source.referral}` }
      : undefined;
    eob.encounter = source.encounter?.length
      ? source.encounter.map(ref => ({ reference: resolveRef('Encounter', ref) || `Encounter/${ref}` }))
      : undefined;
    eob.facility = source.facility
      ? { reference: resolveAnyRef(resolveRef, ['Location', 'Organization'], source.facility) }
      : undefined;
    eob.claim = source.claim ? { reference: resolveRef('Claim', source.claim) || `Claim/${source.claim}` } : undefined;
    eob.claimResponse = source.claimResponse
      ? { reference: resolveRef('ClaimResponse', source.claimResponse) || `ClaimResponse/${source.claimResponse}` }
      : undefined;
    eob.outcome = source.outcome || undefined;
    eob.decision = mapCodeableConcept(source.decision);
    eob.disposition = source.disposition || undefined;
    eob.preAuthRef = source.preAuthRef?.length ? source.preAuthRef : undefined;
    eob.preAuthRefPeriod = source.preAuthRefPeriod?.length
      ? source.preAuthRefPeriod.map(mapPeriod).filter(Boolean)
      : undefined;
    eob.diagnosisRelatedGroup = mapCodeableConcept(source.diagnosisRelatedGroup);
    eob.careTeam = source.careTeam?.length
      ? source.careTeam.map(entry => ({
        sequence: entry.sequence ?? undefined,
        provider: entry.provider
          ? { reference: resolveAnyRef(resolveRef, ['Organization', 'Practitioner', 'PractitionerRole'], entry.provider) }
          : undefined,
        responsible: entry.responsible ?? undefined,
        role: mapCodeableConcept(entry.role),
        specialty: mapCodeableConcept(entry.specialty)
      }))
      : undefined;
    eob.supportingInfo = source.supportingInfo?.length
      ? source.supportingInfo.map(info => ({
        sequence: info.sequence ?? undefined,
        category: mapCodeableConcept(info.category),
        code: mapCodeableConcept(info.code),
        timingDate: info.timingDate || undefined,
        timingPeriod: mapPeriod(info.timingPeriod),
        valueBoolean: info.valueBoolean ?? undefined,
        valueString: info.valueString || undefined,
        valueQuantity: mapQuantity(info.valueQuantity),
        valueAttachment: mapAttachment(info.valueAttachment),
        valueReference: info.valueReference ? { reference: info.valueReference } : undefined,
        valueIdentifier: mapIdentifier(info.valueIdentifier),
        reason: mapCodeableConcept(info.reason)
      }))
      : undefined;
    eob.diagnosis = source.diagnosis?.length
      ? source.diagnosis.map(dx => ({
        sequence: dx.sequence ?? undefined,
        diagnosisCodeableConcept: mapCodeableConcept(dx.diagnosisCodeableConcept),
        diagnosisReference: dx.diagnosisReference
          ? { reference: resolveRef('Condition', dx.diagnosisReference) || `Condition/${dx.diagnosisReference}` }
          : undefined,
        type: dx.type?.length ? dx.type.map(mapCodeableConcept).filter(Boolean) : undefined,
        onAdmission: mapCodeableConcept(dx.onAdmission)
      }))
      : undefined;
    eob.procedure = source.procedure?.length
      ? source.procedure.map(proc => ({
        sequence: proc.sequence ?? undefined,
        type: proc.type?.length ? proc.type.map(mapCodeableConcept).filter(Boolean) : undefined,
        date: proc.date || undefined,
        procedureCodeableConcept: mapCodeableConcept(proc.procedureCodeableConcept),
        procedureReference: proc.procedureReference
          ? { reference: resolveRef('Procedure', proc.procedureReference) || `Procedure/${proc.procedureReference}` }
          : undefined,
        udi: proc.udi?.length ? proc.udi.map(ref => ({ reference: resolveRef('Device', ref) || `Device/${ref}` })) : undefined
      }))
      : undefined;
    eob.precedence = source.precedence ?? undefined;
    eob.insurance = source.insurance?.length
      ? source.insurance.map(ins => ({
        focal: ins.focal ?? undefined,
        coverage: ins.coverage ? { reference: resolveRef('Coverage', ins.coverage) || `Coverage/${ins.coverage}` } : undefined,
        preAuthRef: ins.preAuthRef?.length ? ins.preAuthRef : undefined
      }))
      : undefined;
    eob.accident = source.accident ? {
      date: source.accident.date || undefined,
      type: mapCodeableConcept(source.accident.type),
      locationAddress: mapSimpleAddress(source.accident.locationAddress),
      locationReference: source.accident.locationReference
        ? { reference: resolveRef('Location', source.accident.locationReference) || `Location/${source.accident.locationReference}` }
        : undefined
    } : undefined;
    eob.patientPaid = mapMoney(source.patientPaid);
    eob.item = source.item?.length ? source.item.map(item => mapItem(item, resolveRef)) : undefined;
    eob.addItem = source.addItem?.length ? source.addItem.map(item => mapAddItem(item, resolveRef)) : undefined;
    eob.adjudication = source.adjudication?.length ? source.adjudication.map(mapAdjudication).filter(Boolean) : undefined;
    eob.total = source.total?.length
      ? source.total.map(total => ({
        category: mapCodeableConcept(total.category),
        amount: mapMoney(total.amount)
      }))
      : undefined;
    eob.payment = source.payment ? {
      type: mapCodeableConcept(source.payment.type),
      adjustment: mapMoney(source.payment.adjustment),
      adjustmentReason: mapCodeableConcept(source.payment.adjustmentReason),
      date: source.payment.date || undefined,
      amount: mapMoney(source.payment.amount),
      identifier: mapIdentifier(source.payment.identifier)
    } : undefined;
    eob.formCode = mapCodeableConcept(source.formCode);
    eob.form = mapAttachment(source.form);
    eob.processNote = source.processNote?.length
      ? source.processNote.map(note => ({
        number: note.number ?? undefined,
        type: mapCodeableConcept(note.type),
        text: note.text || undefined,
        language: mapCodeableConcept(note.language)
      }))
      : undefined;
    eob.benefitPeriod = mapPeriod(source.benefitPeriod);
    eob.benefitBalance = source.benefitBalance?.length
      ? source.benefitBalance.map(balance => ({
        category: mapCodeableConcept(balance.category),
        excluded: balance.excluded ?? undefined,
        name: balance.name || undefined,
        description: balance.description || undefined,
        network: mapCodeableConcept(balance.network),
        unit: mapCodeableConcept(balance.unit),
        term: mapCodeableConcept(balance.term),
        financial: balance.financial?.length
          ? balance.financial.map(fin => ({
            type: mapCodeableConcept(fin.type),
            allowedUnsignedInt: fin.allowedUnsignedInt ?? undefined,
            allowedString: fin.allowedString || undefined,
            allowedMoney: mapMoney(fin.allowedMoney),
            usedUnsignedInt: fin.usedUnsignedInt ?? undefined,
            usedMoney: mapMoney(fin.usedMoney)
          }))
          : undefined
      }))
      : undefined;

    const summary = eob.identifier?.[0]?.value || eob.id;
    if (summary) eob.text = makeNarrative('ExplanationOfBenefit', summary);

    if (operation === 'delete') {
      eob.status = 'entered-in-error';
    }

    const entry: any = {
      resource: eob,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `ExplanationOfBenefit?identifier=${identifierSystem}|${identifierValue || eob.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `ExplanationOfBenefit/${eob.id}`
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

function mapSimpleAddress(source?: { street?: string; city?: string; state?: string; postalCode?: string; country?: string }) {
  if (!source) return undefined;
  return {
    line: source.street ? [source.street] : undefined,
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

type EobItem = NonNullable<CanonicalExplanationOfBenefit['item']>[number];
type EobItemDetail = NonNullable<EobItem['detail']>[number];
type EobItemSubDetail = NonNullable<EobItemDetail['subDetail']>[number];
type EobAddItem = NonNullable<CanonicalExplanationOfBenefit['addItem']>[number];
type EobAddItemDetail = NonNullable<EobAddItem['detail']>[number];
type EobAddItemSubDetail = NonNullable<EobAddItemDetail['subDetail']>[number];

type AdjudicationEntry = NonNullable<CanonicalExplanationOfBenefit['adjudication']>[number];

type ReviewOutcome = {
  decision?: { system?: string; code?: string; display?: string };
  reason?: Array<{ system?: string; code?: string; display?: string }>;
  preAuthRef?: string;
  preAuthPeriod?: { start?: string; end?: string };
};

function mapAdjudication(entry: AdjudicationEntry) {
  return {
    category: mapCodeableConcept(entry.category),
    reason: mapCodeableConcept(entry.reason),
    amount: mapMoney(entry.amount),
    quantity: mapQuantity(entry.quantity)
  };
}

function mapReviewOutcome(entry?: ReviewOutcome) {
  if (!entry) return undefined;
  return {
    decision: mapCodeableConcept(entry.decision),
    reason: entry.reason?.length ? entry.reason.map(mapCodeableConcept).filter(Boolean) : undefined,
    preAuthRef: entry.preAuthRef || undefined,
    preAuthPeriod: mapPeriod(entry.preAuthPeriod)
  };
}

function mapItem(item: EobItem, resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined) {
  return {
    sequence: item.sequence ?? undefined,
    careTeamSequence: item.careTeamSequence?.length ? item.careTeamSequence : undefined,
    diagnosisSequence: item.diagnosisSequence?.length ? item.diagnosisSequence : undefined,
    procedureSequence: item.procedureSequence?.length ? item.procedureSequence : undefined,
    informationSequence: item.informationSequence?.length ? item.informationSequence : undefined,
    traceNumber: item.traceNumber?.length ? item.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    revenue: mapCodeableConcept(item.revenue),
    category: mapCodeableConcept(item.category),
    productOrService: mapCodeableConcept(item.productOrService),
    productOrServiceEnd: mapCodeableConcept(item.productOrServiceEnd),
    request: item.request?.length
      ? item.request.map(ref => ({
        reference: resolveAnyRef(resolveRef, ['DeviceRequest', 'MedicationRequest', 'NutritionOrder', 'ServiceRequest', 'SupplyRequest', 'VisionPrescription'], ref)
      }))
      : undefined,
    modifier: item.modifier?.length ? item.modifier.map(mapCodeableConcept).filter(Boolean) : undefined,
    programCode: item.programCode?.length ? item.programCode.map(mapCodeableConcept).filter(Boolean) : undefined,
    servicedDate: item.servicedDate || undefined,
    servicedPeriod: mapPeriod(item.servicedPeriod),
    locationCodeableConcept: mapCodeableConcept(item.locationCodeableConcept),
    locationAddress: mapSimpleAddress(item.locationAddress),
    locationReference: item.locationReference
      ? { reference: resolveAnyRef(resolveRef, ['Location'], item.locationReference) }
      : undefined,
    patientPaid: mapMoney(item.patientPaid),
    quantity: mapQuantity(item.quantity),
    unitPrice: mapMoney(item.unitPrice),
    factor: item.factor ?? undefined,
    tax: mapMoney(item.tax),
    net: mapMoney(item.net),
    udi: item.udi?.length ? item.udi.map(ref => ({ reference: resolveRef('Device', ref) || `Device/${ref}` })) : undefined,
    bodySite: item.bodySite?.length
      ? item.bodySite.map(site => ({
        site: site.site?.length ? site.site.map(mapCodeableConcept).filter(Boolean) : undefined,
        subSite: site.subSite?.length ? site.subSite.map(mapCodeableConcept).filter(Boolean) : undefined
      }))
      : undefined,
    encounter: item.encounter?.length
      ? item.encounter.map(ref => ({ reference: resolveRef('Encounter', ref) || `Encounter/${ref}` }))
      : undefined,
    noteNumber: item.noteNumber?.length ? item.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(item.reviewOutcome),
    adjudication: item.adjudication?.length ? item.adjudication.map(mapAdjudication).filter(Boolean) : undefined,
    detail: item.detail?.length ? item.detail.map(detail => mapItemDetail(detail, resolveRef)) : undefined
  };
}

function mapItemDetail(detail: EobItemDetail, resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined) {
  return {
    sequence: detail.sequence ?? undefined,
    traceNumber: detail.traceNumber?.length ? detail.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    revenue: mapCodeableConcept(detail.revenue),
    category: mapCodeableConcept(detail.category),
    productOrService: mapCodeableConcept(detail.productOrService),
    productOrServiceEnd: mapCodeableConcept(detail.productOrServiceEnd),
    modifier: detail.modifier?.length ? detail.modifier.map(mapCodeableConcept).filter(Boolean) : undefined,
    programCode: detail.programCode?.length ? detail.programCode.map(mapCodeableConcept).filter(Boolean) : undefined,
    patientPaid: mapMoney(detail.patientPaid),
    quantity: mapQuantity(detail.quantity),
    unitPrice: mapMoney(detail.unitPrice),
    factor: detail.factor ?? undefined,
    tax: mapMoney(detail.tax),
    net: mapMoney(detail.net),
    udi: detail.udi?.length ? detail.udi.map(ref => ({ reference: resolveRef('Device', ref) || `Device/${ref}` })) : undefined,
    noteNumber: detail.noteNumber?.length ? detail.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(detail.reviewOutcome),
    adjudication: detail.adjudication?.length ? detail.adjudication.map(mapAdjudication).filter(Boolean) : undefined,
    subDetail: detail.subDetail?.length ? detail.subDetail.map(sub => mapItemSubDetail(sub, resolveRef)) : undefined
  };
}

function mapItemSubDetail(sub: EobItemSubDetail, resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined) {
  return {
    sequence: sub.sequence ?? undefined,
    traceNumber: sub.traceNumber?.length ? sub.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    revenue: mapCodeableConcept(sub.revenue),
    category: mapCodeableConcept(sub.category),
    productOrService: mapCodeableConcept(sub.productOrService),
    productOrServiceEnd: mapCodeableConcept(sub.productOrServiceEnd),
    modifier: sub.modifier?.length ? sub.modifier.map(mapCodeableConcept).filter(Boolean) : undefined,
    programCode: sub.programCode?.length ? sub.programCode.map(mapCodeableConcept).filter(Boolean) : undefined,
    patientPaid: mapMoney(sub.patientPaid),
    quantity: mapQuantity(sub.quantity),
    unitPrice: mapMoney(sub.unitPrice),
    factor: sub.factor ?? undefined,
    tax: mapMoney(sub.tax),
    net: mapMoney(sub.net),
    udi: sub.udi?.length ? sub.udi.map(ref => ({ reference: resolveRef('Device', ref) || `Device/${ref}` })) : undefined,
    noteNumber: sub.noteNumber?.length ? sub.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(sub.reviewOutcome),
    adjudication: sub.adjudication?.length ? sub.adjudication.map(mapAdjudication).filter(Boolean) : undefined
  };
}

function mapAddItem(item: EobAddItem, resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined) {
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
      ? item.request.map(ref => ({
        reference: resolveAnyRef(resolveRef, ['DeviceRequest', 'MedicationRequest', 'NutritionOrder', 'ServiceRequest', 'SupplyRequest', 'VisionPrescription'], ref)
      }))
      : undefined,
    modifier: item.modifier?.length ? item.modifier.map(mapCodeableConcept).filter(Boolean) : undefined,
    programCode: item.programCode?.length ? item.programCode.map(mapCodeableConcept).filter(Boolean) : undefined,
    servicedDate: item.servicedDate || undefined,
    servicedPeriod: mapPeriod(item.servicedPeriod),
    locationCodeableConcept: mapCodeableConcept(item.locationCodeableConcept),
    locationAddress: mapSimpleAddress(item.locationAddress),
    locationReference: item.locationReference
      ? { reference: resolveAnyRef(resolveRef, ['Location'], item.locationReference) }
      : undefined,
    patientPaid: mapMoney(item.patientPaid),
    quantity: mapQuantity(item.quantity),
    unitPrice: mapMoney(item.unitPrice),
    factor: item.factor ?? undefined,
    tax: mapMoney(item.tax),
    net: mapMoney(item.net),
    bodySite: item.bodySite?.length
      ? item.bodySite.map(site => ({
        site: site.site?.length ? site.site.map(mapCodeableConcept).filter(Boolean) : undefined,
        subSite: site.subSite?.length ? site.subSite.map(mapCodeableConcept).filter(Boolean) : undefined
      }))
      : undefined,
    noteNumber: item.noteNumber?.length ? item.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(item.reviewOutcome),
    adjudication: item.adjudication?.length ? item.adjudication.map(mapAdjudication).filter(Boolean) : undefined,
    detail: item.detail?.length ? item.detail.map(detail => mapAddItemDetail(detail, resolveRef)) : undefined
  };
}

function mapAddItemDetail(detail: EobAddItemDetail, resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined) {
  return {
    traceNumber: detail.traceNumber?.length ? detail.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    revenue: mapCodeableConcept(detail.revenue),
    productOrService: mapCodeableConcept(detail.productOrService),
    productOrServiceEnd: mapCodeableConcept(detail.productOrServiceEnd),
    modifier: detail.modifier?.length ? detail.modifier.map(mapCodeableConcept).filter(Boolean) : undefined,
    patientPaid: mapMoney(detail.patientPaid),
    quantity: mapQuantity(detail.quantity),
    unitPrice: mapMoney(detail.unitPrice),
    factor: detail.factor ?? undefined,
    tax: mapMoney(detail.tax),
    net: mapMoney(detail.net),
    noteNumber: detail.noteNumber?.length ? detail.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(detail.reviewOutcome),
    adjudication: detail.adjudication?.length ? detail.adjudication.map(mapAdjudication).filter(Boolean) : undefined,
    subDetail: detail.subDetail?.length ? detail.subDetail.map(sub => mapAddItemSubDetail(sub, resolveRef)) : undefined
  };
}

function mapAddItemSubDetail(sub: EobAddItemSubDetail, resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined) {
  return {
    traceNumber: sub.traceNumber?.length ? sub.traceNumber.map(mapIdentifier).filter(Boolean) : undefined,
    revenue: mapCodeableConcept(sub.revenue),
    productOrService: mapCodeableConcept(sub.productOrService),
    productOrServiceEnd: mapCodeableConcept(sub.productOrServiceEnd),
    modifier: sub.modifier?.length ? sub.modifier.map(mapCodeableConcept).filter(Boolean) : undefined,
    patientPaid: mapMoney(sub.patientPaid),
    quantity: mapQuantity(sub.quantity),
    unitPrice: mapMoney(sub.unitPrice),
    factor: sub.factor ?? undefined,
    tax: mapMoney(sub.tax),
    net: mapMoney(sub.net),
    noteNumber: sub.noteNumber?.length ? sub.noteNumber : undefined,
    reviewOutcome: mapReviewOutcome(sub.reviewOutcome),
    adjudication: sub.adjudication?.length ? sub.adjudication.map(mapAdjudication).filter(Boolean) : undefined
  };
}
