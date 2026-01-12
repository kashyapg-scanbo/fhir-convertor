import crypto from 'crypto';
import allergyTemplate from '../../shared/templates/allergyIntolerance.json' with { type: 'json' };
import type { CanonicalAllergyIntolerance, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface AllergyIntoleranceMapperArgs {
  allergyIntolerances?: CanonicalAllergyIntolerance[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
}

export function mapAllergyIntolerances({
  allergyIntolerances,
  operation,
  registry,
  resolveRef,
  patientFullUrl
}: AllergyIntoleranceMapperArgs) {
  if (!allergyIntolerances || allergyIntolerances.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < allergyIntolerances.length; index++) {
    const source = allergyIntolerances[index];
    const allergy = structuredClone(allergyTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    allergy.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${allergy.id}`;
    allergy.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'AllergyIntolerance',
      {
        identifier: source.id || source.identifier || allergy.id,
        id: allergy.id
      },
      fullUrl
    );

    allergy.clinicalStatus = source.clinicalStatus ? mapCodeableConcept(source.clinicalStatus) : undefined;
    allergy.verificationStatus = source.verificationStatus ? mapCodeableConcept(source.verificationStatus) : undefined;
    allergy.type = source.type ? mapCodeableConcept(source.type) : undefined;
    allergy.category = source.category && source.category.length ? source.category : undefined;
    allergy.criticality = source.criticality || undefined;
    allergy.code = source.code ? mapCodeableConcept(source.code) : undefined;

    const patientRef = resolveRef('Patient', source.patient) || patientFullUrl || (source.patient ? `Patient/${source.patient}` : undefined);
    allergy.patient = patientRef ? { reference: patientRef } : undefined;

    allergy.encounter = source.encounter
      ? { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` }
      : undefined;

    allergy.onsetDateTime = source.onsetDateTime || undefined;
    allergy.onsetPeriod = source.onsetPeriod ? { start: source.onsetPeriod.start, end: source.onsetPeriod.end } : undefined;
    allergy.onsetString = source.onsetString || undefined;
    allergy.recordedDate = source.recordedDate || undefined;

    allergy.participant = source.participant?.map(participant => ({
      function: participant.function ? mapCodeableConcept(participant.function) : undefined,
      actor: participant.actor ? { reference: resolveParticipantRef(resolveRef, participant.actor) } : undefined
    })).filter(entry => entry.function || entry.actor) || undefined;

    allergy.lastOccurrence = source.lastOccurrence || undefined;
    allergy.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;

    allergy.reaction = source.reaction?.length
      ? source.reaction.map(reaction => ({
        substance: reaction.substance ? mapCodeableConcept(reaction.substance) : undefined,
        manifestation: reaction.manifestation?.map(m => ({ concept: mapCodeableConcept(m) })).filter((m: any) => m.concept),
        description: reaction.description,
        onset: reaction.onset,
        severity: reaction.severity,
        exposureRoute: reaction.exposureRoute ? mapCodeableConcept(reaction.exposureRoute) : undefined,
        note: reaction.note?.map(text => ({ text }))
      }))
      : undefined;

    const summary = allergy.code?.text || allergy.id;
    if (summary) allergy.text = makeNarrative('AllergyIntolerance', summary);

    if (operation === 'delete') {
      allergy.verificationStatus = {
        coding: [{ code: 'entered-in-error', display: 'entered-in-error' }]
      };
    }

    const entry: any = {
      resource: allergy,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `AllergyIntolerance?identifier=${identifierSystem}|${identifierValue || allergy.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `AllergyIntolerance/${allergy.id}`
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

function resolveParticipantRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, actorId: string) {
  if (!actorId) return undefined;
  if (actorId.includes('/')) return actorId;

  return (
    resolveRef('Practitioner', actorId) ||
    resolveRef('PractitionerRole', actorId) ||
    resolveRef('RelatedPerson', actorId) ||
    resolveRef('CareTeam', actorId) ||
    resolveRef('Device', actorId) ||
    resolveRef('Organization', actorId) ||
    resolveRef('Patient', actorId) ||
    `Practitioner/${actorId}`
  );
}
