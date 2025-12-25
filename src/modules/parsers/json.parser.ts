import { CanonicalModel } from '../../shared/types/canonical.types.js';
import { z } from 'zod';

const CustomJSONSchema = z.object({
  operation: z.enum(['create', 'update', 'delete']).optional(),
  messageType: z.string().optional(),
  patient: z.object({
    id: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    middleName: z.string().optional(),
    gender: z.string().optional(),
    birthDate: z.string().optional(),
    address: z.object({
      line1: z.string().optional(),
      line2: z.string().optional(),
      city: z.string().optional(),
      state: z.string().optional(),
      postalCode: z.string().optional(),
      country: z.string().optional()
    }).optional(),
    contacts: z.array(z.object({
      type: z.enum(['homePhone', 'mobile', 'email', 'fax', 'url', 'other']).optional(),
      value: z.string()
    })).optional()
  }),
  encounter: z.object({
    id: z.string().optional(),
    classCode: z.string().optional(),
    startDateTime: z.string().optional(),
    location: z.string().optional(),
    status: z.string().optional(),
    participantPractitionerIds: z.array(z.string()).optional(),
    serviceProviderOrganizationId: z.string().optional()
  }).optional(),
  observations: z.array(z.object({
    id: z.string().optional(),
    code: z.string(),
    codeSystem: z.string().optional(),
    display: z.string().optional(),
    value: z.union([z.string(), z.number()]).optional(),
    unit: z.string().optional(),
    recordedDateTime: z.string().optional(),
    status: z.string().optional()
  })).optional(),
  medications: z.array(z.object({
    id: z.string().optional(),
    code: z.string(),
    codeSystem: z.string().optional(),
    display: z.string().optional(),
    status: z.string().optional()
  })).optional(),
  medicationRequests: z.array(z.object({
    id: z.string().optional(),
    medicationCode: z.string(),
    medicationCodeSystem: z.string().optional(),
    medicationDisplay: z.string().optional(),
    dose: z.number().optional(),
    doseUnit: z.string().optional(),
    frequency: z.string().optional(),
    route: z.string().optional(),
    authoredOn: z.string().optional(),
    subjectId: z.string().optional(),
    encounterId: z.string().optional(),
    requesterId: z.string().optional()
  })).optional(),
  practitioners: z.array(z.object({
    id: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
    identifier: z.string().optional()
  })).optional(),
  practitionerRoles: z.array(z.object({
    practitionerId: z.string(),
    organizationId: z.string().optional(),
    roleCode: z.string().optional(),
    roleDisplay: z.string().optional(),
    roleSystem: z.string().optional()
  })).optional(),
  organizations: z.array(z.object({
    id: z.string().optional(),
    name: z.string(),
    typeCode: z.string().optional(),
    typeDisplay: z.string().optional(),
    typeSystem: z.string().optional()
  })).optional(),
  documentReferences: z.array(z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    contentType: z.string().optional(),
    format: z.string().optional(), // Legacy format hint (e.g., 'pdf', 'dicom', 'jpeg', 'document.pdf')
    data: z.string().optional(),
    url: z.string().optional(),
    subjectId: z.string().optional(),
    date: z.string().optional(),
    status: z.string().optional()
  })).optional()
});

export type CustomJSONInput = z.infer<typeof CustomJSONSchema>;

/**
 * Parse custom JSON to Canonical Model
 * The JSON structure should match the canonical model
 */
