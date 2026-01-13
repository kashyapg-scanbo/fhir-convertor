import crypto from 'crypto';
import medicationDispenseTemplate from '../../shared/templates/medicationDispense.json' with { type: 'json' };
import type { CanonicalMedicationDispense, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface MedicationDispenseMapperArgs {
  medicationDispenses?: CanonicalMedicationDispense[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

export function mapMedicationDispenses({
  medicationDispenses,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: MedicationDispenseMapperArgs) {
  if (!medicationDispenses || medicationDispenses.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (const source of medicationDispenses) {
    const dispense = structuredClone(medicationDispenseTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    dispense.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${dispense.id}`;
    dispense.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'MedicationDispense',
      {
        identifier: source.id || source.identifier || dispense.id,
        id: dispense.id
      },
      fullUrl
    );

    dispense.status = source.status || 'completed';
    dispense.category = source.category?.length ? source.category.map(mapCodeableConcept) : undefined;

    if (source.medicationCodeableConcept || source.medicationReference) {
      dispense.medication = {};
      if (source.medicationCodeableConcept) {
        const coding = source.medicationCodeableConcept.coding?.map(c => ({
          system: c.system,
          code: c.code,
          display: c.display
        }));
        dispense.medication.concept = {
          coding: coding && coding.length ? coding : undefined,
          text: source.medicationCodeableConcept.text || coding?.[0]?.display || coding?.[0]?.code
        };
      }
      if (source.medicationReference) {
        dispense.medication.reference = {
          reference: resolveRef('Medication', source.medicationReference) || `Medication/${source.medicationReference}`
        };
      }
    } else {
      dispense.medication = undefined;
    }

    if (source.subject) {
      dispense.subject = {
        reference: resolveRef('Patient', source.subject) || `Patient/${source.subject}`
      };
    } else if (patientFullUrl) {
      dispense.subject = { reference: patientFullUrl };
    } else {
      dispense.subject = undefined;
    }

    if (source.encounter) {
      dispense.encounter = {
        reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}`
      };
    } else if (encounterFullUrl) {
      dispense.encounter = { reference: encounterFullUrl };
    } else {
      dispense.encounter = undefined;
    }

    dispense.supportingInformation = source.supportingInformation?.length
      ? source.supportingInformation.map(ref => ({ reference: ref }))
      : undefined;

    dispense.performer = source.performer?.length
      ? source.performer.map(performer => ({
        function: performer.function ? mapCodeableConcept(performer.function) : undefined,
        actor: performer.actor ? { reference: resolveActorRef(resolveRef, performer.actor) } : undefined
      }))
      : undefined;

    dispense.location = source.location ? { reference: resolveRef('Location', source.location) || `Location/${source.location}` } : undefined;
    dispense.authorizingPrescription = source.authorizingPrescription?.length
      ? source.authorizingPrescription.map(ref => ({ reference: resolveRef('MedicationRequest', ref) || `MedicationRequest/${ref}` }))
      : undefined;
    dispense.type = source.type ? mapCodeableConcept(source.type) : undefined;
    dispense.quantity = source.quantity ? { value: source.quantity.value, unit: source.quantity.unit } : undefined;
    dispense.daysSupply = source.daysSupply ? { value: source.daysSupply.value, unit: source.daysSupply.unit } : undefined;
    dispense.recorded = source.recorded || undefined;
    dispense.whenPrepared = source.whenPrepared || undefined;
    dispense.whenHandedOver = source.whenHandedOver || undefined;
    dispense.destination = source.destination ? { reference: resolveRef('Location', source.destination) || `Location/${source.destination}` } : undefined;
    dispense.receiver = source.receiver?.length
      ? source.receiver.map(ref => ({ reference: resolveActorRef(resolveRef, ref) }))
      : undefined;
    dispense.note = source.note?.length ? source.note.map(text => ({ text })) : undefined;
    dispense.renderedDosageInstruction = source.renderedDosageInstruction || undefined;
    dispense.dosageInstruction = source.dosageInstruction?.length ? source.dosageInstruction : undefined;

    if (source.substitution) {
      dispense.substitution = {
        wasSubstituted: source.substitution.wasSubstituted ?? undefined,
        type: source.substitution.type ? mapCodeableConcept(source.substitution.type) : undefined,
        reason: source.substitution.reason?.length ? source.substitution.reason.map(mapCodeableConcept) : undefined,
        responsibleParty: source.substitution.responsibleParty
          ? { reference: resolveActorRef(resolveRef, source.substitution.responsibleParty) }
          : undefined
      };
    } else {
      dispense.substitution = undefined;
    }

    dispense.eventHistory = source.eventHistory?.length ? source.eventHistory.map(ref => ({ reference: ref })) : undefined;

    const summary = dispense.medication?.concept?.text || dispense.id;
    if (summary) dispense.text = makeNarrative('MedicationDispense', summary);

    if (operation === 'delete') {
      dispense.status = 'cancelled';
    }

    const entry: any = {
      resource: dispense,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `MedicationDispense?identifier=${identifierSystem}|${identifierValue || dispense.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `MedicationDispense/${dispense.id}`
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
    resolveRef('Location', actorId) ||
    `Practitioner/${actorId}`
  );
}
