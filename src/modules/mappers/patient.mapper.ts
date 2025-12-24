import crypto from 'crypto';
import patientTemplate from '../../shared/templates/patient.json' with { type: 'json' };
import type { CanonicalPatient, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

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
  patient.birthDate = canonicalPatient?.birthDate || undefined;
  patient.address = canonicalPatient?.address?.length ? canonicalPatient.address : undefined;
  patient.telecom = canonicalPatient?.telecom?.length ? canonicalPatient.telecom : undefined;
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
