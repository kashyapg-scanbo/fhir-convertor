import { CanonicalModel } from '../../shared/types/canonical.types.js';
import { z } from 'zod';

const LegacyCustomJSONSchema = z.object({
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
  }).optional(),
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
}).refine((value) => {
  return Boolean(
    value.patient ||
    value.encounter ||
    value.observations?.length ||
    value.medications?.length ||
    value.medicationRequests?.length ||
    value.practitioners?.length ||
    value.practitionerRoles?.length ||
    value.organizations?.length ||
    value.documentReferences?.length
  );
}, {
  message: 'At least one resource section is required (patient, encounter, observations, medications, medicationRequests, practitioners, practitionerRoles, organizations, documentReferences).',
  path: []
});

const GlobalStringSchema = z.preprocess((value) => {
  if (typeof value === 'number') return String(value);
  return value;
}, z.string());

const GlobalIdSchema = GlobalStringSchema;

const GlobalAddressSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: GlobalStringSchema.optional(),
  country: z.string().optional()
}).optional();

const GlobalPatientSchema = z.object({
  patient_id: GlobalIdSchema.optional(),
  ihi: GlobalIdSchema.optional(),
  name: z.object({
    first_name: z.string().optional(),
    middle_name: z.string().optional(),
    last_name: z.string().optional()
  }).optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  contact_info: z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
    address: GlobalAddressSchema
  }).optional(),
  marital_status: z.string().optional(),
  language: z.string().optional(),
  ethnicity: z.string().optional(),
  emergency_contact: z.object({
    name: z.string().optional(),
    relationship: z.string().optional(),
    phone: z.string().optional()
  }).optional(),
  insurance: z.object({
    provider: z.string().optional(),
    policy_number: z.string().optional(),
    coverage_start_date: z.string().optional(),
    coverage_end_date: z.string().optional()
  }).optional(),
  medical_history: z.object({
    allergies: z.array(z.string()).optional(),
    current_medications: z.array(z.string()).optional(),
    past_illnesses: z.array(z.string()).optional(),
    surgeries: z.array(z.object({
      surgery_name: z.string().optional(),
      surgery_date: z.string().optional()
    })).optional()
  }).optional()
});

const GlobalNumberSchema = z.preprocess((value) => {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return value;
}, z.number());

const GlobalEncounterSchema = z.object({
  encounter_id: GlobalIdSchema.optional(),
  patient_id: GlobalIdSchema.optional(),
  practitioner_id: GlobalIdSchema.optional(),
  encounter_type: z.string().optional(),
  reason_for_visit: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  location: z.object({
    facility_name: z.string().optional(),
    room: z.string().optional(),
    address: GlobalAddressSchema
  }).optional(),
  status: z.string().optional(),
  diagnoses: z.array(z.object({
    condition_id: GlobalIdSchema.optional(),
    condition_name: z.string().optional()
  })).optional(),
  services_provided: z.array(z.string()).optional(),
  billing_info: z.object({
    insurance_provider: z.string().optional(),
    policy_number: z.string().optional(),
    total_cost: GlobalNumberSchema.optional(),
    patient_responsibility: GlobalNumberSchema.optional()
  }).optional(),
  follow_up: z.object({
    recommended: z.boolean().optional(),
    next_appointment_date: z.string().optional()
  }).optional(),
  note: z.string().optional()
});

const GlobalMedicationSchema = z.object({
  medication_id: GlobalIdSchema.optional(),
  name: z.string().optional(),
  brand_name: z.string().optional(),
  form: z.string().optional(),
  strength: z.string().optional(),
  manufacturer: z.object({
    name: z.string().optional(),
    address: GlobalAddressSchema
  }).optional(),
  ingredients: z.array(z.object({
    name: z.string().optional(),
    strength: z.string().optional()
  })).optional(),
  package: z.object({
    description: z.string().optional(),
    quantity: GlobalNumberSchema.optional()
  }).optional(),
  status: z.string().optional(),
  expiration_date: z.string().optional(),
  lot_number: z.string().optional()
});

