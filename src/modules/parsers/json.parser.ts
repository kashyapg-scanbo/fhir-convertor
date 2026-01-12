import { CanonicalModel } from '../../shared/types/canonical.types.js';
import { HEADER_ALIAS_SECTIONS } from '../../shared/header-aliases.js';
import { mapTabularRowsToCanonical, normalizeHeader, TabularRow } from './tabular.utils.js';
import { z } from 'zod';

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

const PATIENT_NAME_ALIASES = {
  first: ['patient_first_name', ...HEADER_ALIAS_SECTIONS.patient.patient_first_name],
  middle: ['patient_middle_name', ...HEADER_ALIAS_SECTIONS.patient.patient_middle_name],
  last: ['patient_last_name', ...HEADER_ALIAS_SECTIONS.patient.patient_last_name]
};

const PRACTITIONER_NAME_ALIASES = {
  first: ['practitioner_first_name', ...HEADER_ALIAS_SECTIONS.practitioner.practitioner_first_name],
  middle: ['practitioner_middle_name', ...HEADER_ALIAS_SECTIONS.practitioner.practitioner_middle_name],
  last: ['practitioner_last_name', ...HEADER_ALIAS_SECTIONS.practitioner.practitioner_last_name]
};

function normalizeAliasKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_');
}

function buildAliasLookup(map: Record<string, string[]>) {
  const lookup = new Map<string, string>();
  for (const [canonical, aliases] of Object.entries(map)) {
    lookup.set(normalizeAliasKey(canonical), canonical);
    for (const alias of aliases) {
      lookup.set(normalizeAliasKey(alias), canonical);
    }
  }
  return lookup;
}

const SECTION_ALIAS_LOOKUPS = Object.fromEntries(
  Object.entries(HEADER_ALIAS_SECTIONS).map(([section, map]) => [section, buildAliasLookup(map)])
) as Record<keyof typeof HEADER_ALIAS_SECTIONS, Map<string, string>>;

function getAliasValue(record: Record<string, unknown>, aliases: string[]) {
  const aliasSet = new Set(aliases.map(alias => normalizeAliasKey(alias)));
  for (const [key, value] of Object.entries(record)) {
    if (aliasSet.has(normalizeAliasKey(key))) return value;
  }
  return undefined;
}

function normalizePersonNameAliases(value: unknown, aliases: { first: string[]; middle: string[]; last: string[] }) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const normalized: Record<string, unknown> = { ...record };

  if (normalized.first_name === undefined) {
    const first = getAliasValue(record, aliases.first);
    if (first !== undefined) normalized.first_name = first;
  }

  if (normalized.middle_name === undefined) {
    const middle = getAliasValue(record, aliases.middle);
    if (middle !== undefined) normalized.middle_name = middle;
  }

  if (normalized.last_name === undefined) {
    const last = getAliasValue(record, aliases.last);
    if (last !== undefined) normalized.last_name = last;
  }

  return normalized;
}

const GlobalPatientNameSchema = z.preprocess(
  (value) => normalizePersonNameAliases(value, PATIENT_NAME_ALIASES),
  z.object({
    first_name: z.string().optional(),
    middle_name: z.string().optional(),
    last_name: z.string().optional()
  })
);

const GlobalPractitionerNameSchema = z.preprocess(
  (value) => normalizePersonNameAliases(value, PRACTITIONER_NAME_ALIASES),
  z.object({
    first_name: z.string().optional(),
    middle_name: z.string().optional(),
    last_name: z.string().optional()
  })
);

