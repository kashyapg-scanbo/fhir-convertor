import crypto from 'crypto';
import relatedPersonTemplate from '../../shared/templates/relatedPerson.json' with { type: 'json' };
import type { CanonicalRelatedPerson, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface RelatedPersonMapperArgs {
  relatedPersons?: CanonicalRelatedPerson[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
}

export function mapRelatedPersons({
  relatedPersons,
  operation,
  registry,
  resolveRef,
  patientFullUrl
}: RelatedPersonMapperArgs) {
  if (!relatedPersons || relatedPersons.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < relatedPersons.length; index++) {
    const source = relatedPersons[index];
    const relatedPerson = structuredClone(relatedPersonTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    relatedPerson.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${relatedPerson.id}`;
    relatedPerson.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'RelatedPerson',
      {
        identifier: source.id || source.identifier || relatedPerson.id,
        id: relatedPerson.id
      },
      fullUrl
    );

    relatedPerson.active = source.active ?? true;

    if (source.patient) {
      relatedPerson.patient = {
        reference: resolveRef('Patient', source.patient) || `Patient/${source.patient}`
      };
    } else if (patientFullUrl) {
      relatedPerson.patient = { reference: patientFullUrl };
    } else {
      relatedPerson.patient = undefined;
    }

    relatedPerson.relationship = source.relationship?.length
      ? source.relationship.map(rel => ({
        coding: [{
          system: rel.system,
          code: rel.code,
          display: rel.display
        }],
        text: rel.display
      }))
      : undefined;

    relatedPerson.name = source.name?.length
      ? source.name.map(name => ({
        family: name.family,
        given: name.given
      }))
      : undefined;

    relatedPerson.telecom = source.telecom?.length
      ? source.telecom.map(t => ({
        system: t.system,
        value: t.value,
        use: t.use
      }))
      : undefined;

    relatedPerson.gender = source.gender || undefined;
    relatedPerson.birthDate = source.birthDate || undefined;
    relatedPerson.address = source.address?.length ? source.address : undefined;
    relatedPerson.period = source.period ? { start: source.period.start, end: source.period.end } : undefined;

    const summary = relatedPerson.name?.[0]?.family || relatedPerson.id;
    if (summary) relatedPerson.text = makeNarrative('RelatedPerson', summary);

    if (operation === 'delete') {
      relatedPerson.active = false;
    }

    const entry: any = {
      resource: relatedPerson,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `RelatedPerson?identifier=${identifierSystem}|${identifierValue || relatedPerson.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `RelatedPerson/${relatedPerson.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
