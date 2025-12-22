import crypto from 'crypto';
import encounterTemplate from '../../shared/templates/encounter.json' with { type: 'json' };
import type { CanonicalEncounter, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface EncounterMapperArgs {
  encounter?: CanonicalEncounter;
  operation?: OperationType;
  registry: FullUrlRegistry;
  patientFullUrl: string;
}

export interface EncounterMappingResult {
  entries: any[];
  encounterFullUrl?: string;
}

function mapEncounterClass(code: string) {
  if (!code) return undefined;
  const normalized = code.toUpperCase();
  switch (normalized) {
    case 'IMP':
      return 'inpatient';
    case 'AMB':
      return 'ambulatory';
    case 'SS':
      return 'short-stay';
    case 'EMER':
    case 'EMERGENCY':
      return 'emergency';
    case 'OBS':
      return 'observation';
    case 'VR':
      return 'virtual';
    default:
      return normalized.toLowerCase();
  }
}

export function mapEncounter({
  encounter: canonicalEncounter,
  operation,
  registry,
  patientFullUrl
}: EncounterMapperArgs): EncounterMappingResult {
  if (!canonicalEncounter) {
    return { entries: [] };
  }

  const encounterResource = structuredClone(encounterTemplate) as any;
  const encounterIdentifier = canonicalEncounter.id;

  encounterResource.id = crypto.randomUUID();
  encounterResource.status = canonicalEncounter.status || 'in-progress';
  const encounterFullUrl = `urn:uuid:${encounterResource.id}`;

  registry.register(
    'Encounter',
    {
      identifier: encounterIdentifier,
      id: encounterResource.id
    },
    encounterFullUrl
  );

  encounterResource.subject.reference = patientFullUrl;
  if (canonicalEncounter.class) {
    const classCode = String(canonicalEncounter.class);
    const mappedClass = mapEncounterClass(classCode) || 'inpatient';
    encounterResource.class = [{
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: classCode
        },
        {
          system: 'https://terminology.hl7.org/CodeSystem/encounter-class',
          code: mappedClass,
          display: mappedClass
        }
      ]
    }];
    encounterResource.text = makeNarrative('Encounter', `class ${classCode}`);
  } else {
    encounterResource.class = undefined;
  }

  const encounterEntry: any = {
    resource: encounterResource,
    fullUrl: encounterFullUrl
  };

  if (operation === 'create' && encounterIdentifier) {
    encounterEntry.request = {
      method: 'PUT',
      url: `Encounter?identifier=urn:hl7-org:v2|${encounterIdentifier}`
    };
  }

  const entries: any[] = [encounterEntry];

  if (canonicalEncounter.class) {
    const encounterClassCodeSystem = {
      resourceType: 'CodeSystem',
      id: crypto.randomUUID(),
      url: 'https://terminology.hl7.org/CodeSystem/encounter-class',
      status: 'active',
      content: 'complete',
      caseSensitive: false,
      concept: [
        { code: 'inpatient', display: 'inpatient', definition: 'An encounter during which the patient is admitted to the facility.' },
        { code: 'outpatient', display: 'outpatient', definition: 'An encounter where the patient is seen without being admitted.' },
        { code: 'ambulatory', display: 'ambulatory', definition: 'An ambulatory encounter where the patient visits a clinic or office.' },
        { code: 'virtual', display: 'virtual', definition: 'An encounter that is conducted virtually/telehealth.' }
      ]
    };

    const encounterClassFullUrl = `urn:uuid:${encounterClassCodeSystem.id}`;
    registry.register('CodeSystem', { identifier: 'encounter-class', id: encounterClassCodeSystem.id }, encounterClassFullUrl);
    entries.push({ resource: encounterClassCodeSystem, fullUrl: encounterClassFullUrl });
  }

  return { entries, encounterFullUrl };
}