const GlobalPatientSchema = z.object({
  patient_id: GlobalIdSchema.optional(),
  ihi: GlobalIdSchema.optional(),
  name: GlobalPatientNameSchema.optional(),
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
    code_system: z.string().optional(),
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

const GlobalMedicationStatementSchema = z.object({
  medication_statement_id: GlobalIdSchema.optional(),
  patient_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  medication: z.object({
    medication_id: GlobalIdSchema.optional(),
    code_system: z.string().optional(),
    name: z.string().optional(),
    strength: z.string().optional(),
    form: z.string().optional()
  }).optional(),
  effective_date: z.string().optional(),
  effective_start: z.string().optional(),
  effective_end: z.string().optional(),
  date_asserted: z.string().optional(),
  author_id: GlobalIdSchema.optional(),
  information_source: z.union([z.string(), z.array(z.string())]).optional(),
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.string().optional(),
  dosage: z.object({
    dose: z.string().optional(),
    dose_unit: z.string().optional(),
    route: z.string().optional(),
    frequency: z.string().optional(),
    duration: z.string().optional()
  }).optional()
});

const GlobalProcedureSchema = z.object({
  procedure_id: GlobalIdSchema.optional(),
  patient_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  code: z.object({
    code: z.string().optional(),
    code_system: z.string().optional(),
    display: z.string().optional()
  }).optional(),
  occurrence_date: z.string().optional(),
  occurrence_start: z.string().optional(),
  occurrence_end: z.string().optional(),
  recorded: z.string().optional(),
  performer_id: GlobalIdSchema.optional(),
  location: z.string().optional(),
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  body_site: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.string().optional()
});

const GlobalConditionSchema = z.object({
  condition_id: GlobalIdSchema.optional(),
  patient_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  clinical_status: z.string().optional(),
  verification_status: z.string().optional(),
  category: z.string().optional(),
  severity: z.string().optional(),
  code: z.object({
    code: z.string().optional(),
    code_system: z.string().optional(),
    display: z.string().optional()
  }).optional(),
  body_site: z.union([z.string(), z.array(z.string())]).optional(),
  onset_date: z.string().optional(),
  onset_start: z.string().optional(),
  onset_end: z.string().optional(),
  onset_text: z.string().optional(),
  abatement_date: z.string().optional(),
  abatement_start: z.string().optional(),
  abatement_end: z.string().optional(),
  abatement_text: z.string().optional(),
  recorded_date: z.string().optional(),
  note: z.string().optional()
});

const GlobalAppointmentSchema = z.object({
  appointment_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  description: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  minutes_duration: GlobalNumberSchema.optional(),
  created: z.string().optional(),
  cancellation_date: z.string().optional(),
  subject_id: GlobalIdSchema.optional(),
  participant_id: GlobalIdSchema.optional(),
  participant_status: z.string().optional(),
  note: z.string().optional()
});

const GlobalScheduleSchema = z.object({
  schedule_id: GlobalIdSchema.optional(),
  active: z.union([z.boolean(), z.string(), z.number()]).optional(),
  name: z.string().optional(),
  actor_id: z.union([z.string(), z.array(z.string())]).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  comment: z.string().optional(),
  service_category: z.string().optional(),
  service_type: z.string().optional(),
  specialty: z.string().optional()
});

const GlobalSlotSchema = z.object({
  slot_id: GlobalIdSchema.optional(),
  schedule_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  overbooked: z.union([z.boolean(), z.string(), z.number()]).optional(),
  comment: z.string().optional(),
  service_category: z.string().optional(),
  service_type: z.string().optional(),
  specialty: z.string().optional(),
  appointment_type: z.string().optional()
});

const GlobalDiagnosticReportSchema = z.object({
  diagnostic_report_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  code: z.object({
    code: z.string().optional(),
    code_system: z.string().optional(),
    display: z.string().optional()
  }).optional(),
  subject_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  effective_date: z.string().optional(),
  effective_start: z.string().optional(),
  effective_end: z.string().optional(),
  issued: z.string().optional(),
  performer_id: z.union([z.string(), z.array(z.string())]).optional(),
  result_ids: z.union([z.string(), z.array(z.string())]).optional(),
  conclusion: z.string().optional(),
  note: z.string().optional()
});

const GlobalRelatedPersonSchema = z.object({
  related_person_id: GlobalIdSchema.optional(),
  active: z.union([z.boolean(), z.string(), z.number()]).optional(),
  patient_id: GlobalIdSchema.optional(),
  relationship: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  gender: z.string().optional(),
  birth_date: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional()
});

const GlobalLocationSchema = z.object({
  location_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  name: z.string().optional(),
  alias: z.union([z.string(), z.array(z.string())]).optional(),
  description: z.string().optional(),
  mode: z.string().optional(),
  type: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  managing_org_id: GlobalIdSchema.optional(),
  part_of_id: GlobalIdSchema.optional()
});

const GlobalEpisodeOfCareSchema = z.object({
  episode_of_care_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  diagnosis: z.union([z.string(), z.array(z.string())]).optional(),
  patient_id: GlobalIdSchema.optional(),
  managing_org_id: GlobalIdSchema.optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  referral_request_ids: z.union([z.string(), z.array(z.string())]).optional(),
  care_manager_id: GlobalIdSchema.optional(),
  care_team_ids: z.union([z.string(), z.array(z.string())]).optional(),
  account_ids: z.union([z.string(), z.array(z.string())]).optional(),
  status_history_status: z.string().optional(),
  status_history_start: z.string().optional(),
  status_history_end: z.string().optional()
});

const GlobalPractitionerSchema = z.object({
  practitioner_id: GlobalIdSchema.optional(),
  name: GlobalPractitionerNameSchema.optional(),
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
  medication_statement: z.union([GlobalMedicationStatementSchema, z.array(GlobalMedicationStatementSchema)]).optional(),
  procedure: z.union([GlobalProcedureSchema, z.array(GlobalProcedureSchema)]).optional(),
  condition: z.union([GlobalConditionSchema, z.array(GlobalConditionSchema)]).optional(),
  appointment: z.union([GlobalAppointmentSchema, z.array(GlobalAppointmentSchema)]).optional(),
  schedule: z.union([GlobalScheduleSchema, z.array(GlobalScheduleSchema)]).optional(),
  slot: z.union([GlobalSlotSchema, z.array(GlobalSlotSchema)]).optional(),
  diagnostic_report: z.union([GlobalDiagnosticReportSchema, z.array(GlobalDiagnosticReportSchema)]).optional(),
  related_person: z.union([GlobalRelatedPersonSchema, z.array(GlobalRelatedPersonSchema)]).optional(),
  location: z.union([GlobalLocationSchema, z.array(GlobalLocationSchema)]).optional(),
  episode_of_care: z.union([GlobalEpisodeOfCareSchema, z.array(GlobalEpisodeOfCareSchema)]).optional(),
  practitioner: z.union([GlobalPractitionerSchema, z.array(GlobalPractitionerSchema)]).optional(),
  practitioner_role: z.union([GlobalPractitionerRoleSchema, z.array(GlobalPractitionerRoleSchema)]).optional(),
  organization: z.union([GlobalOrganizationSchema, z.array(GlobalOrganizationSchema)]).optional()
}).refine((value) => {
  return Boolean(
    value.patient ||
    value.encounter ||
    value.medication ||
    value.medication_request ||
    value.medication_statement ||
    value.procedure ||
    value.condition ||
    value.appointment ||
    value.schedule ||
    value.slot ||
    value.diagnostic_report ||
    value.related_person ||
    value.location ||
    value.episode_of_care ||
    value.practitioner ||
    value.practitioner_role ||
    value.organization
  );
}, {
  message: 'At least one resource section is required (patient, encounter, medication, medication_request, medication_statement, procedure, condition, appointment, schedule, slot, diagnostic_report, related_person, location, episode_of_care, practitioner, practitioner_role, organization).',
  path: []
});

export type GlobalJSONInput = z.infer<typeof GlobalCustomJSONSchema>;

const TABULAR_HEADER_SET = new Set(
  Object.values(HEADER_ALIAS_SECTIONS).flatMap(section => [
    ...Object.keys(section),
    ...Object.values(section).flat()
  ]).map(key => normalizeHeader(key))
);

const SECTION_NAME_MAP: Record<string, keyof typeof HEADER_ALIAS_SECTIONS> = {
  patient: 'patient',
  encounter: 'encounter',
  observations: 'observation',
  medications: 'medication',
  medicationRequests: 'medicationRequest',
  medicationStatements: 'medicationStatement',
  procedures: 'procedure',
  conditions: 'condition',
  appointments: 'appointment',
  schedules: 'schedule',
  slots: 'slot',
  diagnosticReports: 'diagnosticReport',
  relatedPersons: 'relatedPerson',
  locations: 'location',
  episodesOfCare: 'episodeOfCare',
  practitioners: 'practitioner',
  practitionerRoles: 'practitionerRole',
  organizations: 'organization',
  documentReferences: 'documentReference'
};

const SECTION_KEY_ALIASES: Record<string, keyof typeof HEADER_ALIAS_SECTIONS> = {
  ...SECTION_NAME_MAP,
  medication_request: 'medicationRequest',
  medication_requests: 'medicationRequest',
  medication_statement: 'medicationStatement',
  medication_statements: 'medicationStatement',
  procedure: 'procedure',
  procedures: 'procedure',
  condition: 'condition',
  conditions: 'condition',
  appointment: 'appointment',
  appointments: 'appointment',
  schedule: 'schedule',
  schedules: 'schedule',
  slot: 'slot',
  slots: 'slot',
  diagnostic_report: 'diagnosticReport',
  diagnostic_reports: 'diagnosticReport',
  related_person: 'relatedPerson',
  related_persons: 'relatedPerson',
  location: 'location',
  locations: 'location',
  episode_of_care: 'episodeOfCare',
  episode_of_cares: 'episodeOfCare',
  practitioner_role: 'practitionerRole',
  practitioner_roles: 'practitionerRole',
  document_reference: 'documentReference',
  document_references: 'documentReference'
};

const STRUCTURED_SECTION_LOOKUP = new Map<string, keyof typeof HEADER_ALIAS_SECTIONS>(
  Object.entries(SECTION_KEY_ALIASES).map(([key, section]) => [normalizeAliasKey(key), section])
);

const SECTION_CANONICAL_KEYS: Record<keyof typeof HEADER_ALIAS_SECTIONS, Set<string>> = Object
  .fromEntries(
    Object.entries(HEADER_ALIAS_SECTIONS).map(([section, map]) => ([
      section,
      new Set(Object.keys(map).map(key => normalizeHeader(key)))
    ]))
  ) as Record<keyof typeof HEADER_ALIAS_SECTIONS, Set<string>>;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const GLOBAL_TOP_LEVEL_KEY_MAP: Record<string, string> = {
  patient: 'patient',
  patients: 'patient',
  encounter: 'encounter',
  encounters: 'encounter',
  medication: 'medication',
  medications: 'medication',
  medication_request: 'medication_request',
  medication_requests: 'medication_request',
  medicationrequest: 'medication_request',
  medicationrequests: 'medication_request',
  medication_statement: 'medication_statement',
  medication_statements: 'medication_statement',
  medicationstatement: 'medication_statement',
  medicationstatements: 'medication_statement',
  procedure: 'procedure',
  procedures: 'procedure',
  condition: 'condition',
  conditions: 'condition',
  appointment: 'appointment',
  appointments: 'appointment',
  schedule: 'schedule',
  schedules: 'schedule',
  slot: 'slot',
  slots: 'slot',
  diagnostic_report: 'diagnostic_report',
  diagnostic_reports: 'diagnostic_report',
  diagnosticreport: 'diagnostic_report',
  diagnosticreports: 'diagnostic_report',
  related_person: 'related_person',
  related_persons: 'related_person',
  relatedperson: 'related_person',
  relatedpersons: 'related_person',
  location: 'location',
  locations: 'location',
  episode_of_care: 'episode_of_care',
  episode_of_cares: 'episode_of_care',
  episodeofcare: 'episode_of_care',
  episodeofcares: 'episode_of_care',
  practitioner: 'practitioner',
  practitioners: 'practitioner',
  practitioner_role: 'practitioner_role',
  practitioner_roles: 'practitioner_role',
  practitionerrole: 'practitioner_role',
  practitionerroles: 'practitioner_role',
  organization: 'organization',
  organizations: 'organization',
  operation: 'operation',
  messagetype: 'messageType',
  message_type: 'messageType'
};

function normalizeJsonKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => normalizeJsonKeys(item));
  }

  if (!isPlainRecord(value)) return value;

  const normalized: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const normalizedKey = normalizeAliasKey(key);
    const normalizedValue = normalizeJsonKeys(rawValue);
    if (!(normalizedKey in normalized) || normalized[normalizedKey] === undefined || normalized[normalizedKey] === null || normalized[normalizedKey] === '') {
      normalized[normalizedKey] = normalizedValue;
    }
  }
  return normalized;
}

function normalizeGlobalPayload(value: unknown): unknown {
  if (!isPlainRecord(value)) return value;
  const normalized = normalizeJsonKeys(value) as Record<string, unknown>;
  const remapped: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(normalized)) {
    const canonicalKey = GLOBAL_TOP_LEVEL_KEY_MAP[key] ?? key;
    remapped[canonicalKey] = rawValue;
  }
  return remapped;
}

function normalizeAliasValue(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number') return String(value);
  return undefined;
}

function splitNameParts(fullName: string) {
  const tokens = fullName.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {};
  if (tokens.length === 1) return { last: tokens[0] };
  return {
    first: tokens.slice(0, -1).join(' '),
    last: tokens[tokens.length - 1]
  };
}

function readSectionAliasValue(record: Record<string, unknown>, section: keyof typeof HEADER_ALIAS_SECTIONS, canonicalKey: string) {
  const lookup = SECTION_ALIAS_LOOKUPS[section];
  for (const [key, value] of Object.entries(record)) {
    const mapped = lookup.get(normalizeAliasKey(key));
    if (mapped === canonicalKey) return value;
  }
  return undefined;
}

function normalizeGlobalPatientAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const name = isPlainRecord(normalized.name) ? { ...normalized.name } : {};
  const contactInfo = isPlainRecord(normalized.contact_info) ? { ...normalized.contact_info } : {};
  const address = isPlainRecord(contactInfo.address) ? { ...contactInfo.address } : {};

  const patientId = readSectionAliasValue(value, 'patient', 'patient_id');
  if (normalized.patient_id === undefined && patientId !== undefined) {
    normalized.patient_id = patientId;
  }

  const firstRaw = readSectionAliasValue(value, 'patient', 'patient_first_name');
  const first = normalizeAliasValue(firstRaw);
  if (first && name.first_name === undefined) name.first_name = first;

  const middleRaw = readSectionAliasValue(value, 'patient', 'patient_middle_name');
  const middle = normalizeAliasValue(middleRaw);
  if (middle && name.middle_name === undefined) name.middle_name = middle;

  const lastRaw = readSectionAliasValue(value, 'patient', 'patient_last_name');
  const last = normalizeAliasValue(lastRaw);
  if (last && name.last_name === undefined) name.last_name = last;

  const fullNameRaw = readSectionAliasValue(value, 'patient', 'patient_name');
  if (typeof fullNameRaw === 'string' && fullNameRaw.trim()) {
    const parts = splitNameParts(fullNameRaw.trim());
    if (parts.first && name.first_name === undefined) name.first_name = parts.first;
    if (parts.last && name.last_name === undefined) name.last_name = parts.last;
  }

  const gender = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_gender'));
  if (gender && normalized.gender === undefined) normalized.gender = gender;

  const birthDate = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_birth_date'));
  if (birthDate && normalized.date_of_birth === undefined) normalized.date_of_birth = birthDate;

  const phone = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_phone'));
  if (phone && contactInfo.phone === undefined) contactInfo.phone = phone;

  const email = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_email'));
  if (email && contactInfo.email === undefined) contactInfo.email = email;

  const street1 = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_address_line1'));
  if (street1 && address.street === undefined) address.street = street1;

  const street2 = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_address_line2'));
  if (street2) {
    if (address.street === undefined) {
      address.street = street2;
    } else if (typeof address.street === 'string' && !address.street.includes(street2)) {
      address.street = `${address.street}, ${street2}`;
    }
  }

  const city = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_city'));
  if (city && address.city === undefined) address.city = city;

  const state = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_state'));
  if (state && address.state === undefined) address.state = state;

  const postal = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_postal_code'));
  if (postal && address.postal_code === undefined) address.postal_code = postal;

  const country = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_country'));
  if (country && address.country === undefined) address.country = country;

  if (Object.keys(name).length > 0) normalized.name = name;
  if (Object.keys(address).length > 0) {
    contactInfo.address = address;
  }
  if (Object.keys(contactInfo).length > 0) normalized.contact_info = contactInfo;

  return normalized;
}

function normalizeGlobalEncounterAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const location = isPlainRecord(normalized.location) ? { ...normalized.location } : {};

  const encounterId = readSectionAliasValue(value, 'encounter', 'encounter_id');
  if (normalized.encounter_id === undefined && encounterId !== undefined) {
    normalized.encounter_id = encounterId;
  }

  const classValue = normalizeAliasValue(readSectionAliasValue(value, 'encounter', 'encounter_class'));
  if (classValue && normalized.encounter_type === undefined) normalized.encounter_type = classValue;

  const start = normalizeAliasValue(readSectionAliasValue(value, 'encounter', 'encounter_start'));
  if (start && normalized.start_date === undefined) normalized.start_date = start;

  const status = normalizeAliasValue(readSectionAliasValue(value, 'encounter', 'encounter_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const practitionerId = normalizeAliasValue(readSectionAliasValue(value, 'encounter', 'encounter_practitioner_id'));
  if (practitionerId && normalized.practitioner_id === undefined) normalized.practitioner_id = practitionerId;

  const locationValue = normalizeAliasValue(readSectionAliasValue(value, 'encounter', 'encounter_location'));
  if (locationValue) {
    if (location.facility_name === undefined) {
      location.facility_name = locationValue;
    } else if (location.room === undefined) {
      location.room = locationValue;
    }
  }

  if (Object.keys(location).length > 0) normalized.location = location;
  return normalized;
}

function normalizeGlobalMedicationAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const medId = readSectionAliasValue(value, 'medication', 'medication_id');
  if (normalized.medication_id === undefined && medId !== undefined) {
    normalized.medication_id = medId;
  }

  const display = normalizeAliasValue(readSectionAliasValue(value, 'medication', 'medication_display'));
  if (display && normalized.name === undefined) normalized.name = display;

  return normalized;
}

function normalizeGlobalMedicationRequestAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const dosage = isPlainRecord(normalized.dosage_instruction) ? { ...normalized.dosage_instruction } : {};

  const requestId = readSectionAliasValue(value, 'medicationRequest', 'medication_request_id');
  if (normalized.medication_request_id === undefined && requestId !== undefined) {
    normalized.medication_request_id = requestId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'medicationRequest', 'medication_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const authoredOn = normalizeAliasValue(readSectionAliasValue(value, 'medicationRequest', 'medication_authored_on'));
  if (authoredOn && normalized.authored_on === undefined) normalized.authored_on = authoredOn;

  const dose = normalizeAliasValue(readSectionAliasValue(value, 'medicationRequest', 'medication_dose'));
  if (dose && dosage.dose === undefined) dosage.dose = dose;

  const doseUnit = normalizeAliasValue(readSectionAliasValue(value, 'medicationRequest', 'medication_dose_unit'));
  if (doseUnit && typeof dosage.dose === 'string' && !dosage.dose.includes(doseUnit)) {
    dosage.dose = `${dosage.dose} ${doseUnit}`;
  }

  const route = normalizeAliasValue(readSectionAliasValue(value, 'medicationRequest', 'medication_route'));
  const routeDisplay = normalizeAliasValue(readSectionAliasValue(value, 'medicationRequest', 'medication_route_display'));
  if (route && dosage.route === undefined) dosage.route = route;
  if (routeDisplay && dosage.route === undefined) dosage.route = routeDisplay;

  const sig = normalizeAliasValue(readSectionAliasValue(value, 'medicationRequest', 'medication_sig'));
  if (sig && normalized.note === undefined) normalized.note = sig;

  if (Object.keys(dosage).length > 0) normalized.dosage_instruction = dosage;

  return normalized;
}

function normalizeGlobalMedicationStatementAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const dosage = isPlainRecord(normalized.dosage) ? { ...normalized.dosage } : {};

  const statementId = readSectionAliasValue(value, 'medicationStatement', 'medication_statement_id');
  if (normalized.medication_statement_id === undefined && statementId !== undefined) {
    normalized.medication_statement_id = statementId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_subject_id'));
  if (subjectId && normalized.patient_id === undefined) normalized.patient_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const effectiveDate = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_effective_date'));
  if (effectiveDate && normalized.effective_date === undefined) normalized.effective_date = effectiveDate;

  const effectiveStart = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_effective_start'));
  if (effectiveStart && normalized.effective_start === undefined) normalized.effective_start = effectiveStart;

  const effectiveEnd = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_effective_end'));
  if (effectiveEnd && normalized.effective_end === undefined) normalized.effective_end = effectiveEnd;

  const dateAsserted = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_date_asserted'));
  if (dateAsserted && normalized.date_asserted === undefined) normalized.date_asserted = dateAsserted;

  const authorId = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_author'));
  if (authorId && normalized.author_id === undefined) normalized.author_id = authorId;

  const infoSource = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_information_source'));
  if (infoSource && normalized.information_source === undefined) normalized.information_source = infoSource;

  const reason = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_reason'));
  if (reason && normalized.reason === undefined) normalized.reason = reason;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const dose = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_dose'));
  if (dose && dosage.dose === undefined) dosage.dose = dose;

  const doseUnit = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_dose_unit'));
  if (doseUnit && typeof dosage.dose === 'string' && !dosage.dose.includes(doseUnit)) {
    dosage.dose = `${dosage.dose} ${doseUnit}`;
  }

  const route = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_route'));
  const routeDisplay = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_route_display'));
  if (route && dosage.route === undefined) dosage.route = route;
  if (routeDisplay && dosage.route === undefined) dosage.route = routeDisplay;

  const medCode = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_medication_code'));
  const medSystem = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_medication_code_system'));
  const medDisplay = normalizeAliasValue(readSectionAliasValue(value, 'medicationStatement', 'medication_statement_medication_display'));
  if ((medCode || medDisplay) && normalized.medication === undefined) {
    normalized.medication = {
      medication_id: medCode,
      code_system: medSystem,
      name: medDisplay,
      strength: undefined,
      form: undefined
    };
  }

  if (Object.keys(dosage).length > 0) normalized.dosage = dosage;

  return normalized;
}

function normalizeGlobalProcedureAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const code = isPlainRecord(normalized.code) ? { ...normalized.code } : {};

  const procedureId = readSectionAliasValue(value, 'procedure', 'procedure_id');
  if (normalized.procedure_id === undefined && procedureId !== undefined) {
    normalized.procedure_id = procedureId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const procCode = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_code'));
  if (procCode && code.code === undefined) code.code = procCode;

  const procSystem = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_code_system'));
  if (procSystem && code.code_system === undefined) code.code_system = procSystem;

  const procDisplay = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_display'));
  if (procDisplay && code.display === undefined) code.display = procDisplay;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_subject_id'));
  if (subjectId && normalized.patient_id === undefined) normalized.patient_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const occurrenceDate = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_occurrence_date'));
  if (occurrenceDate && normalized.occurrence_date === undefined) normalized.occurrence_date = occurrenceDate;

  const occurrenceStart = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_occurrence_start'));
  if (occurrenceStart && normalized.occurrence_start === undefined) normalized.occurrence_start = occurrenceStart;

  const occurrenceEnd = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_occurrence_end'));
  if (occurrenceEnd && normalized.occurrence_end === undefined) normalized.occurrence_end = occurrenceEnd;

  const recorded = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_recorded'));
  if (recorded && normalized.recorded === undefined) normalized.recorded = recorded;

  const performerId = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_performer_id'));
  if (performerId && normalized.performer_id === undefined) normalized.performer_id = performerId;

  const location = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_location'));
  if (location && normalized.location === undefined) normalized.location = location;

  const reason = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_reason'));
  if (reason && normalized.reason === undefined) normalized.reason = reason;

  const bodySite = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_body_site'));
  if (bodySite && normalized.body_site === undefined) normalized.body_site = bodySite;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'procedure', 'procedure_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  if (Object.keys(code).length > 0) normalized.code = code;

  return normalized;
}

function normalizeGlobalConditionAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const code = isPlainRecord(normalized.code) ? { ...normalized.code } : {};

  const conditionId = readSectionAliasValue(value, 'condition', 'condition_id');
  if (normalized.condition_id === undefined && conditionId !== undefined) {
    normalized.condition_id = conditionId;
  }

  const clinicalStatus = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_clinical_status'));
  if (clinicalStatus && normalized.clinical_status === undefined) normalized.clinical_status = clinicalStatus;

  const verificationStatus = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_verification_status'));
  if (verificationStatus && normalized.verification_status === undefined) normalized.verification_status = verificationStatus;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const severity = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_severity'));
  if (severity && normalized.severity === undefined) normalized.severity = severity;

  const condCode = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_code'));
  if (condCode && code.code === undefined) code.code = condCode;

  const condSystem = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_code_system'));
  if (condSystem && code.code_system === undefined) code.code_system = condSystem;

  const condDisplay = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_display'));
  if (condDisplay && code.display === undefined) code.display = condDisplay;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_subject_id'));
  if (subjectId && normalized.patient_id === undefined) normalized.patient_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const onsetDate = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_onset_date'));
  if (onsetDate && normalized.onset_date === undefined) normalized.onset_date = onsetDate;

  const onsetStart = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_onset_start'));
  if (onsetStart && normalized.onset_start === undefined) normalized.onset_start = onsetStart;

  const onsetEnd = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_onset_end'));
  if (onsetEnd && normalized.onset_end === undefined) normalized.onset_end = onsetEnd;

  const onsetText = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_onset_text'));
  if (onsetText && normalized.onset_text === undefined) normalized.onset_text = onsetText;

  const abatementDate = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_abatement_date'));
  if (abatementDate && normalized.abatement_date === undefined) normalized.abatement_date = abatementDate;

  const abatementStart = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_abatement_start'));
  if (abatementStart && normalized.abatement_start === undefined) normalized.abatement_start = abatementStart;

  const abatementEnd = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_abatement_end'));
  if (abatementEnd && normalized.abatement_end === undefined) normalized.abatement_end = abatementEnd;

  const abatementText = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_abatement_text'));
  if (abatementText && normalized.abatement_text === undefined) normalized.abatement_text = abatementText;

  const recordedDate = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_recorded_date'));
  if (recordedDate && normalized.recorded_date === undefined) normalized.recorded_date = recordedDate;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'condition', 'condition_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  if (Object.keys(code).length > 0) normalized.code = code;

  return normalized;
}

function normalizeGlobalAppointmentAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const appointmentId = readSectionAliasValue(value, 'appointment', 'appointment_id');
  if (normalized.appointment_id === undefined && appointmentId !== undefined) {
    normalized.appointment_id = appointmentId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'appointment', 'appointment_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const description = normalizeAliasValue(readSectionAliasValue(value, 'appointment', 'appointment_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const start = normalizeAliasValue(readSectionAliasValue(value, 'appointment', 'appointment_start'));
  if (start && normalized.start === undefined) normalized.start = start;

  const end = normalizeAliasValue(readSectionAliasValue(value, 'appointment', 'appointment_end'));
  if (end && normalized.end === undefined) normalized.end = end;

  const minutesDuration = normalizeAliasValue(readSectionAliasValue(value, 'appointment', 'appointment_minutes_duration'));
  if (minutesDuration && normalized.minutes_duration === undefined) normalized.minutes_duration = minutesDuration;

  const created = normalizeAliasValue(readSectionAliasValue(value, 'appointment', 'appointment_created'));
  if (created && normalized.created === undefined) normalized.created = created;

  const cancellationDate = normalizeAliasValue(readSectionAliasValue(value, 'appointment', 'appointment_cancellation_date'));
  if (cancellationDate && normalized.cancellation_date === undefined) normalized.cancellation_date = cancellationDate;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'appointment', 'appointment_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const participantId = normalizeAliasValue(readSectionAliasValue(value, 'appointment', 'appointment_participant_id'));
  if (participantId && normalized.participant_id === undefined) normalized.participant_id = participantId;

  const participantStatus = normalizeAliasValue(readSectionAliasValue(value, 'appointment', 'appointment_participant_status'));
  if (participantStatus && normalized.participant_status === undefined) normalized.participant_status = participantStatus;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'appointment', 'appointment_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  return normalized;
}

function normalizeGlobalScheduleAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const scheduleId = readSectionAliasValue(value, 'schedule', 'schedule_id');
  if (normalized.schedule_id === undefined && scheduleId !== undefined) {
    normalized.schedule_id = scheduleId;
  }

  const active = normalizeAliasValue(readSectionAliasValue(value, 'schedule', 'schedule_active'));
  if (active && normalized.active === undefined) normalized.active = active;

  const name = normalizeAliasValue(readSectionAliasValue(value, 'schedule', 'schedule_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const actorId = normalizeAliasValue(readSectionAliasValue(value, 'schedule', 'schedule_actor_id'));
  if (actorId && normalized.actor_id === undefined) normalized.actor_id = actorId;

  const start = normalizeAliasValue(readSectionAliasValue(value, 'schedule', 'schedule_start'));
  if (start && normalized.start === undefined) normalized.start = start;

  const end = normalizeAliasValue(readSectionAliasValue(value, 'schedule', 'schedule_end'));
  if (end && normalized.end === undefined) normalized.end = end;

  const comment = normalizeAliasValue(readSectionAliasValue(value, 'schedule', 'schedule_comment'));
  if (comment && normalized.comment === undefined) normalized.comment = comment;

  const serviceCategory = normalizeAliasValue(readSectionAliasValue(value, 'schedule', 'schedule_service_category'));
  if (serviceCategory && normalized.service_category === undefined) normalized.service_category = serviceCategory;

  const serviceType = normalizeAliasValue(readSectionAliasValue(value, 'schedule', 'schedule_service_type'));
  if (serviceType && normalized.service_type === undefined) normalized.service_type = serviceType;

  const specialty = normalizeAliasValue(readSectionAliasValue(value, 'schedule', 'schedule_specialty'));
  if (specialty && normalized.specialty === undefined) normalized.specialty = specialty;

  return normalized;
}

function normalizeGlobalSlotAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const slotId = readSectionAliasValue(value, 'slot', 'slot_id');
  if (normalized.slot_id === undefined && slotId !== undefined) {
    normalized.slot_id = slotId;
  }

  const scheduleId = readSectionAliasValue(value, 'slot', 'slot_schedule_id');
  if (normalized.schedule_id === undefined && scheduleId !== undefined) {
    normalized.schedule_id = scheduleId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'slot', 'slot_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const start = normalizeAliasValue(readSectionAliasValue(value, 'slot', 'slot_start'));
  if (start && normalized.start === undefined) normalized.start = start;

  const end = normalizeAliasValue(readSectionAliasValue(value, 'slot', 'slot_end'));
  if (end && normalized.end === undefined) normalized.end = end;

  const overbooked = normalizeAliasValue(readSectionAliasValue(value, 'slot', 'slot_overbooked'));
  if (overbooked && normalized.overbooked === undefined) normalized.overbooked = overbooked;

  const comment = normalizeAliasValue(readSectionAliasValue(value, 'slot', 'slot_comment'));
  if (comment && normalized.comment === undefined) normalized.comment = comment;

  const serviceCategory = normalizeAliasValue(readSectionAliasValue(value, 'slot', 'slot_service_category'));
  if (serviceCategory && normalized.service_category === undefined) normalized.service_category = serviceCategory;

  const serviceType = normalizeAliasValue(readSectionAliasValue(value, 'slot', 'slot_service_type'));
  if (serviceType && normalized.service_type === undefined) normalized.service_type = serviceType;

  const specialty = normalizeAliasValue(readSectionAliasValue(value, 'slot', 'slot_specialty'));
  if (specialty && normalized.specialty === undefined) normalized.specialty = specialty;

  const appointmentType = normalizeAliasValue(readSectionAliasValue(value, 'slot', 'slot_appointment_type'));
  if (appointmentType && normalized.appointment_type === undefined) normalized.appointment_type = appointmentType;

  return normalized;
}

function normalizeGlobalDiagnosticReportAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const code = isPlainRecord(normalized.code) ? { ...normalized.code } : {};

  const reportId = readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_id');
  if (normalized.diagnostic_report_id === undefined && reportId !== undefined) {
    normalized.diagnostic_report_id = reportId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const reportCode = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_code'));
  if (reportCode && code.code === undefined) code.code = reportCode;

  const reportSystem = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_code_system'));
  if (reportSystem && code.code_system === undefined) code.code_system = reportSystem;

  const reportDisplay = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_display'));
  if (reportDisplay && code.display === undefined) code.display = reportDisplay;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const effectiveDate = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_effective_date'));
  if (effectiveDate && normalized.effective_date === undefined) normalized.effective_date = effectiveDate;

  const effectiveStart = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_effective_start'));
  if (effectiveStart && normalized.effective_start === undefined) normalized.effective_start = effectiveStart;

  const effectiveEnd = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_effective_end'));
  if (effectiveEnd && normalized.effective_end === undefined) normalized.effective_end = effectiveEnd;

  const issued = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_issued'));
  if (issued && normalized.issued === undefined) normalized.issued = issued;

  const performerId = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_performer_id'));
  if (performerId && normalized.performer_id === undefined) normalized.performer_id = performerId;

  const resultIds = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_result_ids'));
  if (resultIds && normalized.result_ids === undefined) normalized.result_ids = resultIds;

  const conclusion = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_conclusion'));
  if (conclusion && normalized.conclusion === undefined) normalized.conclusion = conclusion;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'diagnosticReport', 'diagnostic_report_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  if (Object.keys(code).length > 0) normalized.code = code;

  return normalized;
}

function normalizeGlobalRelatedPersonAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const relatedPersonId = readSectionAliasValue(value, 'relatedPerson', 'related_person_id');
  if (normalized.related_person_id === undefined && relatedPersonId !== undefined) {
    normalized.related_person_id = relatedPersonId;
  }

  const active = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_active'));
  if (active && normalized.active === undefined) normalized.active = active;

  const patientId = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_patient_id'));
  if (patientId && normalized.patient_id === undefined) normalized.patient_id = patientId;

  const relationship = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_relationship'));
  if (relationship && normalized.relationship === undefined) normalized.relationship = relationship;

  const firstName = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_first_name'));
  if (firstName && normalized.first_name === undefined) normalized.first_name = firstName;

  const lastName = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_last_name'));
  if (lastName && normalized.last_name === undefined) normalized.last_name = lastName;

  const phone = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_phone'));
  if (phone && normalized.phone === undefined) normalized.phone = phone;

  const email = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_email'));
  if (email && normalized.email === undefined) normalized.email = email;

  const gender = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_gender'));
  if (gender && normalized.gender === undefined) normalized.gender = gender;

  const birthDate = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_birth_date'));
  if (birthDate && normalized.birth_date === undefined) normalized.birth_date = birthDate;

  const addressLine1 = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_address_line1'));
  if (addressLine1 && normalized.address_line1 === undefined) normalized.address_line1 = addressLine1;

  const addressLine2 = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_address_line2'));
  if (addressLine2 && normalized.address_line2 === undefined) normalized.address_line2 = addressLine2;

  const city = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_city'));
  if (city && normalized.city === undefined) normalized.city = city;

  const state = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_state'));
  if (state && normalized.state === undefined) normalized.state = state;

  const postalCode = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_postal_code'));
  if (postalCode && normalized.postal_code === undefined) normalized.postal_code = postalCode;

  const country = normalizeAliasValue(readSectionAliasValue(value, 'relatedPerson', 'related_person_country'));
  if (country && normalized.country === undefined) normalized.country = country;

  return normalized;
}

function normalizeGlobalLocationAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const locationId = readSectionAliasValue(value, 'location', 'location_id');
  if (normalized.location_id === undefined && locationId !== undefined) {
    normalized.location_id = locationId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const name = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const alias = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_alias'));
  if (alias && normalized.alias === undefined) normalized.alias = alias;

  const description = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const mode = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_mode'));
  if (mode && normalized.mode === undefined) normalized.mode = mode;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_type'));
  if (type && normalized.type === undefined) normalized.type = type;

  const addressLine1 = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_address_line1'));
  if (addressLine1 && normalized.address_line1 === undefined) normalized.address_line1 = addressLine1;

  const addressLine2 = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_address_line2'));
  if (addressLine2 && normalized.address_line2 === undefined) normalized.address_line2 = addressLine2;

  const city = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_city'));
  if (city && normalized.city === undefined) normalized.city = city;

  const state = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_state'));
  if (state && normalized.state === undefined) normalized.state = state;

  const postalCode = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_postal_code'));
  if (postalCode && normalized.postal_code === undefined) normalized.postal_code = postalCode;

  const country = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_country'));
  if (country && normalized.country === undefined) normalized.country = country;

  const managingOrgId = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_managing_org_id'));
  if (managingOrgId && normalized.managing_org_id === undefined) normalized.managing_org_id = managingOrgId;

  const partOfId = normalizeAliasValue(readSectionAliasValue(value, 'location', 'location_part_of_id'));
  if (partOfId && normalized.part_of_id === undefined) normalized.part_of_id = partOfId;

  return normalized;
}

function normalizeGlobalEpisodeOfCareAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const episodeId = readSectionAliasValue(value, 'episodeOfCare', 'episode_of_care_id');
  if (normalized.episode_of_care_id === undefined && episodeId !== undefined) {
    normalized.episode_of_care_id = episodeId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_type'));
  if (type && normalized.type === undefined) normalized.type = type;

  const reason = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_reason'));
  if (reason && normalized.reason === undefined) normalized.reason = reason;

  const diagnosis = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_diagnosis'));
  if (diagnosis && normalized.diagnosis === undefined) normalized.diagnosis = diagnosis;

  const patientId = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_patient_id'));
  if (patientId && normalized.patient_id === undefined) normalized.patient_id = patientId;

  const managingOrgId = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_managing_org_id'));
  if (managingOrgId && normalized.managing_org_id === undefined) normalized.managing_org_id = managingOrgId;

  const periodStart = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_period_start'));
  if (periodStart && normalized.period_start === undefined) normalized.period_start = periodStart;

  const periodEnd = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_period_end'));
  if (periodEnd && normalized.period_end === undefined) normalized.period_end = periodEnd;

  const referralIds = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_referral_request_ids'));
  if (referralIds && normalized.referral_request_ids === undefined) normalized.referral_request_ids = referralIds;

  const careManagerId = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_care_manager_id'));
  if (careManagerId && normalized.care_manager_id === undefined) normalized.care_manager_id = careManagerId;

  const careTeamIds = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_care_team_ids'));
  if (careTeamIds && normalized.care_team_ids === undefined) normalized.care_team_ids = careTeamIds;

  const accountIds = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_account_ids'));
  if (accountIds && normalized.account_ids === undefined) normalized.account_ids = accountIds;

  const statusHistoryStatus = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_status_history_status'));
  if (statusHistoryStatus && normalized.status_history_status === undefined) normalized.status_history_status = statusHistoryStatus;

  const statusHistoryStart = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_status_history_start'));
  if (statusHistoryStart && normalized.status_history_start === undefined) normalized.status_history_start = statusHistoryStart;

  const statusHistoryEnd = normalizeAliasValue(readSectionAliasValue(value, 'episodeOfCare', 'episode_status_history_end'));
  if (statusHistoryEnd && normalized.status_history_end === undefined) normalized.status_history_end = statusHistoryEnd;

  return normalized;
}

function normalizeGlobalPractitionerAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const name = isPlainRecord(normalized.name) ? { ...normalized.name } : {};
  const contactInfo = isPlainRecord(normalized.contact_info) ? { ...normalized.contact_info } : {};
  const address = isPlainRecord(contactInfo.address) ? { ...contactInfo.address } : {};

  const practitionerId = readSectionAliasValue(value, 'practitioner', 'practitioner_id');
  if (normalized.practitioner_id === undefined && practitionerId !== undefined) {
    normalized.practitioner_id = practitionerId;
  }

  const first = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_first_name'));
  if (first && name.first_name === undefined) name.first_name = first;

  const middle = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_middle_name'));
  if (middle && name.middle_name === undefined) name.middle_name = middle;

  const last = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_last_name'));
  if (last && name.last_name === undefined) name.last_name = last;

  const fullNameRaw = readSectionAliasValue(value, 'practitioner', 'practitioner_name');
  if (typeof fullNameRaw === 'string' && fullNameRaw.trim()) {
    const parts = splitNameParts(fullNameRaw.trim());
    if (parts.first && name.first_name === undefined) name.first_name = parts.first;
    if (parts.last && name.last_name === undefined) name.last_name = parts.last;
  }

  const gender = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_gender'));
  if (gender && normalized.gender === undefined) normalized.gender = gender;

  const birthDate = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_birth_date'));
  if (birthDate && normalized.date_of_birth === undefined) normalized.date_of_birth = birthDate;

  const phone = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_phone'));
  if (phone && contactInfo.phone === undefined) contactInfo.phone = phone;

  const email = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_email'));
  if (email && contactInfo.email === undefined) contactInfo.email = email;

  const street1 = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_address_line1'));
  if (street1 && address.street === undefined) address.street = street1;

  const street2 = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_address_line2'));
  if (street2) {
    if (address.street === undefined) {
      address.street = street2;
    } else if (typeof address.street === 'string' && !address.street.includes(street2)) {
      address.street = `${address.street}, ${street2}`;
    }
  }

  const city = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_city'));
  if (city && address.city === undefined) address.city = city;

  const state = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_state'));
  if (state && address.state === undefined) address.state = state;

  const postal = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_postal_code'));
  if (postal && address.postal_code === undefined) address.postal_code = postal;

  const country = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_country'));
  if (country && address.country === undefined) address.country = country;

  if (Object.keys(name).length > 0) normalized.name = name;
  if (Object.keys(address).length > 0) {
    contactInfo.address = address;
  }
  if (Object.keys(contactInfo).length > 0) normalized.contact_info = contactInfo;

  return normalized;
}

function normalizeGlobalPractitionerRoleAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const servicePeriod = isPlainRecord(normalized.service_period) ? { ...normalized.service_period } : {};

  const roleId = readSectionAliasValue(value, 'practitionerRole', 'practitioner_role_id');
  if (normalized.practitioner_role_id === undefined && roleId !== undefined) {
    normalized.practitioner_role_id = roleId;
  }

  const practitionerId = normalizeAliasValue(readSectionAliasValue(value, 'practitionerRole', 'practitioner_role_practitioner_id'));
  if (practitionerId && normalized.practitioner_id === undefined) normalized.practitioner_id = practitionerId;

  const orgId = normalizeAliasValue(readSectionAliasValue(value, 'practitionerRole', 'practitioner_role_organization_id'));
  if (orgId && normalized.organization_id === undefined) normalized.organization_id = orgId;

  const role = normalizeAliasValue(readSectionAliasValue(value, 'practitionerRole', 'practitioner_role_code'));
  if (role && normalized.role === undefined) normalized.role = role;

  const specialty = normalizeAliasValue(readSectionAliasValue(value, 'practitionerRole', 'practitioner_role_specialty'));
  if (specialty && normalized.specialty === undefined) normalized.specialty = specialty;

  const periodStart = normalizeAliasValue(readSectionAliasValue(value, 'practitionerRole', 'practitioner_role_period_start'));
  if (periodStart && servicePeriod.start_date === undefined) servicePeriod.start_date = periodStart;

  const periodEnd = normalizeAliasValue(readSectionAliasValue(value, 'practitionerRole', 'practitioner_role_period_end'));
  if (periodEnd && servicePeriod.end_date === undefined) servicePeriod.end_date = periodEnd;

  if (Object.keys(servicePeriod).length > 0) normalized.service_period = servicePeriod;

  return normalized;
}

function normalizeGlobalOrganizationAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const contactInfo = isPlainRecord(normalized.contact_info) ? { ...normalized.contact_info } : {};
  const address = isPlainRecord(contactInfo.address) ? { ...contactInfo.address } : {};

  const orgId = readSectionAliasValue(value, 'organization', 'organization_id');
  if (normalized.organization_id === undefined && orgId !== undefined) {
    normalized.organization_id = orgId;
  }

  const name = normalizeAliasValue(readSectionAliasValue(value, 'organization', 'organization_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'organization', 'organization_type_code'));
  if (type && normalized.type === undefined) normalized.type = type;

  const phone = normalizeAliasValue(readSectionAliasValue(value, 'organization', 'organization_phone'));
  if (phone && contactInfo.phone === undefined) contactInfo.phone = phone;

  const email = normalizeAliasValue(readSectionAliasValue(value, 'organization', 'organization_email'));
  if (email && contactInfo.email === undefined) contactInfo.email = email;

  const street1 = normalizeAliasValue(readSectionAliasValue(value, 'organization', 'organization_address_line1'));
  if (street1 && address.street === undefined) address.street = street1;

  const street2 = normalizeAliasValue(readSectionAliasValue(value, 'organization', 'organization_address_line2'));
  if (street2) {
    if (address.street === undefined) {
      address.street = street2;
    } else if (typeof address.street === 'string' && !address.street.includes(street2)) {
      address.street = `${address.street}, ${street2}`;
    }
  }

  const city = normalizeAliasValue(readSectionAliasValue(value, 'organization', 'organization_city'));
  if (city && address.city === undefined) address.city = city;

  const state = normalizeAliasValue(readSectionAliasValue(value, 'organization', 'organization_state'));
  if (state && address.state === undefined) address.state = state;

  const postal = normalizeAliasValue(readSectionAliasValue(value, 'organization', 'organization_postal_code'));
  if (postal && address.postal_code === undefined) address.postal_code = postal;

  const country = normalizeAliasValue(readSectionAliasValue(value, 'organization', 'organization_country'));
  if (country && address.country === undefined) address.country = country;

  if (Object.keys(address).length > 0) {
    contactInfo.address = address;
  }
  if (Object.keys(contactInfo).length > 0) normalized.contact_info = contactInfo;

  return normalized;
}

function normalizeGlobalSectionPayload(value: unknown, section: keyof typeof HEADER_ALIAS_SECTIONS): unknown {
  if (!value) return value;
  if (Array.isArray(value)) {
    return value.map(item => (isPlainRecord(item) ? normalizeGlobalSectionPayload(item, section) : item));
  }
  if (!isPlainRecord(value)) return value;

  switch (section) {
    case 'patient':
      return normalizeGlobalPatientAliases(value);
    case 'encounter':
      return normalizeGlobalEncounterAliases(value);
    case 'medication':
      return normalizeGlobalMedicationAliases(value);
    case 'medicationRequest':
      return normalizeGlobalMedicationRequestAliases(value);
    case 'medicationStatement':
      return normalizeGlobalMedicationStatementAliases(value);
    case 'procedure':
      return normalizeGlobalProcedureAliases(value);
    case 'condition':
      return normalizeGlobalConditionAliases(value);
    case 'appointment':
      return normalizeGlobalAppointmentAliases(value);
    case 'schedule':
      return normalizeGlobalScheduleAliases(value);
    case 'slot':
      return normalizeGlobalSlotAliases(value);
    case 'diagnosticReport':
      return normalizeGlobalDiagnosticReportAliases(value);
    case 'relatedPerson':
      return normalizeGlobalRelatedPersonAliases(value);
    case 'location':
      return normalizeGlobalLocationAliases(value);
    case 'episodeOfCare':
      return normalizeGlobalEpisodeOfCareAliases(value);
    case 'practitioner':
      return normalizeGlobalPractitionerAliases(value);
    case 'practitionerRole':
      return normalizeGlobalPractitionerRoleAliases(value);
    case 'organization':
      return normalizeGlobalOrganizationAliases(value);
    default:
      return value;
  }
}

function normalizeGlobalPayloadAliases(payload: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...payload };
  const mapping: Array<[keyof typeof HEADER_ALIAS_SECTIONS, string]> = [
    ['patient', 'patient'],
    ['encounter', 'encounter'],
    ['medication', 'medication'],
    ['medicationRequest', 'medication_request'],
    ['medicationStatement', 'medication_statement'],
    ['procedure', 'procedure'],
    ['condition', 'condition'],
    ['appointment', 'appointment'],
    ['schedule', 'schedule'],
    ['slot', 'slot'],
    ['diagnosticReport', 'diagnostic_report'],
    ['relatedPerson', 'related_person'],
    ['location', 'location'],
    ['practitioner', 'practitioner'],
    ['practitionerRole', 'practitioner_role'],
    ['organization', 'organization']
  ];

  for (const [section, key] of mapping) {
    if (key in normalized) {
      normalized[key] = normalizeGlobalSectionPayload(normalized[key], section);
    }
  }

  return normalized;
}

function coerceTabularRows(payload: unknown): TabularRow[] | null {
  if (Array.isArray(payload)) {
    const rows = payload.filter(isPlainRecord);
    if (!rows.length) return null;
    return rows.map(toTabularRow).filter(row => Object.keys(row).length > 0);
  }

  if (isPlainRecord(payload)) {
    if (Array.isArray(payload.rows)) {
      const rows = payload.rows.filter(isPlainRecord);
      if (!rows.length) return null;
      return rows.map(toTabularRow).filter(row => Object.keys(row).length > 0);
    }

    return [toTabularRow(payload)].filter(row => Object.keys(row).length > 0);
  }

  return null;
}

function toTabularRow(source: Record<string, unknown>): TabularRow {
  const row: TabularRow = {};
  for (const [key, value] of Object.entries(source)) {
    const normalized = normalizeHeader(String(key));
    if (!TABULAR_HEADER_SET.has(normalized)) continue;
    row[normalized] = value === undefined || value === null ? '' : String(value).trim();
  }
  return row;
}

function looksLikeTabularJson(payload: unknown): boolean {
  const rows = coerceTabularRows(payload);
  if (!rows || rows.length === 0) return false;
  return rows.some(row => Object.keys(row).length > 0);
}

function looksLikeStructuredAliasJson(payload: unknown): boolean {
  if (!isPlainRecord(payload)) return false;
  return Object.entries(payload).some(([key, value]) => {
    const aliasSection = STRUCTURED_SECTION_LOOKUP.get(normalizeAliasKey(key));
    if (!aliasSection) return false;
    const canonicalKeys = SECTION_CANONICAL_KEYS[aliasSection];
    if (!canonicalKeys) return false;
    if (Array.isArray(value)) {
      return value.some(item => isPlainRecord(item) && hasAliasKey(item, canonicalKeys));
    }
    if (isPlainRecord(value)) {
      return hasAliasKey(value, canonicalKeys);
    }
    return false;
  });
}

function getStructuredSectionValues(payload: Record<string, unknown>, section: keyof typeof HEADER_ALIAS_SECTIONS) {
  const matches: unknown[] = [];
  for (const [key, value] of Object.entries(payload)) {
    const mapped = STRUCTURED_SECTION_LOOKUP.get(normalizeAliasKey(key));
    if (mapped === section) matches.push(value);
  }
  return matches;
}

function getStructuredSectionValue(payload: Record<string, unknown>, section: keyof typeof HEADER_ALIAS_SECTIONS) {
  for (const [key, value] of Object.entries(payload)) {
    const mapped = STRUCTURED_SECTION_LOOKUP.get(normalizeAliasKey(key));
    if (mapped === section) return value;
  }
  return undefined;
}

function hasAliasKey(value: Record<string, unknown>, canonicalKeys: Set<string>): boolean {
  return Object.keys(value).some(key => canonicalKeys.has(normalizeHeader(key)));
}

function buildRowsFromStructuredAliasJson(payload: Record<string, unknown>): TabularRow[] {
  const baseRow: TabularRow = {};
  const rows: TabularRow[] = [];

  const patientRow = toSectionRow('patient', getStructuredSectionValue(payload, 'patient'));
  const encounterRow = toSectionRow('encounter', getStructuredSectionValue(payload, 'encounter'));
  Object.assign(baseRow, patientRow, encounterRow);

  const arraySections: Array<keyof typeof HEADER_ALIAS_SECTIONS> = [
    'observation',
    'medication',
    'medicationRequest',
    'medicationStatement',
    'procedure',
    'condition',
    'appointment',
    'schedule',
    'slot',
    'diagnosticReport',
    'relatedPerson',
    'location',
    'episodeOfCare',
    'documentReference',
    'practitioner',
    'practitionerRole',
    'organization'
  ];

  for (const aliasSection of arraySections) {
    const sectionValues = getStructuredSectionValues(payload, aliasSection);
    for (const sectionValue of sectionValues) {
      if (Array.isArray(sectionValue)) {
        for (const item of sectionValue) {
          if (!isPlainRecord(item)) continue;
          const sectionRow = toSectionRow(aliasSection, item);
          const merged = { ...baseRow, ...sectionRow };
          if (Object.keys(merged).length > 0) rows.push(merged);
        }
        continue;
      }
      if (!isPlainRecord(sectionValue)) continue;
      const sectionRow = toSectionRow(aliasSection, sectionValue);
      const merged = { ...baseRow, ...sectionRow };
      if (Object.keys(merged).length > 0) rows.push(merged);
    }
  }

  if (rows.length === 0 && Object.keys(baseRow).length > 0) {
    rows.push(baseRow);
  }

  return rows;
}

