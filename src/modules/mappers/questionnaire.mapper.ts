import crypto from 'crypto';
import questionnaireTemplate from '../../shared/templates/questionnaire.json' with { type: 'json' };
import type { CanonicalQuestionnaire, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface QuestionnaireMapperArgs {
  questionnaires?: CanonicalQuestionnaire[];
  operation?: OperationType;
  registry: FullUrlRegistry;
}

export function mapQuestionnaires({
  questionnaires,
  operation,
  registry
}: QuestionnaireMapperArgs) {
  if (!questionnaires || questionnaires.length === 0) {
    return [];
  }

  const entries: any[] = [];

  for (const source of questionnaires) {
    const questionnaire = structuredClone(questionnaireTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    questionnaire.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${questionnaire.id}`;
    questionnaire.identifier = identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined;

    registry.register(
      'Questionnaire',
      {
        identifier: source.id || source.identifier || questionnaire.id,
        id: questionnaire.id
      },
      fullUrl
    );

    questionnaire.url = source.url || undefined;
    questionnaire.version = source.version || undefined;
    questionnaire.name = source.name || undefined;
    questionnaire.title = source.title || undefined;
    questionnaire.status = source.status || 'active';
    questionnaire.date = source.date || undefined;
    questionnaire.publisher = source.publisher || undefined;
    questionnaire.description = source.description || undefined;
    questionnaire.subjectType = source.subjectType?.length ? source.subjectType : undefined;

    questionnaire.item = source.item?.length
      ? source.item.map(item => ({
        linkId: item.linkId,
        text: item.text,
        type: item.type
      }))
      : undefined;

    const summary = questionnaire.title || questionnaire.name || questionnaire.id;
    if (summary) questionnaire.text = makeNarrative('Questionnaire', summary);

    if (operation === 'delete') {
      questionnaire.status = 'retired';
    }

    const entry: any = {
      resource: questionnaire,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Questionnaire?identifier=${identifierSystem}|${identifierValue || questionnaire.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Questionnaire/${questionnaire.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
