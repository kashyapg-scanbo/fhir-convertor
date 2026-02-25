import crypto from 'crypto';
import encounterTemplate from '../../shared/templates/encounter.json' with { type: 'json' };
import type { CanonicalEncounter, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface EncounterMapperArgs {
  encounter?: CanonicalEncounter;
  operation?: OperationType;
  registry: FullUrlRegistry;
  patientFullUrl?: string;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export interface EncounterMappingResult {
  entries: any[];
  encounterFullUrl?: string;
}

/** FHIR R5 Encounter status value set: planned, in-progress, on-hold, discharged, completed, cancelled, discontinued, entered-in-error, unknown. */
const FHIR_ENCOUNTER_STATUSES = new Set([
  'planned', 'in-progress', 'on-hold', 'discharged', 'completed', 'cancelled', 'discontinued', 'entered-in-error', 'unknown'
]);
function toFhirEncounterStatus(status?: string): string {
  if (!status) return 'in-progress';
  const lower = status.toLowerCase().trim();
  if (FHIR_ENCOUNTER_STATUSES.has(lower)) return lower;
  if (['finished', 'done', 'complete', 'final'].includes(lower)) return 'completed';
  return 'in-progress';
}

/** v3-ActCode encounter class: use official codes (AMB, IMP, etc.); map display names to code. */
function toFhirEncounterClassCode(input: string): { code: string; display: string } {
  if (!input) return { code: 'IMP', display: 'inpatient encounter' };
  const normalized = input.trim().toUpperCase();
  const map: Record<string, { code: string; display: string }> = {
    'AMB': { code: 'AMB', display: 'ambulatory' },
    'AMBULATORY': { code: 'AMB', display: 'ambulatory' },
    'IMP': { code: 'IMP', display: 'inpatient encounter' },
    'INPATIENT': { code: 'IMP', display: 'inpatient encounter' },
    'SS': { code: 'SS', display: 'short stay' },
    'EMER': { code: 'EMER', display: 'emergency' },
    'EMERGENCY': { code: 'EMER', display: 'emergency' },
    'OBS': { code: 'OBSENC', display: 'observation' },
    'OBSERVATION': { code: 'OBSENC', display: 'observation' },
    'VR': { code: 'VR', display: 'virtual' },
    'VIRTUAL': { code: 'VR', display: 'virtual' },
    'HH': { code: 'HH', display: 'home health' },
    'FLD': { code: 'FLD', display: 'field' }
  };
  if (map[normalized]) return map[normalized];
  const lower = input.trim().toLowerCase();
  if (lower === 'ambulatory') return { code: 'AMB', display: 'ambulatory' };
  if (lower === 'inpatient') return { code: 'IMP', display: 'inpatient encounter' };
  if (lower === 'emergency') return { code: 'EMER', display: 'emergency' };
  if (lower === 'observation') return { code: 'OBSENC', display: 'observation' };
  if (lower === 'virtual') return { code: 'VR', display: 'virtual' };
  return { code: normalized || 'IMP', display: input.trim() };
}

export function mapEncounter({
  encounter: canonicalEncounter,
  operation,
  registry,
  patientFullUrl,
  resolveRef
}: EncounterMapperArgs): EncounterMappingResult {
  if (!canonicalEncounter) {
    return { entries: [] };
  }

  const encounterResource = structuredClone(encounterTemplate) as any;
  const encounterIdentifier = canonicalEncounter.id;
  const identifierSystem = 'urn:hl7-org:v2';

  encounterResource.id = crypto.randomUUID();
  encounterResource.status = toFhirEncounterStatus(canonicalEncounter.status);
  const encounterFullUrl = `urn:uuid:${encounterResource.id}`;

  encounterResource.identifier = encounterIdentifier ? [{
    system: identifierSystem,
    value: encounterIdentifier
  }] : undefined;

  registry.register(
    'Encounter',
    {
      identifier: encounterIdentifier,
      id: encounterResource.id
    },
    encounterFullUrl
  );

  encounterResource.subject = patientFullUrl ? { reference: patientFullUrl } : undefined;
  if (canonicalEncounter.class) {
    const classInput = String(canonicalEncounter.class);
    const { code: classCode, display: classDisplay } = toFhirEncounterClassCode(classInput);
    encounterResource.class = [{
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: classCode,
          display: classDisplay
        }
      ]
    }];
    encounterResource.text = makeNarrative('Encounter', `class ${classDisplay}`);
  } else {
    encounterResource.class = undefined;
  }

  if (canonicalEncounter.start || canonicalEncounter.end) {
    encounterResource.actualPeriod = {
      ...(canonicalEncounter.start && { start: canonicalEncounter.start }),
      ...(canonicalEncounter.end && { end: canonicalEncounter.end })
    };
  } else {
    encounterResource.actualPeriod = undefined;
  }

  if (canonicalEncounter.location) {
    encounterResource.location = [{
      location: { display: canonicalEncounter.location }
    }];
  } else {
    encounterResource.location = undefined;
  }

  const serviceProviderRef = canonicalEncounter.serviceProviderOrganizationId
    ? resolveRef('Organization', canonicalEncounter.serviceProviderOrganizationId)
    : undefined;
  if (serviceProviderRef) {
    encounterResource.serviceProvider = { reference: serviceProviderRef };
  } else {
    encounterResource.serviceProvider = undefined;
  }

  if (canonicalEncounter.participantPractitionerIds?.length) {
    encounterResource.participant = canonicalEncounter.participantPractitionerIds
      .map(practitionerId => {
        const ref = resolveRef('Practitioner', practitionerId);
        return ref ? { actor: { reference: ref } } : null;
      })
      .filter((p): p is { actor: { reference: string } } => p !== null);
    if (encounterResource.participant.length === 0) encounterResource.participant = undefined;
  } else {
    encounterResource.participant = undefined;
  }

  encounterResource.priority = undefined;
  encounterResource.type = undefined;
  encounterResource.serviceType = undefined;
  encounterResource.subjectStatus = undefined;
  encounterResource.episodeOfCare = undefined;
  encounterResource.basedOn = undefined;
  encounterResource.careTeam = undefined;
  encounterResource.partOf = undefined;
  encounterResource.appointment = undefined;
  encounterResource.virtualService = undefined;
  encounterResource.plannedStartDate = undefined;
  encounterResource.plannedEndDate = undefined;
  encounterResource.length = undefined;
  encounterResource.reason = undefined;
  encounterResource.diagnosis = undefined;
  encounterResource.account = undefined;
  encounterResource.dietPreference = undefined;
  encounterResource.specialArrangement = undefined;
  encounterResource.specialCourtesy = undefined;
  encounterResource.admission = undefined;

  const encounterEntry: any = {
    resource: encounterResource,
    fullUrl: encounterFullUrl
  };

  if (operation === 'create' && encounterIdentifier) {
    encounterEntry.request = {
      method: 'PUT',
      url: `Encounter?identifier=${identifierSystem}|${encounterIdentifier}`
    };
  }

  const entries: any[] = [encounterEntry];

  // if (canonicalEncounter.class) {
  //   const encounterClassCodeSystem = {
  //     resourceType: 'CodeSystem',
  //     id: crypto.randomUUID(),
  //     url: 'https://terminology.hl7.org/CodeSystem/encounter-class',
  //     status: 'active',
  //     content: 'complete',
  //     caseSensitive: false,
  //     concept: [
  //       { code: 'inpatient', display: 'inpatient', definition: 'An encounter during which the patient is admitted to the facility.' },
  //       { code: 'outpatient', display: 'outpatient', definition: 'An encounter where the patient is seen without being admitted.' },
  //       { code: 'ambulatory', display: 'ambulatory', definition: 'An ambulatory encounter where the patient visits a clinic or office.' },
  //       { code: 'virtual', display: 'virtual', definition: 'An encounter that is conducted virtually/telehealth.' }
  //     ]
  //   };

  //   const encounterClassFullUrl = `urn:uuid:${encounterClassCodeSystem.id}`;
  //   registry.register('CodeSystem', { identifier: 'encounter-class', id: encounterClassCodeSystem.id }, encounterClassFullUrl);
  //   entries.push({ resource: encounterClassCodeSystem, fullUrl: encounterClassFullUrl });
  // }

  return { entries, encounterFullUrl };
}