const GlobalMedicationRequestSchema = z.object({
  medication_request_id: GlobalIdSchema.optional(),
  patient_id: GlobalIdSchema.optional(),
  practitioner_id: GlobalIdSchema.optional(),
  medication: z.object({
    medication_id: GlobalIdSchema.optional(),
    name: z.string().optional(),
    strength: z.string().optional(),
    form: z.string().optional()
  }).optional(),
  dosage_instruction: z.object({
    dose: z.string().optional(),
    route: z.string().optional(),
    frequency: z.string().optional(),
    duration: z.string().optional()
  }).optional(),
  dispense_request: z.object({
    quantity: GlobalNumberSchema.optional(),
    refills: GlobalNumberSchema.optional(),
    expected_supply_duration: z.string().optional(),
    dispense_as_written: z.boolean().optional()
  }).optional(),
  substitution_allowed: z.boolean().optional(),
  reason_for_prescription: z.string().optional(),
  status: z.string().optional(),
  authored_on: z.string().optional(),
  note: z.string().optional()
});

const GlobalPractitionerSchema = z.object({
  practitioner_id: GlobalIdSchema.optional(),
  name: z.object({
    first_name: z.string().optional(),
    middle_name: z.string().optional(),
    last_name: z.string().optional()
  }).optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  contact_info: z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
    address: GlobalAddressSchema
  }).optional(),
  license: z.object({
    license_number: GlobalIdSchema.optional(),
    state_issued: z.string().optional(),
    issue_date: z.string().optional(),
    expiry_date: z.string().optional()
  }).optional(),
  specialization: z.string().optional(),
  years_of_experience: GlobalNumberSchema.optional(),
  languages_spoken: z.array(z.string()).optional(),
  practice_location: z.object({
    name: z.string().optional(),
    address: GlobalAddressSchema,
    phone: z.string().optional()
  }).optional(),
  qualifications: z.array(z.object({
    degree: z.string().optional(),
    institution: z.string().optional(),
    year: GlobalNumberSchema.optional()
  })).optional()
});

const GlobalPractitionerRoleSchema = z.object({
  practitioner_role_id: GlobalIdSchema.optional(),
  practitioner_id: GlobalIdSchema.optional(),
  organization_id: GlobalIdSchema.optional(),
  role: z.string().optional(),
  specialty: z.string().optional(),
  location: z.object({
    location_id: GlobalIdSchema.optional(),
    name: z.string().optional(),
    address: GlobalAddressSchema
  }).optional(),
  telecom: z.object({
    phone: z.string().optional(),
    email: z.string().optional()
  }).optional(),
  available_hours: z.object({
    weekdays: z.string().optional(),
    weekends: z.string().optional()
  }).optional(),
  service_period: z.object({
    start_date: z.string().optional(),
    end_date: z.union([z.string(), z.null()]).optional()
  }).optional()
});

const GlobalOrganizationSchema = z.object({
  organization_id: GlobalIdSchema.optional(),
  name: z.string().optional(),
  type: z.string().optional(),
  contact_info: z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
    address: GlobalAddressSchema,
    fax: z.string().optional(),
    website: z.string().optional()
  }).optional(),
  departments: z.array(z.object({
    name: z.string().optional(),
    contact_phone: z.string().optional()
  })).optional(),
  affiliations: z.array(z.object({
    name: z.string().optional(),
    type: z.string().optional()
  })).optional(),
  services_offered: z.array(z.string()).optional(),
  operating_hours: z.object({
    weekdays: z.string().optional(),
    weekends: z.string().optional()
  }).optional()
});

const GlobalCustomJSONSchema = z.object({
  operation: z.enum(['create', 'update', 'delete']).optional(),
  messageType: z.string().optional(),
  patient: z.union([GlobalPatientSchema, z.array(GlobalPatientSchema)]).optional(),
  encounter: z.union([GlobalEncounterSchema, z.array(GlobalEncounterSchema)]).optional(),
  medication: z.union([GlobalMedicationSchema, z.array(GlobalMedicationSchema)]).optional(),
  medication_request: z.union([GlobalMedicationRequestSchema, z.array(GlobalMedicationRequestSchema)]).optional(),
  practitioner: z.union([GlobalPractitionerSchema, z.array(GlobalPractitionerSchema)]).optional(),
  practitioner_role: z.union([GlobalPractitionerRoleSchema, z.array(GlobalPractitionerRoleSchema)]).optional(),
  organization: z.union([GlobalOrganizationSchema, z.array(GlobalOrganizationSchema)]).optional()
}).refine((value) => {
  return Boolean(
    value.patient ||
    value.encounter ||
    value.medication ||
    value.medication_request ||
    value.practitioner ||
    value.practitioner_role ||
    value.organization
  );
}, {
  message: 'At least one resource section is required (patient, encounter, medication, medication_request, practitioner, practitioner_role, organization).',
  path: []
});

