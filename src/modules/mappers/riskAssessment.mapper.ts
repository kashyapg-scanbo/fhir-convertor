import crypto from 'crypto';
import riskAssessmentTemplate from '../../shared/templates/riskAssessment.json' with { type: 'json' };
import type { CanonicalRiskAssessment, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface RiskAssessmentMapperArgs {
  riskAssessments?: CanonicalRiskAssessment[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapRiskAssessments({
  riskAssessments,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: RiskAssessmentMapperArgs) {
  if (!riskAssessments || riskAssessments.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of riskAssessments) {
    const assessment = structuredClone(riskAssessmentTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    assessment.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${assessment.id}`;
    assessment.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'RiskAssessment',
      {
        identifier: source.id || source.identifier?.[0]?.value || assessment.id,
        id: assessment.id
      },
      fullUrl
    );

    assessment.basedOn = source.basedOn
      ? { reference: normalizeReference(source.basedOn) }
      : undefined;
    assessment.parent = source.parent
      ? { reference: normalizeReference(source.parent) }
      : undefined;

    assessment.status = source.status || undefined;
    assessment.method = source.method ? mapCodeableConcept(source.method) : undefined;
    assessment.code = source.code ? mapCodeableConcept(source.code) : undefined;

    if (source.subject) {
      assessment.subject = { reference: resolveAnyRef(resolveRef, ['Group', 'Patient'], source.subject) };
    } else if (patientFullUrl) {
      assessment.subject = { reference: patientFullUrl };
    } else {
      assessment.subject = undefined;
    }

    if (source.encounter) {
      assessment.encounter = { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` };
    } else if (encounterFullUrl) {
      assessment.encounter = { reference: encounterFullUrl };
    } else {
      assessment.encounter = undefined;
    }

    assessment.occurrenceDateTime = source.occurrenceDateTime || undefined;
    assessment.occurrencePeriod = source.occurrencePeriod
      ? { start: source.occurrencePeriod.start, end: source.occurrencePeriod.end }
      : undefined;

    assessment.condition = source.condition
      ? { reference: resolveRef('Condition', source.condition) || `Condition/${source.condition}` }
      : undefined;

    assessment.performer = source.performer
      ? { reference: resolveAnyRef(resolveRef, ['Device', 'Patient', 'Practitioner', 'PractitionerRole', 'RelatedPerson'], source.performer) }
      : undefined;

    assessment.reason = source.reason?.length
      ? source.reason.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    assessment.basis = source.basis?.length
      ? source.basis.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    assessment.prediction = source.prediction?.length
      ? source.prediction.map(pred => ({
          outcome: pred.outcome ? mapCodeableConcept(pred.outcome) : undefined,
          probabilityDecimal: pred.probabilityDecimal,
          probabilityRange: pred.probabilityRange ? mapRange(pred.probabilityRange) : undefined,
          qualitativeRisk: pred.qualitativeRisk ? mapCodeableConcept(pred.qualitativeRisk) : undefined,
          relativeRisk: pred.relativeRisk,
          whenPeriod: pred.whenPeriod ? { start: pred.whenPeriod.start, end: pred.whenPeriod.end } : undefined,
          whenRange: pred.whenRange ? mapRange(pred.whenRange) : undefined,
          rationale: pred.rationale || undefined
        }))
      : undefined;

    assessment.mitigation = source.mitigation || undefined;
    assessment.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;

    const summary = assessment.code?.text || assessment.id;
    if (summary) assessment.text = makeNarrative('RiskAssessment', summary);

    if (operation === 'delete') {
      assessment.status = 'entered-in-error';
    }

    const entry: any = {
      resource: assessment,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `RiskAssessment?identifier=${identifierSystem}|${identifierValue || assessment.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `RiskAssessment/${assessment.id}`
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

function mapRange(source?: { low?: { value?: number; unit?: string; system?: string; code?: string }; high?: { value?: number; unit?: string; system?: string; code?: string } }) {
  if (!source) return undefined;
  const low = source.low ? mapQuantity(source.low) : undefined;
  const high = source.high ? mapQuantity(source.high) : undefined;
  if (!low && !high) return undefined;
  return { low, high };
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
