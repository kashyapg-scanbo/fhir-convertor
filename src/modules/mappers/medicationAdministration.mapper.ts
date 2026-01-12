import crypto from 'crypto';
import medicationAdministrationTemplate from '../../shared/templates/medicationAdministration.json' with { type: 'json' };
import type { CanonicalMedicationAdministration, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface MedicationAdministrationMapperArgs {
  medicationAdministrations?: CanonicalMedicationAdministration[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapMedicationAdministrations({
  medicationAdministrations,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: MedicationAdministrationMapperArgs) {
  if (!medicationAdministrations || medicationAdministrations.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < medicationAdministrations.length; index++) {
    const source = medicationAdministrations[index];
    const medicationAdministration = structuredClone(medicationAdministrationTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    medicationAdministration.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${medicationAdministration.id}`;
    medicationAdministration.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'MedicationAdministration',
      {
        identifier: source.id || source.identifier || medicationAdministration.id,
        id: medicationAdministration.id
      },
      fullUrl
    );

    medicationAdministration.status = source.status || 'completed';
    medicationAdministration.statusReason = source.statusReason?.length
      ? source.statusReason.map(mapCodeableConcept)
      : undefined;
    medicationAdministration.category = source.category?.length
      ? source.category.map(mapCodeableConcept)
      : undefined;

    if (source.medicationCodeableConcept || source.medicationReference) {
      medicationAdministration.medication = {};
      if (source.medicationCodeableConcept) {
        const coding = source.medicationCodeableConcept.coding?.map(c => ({
          system: c.system,
          code: c.code,
          display: c.display
        }));
        medicationAdministration.medication.concept = {
          coding: coding && coding.length ? coding : undefined,
          text: source.medicationCodeableConcept.text || coding?.[0]?.display || coding?.[0]?.code
        };
      }
      if (source.medicationReference) {
        medicationAdministration.medication.reference = {
          reference: resolveRef('Medication', source.medicationReference) || `Medication/${source.medicationReference}`
        };
      }
    } else {
      medicationAdministration.medication = undefined;
    }

    if (source.subject) {
      medicationAdministration.subject = {
        reference: resolveRef('Patient', source.subject) || `Patient/${source.subject}`
      };
    } else if (patientFullUrl) {
      medicationAdministration.subject = { reference: patientFullUrl };
    } else {
      medicationAdministration.subject = undefined;
    }

    if (source.encounter) {
      medicationAdministration.encounter = {
        reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}`
      };
    } else if (encounterFullUrl) {
      medicationAdministration.encounter = { reference: encounterFullUrl };
    } else {
      medicationAdministration.encounter = undefined;
    }

    medicationAdministration.supportingInformation = source.supportingInformation?.length
      ? source.supportingInformation.map(ref => ({ reference: ref }))
      : undefined;

    medicationAdministration.occurrenceDateTime = source.occurrenceDateTime || undefined;
    medicationAdministration.occurrencePeriod = source.occurrencePeriod
      ? { start: source.occurrencePeriod.start, end: source.occurrencePeriod.end }
      : undefined;
    medicationAdministration.occurrenceTiming = source.occurrenceTiming || undefined;
    medicationAdministration.recorded = source.recorded || undefined;

    medicationAdministration.isSubPotent = source.isSubPotent ?? undefined;
    medicationAdministration.subPotentReason = source.subPotentReason?.length
      ? source.subPotentReason.map(mapCodeableConcept)
      : undefined;

    medicationAdministration.performer = source.performer?.length
      ? source.performer.map(performer => ({
        function: performer.function ? mapCodeableConcept(performer.function) : undefined,
        actor: performer.actor ? { reference: resolveActorRef(resolveRef, performer.actor) } : undefined
      })).filter(entry => entry.function || entry.actor)
      : undefined;

    medicationAdministration.reason = source.reason?.length
      ? source.reason.map(reason => {
        if (reason.reference) {
          return { reference: reason.reference };
        }
        if (reason.code) {
          return { concept: mapCodeableConcept(reason.code) };
        }
        return null;
      }).filter(Boolean)
      : undefined;

    medicationAdministration.request = source.request
      ? { reference: resolveRef('MedicationRequest', source.request) || `MedicationRequest/${source.request}` }
      : undefined;

    medicationAdministration.device = source.device?.length
      ? source.device.map(deviceId => ({
        reference: resolveRef('Device', deviceId) || `Device/${deviceId}`
      }))
      : undefined;

    medicationAdministration.note = source.note?.length
      ? source.note.map(text => ({ text }))
      : undefined;

    medicationAdministration.basedOn = source.basedOn?.length
      ? source.basedOn.map(ref => ({
        reference: resolveRef('CarePlan', ref) || `CarePlan/${ref}`
      }))
      : undefined;

    medicationAdministration.partOf = source.partOf?.length
      ? source.partOf.map(ref => ({ reference: ref }))
      : undefined;

    medicationAdministration.dosage = source.dosage
      ? {
        text: source.dosage.text,
        site: source.dosage.site ? mapCodeableConcept(source.dosage.site) : undefined,
        route: source.dosage.route ? mapCodeableConcept(source.dosage.route) : undefined,
        method: source.dosage.method ? mapCodeableConcept(source.dosage.method) : undefined,
        dose: source.dosage.dose ? {
          value: source.dosage.dose.value,
          unit: source.dosage.dose.unit
        } : undefined,
        rateRatio: source.dosage.rateRatio,
        rateQuantity: source.dosage.rateQuantity
      }
      : undefined;

    medicationAdministration.eventHistory = source.eventHistory?.length
      ? source.eventHistory.map(ref => ({ reference: ref }))
      : undefined;

    const summary = medicationAdministration.medication?.concept?.text || medicationAdministration.id;
    if (summary) medicationAdministration.text = makeNarrative('MedicationAdministration', summary);

    if (operation === 'delete') {
      medicationAdministration.status = 'entered-in-error';
    }

    const entry: any = {
      resource: medicationAdministration,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `MedicationAdministration?identifier=${identifierSystem}|${identifierValue || medicationAdministration.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `MedicationAdministration/${medicationAdministration.id}`
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
    resolveRef('Device', actorId) ||
    resolveRef('Patient', actorId) ||
    `Practitioner/${actorId}`
  );
}
