import crypto from 'crypto';
import conditionTemplate from '../../shared/templates/condition.json' with { type: 'json' };
import type { CanonicalCondition, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ConditionMapperArgs {
  conditions?: CanonicalCondition[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapConditions({
  conditions,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: ConditionMapperArgs) {
  if (!conditions || conditions.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < conditions.length; index++) {
    const source = conditions[index];
    const condition = structuredClone(conditionTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    condition.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${condition.id}`;
    condition.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'Condition',
      {
        identifier: source.id || source.identifier || condition.id,
        id: condition.id
      },
      fullUrl
    );

    condition.clinicalStatus = source.clinicalStatus ? {
      coding: [{
        system: source.clinicalStatus.system,
        code: source.clinicalStatus.code,
        display: source.clinicalStatus.display
      }],
      text: source.clinicalStatus.display
    } : undefined;

    condition.verificationStatus = source.verificationStatus ? {
      coding: [{
        system: source.verificationStatus.system,
        code: source.verificationStatus.code,
        display: source.verificationStatus.display
      }],
      text: source.verificationStatus.display
    } : undefined;

    condition.category = source.category?.length
      ? source.category.map(cat => ({
        coding: [{
          system: cat.system,
          code: cat.code,
          display: cat.display
        }],
        text: cat.display
      }))
      : undefined;

    condition.severity = source.severity ? {
      coding: [{
        system: source.severity.system,
        code: source.severity.code,
        display: source.severity.display
      }],
      text: source.severity.display
    } : undefined;

    condition.code = source.code ? {
      coding: source.code.coding || [],
      text: source.code.text
    } : undefined;

    condition.bodySite = source.bodySite?.length
      ? source.bodySite.map(site => ({
        coding: [{
          system: site.system,
          code: site.code,
          display: site.display
        }],
        text: site.display
      }))
      : undefined;

    if (source.subject) {
      condition.subject = {
        reference: resolveRef('Patient', source.subject) || `Patient/${source.subject}`
      };
    } else if (patientFullUrl) {
      condition.subject = { reference: patientFullUrl };
    } else {
      condition.subject = undefined;
    }

    if (source.encounter) {
      condition.encounter = {
        reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}`
      };
    } else if (encounterFullUrl) {
      condition.encounter = { reference: encounterFullUrl };
    } else {
      condition.encounter = undefined;
    }

    if (source.onsetDateTime) {
      condition.onsetDateTime = source.onsetDateTime;
      condition.onsetPeriod = undefined;
      condition.onsetString = undefined;
    } else if (source.onsetPeriod) {
      condition.onsetPeriod = {
        start: source.onsetPeriod.start,
        end: source.onsetPeriod.end
      };
      condition.onsetDateTime = undefined;
      condition.onsetString = undefined;
    } else if (source.onsetString) {
      condition.onsetString = source.onsetString;
      condition.onsetDateTime = undefined;
      condition.onsetPeriod = undefined;
    } else {
      condition.onsetDateTime = undefined;
      condition.onsetPeriod = undefined;
      condition.onsetString = undefined;
    }

    if (source.abatementDateTime) {
      condition.abatementDateTime = source.abatementDateTime;
      condition.abatementPeriod = undefined;
      condition.abatementString = undefined;
    } else if (source.abatementPeriod) {
      condition.abatementPeriod = {
        start: source.abatementPeriod.start,
        end: source.abatementPeriod.end
      };
      condition.abatementDateTime = undefined;
      condition.abatementString = undefined;
    } else if (source.abatementString) {
      condition.abatementString = source.abatementString;
      condition.abatementDateTime = undefined;
      condition.abatementPeriod = undefined;
    } else {
      condition.abatementDateTime = undefined;
      condition.abatementPeriod = undefined;
      condition.abatementString = undefined;
    }

    condition.recordedDate = source.recordedDate || undefined;

    condition.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    const conditionSummary = condition.code?.text || condition.id;
    if (conditionSummary) condition.text = makeNarrative('Condition', conditionSummary);

    if (operation === 'delete') {
      condition.clinicalStatus = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'inactive',
          display: 'Inactive'
        }],
        text: 'Inactive'
      };
    }

    const entry: any = {
      resource: condition,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Condition?identifier=${identifierSystem}|${identifierValue || condition.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Condition/${condition.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
