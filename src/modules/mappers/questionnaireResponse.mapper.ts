import crypto from 'crypto';
import questionnaireResponseTemplate from '../../shared/templates/questionnaireResponse.json' with { type: 'json' };
import type { CanonicalQuestionnaireResponse, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface QuestionnaireResponseMapperArgs {
  questionnaireResponses?: CanonicalQuestionnaireResponse[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapQuestionnaireResponses({
  questionnaireResponses,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: QuestionnaireResponseMapperArgs) {
  if (!questionnaireResponses || questionnaireResponses.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of questionnaireResponses) {
    const response = structuredClone(questionnaireResponseTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    response.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${response.id}`;
    response.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'QuestionnaireResponse',
      {
        identifier: source.id || source.identifier || response.id,
        id: response.id
      },
      fullUrl
    );

    response.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    response.partOf = source.partOf?.length
      ? source.partOf.map(ref => ({ reference: normalizeReference(ref) }))
      : undefined;

    response.questionnaire = source.questionnaire || undefined;
    response.status = source.status || 'completed';

    if (source.subject) {
      response.subject = { reference: normalizeReference(source.subject) };
    } else if (patientFullUrl) {
      response.subject = { reference: patientFullUrl };
    } else {
      response.subject = undefined;
    }

    if (source.encounter) {
      response.encounter = { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` };
    } else if (encounterFullUrl) {
      response.encounter = { reference: encounterFullUrl };
    } else {
      response.encounter = undefined;
    }

    response.authored = source.authored || undefined;
    response.author = source.author ? { reference: resolveParticipantRef(resolveRef, source.author) } : undefined;
    response.source = source.source ? { reference: resolveParticipantRef(resolveRef, source.source) } : undefined;

    response.item = source.item?.length
      ? source.item.map(item => ({
        linkId: item.linkId,
        text: item.text,
        answer: item.answer?.map(value => ({ valueString: value }))
      }))
      : undefined;

    const summary = response.item?.[0]?.text || response.id;
    if (summary) response.text = makeNarrative('QuestionnaireResponse', summary);

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
        url: `QuestionnaireResponse?identifier=${identifierSystem}|${identifierValue || response.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `QuestionnaireResponse/${response.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}

function normalizeReference(value: string) {
  if (!value) return value;
  return value.includes('/') ? value : value;
}

function resolveParticipantRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, id: string) {
  if (!id) return undefined;
  if (id.includes('/')) return id;
  return (
    resolveRef('Practitioner', id) ||
    resolveRef('PractitionerRole', id) ||
    resolveRef('Organization', id) ||
    resolveRef('Patient', id) ||
    resolveRef('RelatedPerson', id) ||
    resolveRef('Device', id) ||
    `Practitioner/${id}`
  );
}