export type CustomJSONInput = z.infer<typeof LegacyCustomJSONSchema>;
export type GlobalJSONInput = z.infer<typeof GlobalCustomJSONSchema>;

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

  const wrappedGlobal = wrapGlobalPayload(parsed);
  if (wrappedGlobal) {
    try {
      const validatedGlobal = GlobalCustomJSONSchema.parse(wrappedGlobal);
      return buildCanonicalFromGlobal(validatedGlobal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `JSON validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
        );
      }
      throw error;
    }
  }

  try {
    const validatedLegacy = LegacyCustomJSONSchema.parse(parsed);
    return buildCanonicalFromLegacy(validatedLegacy);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(
        `JSON validation failed: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
      );
    }
    throw error;
  }
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

function buildCanonicalFromLegacy(validated: CustomJSONInput): CanonicalModel {
  const canonical: CanonicalModel = {
    operation: validated.operation,
    messageType: validated.messageType,
    patient: validated.patient ? buildCanonicalPatient(validated.patient) : undefined
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
      buildCanonicalMedicationRequest(req, canonical.patient?.id, canonical.encounter?.id)
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
      buildCanonicalDocumentReference(doc, canonical.patient?.id, canonical.encounter?.id)
    );
  }

  return canonical;
}

function buildCanonicalFromGlobal(validated: GlobalJSONInput): CanonicalModel {
  const patients = normalizeArray(validated.patient);
  const encounters = normalizeArray(validated.encounter);
  const medications = normalizeArray(validated.medication);
  const medicationRequests = normalizeArray(validated.medication_request);
  const practitioners = normalizeArray(validated.practitioner);
  const practitionerRoles = normalizeArray(validated.practitioner_role);
  const organizations = normalizeArray(validated.organization);

  const canonical: CanonicalModel = {
    operation: validated.operation,
    messageType: validated.messageType,
    patient: patients[0] ? buildCanonicalPatientGlobal(patients[0]) : undefined,
    encounter: encounters[0] ? buildCanonicalEncounterGlobal(encounters[0]) : undefined
  };

  if (medications.length) {
    canonical.medications = medications.map(buildCanonicalMedicationGlobal);
  }
  if (medicationRequests.length) {
    canonical.medicationRequests = medicationRequests.map(buildCanonicalMedicationRequestGlobal);
  }
  if (practitioners.length) {
    canonical.practitioners = practitioners.map(buildCanonicalPractitionerGlobal);
  }
  if (practitionerRoles.length) {
    canonical.practitionerRoles = practitionerRoles.map(buildCanonicalPractitionerRoleGlobal);
  }
  if (organizations.length) {
    canonical.organizations = organizations.map(buildCanonicalOrganizationGlobal);
  }

  return canonical;
}

function normalizeArray<T>(value?: T | T[]): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function wrapGlobalPayload(value: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const hasGlobalKey = ['patient', 'encounter', 'medication', 'medication_request', 'practitioner', 'practitioner_role', 'organization']
    .some(key => key in value);
  if (hasGlobalKey) {
    const candidates = [
      value.patient,
      value.encounter,
      value.medication,
      value.medication_request,
      value.practitioner,
      value.practitioner_role,
      value.organization
    ].filter(Boolean);
    const matchesGlobal = candidates.some(candidate => looksLikeGlobalResource(candidate));
    return matchesGlobal ? value : null;
  }

  if (looksLikeGlobalResource(value)) {
    if ('patient_id' in value || 'ihi' in value || value.name?.first_name || value.name?.last_name) {
      return { patient: value };
    }
    if ('encounter_id' in value || 'encounter_type' in value) {
      return { encounter: value };
    }
    if ('medication_request_id' in value || 'dosage_instruction' in value) {
      return { medication_request: value };
    }
    if ('medication_id' in value || 'brand_name' in value || 'strength' in value) {
      return { medication: value };
    }
    if ('practitioner_role_id' in value || 'role' in value || 'specialty' in value) {
      return { practitioner_role: value };
    }
    if ('practitioner_id' in value || 'license' in value || value.name?.first_name) {
      return { practitioner: value };
    }
    if ('organization_id' in value || 'services_offered' in value || 'departments' in value) {
      return { organization: value };
    }
  }

  return null;
}