function toSectionRow(sectionKey: keyof typeof SECTION_CANONICAL_KEYS, value: unknown): TabularRow {
  if (!isPlainRecord(value)) return {};
  const canonicalKeys = SECTION_CANONICAL_KEYS[sectionKey];
  const row: TabularRow = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const normalized = normalizeHeader(String(key));
    if (!canonicalKeys.has(normalized)) continue;
    row[normalized] = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
  }
  return row;
}

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

  if (looksLikeTabularJson(parsed)) {
    const rows = coerceTabularRows(parsed) || [];
    if (rows.length > 0) return mapTabularRowsToCanonical(rows, 'JSON');
  }

  const normalizedGlobalCandidate = isPlainRecord(parsed) ? normalizeGlobalPayload(parsed) : parsed;
  const wrappedGlobal = wrapGlobalPayload(normalizedGlobalCandidate);
  if (wrappedGlobal) {
    try {
      const normalizedGlobal = isPlainRecord(wrappedGlobal)
        ? normalizeGlobalPayloadAliases(wrappedGlobal)
        : wrappedGlobal;
      const validatedGlobal = GlobalCustomJSONSchema.parse(normalizedGlobal);
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

  if (looksLikeStructuredAliasJson(parsed)) {
    const rows = buildRowsFromStructuredAliasJson(parsed);
    if (rows.length > 0) return mapTabularRowsToCanonical(rows, 'JSON');
  }

  throw new Error('JSON validation failed: payload must match the global custom JSON schema.');
}

function mapGender(gender?: string) {
  if (!gender) return undefined;
  const normalized = gender.toLowerCase();
  if (['m', 'male'].includes(normalized)) return 'male';
  if (['f', 'female'].includes(normalized)) return 'female';
  if (['o', 'other'].includes(normalized)) return 'other';
  return 'unknown';
}


function buildCanonicalFromGlobal(validated: GlobalJSONInput): CanonicalModel {
  const patients = normalizeArray(validated.patient);
  const encounters = normalizeArray(validated.encounter);
  const medications = normalizeArray(validated.medication);
  const medicationRequests = normalizeArray(validated.medication_request);
  const medicationStatements = normalizeArray(validated.medication_statement);
  const procedures = normalizeArray(validated.procedure);
  const conditions = normalizeArray(validated.condition);
  const appointments = normalizeArray(validated.appointment);
  const schedules = normalizeArray(validated.schedule);
  const slots = normalizeArray(validated.slot);
  const diagnosticReports = normalizeArray(validated.diagnostic_report);
  const relatedPersons = normalizeArray(validated.related_person);
  const locations = normalizeArray(validated.location);
  const episodesOfCare = normalizeArray(validated.episode_of_care);
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
  if (medicationStatements.length) {
    canonical.medicationStatements = medicationStatements.map(buildCanonicalMedicationStatementGlobal);
  }
  if (procedures.length) {
    canonical.procedures = procedures.map(buildCanonicalProcedureGlobal);
  }
  if (conditions.length) {
    canonical.conditions = conditions.map(buildCanonicalConditionGlobal);
  }
  if (appointments.length) {
    canonical.appointments = appointments.map(buildCanonicalAppointmentGlobal);
  }
  if (schedules.length) {
    canonical.schedules = schedules.map(buildCanonicalScheduleGlobal);
  }
  if (slots.length) {
    canonical.slots = slots.map(buildCanonicalSlotGlobal);
  }
  if (diagnosticReports.length) {
    canonical.diagnosticReports = diagnosticReports.map(buildCanonicalDiagnosticReportGlobal);
  }
  if (relatedPersons.length) {
    canonical.relatedPersons = relatedPersons.map(buildCanonicalRelatedPersonGlobal);
  }
  if (locations.length) {
    canonical.locations = locations.map(buildCanonicalLocationGlobal);
  }
  if (episodesOfCare.length) {
    canonical.episodesOfCare = episodesOfCare.map(buildCanonicalEpisodeOfCareGlobal);
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

function normalizeBoolean(value?: string | number | boolean): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 't', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'f', 'no', 'n', '0'].includes(normalized)) return false;
  }
  return undefined;
}

function normalizeStringArray(value?: string | string[]): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map(item => String(item).trim()).filter(Boolean);
}

