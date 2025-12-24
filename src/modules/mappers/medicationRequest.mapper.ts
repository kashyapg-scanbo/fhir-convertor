import crypto from 'crypto';
import medicationRequestTemplate from '../../shared/templates/medicationRequest.json' with { type: 'json' };
import type { CanonicalMedicationRequest, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface MedicationRequestMapperArgs {
  medicationRequests?: CanonicalMedicationRequest[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
  patientFullUrl: string;
  encounterFullUrl?: string;
}

export function mapMedicationRequests({
  medicationRequests,
  operation,
  registry,
  resolveRef,
  patientFullUrl,
  encounterFullUrl
}: MedicationRequestMapperArgs) {
  if (!medicationRequests || medicationRequests.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < medicationRequests.length; index++) {
    const source = medicationRequests[index];
    const medicationRequest = structuredClone(medicationRequestTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.identifier || source.id;

    medicationRequest.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${medicationRequest.id}`;
    medicationRequest.identifier = identifierValue ? [{
      system: identifierSystem,
      value: identifierValue
    }] : undefined;

    registry.register(
      'MedicationRequest',
      {
        identifier: source.id || source.identifier || medicationRequest.id,
        id: medicationRequest.id
      },
      fullUrl
    );

    medicationRequest.status = source.status || 'active';
    medicationRequest.intent = source.intent || 'order';

    // R5 uses a CodeableReference for medication (property `medication` with concept/reference)
    if (source.medicationCodeableConcept || source.medicationReference) {
      medicationRequest.medication = {};
      if (source.medicationCodeableConcept) {
        medicationRequest.medication.concept = {
          coding: source.medicationCodeableConcept.coding || [],
          text: source.medicationCodeableConcept.text || ''
        };
      }
      if (source.medicationReference) {
        medicationRequest.medication.reference = {
          reference: resolveRef('Medication', source.medicationReference) || `Medication/${source.medicationReference}`
        };
      }
    }

    // Sanitize medication coding: if a coding claims to be LOINC but the code
    // value looks like a short numeric (e.g., "500") which is not a valid
    // LOINC code, treat it as a local code to avoid validator errors.
    if (medicationRequest.medication?.concept?.coding && Array.isArray(medicationRequest.medication.concept.coding)) {
      medicationRequest.medication.concept.coding = medicationRequest.medication.concept.coding.map((c: any) => {
        const sys = String(c.system || '').toLowerCase();
        const code = String(c.code || '');
        // Heuristic: LOINC codes usually contain a dash (e.g., 8867-4). Short numeric codes without a dash are likely not LOINC.
        if (sys.includes('loinc') && !code.includes('-')) {
          // Preserve original coding in a note and re-write system to a local urn
          if (!medicationRequest.note) medicationRequest.note = [];
          medicationRequest.note.push({ text: `Original medication coding moved from LOINC: ${c.system}|${c.code}` });
          return { system: 'urn:hl7-org:local', code: code, display: c.display };
        }
        return c;
      });
    }

    if (source.subject) {
      medicationRequest.subject = {
        reference: resolveRef('Patient', source.subject) || `Patient/${source.subject}`
      };
    } else {
      medicationRequest.subject = { reference: patientFullUrl };
    }

    if (source.encounter) {
      medicationRequest.encounter = {
        reference: resolveRef('Encounter', source.encounter) || `Encounter/${source.encounter}`
      };
    } else if (encounterFullUrl) {
      medicationRequest.encounter = { reference: encounterFullUrl };
    } else {
      medicationRequest.encounter = undefined;
    }

    medicationRequest.authoredOn = source.authoredOn || '';

    const medReqSummary = medicationRequest.medication?.concept?.text || medicationRequest.id;
    if (medReqSummary) medicationRequest.text = makeNarrative('MedicationRequest', medReqSummary);

    if (source.requester) {
      medicationRequest.requester = {
        reference: resolveRef('Practitioner', source.requester) || `Practitioner/${source.requester}`
      };
    } else {
      medicationRequest.requester = undefined;
    }

    if (source.performer) {
      medicationRequest.performer = [{
        reference: resolveRef('Practitioner', source.performer) || `Practitioner/${source.performer}`
      }];
    } else {
      medicationRequest.performer = undefined;
    }

    medicationRequest.dosageInstruction = source.dosageInstruction?.length
      ? source.dosageInstruction
      : undefined;

    medicationRequest.statusReason = undefined;
    medicationRequest.statusChanged = undefined;
    medicationRequest.category = undefined;
    medicationRequest.priority = undefined;
    medicationRequest.doNotPerform = undefined;
    medicationRequest.informationSource = undefined;
    medicationRequest.supportingInformation = undefined;
    medicationRequest.reported = undefined;
    medicationRequest.performerType = undefined;
    medicationRequest.device = undefined;
    medicationRequest.recorder = undefined;
    medicationRequest.reason = undefined;
    medicationRequest.courseOfTherapyType = undefined;
    medicationRequest.insurance = undefined;
    medicationRequest.renderedDosageInstruction = undefined;
    medicationRequest.effectiveDosePeriod = undefined;
    medicationRequest.dispenseRequest = undefined;
    medicationRequest.substitution = undefined;
    medicationRequest.eventHistory = undefined;
    if (!medicationRequest.note?.length) medicationRequest.note = undefined;
    if (!medicationRequest.medication) medicationRequest.medication = undefined;
    if (!medicationRequest.authoredOn) medicationRequest.authoredOn = undefined;

    if (operation === 'delete') {
      medicationRequest.status = 'cancelled';
    }

    const entry: any = {
      resource: medicationRequest,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `MedicationRequest?identifier=${identifierSystem}|${identifierValue || medicationRequest.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `MedicationRequest/${medicationRequest.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}