function looksLikeGlobalResource(value: any) {
  if (!value || typeof value !== 'object') return false;
  return (
    'patient_id' in value ||
    'ihi' in value ||
    'date_of_birth' in value ||
    'contact_info' in value ||
    'encounter_id' in value ||
    'encounter_type' in value ||
    'start_date' in value ||
    'medication_id' in value ||
    'brand_name' in value ||
    'strength' in value ||
    'medication_request_id' in value ||
    'dosage_instruction' in value ||
    'practitioner_id' in value ||
    'license' in value ||
    'practitioner_role_id' in value ||
    'organization_id' in value ||
    'services_offered' in value ||
    value?.name?.first_name ||
    value?.name?.last_name
  );
}

function buildCanonicalPatientGlobal(patient: z.infer<typeof GlobalPatientSchema>) {
  const given: string[] = [];
  if (patient.name?.first_name) given.push(patient.name.first_name);
  if (patient.name?.middle_name) given.push(patient.name.middle_name);

  const address = patient.contact_info?.address?.street
    ? [{
        line: [patient.contact_info.address.street].filter(Boolean) as string[],
        city: patient.contact_info.address.city,
        state: patient.contact_info.address.state,
        postalCode: patient.contact_info.address.postal_code,
        country: patient.contact_info.address.country
      }]
    : undefined;

  const telecom = mapGlobalContacts(patient.contact_info);

  return {
    id: patient.patient_id,
    identifier: patient.ihi || patient.patient_id,
    name: {
      family: patient.name?.last_name,
      given: given.length ? given : undefined
    },
    gender: mapGender(patient.gender),
    birthDate: patient.date_of_birth,
    address,
    telecom
  };
}

function buildCanonicalEncounterGlobal(encounter: z.infer<typeof GlobalEncounterSchema>) {
  const locationParts = [encounter.location?.facility_name, encounter.location?.room]
    .filter(Boolean)
    .join(' - ');

  return {
    id: encounter.encounter_id,
    class: encounter.encounter_type,
    start: encounter.start_date,
    location: locationParts || undefined,
    status: encounter.status,
    participantPractitionerIds: encounter.practitioner_id ? [encounter.practitioner_id] : undefined
  };
}

function buildCanonicalMedicationGlobal(med: z.infer<typeof GlobalMedicationSchema>) {
  const textParts = [med.name, med.strength].filter(Boolean).join(' ');
  const coding = med.medication_id ? [{
    system: 'urn:hl7-org:local',
    code: med.medication_id,
    display: med.name
  }] : undefined;
  const amount = parseQuantity(med.strength);

  return {
    id: med.medication_id,
    identifier: med.medication_id,
    code: textParts || coding ? {
      coding,
      text: textParts || med.name
    } : undefined,
    form: med.form ? {
      coding: [{
        system: 'urn:hl7-org:local',
        code: med.form,
        display: med.form
      }]
    } : undefined,
    manufacturer: med.manufacturer?.name,
    amount: amount || undefined,
    status: med.status
  };
}

function buildCanonicalMedicationRequestGlobal(req: z.infer<typeof GlobalMedicationRequestSchema>) {
  const medTextParts = [req.medication?.name, req.medication?.strength].filter(Boolean).join(' ');
  const medCoding = req.medication?.medication_id ? [{
    system: 'urn:hl7-org:local',
    code: req.medication.medication_id,
    display: req.medication?.name
  }] : undefined;

  const doseQuantity = parseQuantity(req.dosage_instruction?.dose);
  const dosageText = [
    req.dosage_instruction?.dose,
    req.dosage_instruction?.route,
    req.dosage_instruction?.frequency,
    req.dosage_instruction?.duration
  ].filter(Boolean).join(' ');

  return {
    id: req.medication_request_id,
    identifier: req.medication_request_id,
    status: req.status,
    intent: 'order',
    medicationCodeableConcept: medTextParts || medCoding ? {
      coding: medCoding,
      text: medTextParts || req.medication?.name
    } : undefined,
    subject: req.patient_id,
    encounter: undefined,
    authoredOn: req.authored_on,
    requester: req.practitioner_id,
    dosageInstruction: dosageText || doseQuantity ? [{
      text: dosageText || undefined,
      doseQuantity: doseQuantity || undefined,
      route: req.dosage_instruction?.route
        ? { text: req.dosage_instruction.route }
        : undefined
    }] : undefined
  };
}