function wrapGlobalPayload(value: any) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const hasGlobalKey = ['patient', 'encounter', 'medication', 'medication_request', 'medication_statement', 'procedure', 'condition', 'appointment', 'schedule', 'slot', 'diagnostic_report', 'related_person', 'location', 'episode_of_care', 'practitioner', 'practitioner_role', 'organization']
    .some(key => key in value);
  if (hasGlobalKey) {
    const candidates = [
      value.patient,
      value.encounter,
      value.medication,
      value.medication_request,
      value.medication_statement,
      value.procedure,
      value.condition,
      value.appointment,
      value.schedule,
      value.slot,
      value.diagnostic_report,
      value.related_person,
      value.location,
      value.episode_of_care,
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
    if ('medication_statement_id' in value || 'date_asserted' in value || 'effective_date' in value) {
      return { medication_statement: value };
    }
    if ('procedure_id' in value || 'occurrence_date' in value || 'code' in value) {
      return { procedure: value };
    }
    if ('condition_id' in value || 'clinical_status' in value || 'verification_status' in value) {
      return { condition: value };
    }
    if ('appointment_id' in value || 'start' in value || 'end' in value) {
      return { appointment: value };
    }
    if ('schedule_id' in value || 'service_category' in value || 'actor_id' in value) {
      return { schedule: value };
    }
    if ('slot_id' in value || 'schedule_id' in value || 'overbooked' in value) {
      return { slot: value };
    }
    if ('diagnostic_report_id' in value || 'effective_date' in value || 'issued' in value) {
      return { diagnostic_report: value };
    }
    if ('related_person_id' in value || 'relationship' in value || 'patient_id' in value) {
      return { related_person: value };
    }
    if ('location_id' in value || 'location_name' in value || 'address_line1' in value) {
      return { location: value };
    }
    if ('episode_of_care_id' in value || 'care_manager_id' in value || 'period_start' in value) {
      return { episode_of_care: value };
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
    'medication_statement_id' in value ||
    'date_asserted' in value ||
    'effective_date' in value ||
    'procedure_id' in value ||
    'occurrence_date' in value ||
    'occurrence_start' in value ||
    'condition_id' in value ||
    'clinical_status' in value ||
    'verification_status' in value ||
    'appointment_id' in value ||
    'start' in value ||
    'end' in value ||
    'schedule_id' in value ||
    'service_category' in value ||
    'actor_id' in value ||
    'slot_id' in value ||
    'overbooked' in value ||
    'diagnostic_report_id' in value ||
    'effective_date' in value ||
    'issued' in value ||
    'related_person_id' in value ||
    'relationship' in value ||
    'location_id' in value ||
    'location_name' in value ||
    'episode_of_care_id' in value ||
    'care_manager_id' in value ||
    'period_start' in value ||
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

function buildCanonicalMedicationStatementGlobal(statement: z.infer<typeof GlobalMedicationStatementSchema>) {
  const medTextParts = [statement.medication?.name, statement.medication?.strength].filter(Boolean).join(' ');
  const medCoding = statement.medication?.medication_id ? [{
    system: statement.medication?.code_system || 'urn:hl7-org:local',
    code: statement.medication.medication_id,
    display: statement.medication?.name
  }] : undefined;

  const doseQuantity = parseQuantity(statement.dosage?.dose);
  const dosageText = [
    statement.dosage?.dose,
    statement.dosage?.dose_unit,
    statement.dosage?.route,
    statement.dosage?.frequency,
    statement.dosage?.duration
  ].filter(Boolean).join(' ');

  const informationSource = normalizeStringArray(statement.information_source);
  const reasons = normalizeStringArray(statement.reason);

  return {
    id: statement.medication_statement_id,
    identifier: statement.medication_statement_id,
    status: statement.status,
    category: statement.category ? [{
      code: statement.category,
      display: statement.category
    }] : undefined,
    medicationCodeableConcept: medTextParts || medCoding ? {
      coding: medCoding,
      text: medTextParts || statement.medication?.name
    } : undefined,
    subject: statement.patient_id,
    encounter: statement.encounter_id,
    effectiveDateTime: statement.effective_date,
    effectivePeriod: statement.effective_start || statement.effective_end ? {
      start: statement.effective_start,
      end: statement.effective_end
    } : undefined,
    dateAsserted: statement.date_asserted,
    author: statement.author_id,
    informationSource: informationSource.length ? informationSource : undefined,
    reason: reasons.length ? reasons.map(reasonText => ({
      code: { display: reasonText }
    })) : undefined,
    note: statement.note ? [statement.note] : undefined,
    dosage: dosageText || doseQuantity ? [{
      text: dosageText || undefined,
      doseQuantity: doseQuantity || undefined,
      route: statement.dosage?.route ? { text: statement.dosage.route } : undefined
    }] : undefined
  };
}

function buildCanonicalProcedureGlobal(proc: z.infer<typeof GlobalProcedureSchema>) {
  const reasons = normalizeStringArray(proc.reason);
  const bodySites = normalizeStringArray(proc.body_site);

  return {
    id: proc.procedure_id,
    identifier: proc.procedure_id,
    status: proc.status,
    category: proc.category ? [{
      code: proc.category,
      display: proc.category
    }] : undefined,
    code: proc.code?.code || proc.code?.display ? {
      coding: proc.code?.code ? [{
        system: proc.code.code_system || 'urn:hl7-org:local',
        code: proc.code.code,
        display: proc.code.display
      }] : undefined,
      text: proc.code?.display
    } : undefined,
    subject: proc.patient_id,
    encounter: proc.encounter_id,
    occurrenceDateTime: proc.occurrence_date,
    occurrencePeriod: proc.occurrence_start || proc.occurrence_end ? {
      start: proc.occurrence_start,
      end: proc.occurrence_end
    } : undefined,
    recorded: proc.recorded,
    performer: proc.performer_id ? [{
      actor: proc.performer_id
    }] : undefined,
    location: proc.location,
    reason: reasons.length ? reasons.map(reasonText => ({
      code: { display: reasonText }
    })) : undefined,
    bodySite: bodySites.length ? bodySites.map(site => ({
      display: site
    })) : undefined,
    note: proc.note ? [proc.note] : undefined
  };
}

function buildCanonicalConditionGlobal(cond: z.infer<typeof GlobalConditionSchema>) {
  const bodySites = normalizeStringArray(cond.body_site);

  return {
    id: cond.condition_id,
    identifier: cond.condition_id,
    clinicalStatus: cond.clinical_status ? {
      code: cond.clinical_status,
      display: cond.clinical_status
    } : undefined,
    verificationStatus: cond.verification_status ? {
      code: cond.verification_status,
      display: cond.verification_status
    } : undefined,
    category: cond.category ? [{
      code: cond.category,
      display: cond.category
    }] : undefined,
    severity: cond.severity ? {
      code: cond.severity,
      display: cond.severity
    } : undefined,
    code: cond.code?.code || cond.code?.display ? {
      coding: cond.code?.code ? [{
        system: cond.code.code_system || 'urn:hl7-org:local',
        code: cond.code.code,
        display: cond.code.display
      }] : undefined,
      text: cond.code?.display
    } : undefined,
    bodySite: bodySites.length ? bodySites.map(site => ({
      display: site
    })) : undefined,
    subject: cond.patient_id,
    encounter: cond.encounter_id,
    onsetDateTime: cond.onset_date,
    onsetPeriod: cond.onset_start || cond.onset_end ? {
      start: cond.onset_start,
      end: cond.onset_end
    } : undefined,
    onsetString: cond.onset_text,
    abatementDateTime: cond.abatement_date,
    abatementPeriod: cond.abatement_start || cond.abatement_end ? {
      start: cond.abatement_start,
      end: cond.abatement_end
    } : undefined,
    abatementString: cond.abatement_text,
    recordedDate: cond.recorded_date,
    note: cond.note ? [cond.note] : undefined
  };
}

function buildCanonicalAppointmentGlobal(appt: z.infer<typeof GlobalAppointmentSchema>) {
  const minutes = typeof appt.minutes_duration === 'number'
    ? appt.minutes_duration
    : appt.minutes_duration ? Number(appt.minutes_duration) : undefined;

  return {
    id: appt.appointment_id,
    identifier: appt.appointment_id,
    status: appt.status,
    description: appt.description,
    start: appt.start,
    end: appt.end,
    minutesDuration: Number.isFinite(minutes as number) ? minutes : undefined,
    created: appt.created,
    cancellationDate: appt.cancellation_date,
    subject: appt.subject_id,
    participant: appt.participant_id ? [{
      actor: appt.participant_id,
      status: appt.participant_status
    }] : undefined,
    note: appt.note ? [appt.note] : undefined
  };
}

function buildCanonicalScheduleGlobal(schedule: z.infer<typeof GlobalScheduleSchema>) {
  const active = normalizeBoolean(schedule.active);
  const actorIds = normalizeStringArray(schedule.actor_id);

  return {
    id: schedule.schedule_id,
    identifier: schedule.schedule_id,
    active,
    name: schedule.name,
    actor: actorIds.length ? actorIds : undefined,
    planningHorizon: schedule.start || schedule.end ? {
      start: schedule.start,
      end: schedule.end
    } : undefined,
    comment: schedule.comment,
    serviceCategory: schedule.service_category ? [{
      code: schedule.service_category,
      display: schedule.service_category
    }] : undefined,
    serviceType: schedule.service_type ? [{
      code: schedule.service_type,
      display: schedule.service_type
    }] : undefined,
    specialty: schedule.specialty ? [{
      code: schedule.specialty,
      display: schedule.specialty
    }] : undefined
  };
}

function buildCanonicalSlotGlobal(slot: z.infer<typeof GlobalSlotSchema>) {
  const overbooked = normalizeBoolean(slot.overbooked);

  return {
    id: slot.slot_id,
    identifier: slot.slot_id,
    schedule: slot.schedule_id,
    status: slot.status,
    start: slot.start,
    end: slot.end,
    overbooked: overbooked,
    comment: slot.comment,
    serviceCategory: slot.service_category ? [{
      code: slot.service_category,
      display: slot.service_category
    }] : undefined,
    serviceType: slot.service_type ? [{
      code: slot.service_type,
      display: slot.service_type
    }] : undefined,
    specialty: slot.specialty ? [{
      code: slot.specialty,
      display: slot.specialty
    }] : undefined,
    appointmentType: slot.appointment_type ? [{
      code: slot.appointment_type,
      display: slot.appointment_type
    }] : undefined
  };
}

function buildCanonicalDiagnosticReportGlobal(report: z.infer<typeof GlobalDiagnosticReportSchema>) {
  const performerIds = normalizeStringArray(report.performer_id);
  const resultIds = normalizeStringArray(report.result_ids);

  return {
    id: report.diagnostic_report_id,
    identifier: report.diagnostic_report_id,
    status: report.status,
    category: report.category ? [{
      code: report.category,
      display: report.category
    }] : undefined,
    code: report.code?.code || report.code?.display ? {
      coding: report.code?.code ? [{
        system: report.code.code_system || 'urn:hl7-org:local',
        code: report.code.code,
        display: report.code.display
      }] : undefined,
      text: report.code?.display
    } : undefined,
    subject: report.subject_id,
    encounter: report.encounter_id,
    effectiveDateTime: report.effective_date,
    effectivePeriod: report.effective_start || report.effective_end ? {
      start: report.effective_start,
      end: report.effective_end
    } : undefined,
    issued: report.issued,
    performer: performerIds.length ? performerIds : undefined,
    result: resultIds.length ? resultIds : undefined,
    conclusion: report.conclusion,
    note: report.note ? [report.note] : undefined
  };
}

function buildCanonicalRelatedPersonGlobal(rp: z.infer<typeof GlobalRelatedPersonSchema>) {
  const active = normalizeBoolean(rp.active);

  const telecom = [];
  if (rp.phone) telecom.push({ system: 'phone', value: rp.phone });
  if (rp.email) telecom.push({ system: 'email', value: rp.email });

  const address = rp.address_line1 || rp.address_line2 || rp.city
    ? [{
        line: [rp.address_line1, rp.address_line2].filter(Boolean) as string[],
        city: rp.city,
        state: rp.state,
        postalCode: rp.postal_code,
        country: rp.country
      }]
    : undefined;

  return {
    id: rp.related_person_id,
    identifier: rp.related_person_id,
    active: active,
    patient: rp.patient_id,
    relationship: rp.relationship ? [{
      code: rp.relationship,
      display: rp.relationship
    }] : undefined,
    name: (rp.first_name || rp.last_name) ? [{
      family: rp.last_name,
      given: rp.first_name ? [rp.first_name] : undefined
    }] : undefined,
    telecom: telecom.length ? telecom : undefined,
    gender: rp.gender,
    birthDate: rp.birth_date,
    address
  };
}

function buildCanonicalLocationGlobal(location: z.infer<typeof GlobalLocationSchema>) {
  const alias = normalizeStringArray(location.alias);

  const address = location.address_line1 || location.address_line2 || location.city
    ? {
        line: [location.address_line1, location.address_line2].filter(Boolean) as string[],
        city: location.city,
        state: location.state,
        postalCode: location.postal_code,
        country: location.country
      }
    : undefined;

  return {
    id: location.location_id,
    identifier: location.location_id,
    status: location.status,
    name: location.name,
    alias: alias.length ? alias : undefined,
    description: location.description,
    mode: location.mode,
    type: location.type ? [{
      code: location.type,
      display: location.type
    }] : undefined,
    address,
    managingOrganization: location.managing_org_id,
    partOf: location.part_of_id
  };
}

function buildCanonicalEpisodeOfCareGlobal(episode: z.infer<typeof GlobalEpisodeOfCareSchema>) {
  const reasons = normalizeStringArray(episode.reason).map(value => ({
    code: {
      code: value,
      display: value
    }
  }));

  const diagnoses = normalizeStringArray(episode.diagnosis).map(value => ({
    condition: {
      code: value,
      display: value
    }
  }));

  const referralRequests = normalizeStringArray(episode.referral_request_ids);
  const careTeams = normalizeStringArray(episode.care_team_ids);
  const accounts = normalizeStringArray(episode.account_ids);

  const statusHistory = episode.status_history_status || episode.status_history_start || episode.status_history_end
    ? [{
      status: episode.status_history_status,
      period: episode.status_history_start || episode.status_history_end
        ? {
          start: episode.status_history_start,
          end: episode.status_history_end
        }
        : undefined
    }]
    : undefined;

  return {
    id: episode.episode_of_care_id,
    identifier: episode.episode_of_care_id,
    status: episode.status,
    statusHistory,
    type: episode.type ? [{
      code: episode.type,
      display: episode.type
    }] : undefined,
    reason: reasons.length ? reasons : undefined,
    diagnosis: diagnoses.length ? diagnoses : undefined,
    patient: episode.patient_id,
    managingOrganization: episode.managing_org_id,
    period: episode.period_start || episode.period_end ? {
      start: episode.period_start,
      end: episode.period_end
    } : undefined,
    referralRequest: referralRequests.length ? referralRequests : undefined,
    careManager: episode.care_manager_id,
    careTeam: careTeams.length ? careTeams : undefined,
    account: accounts.length ? accounts : undefined
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

type TelecomSystem = 'phone' | 'email' | 'fax' | 'url' | 'other';

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
