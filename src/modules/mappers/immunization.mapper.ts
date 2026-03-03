import crypto from 'crypto';
import immunizationTemplate from '../../shared/templates/immunization.json' with { type: 'json' };
import type { CanonicalImmunization, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface ImmunizationMapperArgs {
  immunizations?: CanonicalImmunization[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapImmunizations({
  immunizations,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: ImmunizationMapperArgs) {
  if (!immunizations || immunizations.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < immunizations.length; index++) {
    const source = immunizations[index];
    const immunization = structuredClone(immunizationTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    immunization.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${immunization.id}`;
    immunization.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'Immunization',
      {
        identifier: source.id || source.identifier || immunization.id,
        id: immunization.id
      },
      fullUrl
    );

    immunization.status = source.status || 'completed';
    immunization.statusReason = source.statusReason ? mapCodeableConcept(source.statusReason) : undefined;
    immunization.vaccineCode = source.vaccineCode ? mapCodeableConcept(source.vaccineCode) : undefined;

    immunization.basedOn = source.basedOn?.length
      ? source.basedOn
        .map(reference => ({ reference: resolveBasedOnRef(resolveRef, reference) }))
        .filter(entry => entry.reference)
      : undefined;

    immunization.administeredProduct = source.administeredProduct
      ? { reference: resolveRef('Medication', source.administeredProduct) || `Medication/${source.administeredProduct}` }
      : undefined;

    immunization.manufacturer = source.manufacturer
      ? { reference: resolveRef('Organization', source.manufacturer) || `Organization/${source.manufacturer}` }
      : undefined;

    immunization.lotNumber = source.lotNumber || undefined;
    immunization.expirationDate = source.expirationDate || undefined;

    if (source.patient) {
      immunization.patient = { reference: resolveRef('Patient', source.patient) || `Patient/${source.patient}` };
    } else if (patientFullUrl) {
      immunization.patient = { reference: patientFullUrl };
    } else {
      immunization.patient = undefined;
    }

    if (source.encounter) {
      immunization.encounter = { reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}` };
    } else if (encounterFullUrl) {
      immunization.encounter = { reference: encounterFullUrl };
    } else {
      immunization.encounter = undefined;
    }

    immunization.supportingInformation = source.supportingInformation?.length
      ? source.supportingInformation.map(ref => ({ reference: ref }))
      : undefined;

    immunization.occurrenceDateTime = source.occurrenceDateTime || undefined;
    immunization.occurrenceString = source.occurrenceString || undefined;
    immunization.primarySource = source.primarySource ?? undefined;

    immunization.informationSource = source.informationSource
      ? { reference: resolveRef('Organization', source.informationSource) || `Organization/${source.informationSource}` }
      : undefined;

    immunization.location = source.location
      ? { reference: resolveRef('Location', source.location) || `Location/${source.location}` }
      : undefined;

    immunization.site = source.site ? mapCodeableConcept(source.site) : undefined;
    immunization.route = source.route ? mapCodeableConcept(source.route) : undefined;
    immunization.doseQuantity = source.doseQuantity ? {
      value: source.doseQuantity.value,
      unit: source.doseQuantity.unit
    } : undefined;

    immunization.performer = source.performer?.length
      ? source.performer.map(performer => ({
        function: performer.function ? mapCodeableConcept(performer.function) : undefined,
        actor: performer.actor
          ? { reference: resolveActorRef(resolveRef, performer.actor) }
          : undefined
      })).filter(entry => entry.function || entry.actor)
      : undefined;

    immunization.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;

    immunization.reason = source.reason?.length
      ? source.reason.map(reason => ({
        concept: reason.code ? mapCodeableConcept(reason.code) : undefined
      })).filter(entry => entry.concept)
      : undefined;

    immunization.isSubpotent = source.isSubpotent ?? undefined;
    immunization.subpotentReason = source.subpotentReason?.length
      ? source.subpotentReason.map(mapCodeableConcept)
      : undefined;

    immunization.programEligibility = source.programEligibility?.length
      ? source.programEligibility.map(program => ({
        program: program.program ? mapCodeableConcept(program.program) : undefined,
        programStatus: program.programStatus ? mapCodeableConcept(program.programStatus) : undefined
      })).filter(entry => entry.program || entry.programStatus)
      : undefined;

    immunization.fundingSource = source.fundingSource ? mapCodeableConcept(source.fundingSource) : undefined;

    immunization.reaction = source.reaction?.length
      ? source.reaction.map(reaction => ({
        date: reaction.date,
        manifestation: reaction.manifestation ? [{ concept: mapCodeableConcept(reaction.manifestation) }] : undefined,
        reported: reaction.reported
      })).filter(entry => entry.date || entry.manifestation || entry.reported !== undefined)
      : undefined;

    immunization.protocolApplied = source.protocolApplied?.length
      ? source.protocolApplied.map(protocol => ({
        series: protocol.series,
        authority: protocol.authority
          ? { reference: resolveRef('Organization', protocol.authority) || `Organization/${protocol.authority}` }
          : undefined,
        targetDisease: protocol.targetDisease?.length
          ? protocol.targetDisease.map(mapCodeableConcept)
          : undefined,
        doseNumber: protocol.doseNumber,
        seriesDoses: protocol.seriesDoses
      })).filter(entry => entry.series || entry.authority || entry.targetDisease || entry.doseNumber || entry.seriesDoses)
      : undefined;

    const summary = immunization.vaccineCode?.text || immunization.id;
    if (summary) immunization.text = makeNarrative('Immunization', summary);

    if (operation === 'delete') {
      immunization.status = 'entered-in-error';
    }

    const entry: any = {
      resource: immunization,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `Immunization?identifier=${identifierSystem}|${identifierValue || immunization.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `Immunization/${immunization.id}`
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

function resolveActorRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, actorId: string) {
  if (!actorId) return undefined;
  if (actorId.includes('/')) return actorId;

  return (
    resolveRef('Practitioner', actorId) ||
    resolveRef('PractitionerRole', actorId) ||
    resolveRef('RelatedPerson', actorId) ||
    resolveRef('Organization', actorId) ||
    resolveRef('Patient', actorId) ||
    `Practitioner/${actorId}`
  );
}

function resolveBasedOnRef(resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined, reference: string) {
  if (!reference) return undefined;
  if (reference.includes('/')) return reference;

  return (
    resolveRef('ServiceRequest', reference) ||
    resolveRef('CarePlan', reference) ||
    resolveRef('MedicationRequest', reference) ||
    resolveRef('ImmunizationRecommendation', reference) ||
    reference
  );
}