function buildCanonicalPractitionerGlobal(prac: z.infer<typeof GlobalPractitionerSchema>) {
  const given = [prac.name?.first_name, prac.name?.middle_name].filter(Boolean) as string[];
  const telecom = mapGlobalContacts(prac.contact_info);

  const address = prac.contact_info?.address?.street
    ? [{
        line: [prac.contact_info.address.street].filter(Boolean) as string[],
        city: prac.contact_info.address.city,
        state: prac.contact_info.address.state,
        postalCode: prac.contact_info.address.postal_code,
        country: prac.contact_info.address.country
      }]
    : undefined;

  const qualifications = [
    ...(prac.specialization ? [{
      code: { display: prac.specialization }
    }] : []),
    ...(prac.qualifications || []).map(q => ({
      code: { display: q.degree }
    }))
  ];

  return {
    id: prac.practitioner_id,
    identifier: prac.license?.license_number || prac.practitioner_id,
    name: {
      family: prac.name?.last_name,
      given: given.length ? given : undefined
    },
    gender: mapGender(prac.gender),
    birthDate: prac.date_of_birth,
    telecom,
    address,
    qualification: qualifications.length ? qualifications : undefined
  };
}

function buildCanonicalPractitionerRoleGlobal(role: z.infer<typeof GlobalPractitionerRoleSchema>) {
  return {
    id: role.practitioner_role_id,
    practitionerId: role.practitioner_id,
    organizationId: role.organization_id,
    code: role.role ? [{
      code: role.role,
      display: role.role
    }] : undefined,
    specialty: role.specialty ? [{
      code: role.specialty,
      display: role.specialty
    }] : undefined,
    period: role.service_period ? {
      start: role.service_period.start_date,
      end: role.service_period.end_date || undefined
    } : undefined
  };
}

function buildCanonicalOrganizationGlobal(org: z.infer<typeof GlobalOrganizationSchema>) {
  const telecom = mapGlobalOrganizationTelecom(org.contact_info);
  const address = org.contact_info?.address?.street
    ? [{
        line: [org.contact_info.address.street].filter(Boolean) as string[],
        city: org.contact_info.address.city,
        state: org.contact_info.address.state,
        postalCode: org.contact_info.address.postal_code,
        country: org.contact_info.address.country
      }]
    : undefined;

  return {
    id: org.organization_id,
    identifier: org.organization_id,
    name: org.name,
    type: org.type ? [{
      code: org.type,
      display: org.type
    }] : undefined,
    telecom,
    address
  };
}

function mapGlobalContacts(contactInfo?: { phone?: string; email?: string }) {
  if (!contactInfo) return undefined;
  const telecom = [];
  if (contactInfo.phone) telecom.push({ system: 'phone' as TelecomSystem, value: contactInfo.phone });
  if (contactInfo.email) telecom.push({ system: 'email' as TelecomSystem, value: contactInfo.email });
  return telecom.length ? telecom : undefined;
}

function mapGlobalOrganizationTelecom(contactInfo?: { phone?: string; email?: string; fax?: string; website?: string }) {
  if (!contactInfo) return undefined;
  const telecom = [];
  if (contactInfo.phone) telecom.push({ system: 'phone' as TelecomSystem, value: contactInfo.phone });
  if (contactInfo.email) telecom.push({ system: 'email' as TelecomSystem, value: contactInfo.email });
  if (contactInfo.fax) telecom.push({ system: 'fax' as TelecomSystem, value: contactInfo.fax });
  if (contactInfo.website) telecom.push({ system: 'url' as TelecomSystem, value: contactInfo.website });
  return telecom.length ? telecom : undefined;
}

function parseQuantity(input?: string) {
  if (!input) return undefined;
  const match = String(input).trim().match(/^([0-9.]+)\s*([^\s]+)?/);
  if (!match) return undefined;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return undefined;
  return {
    value,
    unit: match[2]
  };
}