export function parseCustomJSON(jsonInput: string | object): CanonicalModel {
  let parsed: any;
  
  if (typeof jsonInput === 'string') {
    try {
      parsed = JSON.parse(jsonInput);
    } catch (error) {
      throw new Error(
        `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  } else {
    parsed = jsonInput;
  }

  // Validate against schema
  let validated: CustomJSONInput;
  try {
    validated = CustomJSONSchema.parse(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `JSON validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    throw error;
  }

  const canonical: CanonicalModel = {
    operation: validated.operation,
    messageType: validated.messageType,
    patient: buildCanonicalPatient(validated.patient)
  };

  if (validated.encounter) {
    canonical.encounter = buildCanonicalEncounter(validated.encounter);
  }
  if (validated.observations?.length) {
    canonical.observations = validated.observations.map(buildCanonicalObservation);
  }
  if (validated.medications?.length) {
    canonical.medications = validated.medications.map(buildCanonicalMedication);
  }
  if (validated.medicationRequests?.length) {
    canonical.medicationRequests = validated.medicationRequests.map(req =>
      buildCanonicalMedicationRequest(req, canonical.patient.id, canonical.encounter?.id)
    );
  }
  if (validated.practitioners?.length) {
    canonical.practitioners = validated.practitioners.map(buildCanonicalPractitioner);
  }
  if (validated.practitionerRoles?.length) {
    canonical.practitionerRoles = validated.practitionerRoles.map(buildCanonicalPractitionerRole);
  }
  if (validated.organizations?.length) {
    canonical.organizations = validated.organizations.map(buildCanonicalOrganization);
  }
  if (validated.documentReferences?.length) {
    canonical.documentReferences = validated.documentReferences.map(doc =>
      buildCanonicalDocumentReference(doc, canonical.patient.id, canonical.encounter?.id)
    );
  }

  return canonical;
}

type TelecomSystem = 'phone' | 'email' | 'fax' | 'url' | 'other';

function buildCanonicalPatient(patient: any) {
  const given: string[] = [];
  if (patient.firstName) given.push(patient.firstName);
  if (patient.middleName) given.push(patient.middleName);

  const address = patient.address && (patient.address.line1 || patient.address.line2 || patient.address.city)
    ? [{
        line: [patient.address.line1, patient.address.line2].filter(Boolean) as string[],
        city: patient.address.city,
        state: patient.address.state,
        postalCode: patient.address.postalCode,
        country: patient.address.country
      }]
    : undefined;

  return {
    id: patient.id,
    identifier: patient.id,
    name: {
      family: patient.lastName,
      given: given.length ? given : undefined
    },
    gender: mapGender(patient.gender),
    birthDate: patient.birthDate,
    address,
    telecom: mapContacts(patient.contacts)
  };
}

function buildCanonicalEncounter(encounter: any) {
  return {
    id: encounter.id,
    class: encounter.classCode,
    start: encounter.startDateTime,
    location: encounter.location,
    status: encounter.status,
    participantPractitionerIds: encounter.participantPractitionerIds,
    serviceProviderOrganizationId: encounter.serviceProviderOrganizationId
  };
}

function buildCanonicalObservation(obs: any) {
  return {
    setId: obs.id,
    code: {
      system: obs.codeSystem ? mapCodeSystem(obs.codeSystem) : undefined,
      code: obs.code,
      display: obs.display
    },
    value: obs.value,
    unit: obs.unit,
    date: obs.recordedDateTime,
    status: obs.status || 'final'
  };
}

function buildCanonicalMedication(med: any) {
  return {
    id: med.id,
    identifier: med.id,
    code: {
      coding: [{
        system: med.codeSystem ? mapCodeSystem(med.codeSystem) : undefined,
        code: med.code,
        display: med.display
      }],
      text: med.display
    },
    status: med.status || 'active'
  };
}

function buildCanonicalMedicationRequest(req: any, patientId?: string, encounterId?: string) {
  return {
    id: req.id,
    identifier: req.id,
    status: 'active',
    intent: 'order',
    medicationCodeableConcept: {
      coding: [{
        system: req.medicationCodeSystem ? mapCodeSystem(req.medicationCodeSystem) : undefined,
        code: req.medicationCode,
        display: req.medicationDisplay
      }],
      text: req.medicationDisplay
    },
    subject: req.subjectId || patientId,
    encounter: req.encounterId || encounterId,
    authoredOn: req.authoredOn,
    requester: req.requesterId,
    dosageInstruction: req.dose || req.frequency || req.route
      ? [{
          text: [req.dose ? `${req.dose}${req.doseUnit ? ` ${req.doseUnit}` : ''}` : undefined, req.frequency, req.route]
            .filter(Boolean)
            .join(' ')
        }]
      : undefined
  };
}

function buildCanonicalPractitioner(prac: any) {
  const given = [prac.firstName, prac.middleName].filter(Boolean) as string[];
  return {
    id: prac.id,
    identifier: prac.identifier || prac.id,
    name: {
      family: prac.lastName,
      given: given.length ? given : undefined,
      prefix: prac.prefix ? [prac.prefix] : undefined,
      suffix: prac.suffix ? [prac.suffix] : undefined
    }
  };
}

function buildCanonicalPractitionerRole(role: any) {
  return {
    practitionerId: role.practitionerId,
    organizationId: role.organizationId,
    code: role.roleCode
      ? [{
          code: role.roleCode,
          display: role.roleDisplay,
          system: role.roleSystem
        }]
      : undefined
  };
}

function buildCanonicalOrganization(org: any) {
  return {
    id: org.id,
    identifier: org.id,
    name: org.name,
    type: org.typeCode
      ? [{
          system: org.typeSystem,
          code: org.typeCode,
          display: org.typeDisplay
        }]
      : undefined
  };
}

function buildCanonicalDocumentReference(doc: any, patientId?: string, encounterId?: string) {
  return {
    id: doc.id,
    status: doc.status || 'current',
    subject: patientId,
    date: doc.date,
    description: doc.description,
    content: [{
      attachment: {
        contentType: doc.contentType,
        data: doc.data,
        url: doc.url,
        title: doc.title,
        format: doc.format // Support legacy format field (e.g., 'pdf', 'dicom', 'jpeg')
      }
    }],
    context: encounterId ? { encounter: [encounterId] } : undefined
  };
}

function mapContacts(contacts?: Array<{ type?: string; value: string }>) {
  if (!contacts || contacts.length === 0) return undefined;
  return contacts.map(contact => ({
    system: mapContactType(contact.type),
    value: contact.value
  }));
}

function mapContactType(type?: string): TelecomSystem {
  if (!type) return 'other';
  const normalized = type.toLowerCase();
  if (normalized.includes('mail')) return 'email';
  if (normalized.includes('fax')) return 'fax';
  if (normalized.includes('url') || normalized.includes('http')) return 'url';
  if (normalized.includes('phone') || normalized.includes('mobile')) return 'phone';
  return 'other';
}

function mapGender(gender?: string) {
  if (!gender) return undefined;
  const normalized = gender.toLowerCase();
  if (['m', 'male'].includes(normalized)) return 'male';
  if (['f', 'female'].includes(normalized)) return 'female';
  if (['o', 'other'].includes(normalized)) return 'other';
  return 'unknown';
}

function mapCodeSystem(system?: string) {
  if (!system) return undefined;
  const normalized = system.toUpperCase();
  if (normalized.includes('LOINC')) return 'http://loinc.org';
  if (normalized.includes('SNOMED')) return 'http://snomed.info/sct';
  if (normalized.includes('RXNORM')) return 'http://www.nlm.nih.gov/research/umls/rxnorm';
  return system;
}
