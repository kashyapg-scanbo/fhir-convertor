import crypto from 'crypto';
import patientTemplate from '../../shared/templates/patient.json' with { type: 'json' };
import type { CanonicalPatient, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative, toFhirDate } from './utils.js';

export interface PatientMappingResult {
  entry: any;
  patientFullUrl: string;
}

interface PatientMapperArgs {
  patient: CanonicalPatient;
  operation?: OperationType;
  registry: FullUrlRegistry;
}

export function mapPatient({ patient: canonicalPatient, operation, registry }: PatientMapperArgs): PatientMappingResult {
  const patient = structuredClone(patientTemplate) as any;
  const patientId = canonicalPatient?.id;
  const patientIdentifier = canonicalPatient?.identifier ?? patientId;
  const identifierSystem = 'urn:hl7-org:v2';

  patient.id = crypto.randomUUID();

  if (patientIdentifier) {
    patient.identifier = [{
      system: identifierSystem,
      value: patientIdentifier
    }];
  } else {
    patient.identifier = undefined;
  }

  const hasNameData = Boolean(canonicalPatient?.name?.family || canonicalPatient?.name?.given?.length);
  patient.name = hasNameData ? [{
    family: canonicalPatient?.name?.family,
    given: canonicalPatient?.name?.given
  }] : undefined;

  patient.gender = canonicalPatient?.gender || undefined;
  patient.birthDate = toFhirDate(canonicalPatient?.birthDate) || undefined;
  patient.address = canonicalPatient?.address?.length
    ? canonicalPatient.address.map(address => ({
        ...address,
        use: mapAddressUse(address.use)
      }))
    : undefined;
  patient.telecom = canonicalPatient?.telecom?.length
    ? canonicalPatient.telecom.map(telecom => ({
        ...telecom,
        use: mapTelecomUse(telecom.use)
      }))
    : undefined;
  patient.deceasedBoolean = undefined;
  patient.deceasedDateTime = undefined;
  patient.maritalStatus = undefined;
  patient.multipleBirthBoolean = undefined;
  patient.multipleBirthInteger = undefined;
  patient.photo = undefined;
  patient.contact = undefined;
  patient.communication = undefined;
  patient.generalPractitioner = undefined;
  patient.managingOrganization = undefined;
  patient.link = undefined;

  const primaryName = Array.isArray(patient.name) ? patient.name[0] : undefined;
  const patientSummary = `${primaryName?.family ?? ''} ${primaryName?.given?.join(' ') ?? ''}`.trim();
  if (patientSummary) patient.text = makeNarrative('Patient', patientSummary);

  if (operation === 'delete' || canonicalPatient?.active === false) {
    patient.active = false;
  } else if (canonicalPatient?.active === true) {
    patient.active = true;
  } else {
    patient.active = undefined;
  }

  const patientFullUrl = `urn:uuid:${patient.id}`;
  if (patientIdentifier) {
    registry.register('Patient', { identifier: patientIdentifier, id: patient.id }, patientFullUrl);
  } else {
    registry.register('Patient', { id: patient.id }, patientFullUrl);
  }

  const patientEntry: any = {
    resource: patient,
    fullUrl: patientFullUrl
  };

  if (operation === 'create' && patientIdentifier) {
    patientEntry.request = {
      method: 'PUT',
      url: `Patient?identifier=${identifierSystem}|${patientIdentifier}`
    };
  } else if ((operation === 'update' || operation === 'delete') && patientId) {
    patientEntry.request = {
      method: 'PUT',
      url: `Patient/${patientId}`
    };
  }

  return { entry: patientEntry, patientFullUrl };
}

type CanonicalTelecomUse = NonNullable<CanonicalPatient['telecom']>[number]['use'];
type CanonicalAddressUse = NonNullable<CanonicalPatient['address']>[number]['use'];

function mapTelecomUse(use?: string): CanonicalTelecomUse | undefined {
  if (!use) return undefined;
  const normalized = use.toUpperCase();
  if (normalized === 'MC' || normalized === 'MOBILE') return 'mobile';
  if (normalized === 'WP' || normalized === 'DIR' || normalized === 'WORK') return 'work';
  if (normalized === 'H' || normalized === 'HP' || normalized === 'HV' || normalized === 'HOME') return 'home';
  if (normalized === 'TMP' || normalized === 'TEMP') return 'temp';
  if (normalized === 'OLD') return 'old';
  return use;
}

function mapAddressUse(use?: string): CanonicalAddressUse | undefined {
  if (!use) return undefined;
  const normalized = use.toUpperCase();
  if (normalized === 'WP' || normalized === 'WORK') return 'work';
  if (normalized === 'H' || normalized === 'HP' || normalized === 'HV' || normalized === 'HOME') return 'home';
  if (normalized === 'TMP' || normalized === 'TEMP') return 'temp';
  if (normalized === 'OLD' || normalized === 'BAD') return 'old';
  if (normalized === 'BILL' || normalized === 'B') return 'billing';
  return use;
}
  