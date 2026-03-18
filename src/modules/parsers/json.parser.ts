import type { CanonicalComposition, CanonicalModel, CanonicalObservation } from '../../shared/types/canonical.types.js';
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
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
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
  resource_type: z.string().optional(),
  ihi: GlobalIdSchema.optional(),
  name: GlobalPatientNameSchema.optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  country_code: z.string().optional(),
  patient_type: z.string().optional(),
  photo: z.union([
    z.string(),
    z.object({
      content_type: z.string().optional(),
      url: z.string().optional(),
      title: z.string().optional(),
      data: z.string().optional()
    })
  ]).optional(),
  age: z.preprocess((value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') return Number(value);
    return value;
  }, z.number()).optional(),
  weight: z.preprocess((value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') return Number(value);
    return value;
  }, z.number()).optional(),
  weight_unit: z.string().optional(),
  height: z.preprocess((value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') return Number(value);
    return value;
  }, z.number()).optional(),
  height_taken: z.boolean().optional(),
  height_unit: z.string().optional(),
  blood_group: z.string().optional(),
  contact_info: z.object({
    phone: z.string().optional(),
    email: z.string().optional(),
    address: GlobalAddressSchema
  }).optional(),
  marital_status: z.string().optional(),
  deceased_boolean: z.union([z.boolean(), z.string(), z.number()]).optional(),
  is_pregnant: z.boolean().optional(),
  is_diabetic: z.boolean().optional(),
  is_hypertension: z.boolean().optional(),
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
  organization_id: GlobalIdSchema.optional(),
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

const GlobalMedicationAdministrationSchema = z.object({
  medication_administration_id: GlobalIdSchema.optional(),
  patient_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  status_reason: z.union([z.string(), z.array(z.string())]).optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  medication: z.object({
    medication_id: GlobalIdSchema.optional(),
    code_system: z.string().optional(),
    name: z.string().optional()
  }).optional(),
  supporting_info_ids: z.union([z.string(), z.array(z.string())]).optional(),
  occurrence_date: z.string().optional(),
  occurrence_start: z.string().optional(),
  occurrence_end: z.string().optional(),
  recorded: z.string().optional(),
  is_sub_potent: z.boolean().optional(),
  sub_potent_reason: z.union([z.string(), z.array(z.string())]).optional(),
  performer_actor_id: GlobalIdSchema.optional(),
  performer_function: z.string().optional(),
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  request_id: GlobalIdSchema.optional(),
  device_ids: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  part_of_ids: z.union([z.string(), z.array(z.string())]).optional(),
  dose_value: GlobalNumberSchema.optional(),
  dose_unit: z.string().optional(),
  route: z.string().optional(),
  site: z.string().optional(),
  method: z.string().optional(),
  rate_value: GlobalNumberSchema.optional(),
  rate_unit: z.string().optional()
});

const GlobalMedicationDispenseSchema = z.object({
  medication_dispense_id: GlobalIdSchema.optional(),
  patient_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  status_changed: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  medication: z.object({
    medication_id: GlobalIdSchema.optional(),
    code_system: z.string().optional(),
    name: z.string().optional()
  }).optional(),
  supporting_info_ids: z.union([z.string(), z.array(z.string())]).optional(),
  performer_actor_id: GlobalIdSchema.optional(),
  performer_function: z.string().optional(),
  location: z.string().optional(),
  authorizing_prescription_ids: z.union([z.string(), z.array(z.string())]).optional(),
  type: z.string().optional(),
  quantity_value: GlobalNumberSchema.optional(),
  quantity_unit: z.string().optional(),
  days_supply_value: GlobalNumberSchema.optional(),
  days_supply_unit: z.string().optional(),
  recorded: z.string().optional(),
  when_prepared: z.string().optional(),
  when_handed_over: z.string().optional(),
  destination: z.string().optional(),
  receiver_ids: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  rendered_dosage_instruction: z.string().optional(),
  dosage_instruction: z.union([z.string(), z.array(z.string())]).optional(),
  substitution_was_substituted: z.union([z.boolean(), z.string()]).optional(),
  substitution_type: z.string().optional(),
  substitution_reason: z.union([z.string(), z.array(z.string())]).optional(),
  substitution_responsible_party: z.string().optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  part_of_ids: z.union([z.string(), z.array(z.string())]).optional(),
  event_history_ids: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalOrganizationAffiliationSchema = z.object({
  organization_affiliation_id: GlobalIdSchema.optional(),
  active: z.union([z.boolean(), z.string()]).optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  organization_id: GlobalIdSchema.optional(),
  participating_organization_id: GlobalIdSchema.optional(),
  network_ids: z.union([z.string(), z.array(z.string())]).optional(),
  code: z.union([z.string(), z.array(z.string())]).optional(),
  specialty: z.union([z.string(), z.array(z.string())]).optional(),
  location_ids: z.union([z.string(), z.array(z.string())]).optional(),
  healthcare_service_ids: z.union([z.string(), z.array(z.string())]).optional(),
  contact_name: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_email: z.string().optional(),
  endpoint_ids: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalCapabilityStatementSchema = z.object({
  capability_statement_id: GlobalIdSchema.optional(),
  url: z.string().optional(),
  identifier: z.union([z.string(), z.array(z.string())]).optional(),
  version: z.string().optional(),
  version_algorithm: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
  experimental: z.boolean().optional(),
  date: z.string().optional(),
  publisher: z.string().optional(),
  description: z.string().optional(),
  kind: z.string().optional(),
  fhir_version: z.string().optional(),
  format: z.union([z.string(), z.array(z.string())]).optional(),
  implementation_url: z.string().optional(),
  implementation_description: z.string().optional(),
  software_name: z.string().optional(),
  software_version: z.string().optional(),
  software_release_date: z.string().optional(),
  rest_mode: z.string().optional(),
  rest_documentation: z.string().optional()
});

const GlobalOperationOutcomeSchema = z.object({
  operation_outcome_id: GlobalIdSchema.optional(),
  severity: z.string().optional(),
  code: z.string().optional(),
  details_system: z.string().optional(),
  details_code: z.string().optional(),
  details_display: z.string().optional(),
  diagnostics: z.string().optional(),
  location: z.union([z.string(), z.array(z.string())]).optional(),
  expression: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalParametersSchema = z.object({
  parameter_name: z.string().optional(),
  parameter_value: z.string().optional(),
  value_string: z.string().optional(),
  value_code: z.string().optional(),
  value_boolean: z.boolean().optional(),
  value_date: z.string().optional(),
  value_datetime: z.string().optional(),
  value_integer: GlobalNumberSchema.optional(),
  value_decimal: GlobalNumberSchema.optional(),
  value_uri: z.string().optional(),
  value_reference: z.string().optional()
});

const GlobalCarePlanSchema = z.object({
  care_plan_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  intent: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  subject_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  created: z.string().optional(),
  custodian_id: GlobalIdSchema.optional(),
  contributor_ids: z.union([z.string(), z.array(z.string())]).optional(),
  care_team_ids: z.union([z.string(), z.array(z.string())]).optional(),
  addresses: z.union([z.string(), z.array(z.string())]).optional(),
  supporting_info_ids: z.union([z.string(), z.array(z.string())]).optional(),
  goal_ids: z.union([z.string(), z.array(z.string())]).optional(),
  activity_reference: z.string().optional(),
  activity_progress: z.union([z.string(), z.array(z.string())]).optional(),
  activity_performed: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  instantiates_canonical: z.union([z.string(), z.array(z.string())]).optional(),
  instantiates_uri: z.union([z.string(), z.array(z.string())]).optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  replaces_ids: z.union([z.string(), z.array(z.string())]).optional(),
  part_of_ids: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalCareTeamSchema = z.object({
  care_team_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  name: z.string().optional(),
  subject_id: GlobalIdSchema.optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  participant_role: z.string().optional(),
  participant_member_id: GlobalIdSchema.optional(),
  participant_on_behalf_of_id: GlobalIdSchema.optional(),
  participant_coverage_start: z.string().optional(),
  participant_coverage_end: z.string().optional(),
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  managing_org_ids: z.union([z.string(), z.array(z.string())]).optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  note: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalGoalSchema = z.object({
  goal_id: GlobalIdSchema.optional(),
  lifecycle_status: z.string().optional(),
  achievement_status: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  continuous: z.union([z.boolean(), z.string(), z.number()]).optional(),
  priority: z.string().optional(),
  description: z.string().optional(),
  subject_id: GlobalIdSchema.optional(),
  start_date: z.string().optional(),
  start_code: z.string().optional(),
  target_measure: z.string().optional(),
  target_detail: z.string().optional(),
  target_due_date: z.string().optional(),
  status_date: z.string().optional(),
  status_reason: z.string().optional(),
  source_id: GlobalIdSchema.optional(),
  addresses: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  outcome: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalServiceRequestSchema = z.object({
  service_request_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  intent: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.string().optional(),
  do_not_perform: z.union([z.boolean(), z.string(), z.number()]).optional(),
  code: z.object({
    code: z.string().optional(),
    code_system: z.string().optional(),
    display: z.string().optional()
  }).optional(),
  subject_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  occurrence_date: z.string().optional(),
  occurrence_start: z.string().optional(),
  occurrence_end: z.string().optional(),
  as_needed: z.union([z.boolean(), z.string(), z.number()]).optional(),
  authored_on: z.string().optional(),
  requester_id: GlobalIdSchema.optional(),
  performer_type: z.string().optional(),
  performer_ids: z.union([z.string(), z.array(z.string())]).optional(),
  location_ids: z.union([z.string(), z.array(z.string())]).optional(),
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  supporting_info_ids: z.union([z.string(), z.array(z.string())]).optional(),
  specimen_ids: z.union([z.string(), z.array(z.string())]).optional(),
  body_site: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  patient_instruction: z.union([z.string(), z.array(z.string())]).optional(),
  instantiates_canonical: z.union([z.string(), z.array(z.string())]).optional(),
  instantiates_uri: z.union([z.string(), z.array(z.string())]).optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  replaces_ids: z.union([z.string(), z.array(z.string())]).optional(),
  requisition: z.string().optional()
});

const GlobalTaskSchema = z.object({
  task_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  status_reason: z.string().optional(),
  business_status: z.string().optional(),
  intent: z.string().optional(),
  priority: z.string().optional(),
  do_not_perform: z.union([z.boolean(), z.string(), z.number()]).optional(),
  code: z.object({
    code: z.string().optional(),
    code_system: z.string().optional(),
    display: z.string().optional()
  }).optional(),
  description: z.string().optional(),
  focus_id: GlobalIdSchema.optional(),
  for_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  requested_start: z.string().optional(),
  requested_end: z.string().optional(),
  execution_start: z.string().optional(),
  execution_end: z.string().optional(),
  authored_on: z.string().optional(),
  last_modified: z.string().optional(),
  requester_id: GlobalIdSchema.optional(),
  requested_performer_ids: z.union([z.string(), z.array(z.string())]).optional(),
  owner_id: GlobalIdSchema.optional(),
  performer_id: GlobalIdSchema.optional(),
  performer_function: z.string().optional(),
  location: z.string().optional(),
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  insurance_ids: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  relevant_history_ids: z.union([z.string(), z.array(z.string())]).optional(),
  instantiates_canonical: z.string().optional(),
  instantiates_uri: z.string().optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  part_of_ids: z.union([z.string(), z.array(z.string())]).optional(),
  group_identifier: z.string().optional()
});

const GlobalCommunicationSchema = z.object({
  communication_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  status_reason: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.string().optional(),
  medium: z.union([z.string(), z.array(z.string())]).optional(),
  subject_id: GlobalIdSchema.optional(),
  topic: z.string().optional(),
  about_ids: z.union([z.string(), z.array(z.string())]).optional(),
  encounter_id: GlobalIdSchema.optional(),
  sent: z.string().optional(),
  received: z.string().optional(),
  recipient_ids: z.union([z.string(), z.array(z.string())]).optional(),
  sender_id: GlobalIdSchema.optional(),
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  payload: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  instantiates_canonical: z.union([z.string(), z.array(z.string())]).optional(),
  instantiates_uri: z.union([z.string(), z.array(z.string())]).optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  part_of_ids: z.union([z.string(), z.array(z.string())]).optional(),
  in_response_to_ids: z.union([z.string(), z.array(z.string())]).optional(),
  status_reason_code: z.string().optional(),
  status_reason_system: z.string().optional(),
  status_reason_display: z.string().optional(),
  topic_code: z.string().optional(),
  topic_system: z.string().optional(),
  topic_display: z.string().optional()
});

const GlobalCommunicationRequestSchema = z.object({
  communication_request_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  status_reason: z.string().optional(),
  intent: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  priority: z.string().optional(),
  do_not_perform: z.union([z.boolean(), z.string(), z.number()]).optional(),
  medium: z.union([z.string(), z.array(z.string())]).optional(),
  subject_id: GlobalIdSchema.optional(),
  about_ids: z.union([z.string(), z.array(z.string())]).optional(),
  encounter_id: GlobalIdSchema.optional(),
  payload: z.union([z.string(), z.array(z.string())]).optional(),
  occurrence_date: z.string().optional(),
  occurrence_start: z.string().optional(),
  occurrence_end: z.string().optional(),
  authored_on: z.string().optional(),
  requester_id: GlobalIdSchema.optional(),
  recipient_ids: z.union([z.string(), z.array(z.string())]).optional(),
  information_provider_ids: z.union([z.string(), z.array(z.string())]).optional(),
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  replaces_ids: z.union([z.string(), z.array(z.string())]).optional(),
  group_identifier: z.string().optional(),
  status_reason_code: z.string().optional(),
  status_reason_system: z.string().optional(),
  status_reason_display: z.string().optional()
});

const GlobalQuestionnaireItemSchema = z.object({
  link_id: z.string().optional(),
  text: z.string().optional(),
  type: z.string().optional()
});

const GlobalQuestionnaireSchema = z.object({
  questionnaire_id: GlobalIdSchema.optional(),
  url: z.string().optional(),
  identifier: z.string().optional(),
  version: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
  date: z.string().optional(),
  publisher: z.string().optional(),
  description: z.string().optional(),
  subject_type: z.union([z.string(), z.array(z.string())]).optional(),
  item: z.union([GlobalQuestionnaireItemSchema, z.array(GlobalQuestionnaireItemSchema)]).optional(),
  item_link_id: z.string().optional(),
  item_text: z.string().optional(),
  item_type: z.string().optional()
});

const GlobalQuestionnaireResponseItemSchema = z.object({
  link_id: z.string().optional(),
  text: z.string().optional(),
  answer: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalQuestionnaireResponseSchema = z.object({
  questionnaire_response_id: GlobalIdSchema.optional(),
  questionnaire: z.string().optional(),
  status: z.string().optional(),
  subject_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  authored: z.string().optional(),
  author_id: GlobalIdSchema.optional(),
  source_id: GlobalIdSchema.optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  part_of_ids: z.union([z.string(), z.array(z.string())]).optional(),
  item: z.union([GlobalQuestionnaireResponseItemSchema, z.array(GlobalQuestionnaireResponseItemSchema)]).optional(),
  item_link_id: z.string().optional(),
  item_text: z.string().optional(),
  item_answer: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalCodeSystemConceptSchema = z.object({
  code: z.string().optional(),
  display: z.string().optional(),
  definition: z.string().optional()
});

const GlobalCodeSystemSchema = z.object({
  code_system_id: GlobalIdSchema.optional(),
  url: z.string().optional(),
  identifier: z.string().optional(),
  version: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
  date: z.string().optional(),
  publisher: z.string().optional(),
  description: z.string().optional(),
  content: z.string().optional(),
  case_sensitive: z.union([z.boolean(), z.string()]).optional(),
  concept: z.union([GlobalCodeSystemConceptSchema, z.array(GlobalCodeSystemConceptSchema)]).optional(),
  concept_code: z.string().optional(),
  concept_display: z.string().optional(),
  concept_definition: z.string().optional()
});

const GlobalValueSetSchema = z.object({
  value_set_id: GlobalIdSchema.optional(),
  url: z.string().optional(),
  identifier: z.string().optional(),
  version: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
  date: z.string().optional(),
  publisher: z.string().optional(),
  description: z.string().optional(),
  include_system: z.string().optional(),
  include_code: z.string().optional(),
  include_display: z.string().optional(),
  expansion_system: z.string().optional(),
  expansion_code: z.string().optional(),
  expansion_display: z.string().optional()
});

const GlobalConceptMapSchema = z.object({
  concept_map_id: GlobalIdSchema.optional(),
  url: z.string().optional(),
  identifier: z.string().optional(),
  version: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
  date: z.string().optional(),
  publisher: z.string().optional(),
  description: z.string().optional(),
  source_scope: z.string().optional(),
  target_scope: z.string().optional(),
  group_source: z.string().optional(),
  group_target: z.string().optional(),
  element_code: z.string().optional(),
  element_display: z.string().optional(),
  target_code: z.string().optional(),
  target_display: z.string().optional(),
  target_relationship: z.string().optional()
});

const GlobalNamingSystemSchema = z.object({
  naming_system_id: GlobalIdSchema.optional(),
  url: z.string().optional(),
  identifier: z.string().optional(),
  version: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
  kind: z.string().optional(),
  date: z.string().optional(),
  publisher: z.string().optional(),
  responsible: z.string().optional(),
  description: z.string().optional(),
  usage: z.string().optional(),
  unique_id_type: z.string().optional(),
  unique_id_value: z.string().optional(),
  unique_id_preferred: z.union([z.boolean(), z.string()]).optional()
});

const GlobalTerminologyCapabilitiesSchema = z.object({
  terminology_capabilities_id: GlobalIdSchema.optional(),
  url: z.string().optional(),
  identifier: z.string().optional(),
  version: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  status: z.string().optional(),
  date: z.string().optional(),
  publisher: z.string().optional(),
  description: z.string().optional(),
  kind: z.string().optional(),
  code_search: z.string().optional()
});

const GlobalProvenanceSchema = z.object({
  provenance_id: GlobalIdSchema.optional(),
  target_ids: z.union([z.string(), z.array(z.string())]).optional(),
  recorded: z.string().optional(),
  activity: z.string().optional(),
  agent_who: z.string().optional(),
  agent_role: z.string().optional()
});

const GlobalAuditEventSchema = z.object({
  audit_event_id: GlobalIdSchema.optional(),
  category: z.string().optional(),
  code: z.string().optional(),
  action: z.string().optional(),
  severity: z.string().optional(),
  recorded: z.string().optional(),
  agent_who: z.string().optional(),
  agent_role: z.string().optional(),
  agent_requestor: z.union([z.boolean(), z.string()]).optional()
});

const GlobalConsentSchema = z.object({
  consent_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  category: z.string().optional(),
  subject_id: GlobalIdSchema.optional(),
  date: z.string().optional(),
  decision: z.string().optional(),
  grantor_ids: z.union([z.string(), z.array(z.string())]).optional(),
  grantee_ids: z.union([z.string(), z.array(z.string())]).optional()
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

const GlobalAppointmentResponseSchema = z.object({
  appointment_response_id: GlobalIdSchema.optional(),
  appointment_id: GlobalIdSchema.optional(),
  proposed_new_time: z.union([z.boolean(), z.string(), z.number()]).optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  participant_type: z.union([z.string(), z.array(z.string())]).optional(),
  actor_id: GlobalIdSchema.optional(),
  participant_status: z.string().optional(),
  comment: z.string().optional(),
  recurring: z.union([z.boolean(), z.string(), z.number()]).optional(),
  occurrence_date: z.string().optional(),
  recurrence_id: GlobalNumberSchema.optional()
});

const GlobalCodeableConceptSchema = z.object({
  code: z.string().optional(),
  code_system: z.string().optional(),
  display: z.string().optional()
});

const GlobalIdentifierObjectSchema = z.object({
  system: z.string().optional(),
  value: GlobalStringSchema.optional(),
  type: GlobalCodeableConceptSchema.optional()
});

const GlobalContactPointSchema = z.object({
  system: z.string().optional(),
  value: GlobalStringSchema.optional(),
  use: z.string().optional()
});

const GlobalMoneySchema = z.object({
  value: z.union([z.number(), GlobalStringSchema]).optional(),
  currency: z.string().optional()
});

const GlobalQuantitySchema = z.object({
  value: z.union([z.number(), GlobalStringSchema]).optional(),
  unit: z.string().optional(),
  system: z.string().optional(),
  code: z.string().optional()
});

const GlobalDeviceDispenseSchema = z.object({
  device_dispense_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  part_of_ids: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.string().optional(),
  status_reason_code: z.string().optional(),
  status_reason_reference_id: GlobalIdSchema.optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  device_code: z.string().optional(),
  device_reference_id: GlobalIdSchema.optional(),
  subject_id: GlobalIdSchema.optional(),
  receiver_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  supporting_information_ids: z.union([z.string(), z.array(z.string())]).optional(),
  performer_function: z.string().optional(),
  performer_actor_id: GlobalIdSchema.optional(),
  location_id: GlobalIdSchema.optional(),
  type: z.string().optional(),
  quantity_value: GlobalNumberSchema.optional(),
  quantity_unit: z.string().optional(),
  prepared_date: z.string().optional(),
  when_handed_over: z.string().optional(),
  destination_id: GlobalIdSchema.optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  usage_instruction: z.string().optional(),
  event_history_ids: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalDeviceRequestParameterSchema = z.object({
  code: GlobalCodeableConceptSchema.optional(),
  value_codeable_concept: GlobalCodeableConceptSchema.optional(),
  value_quantity: GlobalQuantitySchema.optional(),
  value_boolean: z.union([z.boolean(), z.string(), z.number()]).optional()
});

const GlobalDeviceRequestSchema = z.object({
  device_request_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  instantiates_canonical: z.union([z.string(), z.array(z.string())]).optional(),
  instantiates_uri: z.union([z.string(), z.array(z.string())]).optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  replaces_ids: z.union([z.string(), z.array(z.string())]).optional(),
  group_identifier: GlobalIdentifierObjectSchema.optional(),
  status: z.string().optional(),
  intent: z.string().optional(),
  priority: z.string().optional(),
  do_not_perform: z.union([z.boolean(), z.string(), z.number()]).optional(),
  device_code: z.string().optional(),
  device_reference_id: GlobalIdSchema.optional(),
  quantity_value: GlobalNumberSchema.optional(),
  parameter: z.union([GlobalDeviceRequestParameterSchema, z.array(GlobalDeviceRequestParameterSchema)]).optional(),
  subject_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  occurrence_date_time: z.string().optional(),
  occurrence_start: z.string().optional(),
  occurrence_end: z.string().optional(),
  occurrence_timing: z.string().optional(),
  authored_on: z.string().optional(),
  requester_id: GlobalIdSchema.optional(),
  performer_id: GlobalIdSchema.optional(),
  reason_ids: z.union([z.string(), z.array(z.string())]).optional(),
  as_needed: z.union([z.boolean(), z.string(), z.number()]).optional(),
  as_needed_for: z.string().optional(),
  insurance_ids: z.union([z.string(), z.array(z.string())]).optional(),
  supporting_info_ids: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  relevant_history_ids: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalDeviceUsageSchema = z.object({
  device_usage_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  patient_id: GlobalIdSchema.optional(),
  derived_from_ids: z.union([z.string(), z.array(z.string())]).optional(),
  context_id: GlobalIdSchema.optional(),
  timing_timing: z.string().optional(),
  timing_start: z.string().optional(),
  timing_end: z.string().optional(),
  timing_date_time: z.string().optional(),
  date_asserted: z.string().optional(),
  usage_status: z.string().optional(),
  usage_reason: z.union([z.string(), z.array(z.string())]).optional(),
  adherence_code: z.string().optional(),
  adherence_reason: z.union([z.string(), z.array(z.string())]).optional(),
  information_source_id: GlobalIdSchema.optional(),
  device_code: z.string().optional(),
  device_reference_id: GlobalIdSchema.optional(),
  reason_ids: z.union([z.string(), z.array(z.string())]).optional(),
  body_site_id: GlobalIdSchema.optional(),
  note: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalEncounterHistorySchema = z.object({
  encounter_history_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  status: z.string().optional(),
  class: z.string().optional(),
  type: z.union([z.string(), z.array(z.string())]).optional(),
  service_type: z.union([z.string(), z.array(z.string())]).optional(),
  service_type_reference_ids: z.union([z.string(), z.array(z.string())]).optional(),
  subject_id: GlobalIdSchema.optional(),
  subject_status: z.string().optional(),
  actual_start: z.string().optional(),
  actual_end: z.string().optional(),
  planned_start_date: z.string().optional(),
  planned_end_date: z.string().optional(),
  length_value: GlobalNumberSchema.optional(),
  length_unit: z.string().optional(),
  length_system: z.string().optional(),
  length_code: z.string().optional(),
  location_id: GlobalIdSchema.optional(),
  location_form: z.string().optional()
});

const GlobalFlagSchema = z.object({
  flag_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  status: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  code: z.string().optional(),
  subject_id: GlobalIdSchema.optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  encounter_id: GlobalIdSchema.optional(),
  author_id: GlobalIdSchema.optional()
});

const GlobalObservationSchema = z.object({
  observation_id: GlobalIdSchema.optional(),
  observation_code: z.string().optional(),
  observation_code_system: z.string().optional(),
  observation_display: z.string().optional(),
  observation_value: z.union([z.string(), z.number()]).optional(),
  observation_unit: z.string().optional(),
  observation_date: z.string().optional(),
  observation_status: z.string().optional()
});

const GlobalListEntrySchema = z.object({
  flag: GlobalCodeableConceptSchema.optional(),
  deleted: z.union([z.boolean(), z.string(), z.number()]).optional(),
  date: z.string().optional(),
  item_id: GlobalIdSchema.optional()
});

const GlobalListSchema = z.object({
  list_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  status: z.string().optional(),
  mode: z.string().optional(),
  title: z.string().optional(),
  code: GlobalCodeableConceptSchema.optional(),
  subject_ids: z.union([z.string(), z.array(z.string())]).optional(),
  encounter_id: GlobalIdSchema.optional(),
  date: z.string().optional(),
  source_id: GlobalIdSchema.optional(),
  ordered_by: GlobalCodeableConceptSchema.optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  entry: z.union([GlobalListEntrySchema, z.array(GlobalListEntrySchema)]).optional(),
  empty_reason: GlobalCodeableConceptSchema.optional()
});

const GlobalNutritionIntakeConsumedItemSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  nutrition_product_codeable: GlobalCodeableConceptSchema.optional(),
  nutrition_product_reference_id: GlobalIdSchema.optional(),
  schedule: z.string().optional(),
  amount: GlobalQuantitySchema.optional(),
  rate: GlobalQuantitySchema.optional(),
  not_consumed: z.union([z.boolean(), z.string(), z.number()]).optional(),
  not_consumed_reason: GlobalCodeableConceptSchema.optional()
});

const GlobalNutritionIntakeIngredientSchema = z.object({
  nutrient_codeable: GlobalCodeableConceptSchema.optional(),
  nutrient_reference_id: GlobalIdSchema.optional(),
  amount: GlobalQuantitySchema.optional()
});

const GlobalNutritionIntakePerformerSchema = z.object({
  function: GlobalCodeableConceptSchema.optional(),
  actor_id: GlobalIdSchema.optional()
});

const GlobalNutritionIntakeSchema = z.object({
  nutrition_intake_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  instantiates_canonical: z.union([z.string(), z.array(z.string())]).optional(),
  instantiates_uri: z.union([z.string(), z.array(z.string())]).optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  part_of_ids: z.union([z.string(), z.array(z.string())]).optional(),
  status: z.string().optional(),
  status_reason: z.union([z.string(), z.array(z.string())]).optional(),
  code: GlobalCodeableConceptSchema.optional(),
  subject_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  occurrence_date_time: z.string().optional(),
  occurrence_start: z.string().optional(),
  occurrence_end: z.string().optional(),
  recorded: z.string().optional(),
  reported_boolean: z.union([z.boolean(), z.string(), z.number()]).optional(),
  reported_reference_id: GlobalIdSchema.optional(),
  consumed_item: z.union([GlobalNutritionIntakeConsumedItemSchema, z.array(GlobalNutritionIntakeConsumedItemSchema)]).optional(),
  ingredient_label: z.union([GlobalNutritionIntakeIngredientSchema, z.array(GlobalNutritionIntakeIngredientSchema)]).optional(),
  performer: z.union([GlobalNutritionIntakePerformerSchema, z.array(GlobalNutritionIntakePerformerSchema)]).optional(),
  location_id: GlobalIdSchema.optional(),
  derived_from_ids: z.union([z.string(), z.array(z.string())]).optional(),
  reason_ids: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalNutritionOrderSchema = z.object({
  nutrition_order_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  instantiates_canonical: z.union([z.string(), z.array(z.string())]).optional(),
  instantiates_uri: z.union([z.string(), z.array(z.string())]).optional(),
  instantiates: z.union([z.string(), z.array(z.string())]).optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  group_identifier: GlobalIdentifierObjectSchema.optional(),
  status: z.string().optional(),
  intent: z.string().optional(),
  priority: z.string().optional(),
  subject_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  supporting_information_ids: z.union([z.string(), z.array(z.string())]).optional(),
  date_time: z.string().optional(),
  orderer_id: GlobalIdSchema.optional(),
  performer_concept: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  performer_reference_ids: z.union([z.string(), z.array(z.string())]).optional(),
  allergy_intolerance_ids: z.union([z.string(), z.array(z.string())]).optional(),
  food_preference_modifier: z.union([z.string(), z.array(z.string())]).optional(),
  exclude_food_modifier: z.union([z.string(), z.array(z.string())]).optional(),
  outside_food_allowed: z.union([z.boolean(), z.string(), z.number()]).optional(),
  oral_diet_type: z.union([z.string(), z.array(z.string())]).optional(),
  oral_diet_schedule_timing: z.string().optional(),
  oral_diet_as_needed: z.union([z.boolean(), z.string(), z.number()]).optional(),
  oral_diet_as_needed_for: z.string().optional(),
  oral_diet_instruction: z.string().optional(),
  supplement_type_code: z.string().optional(),
  supplement_type_reference_id: GlobalIdSchema.optional(),
  supplement_product_name: z.string().optional(),
  supplement_schedule_timing: z.string().optional(),
  supplement_as_needed: z.union([z.boolean(), z.string(), z.number()]).optional(),
  supplement_as_needed_for: z.string().optional(),
  supplement_quantity_value: GlobalNumberSchema.optional(),
  supplement_quantity_unit: z.string().optional(),
  supplement_instruction: z.string().optional(),
  enteral_base_formula_code: z.string().optional(),
  enteral_base_formula_reference_id: GlobalIdSchema.optional(),
  enteral_base_formula_product_name: z.string().optional(),
  enteral_route_of_administration: z.string().optional(),
  enteral_caloric_density_value: GlobalNumberSchema.optional(),
  enteral_caloric_density_unit: z.string().optional(),
  enteral_administration_instruction: z.string().optional(),
  note: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalRangeSchema = z.object({
  low_value: GlobalNumberSchema.optional(),
  low_unit: z.string().optional(),
  high_value: GlobalNumberSchema.optional(),
  high_unit: z.string().optional()
});

const GlobalRiskAssessmentPredictionSchema = z.object({
  outcome: GlobalCodeableConceptSchema.optional(),
  probability_decimal: GlobalNumberSchema.optional(),
  probability_range: GlobalRangeSchema.optional(),
  qualitative_risk: GlobalCodeableConceptSchema.optional(),
  relative_risk: GlobalNumberSchema.optional(),
  when_period: z.object({
    start: z.string().optional(),
    end: z.string().optional()
  }).optional(),
  when_range: GlobalRangeSchema.optional(),
  rationale: z.string().optional()
});

const GlobalRiskAssessmentSchema = z.object({
  risk_assessment_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  based_on_id: GlobalIdSchema.optional(),
  parent_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  method: GlobalCodeableConceptSchema.optional(),
  code: GlobalCodeableConceptSchema.optional(),
  subject_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  occurrence_date_time: z.string().optional(),
  occurrence_start: z.string().optional(),
  occurrence_end: z.string().optional(),
  condition_id: GlobalIdSchema.optional(),
  performer_id: GlobalIdSchema.optional(),
  reason_ids: z.union([z.string(), z.array(z.string())]).optional(),
  basis_ids: z.union([z.string(), z.array(z.string())]).optional(),
  prediction: z.union([GlobalRiskAssessmentPredictionSchema, z.array(GlobalRiskAssessmentPredictionSchema)]).optional(),
  mitigation: z.string().optional(),
  note: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalPeriodSchema = z.object({
  start: z.string().optional(),
  end: z.string().optional()
});

const GlobalGroupCharacteristicSchema = z.object({
  code: GlobalCodeableConceptSchema.optional(),
  value_codeable: GlobalCodeableConceptSchema.optional(),
  value_boolean: z.union([z.boolean(), z.string(), z.number()]).optional(),
  value_quantity: GlobalQuantitySchema.optional(),
  value_range: GlobalRangeSchema.optional(),
  value_reference_id: GlobalIdSchema.optional(),
  exclude: z.union([z.boolean(), z.string(), z.number()]).optional(),
  period: GlobalPeriodSchema.optional()
});

const GlobalGroupMemberSchema = z.object({
  entity_id: GlobalIdSchema.optional(),
  period: GlobalPeriodSchema.optional(),
  inactive: z.union([z.boolean(), z.string(), z.number()]).optional()
});

const GlobalGroupSchema = z.object({
  group_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  active: z.union([z.boolean(), z.string(), z.number()]).optional(),
  type: z.string().optional(),
  membership: z.string().optional(),
  code: GlobalCodeableConceptSchema.optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  quantity: GlobalNumberSchema.optional(),
  managing_entity_id: GlobalIdSchema.optional(),
  characteristic: z.union([GlobalGroupCharacteristicSchema, z.array(GlobalGroupCharacteristicSchema)]).optional(),
  member: z.union([GlobalGroupMemberSchema, z.array(GlobalGroupMemberSchema)]).optional()
});

const GlobalAttachmentSchema = z.object({
  content_type: z.string().optional(),
  url: z.string().optional(),
  title: z.string().optional(),
  data: z.string().optional()
});

const GlobalMedicationKnowledgeRelatedSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  reference_ids: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalMedicationKnowledgeMonographSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  source_id: GlobalIdSchema.optional()
});

const GlobalMedicationKnowledgeCostSchema = z.object({
  effective_date: z.union([GlobalPeriodSchema, z.array(GlobalPeriodSchema)]).optional(),
  type: GlobalCodeableConceptSchema.optional(),
  source: z.string().optional(),
  cost_money: GlobalMoneySchema.optional(),
  cost_codeable_concept: GlobalCodeableConceptSchema.optional()
});

const GlobalMedicationKnowledgeMonitoringProgramSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  name: z.string().optional()
});

const GlobalMedicationKnowledgeClassificationSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  source_string: z.string().optional(),
  source_uri: z.string().optional(),
  classification: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional()
});

const GlobalMedicationKnowledgePackagingSchema = z.object({
  cost: z.union([GlobalMedicationKnowledgeCostSchema, z.array(GlobalMedicationKnowledgeCostSchema)]).optional(),
  packaged_product_id: GlobalIdSchema.optional()
});

const GlobalMedicationKnowledgeStorageSettingSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  value_quantity: GlobalQuantitySchema.optional(),
  value_range: GlobalRangeSchema.optional(),
  value_codeable_concept: GlobalCodeableConceptSchema.optional()
});

const GlobalMedicationKnowledgeStorageGuidelineSchema = z.object({
  reference: z.string().optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  stability_duration: GlobalQuantitySchema.optional(),
  environmental_setting: z.union([GlobalMedicationKnowledgeStorageSettingSchema, z.array(GlobalMedicationKnowledgeStorageSettingSchema)]).optional()
});

const GlobalMedicationKnowledgeRegulatorySchema = z.object({
  regulatory_authority_id: GlobalIdSchema.optional(),
  substitution: z.array(z.object({
    type: GlobalCodeableConceptSchema.optional(),
    allowed: z.union([z.boolean(), z.string(), z.number()]).optional()
  })).optional(),
  schedule: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  max_dispense: z.object({
    quantity: GlobalQuantitySchema.optional(),
    period: GlobalQuantitySchema.optional()
  }).optional()
});

const GlobalMedicationKnowledgeDefinitionalIngredientSchema = z.object({
  item_reference_id: GlobalIdSchema.optional(),
  item_codeable_concept: GlobalCodeableConceptSchema.optional(),
  type: GlobalCodeableConceptSchema.optional(),
  strength_ratio: z.object({
    numerator: GlobalQuantitySchema.optional(),
    denominator: GlobalQuantitySchema.optional()
  }).optional(),
  strength_codeable_concept: GlobalCodeableConceptSchema.optional(),
  strength_quantity: GlobalQuantitySchema.optional()
});

const GlobalMedicationKnowledgeDefinitionalDrugCharacteristicSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  value_codeable_concept: GlobalCodeableConceptSchema.optional(),
  value_string: z.string().optional(),
  value_quantity: GlobalQuantitySchema.optional(),
  value_base64_binary: z.string().optional(),
  value_attachment: GlobalAttachmentSchema.optional()
});

const GlobalMedicationKnowledgeDefinitionalSchema = z.object({
  definition_ids: z.union([z.string(), z.array(z.string())]).optional(),
  dose_form: GlobalCodeableConceptSchema.optional(),
  intended_route: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  ingredient: z.union([GlobalMedicationKnowledgeDefinitionalIngredientSchema, z.array(GlobalMedicationKnowledgeDefinitionalIngredientSchema)]).optional(),
  drug_characteristic: z.union([GlobalMedicationKnowledgeDefinitionalDrugCharacteristicSchema, z.array(GlobalMedicationKnowledgeDefinitionalDrugCharacteristicSchema)]).optional()
});

const GlobalMedicationKnowledgeSchema = z.object({
  medication_knowledge_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  code: GlobalCodeableConceptSchema.optional(),
  status: z.string().optional(),
  author_id: GlobalIdSchema.optional(),
  intended_jurisdiction: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  name: z.union([z.string(), z.array(z.string())]).optional(),
  related_medication_knowledge: z.union([GlobalMedicationKnowledgeRelatedSchema, z.array(GlobalMedicationKnowledgeRelatedSchema)]).optional(),
  associated_medication_ids: z.union([z.string(), z.array(z.string())]).optional(),
  product_type: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  monograph: z.union([GlobalMedicationKnowledgeMonographSchema, z.array(GlobalMedicationKnowledgeMonographSchema)]).optional(),
  preparation_instruction: z.string().optional(),
  cost: z.union([GlobalMedicationKnowledgeCostSchema, z.array(GlobalMedicationKnowledgeCostSchema)]).optional(),
  monitoring_program: z.union([GlobalMedicationKnowledgeMonitoringProgramSchema, z.array(GlobalMedicationKnowledgeMonitoringProgramSchema)]).optional(),
  medicine_classification: z.union([GlobalMedicationKnowledgeClassificationSchema, z.array(GlobalMedicationKnowledgeClassificationSchema)]).optional(),
  packaging: z.union([GlobalMedicationKnowledgePackagingSchema, z.array(GlobalMedicationKnowledgePackagingSchema)]).optional(),
  clinical_use_issue_ids: z.union([z.string(), z.array(z.string())]).optional(),
  storage_guideline: z.union([GlobalMedicationKnowledgeStorageGuidelineSchema, z.array(GlobalMedicationKnowledgeStorageGuidelineSchema)]).optional(),
  regulatory: z.union([GlobalMedicationKnowledgeRegulatorySchema, z.array(GlobalMedicationKnowledgeRegulatorySchema)]).optional(),
  definitional: GlobalMedicationKnowledgeDefinitionalSchema.optional()
});

const GlobalHealthcareServiceContactSchema = z.object({
  name: z.string().optional(),
  telecom: z.array(GlobalContactPointSchema).optional()
});

const GlobalHealthcareServiceEligibilitySchema = z.object({
  code: GlobalCodeableConceptSchema.optional(),
  comment: z.string().optional()
});

const GlobalHealthcareServiceSchema = z.object({
  healthcare_service_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  active: z.union([z.boolean(), z.string(), z.number()]).optional(),
  provided_by_id: GlobalIdSchema.optional(),
  offered_in_ids: z.union([z.string(), z.array(z.string())]).optional(),
  category: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  type: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  specialty: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  location_ids: z.union([z.string(), z.array(z.string())]).optional(),
  name: z.string().optional(),
  comment: z.string().optional(),
  extra_details: z.string().optional(),
  photo: GlobalAttachmentSchema.optional(),
  contact: z.union([GlobalHealthcareServiceContactSchema, z.array(GlobalHealthcareServiceContactSchema)]).optional(),
  coverage_area_ids: z.union([z.string(), z.array(z.string())]).optional(),
  service_provision_code: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  eligibility: z.union([GlobalHealthcareServiceEligibilitySchema, z.array(GlobalHealthcareServiceEligibilitySchema)]).optional(),
  program: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  characteristic: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  communication: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  referral_method: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  appointment_required: z.union([z.boolean(), z.string(), z.number()]).optional(),
  availability: z.array(z.object({
    days_of_week: z.union([z.string(), z.array(z.string())]).optional(),
    available_start_time: z.string().optional(),
    available_end_time: z.string().optional(),
    all_day: z.union([z.boolean(), z.string(), z.number()]).optional(),
    available: z.union([z.boolean(), z.string(), z.number()]).optional()
  })).optional(),
  endpoint_ids: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalInsurancePlanCoverageLimitSchema = z.object({
  value: GlobalQuantitySchema.optional(),
  code: GlobalCodeableConceptSchema.optional()
});

const GlobalInsurancePlanCoverageBenefitSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  requirement: z.string().optional(),
  limit: z.union([GlobalInsurancePlanCoverageLimitSchema, z.array(GlobalInsurancePlanCoverageLimitSchema)]).optional()
});

const GlobalInsurancePlanCoverageSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  network_ids: z.union([z.string(), z.array(z.string())]).optional(),
  benefit: z.union([GlobalInsurancePlanCoverageBenefitSchema, z.array(GlobalInsurancePlanCoverageBenefitSchema)]).optional()
});

const GlobalInsurancePlanPlanCostSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  group_size: GlobalNumberSchema.optional(),
  cost: GlobalMoneySchema.optional(),
  comment: z.string().optional()
});

const GlobalInsurancePlanSpecificCostItemSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  applicability: GlobalCodeableConceptSchema.optional(),
  qualifiers: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  value: GlobalQuantitySchema.optional()
});

const GlobalInsurancePlanSpecificBenefitSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  cost: z.union([GlobalInsurancePlanSpecificCostItemSchema, z.array(GlobalInsurancePlanSpecificCostItemSchema)]).optional()
});

const GlobalInsurancePlanSpecificCostSchema = z.object({
  category: GlobalCodeableConceptSchema.optional(),
  benefit: z.union([GlobalInsurancePlanSpecificBenefitSchema, z.array(GlobalInsurancePlanSpecificBenefitSchema)]).optional()
});

const GlobalInsurancePlanPlanSchema = z.object({
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  type: GlobalCodeableConceptSchema.optional(),
  coverage_area_ids: z.union([z.string(), z.array(z.string())]).optional(),
  network_ids: z.union([z.string(), z.array(z.string())]).optional(),
  general_cost: z.union([GlobalInsurancePlanPlanCostSchema, z.array(GlobalInsurancePlanPlanCostSchema)]).optional(),
  specific_cost: z.union([GlobalInsurancePlanSpecificCostSchema, z.array(GlobalInsurancePlanSpecificCostSchema)]).optional()
});

const GlobalInsurancePlanSchema = z.object({
  insurance_plan_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  status: z.string().optional(),
  type: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  name: z.string().optional(),
  alias: z.union([z.string(), z.array(z.string())]).optional(),
  period: GlobalPeriodSchema.optional(),
  owned_by_id: GlobalIdSchema.optional(),
  administered_by_id: GlobalIdSchema.optional(),
  coverage_area_ids: z.union([z.string(), z.array(z.string())]).optional(),
  contact: z.union([GlobalHealthcareServiceContactSchema, z.array(GlobalHealthcareServiceContactSchema)]).optional(),
  endpoint_ids: z.union([z.string(), z.array(z.string())]).optional(),
  network_ids: z.union([z.string(), z.array(z.string())]).optional(),
  coverage: z.union([GlobalInsurancePlanCoverageSchema, z.array(GlobalInsurancePlanCoverageSchema)]).optional(),
  plan: z.union([GlobalInsurancePlanPlanSchema, z.array(GlobalInsurancePlanPlanSchema)]).optional()
});

const GlobalClaimRelatedSchema = z.object({
  claim_id: GlobalIdSchema.optional(),
  relationship: GlobalCodeableConceptSchema.optional(),
  reference: GlobalIdentifierObjectSchema.optional()
});

const GlobalClaimEventSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  when_date_time: z.string().optional(),
  when_start: z.string().optional(),
  when_end: z.string().optional()
});

const GlobalClaimCareTeamSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  provider_id: GlobalIdSchema.optional(),
  responsible: z.union([z.boolean(), z.string(), z.number()]).optional(),
  role: GlobalCodeableConceptSchema.optional(),
  specialty: GlobalCodeableConceptSchema.optional()
});

const GlobalClaimSupportingInfoSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  category: GlobalCodeableConceptSchema.optional(),
  code: GlobalCodeableConceptSchema.optional(),
  timing_date: z.string().optional(),
  timing_start: z.string().optional(),
  timing_end: z.string().optional(),
  value_boolean: z.union([z.boolean(), z.string(), z.number()]).optional(),
  value_string: z.string().optional(),
  value_quantity: GlobalQuantitySchema.optional(),
  value_attachment: GlobalAttachmentSchema.optional(),
  value_reference_id: GlobalIdSchema.optional(),
  value_identifier: GlobalIdentifierObjectSchema.optional(),
  reason: GlobalCodeableConceptSchema.optional()
});

const GlobalClaimDiagnosisSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  diagnosis_code: GlobalCodeableConceptSchema.optional(),
  diagnosis_reference_id: GlobalIdSchema.optional(),
  type: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  on_admission: GlobalCodeableConceptSchema.optional()
});

const GlobalClaimProcedureSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  type: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  date: z.string().optional(),
  procedure_code: GlobalCodeableConceptSchema.optional(),
  procedure_reference_id: GlobalIdSchema.optional(),
  udi_ids: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalClaimInsuranceSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  focal: z.union([z.boolean(), z.string(), z.number()]).optional(),
  identifier: GlobalIdentifierObjectSchema.optional(),
  coverage_id: GlobalIdSchema.optional(),
  business_arrangement: z.string().optional(),
  pre_auth_ref: z.union([z.string(), z.array(z.string())]).optional(),
  claim_response_id: GlobalIdSchema.optional()
});

const GlobalClaimAccidentSchema = z.object({
  date: z.string().optional(),
  type: GlobalCodeableConceptSchema.optional(),
  location_address: GlobalAddressSchema.optional(),
  location_reference_id: GlobalIdSchema.optional()
});

const GlobalClaimItemSubDetailSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  revenue: GlobalCodeableConceptSchema.optional(),
  category: GlobalCodeableConceptSchema.optional(),
  product_or_service: GlobalCodeableConceptSchema.optional(),
  product_or_service_end: GlobalCodeableConceptSchema.optional(),
  modifier: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  program_code: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  patient_paid: GlobalMoneySchema.optional(),
  quantity: GlobalQuantitySchema.optional(),
  unit_price: GlobalMoneySchema.optional(),
  factor: z.union([z.number(), GlobalStringSchema]).optional(),
  tax: GlobalMoneySchema.optional(),
  net: GlobalMoneySchema.optional(),
  udi_ids: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalClaimItemDetailSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  revenue: GlobalCodeableConceptSchema.optional(),
  category: GlobalCodeableConceptSchema.optional(),
  product_or_service: GlobalCodeableConceptSchema.optional(),
  product_or_service_end: GlobalCodeableConceptSchema.optional(),
  modifier: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  program_code: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  patient_paid: GlobalMoneySchema.optional(),
  quantity: GlobalQuantitySchema.optional(),
  unit_price: GlobalMoneySchema.optional(),
  factor: z.union([z.number(), GlobalStringSchema]).optional(),
  tax: GlobalMoneySchema.optional(),
  net: GlobalMoneySchema.optional(),
  udi_ids: z.union([z.string(), z.array(z.string())]).optional(),
  sub_detail: z.union([GlobalClaimItemSubDetailSchema, z.array(GlobalClaimItemSubDetailSchema)]).optional()
});

const GlobalClaimItemSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  care_team_sequence: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  diagnosis_sequence: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  procedure_sequence: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  information_sequence: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  revenue: GlobalCodeableConceptSchema.optional(),
  category: GlobalCodeableConceptSchema.optional(),
  product_or_service: GlobalCodeableConceptSchema.optional(),
  product_or_service_end: GlobalCodeableConceptSchema.optional(),
  request_ids: z.union([z.string(), z.array(z.string())]).optional(),
  modifier: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  program_code: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  serviced_date: z.string().optional(),
  serviced_start: z.string().optional(),
  serviced_end: z.string().optional(),
  location_codeable: GlobalCodeableConceptSchema.optional(),
  location_address: GlobalAddressSchema.optional(),
  location_reference_id: GlobalIdSchema.optional(),
  patient_paid: GlobalMoneySchema.optional(),
  quantity: GlobalQuantitySchema.optional(),
  unit_price: GlobalMoneySchema.optional(),
  factor: z.union([z.number(), GlobalStringSchema]).optional(),
  tax: GlobalMoneySchema.optional(),
  net: GlobalMoneySchema.optional(),
  udi_ids: z.union([z.string(), z.array(z.string())]).optional(),
  encounter_ids: z.union([z.string(), z.array(z.string())]).optional(),
  detail: z.union([GlobalClaimItemDetailSchema, z.array(GlobalClaimItemDetailSchema)]).optional()
});

const GlobalClaimPayeeSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  party_id: GlobalIdSchema.optional()
});

const GlobalClaimSchema = z.object({
  claim_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  type: GlobalCodeableConceptSchema.optional(),
  sub_type: GlobalCodeableConceptSchema.optional(),
  use: z.string().optional(),
  patient_id: GlobalIdSchema.optional(),
  billable_start: z.string().optional(),
  billable_end: z.string().optional(),
  created: z.string().optional(),
  enterer_id: GlobalIdSchema.optional(),
  insurer_id: GlobalIdSchema.optional(),
  provider_id: GlobalIdSchema.optional(),
  priority: GlobalCodeableConceptSchema.optional(),
  funds_reserve: GlobalCodeableConceptSchema.optional(),
  related: z.union([GlobalClaimRelatedSchema, z.array(GlobalClaimRelatedSchema)]).optional(),
  prescription_id: GlobalIdSchema.optional(),
  original_prescription_id: GlobalIdSchema.optional(),
  payee: GlobalClaimPayeeSchema.optional(),
  referral_id: GlobalIdSchema.optional(),
  encounter_ids: z.union([z.string(), z.array(z.string())]).optional(),
  facility_id: GlobalIdSchema.optional(),
  diagnosis_related_group: GlobalCodeableConceptSchema.optional(),
  event: z.union([GlobalClaimEventSchema, z.array(GlobalClaimEventSchema)]).optional(),
  care_team: z.union([GlobalClaimCareTeamSchema, z.array(GlobalClaimCareTeamSchema)]).optional(),
  supporting_info: z.union([GlobalClaimSupportingInfoSchema, z.array(GlobalClaimSupportingInfoSchema)]).optional(),
  diagnosis: z.union([GlobalClaimDiagnosisSchema, z.array(GlobalClaimDiagnosisSchema)]).optional(),
  procedure: z.union([GlobalClaimProcedureSchema, z.array(GlobalClaimProcedureSchema)]).optional(),
  insurance: z.union([GlobalClaimInsuranceSchema, z.array(GlobalClaimInsuranceSchema)]).optional(),
  accident: GlobalClaimAccidentSchema.optional(),
  patient_paid: GlobalMoneySchema.optional(),
  item: z.union([GlobalClaimItemSchema, z.array(GlobalClaimItemSchema)]).optional(),
  total: GlobalMoneySchema.optional()
});

const GlobalClaimResponseAdjudicationSchema = z.object({
  category: GlobalCodeableConceptSchema.optional(),
  reason: GlobalCodeableConceptSchema.optional(),
  amount: GlobalMoneySchema.optional(),
  quantity: GlobalQuantitySchema.optional()
});

const GlobalClaimResponseReviewOutcomeSchema = z.object({
  decision: GlobalCodeableConceptSchema.optional(),
  reason: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  pre_auth_ref: z.string().optional(),
  pre_auth_start: z.string().optional(),
  pre_auth_end: z.string().optional()
});

const GlobalClaimResponseItemSubDetailSchema = z.object({
  sub_detail_sequence: GlobalNumberSchema.optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  note_number: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  review_outcome: GlobalClaimResponseReviewOutcomeSchema.optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional()
});

const GlobalClaimResponseItemDetailSchema = z.object({
  detail_sequence: GlobalNumberSchema.optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  note_number: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  review_outcome: GlobalClaimResponseReviewOutcomeSchema.optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional(),
  sub_detail: z.union([GlobalClaimResponseItemSubDetailSchema, z.array(GlobalClaimResponseItemSubDetailSchema)]).optional()
});

const GlobalClaimResponseItemSchema = z.object({
  item_sequence: GlobalNumberSchema.optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  note_number: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  review_outcome: GlobalClaimResponseReviewOutcomeSchema.optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional(),
  detail: z.union([GlobalClaimResponseItemDetailSchema, z.array(GlobalClaimResponseItemDetailSchema)]).optional()
});

const GlobalClaimResponseAddItemSubDetailSchema = z.object({
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  revenue: GlobalCodeableConceptSchema.optional(),
  product_or_service: GlobalCodeableConceptSchema.optional(),
  product_or_service_end: GlobalCodeableConceptSchema.optional(),
  modifier: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  quantity: GlobalQuantitySchema.optional(),
  unit_price: GlobalMoneySchema.optional(),
  factor: z.union([z.number(), GlobalStringSchema]).optional(),
  tax: GlobalMoneySchema.optional(),
  net: GlobalMoneySchema.optional(),
  note_number: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  review_outcome: GlobalClaimResponseReviewOutcomeSchema.optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional()
});

const GlobalClaimResponseAddItemDetailSchema = z.object({
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  revenue: GlobalCodeableConceptSchema.optional(),
  product_or_service: GlobalCodeableConceptSchema.optional(),
  product_or_service_end: GlobalCodeableConceptSchema.optional(),
  modifier: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  quantity: GlobalQuantitySchema.optional(),
  unit_price: GlobalMoneySchema.optional(),
  factor: z.union([z.number(), GlobalStringSchema]).optional(),
  tax: GlobalMoneySchema.optional(),
  net: GlobalMoneySchema.optional(),
  note_number: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  review_outcome: GlobalClaimResponseReviewOutcomeSchema.optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional(),
  sub_detail: z.union([GlobalClaimResponseAddItemSubDetailSchema, z.array(GlobalClaimResponseAddItemSubDetailSchema)]).optional()
});

const GlobalClaimResponseAddItemSchema = z.object({
  item_sequence: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  detail_sequence: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  subdetail_sequence: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  provider_ids: z.union([z.string(), z.array(z.string())]).optional(),
  revenue: GlobalCodeableConceptSchema.optional(),
  product_or_service: GlobalCodeableConceptSchema.optional(),
  product_or_service_end: GlobalCodeableConceptSchema.optional(),
  request_ids: z.union([z.string(), z.array(z.string())]).optional(),
  modifier: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  program_code: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  serviced_date: z.string().optional(),
  serviced_start: z.string().optional(),
  serviced_end: z.string().optional(),
  location_codeable: GlobalCodeableConceptSchema.optional(),
  location_address: GlobalAddressSchema.optional(),
  location_reference_id: GlobalIdSchema.optional(),
  quantity: GlobalQuantitySchema.optional(),
  unit_price: GlobalMoneySchema.optional(),
  factor: z.union([z.number(), GlobalStringSchema]).optional(),
  tax: GlobalMoneySchema.optional(),
  net: GlobalMoneySchema.optional(),
  note_number: z.union([GlobalStringSchema, z.array(GlobalStringSchema)]).optional(),
  review_outcome: GlobalClaimResponseReviewOutcomeSchema.optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional(),
  detail: z.union([GlobalClaimResponseAddItemDetailSchema, z.array(GlobalClaimResponseAddItemDetailSchema)]).optional()
});

const GlobalClaimResponseTotalSchema = z.object({
  category: GlobalCodeableConceptSchema.optional(),
  amount: GlobalMoneySchema.optional()
});

const GlobalClaimResponsePaymentSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  adjustment: GlobalMoneySchema.optional(),
  adjustment_reason: GlobalCodeableConceptSchema.optional(),
  date: z.string().optional(),
  amount: GlobalMoneySchema.optional(),
  identifier: GlobalIdentifierObjectSchema.optional()
});

const GlobalClaimResponseProcessNoteSchema = z.object({
  number: GlobalNumberSchema.optional(),
  type: GlobalCodeableConceptSchema.optional(),
  text: z.string().optional(),
  language: GlobalCodeableConceptSchema.optional()
});

const GlobalClaimResponseInsuranceSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  focal: z.union([z.boolean(), z.string(), z.number()]).optional(),
  coverage_id: GlobalIdSchema.optional(),
  business_arrangement: z.string().optional(),
  claim_response_id: GlobalIdSchema.optional()
});

const GlobalClaimResponseErrorSchema = z.object({
  item_sequence: GlobalNumberSchema.optional(),
  detail_sequence: GlobalNumberSchema.optional(),
  sub_detail_sequence: GlobalNumberSchema.optional(),
  code: GlobalCodeableConceptSchema.optional(),
  expression: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalClaimResponseEventSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  when_date_time: z.string().optional(),
  when_start: z.string().optional(),
  when_end: z.string().optional()
});

const GlobalClaimResponseSchema = z.object({
  claim_response_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  type: GlobalCodeableConceptSchema.optional(),
  sub_type: GlobalCodeableConceptSchema.optional(),
  use: z.string().optional(),
  patient_id: GlobalIdSchema.optional(),
  created: z.string().optional(),
  insurer_id: GlobalIdSchema.optional(),
  requestor_id: GlobalIdSchema.optional(),
  request_id: GlobalIdSchema.optional(),
  outcome: z.string().optional(),
  decision: GlobalCodeableConceptSchema.optional(),
  disposition: z.string().optional(),
  pre_auth_ref: z.string().optional(),
  pre_auth_start: z.string().optional(),
  pre_auth_end: z.string().optional(),
  event: z.union([GlobalClaimResponseEventSchema, z.array(GlobalClaimResponseEventSchema)]).optional(),
  payee_type: GlobalCodeableConceptSchema.optional(),
  encounter_ids: z.union([z.string(), z.array(z.string())]).optional(),
  diagnosis_related_group: GlobalCodeableConceptSchema.optional(),
  item: z.union([GlobalClaimResponseItemSchema, z.array(GlobalClaimResponseItemSchema)]).optional(),
  add_item: z.union([GlobalClaimResponseAddItemSchema, z.array(GlobalClaimResponseAddItemSchema)]).optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional(),
  total: z.union([GlobalClaimResponseTotalSchema, z.array(GlobalClaimResponseTotalSchema)]).optional(),
  payment: GlobalClaimResponsePaymentSchema.optional(),
  funds_reserve: GlobalCodeableConceptSchema.optional(),
  form_code: GlobalCodeableConceptSchema.optional(),
  form: GlobalAttachmentSchema.optional(),
  process_note: z.union([GlobalClaimResponseProcessNoteSchema, z.array(GlobalClaimResponseProcessNoteSchema)]).optional(),
  communication_request_ids: z.union([z.string(), z.array(z.string())]).optional(),
  insurance: z.union([GlobalClaimResponseInsuranceSchema, z.array(GlobalClaimResponseInsuranceSchema)]).optional(),
  error: z.union([GlobalClaimResponseErrorSchema, z.array(GlobalClaimResponseErrorSchema)]).optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional()
});

const GlobalUsageContextSchema = z.object({
  code: GlobalCodeableConceptSchema.optional(),
  value_codeable: GlobalCodeableConceptSchema.optional(),
  value_reference_id: GlobalIdSchema.optional()
});

const GlobalAnnotationSchema = z.object({
  text: z.string().optional(),
  author: z.string().optional(),
  time: z.string().optional()
});

const GlobalCompositionAttesterSchema = z.object({
  mode: GlobalCodeableConceptSchema.optional(),
  time: z.string().optional(),
  party_id: GlobalIdSchema.optional()
});

const GlobalCompositionRelatesToSchema = z.object({
  type: z.string().optional(),
  resource_id: GlobalIdSchema.optional(),
  identifier: GlobalIdentifierObjectSchema.optional()
});

const GlobalCompositionEventSchema = z.object({
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  detail_ids: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalCompositionSectionSchema: z.ZodType<any> = z.object({
  title: z.string().optional(),
  code: GlobalCodeableConceptSchema.optional(),
  author_ids: z.union([z.string(), z.array(z.string())]).optional(),
  focus_id: GlobalIdSchema.optional(),
  text: z.string().optional(),
  ordered_by: GlobalCodeableConceptSchema.optional(),
  entry_ids: z.union([z.string(), z.array(z.string())]).optional(),
  empty_reason: GlobalCodeableConceptSchema.optional(),
  section: z.lazy(() => z.union([GlobalCompositionSectionSchema, z.array(GlobalCompositionSectionSchema)])).optional()
});

const GlobalCompositionSchema = z.object({
  composition_id: GlobalIdSchema.optional(),
  url: z.string().optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  version: z.string().optional(),
  status: z.string().optional(),
  type: GlobalCodeableConceptSchema.optional(),
  category: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  subject_ids: z.union([z.string(), z.array(z.string())]).optional(),
  encounter_id: GlobalIdSchema.optional(),
  date: z.string().optional(),
  use_context: z.union([GlobalUsageContextSchema, z.array(GlobalUsageContextSchema)]).optional(),
  author_ids: z.union([z.string(), z.array(z.string())]).optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  note: z.union([GlobalAnnotationSchema, z.array(GlobalAnnotationSchema)]).optional(),
  attester: z.union([GlobalCompositionAttesterSchema, z.array(GlobalCompositionAttesterSchema)]).optional(),
  custodian_id: GlobalIdSchema.optional(),
  relates_to: z.union([GlobalCompositionRelatesToSchema, z.array(GlobalCompositionRelatesToSchema)]).optional(),
  event: z.union([GlobalCompositionEventSchema, z.array(GlobalCompositionEventSchema)]).optional(),
  section: z.union([GlobalCompositionSectionSchema, z.array(GlobalCompositionSectionSchema)]).optional()
});

const GlobalAccountCoverageSchema = z.object({
  coverage_id: GlobalIdSchema.optional(),
  priority: GlobalNumberSchema.optional()
});

const GlobalAccountGuarantorSchema = z.object({
  party_id: GlobalIdSchema.optional(),
  on_hold: z.union([z.boolean(), z.string(), z.number()]).optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional()
});

const GlobalAccountDiagnosisSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  condition_id: GlobalIdSchema.optional(),
  condition_code: GlobalCodeableConceptSchema.optional(),
  date_of_diagnosis: z.string().optional(),
  type: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  on_admission: z.union([z.boolean(), z.string(), z.number()]).optional(),
  package_code: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional()
});

const GlobalAccountProcedureSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  procedure_id: GlobalIdSchema.optional(),
  procedure_code: GlobalCodeableConceptSchema.optional(),
  date_of_service: z.string().optional(),
  type: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  package_code: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  device_ids: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalAccountRelatedAccountSchema = z.object({
  relationship: GlobalCodeableConceptSchema.optional(),
  account_id: GlobalIdSchema.optional()
});

const GlobalAccountBalanceSchema = z.object({
  aggregate: GlobalCodeableConceptSchema.optional(),
  term: GlobalCodeableConceptSchema.optional(),
  estimate: z.union([z.boolean(), z.string(), z.number()]).optional(),
  amount: GlobalMoneySchema.optional()
});

const GlobalAccountSchema = z.object({
  account_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  status: z.string().optional(),
  billing_status: GlobalCodeableConceptSchema.optional(),
  type: GlobalCodeableConceptSchema.optional(),
  name: z.string().optional(),
  subject_ids: z.union([z.string(), z.array(z.string())]).optional(),
  service_period_start: z.string().optional(),
  service_period_end: z.string().optional(),
  coverage: z.union([GlobalAccountCoverageSchema, z.array(GlobalAccountCoverageSchema)]).optional(),
  owner_id: GlobalIdSchema.optional(),
  description: z.string().optional(),
  guarantor: z.union([GlobalAccountGuarantorSchema, z.array(GlobalAccountGuarantorSchema)]).optional(),
  diagnosis: z.union([GlobalAccountDiagnosisSchema, z.array(GlobalAccountDiagnosisSchema)]).optional(),
  procedure: z.union([GlobalAccountProcedureSchema, z.array(GlobalAccountProcedureSchema)]).optional(),
  related_account: z.union([GlobalAccountRelatedAccountSchema, z.array(GlobalAccountRelatedAccountSchema)]).optional(),
  currency: GlobalCodeableConceptSchema.optional(),
  balance: z.union([GlobalAccountBalanceSchema, z.array(GlobalAccountBalanceSchema)]).optional(),
  calculated_at: z.string().optional()
});

const GlobalChargeItemSchema = z.object({
  charge_item_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  status: z.string().optional(),
  code: GlobalCodeableConceptSchema.optional(),
  subject_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  occurrence_date_time: z.string().optional(),
  occurrence_start: z.string().optional(),
  occurrence_end: z.string().optional(),
  quantity: GlobalQuantitySchema.optional(),
  enterer_id: GlobalIdSchema.optional(),
  entered_date: z.string().optional(),
  account_ids: z.union([z.string(), z.array(z.string())]).optional(),
  total_price_value: GlobalNumberSchema.optional(),
  total_price_currency: z.string().optional()
});

const GlobalChargeItemDefinitionSchema = z.object({
  charge_item_definition_id: GlobalIdSchema.optional(),
  url: z.string().optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  version: z.string().optional(),
  status: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  publisher: z.string().optional(),
  date: z.string().optional(),
  code: GlobalCodeableConceptSchema.optional()
});

const GlobalDeviceSchema = z.object({
  device_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  status: z.string().optional(),
  display_name: z.string().optional(),
  manufacturer: z.string().optional(),
  model_number: z.string().optional(),
  serial_number: z.string().optional(),
  lot_number: z.string().optional(),
  owner_id: GlobalIdSchema.optional(),
  location_id: GlobalIdSchema.optional()
});

const GlobalDeviceMetricSchema = z.object({
  device_metric_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  status: z.string().optional(),
  type: GlobalCodeableConceptSchema.optional(),
  unit: GlobalCodeableConceptSchema.optional(),
  device_id: GlobalIdSchema.optional(),
  operational_status: z.string().optional(),
  color: z.string().optional(),
  category: z.string().optional(),
  measurement_frequency: GlobalQuantitySchema.optional()
});

const GlobalEndpointSchema = z.object({
  endpoint_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  status: z.string().optional(),
  connection_type: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  environment_type: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  managing_organization_id: GlobalIdSchema.optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  address: z.string().optional(),
  header: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalCoveragePaymentBySchema = z.object({
  party_id: GlobalIdSchema.optional(),
  responsibility: z.string().optional()
});

const GlobalCoverageClassSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  value: GlobalIdentifierObjectSchema.optional(),
  name: z.string().optional()
});

const GlobalCoverageCostExceptionSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  start: z.string().optional(),
  end: z.string().optional()
});

const GlobalCoverageCostToBeneficiarySchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  category: GlobalCodeableConceptSchema.optional(),
  network: GlobalCodeableConceptSchema.optional(),
  unit: GlobalCodeableConceptSchema.optional(),
  term: GlobalCodeableConceptSchema.optional(),
  value_quantity: GlobalQuantitySchema.optional(),
  value_money: GlobalMoneySchema.optional(),
  exception: z.union([GlobalCoverageCostExceptionSchema, z.array(GlobalCoverageCostExceptionSchema)]).optional()
});

const GlobalCoverageSchema = z.object({
  coverage_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  status: z.string().optional(),
  kind: z.string().optional(),
  payment_by: z.union([GlobalCoveragePaymentBySchema, z.array(GlobalCoveragePaymentBySchema)]).optional(),
  type: GlobalCodeableConceptSchema.optional(),
  policy_holder_id: GlobalIdSchema.optional(),
  subscriber_id: GlobalIdSchema.optional(),
  subscriber_identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  beneficiary_id: GlobalIdSchema.optional(),
  dependent: z.string().optional(),
  relationship: GlobalCodeableConceptSchema.optional(),
  period_start: z.string().optional(),
  period_end: z.string().optional(),
  insurer_id: GlobalIdSchema.optional(),
  class: z.union([GlobalCoverageClassSchema, z.array(GlobalCoverageClassSchema)]).optional(),
  order: GlobalNumberSchema.optional(),
  network: z.string().optional(),
  cost_to_beneficiary: z.union([GlobalCoverageCostToBeneficiarySchema, z.array(GlobalCoverageCostToBeneficiarySchema)]).optional(),
  subrogation: z.union([z.boolean(), z.string(), z.number()]).optional(),
  contract_ids: z.union([z.string(), z.array(z.string())]).optional(),
  insurance_plan_id: GlobalIdSchema.optional()
});

const GlobalBinarySchema = z.object({
  binary_id: GlobalIdSchema.optional(),
  content_type: z.string().optional(),
  security_context: z.string().optional(),
  data: z.string().optional()
});

const GlobalExplanationOfBenefitInsuranceSchema = z.object({
  focal: z.union([z.boolean(), z.string(), z.number()]).optional(),
  coverage_id: GlobalIdSchema.optional(),
  pre_auth_ref: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalExplanationOfBenefitItemSubDetailSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  revenue: GlobalCodeableConceptSchema.optional(),
  category: GlobalCodeableConceptSchema.optional(),
  product_or_service: GlobalCodeableConceptSchema.optional(),
  product_or_service_end: GlobalCodeableConceptSchema.optional(),
  modifier: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  program_code: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  patient_paid: GlobalMoneySchema.optional(),
  quantity: GlobalQuantitySchema.optional(),
  unit_price: GlobalMoneySchema.optional(),
  factor: GlobalNumberSchema.optional(),
  tax: GlobalMoneySchema.optional(),
  net: GlobalMoneySchema.optional(),
  udi_ids: z.union([z.string(), z.array(z.string())]).optional(),
  note_number: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  review_outcome: GlobalClaimResponseReviewOutcomeSchema.optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional()
});

const GlobalExplanationOfBenefitItemDetailSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  revenue: GlobalCodeableConceptSchema.optional(),
  category: GlobalCodeableConceptSchema.optional(),
  product_or_service: GlobalCodeableConceptSchema.optional(),
  product_or_service_end: GlobalCodeableConceptSchema.optional(),
  modifier: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  program_code: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  patient_paid: GlobalMoneySchema.optional(),
  quantity: GlobalQuantitySchema.optional(),
  unit_price: GlobalMoneySchema.optional(),
  factor: GlobalNumberSchema.optional(),
  tax: GlobalMoneySchema.optional(),
  net: GlobalMoneySchema.optional(),
  udi_ids: z.union([z.string(), z.array(z.string())]).optional(),
  note_number: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  review_outcome: GlobalClaimResponseReviewOutcomeSchema.optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional(),
  sub_detail: z.union([GlobalExplanationOfBenefitItemSubDetailSchema, z.array(GlobalExplanationOfBenefitItemSubDetailSchema)]).optional()
});

const GlobalExplanationOfBenefitItemSchema = z.object({
  sequence: GlobalNumberSchema.optional(),
  care_team_sequence: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  diagnosis_sequence: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  procedure_sequence: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  information_sequence: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  revenue: GlobalCodeableConceptSchema.optional(),
  category: GlobalCodeableConceptSchema.optional(),
  product_or_service: GlobalCodeableConceptSchema.optional(),
  product_or_service_end: GlobalCodeableConceptSchema.optional(),
  request_ids: z.union([z.string(), z.array(z.string())]).optional(),
  modifier: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  program_code: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  serviced_date: z.string().optional(),
  serviced_start: z.string().optional(),
  serviced_end: z.string().optional(),
  location_codeable: GlobalCodeableConceptSchema.optional(),
  location_address: GlobalAddressSchema.optional(),
  location_reference_id: GlobalIdSchema.optional(),
  patient_paid: GlobalMoneySchema.optional(),
  quantity: GlobalQuantitySchema.optional(),
  unit_price: GlobalMoneySchema.optional(),
  factor: GlobalNumberSchema.optional(),
  tax: GlobalMoneySchema.optional(),
  net: GlobalMoneySchema.optional(),
  udi_ids: z.union([z.string(), z.array(z.string())]).optional(),
  note_number: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  review_outcome: GlobalClaimResponseReviewOutcomeSchema.optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional(),
  detail: z.union([GlobalExplanationOfBenefitItemDetailSchema, z.array(GlobalExplanationOfBenefitItemDetailSchema)]).optional()
});

const GlobalExplanationOfBenefitAddItemDetailSchema = z.object({
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  revenue: GlobalCodeableConceptSchema.optional(),
  product_or_service: GlobalCodeableConceptSchema.optional(),
  product_or_service_end: GlobalCodeableConceptSchema.optional(),
  modifier: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  patient_paid: GlobalMoneySchema.optional(),
  quantity: GlobalQuantitySchema.optional(),
  unit_price: GlobalMoneySchema.optional(),
  factor: GlobalNumberSchema.optional(),
  tax: GlobalMoneySchema.optional(),
  net: GlobalMoneySchema.optional(),
  note_number: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  review_outcome: GlobalClaimResponseReviewOutcomeSchema.optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional(),
  sub_detail: z.union([GlobalExplanationOfBenefitItemSubDetailSchema, z.array(GlobalExplanationOfBenefitItemSubDetailSchema)]).optional()
});

const GlobalExplanationOfBenefitAddItemSchema = z.object({
  item_sequence: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  detail_sequence: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  subdetail_sequence: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  provider_ids: z.union([z.string(), z.array(z.string())]).optional(),
  revenue: GlobalCodeableConceptSchema.optional(),
  product_or_service: GlobalCodeableConceptSchema.optional(),
  product_or_service_end: GlobalCodeableConceptSchema.optional(),
  request_ids: z.union([z.string(), z.array(z.string())]).optional(),
  modifier: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  program_code: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  serviced_date: z.string().optional(),
  serviced_start: z.string().optional(),
  serviced_end: z.string().optional(),
  location_codeable: GlobalCodeableConceptSchema.optional(),
  location_address: GlobalAddressSchema.optional(),
  location_reference_id: GlobalIdSchema.optional(),
  patient_paid: GlobalMoneySchema.optional(),
  quantity: GlobalQuantitySchema.optional(),
  unit_price: GlobalMoneySchema.optional(),
  factor: GlobalNumberSchema.optional(),
  tax: GlobalMoneySchema.optional(),
  net: GlobalMoneySchema.optional(),
  body_site: z.union([GlobalCodeableConceptSchema, z.array(GlobalCodeableConceptSchema)]).optional(),
  note_number: z.union([GlobalNumberSchema, z.array(GlobalNumberSchema)]).optional(),
  review_outcome: GlobalClaimResponseReviewOutcomeSchema.optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional(),
  detail: z.union([GlobalExplanationOfBenefitAddItemDetailSchema, z.array(GlobalExplanationOfBenefitAddItemDetailSchema)]).optional()
});

const GlobalExplanationOfBenefitBenefitBalanceFinancialSchema = z.object({
  type: GlobalCodeableConceptSchema.optional(),
  allowed_unsigned_int: GlobalNumberSchema.optional(),
  allowed_string: z.string().optional(),
  allowed_money: GlobalMoneySchema.optional(),
  used_unsigned_int: GlobalNumberSchema.optional(),
  used_money: GlobalMoneySchema.optional()
});

const GlobalExplanationOfBenefitBenefitBalanceSchema = z.object({
  category: GlobalCodeableConceptSchema.optional(),
  excluded: z.union([z.boolean(), z.string(), z.number()]).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  network: GlobalCodeableConceptSchema.optional(),
  unit: GlobalCodeableConceptSchema.optional(),
  term: GlobalCodeableConceptSchema.optional(),
  financial: z.union([GlobalExplanationOfBenefitBenefitBalanceFinancialSchema, z.array(GlobalExplanationOfBenefitBenefitBalanceFinancialSchema)]).optional()
});

const GlobalExplanationOfBenefitSchema = z.object({
  explanation_of_benefit_id: GlobalIdSchema.optional(),
  identifier: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  trace_number: z.union([GlobalIdentifierObjectSchema, z.array(GlobalIdentifierObjectSchema)]).optional(),
  status: z.string().optional(),
  type: GlobalCodeableConceptSchema.optional(),
  sub_type: GlobalCodeableConceptSchema.optional(),
  use: z.string().optional(),
  patient_id: GlobalIdSchema.optional(),
  billable_start: z.string().optional(),
  billable_end: z.string().optional(),
  created: z.string().optional(),
  enterer_id: GlobalIdSchema.optional(),
  insurer_id: GlobalIdSchema.optional(),
  provider_id: GlobalIdSchema.optional(),
  priority: GlobalCodeableConceptSchema.optional(),
  funds_reserve_requested: GlobalCodeableConceptSchema.optional(),
  funds_reserve: GlobalCodeableConceptSchema.optional(),
  related: z.union([GlobalClaimRelatedSchema, z.array(GlobalClaimRelatedSchema)]).optional(),
  prescription_id: GlobalIdSchema.optional(),
  original_prescription_id: GlobalIdSchema.optional(),
  event: z.union([GlobalClaimEventSchema, z.array(GlobalClaimEventSchema)]).optional(),
  payee: GlobalClaimPayeeSchema.optional(),
  referral_id: GlobalIdSchema.optional(),
  encounter_ids: z.union([z.string(), z.array(z.string())]).optional(),
  facility_id: GlobalIdSchema.optional(),
  claim_id: GlobalIdSchema.optional(),
  claim_response_id: GlobalIdSchema.optional(),
  outcome: z.string().optional(),
  decision: GlobalCodeableConceptSchema.optional(),
  disposition: z.string().optional(),
  pre_auth_ref: z.union([z.string(), z.array(z.string())]).optional(),
  pre_auth_ref_period: z.union([GlobalPeriodSchema, z.array(GlobalPeriodSchema)]).optional(),
  diagnosis_related_group: GlobalCodeableConceptSchema.optional(),
  care_team: z.union([GlobalClaimCareTeamSchema, z.array(GlobalClaimCareTeamSchema)]).optional(),
  supporting_info: z.union([GlobalClaimSupportingInfoSchema, z.array(GlobalClaimSupportingInfoSchema)]).optional(),
  diagnosis: z.union([GlobalClaimDiagnosisSchema, z.array(GlobalClaimDiagnosisSchema)]).optional(),
  procedure: z.union([GlobalClaimProcedureSchema, z.array(GlobalClaimProcedureSchema)]).optional(),
  precedence: GlobalNumberSchema.optional(),
  insurance: z.union([GlobalExplanationOfBenefitInsuranceSchema, z.array(GlobalExplanationOfBenefitInsuranceSchema)]).optional(),
  accident: GlobalClaimAccidentSchema.optional(),
  patient_paid: GlobalMoneySchema.optional(),
  item: z.union([GlobalExplanationOfBenefitItemSchema, z.array(GlobalExplanationOfBenefitItemSchema)]).optional(),
  add_item: z.union([GlobalExplanationOfBenefitAddItemSchema, z.array(GlobalExplanationOfBenefitAddItemSchema)]).optional(),
  adjudication: z.union([GlobalClaimResponseAdjudicationSchema, z.array(GlobalClaimResponseAdjudicationSchema)]).optional(),
  total: z.union([GlobalClaimResponseTotalSchema, z.array(GlobalClaimResponseTotalSchema)]).optional(),
  payment: GlobalClaimResponsePaymentSchema.optional(),
  form_code: GlobalCodeableConceptSchema.optional(),
  form: GlobalAttachmentSchema.optional(),
  process_note: z.union([GlobalClaimResponseProcessNoteSchema, z.array(GlobalClaimResponseProcessNoteSchema)]).optional(),
  benefit_period: GlobalPeriodSchema.optional(),
  benefit_balance: z.union([GlobalExplanationOfBenefitBenefitBalanceSchema, z.array(GlobalExplanationOfBenefitBenefitBalanceSchema)]).optional()
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

const GlobalPersonSchema = z.object({
  person_id: GlobalIdSchema.optional(),
  active: z.union([z.boolean(), z.string(), z.number()]).optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  gender: z.string().optional(),
  birth_date: z.string().optional(),
  deceased: z.union([z.boolean(), z.string(), z.number()]).optional(),
  deceased_date: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  marital_status: z.string().optional(),
  language: z.string().optional(),
  language_preferred: z.union([z.boolean(), z.string(), z.number()]).optional(),
  managing_organization_id: GlobalIdSchema.optional(),
  link_target: z.string().optional(),
  link_assurance: z.string().optional()
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

const GlobalVerificationResultSchema = z.object({
  verification_result_id: GlobalIdSchema.optional(),
  target_ids: z.union([z.string(), z.array(z.string())]).optional(),
  target_location: z.union([z.string(), z.array(z.string())]).optional(),
  need: z.string().optional(),
  status: z.string().optional(),
  status_date: z.string().optional(),
  validation_type: z.string().optional(),
  validation_process: z.union([z.string(), z.array(z.string())]).optional(),
  frequency: z.string().optional(),
  last_performed: z.string().optional(),
  next_scheduled: z.string().optional(),
  failure_action: z.string().optional(),
  primary_source_who_id: GlobalIdSchema.optional(),
  primary_source_type: z.union([z.string(), z.array(z.string())]).optional(),
  primary_source_communication_method: z.union([z.string(), z.array(z.string())]).optional(),
  primary_source_validation_status: z.string().optional(),
  primary_source_validation_date: z.string().optional(),
  primary_source_can_push_updates: z.string().optional(),
  primary_source_push_type_available: z.union([z.string(), z.array(z.string())]).optional(),
  attestation_who_id: GlobalIdSchema.optional(),
  attestation_on_behalf_of_id: GlobalIdSchema.optional(),
  attestation_communication_method: z.string().optional(),
  attestation_date: z.string().optional(),
  attestation_source_identity_certificate: z.string().optional(),
  attestation_proxy_identity_certificate: z.string().optional(),
  attestation_proxy_signature: z.string().optional(),
  attestation_source_signature: z.string().optional(),
  validator_organization_id: GlobalIdSchema.optional(),
  validator_identity_certificate: z.string().optional(),
  validator_attestation_signature: z.string().optional()
});

const GlobalSubstanceSchema = z.object({
  substance_id: GlobalIdSchema.optional(),
  identifier: z.string().optional(),
  instance: z.union([z.boolean(), z.string(), z.number()]).optional(),
  status: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  code: z.object({
    code: z.string().optional(),
    code_system: z.string().optional(),
    display: z.string().optional()
  }).optional(),
  description: z.string().optional(),
  expiry: z.string().optional(),
  quantity_value: GlobalNumberSchema.optional(),
  quantity_unit: z.string().optional(),
  ingredient_substance: z.string().optional(),
  ingredient_substance_system: z.string().optional(),
  ingredient_substance_display: z.string().optional(),
  ingredient_quantity_numerator_value: GlobalNumberSchema.optional(),
  ingredient_quantity_numerator_unit: z.string().optional(),
  ingredient_quantity_denominator_value: GlobalNumberSchema.optional(),
  ingredient_quantity_denominator_unit: z.string().optional()
});

const GlobalSpecimenSchema = z.object({
  specimen_id: GlobalIdSchema.optional(),
  accession_identifier: z.string().optional(),
  status: z.string().optional(),
  type: z.string().optional(),
  subject_id: GlobalIdSchema.optional(),
  received_time: z.string().optional(),
  parent_ids: z.union([z.string(), z.array(z.string())]).optional(),
  request_ids: z.union([z.string(), z.array(z.string())]).optional(),
  combined: z.string().optional(),
  role: z.union([z.string(), z.array(z.string())]).optional(),
  feature_type: z.string().optional(),
  feature_description: z.string().optional(),
  collection_collector_id: GlobalIdSchema.optional(),
  collection_collected_date: z.string().optional(),
  collection_collected_start: z.string().optional(),
  collection_collected_end: z.string().optional(),
  collection_duration_value: GlobalNumberSchema.optional(),
  collection_duration_unit: z.string().optional(),
  collection_quantity_value: GlobalNumberSchema.optional(),
  collection_quantity_unit: z.string().optional(),
  collection_method: z.string().optional(),
  collection_device_id: GlobalIdSchema.optional(),
  collection_procedure_id: GlobalIdSchema.optional(),
  collection_body_site: z.string().optional(),
  collection_fasting_status: z.string().optional(),
  collection_fasting_duration_value: GlobalNumberSchema.optional(),
  collection_fasting_duration_unit: z.string().optional(),
  processing_description: z.string().optional(),
  processing_method: z.string().optional(),
  processing_additive_ids: z.union([z.string(), z.array(z.string())]).optional(),
  processing_time_date: z.string().optional(),
  processing_time_start: z.string().optional(),
  processing_time_end: z.string().optional(),
  container_device_id: GlobalIdSchema.optional(),
  container_location_id: GlobalIdSchema.optional(),
  container_quantity_value: GlobalNumberSchema.optional(),
  container_quantity_unit: z.string().optional(),
  condition: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalImagingStudySchema = z.object({
  imaging_study_id: GlobalIdSchema.optional(),
  imaging_study_identifier: GlobalIdSchema.optional(),
  status: z.string().optional(),
  modality: z.union([z.string(), z.array(z.string())]).optional(),
  subject_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  started: z.string().optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  part_of_ids: z.union([z.string(), z.array(z.string())]).optional(),
  referrer_id: GlobalIdSchema.optional(),
  endpoint_ids: z.union([z.string(), z.array(z.string())]).optional(),
  number_of_series: GlobalNumberSchema.optional(),
  number_of_instances: GlobalNumberSchema.optional(),
  procedure: z.union([z.string(), z.array(z.string())]).optional(),
  location_id: GlobalIdSchema.optional(),
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  description: z.string().optional(),
  series_uid: z.string().optional(),
  series_number: GlobalNumberSchema.optional(),
  series_modality: z.string().optional(),
  series_description: z.string().optional(),
  series_number_of_instances: GlobalNumberSchema.optional(),
  series_endpoint_ids: z.union([z.string(), z.array(z.string())]).optional(),
  series_body_site: z.string().optional(),
  series_laterality: z.string().optional(),
  series_specimen_ids: z.union([z.string(), z.array(z.string())]).optional(),
  series_started: z.string().optional(),
  series_performer_id: GlobalIdSchema.optional(),
  instance_uid: z.string().optional(),
  instance_sop_class: z.string().optional(),
  instance_number: GlobalNumberSchema.optional(),
  instance_title: z.string().optional()
});

const GlobalAllergyIntoleranceSchema = z.object({
  allergy_id: GlobalIdSchema.optional(),
  clinical_status: z.string().optional(),
  verification_status: z.string().optional(),
  type: z.string().optional(),
  category: z.union([z.string(), z.array(z.string())]).optional(),
  criticality: z.string().optional(),
  code: z.object({
    code: z.string().optional(),
    code_system: z.string().optional(),
    display: z.string().optional()
  }).optional(),
  patient_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  onset_date: z.string().optional(),
  onset_start: z.string().optional(),
  onset_end: z.string().optional(),
  onset_text: z.string().optional(),
  recorded_date: z.string().optional(),
  participant_actor_id: GlobalIdSchema.optional(),
  participant_function: z.string().optional(),
  last_occurrence: z.string().optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  reaction_substance: z.string().optional(),
  reaction_manifestation: z.union([z.string(), z.array(z.string())]).optional(),
  reaction_description: z.string().optional(),
  reaction_onset: z.string().optional(),
  reaction_severity: z.string().optional(),
  reaction_exposure_route: z.string().optional(),
  reaction_note: z.union([z.string(), z.array(z.string())]).optional()
});

const GlobalImmunizationSchema = z.object({
  immunization_id: GlobalIdSchema.optional(),
  status: z.string().optional(),
  status_reason: z.string().optional(),
  based_on_ids: z.union([z.string(), z.array(z.string())]).optional(),
  vaccine_code: z.object({
    code: z.string().optional(),
    code_system: z.string().optional(),
    display: z.string().optional()
  }).optional(),
  administered_product_id: GlobalIdSchema.optional(),
  manufacturer_id: GlobalIdSchema.optional(),
  lot_number: z.string().optional(),
  expiration_date: z.string().optional(),
  patient_id: GlobalIdSchema.optional(),
  encounter_id: GlobalIdSchema.optional(),
  supporting_info_ids: z.union([z.string(), z.array(z.string())]).optional(),
  occurrence_date: z.string().optional(),
  occurrence_string: z.string().optional(),
  primary_source: z.boolean().optional(),
  information_source_id: GlobalIdSchema.optional(),
  location_id: GlobalIdSchema.optional(),
  site: z.string().optional(),
  route: z.string().optional(),
  dose_value: GlobalNumberSchema.optional(),
  dose_unit: z.string().optional(),
  performer_actor_id: GlobalIdSchema.optional(),
  performer_function: z.string().optional(),
  note: z.union([z.string(), z.array(z.string())]).optional(),
  reason: z.union([z.string(), z.array(z.string())]).optional(),
  is_subpotent: z.boolean().optional(),
  subpotent_reason: z.union([z.string(), z.array(z.string())]).optional(),
  program_eligibility_program: z.string().optional(),
  program_eligibility_status: z.string().optional(),
  funding_source: z.string().optional(),
  reaction_date: z.string().optional(),
  reaction_manifestation: z.string().optional(),
  reaction_reported: z.boolean().optional(),
  protocol_series: z.string().optional(),
  protocol_authority_id: GlobalIdSchema.optional(),
  protocol_target_disease: z.string().optional(),
  protocol_dose_number: z.string().optional(),
  protocol_series_doses: z.string().optional()
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

const GlobalCustomJSONSchema: z.ZodTypeAny = z.object({
  operation: z.enum(['create', 'update', 'delete']).optional(),
  messageType: z.string().optional(),
  patient: z.union([GlobalPatientSchema, z.array(GlobalPatientSchema)]).optional(),
  encounter: z.union([GlobalEncounterSchema, z.array(GlobalEncounterSchema)]).optional(),
  medication: z.union([GlobalMedicationSchema, z.array(GlobalMedicationSchema)]).optional(),
  medication_knowledge: z.union([GlobalMedicationKnowledgeSchema, z.array(GlobalMedicationKnowledgeSchema)]).optional(),
  medication_request: z.union([GlobalMedicationRequestSchema, z.array(GlobalMedicationRequestSchema)]).optional(),
  medication_statement: z.union([GlobalMedicationStatementSchema, z.array(GlobalMedicationStatementSchema)]).optional(),
  medication_administration: z.union([GlobalMedicationAdministrationSchema, z.array(GlobalMedicationAdministrationSchema)]).optional(),
  medication_dispense: z.union([GlobalMedicationDispenseSchema, z.array(GlobalMedicationDispenseSchema)]).optional(),
  organization_affiliation: z.union([GlobalOrganizationAffiliationSchema, z.array(GlobalOrganizationAffiliationSchema)]).optional(),
  device_dispense: z.union([GlobalDeviceDispenseSchema, z.array(GlobalDeviceDispenseSchema)]).optional(),
  device_request: z.union([GlobalDeviceRequestSchema, z.array(GlobalDeviceRequestSchema)]).optional(),
  device_usage: z.union([GlobalDeviceUsageSchema, z.array(GlobalDeviceUsageSchema)]).optional(),
  encounter_history: z.union([GlobalEncounterHistorySchema, z.array(GlobalEncounterHistorySchema)]).optional(),
  flag: z.union([GlobalFlagSchema, z.array(GlobalFlagSchema)]).optional(),
  observation: z.union([GlobalObservationSchema, z.array(GlobalObservationSchema)]).optional(),
  observations: z.union([GlobalObservationSchema, z.array(GlobalObservationSchema)]).optional(),
  list: z.union([GlobalListSchema, z.array(GlobalListSchema)]).optional(),
  group: z.union([GlobalGroupSchema, z.array(GlobalGroupSchema)]).optional(),
  healthcare_service: z.union([GlobalHealthcareServiceSchema, z.array(GlobalHealthcareServiceSchema)]).optional(),
  insurance_plan: z.union([GlobalInsurancePlanSchema, z.array(GlobalInsurancePlanSchema)]).optional(),
  nutrition_intake: z.union([GlobalNutritionIntakeSchema, z.array(GlobalNutritionIntakeSchema)]).optional(),
  nutrition_order: z.union([GlobalNutritionOrderSchema, z.array(GlobalNutritionOrderSchema)]).optional(),
  risk_assessment: z.union([GlobalRiskAssessmentSchema, z.array(GlobalRiskAssessmentSchema)]).optional(),
  capability_statement: z.union([GlobalCapabilityStatementSchema, z.array(GlobalCapabilityStatementSchema)]).optional(),
  operation_outcome: z.union([GlobalOperationOutcomeSchema, z.array(GlobalOperationOutcomeSchema)]).optional(),
  parameters: z.union([GlobalParametersSchema, z.array(GlobalParametersSchema)]).optional(),
  care_plan: z.union([GlobalCarePlanSchema, z.array(GlobalCarePlanSchema)]).optional(),
  care_team: z.union([GlobalCareTeamSchema, z.array(GlobalCareTeamSchema)]).optional(),
  goal: z.union([GlobalGoalSchema, z.array(GlobalGoalSchema)]).optional(),
  service_request: z.union([GlobalServiceRequestSchema, z.array(GlobalServiceRequestSchema)]).optional(),
  task: z.union([GlobalTaskSchema, z.array(GlobalTaskSchema)]).optional(),
  communication: z.union([GlobalCommunicationSchema, z.array(GlobalCommunicationSchema)]).optional(),
  communication_request: z.union([GlobalCommunicationRequestSchema, z.array(GlobalCommunicationRequestSchema)]).optional(),
  questionnaire: z.union([GlobalQuestionnaireSchema, z.array(GlobalQuestionnaireSchema)]).optional(),
  questionnaire_response: z.union([GlobalQuestionnaireResponseSchema, z.array(GlobalQuestionnaireResponseSchema)]).optional(),
  code_system: z.union([GlobalCodeSystemSchema, z.array(GlobalCodeSystemSchema)]).optional(),
  value_set: z.union([GlobalValueSetSchema, z.array(GlobalValueSetSchema)]).optional(),
  concept_map: z.union([GlobalConceptMapSchema, z.array(GlobalConceptMapSchema)]).optional(),
  naming_system: z.union([GlobalNamingSystemSchema, z.array(GlobalNamingSystemSchema)]).optional(),
  terminology_capabilities: z.union([GlobalTerminologyCapabilitiesSchema, z.array(GlobalTerminologyCapabilitiesSchema)]).optional(),
  provenance: z.union([GlobalProvenanceSchema, z.array(GlobalProvenanceSchema)]).optional(),
  audit_event: z.union([GlobalAuditEventSchema, z.array(GlobalAuditEventSchema)]).optional(),
  consent: z.union([GlobalConsentSchema, z.array(GlobalConsentSchema)]).optional(),
  procedure: z.union([GlobalProcedureSchema, z.array(GlobalProcedureSchema)]).optional(),
  condition: z.union([GlobalConditionSchema, z.array(GlobalConditionSchema)]).optional(),
  appointment: z.union([GlobalAppointmentSchema, z.array(GlobalAppointmentSchema)]).optional(),
  appointment_response: z.union([GlobalAppointmentResponseSchema, z.array(GlobalAppointmentResponseSchema)]).optional(),
  claim: z.union([GlobalClaimSchema, z.array(GlobalClaimSchema)]).optional(),
  claim_response: z.union([GlobalClaimResponseSchema, z.array(GlobalClaimResponseSchema)]).optional(),
  composition: z.union([GlobalCompositionSchema, z.array(GlobalCompositionSchema)]).optional(),
  explanation_of_benefit: z.union([GlobalExplanationOfBenefitSchema, z.array(GlobalExplanationOfBenefitSchema)]).optional(),
  coverage: z.union([GlobalCoverageSchema, z.array(GlobalCoverageSchema)]).optional(),
  account: z.union([GlobalAccountSchema, z.array(GlobalAccountSchema)]).optional(),
  charge_item: z.union([GlobalChargeItemSchema, z.array(GlobalChargeItemSchema)]).optional(),
  charge_item_definition: z.union([GlobalChargeItemDefinitionSchema, z.array(GlobalChargeItemDefinitionSchema)]).optional(),
  device: z.union([GlobalDeviceSchema, z.array(GlobalDeviceSchema)]).optional(),
  device_metric: z.union([GlobalDeviceMetricSchema, z.array(GlobalDeviceMetricSchema)]).optional(),
  endpoint: z.union([GlobalEndpointSchema, z.array(GlobalEndpointSchema)]).optional(),
  binary: z.union([GlobalBinarySchema, z.array(GlobalBinarySchema)]).optional(),
  schedule: z.union([GlobalScheduleSchema, z.array(GlobalScheduleSchema)]).optional(),
  slot: z.union([GlobalSlotSchema, z.array(GlobalSlotSchema)]).optional(),
  diagnostic_report: z.union([GlobalDiagnosticReportSchema, z.array(GlobalDiagnosticReportSchema)]).optional(),
  related_person: z.union([GlobalRelatedPersonSchema, z.array(GlobalRelatedPersonSchema)]).optional(),
  person: z.union([GlobalPersonSchema, z.array(GlobalPersonSchema)]).optional(),
  location: z.union([GlobalLocationSchema, z.array(GlobalLocationSchema)]).optional(),
  episode_of_care: z.union([GlobalEpisodeOfCareSchema, z.array(GlobalEpisodeOfCareSchema)]).optional(),
  verification_result: z.union([GlobalVerificationResultSchema, z.array(GlobalVerificationResultSchema)]).optional(),
  substance: z.union([GlobalSubstanceSchema, z.array(GlobalSubstanceSchema)]).optional(),
  specimen: z.union([GlobalSpecimenSchema, z.array(GlobalSpecimenSchema)]).optional(),
  imaging_study: z.union([GlobalImagingStudySchema, z.array(GlobalImagingStudySchema)]).optional(),
  allergy_intolerance: z.union([GlobalAllergyIntoleranceSchema, z.array(GlobalAllergyIntoleranceSchema)]).optional(),
  immunization: z.union([GlobalImmunizationSchema, z.array(GlobalImmunizationSchema)]).optional(),
  practitioner: z.union([GlobalPractitionerSchema, z.array(GlobalPractitionerSchema)]).optional(),
  practitioner_role: z.union([GlobalPractitionerRoleSchema, z.array(GlobalPractitionerRoleSchema)]).optional(),
  organization: z.union([GlobalOrganizationSchema, z.array(GlobalOrganizationSchema)]).optional()
}).refine((value) => {
  return Boolean(
    value.patient ||
    value.encounter ||
    value.medication ||
    value.medication_knowledge ||
    value.medication_request ||
    value.medication_statement ||
    value.medication_administration ||
    value.medication_dispense ||
    value.device_dispense ||
    value.device_request ||
    value.device_usage ||
    value.encounter_history ||
    value.flag ||
    value.observation ||
    value.observations ||
    value.list ||
    value.group ||
    value.healthcare_service ||
    value.nutrition_intake ||
    value.nutrition_order ||
    value.risk_assessment ||
    value.capability_statement ||
    value.operation_outcome ||
    value.parameters ||
    value.care_plan ||
    value.care_team ||
    value.goal ||
    value.service_request ||
    value.task ||
    value.communication ||
    value.communication_request ||
    value.questionnaire ||
    value.questionnaire_response ||
    value.code_system ||
    value.value_set ||
    value.concept_map ||
    value.naming_system ||
    value.terminology_capabilities ||
    value.provenance ||
    value.audit_event ||
    value.consent ||
    value.procedure ||
    value.condition ||
    value.appointment ||
    value.appointment_response ||
    value.claim ||
    value.claim_response ||
    value.composition ||
    value.explanation_of_benefit ||
    value.coverage ||
    value.insurance_plan ||
    value.account ||
    value.charge_item ||
    value.charge_item_definition ||
    value.device ||
    value.device_metric ||
    value.endpoint ||
    value.binary ||
    value.schedule ||
    value.slot ||
    value.diagnostic_report ||
    value.related_person ||
    value.person ||
    value.location ||
    value.episode_of_care ||
    value.verification_result ||
    value.substance ||
    value.specimen ||
    value.imaging_study ||
    value.allergy_intolerance ||
    value.immunization ||
    value.practitioner ||
    value.practitioner_role ||
    value.organization
  );
}, {
  message: 'At least one resource section is required (patient, encounter, observation, medication, medication_knowledge, medication_request, medication_statement, medication_administration, medication_dispense, organization_affiliation, device_dispense, device_request, device_usage, encounter_history, flag, list, group, healthcare_service, nutrition_intake, nutrition_order, risk_assessment, capability_statement, operation_outcome, parameters, care_plan, care_team, goal, service_request, task, communication, communication_request, questionnaire, questionnaire_response, code_system, value_set, concept_map, naming_system, terminology_capabilities, provenance, audit_event, consent, procedure, condition, appointment, appointment_response, claim, claim_response, composition, explanation_of_benefit, coverage, insurance_plan, account, charge_item, charge_item_definition, device, device_metric, endpoint, schedule, slot, diagnostic_report, related_person, person, location, episode_of_care, verification_result, substance, specimen, imaging_study, allergy_intolerance, immunization, practitioner, practitioner_role, organization).',
  path: []
});

export type GlobalJSONInput = z.infer<typeof GlobalCustomJSONSchema>;

const TABULAR_HEADER_SET = new Set(
  Object.values(HEADER_ALIAS_SECTIONS).flatMap(section => [
    ...Object.keys(section),
    ...Object.values(section).flat()
  ]).map(key => normalizeHeader(key))
);

const FLAT_KNOWN_KEYS = new Set(
  Object.values(HEADER_ALIAS_SECTIONS)
    .flatMap(section => [...Object.keys(section), ...Object.values(section).flat()])
    .map(key => normalizeAliasKey(key))
);

const SECTION_NAME_MAP: Record<string, keyof typeof HEADER_ALIAS_SECTIONS> = {
  patient: 'patient',
  encounter: 'encounter',
  observation: 'observation',
  observations: 'observation',
  medications: 'medication',
  medicationKnowledge: 'medicationKnowledge',
  medicationKnowledges: 'medicationKnowledge',
  medicationRequests: 'medicationRequest',
  medicationStatements: 'medicationStatement',
  medicationAdministrations: 'medicationAdministration',
  medicationDispenses: 'medicationDispense',
  organizationAffiliations: 'organizationAffiliation',
  deviceDispenses: 'deviceDispense',
  deviceRequests: 'deviceRequest',
  deviceUsages: 'deviceUsage',
  encounterHistories: 'encounterHistory',
  flags: 'flag',
  lists: 'list',
  groups: 'group',
  healthcareServices: 'healthcareService',
  insurancePlan: 'insurancePlan',
  insurancePlans: 'insurancePlan',
  nutritionIntakes: 'nutritionIntake',
  nutritionOrders: 'nutritionOrder',
  riskAssessments: 'riskAssessment',
  capabilityStatements: 'capabilityStatement',
  operationOutcomes: 'operationOutcome',
  parameters: 'parameters',
  carePlans: 'carePlan',
  careTeams: 'careTeam',
  goals: 'goal',
  serviceRequests: 'serviceRequest',
  tasks: 'task',
  communications: 'communication',
  communicationRequests: 'communicationRequest',
  questionnaires: 'questionnaire',
  questionnaireResponses: 'questionnaireResponse',
  codeSystems: 'codeSystem',
  valueSets: 'valueSet',
  conceptMaps: 'conceptMap',
  namingSystems: 'namingSystem',
  terminologyCapabilities: 'terminologyCapabilities',
  provenances: 'provenance',
  auditEvents: 'auditEvent',
  consents: 'consent',
  procedures: 'procedure',
  conditions: 'condition',
  appointments: 'appointment',
  appointmentResponses: 'appointmentResponse',
  claims: 'claim',
  claimResponses: 'claimResponse',
  compositions: 'composition',
  explanationOfBenefits: 'explanationOfBenefit',
  coverages: 'coverage',
  accounts: 'account',
  chargeItems: 'chargeItem',
  chargeItemDefinitions: 'chargeItemDefinition',
  devices: 'device',
  deviceMetrics: 'deviceMetric',
  endpoint: 'endpoint',
  endpoints: 'endpoint',
  binaries: 'binary',
  schedules: 'schedule',
  slots: 'slot',
  diagnosticReports: 'diagnosticReport',
  relatedPersons: 'relatedPerson',
  persons: 'person',
  locations: 'location',
  episodesOfCare: 'episodeOfCare',
  verificationResults: 'verificationResult',
  substances: 'substance',
  specimens: 'specimen',
  imagingStudies: 'imagingStudy',
  allergyIntolerances: 'allergyIntolerance',
  immunizations: 'immunization',
  practitioners: 'practitioner',
  practitionerRoles: 'practitionerRole',
  organizations: 'organization',
  documentReferences: 'documentReference'
};

const SECTION_KEY_ALIASES: Record<string, keyof typeof HEADER_ALIAS_SECTIONS> = {
  ...SECTION_NAME_MAP,
  doctor: 'practitioner',
  doctors: 'practitioner',
  hospital: 'organization',
  hospitals: 'organization',
  medication_knowledge: 'medicationKnowledge',
  medication_knowledges: 'medicationKnowledge',
  medicationknowledge: 'medicationKnowledge',
  medicationknowledges: 'medicationKnowledge',
  medication_request: 'medicationRequest',
  medication_requests: 'medicationRequest',
  medication_statement: 'medicationStatement',
  medication_statements: 'medicationStatement',
  medication_administration: 'medicationAdministration',
  medication_administrations: 'medicationAdministration',
  medication_dispense: 'medicationDispense',
  medication_dispenses: 'medicationDispense',
  medicationdispense: 'medicationDispense',
  medicationdispenses: 'medicationDispense',
  organization_affiliation: 'organizationAffiliation',
  organization_affiliations: 'organizationAffiliation',
  organizationaffiliation: 'organizationAffiliation',
  organizationaffiliations: 'organizationAffiliation',
  device_dispense: 'deviceDispense',
  device_dispenses: 'deviceDispense',
  devicedispense: 'deviceDispense',
  devicedispenses: 'deviceDispense',
  device_request: 'deviceRequest',
  device_requests: 'deviceRequest',
  devicerequest: 'deviceRequest',
  devicerequests: 'deviceRequest',
  device_usage: 'deviceUsage',
  device_usages: 'deviceUsage',
  deviceusage: 'deviceUsage',
  deviceusages: 'deviceUsage',
  encounter_history: 'encounterHistory',
  encounter_histories: 'encounterHistory',
  encounterhistory: 'encounterHistory',
  insurance_plan: 'insurancePlan',
  insurance_plans: 'insurancePlan',
  encounterhistories: 'encounterHistory',
  flag: 'flag',
  flags: 'flag',
  list: 'list',
  lists: 'list',
  nutrition_intake: 'nutritionIntake',
  nutrition_intakes: 'nutritionIntake',
  nutritionintake: 'nutritionIntake',
  nutritionintakes: 'nutritionIntake',
  nutrition_order: 'nutritionOrder',
  nutrition_orders: 'nutritionOrder',
  nutritionorder: 'nutritionOrder',
  nutritionorders: 'nutritionOrder',
  risk_assessment: 'riskAssessment',
  risk_assessments: 'riskAssessment',
  riskassessment: 'riskAssessment',
  riskassessments: 'riskAssessment',
  capability_statement: 'capabilityStatement',
  capability_statements: 'capabilityStatement',
  operation_outcome: 'operationOutcome',
  operation_outcomes: 'operationOutcome',
  parameters: 'parameters',
  care_plan: 'carePlan',
  care_plans: 'carePlan',
  care_team: 'careTeam',
  care_teams: 'careTeam',
  goal: 'goal',
  goals: 'goal',
  service_request: 'serviceRequest',
  service_requests: 'serviceRequest',
  task: 'task',
  tasks: 'task',
  communication: 'communication',
  communications: 'communication',
  communication_request: 'communicationRequest',
  communication_requests: 'communicationRequest',
  questionnaire: 'questionnaire',
  questionnaires: 'questionnaire',
  questionnaire_response: 'questionnaireResponse',
  questionnaire_responses: 'questionnaireResponse',
  code_system: 'codeSystem',
  code_systems: 'codeSystem',
  value_set: 'valueSet',
  value_sets: 'valueSet',
  concept_map: 'conceptMap',
  concept_maps: 'conceptMap',
  naming_system: 'namingSystem',
  naming_systems: 'namingSystem',
  terminology_capabilities: 'terminologyCapabilities',
  terminology_capability: 'terminologyCapabilities',
  provenance: 'provenance',
  provenances: 'provenance',
  audit_event: 'auditEvent',
  audit_events: 'auditEvent',
  consent: 'consent',
  consents: 'consent',
  procedure: 'procedure',
  procedures: 'procedure',
  condition: 'condition',
  conditions: 'condition',
  appointment: 'appointment',
  appointments: 'appointment',
  appointment_response: 'appointmentResponse',
  appointment_responses: 'appointmentResponse',
  appointmentresponse: 'appointmentResponse',
  appointmentresponses: 'appointmentResponse',
  claim: 'claim',
  claims: 'claim',
  claim_response: 'claimResponse',
  claim_responses: 'claimResponse',
  claimresponse: 'claimResponse',
  claimresponses: 'claimResponse',
  composition: 'composition',
  compositions: 'composition',
  explanation_of_benefit: 'explanationOfBenefit',
  explanation_of_benefits: 'explanationOfBenefit',
  explanationofbenefit: 'explanationOfBenefit',
  explanationofbenefits: 'explanationOfBenefit',
  coverage: 'coverage',
  coverages: 'coverage',
  account: 'account',
  accounts: 'account',
  charge_item: 'chargeItem',
  charge_items: 'chargeItem',
  chargeitem: 'chargeItem',
  chargeitems: 'chargeItem',
  charge_item_definition: 'chargeItemDefinition',
  charge_item_definitions: 'chargeItemDefinition',
  chargeitemdefinition: 'chargeItemDefinition',
  chargeitemdefinitions: 'chargeItemDefinition',
  device: 'device',
  devices: 'device',
  device_metric: 'deviceMetric',
  device_metrics: 'deviceMetric',
  devicemetric: 'deviceMetric',
  devicemetrics: 'deviceMetric',
  endpoint: 'endpoint',
  endpoints: 'endpoint',
  binary: 'binary',
  binaries: 'binary',
  schedule: 'schedule',
  schedules: 'schedule',
  slot: 'slot',
  slots: 'slot',
  diagnostic_report: 'diagnosticReport',
  diagnostic_reports: 'diagnosticReport',
  related_person: 'relatedPerson',
  related_persons: 'relatedPerson',
  person: 'person',
  persons: 'person',
  location: 'location',
  locations: 'location',
  episode_of_care: 'episodeOfCare',
  episode_of_cares: 'episodeOfCare',
  verification_result: 'verificationResult',
  verification_results: 'verificationResult',
  substance: 'substance',
  substances: 'substance',
  specimen: 'specimen',
  specimens: 'specimen',
  imaging_study: 'imagingStudy',
  imaging_studies: 'imagingStudy',
  allergy_intolerance: 'allergyIntolerance',
  allergy_intolerances: 'allergyIntolerance',
  immunization: 'immunization',
  immunizations: 'immunization',
  practitioner_role: 'practitionerRole',
  practitioner_roles: 'practitionerRole',
  document_reference: 'documentReference',
  document_references: 'documentReference'
};

Object.keys(SECTION_KEY_ALIASES).forEach(key => {
  FLAT_KNOWN_KEYS.add(normalizeAliasKey(key));
});

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
  doctor: 'practitioner',
  doctors: 'practitioner',
  hospital: 'organization',
  hospitals: 'organization',
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
  medication_administration: 'medication_administration',
  medication_administrations: 'medication_administration',
  medicationadministration: 'medication_administration',
  medicationadministrations: 'medication_administration',
  medication_dispense: 'medication_dispense',
  medication_dispenses: 'medication_dispense',
  medicationdispense: 'medication_dispense',
  medicationdispenses: 'medication_dispense',
  organization_affiliation: 'organization_affiliation',
  organization_affiliations: 'organization_affiliation',
  organizationaffiliation: 'organization_affiliation',
  organizationaffiliations: 'organization_affiliation',
  device_dispense: 'device_dispense',
  device_dispenses: 'device_dispense',
  devicedispense: 'device_dispense',
  devicedispenses: 'device_dispense',
  nutrition_order: 'nutrition_order',
  nutrition_orders: 'nutrition_order',
  nutritionorder: 'nutrition_order',
  nutritionorders: 'nutrition_order',
  risk_assessment: 'risk_assessment',
  risk_assessments: 'risk_assessment',
  riskassessment: 'risk_assessment',
  riskassessments: 'risk_assessment',
  capability_statement: 'capability_statement',
  capability_statements: 'capability_statement',
  capabilitystatement: 'capability_statement',
  capabilitystatements: 'capability_statement',
  operation_outcome: 'operation_outcome',
  operation_outcomes: 'operation_outcome',
  operationoutcome: 'operation_outcome',
  operationoutcomes: 'operation_outcome',
  parameters: 'parameters',
  care_plan: 'care_plan',
  care_plans: 'care_plan',
  careplan: 'care_plan',
  careplans: 'care_plan',
  care_team: 'care_team',
  care_teams: 'care_team',
  careteam: 'care_team',
  careteams: 'care_team',
  goal: 'goal',
  goals: 'goal',
  service_request: 'service_request',
  service_requests: 'service_request',
  servicerequest: 'service_request',
  servicerequests: 'service_request',
  task: 'task',
  tasks: 'task',
  communication: 'communication',
  communications: 'communication',
  communication_request: 'communication_request',
  communication_requests: 'communication_request',
  communicationrequest: 'communication_request',
  communicationrequests: 'communication_request',
  questionnaire: 'questionnaire',
  questionnaires: 'questionnaire',
  questionnaire_response: 'questionnaire_response',
  questionnaire_responses: 'questionnaire_response',
  questionnaireresponse: 'questionnaire_response',
  questionnaireresponses: 'questionnaire_response',
  code_system: 'code_system',
  code_systems: 'code_system',
  codesystem: 'code_system',
  codesystems: 'code_system',
  value_set: 'value_set',
  value_sets: 'value_set',
  valueset: 'value_set',
  valuesets: 'value_set',
  concept_map: 'concept_map',
  concept_maps: 'concept_map',
  conceptmap: 'concept_map',
  conceptmaps: 'concept_map',
  naming_system: 'naming_system',
  naming_systems: 'naming_system',
  namingsystem: 'naming_system',
  namingsystems: 'naming_system',
  terminology_capabilities: 'terminology_capabilities',
  terminology_capability: 'terminology_capabilities',
  terminologycapabilities: 'terminology_capabilities',
  terminologycapability: 'terminology_capabilities',
  provenance: 'provenance',
  provenances: 'provenance',
  audit_event: 'audit_event',
  audit_events: 'audit_event',
  auditevent: 'audit_event',
  auditevents: 'audit_event',
  consent: 'consent',
  consents: 'consent',
  procedure: 'procedure',
  procedures: 'procedure',
  condition: 'condition',
  conditions: 'condition',
  appointment: 'appointment',
  appointments: 'appointment',
  appointment_response: 'appointment_response',
  appointment_responses: 'appointment_response',
  appointmentresponse: 'appointment_response',
  appointmentresponses: 'appointment_response',
  claim: 'claim',
  claims: 'claim',
  claim_response: 'claim_response',
  claim_responses: 'claim_response',
  claimresponse: 'claim_response',
  claimresponses: 'claim_response',
  composition: 'composition',
  compositions: 'composition',
  explanation_of_benefit: 'explanation_of_benefit',
  explanation_of_benefits: 'explanation_of_benefit',
  explanationofbenefit: 'explanation_of_benefit',
  explanationofbenefits: 'explanation_of_benefit',
  coverage: 'coverage',
  coverages: 'coverage',
  account: 'account',
  accounts: 'account',
  charge_item: 'charge_item',
  charge_items: 'charge_item',
  chargeitem: 'charge_item',
  chargeitems: 'charge_item',
  charge_item_definition: 'charge_item_definition',
  charge_item_definitions: 'charge_item_definition',
  chargeitemdefinition: 'charge_item_definition',
  chargeitemdefinitions: 'charge_item_definition',
  device: 'device',
  devices: 'device',
  device_metric: 'device_metric',
  device_metrics: 'device_metric',
  devicemetric: 'device_metric',
  devicemetrics: 'device_metric',
  endpoint: 'endpoint',
  endpoints: 'endpoint',
  binary: 'binary',
  binaries: 'binary',
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
  person: 'person',
  persons: 'person',
  person_id: 'person',
  personid: 'person',
  location: 'location',
  locations: 'location',
  episode_of_care: 'episode_of_care',
  episode_of_cares: 'episode_of_care',
  episodeofcare: 'episode_of_care',
  episodeofcares: 'episode_of_care',
  verification_result: 'verification_result',
  verification_results: 'verification_result',
  verificationresult: 'verification_result',
  verificationresults: 'verification_result',
  substance: 'substance',
  substances: 'substance',
  substance_id: 'substance',
  substanceid: 'substance',
  specimen: 'specimen',
  specimens: 'specimen',
  imaging_study: 'imaging_study',
  imaging_studies: 'imaging_study',
  imagingstudy: 'imaging_study',
  imagingstudies: 'imaging_study',
  allergy_intolerance: 'allergy_intolerance',
  allergy_intolerances: 'allergy_intolerance',
  allergyintolerance: 'allergy_intolerance',
  allergyintolerances: 'allergy_intolerance',
  immunization: 'immunization',
  immunizations: 'immunization',
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
    if (rawValue === null || rawValue === undefined) continue;
    const canonicalKey = GLOBAL_TOP_LEVEL_KEY_MAP[key] ?? key;
    remapped[canonicalKey] = rawValue;
  }
  return remapped;
}

const MESSAGE_TYPE_KEYS = new Set([
  'source_system',
  'source',
  'vendor',
  'system',
  'message_type',
  'messagetype'
]);

function isNonEmptyValue(value: unknown) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function extractLeftoverFromRecord(record: Record<string, unknown>) {
  const leftover: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (FLAT_KNOWN_KEYS.has(normalizeAliasKey(key))) continue;
    if (!isNonEmptyValue(value)) continue;
    leftover[key] = value;
  }
  return leftover;
}

function extractFlatLeftoverPayload(payload: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(payload)) {
    const rows = payload
      .map(item => (isPlainRecord(item) ? extractLeftoverFromRecord(item) : {}))
      .filter(row => Object.keys(row).length > 0);
    if (rows.length === 0) return undefined;
    return rows.length === 1 ? rows[0] : { rows };
  }

  if (isPlainRecord(payload)) {
    if (Array.isArray(payload.rows)) {
      const rows = payload.rows
        .filter(isPlainRecord)
        .map(row => extractLeftoverFromRecord(row))
        .filter(row => Object.keys(row).length > 0);
      if (rows.length === 0) return undefined;
      return rows.length === 1 ? rows[0] : { rows };
    }
    const leftover = extractLeftoverFromRecord(payload);
    return Object.keys(leftover).length > 0 ? leftover : undefined;
  }

  return undefined;
}

function buildLeftoverSourcePayloads(canonical: CanonicalModel, leftover: Record<string, unknown>) {
  const payloads: Record<string, unknown> = {};

  const addPayload = (resourceType: string, id?: string) => {
    if (id) {
      payloads[`${resourceType}:${id}`] = leftover;
    } else {
      payloads[`${resourceType}:*`] = leftover;
    }
  };

  if (canonical.appointments?.length) {
    const appt = canonical.appointments[0];
    addPayload('Appointment', appt.identifier || appt.id);
    return payloads;
  }
  if (canonical.encounter) {
    addPayload('Encounter', canonical.encounter.id);
    return payloads;
  }
  if (canonical.patient) {
    addPayload('Patient', canonical.patient.identifier || canonical.patient.id);
    return payloads;
  }
  if (canonical.observations?.length) {
    addPayload('Observation', canonical.observations[0]?.setId as string | undefined);
    return payloads;
  }

  return Object.keys(payloads).length > 0 ? payloads : undefined;
}

function resolveMessageType(payload: unknown): string | undefined {
  const readFromRecord = (record: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(record)) {
      if (!MESSAGE_TYPE_KEYS.has(normalizeAliasKey(key))) continue;
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
    return undefined;
  };

  if (isPlainRecord(payload)) return readFromRecord(payload);
  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (!isPlainRecord(item)) continue;
      const candidate = readFromRecord(item);
      if (candidate) return candidate;
    }
  }

  return undefined;
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
  const directPatientId = normalizeAliasValue(
    (value as Record<string, unknown>)._id ??
    (value as Record<string, unknown>).masterProfileId ??
    (value as Record<string, unknown>).master_profile_id
  );
  if (directPatientId && normalized.patient_id === undefined) {
    normalized.patient_id = directPatientId;
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

  const countryCode = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_country'));
  if (countryCode && normalized.country_code === undefined) normalized.country_code = countryCode;

  const patientType = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_type'));
  if (patientType && normalized.patient_type === undefined) normalized.patient_type = patientType;

  const photo = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_photo'));
  if (photo && normalized.photo === undefined) normalized.photo = photo;

  const age = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_age'));
  if (age && normalized.age === undefined) normalized.age = age;

  const weight = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_weight'));
  if (weight && normalized.weight === undefined) normalized.weight = weight;

  const weightUnit = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_weight_unit'));
  if (weightUnit && normalized.weight_unit === undefined) normalized.weight_unit = weightUnit;

  const height = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_height'));
  if (height && normalized.height === undefined) normalized.height = height;

  const heightUnit = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_height_unit'));
  if (heightUnit && normalized.height_unit === undefined) normalized.height_unit = heightUnit;

  const heightTaken = readSectionAliasValue(value, 'patient', 'patient_height_taken');
  if (heightTaken !== undefined && normalized.height_taken === undefined) normalized.height_taken = heightTaken;

  const bloodGroup = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_blood_group'));
  if (bloodGroup && normalized.blood_group === undefined) normalized.blood_group = bloodGroup;

  const maritalStatus = normalizeAliasValue(readSectionAliasValue(value, 'patient', 'patient_marital_status'));
  if (maritalStatus && normalized.marital_status === undefined) normalized.marital_status = maritalStatus;

  const deceasedBoolean = readSectionAliasValue(value, 'patient', 'patient_deceased_boolean');
  if (deceasedBoolean !== undefined && normalized.deceased_boolean === undefined) normalized.deceased_boolean = deceasedBoolean;

  const isPregnant = readSectionAliasValue(value, 'patient', 'patient_is_pregnant');
  if (isPregnant !== undefined && normalized.is_pregnant === undefined) normalized.is_pregnant = isPregnant;

  const isDiabetic = readSectionAliasValue(value, 'patient', 'patient_is_diabetic');
  if (isDiabetic !== undefined && normalized.is_diabetic === undefined) normalized.is_diabetic = isDiabetic;

  const isHypertension = readSectionAliasValue(value, 'patient', 'patient_is_hypertension');
  if (isHypertension !== undefined && normalized.is_hypertension === undefined) normalized.is_hypertension = isHypertension;

  if (Object.keys(name).length > 0) normalized.name = name;
  if (Object.keys(address).length > 0) {
    contactInfo.address = address;
  }
  if (Object.keys(contactInfo).length > 0) normalized.contact_info = contactInfo;

  // Sanitize common null/boolean edge-cases so strict global schema accepts payloads.
  if (normalized.patient_type === null) normalized.patient_type = undefined;
  if (normalized.photo === null) normalized.photo = undefined;
  if (normalized.age === null) normalized.age = undefined;
  if (normalized.weight === null) normalized.weight = undefined;
  if (normalized.height === null) normalized.height = undefined;
  if (normalized.marital_status !== undefined && typeof normalized.marital_status !== 'string') {
    normalized.marital_status = undefined;
  }

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

function normalizeGlobalMedicationKnowledgeAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const medKnowledgeId = readSectionAliasValue(value, 'medicationKnowledge', 'medication_knowledge_id');
  if (normalized.medication_knowledge_id === undefined && medKnowledgeId !== undefined) {
    normalized.medication_knowledge_id = medKnowledgeId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'medicationKnowledge', 'medication_knowledge_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const code = normalizeAliasValue(readSectionAliasValue(value, 'medicationKnowledge', 'medication_knowledge_code'));
  if (code && normalized.code === undefined) {
    normalized.code = { code, display: code };
  }

  const name = normalizeAliasValue(readSectionAliasValue(value, 'medicationKnowledge', 'medication_knowledge_name'));
  if (name && normalized.name === undefined) {
    normalized.name = [name];
  }

  const authorId = normalizeAliasValue(readSectionAliasValue(value, 'medicationKnowledge', 'medication_knowledge_author_id'));
  if (authorId && normalized.author_id === undefined) normalized.author_id = authorId;

  const jurisdiction = normalizeAliasValue(readSectionAliasValue(value, 'medicationKnowledge', 'medication_knowledge_intended_jurisdiction'));
  if (jurisdiction && normalized.intended_jurisdiction === undefined) {
    normalized.intended_jurisdiction = [{ code: jurisdiction, display: jurisdiction }];
  }

  const associatedIds = normalizeAliasValue(readSectionAliasValue(value, 'medicationKnowledge', 'medication_knowledge_associated_medication_ids'));
  if (associatedIds && normalized.associated_medication_ids === undefined) normalized.associated_medication_ids = associatedIds;

  const productType = normalizeAliasValue(readSectionAliasValue(value, 'medicationKnowledge', 'medication_knowledge_product_type'));
  if (productType && normalized.product_type === undefined) {
    normalized.product_type = [{ code: productType, display: productType }];
  }

  const prepInstruction = normalizeAliasValue(readSectionAliasValue(value, 'medicationKnowledge', 'medication_knowledge_preparation_instruction'));
  if (prepInstruction && normalized.preparation_instruction === undefined) {
    normalized.preparation_instruction = prepInstruction;
  }

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

function normalizeGlobalMedicationAdministrationAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const adminId = readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_id');
  if (normalized.medication_administration_id === undefined && adminId !== undefined) {
    normalized.medication_administration_id = adminId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const statusReason = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_status_reason'));
  if (statusReason && normalized.status_reason === undefined) normalized.status_reason = statusReason;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_subject_id'));
  if (subjectId && normalized.patient_id === undefined) normalized.patient_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const occurrenceDate = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_occurrence_date'));
  if (occurrenceDate && normalized.occurrence_date === undefined) normalized.occurrence_date = occurrenceDate;

  const occurrenceStart = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_occurrence_start'));
  if (occurrenceStart && normalized.occurrence_start === undefined) normalized.occurrence_start = occurrenceStart;

  const occurrenceEnd = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_occurrence_end'));
  if (occurrenceEnd && normalized.occurrence_end === undefined) normalized.occurrence_end = occurrenceEnd;

  const recorded = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_recorded'));
  if (recorded && normalized.recorded === undefined) normalized.recorded = recorded;

  const isSubPotent = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_is_sub_potent'));
  if (isSubPotent && normalized.is_sub_potent === undefined) normalized.is_sub_potent = isSubPotent;

  const subPotentReason = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_sub_potent_reason'));
  if (subPotentReason && normalized.sub_potent_reason === undefined) normalized.sub_potent_reason = subPotentReason;

  const performerActorId = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_performer_actor_id'));
  if (performerActorId && normalized.performer_actor_id === undefined) normalized.performer_actor_id = performerActorId;

  const performerFunction = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_performer_function'));
  if (performerFunction && normalized.performer_function === undefined) normalized.performer_function = performerFunction;

  const reason = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_reason'));
  if (reason && normalized.reason === undefined) normalized.reason = reason;

  const requestId = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_request_id'));
  if (requestId && normalized.request_id === undefined) normalized.request_id = requestId;

  const deviceIds = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_device_ids'));
  if (deviceIds && normalized.device_ids === undefined) normalized.device_ids = deviceIds;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const partOfIds = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_part_of_ids'));
  if (partOfIds && normalized.part_of_ids === undefined) normalized.part_of_ids = partOfIds;

  const supportingInfoIds = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_supporting_info_ids'));
  if (supportingInfoIds && normalized.supporting_info_ids === undefined) normalized.supporting_info_ids = supportingInfoIds;

  const doseValue = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_dose_value'));
  if (doseValue && normalized.dose_value === undefined) normalized.dose_value = doseValue;

  const doseUnit = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_dose_unit'));
  if (doseUnit && normalized.dose_unit === undefined) normalized.dose_unit = doseUnit;

  const route = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_route'));
  if (route && normalized.route === undefined) normalized.route = route;

  const site = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_site'));
  if (site && normalized.site === undefined) normalized.site = site;

  const method = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_method'));
  if (method && normalized.method === undefined) normalized.method = method;

  const rateValue = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_rate_value'));
  if (rateValue && normalized.rate_value === undefined) normalized.rate_value = rateValue;

  const rateUnit = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_rate_unit'));
  if (rateUnit && normalized.rate_unit === undefined) normalized.rate_unit = rateUnit;

  const medCode = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_medication_code'));
  const medSystem = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_medication_code_system'));
  const medDisplay = normalizeAliasValue(readSectionAliasValue(value, 'medicationAdministration', 'medication_administration_medication_display'));
  if ((medCode || medDisplay) && normalized.medication === undefined) {
    normalized.medication = {
      medication_id: medCode,
      code_system: medSystem,
      name: medDisplay
    };
  }

  return normalized;
}

function normalizeGlobalMedicationDispenseAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const dispenseId = readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_id');
  if (normalized.medication_dispense_id === undefined && dispenseId !== undefined) {
    normalized.medication_dispense_id = dispenseId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const statusChanged = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_status_changed'));
  if (statusChanged && normalized.status_changed === undefined) normalized.status_changed = statusChanged;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_subject_id'));
  if (subjectId && normalized.patient_id === undefined) normalized.patient_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const location = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_location'));
  if (location && normalized.location === undefined) normalized.location = location;

  const quantityValue = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_quantity_value'));
  if (quantityValue && normalized.quantity_value === undefined) normalized.quantity_value = quantityValue;

  const quantityUnit = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_quantity_unit'));
  if (quantityUnit && normalized.quantity_unit === undefined) normalized.quantity_unit = quantityUnit;

  const daysSupplyValue = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_days_supply_value'));
  if (daysSupplyValue && normalized.days_supply_value === undefined) normalized.days_supply_value = daysSupplyValue;

  const daysSupplyUnit = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_days_supply_unit'));
  if (daysSupplyUnit && normalized.days_supply_unit === undefined) normalized.days_supply_unit = daysSupplyUnit;

  const recorded = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_recorded'));
  if (recorded && normalized.recorded === undefined) normalized.recorded = recorded;

  const whenPrepared = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_when_prepared'));
  if (whenPrepared && normalized.when_prepared === undefined) normalized.when_prepared = whenPrepared;

  const whenHandedOver = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_when_handed_over'));
  if (whenHandedOver && normalized.when_handed_over === undefined) normalized.when_handed_over = whenHandedOver;

  const destination = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_destination'));
  if (destination && normalized.destination === undefined) normalized.destination = destination;

  const authorizingPrescriptions = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_authorizing_prescription_ids'));
  if (authorizingPrescriptions && normalized.authorizing_prescription_ids === undefined) {
    normalized.authorizing_prescription_ids = authorizingPrescriptions;
  }

  const receiverIds = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_receiver_ids'));
  if (receiverIds && normalized.receiver_ids === undefined) normalized.receiver_ids = receiverIds;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const renderedDosage = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_rendered_dosage_instruction'));
  if (renderedDosage && normalized.rendered_dosage_instruction === undefined) {
    normalized.rendered_dosage_instruction = renderedDosage;
  }

  const dosageInstruction = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_dosage_instruction'));
  if (dosageInstruction && normalized.dosage_instruction === undefined) {
    normalized.dosage_instruction = dosageInstruction;
  }

  const substitutionWasSubstituted = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_substitution_was_substituted'));
  if (substitutionWasSubstituted && normalized.substitution_was_substituted === undefined) {
    normalized.substitution_was_substituted = substitutionWasSubstituted;
  }

  const substitutionType = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_substitution_type'));
  if (substitutionType && normalized.substitution_type === undefined) normalized.substitution_type = substitutionType;

  const substitutionReason = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_substitution_reason'));
  if (substitutionReason && normalized.substitution_reason === undefined) normalized.substitution_reason = substitutionReason;

  const substitutionResponsibleParty = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_substitution_responsible_party'));
  if (substitutionResponsibleParty && normalized.substitution_responsible_party === undefined) {
    normalized.substitution_responsible_party = substitutionResponsibleParty;
  }

  const supportingInfoIds = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_supporting_info_ids'));
  if (supportingInfoIds && normalized.supporting_info_ids === undefined) normalized.supporting_info_ids = supportingInfoIds;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const partOfIds = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_part_of_ids'));
  if (partOfIds && normalized.part_of_ids === undefined) normalized.part_of_ids = partOfIds;

  const eventHistoryIds = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_event_history_ids'));
  if (eventHistoryIds && normalized.event_history_ids === undefined) normalized.event_history_ids = eventHistoryIds;

  const performerActorId = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_performer_actor_id'));
  if (performerActorId && normalized.performer_actor_id === undefined) normalized.performer_actor_id = performerActorId;

  const performerFunction = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_performer_function'));
  if (performerFunction && normalized.performer_function === undefined) normalized.performer_function = performerFunction;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_type'));
  if (type && normalized.type === undefined) normalized.type = type;

  const medCode = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_medication_code'));
  const medSystem = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_medication_code_system'));
  const medDisplay = normalizeAliasValue(readSectionAliasValue(value, 'medicationDispense', 'medication_dispense_medication_display'));
  if ((medCode || medDisplay) && normalized.medication === undefined) {
    normalized.medication = {
      medication_id: medCode,
      code_system: medSystem,
      name: medDisplay
    };
  }

  return normalized;
}

function normalizeGlobalDeviceDispenseAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const dispenseId = readSectionAliasValue(value, 'deviceDispense', 'device_dispense_id');
  if (normalized.device_dispense_id === undefined && dispenseId !== undefined) {
    normalized.device_dispense_id = dispenseId;
  }

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const partOfIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_part_of_ids'));
  if (partOfIds && normalized.part_of_ids === undefined) normalized.part_of_ids = partOfIds;

  const status = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const statusReasonCode = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_status_reason_code'));
  if (statusReasonCode && normalized.status_reason_code === undefined) normalized.status_reason_code = statusReasonCode;

  const statusReasonReference = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_status_reason_reference_id'));
  if (statusReasonReference && normalized.status_reason_reference_id === undefined) {
    normalized.status_reason_reference_id = statusReasonReference;
  }

  const category = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const deviceId = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_device_id'));
  if (deviceId && normalized.device_reference_id === undefined) normalized.device_reference_id = deviceId;

  const deviceCode = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_device_code'));
  if (deviceCode && normalized.device_code === undefined) normalized.device_code = deviceCode;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const receiverId = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_receiver_id'));
  if (receiverId && normalized.receiver_id === undefined) normalized.receiver_id = receiverId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const supportingInfoIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_supporting_information_ids'));
  if (supportingInfoIds && normalized.supporting_information_ids === undefined) {
    normalized.supporting_information_ids = supportingInfoIds;
  }

  const performerFunction = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_performer_function'));
  if (performerFunction && normalized.performer_function === undefined) normalized.performer_function = performerFunction;

  const performerActor = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_performer_actor_id'));
  if (performerActor && normalized.performer_actor_id === undefined) normalized.performer_actor_id = performerActor;

  const locationId = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_location_id'));
  if (locationId && normalized.location_id === undefined) normalized.location_id = locationId;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_type'));
  if (type && normalized.type === undefined) normalized.type = type;

  const quantityValue = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_quantity_value'));
  if (quantityValue && normalized.quantity_value === undefined) normalized.quantity_value = quantityValue;

  const quantityUnit = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_quantity_unit'));
  if (quantityUnit && normalized.quantity_unit === undefined) normalized.quantity_unit = quantityUnit;

  const preparedDate = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_prepared_date'));
  if (preparedDate && normalized.prepared_date === undefined) normalized.prepared_date = preparedDate;

  const whenHandedOver = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_when_handed_over'));
  if (whenHandedOver && normalized.when_handed_over === undefined) normalized.when_handed_over = whenHandedOver;

  const destinationId = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_destination_id'));
  if (destinationId && normalized.destination_id === undefined) normalized.destination_id = destinationId;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const usageInstruction = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_usage_instruction'));
  if (usageInstruction && normalized.usage_instruction === undefined) normalized.usage_instruction = usageInstruction;

  const eventHistoryIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceDispense', 'device_dispense_event_history_ids'));
  if (eventHistoryIds && normalized.event_history_ids === undefined) normalized.event_history_ids = eventHistoryIds;

  return normalized;
}

function normalizeGlobalDeviceRequestAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const requestId = readSectionAliasValue(value, 'deviceRequest', 'device_request_id');
  if (normalized.device_request_id === undefined && requestId !== undefined) {
    normalized.device_request_id = requestId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const intent = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_intent'));
  if (intent && normalized.intent === undefined) normalized.intent = intent;

  const priority = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_priority'));
  if (priority && normalized.priority === undefined) normalized.priority = priority;

  const doNotPerform = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_do_not_perform'));
  if (doNotPerform !== undefined && normalized.do_not_perform === undefined) normalized.do_not_perform = doNotPerform;

  const deviceCode = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_device_code'));
  if (deviceCode && normalized.device_code === undefined) normalized.device_code = deviceCode;

  const deviceReferenceId = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_device_reference_id'));
  if (deviceReferenceId && normalized.device_reference_id === undefined) normalized.device_reference_id = deviceReferenceId;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const occurrenceDateTime = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_occurrence_date_time'));
  if (occurrenceDateTime && normalized.occurrence_date_time === undefined) normalized.occurrence_date_time = occurrenceDateTime;

  const occurrenceStart = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_occurrence_start'));
  if (occurrenceStart && normalized.occurrence_start === undefined) normalized.occurrence_start = occurrenceStart;

  const occurrenceEnd = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_occurrence_end'));
  if (occurrenceEnd && normalized.occurrence_end === undefined) normalized.occurrence_end = occurrenceEnd;

  const occurrenceTiming = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_occurrence_timing'));
  if (occurrenceTiming && normalized.occurrence_timing === undefined) normalized.occurrence_timing = occurrenceTiming;

  const authoredOn = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_authored_on'));
  if (authoredOn && normalized.authored_on === undefined) normalized.authored_on = authoredOn;

  const requesterId = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_requester_id'));
  if (requesterId && normalized.requester_id === undefined) normalized.requester_id = requesterId;

  const performerId = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_performer_id'));
  if (performerId && normalized.performer_id === undefined) normalized.performer_id = performerId;

  const reasonIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_reason_ids'));
  if (reasonIds && normalized.reason_ids === undefined) normalized.reason_ids = reasonIds;

  const asNeeded = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_as_needed'));
  if (asNeeded !== undefined && normalized.as_needed === undefined) normalized.as_needed = asNeeded;

  const asNeededFor = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_as_needed_for'));
  if (asNeededFor && normalized.as_needed_for === undefined) normalized.as_needed_for = asNeededFor;

  const insuranceIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_insurance_ids'));
  if (insuranceIds && normalized.insurance_ids === undefined) normalized.insurance_ids = insuranceIds;

  const supportingInfoIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_supporting_info_ids'));
  if (supportingInfoIds && normalized.supporting_info_ids === undefined) normalized.supporting_info_ids = supportingInfoIds;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const relevantHistoryIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_relevant_history_ids'));
  if (relevantHistoryIds && normalized.relevant_history_ids === undefined) normalized.relevant_history_ids = relevantHistoryIds;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const replacesIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_replaces_ids'));
  if (replacesIds && normalized.replaces_ids === undefined) normalized.replaces_ids = replacesIds;

  const instantiatesCanonical = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_instantiates_canonical'));
  if (instantiatesCanonical && normalized.instantiates_canonical === undefined) {
    normalized.instantiates_canonical = instantiatesCanonical;
  }

  const instantiatesUri = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_instantiates_uri'));
  if (instantiatesUri && normalized.instantiates_uri === undefined) normalized.instantiates_uri = instantiatesUri;

  const groupIdentifier = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_group_identifier'));
  if (groupIdentifier && normalized.group_identifier === undefined) {
    normalized.group_identifier = { value: groupIdentifier };
  }

  const quantityValue = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_quantity_value'));
  if (quantityValue !== undefined && normalized.quantity_value === undefined) normalized.quantity_value = quantityValue;

  const parameterCode = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_parameter_code'));
  const parameterValueCodeable = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_parameter_value_code'));
  const parameterQuantityValue = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_parameter_value_quantity_value'));
  const parameterQuantityUnit = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_parameter_value_quantity_unit'));
  const parameterBoolean = normalizeAliasValue(readSectionAliasValue(value, 'deviceRequest', 'device_request_parameter_value_boolean'));
  if ((parameterCode || parameterValueCodeable || parameterQuantityValue || parameterQuantityUnit || parameterBoolean !== undefined) && normalized.parameter === undefined) {
    normalized.parameter = [{
      code: parameterCode ? { code: parameterCode, display: parameterCode } : undefined,
      value_codeable_concept: parameterValueCodeable ? { code: parameterValueCodeable, display: parameterValueCodeable } : undefined,
      value_quantity: (parameterQuantityValue || parameterQuantityUnit) ? {
        value: parameterQuantityValue,
        unit: parameterQuantityUnit
      } : undefined,
      value_boolean: parameterBoolean
    }];
  }

  return normalized;
}

function normalizeGlobalDeviceUsageAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const usageId = readSectionAliasValue(value, 'deviceUsage', 'device_usage_id');
  if (normalized.device_usage_id === undefined && usageId !== undefined) {
    normalized.device_usage_id = usageId;
  }

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const status = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const patientId = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_patient_id'));
  if (patientId && normalized.patient_id === undefined) normalized.patient_id = patientId;

  const derivedFromIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_derived_from_ids'));
  if (derivedFromIds && normalized.derived_from_ids === undefined) normalized.derived_from_ids = derivedFromIds;

  const contextId = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_context_id'));
  if (contextId && normalized.context_id === undefined) normalized.context_id = contextId;

  const timingTiming = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_timing_timing'));
  if (timingTiming && normalized.timing_timing === undefined) normalized.timing_timing = timingTiming;

  const timingStart = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_timing_start'));
  if (timingStart && normalized.timing_start === undefined) normalized.timing_start = timingStart;

  const timingEnd = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_timing_end'));
  if (timingEnd && normalized.timing_end === undefined) normalized.timing_end = timingEnd;

  const timingDateTime = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_timing_date_time'));
  if (timingDateTime && normalized.timing_date_time === undefined) normalized.timing_date_time = timingDateTime;

  const dateAsserted = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_date_asserted'));
  if (dateAsserted && normalized.date_asserted === undefined) normalized.date_asserted = dateAsserted;

  const usageStatus = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_usage_status'));
  if (usageStatus && normalized.usage_status === undefined) normalized.usage_status = usageStatus;

  const usageReason = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_usage_reason'));
  if (usageReason && normalized.usage_reason === undefined) normalized.usage_reason = usageReason;

  const adherenceCode = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_adherence_code'));
  if (adherenceCode && normalized.adherence_code === undefined) normalized.adherence_code = adherenceCode;

  const adherenceReason = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_adherence_reason'));
  if (adherenceReason && normalized.adherence_reason === undefined) normalized.adherence_reason = adherenceReason;

  const informationSourceId = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_information_source_id'));
  if (informationSourceId && normalized.information_source_id === undefined) normalized.information_source_id = informationSourceId;

  const deviceCode = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_device_code'));
  if (deviceCode && normalized.device_code === undefined) normalized.device_code = deviceCode;

  const deviceReferenceId = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_device_reference_id'));
  if (deviceReferenceId && normalized.device_reference_id === undefined) normalized.device_reference_id = deviceReferenceId;

  const reasonIds = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_reason_ids'));
  if (reasonIds && normalized.reason_ids === undefined) normalized.reason_ids = reasonIds;

  const bodySiteId = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_body_site_id'));
  if (bodySiteId && normalized.body_site_id === undefined) normalized.body_site_id = bodySiteId;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'deviceUsage', 'device_usage_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  return normalized;
}

function normalizeGlobalEncounterHistoryAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const historyId = readSectionAliasValue(value, 'encounterHistory', 'encounter_history_id');
  if (normalized.encounter_history_id === undefined && historyId !== undefined) {
    normalized.encounter_history_id = historyId;
  }

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const status = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const classValue = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_class'));
  if (classValue && normalized.class === undefined) normalized.class = classValue;

  const typeValue = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_type'));
  if (typeValue && normalized.type === undefined) normalized.type = typeValue;

  const serviceType = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_service_type'));
  if (serviceType && normalized.service_type === undefined) normalized.service_type = serviceType;

  const serviceTypeRef = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_service_type_reference_ids'));
  if (serviceTypeRef && normalized.service_type_reference_ids === undefined) normalized.service_type_reference_ids = serviceTypeRef;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const subjectStatus = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_subject_status'));
  if (subjectStatus && normalized.subject_status === undefined) normalized.subject_status = subjectStatus;

  const actualStart = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_actual_start'));
  if (actualStart && normalized.actual_start === undefined) normalized.actual_start = actualStart;

  const actualEnd = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_actual_end'));
  if (actualEnd && normalized.actual_end === undefined) normalized.actual_end = actualEnd;

  const plannedStart = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_planned_start_date'));
  if (plannedStart && normalized.planned_start_date === undefined) normalized.planned_start_date = plannedStart;

  const plannedEnd = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_planned_end_date'));
  if (plannedEnd && normalized.planned_end_date === undefined) normalized.planned_end_date = plannedEnd;

  const lengthValue = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_length_value'));
  if (lengthValue !== undefined && normalized.length_value === undefined) normalized.length_value = lengthValue;

  const lengthUnit = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_length_unit'));
  if (lengthUnit && normalized.length_unit === undefined) normalized.length_unit = lengthUnit;

  const lengthSystem = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_length_system'));
  if (lengthSystem && normalized.length_system === undefined) normalized.length_system = lengthSystem;

  const lengthCode = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_length_code'));
  if (lengthCode && normalized.length_code === undefined) normalized.length_code = lengthCode;

  const locationId = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_location_id'));
  if (locationId && normalized.location_id === undefined) normalized.location_id = locationId;

  const locationForm = normalizeAliasValue(readSectionAliasValue(value, 'encounterHistory', 'encounter_history_location_form'));
  if (locationForm && normalized.location_form === undefined) normalized.location_form = locationForm;

  return normalized;
}

function normalizeGlobalFlagAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const flagId = readSectionAliasValue(value, 'flag', 'flag_id');
  if (normalized.flag_id === undefined && flagId !== undefined) {
    normalized.flag_id = flagId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'flag', 'flag_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'flag', 'flag_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const code = normalizeAliasValue(readSectionAliasValue(value, 'flag', 'flag_code'));
  if (code && normalized.code === undefined) normalized.code = code;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'flag', 'flag_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const periodStart = normalizeAliasValue(readSectionAliasValue(value, 'flag', 'flag_period_start'));
  if (periodStart && normalized.period_start === undefined) normalized.period_start = periodStart;

  const periodEnd = normalizeAliasValue(readSectionAliasValue(value, 'flag', 'flag_period_end'));
  if (periodEnd && normalized.period_end === undefined) normalized.period_end = periodEnd;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'flag', 'flag_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const authorId = normalizeAliasValue(readSectionAliasValue(value, 'flag', 'flag_author_id'));
  if (authorId && normalized.author_id === undefined) normalized.author_id = authorId;

  return normalized;
}

function normalizeGlobalListAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const listId = readSectionAliasValue(value, 'list', 'list_id');
  if (normalized.list_id === undefined && listId !== undefined) {
    normalized.list_id = listId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const mode = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_mode'));
  if (mode && normalized.mode === undefined) normalized.mode = mode;

  const title = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_title'));
  if (title && normalized.title === undefined) normalized.title = title;

  const code = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_code'));
  if (code && normalized.code === undefined) normalized.code = { code, display: code };

  const subjectIds = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_subject_ids'));
  if (subjectIds && normalized.subject_ids === undefined) normalized.subject_ids = subjectIds;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const date = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_date'));
  if (date && normalized.date === undefined) normalized.date = date;

  const sourceId = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_source_id'));
  if (sourceId && normalized.source_id === undefined) normalized.source_id = sourceId;

  const orderedBy = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_ordered_by'));
  if (orderedBy && normalized.ordered_by === undefined) normalized.ordered_by = { code: orderedBy, display: orderedBy };

  const note = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const emptyReason = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_empty_reason'));
  if (emptyReason && normalized.empty_reason === undefined) normalized.empty_reason = { code: emptyReason, display: emptyReason };

  const entryFlag = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_entry_flag'));
  const entryDeleted = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_entry_deleted'));
  const entryDate = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_entry_date'));
  const entryItem = normalizeAliasValue(readSectionAliasValue(value, 'list', 'list_entry_item_id'));
  if ((entryFlag || entryDeleted !== undefined || entryDate || entryItem) && normalized.entry === undefined) {
    normalized.entry = [{
      flag: entryFlag ? { code: entryFlag, display: entryFlag } : undefined,
      deleted: entryDeleted,
      date: entryDate,
      item_id: entryItem
    }];
  }

  return normalized;
}

function normalizeGlobalGroupAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const groupId = readSectionAliasValue(value, 'group', 'group_id');
  if (normalized.group_id === undefined && groupId !== undefined) {
    normalized.group_id = groupId;
  }

  const active = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_active'));
  if (active !== undefined && normalized.active === undefined) normalized.active = active;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_type'));
  if (type && normalized.type === undefined) normalized.type = type;

  const membership = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_membership'));
  if (membership && normalized.membership === undefined) normalized.membership = membership;

  const code = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_code'));
  if (code && normalized.code === undefined) normalized.code = { code, display: code };

  const name = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const description = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const quantity = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_quantity'));
  if (quantity !== undefined && normalized.quantity === undefined) normalized.quantity = quantity;

  const managingEntityId = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_managing_entity_id'));
  if (managingEntityId && normalized.managing_entity_id === undefined) normalized.managing_entity_id = managingEntityId;

  const characteristicCode = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_characteristic_code'));
  const characteristicValue = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_characteristic_value'));
  const characteristicExclude = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_characteristic_exclude'));
  const characteristicStart = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_characteristic_period_start'));
  const characteristicEnd = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_characteristic_period_end'));

  if (
    normalized.characteristic === undefined &&
    (characteristicCode || characteristicValue || characteristicExclude || characteristicStart || characteristicEnd)
  ) {
    normalized.characteristic = [{
      code: characteristicCode ? { code: characteristicCode, display: characteristicCode } : undefined,
      value_codeable: characteristicValue ? { code: characteristicValue, display: characteristicValue } : undefined,
      exclude: characteristicExclude,
      period: characteristicStart || characteristicEnd ? { start: characteristicStart, end: characteristicEnd } : undefined
    }];
  }

  const memberEntity = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_member_entity_id'));
  const memberInactive = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_member_inactive'));
  const memberStart = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_member_period_start'));
  const memberEnd = normalizeAliasValue(readSectionAliasValue(value, 'group', 'group_member_period_end'));

  if (
    normalized.member === undefined &&
    (memberEntity || memberInactive !== undefined || memberStart || memberEnd)
  ) {
    normalized.member = [{
      entity_id: memberEntity,
      inactive: memberInactive,
      period: memberStart || memberEnd ? { start: memberStart, end: memberEnd } : undefined
    }];
  }

  return normalized;
}

function normalizeGlobalHealthcareServiceAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const serviceId = readSectionAliasValue(value, 'healthcareService', 'healthcare_service_id');
  if (normalized.healthcare_service_id === undefined && serviceId !== undefined) {
    normalized.healthcare_service_id = serviceId;
  }

  const active = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_active'));
  if (active !== undefined && normalized.active === undefined) normalized.active = active;

  const providedBy = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_provided_by'));
  if (providedBy && normalized.provided_by_id === undefined) normalized.provided_by_id = providedBy;

  const offeredIn = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_offered_in'));
  if (offeredIn && normalized.offered_in_ids === undefined) normalized.offered_in_ids = offeredIn;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_category'));
  if (category && normalized.category === undefined) normalized.category = { code: category, display: category };

  const type = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_type'));
  if (type && normalized.type === undefined) normalized.type = { code: type, display: type };

  const specialty = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_specialty'));
  if (specialty && normalized.specialty === undefined) normalized.specialty = { code: specialty, display: specialty };

  const locations = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_location_ids'));
  if (locations && normalized.location_ids === undefined) normalized.location_ids = locations;

  const name = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const comment = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_comment'));
  if (comment && normalized.comment === undefined) normalized.comment = comment;

  const extraDetails = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_extra_details'));
  if (extraDetails && normalized.extra_details === undefined) normalized.extra_details = extraDetails;

  const contactName = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_contact_name'));
  const contactPhone = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_contact_phone'));
  const contactEmail = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_contact_email'));
  if (normalized.contact === undefined && (contactName || contactPhone || contactEmail)) {
    const telecom = [];
    if (contactPhone) telecom.push({ system: 'phone', value: contactPhone });
    if (contactEmail) telecom.push({ system: 'email', value: contactEmail });
    normalized.contact = [{ name: contactName, telecom }];
  }

  const coverageAreas = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_coverage_area_ids'));
  if (coverageAreas && normalized.coverage_area_ids === undefined) normalized.coverage_area_ids = coverageAreas;

  const provisionCode = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_provision_code'));
  if (provisionCode && normalized.service_provision_code === undefined) normalized.service_provision_code = { code: provisionCode, display: provisionCode };

  const eligibilityCode = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_eligibility_code'));
  const eligibilityComment = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_eligibility_comment'));
  if (normalized.eligibility === undefined && (eligibilityCode || eligibilityComment)) {
    normalized.eligibility = [{
      code: eligibilityCode ? { code: eligibilityCode, display: eligibilityCode } : undefined,
      comment: eligibilityComment
    }];
  }

  const program = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_program'));
  if (program && normalized.program === undefined) normalized.program = { code: program, display: program };

  const characteristic = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_characteristic'));
  if (characteristic && normalized.characteristic === undefined) normalized.characteristic = { code: characteristic, display: characteristic };

  const communication = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_communication'));
  if (communication && normalized.communication === undefined) normalized.communication = { code: communication, display: communication };

  const referralMethod = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_referral_method'));
  if (referralMethod && normalized.referral_method === undefined) normalized.referral_method = { code: referralMethod, display: referralMethod };

  const appointmentRequired = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_appointment_required'));
  if (appointmentRequired !== undefined && normalized.appointment_required === undefined) normalized.appointment_required = appointmentRequired;

  const endpoints = normalizeAliasValue(readSectionAliasValue(value, 'healthcareService', 'healthcare_service_endpoint_ids'));
  if (endpoints && normalized.endpoint_ids === undefined) normalized.endpoint_ids = endpoints;

  return normalized;
}

function normalizeGlobalInsurancePlanAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const planId = readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_id');
  if (normalized.insurance_plan_id === undefined && planId !== undefined) {
    normalized.insurance_plan_id = planId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_type'));
  if (type && normalized.type === undefined) normalized.type = [{ code: type, display: type }];

  const name = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const alias = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_alias'));
  if (alias && normalized.alias === undefined) normalized.alias = alias;

  const periodStart = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_period_start'));
  const periodEnd = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_period_end'));
  if ((periodStart || periodEnd) && normalized.period === undefined) {
    normalized.period = { start: periodStart, end: periodEnd };
  }

  const ownedBy = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_owned_by'));
  if (ownedBy && normalized.owned_by_id === undefined) normalized.owned_by_id = ownedBy;

  const administeredBy = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_administered_by'));
  if (administeredBy && normalized.administered_by_id === undefined) normalized.administered_by_id = administeredBy;

  const coverageAreas = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_coverage_area_ids'));
  if (coverageAreas && normalized.coverage_area_ids === undefined) normalized.coverage_area_ids = coverageAreas;

  const endpointIds = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_endpoint_ids'));
  if (endpointIds && normalized.endpoint_ids === undefined) normalized.endpoint_ids = endpointIds;

  const networkIds = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_network_ids'));
  if (networkIds && normalized.network_ids === undefined) normalized.network_ids = networkIds;

  const contactName = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_contact_name'));
  const contactPhone = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_contact_phone'));
  const contactEmail = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_contact_email'));
  if (normalized.contact === undefined && (contactName || contactPhone || contactEmail)) {
    const telecom: Array<Record<string, string>> = [];
    if (contactPhone) telecom.push({ system: 'phone', value: contactPhone });
    if (contactEmail) telecom.push({ system: 'email', value: contactEmail });
    normalized.contact = [{
      name: contactName,
      telecom: telecom.length > 0 ? telecom : undefined
    }];
  }

  const coverageType = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_coverage_type'));
  const coverageNetworkIds = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_coverage_network_ids'));
  const coverageBenefitType = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_coverage_benefit_type'));
  const coverageBenefitRequirement = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_coverage_benefit_requirement'));

  if (
    normalized.coverage === undefined &&
    (coverageType || coverageNetworkIds || coverageBenefitType || coverageBenefitRequirement)
  ) {
    normalized.coverage = [{
      type: coverageType ? { code: coverageType, display: coverageType } : undefined,
      network_ids: coverageNetworkIds,
      benefit: coverageBenefitType || coverageBenefitRequirement
        ? [{
            type: coverageBenefitType ? { code: coverageBenefitType, display: coverageBenefitType } : undefined,
            requirement: coverageBenefitRequirement
          }]
        : undefined
    }];
  }

  const planType = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_plan_type'));
  const planNetworkIds = normalizeAliasValue(readSectionAliasValue(value, 'insurancePlan', 'insurance_plan_plan_network_ids'));
  if (normalized.plan === undefined && (planType || planNetworkIds)) {
    normalized.plan = [{
      type: planType ? { code: planType, display: planType } : undefined,
      network_ids: planNetworkIds
    }];
  }

  return normalized;
}

function normalizeGlobalNutritionIntakeAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const intakeId = readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_id');
  if (normalized.nutrition_intake_id === undefined && intakeId !== undefined) {
    normalized.nutrition_intake_id = intakeId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const statusReason = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_status_reason'));
  if (statusReason && normalized.status_reason === undefined) normalized.status_reason = statusReason;

  const code = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_code'));
  if (code && normalized.code === undefined) normalized.code = { code, display: code };

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const occurrenceDateTime = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_occurrence_date_time'));
  if (occurrenceDateTime && normalized.occurrence_date_time === undefined) normalized.occurrence_date_time = occurrenceDateTime;

  const occurrenceStart = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_occurrence_start'));
  if (occurrenceStart && normalized.occurrence_start === undefined) normalized.occurrence_start = occurrenceStart;

  const occurrenceEnd = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_occurrence_end'));
  if (occurrenceEnd && normalized.occurrence_end === undefined) normalized.occurrence_end = occurrenceEnd;

  const recorded = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_recorded'));
  if (recorded && normalized.recorded === undefined) normalized.recorded = recorded;

  const reportedBoolean = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_reported_boolean'));
  if (reportedBoolean !== undefined && normalized.reported_boolean === undefined) normalized.reported_boolean = reportedBoolean;

  const reportedReference = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_reported_reference_id'));
  if (reportedReference && normalized.reported_reference_id === undefined) normalized.reported_reference_id = reportedReference;

  const instantiatesCanonical = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_instantiates_canonical'));
  if (instantiatesCanonical && normalized.instantiates_canonical === undefined) normalized.instantiates_canonical = instantiatesCanonical;

  const instantiatesUri = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_instantiates_uri'));
  if (instantiatesUri && normalized.instantiates_uri === undefined) normalized.instantiates_uri = instantiatesUri;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const partOfIds = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_part_of_ids'));
  if (partOfIds && normalized.part_of_ids === undefined) normalized.part_of_ids = partOfIds;

  const consumedType = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_consumed_type'));
  const consumedProductCode = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_consumed_product_code'));
  const consumedProductRef = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_consumed_product_reference_id'));
  const consumedAmountValue = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_consumed_amount_value'));
  const consumedAmountUnit = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_consumed_amount_unit'));
  const consumedNotConsumed = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_consumed_not_consumed'));
  const consumedNotConsumedReason = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_consumed_not_consumed_reason'));
  if ((consumedType || consumedProductCode || consumedProductRef || consumedAmountValue || consumedAmountUnit || consumedNotConsumed !== undefined || consumedNotConsumedReason) && normalized.consumed_item === undefined) {
    normalized.consumed_item = [{
      type: consumedType ? { code: consumedType, display: consumedType } : undefined,
      nutrition_product_codeable: consumedProductCode ? { code: consumedProductCode, display: consumedProductCode } : undefined,
      nutrition_product_reference_id: consumedProductRef,
      amount: (consumedAmountValue || consumedAmountUnit) ? { value: consumedAmountValue, unit: consumedAmountUnit } : undefined,
      not_consumed: consumedNotConsumed,
      not_consumed_reason: consumedNotConsumedReason ? { code: consumedNotConsumedReason, display: consumedNotConsumedReason } : undefined
    }];
  }

  const ingredientNutrientCode = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_ingredient_nutrient_code'));
  const ingredientNutrientRef = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_ingredient_nutrient_reference_id'));
  const ingredientAmountValue = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_ingredient_amount_value'));
  const ingredientAmountUnit = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_ingredient_amount_unit'));
  if ((ingredientNutrientCode || ingredientNutrientRef || ingredientAmountValue || ingredientAmountUnit) && normalized.ingredient_label === undefined) {
    normalized.ingredient_label = [{
      nutrient_codeable: ingredientNutrientCode ? { code: ingredientNutrientCode, display: ingredientNutrientCode } : undefined,
      nutrient_reference_id: ingredientNutrientRef,
      amount: (ingredientAmountValue || ingredientAmountUnit) ? { value: ingredientAmountValue, unit: ingredientAmountUnit } : undefined
    }];
  }

  const performerFunction = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_performer_function'));
  const performerActor = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_performer_actor_id'));
  if ((performerFunction || performerActor) && normalized.performer === undefined) {
    normalized.performer = [{
      function: performerFunction ? { code: performerFunction, display: performerFunction } : undefined,
      actor_id: performerActor
    }];
  }

  const locationId = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_location_id'));
  if (locationId && normalized.location_id === undefined) normalized.location_id = locationId;

  const derivedFromIds = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_derived_from_ids'));
  if (derivedFromIds && normalized.derived_from_ids === undefined) normalized.derived_from_ids = derivedFromIds;

  const reasonIds = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_reason_ids'));
  if (reasonIds && normalized.reason_ids === undefined) normalized.reason_ids = reasonIds;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'nutritionIntake', 'nutrition_intake_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  return normalized;
}

function normalizeGlobalNutritionOrderAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const orderId = readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_id');
  if (normalized.nutrition_order_id === undefined && orderId !== undefined) {
    normalized.nutrition_order_id = orderId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const intent = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_intent'));
  if (intent && normalized.intent === undefined) normalized.intent = intent;

  const priority = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_priority'));
  if (priority && normalized.priority === undefined) normalized.priority = priority;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const dateTime = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_date_time'));
  if (dateTime && normalized.date_time === undefined) normalized.date_time = dateTime;

  const ordererId = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_orderer_id'));
  if (ordererId && normalized.orderer_id === undefined) normalized.orderer_id = ordererId;

  const supportingInfoIds = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_supporting_information_ids'));
  if (supportingInfoIds && normalized.supporting_information_ids === undefined) normalized.supporting_information_ids = supportingInfoIds;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const instantiatesCanonical = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_instantiates_canonical'));
  if (instantiatesCanonical && normalized.instantiates_canonical === undefined) normalized.instantiates_canonical = instantiatesCanonical;

  const instantiatesUri = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_instantiates_uri'));
  if (instantiatesUri && normalized.instantiates_uri === undefined) normalized.instantiates_uri = instantiatesUri;

  const instantiates = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_instantiates'));
  if (instantiates && normalized.instantiates === undefined) normalized.instantiates = instantiates;

  const groupIdentifier = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_group_identifier'));
  if (groupIdentifier && normalized.group_identifier === undefined) normalized.group_identifier = { value: groupIdentifier };

  const performerConcept = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_performer_concept'));
  if (performerConcept && normalized.performer_concept === undefined) normalized.performer_concept = { code: performerConcept, display: performerConcept };

  const performerReferenceIds = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_performer_reference_ids'));
  if (performerReferenceIds && normalized.performer_reference_ids === undefined) normalized.performer_reference_ids = performerReferenceIds;

  const allergyIds = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_allergy_intolerance_ids'));
  if (allergyIds && normalized.allergy_intolerance_ids === undefined) normalized.allergy_intolerance_ids = allergyIds;

  const foodPref = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_food_preference_modifier'));
  if (foodPref && normalized.food_preference_modifier === undefined) normalized.food_preference_modifier = foodPref;

  const excludeFood = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_exclude_food_modifier'));
  if (excludeFood && normalized.exclude_food_modifier === undefined) normalized.exclude_food_modifier = excludeFood;

  const outsideFood = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_outside_food_allowed'));
  if (outsideFood !== undefined && normalized.outside_food_allowed === undefined) normalized.outside_food_allowed = outsideFood;

  const oralDietType = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_oral_diet_type'));
  if (oralDietType && normalized.oral_diet_type === undefined) normalized.oral_diet_type = oralDietType;

  const oralDietTiming = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_oral_diet_schedule_timing'));
  if (oralDietTiming && normalized.oral_diet_schedule_timing === undefined) normalized.oral_diet_schedule_timing = oralDietTiming;

  const oralDietAsNeeded = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_oral_diet_as_needed'));
  if (oralDietAsNeeded !== undefined && normalized.oral_diet_as_needed === undefined) normalized.oral_diet_as_needed = oralDietAsNeeded;

  const oralDietAsNeededFor = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_oral_diet_as_needed_for'));
  if (oralDietAsNeededFor && normalized.oral_diet_as_needed_for === undefined) normalized.oral_diet_as_needed_for = oralDietAsNeededFor;

  const oralDietInstruction = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_oral_diet_instruction'));
  if (oralDietInstruction && normalized.oral_diet_instruction === undefined) normalized.oral_diet_instruction = oralDietInstruction;

  const supplementTypeCode = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_supplement_type_code'));
  if (supplementTypeCode && normalized.supplement_type_code === undefined) normalized.supplement_type_code = supplementTypeCode;

  const supplementTypeRef = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_supplement_type_reference_id'));
  if (supplementTypeRef && normalized.supplement_type_reference_id === undefined) normalized.supplement_type_reference_id = supplementTypeRef;

  const supplementProductName = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_supplement_product_name'));
  if (supplementProductName && normalized.supplement_product_name === undefined) normalized.supplement_product_name = supplementProductName;

  const supplementScheduleTiming = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_supplement_schedule_timing'));
  if (supplementScheduleTiming && normalized.supplement_schedule_timing === undefined) normalized.supplement_schedule_timing = supplementScheduleTiming;

  const supplementAsNeeded = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_supplement_as_needed'));
  if (supplementAsNeeded !== undefined && normalized.supplement_as_needed === undefined) normalized.supplement_as_needed = supplementAsNeeded;

  const supplementAsNeededFor = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_supplement_as_needed_for'));
  if (supplementAsNeededFor && normalized.supplement_as_needed_for === undefined) normalized.supplement_as_needed_for = supplementAsNeededFor;

  const supplementQuantityValue = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_supplement_quantity_value'));
  if (supplementQuantityValue !== undefined && normalized.supplement_quantity_value === undefined) normalized.supplement_quantity_value = supplementQuantityValue;

  const supplementQuantityUnit = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_supplement_quantity_unit'));
  if (supplementQuantityUnit && normalized.supplement_quantity_unit === undefined) normalized.supplement_quantity_unit = supplementQuantityUnit;

  const supplementInstruction = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_supplement_instruction'));
  if (supplementInstruction && normalized.supplement_instruction === undefined) normalized.supplement_instruction = supplementInstruction;

  const enteralBaseFormulaCode = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_enteral_base_formula_code'));
  if (enteralBaseFormulaCode && normalized.enteral_base_formula_code === undefined) normalized.enteral_base_formula_code = enteralBaseFormulaCode;

  const enteralBaseFormulaRef = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_enteral_base_formula_reference_id'));
  if (enteralBaseFormulaRef && normalized.enteral_base_formula_reference_id === undefined) normalized.enteral_base_formula_reference_id = enteralBaseFormulaRef;

  const enteralBaseFormulaProductName = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_enteral_base_formula_product_name'));
  if (enteralBaseFormulaProductName && normalized.enteral_base_formula_product_name === undefined) {
    normalized.enteral_base_formula_product_name = enteralBaseFormulaProductName;
  }

  const enteralRoute = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_enteral_route_of_administration'));
  if (enteralRoute && normalized.enteral_route_of_administration === undefined) normalized.enteral_route_of_administration = enteralRoute;

  const enteralCaloricValue = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_enteral_caloric_density_value'));
  if (enteralCaloricValue !== undefined && normalized.enteral_caloric_density_value === undefined) {
    normalized.enteral_caloric_density_value = enteralCaloricValue;
  }

  const enteralCaloricUnit = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_enteral_caloric_density_unit'));
  if (enteralCaloricUnit && normalized.enteral_caloric_density_unit === undefined) normalized.enteral_caloric_density_unit = enteralCaloricUnit;

  const enteralInstruction = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_enteral_administration_instruction'));
  if (enteralInstruction && normalized.enteral_administration_instruction === undefined) normalized.enteral_administration_instruction = enteralInstruction;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'nutritionOrder', 'nutrition_order_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  return normalized;
}

function normalizeGlobalRiskAssessmentAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const assessmentId = readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_id');
  if (normalized.risk_assessment_id === undefined && assessmentId !== undefined) {
    normalized.risk_assessment_id = assessmentId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const method = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_method'));
  if (method && normalized.method === undefined) normalized.method = { code: method, display: method };

  const code = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_code'));
  if (code && normalized.code === undefined) normalized.code = { code, display: code };

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const occurrenceDateTime = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_occurrence_date_time'));
  if (occurrenceDateTime && normalized.occurrence_date_time === undefined) {
    normalized.occurrence_date_time = occurrenceDateTime;
  }

  const occurrenceStart = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_occurrence_start'));
  if (occurrenceStart && normalized.occurrence_start === undefined) normalized.occurrence_start = occurrenceStart;

  const occurrenceEnd = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_occurrence_end'));
  if (occurrenceEnd && normalized.occurrence_end === undefined) normalized.occurrence_end = occurrenceEnd;

  const basedOnId = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_based_on_id'));
  if (basedOnId && normalized.based_on_id === undefined) normalized.based_on_id = basedOnId;

  const parentId = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_parent_id'));
  if (parentId && normalized.parent_id === undefined) normalized.parent_id = parentId;

  const conditionId = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_condition_id'));
  if (conditionId && normalized.condition_id === undefined) normalized.condition_id = conditionId;

  const performerId = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_performer_id'));
  if (performerId && normalized.performer_id === undefined) normalized.performer_id = performerId;

  const reasonIds = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_reason_ids'));
  if (reasonIds && normalized.reason_ids === undefined) normalized.reason_ids = reasonIds;

  const basisIds = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_basis_ids'));
  if (basisIds && normalized.basis_ids === undefined) normalized.basis_ids = basisIds;

  const mitigation = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_mitigation'));
  if (mitigation && normalized.mitigation === undefined) normalized.mitigation = mitigation;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const predOutcome = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_outcome'));
  const predProbabilityDecimal = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_probability_decimal'));
  const predProbRangeLowValue = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_probability_range_low_value'));
  const predProbRangeLowUnit = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_probability_range_low_unit'));
  const predProbRangeHighValue = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_probability_range_high_value'));
  const predProbRangeHighUnit = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_probability_range_high_unit'));
  const predQualitativeRisk = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_qualitative_risk'));
  const predRelativeRisk = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_relative_risk'));
  const predWhenStart = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_when_start'));
  const predWhenEnd = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_when_end'));
  const predWhenRangeLowValue = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_when_range_low_value'));
  const predWhenRangeLowUnit = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_when_range_low_unit'));
  const predWhenRangeHighValue = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_when_range_high_value'));
  const predWhenRangeHighUnit = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_when_range_high_unit'));
  const predRationale = normalizeAliasValue(readSectionAliasValue(value, 'riskAssessment', 'risk_assessment_prediction_rationale'));

  const hasPrediction = predOutcome || predProbabilityDecimal || predProbRangeLowValue || predProbRangeLowUnit || predProbRangeHighValue || predProbRangeHighUnit || predQualitativeRisk || predRelativeRisk || predWhenStart || predWhenEnd || predWhenRangeLowValue || predWhenRangeLowUnit || predWhenRangeHighValue || predWhenRangeHighUnit || predRationale;
  if (hasPrediction && normalized.prediction === undefined) {
    const probabilityRange = (predProbRangeLowValue || predProbRangeLowUnit || predProbRangeHighValue || predProbRangeHighUnit)
      ? {
          low_value: predProbRangeLowValue,
          low_unit: predProbRangeLowUnit,
          high_value: predProbRangeHighValue,
          high_unit: predProbRangeHighUnit
        }
      : undefined;
    const whenRange = (predWhenRangeLowValue || predWhenRangeLowUnit || predWhenRangeHighValue || predWhenRangeHighUnit)
      ? {
          low_value: predWhenRangeLowValue,
          low_unit: predWhenRangeLowUnit,
          high_value: predWhenRangeHighValue,
          high_unit: predWhenRangeHighUnit
        }
      : undefined;

    normalized.prediction = {
      outcome: predOutcome ? { code: predOutcome, display: predOutcome } : undefined,
      probability_decimal: predProbabilityDecimal,
      probability_range: probabilityRange,
      qualitative_risk: predQualitativeRisk ? { code: predQualitativeRisk, display: predQualitativeRisk } : undefined,
      relative_risk: predRelativeRisk,
      when_period: (predWhenStart || predWhenEnd) ? { start: predWhenStart, end: predWhenEnd } : undefined,
      when_range: whenRange,
      rationale: predRationale
    };
  }

  return normalized;
}

function normalizeGlobalOrganizationAffiliationAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const affiliationId = readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_id');
  if (normalized.organization_affiliation_id === undefined && affiliationId !== undefined) {
    normalized.organization_affiliation_id = affiliationId;
  }

  const active = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_active'));
  if (active !== undefined && normalized.active === undefined) normalized.active = active;

  const periodStart = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_period_start'));
  if (periodStart && normalized.period_start === undefined) normalized.period_start = periodStart;

  const periodEnd = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_period_end'));
  if (periodEnd && normalized.period_end === undefined) normalized.period_end = periodEnd;

  const organizationId = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_organization_id'));
  if (organizationId && normalized.organization_id === undefined) normalized.organization_id = organizationId;

  const participatingOrgId = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_participating_organization_id'));
  if (participatingOrgId && normalized.participating_organization_id === undefined) normalized.participating_organization_id = participatingOrgId;

  const networkIds = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_network_ids'));
  if (networkIds && normalized.network_ids === undefined) normalized.network_ids = networkIds;

  const code = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_code'));
  if (code && normalized.code === undefined) normalized.code = code;

  const specialty = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_specialty'));
  if (specialty && normalized.specialty === undefined) normalized.specialty = specialty;

  const locationIds = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_location_ids'));
  if (locationIds && normalized.location_ids === undefined) normalized.location_ids = locationIds;

  const healthcareServiceIds = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_healthcare_service_ids'));
  if (healthcareServiceIds && normalized.healthcare_service_ids === undefined) normalized.healthcare_service_ids = healthcareServiceIds;

  const contactName = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_contact_name'));
  if (contactName && normalized.contact_name === undefined) normalized.contact_name = contactName;

  const contactPhone = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_contact_phone'));
  if (contactPhone && normalized.contact_phone === undefined) normalized.contact_phone = contactPhone;

  const contactEmail = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_contact_email'));
  if (contactEmail && normalized.contact_email === undefined) normalized.contact_email = contactEmail;

  const endpointIds = normalizeAliasValue(readSectionAliasValue(value, 'organizationAffiliation', 'organization_affiliation_endpoint_ids'));
  if (endpointIds && normalized.endpoint_ids === undefined) normalized.endpoint_ids = endpointIds;

  return normalized;
}

function normalizeGlobalCapabilityStatementAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const capabilityId = readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_id');
  if (normalized.capability_statement_id === undefined && capabilityId !== undefined) {
    normalized.capability_statement_id = capabilityId;
  }

  const url = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_url'));
  if (url && normalized.url === undefined) normalized.url = url;

  const identifier = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_identifier'));
  if (identifier && normalized.identifier === undefined) normalized.identifier = identifier;

  const version = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_version'));
  if (version && normalized.version === undefined) normalized.version = version;

  const name = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const title = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_title'));
  if (title && normalized.title === undefined) normalized.title = title;

  const status = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const date = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_date'));
  if (date && normalized.date === undefined) normalized.date = date;

  const publisher = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_publisher'));
  if (publisher && normalized.publisher === undefined) normalized.publisher = publisher;

  const kind = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_kind'));
  if (kind && normalized.kind === undefined) normalized.kind = kind;

  const fhirVersion = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_fhir_version'));
  if (fhirVersion && normalized.fhir_version === undefined) normalized.fhir_version = fhirVersion;

  const format = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_format'));
  if (format && normalized.format === undefined) normalized.format = format;

  const description = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const implementationUrl = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_implementation_url'));
  if (implementationUrl && normalized.implementation_url === undefined) normalized.implementation_url = implementationUrl;

  const implementationDescription = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_implementation_description'));
  if (implementationDescription && normalized.implementation_description === undefined) normalized.implementation_description = implementationDescription;

  const softwareName = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_software_name'));
  if (softwareName && normalized.software_name === undefined) normalized.software_name = softwareName;

  const softwareVersion = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_software_version'));
  if (softwareVersion && normalized.software_version === undefined) normalized.software_version = softwareVersion;

  const softwareReleaseDate = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_software_release_date'));
  if (softwareReleaseDate && normalized.software_release_date === undefined) normalized.software_release_date = softwareReleaseDate;

  const restMode = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_rest_mode'));
  if (restMode && normalized.rest_mode === undefined) normalized.rest_mode = restMode;

  const restDocumentation = normalizeAliasValue(readSectionAliasValue(value, 'capabilityStatement', 'capability_statement_rest_documentation'));
  if (restDocumentation && normalized.rest_documentation === undefined) normalized.rest_documentation = restDocumentation;

  return normalized;
}

function normalizeGlobalOperationOutcomeAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const details = isPlainRecord(normalized.details) ? { ...normalized.details } : {};

  const outcomeId = readSectionAliasValue(value, 'operationOutcome', 'operation_outcome_id');
  if (normalized.operation_outcome_id === undefined && outcomeId !== undefined) {
    normalized.operation_outcome_id = outcomeId;
  }

  const severity = normalizeAliasValue(readSectionAliasValue(value, 'operationOutcome', 'operation_outcome_severity'));
  if (severity && normalized.severity === undefined) normalized.severity = severity;

  const code = normalizeAliasValue(readSectionAliasValue(value, 'operationOutcome', 'operation_outcome_code'));
  if (code && normalized.code === undefined) normalized.code = code;

  const detailsSystem = normalizeAliasValue(readSectionAliasValue(value, 'operationOutcome', 'operation_outcome_details_system'));
  if (detailsSystem && details.system === undefined) details.system = detailsSystem;

  const detailsCode = normalizeAliasValue(readSectionAliasValue(value, 'operationOutcome', 'operation_outcome_details_code'));
  if (detailsCode && details.code === undefined) details.code = detailsCode;

  const detailsDisplay = normalizeAliasValue(readSectionAliasValue(value, 'operationOutcome', 'operation_outcome_details_display'));
  if (detailsDisplay && details.display === undefined) details.display = detailsDisplay;

  const diagnostics = normalizeAliasValue(readSectionAliasValue(value, 'operationOutcome', 'operation_outcome_diagnostics'));
  if (diagnostics && normalized.diagnostics === undefined) normalized.diagnostics = diagnostics;

  const location = normalizeAliasValue(readSectionAliasValue(value, 'operationOutcome', 'operation_outcome_location'));
  if (location && normalized.location === undefined) normalized.location = location;

  const expression = normalizeAliasValue(readSectionAliasValue(value, 'operationOutcome', 'operation_outcome_expression'));
  if (expression && normalized.expression === undefined) normalized.expression = expression;

  if (Object.keys(details).length > 0) normalized.details = details;

  return normalized;
}

function normalizeGlobalParametersAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const name = normalizeAliasValue(readSectionAliasValue(value, 'parameters', 'parameter_name'));
  if (name && normalized.parameter_name === undefined) normalized.parameter_name = name;

  const valueRaw = normalizeAliasValue(readSectionAliasValue(value, 'parameters', 'parameter_value'));
  if (valueRaw && normalized.parameter_value === undefined) normalized.parameter_value = valueRaw;

  const valueString = normalizeAliasValue(readSectionAliasValue(value, 'parameters', 'parameter_value_string'));
  if (valueString && normalized.value_string === undefined) normalized.value_string = valueString;

  const valueCode = normalizeAliasValue(readSectionAliasValue(value, 'parameters', 'parameter_value_code'));
  if (valueCode && normalized.value_code === undefined) normalized.value_code = valueCode;

  const valueBoolean = normalizeAliasValue(readSectionAliasValue(value, 'parameters', 'parameter_value_boolean'));
  if (valueBoolean && normalized.value_boolean === undefined) normalized.value_boolean = valueBoolean;

  const valueDate = normalizeAliasValue(readSectionAliasValue(value, 'parameters', 'parameter_value_date'));
  if (valueDate && normalized.value_date === undefined) normalized.value_date = valueDate;

  const valueDateTime = normalizeAliasValue(readSectionAliasValue(value, 'parameters', 'parameter_value_datetime'));
  if (valueDateTime && normalized.value_datetime === undefined) normalized.value_datetime = valueDateTime;

  const valueInteger = normalizeAliasValue(readSectionAliasValue(value, 'parameters', 'parameter_value_integer'));
  if (valueInteger && normalized.value_integer === undefined) normalized.value_integer = valueInteger;

  const valueDecimal = normalizeAliasValue(readSectionAliasValue(value, 'parameters', 'parameter_value_decimal'));
  if (valueDecimal && normalized.value_decimal === undefined) normalized.value_decimal = valueDecimal;

  const valueUri = normalizeAliasValue(readSectionAliasValue(value, 'parameters', 'parameter_value_uri'));
  if (valueUri && normalized.value_uri === undefined) normalized.value_uri = valueUri;

  const valueReference = normalizeAliasValue(readSectionAliasValue(value, 'parameters', 'parameter_value_reference'));
  if (valueReference && normalized.value_reference === undefined) normalized.value_reference = valueReference;

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

function normalizeGlobalAppointmentResponseAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const responseId = readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_id');
  if (normalized.appointment_response_id === undefined && responseId !== undefined) {
    normalized.appointment_response_id = responseId;
  }

  const appointmentId = normalizeAliasValue(readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_appointment_id'));
  if (appointmentId && normalized.appointment_id === undefined) normalized.appointment_id = appointmentId;

  const proposedNewTime = normalizeAliasValue(readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_proposed_new_time'));
  if (proposedNewTime && normalized.proposed_new_time === undefined) normalized.proposed_new_time = proposedNewTime;

  const start = normalizeAliasValue(readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_start'));
  if (start && normalized.start === undefined) normalized.start = start;

  const end = normalizeAliasValue(readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_end'));
  if (end && normalized.end === undefined) normalized.end = end;

  const participantType = normalizeAliasValue(readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_participant_type'));
  if (participantType && normalized.participant_type === undefined) normalized.participant_type = participantType;

  const actorId = normalizeAliasValue(readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_actor_id'));
  if (actorId && normalized.actor_id === undefined) normalized.actor_id = actorId;

  const participantStatus = normalizeAliasValue(readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_participant_status'));
  if (participantStatus && normalized.participant_status === undefined) normalized.participant_status = participantStatus;

  const comment = normalizeAliasValue(readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_comment'));
  if (comment && normalized.comment === undefined) normalized.comment = comment;

  const recurring = normalizeAliasValue(readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_recurring'));
  if (recurring && normalized.recurring === undefined) normalized.recurring = recurring;

  const occurrenceDate = normalizeAliasValue(readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_occurrence_date'));
  if (occurrenceDate && normalized.occurrence_date === undefined) normalized.occurrence_date = occurrenceDate;

  const recurrenceId = normalizeAliasValue(readSectionAliasValue(value, 'appointmentResponse', 'appointment_response_recurrence_id'));
  if (recurrenceId && normalized.recurrence_id === undefined) normalized.recurrence_id = recurrenceId;

  return normalized;
}

function normalizeGlobalClaimAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const claimId = readSectionAliasValue(value, 'claim', 'claim_id');
  if (normalized.claim_id === undefined && claimId !== undefined) {
    normalized.claim_id = claimId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_type'));
  if (type && normalized.type === undefined) {
    normalized.type = { code: type, display: type };
  }

  const subType = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_sub_type'));
  if (subType && normalized.sub_type === undefined) {
    normalized.sub_type = { code: subType, display: subType };
  }

  const use = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_use'));
  if (use && normalized.use === undefined) normalized.use = use;

  const patientId = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_patient_id'));
  if (patientId && normalized.patient_id === undefined) normalized.patient_id = patientId;

  const billableStart = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_billable_start'));
  if (billableStart && normalized.billable_start === undefined) normalized.billable_start = billableStart;

  const billableEnd = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_billable_end'));
  if (billableEnd && normalized.billable_end === undefined) normalized.billable_end = billableEnd;

  const created = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_created'));
  if (created && normalized.created === undefined) normalized.created = created;

  const entererId = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_enterer_id'));
  if (entererId && normalized.enterer_id === undefined) normalized.enterer_id = entererId;

  const insurerId = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_insurer_id'));
  if (insurerId && normalized.insurer_id === undefined) normalized.insurer_id = insurerId;

  const providerId = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_provider_id'));
  if (providerId && normalized.provider_id === undefined) normalized.provider_id = providerId;

  const priority = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_priority'));
  if (priority && normalized.priority === undefined) {
    normalized.priority = { code: priority, display: priority };
  }

  const fundsReserve = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_funds_reserve'));
  if (fundsReserve && normalized.funds_reserve === undefined) {
    normalized.funds_reserve = { code: fundsReserve, display: fundsReserve };
  }

  const referralId = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_referral_id'));
  if (referralId && normalized.referral_id === undefined) normalized.referral_id = referralId;

  const facilityId = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_facility_id'));
  if (facilityId && normalized.facility_id === undefined) normalized.facility_id = facilityId;

  const prescriptionId = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_prescription_id'));
  if (prescriptionId && normalized.prescription_id === undefined) normalized.prescription_id = prescriptionId;

  const originalPrescriptionId = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_original_prescription_id'));
  if (originalPrescriptionId && normalized.original_prescription_id === undefined) normalized.original_prescription_id = originalPrescriptionId;

  const drg = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_drg'));
  if (drg && normalized.diagnosis_related_group === undefined) {
    normalized.diagnosis_related_group = { code: drg, display: drg };
  }

  const accidentDate = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_accident_date'));
  const accidentType = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_accident_type'));
  if ((accidentDate || accidentType) && normalized.accident === undefined) {
    normalized.accident = {
      date: accidentDate,
      type: accidentType ? { code: accidentType, display: accidentType } : undefined
    };
  }

  const patientPaidValue = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_patient_paid_value'));
  const patientPaidCurrency = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_patient_paid_currency'));
  if ((patientPaidValue || patientPaidCurrency) && normalized.patient_paid === undefined) {
    normalized.patient_paid = {
      value: patientPaidValue,
      currency: patientPaidCurrency
    };
  }

  const totalValue = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_total_value'));
  const totalCurrency = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_total_currency'));
  if ((totalValue || totalCurrency) && normalized.total === undefined) {
    normalized.total = {
      value: totalValue,
      currency: totalCurrency
    };
  }

  const itemSequence = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_item_sequence'));
  const itemProduct = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_item_product_or_service'));
  const itemQuantity = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_item_quantity'));
  const itemUnitPrice = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_item_unit_price'));
  const itemNet = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_item_net'));
  const itemPatientPaid = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_item_patient_paid'));
  const itemLocation = normalizeAliasValue(readSectionAliasValue(value, 'claim', 'claim_item_location_id'));
  if ((itemSequence || itemProduct || itemQuantity || itemUnitPrice || itemNet || itemPatientPaid || itemLocation)
    && normalized.item === undefined
  ) {
    normalized.item = [{
      sequence: itemSequence,
      product_or_service: itemProduct ? { code: itemProduct, display: itemProduct } : undefined,
      quantity: itemQuantity ? { value: itemQuantity } : undefined,
      unit_price: itemUnitPrice ? { value: itemUnitPrice } : undefined,
      net: itemNet ? { value: itemNet } : undefined,
      patient_paid: itemPatientPaid ? { value: itemPatientPaid } : undefined,
      location_reference_id: itemLocation
    }];
  }

  return normalized;
}

function normalizeGlobalClaimResponseAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const responseId = readSectionAliasValue(value, 'claimResponse', 'claim_response_id');
  if (normalized.claim_response_id === undefined && responseId !== undefined) {
    normalized.claim_response_id = responseId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_type'));
  if (type && normalized.type === undefined) normalized.type = { code: type, display: type };

  const subType = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_sub_type'));
  if (subType && normalized.sub_type === undefined) normalized.sub_type = { code: subType, display: subType };

  const use = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_use'));
  if (use && normalized.use === undefined) normalized.use = use;

  const patientId = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_patient_id'));
  if (patientId && normalized.patient_id === undefined) normalized.patient_id = patientId;

  const created = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_created'));
  if (created && normalized.created === undefined) normalized.created = created;

  const insurerId = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_insurer_id'));
  if (insurerId && normalized.insurer_id === undefined) normalized.insurer_id = insurerId;

  const requestorId = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_requestor_id'));
  if (requestorId && normalized.requestor_id === undefined) normalized.requestor_id = requestorId;

  const requestId = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_request_id'));
  if (requestId && normalized.request_id === undefined) normalized.request_id = requestId;

  const outcome = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_outcome'));
  if (outcome && normalized.outcome === undefined) normalized.outcome = outcome;

  const disposition = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_disposition'));
  if (disposition && normalized.disposition === undefined) normalized.disposition = disposition;

  const preAuthRef = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_pre_auth_ref'));
  if (preAuthRef && normalized.pre_auth_ref === undefined) normalized.pre_auth_ref = preAuthRef;

  const preAuthStart = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_pre_auth_start'));
  if (preAuthStart && normalized.pre_auth_start === undefined) normalized.pre_auth_start = preAuthStart;

  const preAuthEnd = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_pre_auth_end'));
  if (preAuthEnd && normalized.pre_auth_end === undefined) normalized.pre_auth_end = preAuthEnd;

  const payeeType = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_payee_type'));
  if (payeeType && normalized.payee_type === undefined) normalized.payee_type = { code: payeeType, display: payeeType };

  const totalValue = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_total_value'));
  const totalCurrency = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_total_currency'));
  if ((totalValue || totalCurrency) && normalized.total === undefined) {
    normalized.total = [{
      amount: {
        value: totalValue,
        currency: totalCurrency
      }
    }];
  }

  const itemSequence = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_item_sequence'));
  const itemCategory = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_item_category'));
  const itemAmount = normalizeAliasValue(readSectionAliasValue(value, 'claimResponse', 'claim_response_item_amount'));
  if ((itemSequence || itemCategory || itemAmount) && normalized.item === undefined) {
    normalized.item = [{
      item_sequence: itemSequence,
      adjudication: (itemCategory || itemAmount) ? [{
        category: itemCategory ? { code: itemCategory, display: itemCategory } : undefined,
        amount: itemAmount ? { value: itemAmount } : undefined
      }] : undefined
    }];
  }

  return normalized;
}

function normalizeGlobalCompositionAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const compositionId = readSectionAliasValue(value, 'composition', 'composition_id');
  if (normalized.composition_id === undefined && compositionId !== undefined) {
    normalized.composition_id = compositionId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'composition', 'composition_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'composition', 'composition_type'));
  if (type && normalized.type === undefined) normalized.type = { code: type, display: type };

  const title = normalizeAliasValue(readSectionAliasValue(value, 'composition', 'composition_title'));
  if (title && normalized.title === undefined) normalized.title = title;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'composition', 'composition_subject_id'));
  if (subjectId && normalized.subject_ids === undefined) normalized.subject_ids = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'composition', 'composition_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const authorId = normalizeAliasValue(readSectionAliasValue(value, 'composition', 'composition_author_id'));
  if (authorId && normalized.author_ids === undefined) normalized.author_ids = authorId;

  const date = normalizeAliasValue(readSectionAliasValue(value, 'composition', 'composition_date'));
  if (date && normalized.date === undefined) normalized.date = date;

  const url = normalizeAliasValue(readSectionAliasValue(value, 'composition', 'composition_url'));
  if (url && normalized.url === undefined) normalized.url = url;

  const version = normalizeAliasValue(readSectionAliasValue(value, 'composition', 'composition_version'));
  if (version && normalized.version === undefined) normalized.version = version;

  return normalized;
}

function normalizeGlobalCoverageAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const coverageId = readSectionAliasValue(value, 'coverage', 'coverage_id');
  if (normalized.coverage_id === undefined && coverageId !== undefined) {
    normalized.coverage_id = coverageId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const kind = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_kind'));
  if (kind && normalized.kind === undefined) normalized.kind = kind;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_type'));
  if (type && normalized.type === undefined) normalized.type = { code: type, display: type };

  const policyHolderId = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_policy_holder_id'));
  if (policyHolderId && normalized.policy_holder_id === undefined) normalized.policy_holder_id = policyHolderId;

  const subscriberId = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_subscriber_id'));
  if (subscriberId && normalized.subscriber_id === undefined) normalized.subscriber_id = subscriberId;

  const beneficiaryId = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_beneficiary_id'));
  if (beneficiaryId && normalized.beneficiary_id === undefined) normalized.beneficiary_id = beneficiaryId;

  const dependent = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_dependent'));
  if (dependent && normalized.dependent === undefined) normalized.dependent = dependent;

  const relationship = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_relationship'));
  if (relationship && normalized.relationship === undefined) {
    normalized.relationship = { code: relationship, display: relationship };
  }

  const periodStart = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_period_start'));
  if (periodStart && normalized.period_start === undefined) normalized.period_start = periodStart;

  const periodEnd = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_period_end'));
  if (periodEnd && normalized.period_end === undefined) normalized.period_end = periodEnd;

  const insurerId = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_insurer_id'));
  if (insurerId && normalized.insurer_id === undefined) normalized.insurer_id = insurerId;

  const classType = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_class_type'));
  const classValue = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_class_value'));
  const className = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_class_name'));
  if ((classType || classValue || className) && normalized.class === undefined) {
    normalized.class = [{
      type: classType ? { code: classType, display: classType } : undefined,
      value: classValue ? { value: classValue } : undefined,
      name: className
    }];
  }

  const order = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_order'));
  if (order && normalized.order === undefined) normalized.order = order;

  const network = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_network'));
  if (network && normalized.network === undefined) normalized.network = network;

  const paymentPartyId = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_payment_party_id'));
  const paymentResponsibility = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_payment_responsibility'));
  if ((paymentPartyId || paymentResponsibility) && normalized.payment_by === undefined) {
    normalized.payment_by = [{
      party_id: paymentPartyId,
      responsibility: paymentResponsibility
    }];
  }

  const costType = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_type'));
  const costCategory = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_category'));
  const costNetwork = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_network'));
  const costUnit = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_unit'));
  const costTerm = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_term'));
  const costValueQuantity = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_value_quantity'));
  const costValueUnit = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_value_unit'));
  const costValueMoney = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_value_money'));
  const costCurrency = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_currency'));
  const costExceptionType = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_exception_type'));
  const costExceptionStart = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_exception_start'));
  const costExceptionEnd = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_cost_exception_end'));
  if ((costType || costCategory || costNetwork || costUnit || costTerm || costValueQuantity || costValueMoney || costCurrency || costExceptionType || costExceptionStart || costExceptionEnd)
    && normalized.cost_to_beneficiary === undefined
  ) {
    normalized.cost_to_beneficiary = [{
      type: costType ? { code: costType, display: costType } : undefined,
      category: costCategory ? { code: costCategory, display: costCategory } : undefined,
      network: costNetwork ? { code: costNetwork, display: costNetwork } : undefined,
      unit: costUnit ? { code: costUnit, display: costUnit } : undefined,
      term: costTerm ? { code: costTerm, display: costTerm } : undefined,
      value_quantity: costValueQuantity || costValueUnit ? {
        value: costValueQuantity,
        unit: costValueUnit
      } : undefined,
      value_money: costValueMoney || costCurrency ? {
        value: costValueMoney,
        currency: costCurrency
      } : undefined,
      exception: (costExceptionType || costExceptionStart || costExceptionEnd) ? [{
        type: costExceptionType ? { code: costExceptionType, display: costExceptionType } : undefined,
        start: costExceptionStart,
        end: costExceptionEnd
      }] : undefined
    }];
  }

  const subrogation = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_subrogation'));
  if (subrogation && normalized.subrogation === undefined) normalized.subrogation = subrogation;

  const contractId = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_contract_id'));
  if (contractId && normalized.contract_ids === undefined) normalized.contract_ids = contractId;

  const insurancePlanId = normalizeAliasValue(readSectionAliasValue(value, 'coverage', 'coverage_insurance_plan_id'));
  if (insurancePlanId && normalized.insurance_plan_id === undefined) normalized.insurance_plan_id = insurancePlanId;

  return normalized;
}

function normalizeGlobalAccountAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const accountId = readSectionAliasValue(value, 'account', 'account_id');
  if (normalized.account_id === undefined && accountId !== undefined) {
    normalized.account_id = accountId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const billingStatus = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_billing_status'));
  if (billingStatus && normalized.billing_status === undefined) {
    normalized.billing_status = { code: billingStatus, display: billingStatus };
  }

  const type = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_type'));
  if (type && normalized.type === undefined) normalized.type = { code: type, display: type };

  const name = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const subjectIds = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_subject_ids'));
  if (subjectIds && normalized.subject_ids === undefined) normalized.subject_ids = subjectIds;

  const servicePeriodStart = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_service_period_start'));
  if (servicePeriodStart && normalized.service_period_start === undefined) normalized.service_period_start = servicePeriodStart;

  const servicePeriodEnd = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_service_period_end'));
  if (servicePeriodEnd && normalized.service_period_end === undefined) normalized.service_period_end = servicePeriodEnd;

  const coverageId = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_coverage_id'));
  const coveragePriority = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_coverage_priority'));
  if ((coverageId || coveragePriority) && normalized.coverage === undefined) {
    normalized.coverage = [{
      coverage_id: coverageId,
      priority: coveragePriority
    }];
  }

  const ownerId = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_owner_id'));
  if (ownerId && normalized.owner_id === undefined) normalized.owner_id = ownerId;

  const description = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const guarantorPartyId = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_guarantor_party_id'));
  const guarantorOnHold = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_guarantor_on_hold'));
  const guarantorStart = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_guarantor_period_start'));
  const guarantorEnd = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_guarantor_period_end'));
  if ((guarantorPartyId || guarantorOnHold || guarantorStart || guarantorEnd) && normalized.guarantor === undefined) {
    normalized.guarantor = [{
      party_id: guarantorPartyId,
      on_hold: guarantorOnHold,
      period_start: guarantorStart,
      period_end: guarantorEnd
    }];
  }

  const currency = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_currency'));
  if (currency && normalized.currency === undefined) {
    normalized.currency = { code: currency, display: currency };
  }

  const balanceAmount = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_balance_amount'));
  const balanceCurrency = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_balance_currency'));
  if ((balanceAmount || balanceCurrency) && normalized.balance === undefined) {
    normalized.balance = [{
      amount: {
        value: balanceAmount,
        currency: balanceCurrency
      }
    }];
  }

  const calculatedAt = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_calculated_at'));
  if (calculatedAt && normalized.calculated_at === undefined) normalized.calculated_at = calculatedAt;

  const relatedAccountId = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_related_account_id'));
  const relatedRelationship = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_related_account_relationship'));
  if ((relatedAccountId || relatedRelationship) && normalized.related_account === undefined) {
    normalized.related_account = [{
      account_id: relatedAccountId,
      relationship: relatedRelationship ? { code: relatedRelationship, display: relatedRelationship } : undefined
    }];
  }

  const diagnosisConditionId = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_diagnosis_condition_id'));
  const diagnosisSequence = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_diagnosis_sequence'));
  const diagnosisDate = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_diagnosis_date'));
  if ((diagnosisConditionId || diagnosisSequence || diagnosisDate) && normalized.diagnosis === undefined) {
    normalized.diagnosis = [{
      condition_id: diagnosisConditionId,
      sequence: diagnosisSequence,
      date_of_diagnosis: diagnosisDate
    }];
  }

  const procedureCode = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_procedure_code'));
  const procedureSequence = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_procedure_sequence'));
  const procedureDate = normalizeAliasValue(readSectionAliasValue(value, 'account', 'account_procedure_date'));
  if ((procedureCode || procedureSequence || procedureDate) && normalized.procedure === undefined) {
    normalized.procedure = [{
      procedure_code: procedureCode ? { code: procedureCode, display: procedureCode } : undefined,
      sequence: procedureSequence,
      date_of_service: procedureDate
    }];
  }

  return normalized;
}

function normalizeGlobalChargeItemAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const chargeItemId = readSectionAliasValue(value, 'chargeItem', 'charge_item_id');
  if (normalized.charge_item_id === undefined && chargeItemId !== undefined) {
    normalized.charge_item_id = chargeItemId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const code = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_code'));
  if (code && normalized.code === undefined) normalized.code = { code, display: code };

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const occurrenceDateTime = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_occurrence_date_time'));
  if (occurrenceDateTime && normalized.occurrence_date_time === undefined) normalized.occurrence_date_time = occurrenceDateTime;

  const occurrenceStart = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_occurrence_start'));
  if (occurrenceStart && normalized.occurrence_start === undefined) normalized.occurrence_start = occurrenceStart;

  const occurrenceEnd = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_occurrence_end'));
  if (occurrenceEnd && normalized.occurrence_end === undefined) normalized.occurrence_end = occurrenceEnd;

  const quantityValue = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_quantity_value'));
  const quantityUnit = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_quantity_unit'));
  if ((quantityValue || quantityUnit) && normalized.quantity === undefined) {
    normalized.quantity = {
      value: quantityValue,
      unit: quantityUnit
    };
  }

  const entererId = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_enterer_id'));
  if (entererId && normalized.enterer_id === undefined) normalized.enterer_id = entererId;

  const enteredDate = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_entered_date'));
  if (enteredDate && normalized.entered_date === undefined) normalized.entered_date = enteredDate;

  const accountId = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_account_id'));
  if (accountId && normalized.account_ids === undefined) normalized.account_ids = accountId;

  const totalPriceValue = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_total_price_value'));
  const totalPriceCurrency = normalizeAliasValue(readSectionAliasValue(value, 'chargeItem', 'charge_item_total_price_currency'));
  if ((totalPriceValue || totalPriceCurrency) && normalized.total_price_value === undefined) {
    normalized.total_price_value = totalPriceValue;
    normalized.total_price_currency = totalPriceCurrency;
  }

  return normalized;
}

function normalizeGlobalChargeItemDefinitionAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const definitionId = readSectionAliasValue(value, 'chargeItemDefinition', 'charge_item_definition_id');
  if (normalized.charge_item_definition_id === undefined && definitionId !== undefined) {
    normalized.charge_item_definition_id = definitionId;
  }

  const url = normalizeAliasValue(readSectionAliasValue(value, 'chargeItemDefinition', 'charge_item_definition_url'));
  if (url && normalized.url === undefined) normalized.url = url;

  const version = normalizeAliasValue(readSectionAliasValue(value, 'chargeItemDefinition', 'charge_item_definition_version'));
  if (version && normalized.version === undefined) normalized.version = version;

  const status = normalizeAliasValue(readSectionAliasValue(value, 'chargeItemDefinition', 'charge_item_definition_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const code = normalizeAliasValue(readSectionAliasValue(value, 'chargeItemDefinition', 'charge_item_definition_code'));
  if (code && normalized.code === undefined) normalized.code = { code, display: code };

  const name = normalizeAliasValue(readSectionAliasValue(value, 'chargeItemDefinition', 'charge_item_definition_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const title = normalizeAliasValue(readSectionAliasValue(value, 'chargeItemDefinition', 'charge_item_definition_title'));
  if (title && normalized.title === undefined) normalized.title = title;

  const publisher = normalizeAliasValue(readSectionAliasValue(value, 'chargeItemDefinition', 'charge_item_definition_publisher'));
  if (publisher && normalized.publisher === undefined) normalized.publisher = publisher;

  const date = normalizeAliasValue(readSectionAliasValue(value, 'chargeItemDefinition', 'charge_item_definition_date'));
  if (date && normalized.date === undefined) normalized.date = date;

  return normalized;
}

function normalizeGlobalDeviceAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const deviceId = readSectionAliasValue(value, 'device', 'device_id');
  if (normalized.device_id === undefined && deviceId !== undefined) {
    normalized.device_id = deviceId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'device', 'device_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const displayName = normalizeAliasValue(readSectionAliasValue(value, 'device', 'device_display_name'));
  if (displayName && normalized.display_name === undefined) normalized.display_name = displayName;

  const manufacturer = normalizeAliasValue(readSectionAliasValue(value, 'device', 'device_manufacturer'));
  if (manufacturer && normalized.manufacturer === undefined) normalized.manufacturer = manufacturer;

  const modelNumber = normalizeAliasValue(readSectionAliasValue(value, 'device', 'device_model_number'));
  if (modelNumber && normalized.model_number === undefined) normalized.model_number = modelNumber;

  const serialNumber = normalizeAliasValue(readSectionAliasValue(value, 'device', 'device_serial_number'));
  if (serialNumber && normalized.serial_number === undefined) normalized.serial_number = serialNumber;

  const lotNumber = normalizeAliasValue(readSectionAliasValue(value, 'device', 'device_lot_number'));
  if (lotNumber && normalized.lot_number === undefined) normalized.lot_number = lotNumber;

  const ownerId = normalizeAliasValue(readSectionAliasValue(value, 'device', 'device_owner_id'));
  if (ownerId && normalized.owner_id === undefined) normalized.owner_id = ownerId;

  const locationId = normalizeAliasValue(readSectionAliasValue(value, 'device', 'device_location_id'));
  if (locationId && normalized.location_id === undefined) normalized.location_id = locationId;

  return normalized;
}

function normalizeGlobalDeviceMetricAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const metricId = readSectionAliasValue(value, 'deviceMetric', 'device_metric_id');
  if (normalized.device_metric_id === undefined && metricId !== undefined) {
    normalized.device_metric_id = metricId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'deviceMetric', 'device_metric_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'deviceMetric', 'device_metric_type'));
  if (type && normalized.type === undefined) normalized.type = { code: type, display: type };

  const unit = normalizeAliasValue(readSectionAliasValue(value, 'deviceMetric', 'device_metric_unit'));
  if (unit && normalized.unit === undefined) normalized.unit = { code: unit, display: unit };

  const deviceId = normalizeAliasValue(readSectionAliasValue(value, 'deviceMetric', 'device_metric_device_id'));
  if (deviceId && normalized.device_id === undefined) normalized.device_id = deviceId;

  const operationalStatus = normalizeAliasValue(readSectionAliasValue(value, 'deviceMetric', 'device_metric_operational_status'));
  if (operationalStatus && normalized.operational_status === undefined) normalized.operational_status = operationalStatus;

  const color = normalizeAliasValue(readSectionAliasValue(value, 'deviceMetric', 'device_metric_color'));
  if (color && normalized.color === undefined) normalized.color = color;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'deviceMetric', 'device_metric_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const freqValue = normalizeAliasValue(readSectionAliasValue(value, 'deviceMetric', 'device_metric_frequency_value'));
  const freqUnit = normalizeAliasValue(readSectionAliasValue(value, 'deviceMetric', 'device_metric_frequency_unit'));
  if ((freqValue || freqUnit) && normalized.measurement_frequency === undefined) {
    normalized.measurement_frequency = {
      value: freqValue,
      unit: freqUnit
    };
  }

  return normalized;
}

function normalizeGlobalEndpointAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const endpointId = readSectionAliasValue(value, 'endpoint', 'endpoint_id');
  if (normalized.endpoint_id === undefined && endpointId !== undefined) {
    normalized.endpoint_id = endpointId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'endpoint', 'endpoint_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const name = normalizeAliasValue(readSectionAliasValue(value, 'endpoint', 'endpoint_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const description = normalizeAliasValue(readSectionAliasValue(value, 'endpoint', 'endpoint_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const address = normalizeAliasValue(readSectionAliasValue(value, 'endpoint', 'endpoint_address'));
  if (address && normalized.address === undefined) normalized.address = address;

  const managingOrgId = normalizeAliasValue(readSectionAliasValue(value, 'endpoint', 'endpoint_managing_organization_id'));
  if (managingOrgId && normalized.managing_organization_id === undefined) normalized.managing_organization_id = managingOrgId;

  const connectionType = normalizeAliasValue(readSectionAliasValue(value, 'endpoint', 'endpoint_connection_type'));
  if (connectionType && normalized.connection_type === undefined) {
    normalized.connection_type = [{ code: connectionType, display: connectionType }];
  }

  const environmentType = normalizeAliasValue(readSectionAliasValue(value, 'endpoint', 'endpoint_environment_type'));
  if (environmentType && normalized.environment_type === undefined) {
    normalized.environment_type = [{ code: environmentType, display: environmentType }];
  }

  return normalized;
}

function normalizeGlobalExplanationOfBenefitAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const eobId = readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_id');
  if (normalized.explanation_of_benefit_id === undefined && eobId !== undefined) {
    normalized.explanation_of_benefit_id = eobId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_type'));
  if (type && normalized.type === undefined) normalized.type = { code: type, display: type };

  const subType = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_sub_type'));
  if (subType && normalized.sub_type === undefined) normalized.sub_type = { code: subType, display: subType };

  const use = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_use'));
  if (use && normalized.use === undefined) normalized.use = use;

  const patientId = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_patient_id'));
  if (patientId && normalized.patient_id === undefined) normalized.patient_id = patientId;

  const billableStart = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_billable_start'));
  if (billableStart && normalized.billable_start === undefined) normalized.billable_start = billableStart;

  const billableEnd = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_billable_end'));
  if (billableEnd && normalized.billable_end === undefined) normalized.billable_end = billableEnd;

  const created = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_created'));
  if (created && normalized.created === undefined) normalized.created = created;

  const entererId = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_enterer_id'));
  if (entererId && normalized.enterer_id === undefined) normalized.enterer_id = entererId;

  const insurerId = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_insurer_id'));
  if (insurerId && normalized.insurer_id === undefined) normalized.insurer_id = insurerId;

  const providerId = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_provider_id'));
  if (providerId && normalized.provider_id === undefined) normalized.provider_id = providerId;

  const priority = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_priority'));
  if (priority && normalized.priority === undefined) normalized.priority = { code: priority, display: priority };

  const claimId = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_claim_id'));
  if (claimId && normalized.claim_id === undefined) normalized.claim_id = claimId;

  const claimResponseId = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_claim_response_id'));
  if (claimResponseId && normalized.claim_response_id === undefined) normalized.claim_response_id = claimResponseId;

  const outcome = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_outcome'));
  if (outcome && normalized.outcome === undefined) normalized.outcome = outcome;

  const disposition = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_disposition'));
  if (disposition && normalized.disposition === undefined) normalized.disposition = disposition;

  const preAuthRef = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_pre_auth_ref'));
  if (preAuthRef && normalized.pre_auth_ref === undefined) normalized.pre_auth_ref = preAuthRef;

  const totalValue = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_total_value'));
  const totalCurrency = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_total_currency'));
  if ((totalValue || totalCurrency) && normalized.total === undefined) {
    normalized.total = [{
      amount: {
        value: totalValue,
        currency: totalCurrency
      }
    }];
  }

  const itemSequence = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_item_sequence'));
  const itemProduct = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_item_product_or_service'));
  const itemQuantity = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_item_quantity'));
  const itemUnitPrice = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_item_unit_price'));
  const itemNet = normalizeAliasValue(readSectionAliasValue(value, 'explanationOfBenefit', 'explanation_of_benefit_item_net'));
  if ((itemSequence || itemProduct || itemQuantity || itemUnitPrice || itemNet) && normalized.item === undefined) {
    normalized.item = [{
      sequence: itemSequence,
      product_or_service: itemProduct ? { code: itemProduct, display: itemProduct } : undefined,
      quantity: itemQuantity ? { value: itemQuantity } : undefined,
      unit_price: itemUnitPrice ? { value: itemUnitPrice } : undefined,
      net: itemNet ? { value: itemNet } : undefined
    }];
  }

  return normalized;
}

function normalizeGlobalBinaryAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const binaryId = readSectionAliasValue(value, 'binary', 'binary_id');
  if (normalized.binary_id === undefined && binaryId !== undefined) {
    normalized.binary_id = binaryId;
  }

  const contentType = normalizeAliasValue(readSectionAliasValue(value, 'binary', 'binary_content_type'));
  if (contentType && normalized.content_type === undefined) normalized.content_type = contentType;

  const securityContext = normalizeAliasValue(readSectionAliasValue(value, 'binary', 'binary_security_context'));
  if (securityContext && normalized.security_context === undefined) normalized.security_context = securityContext;

  const data = normalizeAliasValue(readSectionAliasValue(value, 'binary', 'binary_data'));
  if (data && normalized.data === undefined) normalized.data = data;

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

function normalizeGlobalPersonAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const personId = readSectionAliasValue(value, 'person', 'person_id');
  if (normalized.person_id === undefined && personId !== undefined) {
    normalized.person_id = personId;
  }

  const active = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_active'));
  if (active !== undefined && normalized.active === undefined) normalized.active = active;

  const firstName = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_first_name'));
  if (firstName && normalized.first_name === undefined) normalized.first_name = firstName;

  const lastName = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_last_name'));
  if (lastName && normalized.last_name === undefined) normalized.last_name = lastName;

  const phone = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_phone'));
  if (phone && normalized.phone === undefined) normalized.phone = phone;

  const email = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_email'));
  if (email && normalized.email === undefined) normalized.email = email;

  const gender = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_gender'));
  if (gender && normalized.gender === undefined) normalized.gender = gender;

  const birthDate = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_birth_date'));
  if (birthDate && normalized.birth_date === undefined) normalized.birth_date = birthDate;

  const deceased = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_deceased'));
  if (deceased !== undefined && normalized.deceased === undefined) normalized.deceased = deceased;

  const deceasedDate = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_deceased_date'));
  if (deceasedDate && normalized.deceased_date === undefined) normalized.deceased_date = deceasedDate;

  const addressLine1 = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_address_line1'));
  if (addressLine1 && normalized.address_line1 === undefined) normalized.address_line1 = addressLine1;

  const addressLine2 = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_address_line2'));
  if (addressLine2 && normalized.address_line2 === undefined) normalized.address_line2 = addressLine2;

  const city = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_city'));
  if (city && normalized.city === undefined) normalized.city = city;

  const state = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_state'));
  if (state && normalized.state === undefined) normalized.state = state;

  const postalCode = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_postal_code'));
  if (postalCode && normalized.postal_code === undefined) normalized.postal_code = postalCode;

  const country = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_country'));
  if (country && normalized.country === undefined) normalized.country = country;

  const maritalStatus = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_marital_status'));
  if (maritalStatus && normalized.marital_status === undefined) normalized.marital_status = maritalStatus;

  const language = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_language'));
  if (language && normalized.language === undefined) normalized.language = language;

  const languagePreferred = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_language_preferred'));
  if (languagePreferred !== undefined && normalized.language_preferred === undefined) {
    normalized.language_preferred = languagePreferred;
  }

  const managingOrgId = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_managing_organization_id'));
  if (managingOrgId && normalized.managing_organization_id === undefined) normalized.managing_organization_id = managingOrgId;

  const linkTarget = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_link_target'));
  if (linkTarget && normalized.link_target === undefined) normalized.link_target = linkTarget;

  const linkAssurance = normalizeAliasValue(readSectionAliasValue(value, 'person', 'person_link_assurance'));
  if (linkAssurance && normalized.link_assurance === undefined) normalized.link_assurance = linkAssurance;

  return normalized;
}

function normalizeGlobalSubstanceAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const substanceId = readSectionAliasValue(value, 'substance', 'substance_id');
  if (normalized.substance_id === undefined && substanceId !== undefined) {
    normalized.substance_id = substanceId;
  }

  const identifier = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_identifier'));
  if (identifier && normalized.identifier === undefined) normalized.identifier = identifier;

  const instance = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_instance'));
  if (instance !== undefined && normalized.instance === undefined) normalized.instance = instance;

  const status = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const code = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_code'));
  const codeSystem = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_code_system'));
  const display = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_display'));
  if ((code || codeSystem || display) && normalized.code === undefined) {
    normalized.code = {
      code,
      code_system: codeSystem,
      display
    };
  }

  const description = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const expiry = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_expiry'));
  if (expiry && normalized.expiry === undefined) normalized.expiry = expiry;

  const quantityValue = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_quantity_value'));
  if (quantityValue !== undefined && normalized.quantity_value === undefined) normalized.quantity_value = quantityValue;

  const quantityUnit = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_quantity_unit'));
  if (quantityUnit && normalized.quantity_unit === undefined) normalized.quantity_unit = quantityUnit;

  const ingredientSubstance = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_ingredient_substance'));
  if (ingredientSubstance && normalized.ingredient_substance === undefined) normalized.ingredient_substance = ingredientSubstance;

  const ingredientSubstanceSystem = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_ingredient_substance_system'));
  if (ingredientSubstanceSystem && normalized.ingredient_substance_system === undefined) normalized.ingredient_substance_system = ingredientSubstanceSystem;

  const ingredientSubstanceDisplay = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_ingredient_substance_display'));
  if (ingredientSubstanceDisplay && normalized.ingredient_substance_display === undefined) normalized.ingredient_substance_display = ingredientSubstanceDisplay;

  const numeratorValue = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_ingredient_quantity_numerator_value'));
  if (numeratorValue !== undefined && normalized.ingredient_quantity_numerator_value === undefined) {
    normalized.ingredient_quantity_numerator_value = numeratorValue;
  }

  const numeratorUnit = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_ingredient_quantity_numerator_unit'));
  if (numeratorUnit && normalized.ingredient_quantity_numerator_unit === undefined) {
    normalized.ingredient_quantity_numerator_unit = numeratorUnit;
  }

  const denominatorValue = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_ingredient_quantity_denominator_value'));
  if (denominatorValue !== undefined && normalized.ingredient_quantity_denominator_value === undefined) {
    normalized.ingredient_quantity_denominator_value = denominatorValue;
  }

  const denominatorUnit = normalizeAliasValue(readSectionAliasValue(value, 'substance', 'substance_ingredient_quantity_denominator_unit'));
  if (denominatorUnit && normalized.ingredient_quantity_denominator_unit === undefined) {
    normalized.ingredient_quantity_denominator_unit = denominatorUnit;
  }

  return normalized;
}

function normalizeGlobalVerificationResultAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const verificationId = readSectionAliasValue(value, 'verificationResult', 'verification_result_id');
  if (normalized.verification_result_id === undefined && verificationId !== undefined) {
    normalized.verification_result_id = verificationId;
  }

  const targetIds = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_target_ids'));
  if (targetIds && normalized.target_ids === undefined) normalized.target_ids = targetIds;

  const targetLocation = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_target_location'));
  if (targetLocation && normalized.target_location === undefined) normalized.target_location = targetLocation;

  const need = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_need'));
  if (need && normalized.need === undefined) normalized.need = need;

  const status = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const statusDate = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_status_date'));
  if (statusDate && normalized.status_date === undefined) normalized.status_date = statusDate;

  const validationType = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_validation_type'));
  if (validationType && normalized.validation_type === undefined) normalized.validation_type = validationType;

  const validationProcess = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_validation_process'));
  if (validationProcess && normalized.validation_process === undefined) normalized.validation_process = validationProcess;

  const frequency = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_frequency'));
  if (frequency && normalized.frequency === undefined) normalized.frequency = frequency;

  const lastPerformed = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_last_performed'));
  if (lastPerformed && normalized.last_performed === undefined) normalized.last_performed = lastPerformed;

  const nextScheduled = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_next_scheduled'));
  if (nextScheduled && normalized.next_scheduled === undefined) normalized.next_scheduled = nextScheduled;

  const failureAction = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_failure_action'));
  if (failureAction && normalized.failure_action === undefined) normalized.failure_action = failureAction;

  const primarySourceWho = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_primary_source_who_id'));
  if (primarySourceWho && normalized.primary_source_who_id === undefined) normalized.primary_source_who_id = primarySourceWho;

  const primarySourceType = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_primary_source_type'));
  if (primarySourceType && normalized.primary_source_type === undefined) normalized.primary_source_type = primarySourceType;

  const primarySourceComm = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_primary_source_communication_method'));
  if (primarySourceComm && normalized.primary_source_communication_method === undefined) normalized.primary_source_communication_method = primarySourceComm;

  const primarySourceValidationStatus = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_primary_source_validation_status'));
  if (primarySourceValidationStatus && normalized.primary_source_validation_status === undefined) normalized.primary_source_validation_status = primarySourceValidationStatus;

  const primarySourceValidationDate = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_primary_source_validation_date'));
  if (primarySourceValidationDate && normalized.primary_source_validation_date === undefined) normalized.primary_source_validation_date = primarySourceValidationDate;

  const primarySourceCanPush = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_primary_source_can_push_updates'));
  if (primarySourceCanPush && normalized.primary_source_can_push_updates === undefined) normalized.primary_source_can_push_updates = primarySourceCanPush;

  const primarySourcePushType = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_primary_source_push_type_available'));
  if (primarySourcePushType && normalized.primary_source_push_type_available === undefined) normalized.primary_source_push_type_available = primarySourcePushType;

  const attestationWho = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_attestation_who_id'));
  if (attestationWho && normalized.attestation_who_id === undefined) normalized.attestation_who_id = attestationWho;

  const attestationOnBehalfOf = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_attestation_on_behalf_of_id'));
  if (attestationOnBehalfOf && normalized.attestation_on_behalf_of_id === undefined) normalized.attestation_on_behalf_of_id = attestationOnBehalfOf;

  const attestationComm = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_attestation_communication_method'));
  if (attestationComm && normalized.attestation_communication_method === undefined) normalized.attestation_communication_method = attestationComm;

  const attestationDate = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_attestation_date'));
  if (attestationDate && normalized.attestation_date === undefined) normalized.attestation_date = attestationDate;

  const attestationSourceCert = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_attestation_source_identity_certificate'));
  if (attestationSourceCert && normalized.attestation_source_identity_certificate === undefined) {
    normalized.attestation_source_identity_certificate = attestationSourceCert;
  }

  const attestationProxyCert = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_attestation_proxy_identity_certificate'));
  if (attestationProxyCert && normalized.attestation_proxy_identity_certificate === undefined) {
    normalized.attestation_proxy_identity_certificate = attestationProxyCert;
  }

  const attestationProxySignature = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_attestation_proxy_signature'));
  if (attestationProxySignature && normalized.attestation_proxy_signature === undefined) {
    normalized.attestation_proxy_signature = attestationProxySignature;
  }

  const attestationSourceSignature = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_attestation_source_signature'));
  if (attestationSourceSignature && normalized.attestation_source_signature === undefined) {
    normalized.attestation_source_signature = attestationSourceSignature;
  }

  const validatorOrg = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_validator_organization_id'));
  if (validatorOrg && normalized.validator_organization_id === undefined) normalized.validator_organization_id = validatorOrg;

  const validatorIdentity = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_validator_identity_certificate'));
  if (validatorIdentity && normalized.validator_identity_certificate === undefined) normalized.validator_identity_certificate = validatorIdentity;

  const validatorSignature = normalizeAliasValue(readSectionAliasValue(value, 'verificationResult', 'verification_validator_attestation_signature'));
  if (validatorSignature && normalized.validator_attestation_signature === undefined) {
    normalized.validator_attestation_signature = validatorSignature;
  }

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

function normalizeGlobalCarePlanAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const carePlanId = readSectionAliasValue(value, 'carePlan', 'care_plan_id');
  if (normalized.care_plan_id === undefined && carePlanId !== undefined) {
    normalized.care_plan_id = carePlanId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const intent = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_intent'));
  if (intent && normalized.intent === undefined) normalized.intent = intent;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const title = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_title'));
  if (title && normalized.title === undefined) normalized.title = title;

  const description = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const periodStart = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_period_start'));
  if (periodStart && normalized.period_start === undefined) normalized.period_start = periodStart;

  const periodEnd = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_period_end'));
  if (periodEnd && normalized.period_end === undefined) normalized.period_end = periodEnd;

  const created = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_created'));
  if (created && normalized.created === undefined) normalized.created = created;

  const custodianId = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_custodian_id'));
  if (custodianId && normalized.custodian_id === undefined) normalized.custodian_id = custodianId;

  const contributorIds = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_contributor_ids'));
  if (contributorIds && normalized.contributor_ids === undefined) normalized.contributor_ids = contributorIds;

  const careTeamIds = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_care_team_ids'));
  if (careTeamIds && normalized.care_team_ids === undefined) normalized.care_team_ids = careTeamIds;

  const addresses = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_addresses'));
  if (addresses && normalized.addresses === undefined) normalized.addresses = addresses;

  const supportingInfoIds = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_supporting_info_ids'));
  if (supportingInfoIds && normalized.supporting_info_ids === undefined) normalized.supporting_info_ids = supportingInfoIds;

  const goalIds = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_goal_ids'));
  if (goalIds && normalized.goal_ids === undefined) normalized.goal_ids = goalIds;

  const activityReference = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_activity_reference'));
  if (activityReference && normalized.activity_reference === undefined) normalized.activity_reference = activityReference;

  const activityProgress = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_activity_progress'));
  if (activityProgress && normalized.activity_progress === undefined) normalized.activity_progress = activityProgress;

  const activityPerformed = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_activity_performed'));
  if (activityPerformed && normalized.activity_performed === undefined) normalized.activity_performed = activityPerformed;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const instantiatesCanonical = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_instantiates_canonical'));
  if (instantiatesCanonical && normalized.instantiates_canonical === undefined) normalized.instantiates_canonical = instantiatesCanonical;

  const instantiatesUri = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_instantiates_uri'));
  if (instantiatesUri && normalized.instantiates_uri === undefined) normalized.instantiates_uri = instantiatesUri;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const replacesIds = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_replaces_ids'));
  if (replacesIds && normalized.replaces_ids === undefined) normalized.replaces_ids = replacesIds;

  const partOfIds = normalizeAliasValue(readSectionAliasValue(value, 'carePlan', 'care_plan_part_of_ids'));
  if (partOfIds && normalized.part_of_ids === undefined) normalized.part_of_ids = partOfIds;

  return normalized;
}

function normalizeGlobalCareTeamAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const careTeamId = readSectionAliasValue(value, 'careTeam', 'care_team_id');
  if (normalized.care_team_id === undefined && careTeamId !== undefined) {
    normalized.care_team_id = careTeamId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const name = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const periodStart = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_period_start'));
  if (periodStart && normalized.period_start === undefined) normalized.period_start = periodStart;

  const periodEnd = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_period_end'));
  if (periodEnd && normalized.period_end === undefined) normalized.period_end = periodEnd;

  const participantRole = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_participant_role'));
  if (participantRole && normalized.participant_role === undefined) normalized.participant_role = participantRole;

  const participantMemberId = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_participant_member_id'));
  if (participantMemberId && normalized.participant_member_id === undefined) normalized.participant_member_id = participantMemberId;

  const participantOnBehalfOfId = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_participant_on_behalf_of_id'));
  if (participantOnBehalfOfId && normalized.participant_on_behalf_of_id === undefined) normalized.participant_on_behalf_of_id = participantOnBehalfOfId;

  const participantCoverageStart = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_participant_coverage_start'));
  if (participantCoverageStart && normalized.participant_coverage_start === undefined) normalized.participant_coverage_start = participantCoverageStart;

  const participantCoverageEnd = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_participant_coverage_end'));
  if (participantCoverageEnd && normalized.participant_coverage_end === undefined) normalized.participant_coverage_end = participantCoverageEnd;

  const reason = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_reason'));
  if (reason && normalized.reason === undefined) normalized.reason = reason;

  const managingOrgIds = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_managing_org_ids'));
  if (managingOrgIds && normalized.managing_org_ids === undefined) normalized.managing_org_ids = managingOrgIds;

  const phone = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_phone'));
  if (phone && normalized.phone === undefined) normalized.phone = phone;

  const email = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_email'));
  if (email && normalized.email === undefined) normalized.email = email;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'careTeam', 'care_team_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  return normalized;
}

function normalizeGlobalGoalAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const goalId = readSectionAliasValue(value, 'goal', 'goal_id');
  if (normalized.goal_id === undefined && goalId !== undefined) {
    normalized.goal_id = goalId;
  }

  const lifecycleStatus = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_lifecycle_status'));
  if (lifecycleStatus && normalized.lifecycle_status === undefined) normalized.lifecycle_status = lifecycleStatus;

  const achievementStatus = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_achievement_status'));
  if (achievementStatus && normalized.achievement_status === undefined) normalized.achievement_status = achievementStatus;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const continuous = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_continuous'));
  if (continuous && normalized.continuous === undefined) normalized.continuous = continuous;

  const priority = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_priority'));
  if (priority && normalized.priority === undefined) normalized.priority = priority;

  const description = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const startDate = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_start_date'));
  if (startDate && normalized.start_date === undefined) normalized.start_date = startDate;

  const startCode = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_start_code'));
  if (startCode && normalized.start_code === undefined) normalized.start_code = startCode;

  const targetMeasure = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_target_measure'));
  if (targetMeasure && normalized.target_measure === undefined) normalized.target_measure = targetMeasure;

  const targetDetail = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_target_detail'));
  if (targetDetail && normalized.target_detail === undefined) normalized.target_detail = targetDetail;

  const targetDueDate = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_target_due_date'));
  if (targetDueDate && normalized.target_due_date === undefined) normalized.target_due_date = targetDueDate;

  const statusDate = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_status_date'));
  if (statusDate && normalized.status_date === undefined) normalized.status_date = statusDate;

  const statusReason = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_status_reason'));
  if (statusReason && normalized.status_reason === undefined) normalized.status_reason = statusReason;

  const sourceId = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_source_id'));
  if (sourceId && normalized.source_id === undefined) normalized.source_id = sourceId;

  const addresses = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_addresses'));
  if (addresses && normalized.addresses === undefined) normalized.addresses = addresses;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const outcome = normalizeAliasValue(readSectionAliasValue(value, 'goal', 'goal_outcome'));
  if (outcome && normalized.outcome === undefined) normalized.outcome = outcome;

  return normalized;
}

function normalizeGlobalServiceRequestAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const code = isPlainRecord(normalized.code) ? { ...normalized.code } : {};

  const serviceRequestId = readSectionAliasValue(value, 'serviceRequest', 'service_request_id');
  if (normalized.service_request_id === undefined && serviceRequestId !== undefined) {
    normalized.service_request_id = serviceRequestId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const intent = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_intent'));
  if (intent && normalized.intent === undefined) normalized.intent = intent;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const priority = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_priority'));
  if (priority && normalized.priority === undefined) normalized.priority = priority;

  const doNotPerform = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_do_not_perform'));
  if (doNotPerform && normalized.do_not_perform === undefined) normalized.do_not_perform = doNotPerform;

  const codeValue = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_code'));
  if (codeValue && code.code === undefined) code.code = codeValue;

  const codeSystem = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_code_system'));
  if (codeSystem && code.code_system === undefined) code.code_system = codeSystem;

  const codeDisplay = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_code_display'));
  if (codeDisplay && code.display === undefined) code.display = codeDisplay;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const occurrenceDate = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_occurrence_date'));
  if (occurrenceDate && normalized.occurrence_date === undefined) normalized.occurrence_date = occurrenceDate;

  const occurrenceStart = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_occurrence_start'));
  if (occurrenceStart && normalized.occurrence_start === undefined) normalized.occurrence_start = occurrenceStart;

  const occurrenceEnd = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_occurrence_end'));
  if (occurrenceEnd && normalized.occurrence_end === undefined) normalized.occurrence_end = occurrenceEnd;

  const asNeeded = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_as_needed'));
  if (asNeeded && normalized.as_needed === undefined) normalized.as_needed = asNeeded;

  const authoredOn = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_authored_on'));
  if (authoredOn && normalized.authored_on === undefined) normalized.authored_on = authoredOn;

  const requesterId = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_requester_id'));
  if (requesterId && normalized.requester_id === undefined) normalized.requester_id = requesterId;

  const performerType = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_performer_type'));
  if (performerType && normalized.performer_type === undefined) normalized.performer_type = performerType;

  const performerIds = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_performer_ids'));
  if (performerIds && normalized.performer_ids === undefined) normalized.performer_ids = performerIds;

  const locationIds = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_location_ids'));
  if (locationIds && normalized.location_ids === undefined) normalized.location_ids = locationIds;

  const reason = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_reason'));
  if (reason && normalized.reason === undefined) normalized.reason = reason;

  const supportingInfoIds = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_supporting_info_ids'));
  if (supportingInfoIds && normalized.supporting_info_ids === undefined) normalized.supporting_info_ids = supportingInfoIds;

  const specimenIds = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_specimen_ids'));
  if (specimenIds && normalized.specimen_ids === undefined) normalized.specimen_ids = specimenIds;

  const bodySite = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_body_site'));
  if (bodySite && normalized.body_site === undefined) normalized.body_site = bodySite;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const patientInstruction = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_patient_instruction'));
  if (patientInstruction && normalized.patient_instruction === undefined) normalized.patient_instruction = patientInstruction;

  const instantiatesCanonical = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_instantiates_canonical'));
  if (instantiatesCanonical && normalized.instantiates_canonical === undefined) normalized.instantiates_canonical = instantiatesCanonical;

  const instantiatesUri = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_instantiates_uri'));
  if (instantiatesUri && normalized.instantiates_uri === undefined) normalized.instantiates_uri = instantiatesUri;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const replacesIds = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_replaces_ids'));
  if (replacesIds && normalized.replaces_ids === undefined) normalized.replaces_ids = replacesIds;

  const requisition = normalizeAliasValue(readSectionAliasValue(value, 'serviceRequest', 'service_request_requisition'));
  if (requisition && normalized.requisition === undefined) normalized.requisition = requisition;

  if (Object.keys(code).length > 0) normalized.code = code;

  return normalized;
}

function normalizeGlobalTaskAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const code = isPlainRecord(normalized.code) ? { ...normalized.code } : {};

  const taskId = readSectionAliasValue(value, 'task', 'task_id');
  if (normalized.task_id === undefined && taskId !== undefined) {
    normalized.task_id = taskId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const statusReason = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_status_reason'));
  if (statusReason && normalized.status_reason === undefined) normalized.status_reason = statusReason;

  const businessStatus = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_business_status'));
  if (businessStatus && normalized.business_status === undefined) normalized.business_status = businessStatus;

  const intent = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_intent'));
  if (intent && normalized.intent === undefined) normalized.intent = intent;

  const priority = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_priority'));
  if (priority && normalized.priority === undefined) normalized.priority = priority;

  const doNotPerform = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_do_not_perform'));
  if (doNotPerform && normalized.do_not_perform === undefined) normalized.do_not_perform = doNotPerform;

  const codeValue = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_code'));
  if (codeValue && code.code === undefined) code.code = codeValue;

  const codeSystem = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_code_system'));
  if (codeSystem && code.code_system === undefined) code.code_system = codeSystem;

  const codeDisplay = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_code_display'));
  if (codeDisplay && code.display === undefined) code.display = codeDisplay;

  const description = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const focusId = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_focus_id'));
  if (focusId && normalized.focus_id === undefined) normalized.focus_id = focusId;

  const forId = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_for_id'));
  if (forId && normalized.for_id === undefined) normalized.for_id = forId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const requestedStart = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_requested_start'));
  if (requestedStart && normalized.requested_start === undefined) normalized.requested_start = requestedStart;

  const requestedEnd = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_requested_end'));
  if (requestedEnd && normalized.requested_end === undefined) normalized.requested_end = requestedEnd;

  const executionStart = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_execution_start'));
  if (executionStart && normalized.execution_start === undefined) normalized.execution_start = executionStart;

  const executionEnd = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_execution_end'));
  if (executionEnd && normalized.execution_end === undefined) normalized.execution_end = executionEnd;

  const authoredOn = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_authored_on'));
  if (authoredOn && normalized.authored_on === undefined) normalized.authored_on = authoredOn;

  const lastModified = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_last_modified'));
  if (lastModified && normalized.last_modified === undefined) normalized.last_modified = lastModified;

  const requesterId = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_requester_id'));
  if (requesterId && normalized.requester_id === undefined) normalized.requester_id = requesterId;

  const requestedPerformers = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_requested_performer_ids'));
  if (requestedPerformers && normalized.requested_performer_ids === undefined) normalized.requested_performer_ids = requestedPerformers;

  const ownerId = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_owner_id'));
  if (ownerId && normalized.owner_id === undefined) normalized.owner_id = ownerId;

  const performerId = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_performer_id'));
  if (performerId && normalized.performer_id === undefined) normalized.performer_id = performerId;

  const performerFunction = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_performer_function'));
  if (performerFunction && normalized.performer_function === undefined) normalized.performer_function = performerFunction;

  const location = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_location'));
  if (location && normalized.location === undefined) normalized.location = location;

  const reason = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_reason'));
  if (reason && normalized.reason === undefined) normalized.reason = reason;

  const insuranceIds = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_insurance_ids'));
  if (insuranceIds && normalized.insurance_ids === undefined) normalized.insurance_ids = insuranceIds;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const relevantHistoryIds = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_relevant_history_ids'));
  if (relevantHistoryIds && normalized.relevant_history_ids === undefined) normalized.relevant_history_ids = relevantHistoryIds;

  const instantiatesCanonical = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_instantiates_canonical'));
  if (instantiatesCanonical && normalized.instantiates_canonical === undefined) normalized.instantiates_canonical = instantiatesCanonical;

  const instantiatesUri = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_instantiates_uri'));
  if (instantiatesUri && normalized.instantiates_uri === undefined) normalized.instantiates_uri = instantiatesUri;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const partOfIds = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_part_of_ids'));
  if (partOfIds && normalized.part_of_ids === undefined) normalized.part_of_ids = partOfIds;

  const groupIdentifier = normalizeAliasValue(readSectionAliasValue(value, 'task', 'task_group_identifier'));
  if (groupIdentifier && normalized.group_identifier === undefined) normalized.group_identifier = groupIdentifier;

  if (Object.keys(code).length > 0) normalized.code = code;

  return normalized;
}

function normalizeGlobalCommunicationAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const communicationId = readSectionAliasValue(value, 'communication', 'communication_id');
  if (normalized.communication_id === undefined && communicationId !== undefined) {
    normalized.communication_id = communicationId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const statusReason = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_status_reason'));
  if (statusReason && normalized.status_reason === undefined) normalized.status_reason = statusReason;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const priority = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_priority'));
  if (priority && normalized.priority === undefined) normalized.priority = priority;

  const medium = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_medium'));
  if (medium && normalized.medium === undefined) normalized.medium = medium;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const topic = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_topic'));
  if (topic && normalized.topic === undefined) normalized.topic = topic;

  const aboutIds = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_about_ids'));
  if (aboutIds && normalized.about_ids === undefined) normalized.about_ids = aboutIds;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const sent = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_sent'));
  if (sent && normalized.sent === undefined) normalized.sent = sent;

  const received = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_received'));
  if (received && normalized.received === undefined) normalized.received = received;

  const recipientIds = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_recipient_ids'));
  if (recipientIds && normalized.recipient_ids === undefined) normalized.recipient_ids = recipientIds;

  const senderId = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_sender_id'));
  if (senderId && normalized.sender_id === undefined) normalized.sender_id = senderId;

  const reason = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_reason'));
  if (reason && normalized.reason === undefined) normalized.reason = reason;

  const payload = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_payload'));
  if (payload && normalized.payload === undefined) normalized.payload = payload;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const instantiatesCanonical = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_instantiates_canonical'));
  if (instantiatesCanonical && normalized.instantiates_canonical === undefined) normalized.instantiates_canonical = instantiatesCanonical;

  const instantiatesUri = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_instantiates_uri'));
  if (instantiatesUri && normalized.instantiates_uri === undefined) normalized.instantiates_uri = instantiatesUri;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const partOfIds = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_part_of_ids'));
  if (partOfIds && normalized.part_of_ids === undefined) normalized.part_of_ids = partOfIds;

  const inResponseToIds = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_in_response_to_ids'));
  if (inResponseToIds && normalized.in_response_to_ids === undefined) normalized.in_response_to_ids = inResponseToIds;

  const statusReasonCode = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_status_reason_code'));
  if (statusReasonCode && normalized.status_reason_code === undefined) normalized.status_reason_code = statusReasonCode;

  const statusReasonSystem = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_status_reason_system'));
  if (statusReasonSystem && normalized.status_reason_system === undefined) normalized.status_reason_system = statusReasonSystem;

  const statusReasonDisplay = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_status_reason_display'));
  if (statusReasonDisplay && normalized.status_reason_display === undefined) normalized.status_reason_display = statusReasonDisplay;

  const topicCode = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_topic_code'));
  if (topicCode && normalized.topic_code === undefined) normalized.topic_code = topicCode;

  const topicSystem = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_topic_system'));
  if (topicSystem && normalized.topic_system === undefined) normalized.topic_system = topicSystem;

  const topicDisplay = normalizeAliasValue(readSectionAliasValue(value, 'communication', 'communication_topic_display'));
  if (topicDisplay && normalized.topic_display === undefined) normalized.topic_display = topicDisplay;

  return normalized;
}

function normalizeGlobalCommunicationRequestAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const requestId = readSectionAliasValue(value, 'communicationRequest', 'communication_request_id');
  if (normalized.communication_request_id === undefined && requestId !== undefined) {
    normalized.communication_request_id = requestId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const statusReason = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_status_reason'));
  if (statusReason && normalized.status_reason === undefined) normalized.status_reason = statusReason;

  const intent = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_intent'));
  if (intent && normalized.intent === undefined) normalized.intent = intent;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const priority = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_priority'));
  if (priority && normalized.priority === undefined) normalized.priority = priority;

  const doNotPerform = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_do_not_perform'));
  if (doNotPerform && normalized.do_not_perform === undefined) normalized.do_not_perform = doNotPerform;

  const medium = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_medium'));
  if (medium && normalized.medium === undefined) normalized.medium = medium;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const aboutIds = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_about_ids'));
  if (aboutIds && normalized.about_ids === undefined) normalized.about_ids = aboutIds;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const payload = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_payload'));
  if (payload && normalized.payload === undefined) normalized.payload = payload;

  const occurrenceDate = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_occurrence_date'));
  if (occurrenceDate && normalized.occurrence_date === undefined) normalized.occurrence_date = occurrenceDate;

  const occurrenceStart = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_occurrence_start'));
  if (occurrenceStart && normalized.occurrence_start === undefined) normalized.occurrence_start = occurrenceStart;

  const occurrenceEnd = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_occurrence_end'));
  if (occurrenceEnd && normalized.occurrence_end === undefined) normalized.occurrence_end = occurrenceEnd;

  const authoredOn = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_authored_on'));
  if (authoredOn && normalized.authored_on === undefined) normalized.authored_on = authoredOn;

  const requesterId = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_requester_id'));
  if (requesterId && normalized.requester_id === undefined) normalized.requester_id = requesterId;

  const recipientIds = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_recipient_ids'));
  if (recipientIds && normalized.recipient_ids === undefined) normalized.recipient_ids = recipientIds;

  const informationProviderIds = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_information_provider_ids'));
  if (informationProviderIds && normalized.information_provider_ids === undefined) normalized.information_provider_ids = informationProviderIds;

  const reason = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_reason'));
  if (reason && normalized.reason === undefined) normalized.reason = reason;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const replacesIds = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_replaces_ids'));
  if (replacesIds && normalized.replaces_ids === undefined) normalized.replaces_ids = replacesIds;

  const groupIdentifier = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_group_identifier'));
  if (groupIdentifier && normalized.group_identifier === undefined) normalized.group_identifier = groupIdentifier;

  const statusReasonCode = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_status_reason_code'));
  if (statusReasonCode && normalized.status_reason_code === undefined) normalized.status_reason_code = statusReasonCode;

  const statusReasonSystem = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_status_reason_system'));
  if (statusReasonSystem && normalized.status_reason_system === undefined) normalized.status_reason_system = statusReasonSystem;

  const statusReasonDisplay = normalizeAliasValue(readSectionAliasValue(value, 'communicationRequest', 'communication_request_status_reason_display'));
  if (statusReasonDisplay && normalized.status_reason_display === undefined) normalized.status_reason_display = statusReasonDisplay;

  return normalized;
}

function normalizeGlobalQuestionnaireAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const questionnaireId = readSectionAliasValue(value, 'questionnaire', 'questionnaire_id');
  if (normalized.questionnaire_id === undefined && questionnaireId !== undefined) {
    normalized.questionnaire_id = questionnaireId;
  }

  const url = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_url'));
  if (url && normalized.url === undefined) normalized.url = url;

  const version = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_version'));
  if (version && normalized.version === undefined) normalized.version = version;

  const name = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_name'));
  if (name && normalized.name === undefined) normalized.name = name;

  const title = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_title'));
  if (title && normalized.title === undefined) normalized.title = title;

  const status = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const date = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_date'));
  if (date && normalized.date === undefined) normalized.date = date;

  const publisher = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_publisher'));
  if (publisher && normalized.publisher === undefined) normalized.publisher = publisher;

  const description = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const subjectType = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_subject_type'));
  if (subjectType && normalized.subject_type === undefined) normalized.subject_type = subjectType;

  const itemLinkId = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_item_link_id'));
  if (itemLinkId && normalized.item_link_id === undefined) normalized.item_link_id = itemLinkId;

  const itemText = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_item_text'));
  if (itemText && normalized.item_text === undefined) normalized.item_text = itemText;

  const itemType = normalizeAliasValue(readSectionAliasValue(value, 'questionnaire', 'questionnaire_item_type'));
  if (itemType && normalized.item_type === undefined) normalized.item_type = itemType;

  return normalized;
}

function normalizeGlobalQuestionnaireResponseAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const responseId = readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_id');
  if (normalized.questionnaire_response_id === undefined && responseId !== undefined) {
    normalized.questionnaire_response_id = responseId;
  }

  const questionnaire = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_questionnaire'));
  if (questionnaire && normalized.questionnaire === undefined) normalized.questionnaire = questionnaire;

  const status = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const authored = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_authored'));
  if (authored && normalized.authored === undefined) normalized.authored = authored;

  const authorId = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_author_id'));
  if (authorId && normalized.author_id === undefined) normalized.author_id = authorId;

  const sourceId = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_source_id'));
  if (sourceId && normalized.source_id === undefined) normalized.source_id = sourceId;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const partOfIds = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_part_of_ids'));
  if (partOfIds && normalized.part_of_ids === undefined) normalized.part_of_ids = partOfIds;

  const itemLinkId = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_item_link_id'));
  if (itemLinkId && normalized.item_link_id === undefined) normalized.item_link_id = itemLinkId;

  const itemText = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_item_text'));
  if (itemText && normalized.item_text === undefined) normalized.item_text = itemText;

  const itemAnswer = normalizeAliasValue(readSectionAliasValue(value, 'questionnaireResponse', 'questionnaire_response_item_answer'));
  if (itemAnswer && normalized.item_answer === undefined) normalized.item_answer = itemAnswer;

  return normalized;
}

function normalizeGlobalSpecimenAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const specimenId = readSectionAliasValue(value, 'specimen', 'specimen_id');
  if (normalized.specimen_id === undefined && specimenId !== undefined) {
    normalized.specimen_id = specimenId;
  }

  const accession = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_accession_identifier'));
  if (accession && normalized.accession_identifier === undefined) normalized.accession_identifier = accession;

  const status = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_type'));
  if (type && normalized.type === undefined) normalized.type = type;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const receivedTime = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_received_time'));
  if (receivedTime && normalized.received_time === undefined) normalized.received_time = receivedTime;

  const parentIds = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_parent_ids'));
  if (parentIds && normalized.parent_ids === undefined) normalized.parent_ids = parentIds;

  const requestIds = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_request_ids'));
  if (requestIds && normalized.request_ids === undefined) normalized.request_ids = requestIds;

  const combined = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_combined'));
  if (combined && normalized.combined === undefined) normalized.combined = combined;

  const role = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_role'));
  if (role && normalized.role === undefined) normalized.role = role;

  const featureType = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_feature_type'));
  if (featureType && normalized.feature_type === undefined) normalized.feature_type = featureType;

  const featureDescription = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_feature_description'));
  if (featureDescription && normalized.feature_description === undefined) normalized.feature_description = featureDescription;

  const collectorId = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_collector_id'));
  if (collectorId && normalized.collection_collector_id === undefined) normalized.collection_collector_id = collectorId;

  const collectedDate = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_collected_date'));
  if (collectedDate && normalized.collection_collected_date === undefined) normalized.collection_collected_date = collectedDate;

  const collectedStart = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_collected_start'));
  if (collectedStart && normalized.collection_collected_start === undefined) normalized.collection_collected_start = collectedStart;

  const collectedEnd = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_collected_end'));
  if (collectedEnd && normalized.collection_collected_end === undefined) normalized.collection_collected_end = collectedEnd;

  const durationValue = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_duration_value'));
  if (durationValue && normalized.collection_duration_value === undefined) normalized.collection_duration_value = durationValue;

  const durationUnit = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_duration_unit'));
  if (durationUnit && normalized.collection_duration_unit === undefined) normalized.collection_duration_unit = durationUnit;

  const quantityValue = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_quantity_value'));
  if (quantityValue && normalized.collection_quantity_value === undefined) normalized.collection_quantity_value = quantityValue;

  const quantityUnit = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_quantity_unit'));
  if (quantityUnit && normalized.collection_quantity_unit === undefined) normalized.collection_quantity_unit = quantityUnit;

  const method = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_method'));
  if (method && normalized.collection_method === undefined) normalized.collection_method = method;

  const deviceId = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_device_id'));
  if (deviceId && normalized.collection_device_id === undefined) normalized.collection_device_id = deviceId;

  const procedureId = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_procedure_id'));
  if (procedureId && normalized.collection_procedure_id === undefined) normalized.collection_procedure_id = procedureId;

  const bodySite = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_body_site'));
  if (bodySite && normalized.collection_body_site === undefined) normalized.collection_body_site = bodySite;

  const fastingStatus = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_fasting_status'));
  if (fastingStatus && normalized.collection_fasting_status === undefined) normalized.collection_fasting_status = fastingStatus;

  const fastingDurationValue = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_fasting_duration_value'));
  if (fastingDurationValue && normalized.collection_fasting_duration_value === undefined) normalized.collection_fasting_duration_value = fastingDurationValue;

  const fastingDurationUnit = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_collection_fasting_duration_unit'));
  if (fastingDurationUnit && normalized.collection_fasting_duration_unit === undefined) normalized.collection_fasting_duration_unit = fastingDurationUnit;

  const processingDescription = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_processing_description'));
  if (processingDescription && normalized.processing_description === undefined) normalized.processing_description = processingDescription;

  const processingMethod = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_processing_method'));
  if (processingMethod && normalized.processing_method === undefined) normalized.processing_method = processingMethod;

  const processingAdditiveIds = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_processing_additive_ids'));
  if (processingAdditiveIds && normalized.processing_additive_ids === undefined) normalized.processing_additive_ids = processingAdditiveIds;

  const processingTimeDate = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_processing_time_date'));
  if (processingTimeDate && normalized.processing_time_date === undefined) normalized.processing_time_date = processingTimeDate;

  const processingTimeStart = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_processing_time_start'));
  if (processingTimeStart && normalized.processing_time_start === undefined) normalized.processing_time_start = processingTimeStart;

  const processingTimeEnd = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_processing_time_end'));
  if (processingTimeEnd && normalized.processing_time_end === undefined) normalized.processing_time_end = processingTimeEnd;

  const containerDeviceId = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_container_device_id'));
  if (containerDeviceId && normalized.container_device_id === undefined) normalized.container_device_id = containerDeviceId;

  const containerLocationId = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_container_location_id'));
  if (containerLocationId && normalized.container_location_id === undefined) normalized.container_location_id = containerLocationId;

  const containerQuantityValue = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_container_quantity_value'));
  if (containerQuantityValue && normalized.container_quantity_value === undefined) normalized.container_quantity_value = containerQuantityValue;

  const containerQuantityUnit = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_container_quantity_unit'));
  if (containerQuantityUnit && normalized.container_quantity_unit === undefined) normalized.container_quantity_unit = containerQuantityUnit;

  const condition = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_condition'));
  if (condition && normalized.condition === undefined) normalized.condition = condition;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'specimen', 'specimen_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  return normalized;
}

function normalizeGlobalImagingStudyAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };

  const studyId = readSectionAliasValue(value, 'imagingStudy', 'imaging_study_id');
  if (normalized.imaging_study_id === undefined && studyId !== undefined) {
    normalized.imaging_study_id = studyId;
  }

  const studyIdentifier = readSectionAliasValue(value, 'imagingStudy', 'imaging_study_identifier');
  if (normalized.imaging_study_identifier === undefined && studyIdentifier !== undefined) {
    normalized.imaging_study_identifier = studyIdentifier;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const modality = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_modality'));
  if (modality && normalized.modality === undefined) normalized.modality = modality;

  const subjectId = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_subject_id'));
  if (subjectId && normalized.subject_id === undefined) normalized.subject_id = subjectId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const started = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_started'));
  if (started && normalized.started === undefined) normalized.started = started;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const partOfIds = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_part_of_ids'));
  if (partOfIds && normalized.part_of_ids === undefined) normalized.part_of_ids = partOfIds;

  const referrerId = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_referrer_id'));
  if (referrerId && normalized.referrer_id === undefined) normalized.referrer_id = referrerId;

  const endpointIds = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_endpoint_ids'));
  if (endpointIds && normalized.endpoint_ids === undefined) normalized.endpoint_ids = endpointIds;

  const numberOfSeries = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_number_of_series'));
  if (numberOfSeries && normalized.number_of_series === undefined) normalized.number_of_series = numberOfSeries;

  const numberOfInstances = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_number_of_instances'));
  if (numberOfInstances && normalized.number_of_instances === undefined) normalized.number_of_instances = numberOfInstances;

  const procedure = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_procedure'));
  if (procedure && normalized.procedure === undefined) normalized.procedure = procedure;

  const locationId = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_location_id'));
  if (locationId && normalized.location_id === undefined) normalized.location_id = locationId;

  const reason = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_reason'));
  if (reason && normalized.reason === undefined) normalized.reason = reason;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const description = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_study_description'));
  if (description && normalized.description === undefined) normalized.description = description;

  const seriesUid = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_series_uid'));
  if (seriesUid && normalized.series_uid === undefined) normalized.series_uid = seriesUid;

  const seriesNumber = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_series_number'));
  if (seriesNumber && normalized.series_number === undefined) normalized.series_number = seriesNumber;

  const seriesModality = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_series_modality'));
  if (seriesModality && normalized.series_modality === undefined) normalized.series_modality = seriesModality;

  const seriesDescription = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_series_description'));
  if (seriesDescription && normalized.series_description === undefined) normalized.series_description = seriesDescription;

  const seriesInstances = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_series_number_of_instances'));
  if (seriesInstances && normalized.series_number_of_instances === undefined) normalized.series_number_of_instances = seriesInstances;

  const seriesEndpointIds = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_series_endpoint_ids'));
  if (seriesEndpointIds && normalized.series_endpoint_ids === undefined) normalized.series_endpoint_ids = seriesEndpointIds;

  const seriesBodySite = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_series_body_site'));
  if (seriesBodySite && normalized.series_body_site === undefined) normalized.series_body_site = seriesBodySite;

  const seriesLaterality = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_series_laterality'));
  if (seriesLaterality && normalized.series_laterality === undefined) normalized.series_laterality = seriesLaterality;

  const seriesSpecimenIds = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_series_specimen_ids'));
  if (seriesSpecimenIds && normalized.series_specimen_ids === undefined) normalized.series_specimen_ids = seriesSpecimenIds;

  const seriesStarted = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_series_started'));
  if (seriesStarted && normalized.series_started === undefined) normalized.series_started = seriesStarted;

  const seriesPerformerId = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_series_performer_id'));
  if (seriesPerformerId && normalized.series_performer_id === undefined) normalized.series_performer_id = seriesPerformerId;

  const instanceUid = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_instance_uid'));
  if (instanceUid && normalized.instance_uid === undefined) normalized.instance_uid = instanceUid;

  const instanceSopClass = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_instance_sop_class'));
  if (instanceSopClass && normalized.instance_sop_class === undefined) normalized.instance_sop_class = instanceSopClass;

  const instanceNumber = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_instance_number'));
  if (instanceNumber && normalized.instance_number === undefined) normalized.instance_number = instanceNumber;

  const instanceTitle = normalizeAliasValue(readSectionAliasValue(value, 'imagingStudy', 'imaging_instance_title'));
  if (instanceTitle && normalized.instance_title === undefined) normalized.instance_title = instanceTitle;

  return normalized;
}

function normalizeGlobalAllergyIntoleranceAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const code = isPlainRecord(normalized.code) ? { ...normalized.code } : {};

  const allergyId = readSectionAliasValue(value, 'allergyIntolerance', 'allergy_id');
  if (normalized.allergy_id === undefined && allergyId !== undefined) {
    normalized.allergy_id = allergyId;
  }

  const clinicalStatus = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_clinical_status'));
  if (clinicalStatus && normalized.clinical_status === undefined) normalized.clinical_status = clinicalStatus;

  const verificationStatus = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_verification_status'));
  if (verificationStatus && normalized.verification_status === undefined) normalized.verification_status = verificationStatus;

  const type = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_type'));
  if (type && normalized.type === undefined) normalized.type = type;

  const category = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_category'));
  if (category && normalized.category === undefined) normalized.category = category;

  const criticality = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_criticality'));
  if (criticality && normalized.criticality === undefined) normalized.criticality = criticality;

  const allergyCode = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_code'));
  if (allergyCode && code.code === undefined) code.code = allergyCode;

  const allergySystem = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_code_system'));
  if (allergySystem && code.code_system === undefined) code.code_system = allergySystem;

  const allergyDisplay = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_display'));
  if (allergyDisplay && code.display === undefined) code.display = allergyDisplay;

  const patientId = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_patient_id'));
  if (patientId && normalized.patient_id === undefined) normalized.patient_id = patientId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const onsetDate = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_onset_date'));
  if (onsetDate && normalized.onset_date === undefined) normalized.onset_date = onsetDate;

  const onsetStart = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_onset_start'));
  if (onsetStart && normalized.onset_start === undefined) normalized.onset_start = onsetStart;

  const onsetEnd = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_onset_end'));
  if (onsetEnd && normalized.onset_end === undefined) normalized.onset_end = onsetEnd;

  const onsetText = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_onset_text'));
  if (onsetText && normalized.onset_text === undefined) normalized.onset_text = onsetText;

  const recordedDate = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_recorded_date'));
  if (recordedDate && normalized.recorded_date === undefined) normalized.recorded_date = recordedDate;

  const participantActorId = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_participant_actor_id'));
  if (participantActorId && normalized.participant_actor_id === undefined) normalized.participant_actor_id = participantActorId;

  const participantFunction = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_participant_function'));
  if (participantFunction && normalized.participant_function === undefined) normalized.participant_function = participantFunction;

  const lastOccurrence = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_last_occurrence'));
  if (lastOccurrence && normalized.last_occurrence === undefined) normalized.last_occurrence = lastOccurrence;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const reactionSubstance = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_reaction_substance'));
  if (reactionSubstance && normalized.reaction_substance === undefined) normalized.reaction_substance = reactionSubstance;

  const reactionManifestation = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_reaction_manifestation'));
  if (reactionManifestation && normalized.reaction_manifestation === undefined) normalized.reaction_manifestation = reactionManifestation;

  const reactionDescription = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_reaction_description'));
  if (reactionDescription && normalized.reaction_description === undefined) normalized.reaction_description = reactionDescription;

  const reactionOnset = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_reaction_onset'));
  if (reactionOnset && normalized.reaction_onset === undefined) normalized.reaction_onset = reactionOnset;

  const reactionSeverity = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_reaction_severity'));
  if (reactionSeverity && normalized.reaction_severity === undefined) normalized.reaction_severity = reactionSeverity;

  const reactionExposureRoute = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_reaction_exposure_route'));
  if (reactionExposureRoute && normalized.reaction_exposure_route === undefined) normalized.reaction_exposure_route = reactionExposureRoute;

  const reactionNote = normalizeAliasValue(readSectionAliasValue(value, 'allergyIntolerance', 'allergy_reaction_note'));
  if (reactionNote && normalized.reaction_note === undefined) normalized.reaction_note = reactionNote;

  if (Object.keys(code).length > 0) normalized.code = code;

  return normalized;
}

function normalizeGlobalImmunizationAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const vaccineCode = isPlainRecord(normalized.vaccine_code) ? { ...normalized.vaccine_code } : {};

  const immunizationId = readSectionAliasValue(value, 'immunization', 'immunization_id');
  if (normalized.immunization_id === undefined && immunizationId !== undefined) {
    normalized.immunization_id = immunizationId;
  }

  const status = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_status'));
  if (status && normalized.status === undefined) normalized.status = status;

  const statusReason = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_status_reason'));
  if (statusReason && normalized.status_reason === undefined) normalized.status_reason = statusReason;

  const basedOnIds = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_based_on_ids'));
  if (basedOnIds && normalized.based_on_ids === undefined) normalized.based_on_ids = basedOnIds;

  const vaccineCodeValue = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_vaccine_code'));
  if (vaccineCodeValue && vaccineCode.code === undefined) vaccineCode.code = vaccineCodeValue;

  const vaccineSystem = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_vaccine_system'));
  if (vaccineSystem && vaccineCode.code_system === undefined) vaccineCode.code_system = vaccineSystem;

  const vaccineDisplay = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_vaccine_display'));
  if (vaccineDisplay && vaccineCode.display === undefined) vaccineCode.display = vaccineDisplay;

  const administeredProductId = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_administered_product_id'));
  if (administeredProductId && normalized.administered_product_id === undefined) normalized.administered_product_id = administeredProductId;

  const manufacturerId = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_manufacturer_id'));
  if (manufacturerId && normalized.manufacturer_id === undefined) normalized.manufacturer_id = manufacturerId;

  const lotNumber = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_lot_number'));
  if (lotNumber && normalized.lot_number === undefined) normalized.lot_number = lotNumber;

  const expirationDate = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_expiration_date'));
  if (expirationDate && normalized.expiration_date === undefined) normalized.expiration_date = expirationDate;

  const patientId = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_patient_id'));
  if (patientId && normalized.patient_id === undefined) normalized.patient_id = patientId;

  const encounterId = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_encounter_id'));
  if (encounterId && normalized.encounter_id === undefined) normalized.encounter_id = encounterId;

  const supportingInfoIds = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_supporting_info_ids'));
  if (supportingInfoIds && normalized.supporting_info_ids === undefined) normalized.supporting_info_ids = supportingInfoIds;

  const occurrenceDate = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_occurrence_date'));
  if (occurrenceDate && normalized.occurrence_date === undefined) normalized.occurrence_date = occurrenceDate;

  const occurrenceString = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_occurrence_string'));
  if (occurrenceString && normalized.occurrence_string === undefined) normalized.occurrence_string = occurrenceString;

  const primarySource = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_primary_source'));
  if (primarySource && normalized.primary_source === undefined) normalized.primary_source = primarySource;

  const informationSourceId = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_information_source_id'));
  if (informationSourceId && normalized.information_source_id === undefined) normalized.information_source_id = informationSourceId;

  const locationId = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_location_id'));
  if (locationId && normalized.location_id === undefined) normalized.location_id = locationId;

  const site = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_site'));
  if (site && normalized.site === undefined) normalized.site = site;

  const route = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_route'));
  if (route && normalized.route === undefined) normalized.route = route;

  const doseValue = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_dose_value'));
  if (doseValue && normalized.dose_value === undefined) normalized.dose_value = doseValue;

  const doseUnit = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_dose_unit'));
  if (doseUnit && normalized.dose_unit === undefined) normalized.dose_unit = doseUnit;

  const performerActorId = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_performer_actor_id'));
  if (performerActorId && normalized.performer_actor_id === undefined) normalized.performer_actor_id = performerActorId;

  const performerFunction = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_performer_function'));
  if (performerFunction && normalized.performer_function === undefined) normalized.performer_function = performerFunction;

  const note = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_note'));
  if (note && normalized.note === undefined) normalized.note = note;

  const reason = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_reason'));
  if (reason && normalized.reason === undefined) normalized.reason = reason;

  const isSubpotent = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_is_subpotent'));
  if (isSubpotent && normalized.is_subpotent === undefined) normalized.is_subpotent = isSubpotent;

  const subpotentReason = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_subpotent_reason'));
  if (subpotentReason && normalized.subpotent_reason === undefined) normalized.subpotent_reason = subpotentReason;

  const programEligibilityProgram = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_program_eligibility_program'));
  if (programEligibilityProgram && normalized.program_eligibility_program === undefined) normalized.program_eligibility_program = programEligibilityProgram;

  const programEligibilityStatus = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_program_eligibility_status'));
  if (programEligibilityStatus && normalized.program_eligibility_status === undefined) normalized.program_eligibility_status = programEligibilityStatus;

  const fundingSource = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_funding_source'));
  if (fundingSource && normalized.funding_source === undefined) normalized.funding_source = fundingSource;

  const reactionDate = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_reaction_date'));
  if (reactionDate && normalized.reaction_date === undefined) normalized.reaction_date = reactionDate;

  const reactionManifestation = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_reaction_manifestation'));
  if (reactionManifestation && normalized.reaction_manifestation === undefined) normalized.reaction_manifestation = reactionManifestation;

  const reactionReported = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_reaction_reported'));
  if (reactionReported && normalized.reaction_reported === undefined) normalized.reaction_reported = reactionReported;

  const protocolSeries = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_protocol_series'));
  if (protocolSeries && normalized.protocol_series === undefined) normalized.protocol_series = protocolSeries;

  const protocolAuthorityId = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_protocol_authority_id'));
  if (protocolAuthorityId && normalized.protocol_authority_id === undefined) normalized.protocol_authority_id = protocolAuthorityId;

  const protocolTargetDisease = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_protocol_target_disease'));
  if (protocolTargetDisease && normalized.protocol_target_disease === undefined) normalized.protocol_target_disease = protocolTargetDisease;

  const protocolDoseNumber = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_protocol_dose_number'));
  if (protocolDoseNumber && normalized.protocol_dose_number === undefined) normalized.protocol_dose_number = protocolDoseNumber;

  const protocolSeriesDoses = normalizeAliasValue(readSectionAliasValue(value, 'immunization', 'immunization_protocol_series_doses'));
  if (protocolSeriesDoses && normalized.protocol_series_doses === undefined) normalized.protocol_series_doses = protocolSeriesDoses;

  if (Object.keys(vaccineCode).length > 0) normalized.vaccine_code = vaccineCode;

  return normalized;
}

function normalizeGlobalPractitionerAliases(value: Record<string, unknown>) {
  const normalized: Record<string, unknown> = { ...value };
  const name = isPlainRecord(normalized.name) ? { ...normalized.name } : {};
  const contactInfo = isPlainRecord(normalized.contact_info) ? { ...normalized.contact_info } : {};
  const address = isPlainRecord(contactInfo.address) ? { ...contactInfo.address } : {};
  const license = isPlainRecord(normalized.license) ? { ...normalized.license } : {};

  const practitionerId = readSectionAliasValue(value, 'practitioner', 'practitioner_id');
  if (normalized.practitioner_id === undefined && practitionerId !== undefined) {
    normalized.practitioner_id = practitionerId;
  }

  const first = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_first_name'));
  if (first && name.first_name === undefined) name.first_name = first;
  const directCommunityFirst = normalizeAliasValue((value as Record<string, unknown>).communityWorkerFirstName ?? (value as Record<string, unknown>).community_worker_first_name);
  if (directCommunityFirst && name.first_name === undefined) name.first_name = directCommunityFirst;

  const middle = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_middle_name'));
  if (middle && name.middle_name === undefined) name.middle_name = middle;

  const last = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_last_name'));
  if (last && name.last_name === undefined) name.last_name = last;
  const directCommunityLast = normalizeAliasValue((value as Record<string, unknown>).communityWorkerLastName ?? (value as Record<string, unknown>).community_worker_last_name);
  if (directCommunityLast && name.last_name === undefined) name.last_name = directCommunityLast;

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
  const directAddress = normalizeAliasValue((value as Record<string, unknown>).address);
  if (directAddress && address.street === undefined) address.street = directAddress;

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
  const directCity = normalizeAliasValue((value as Record<string, unknown>).city);
  if (directCity && address.city === undefined) address.city = directCity;

  const state = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_state'));
  if (state && address.state === undefined) address.state = state;
  const directState = normalizeAliasValue((value as Record<string, unknown>).state);
  if (directState && address.state === undefined) address.state = directState;

  const postal = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_postal_code'));
  if (postal && address.postal_code === undefined) address.postal_code = postal;
  const directPostal = normalizeAliasValue((value as Record<string, unknown>).zipCode ?? (value as Record<string, unknown>).zip_code ?? (value as Record<string, unknown>).zipcode);
  if (directPostal && address.postal_code === undefined) address.postal_code = directPostal;

  const country = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_country'));
  if (country && address.country === undefined) address.country = country;
  const directCountry = normalizeAliasValue((value as Record<string, unknown>).country);
  if (directCountry && address.country === undefined) address.country = directCountry;

  const licenseNumber = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_license_number'));
  if (licenseNumber && license.license_number === undefined) license.license_number = licenseNumber;
  const directMedicalRegNo = normalizeAliasValue((value as Record<string, unknown>).medicalRegNo ?? (value as Record<string, unknown>).medical_reg_no);
  if (directMedicalRegNo && license.license_number === undefined) license.license_number = directMedicalRegNo;
  const directRegistrationNumber = normalizeAliasValue((value as Record<string, unknown>).registrationNumber ?? (value as Record<string, unknown>).registration_number);
  if (directRegistrationNumber && license.license_number === undefined) license.license_number = directRegistrationNumber;

  const experience = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_years_of_experience'));
  if (experience !== undefined && normalized.years_of_experience === undefined) {
    normalized.years_of_experience = experience;
  }
  const directExperience = normalizeAliasValue((value as Record<string, unknown>).noOfExperience ?? (value as Record<string, unknown>).no_of_experience);
  if (directExperience !== undefined && normalized.years_of_experience === undefined) {
    normalized.years_of_experience = directExperience;
  }
  const qualification = normalizeAliasValue(readSectionAliasValue(value, 'practitioner', 'practitioner_qualification_code'));
  const directQualification = normalizeAliasValue((value as Record<string, unknown>).qualification);
  if ((qualification || directQualification) && normalized.specialization === undefined) {
    normalized.specialization = qualification || directQualification;
  }
  const hasCommunityWorkerMarker = Boolean(
    directCommunityFirst ||
    directCommunityLast ||
    normalizeAliasValue((value as Record<string, unknown>).practitionerType ?? (value as Record<string, unknown>).practitioner_type) === 'community_worker' ||
    normalizeAliasValue((value as Record<string, unknown>).sourceEntityType ?? (value as Record<string, unknown>).source_entity_type) === 'community_worker' ||
    (value as Record<string, unknown>).communityWorkerFirstName !== undefined ||
    (value as Record<string, unknown>).communityWorkerLastName !== undefined ||
    (value as Record<string, unknown>).community_worker_first_name !== undefined ||
    (value as Record<string, unknown>).community_worker_last_name !== undefined
  );
  if (normalized.specialization === undefined) {
    normalized.specialization = hasCommunityWorkerMarker ? 'Community Worker' : 'Doctor';
  }

  if (Object.keys(name).length > 0) normalized.name = name;
  if (Object.keys(address).length > 0) {
    contactInfo.address = address;
  }
  if (Object.keys(contactInfo).length > 0) normalized.contact_info = contactInfo;
  if (Object.keys(license).length > 0) normalized.license = license;

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
    case 'medicationKnowledge':
      return normalizeGlobalMedicationKnowledgeAliases(value);
    case 'medicationRequest':
      return normalizeGlobalMedicationRequestAliases(value);
    case 'medicationStatement':
      return normalizeGlobalMedicationStatementAliases(value);
    case 'medicationAdministration':
      return normalizeGlobalMedicationAdministrationAliases(value);
    case 'medicationDispense':
      return normalizeGlobalMedicationDispenseAliases(value);
    case 'organizationAffiliation':
      return normalizeGlobalOrganizationAffiliationAliases(value);
    case 'deviceDispense':
      return normalizeGlobalDeviceDispenseAliases(value);
    case 'deviceRequest':
      return normalizeGlobalDeviceRequestAliases(value);
    case 'deviceUsage':
      return normalizeGlobalDeviceUsageAliases(value);
    case 'encounterHistory':
      return normalizeGlobalEncounterHistoryAliases(value);
    case 'flag':
      return normalizeGlobalFlagAliases(value);
    case 'list':
      return normalizeGlobalListAliases(value);
    case 'group':
      return normalizeGlobalGroupAliases(value);
    case 'healthcareService':
      return normalizeGlobalHealthcareServiceAliases(value);
    case 'insurancePlan':
      return normalizeGlobalInsurancePlanAliases(value);
    case 'nutritionIntake':
      return normalizeGlobalNutritionIntakeAliases(value);
    case 'nutritionOrder':
      return normalizeGlobalNutritionOrderAliases(value);
    case 'riskAssessment':
      return normalizeGlobalRiskAssessmentAliases(value);
    case 'capabilityStatement':
      return normalizeGlobalCapabilityStatementAliases(value);
    case 'operationOutcome':
      return normalizeGlobalOperationOutcomeAliases(value);
    case 'parameters':
      return normalizeGlobalParametersAliases(value);
    case 'carePlan':
      return normalizeGlobalCarePlanAliases(value);
    case 'careTeam':
      return normalizeGlobalCareTeamAliases(value);
    case 'goal':
      return normalizeGlobalGoalAliases(value);
    case 'serviceRequest':
      return normalizeGlobalServiceRequestAliases(value);
    case 'task':
      return normalizeGlobalTaskAliases(value);
    case 'communication':
      return normalizeGlobalCommunicationAliases(value);
    case 'communicationRequest':
      return normalizeGlobalCommunicationRequestAliases(value);
    case 'questionnaire':
      return normalizeGlobalQuestionnaireAliases(value);
    case 'questionnaireResponse':
      return normalizeGlobalQuestionnaireResponseAliases(value);
    case 'procedure':
      return normalizeGlobalProcedureAliases(value);
    case 'condition':
      return normalizeGlobalConditionAliases(value);
    case 'appointment':
      return normalizeGlobalAppointmentAliases(value);
    case 'appointmentResponse':
      return normalizeGlobalAppointmentResponseAliases(value);
    case 'claim':
      return normalizeGlobalClaimAliases(value);
    case 'claimResponse':
      return normalizeGlobalClaimResponseAliases(value);
    case 'composition':
      return normalizeGlobalCompositionAliases(value);
    case 'explanationOfBenefit':
      return normalizeGlobalExplanationOfBenefitAliases(value);
    case 'coverage':
      return normalizeGlobalCoverageAliases(value);
    case 'account':
      return normalizeGlobalAccountAliases(value);
    case 'chargeItem':
      return normalizeGlobalChargeItemAliases(value);
    case 'chargeItemDefinition':
      return normalizeGlobalChargeItemDefinitionAliases(value);
    case 'device':
      return normalizeGlobalDeviceAliases(value);
    case 'deviceMetric':
      return normalizeGlobalDeviceMetricAliases(value);
    case 'endpoint':
      return normalizeGlobalEndpointAliases(value);
    case 'binary':
      return normalizeGlobalBinaryAliases(value);
    case 'schedule':
      return normalizeGlobalScheduleAliases(value);
    case 'slot':
      return normalizeGlobalSlotAliases(value);
    case 'diagnosticReport':
      return normalizeGlobalDiagnosticReportAliases(value);
    case 'relatedPerson':
      return normalizeGlobalRelatedPersonAliases(value);
    case 'person':
      return normalizeGlobalPersonAliases(value);
    case 'location':
      return normalizeGlobalLocationAliases(value);
    case 'episodeOfCare':
      return normalizeGlobalEpisodeOfCareAliases(value);
    case 'verificationResult':
      return normalizeGlobalVerificationResultAliases(value);
    case 'substance':
      return normalizeGlobalSubstanceAliases(value);
    case 'specimen':
      return normalizeGlobalSpecimenAliases(value);
    case 'imagingStudy':
      return normalizeGlobalImagingStudyAliases(value);
    case 'allergyIntolerance':
      return normalizeGlobalAllergyIntoleranceAliases(value);
    case 'immunization':
      return normalizeGlobalImmunizationAliases(value);
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
    ['medicationKnowledge', 'medication_knowledge'],
    ['medicationRequest', 'medication_request'],
    ['medicationStatement', 'medication_statement'],
    ['medicationAdministration', 'medication_administration'],
    ['medicationDispense', 'medication_dispense'],
    ['organizationAffiliation', 'organization_affiliation'],
    ['deviceDispense', 'device_dispense'],
    ['deviceRequest', 'device_request'],
    ['deviceUsage', 'device_usage'],
    ['encounterHistory', 'encounter_history'],
    ['flag', 'flag'],
    ['list', 'list'],
    ['group', 'group'],
    ['healthcareService', 'healthcare_service'],
    ['nutritionIntake', 'nutrition_intake'],
    ['nutritionOrder', 'nutrition_order'],
    ['riskAssessment', 'risk_assessment'],
    ['capabilityStatement', 'capability_statement'],
    ['operationOutcome', 'operation_outcome'],
    ['parameters', 'parameters'],
    ['carePlan', 'care_plan'],
    ['careTeam', 'care_team'],
    ['goal', 'goal'],
    ['serviceRequest', 'service_request'],
    ['task', 'task'],
    ['communication', 'communication'],
    ['communicationRequest', 'communication_request'],
    ['questionnaire', 'questionnaire'],
    ['questionnaireResponse', 'questionnaire_response'],
    ['procedure', 'procedure'],
    ['condition', 'condition'],
    ['appointment', 'appointment'],
    ['appointmentResponse', 'appointment_response'],
    ['claim', 'claim'],
    ['claimResponse', 'claim_response'],
    ['composition', 'composition'],
    ['explanationOfBenefit', 'explanation_of_benefit'],
    ['coverage', 'coverage'],
    ['insurancePlan', 'insurance_plan'],
    ['account', 'account'],
    ['chargeItem', 'charge_item'],
    ['chargeItemDefinition', 'charge_item_definition'],
    ['device', 'device'],
    ['deviceMetric', 'device_metric'],
    ['endpoint', 'endpoint'],
    ['binary', 'binary'],
    ['schedule', 'schedule'],
    ['slot', 'slot'],
    ['diagnosticReport', 'diagnostic_report'],
    ['relatedPerson', 'related_person'],
    ['person', 'person'],
    ['location', 'location'],
    ['verificationResult', 'verification_result'],
    ['substance', 'substance'],
    ['immunization', 'immunization'],
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
      return value.some(item => isPlainRecord(item) && hasAliasKey(item, canonicalKeys, aliasSection));
    }
    if (isPlainRecord(value)) {
      return hasAliasKey(value, canonicalKeys, aliasSection);
    }
    return false;
  });
}

function shouldPreferStructuredAlias(payload: unknown): boolean {
  if (!isPlainRecord(payload)) return false;

  return Object.entries(payload).some(([key, value]) => {
    const normalizedSectionKey = normalizeAliasKey(key);
    const section = STRUCTURED_SECTION_LOOKUP.get(normalizedSectionKey);
    if (!section) return false;

    const canonicalSectionSingular = normalizeAliasKey(section);
    const canonicalSectionPlural = `${canonicalSectionSingular}s`;
    if (normalizedSectionKey !== canonicalSectionSingular && normalizedSectionKey !== canonicalSectionPlural) {
      return true;
    }

    const records = Array.isArray(value)
      ? value.filter(isPlainRecord)
      : isPlainRecord(value) ? [value] : [];
    if (records.length === 0) return false;

    const canonicalKeys = SECTION_CANONICAL_KEYS[section];
    const aliasLookup = SECTION_ALIAS_LOOKUPS[section];
    return records.some(record => Object.keys(record).some(recordKey => {
      const normalizedRecordKey = normalizeHeader(recordKey);
      if (canonicalKeys.has(normalizedRecordKey)) return false;
      const mapped = aliasLookup?.get(normalizeAliasKey(recordKey));
      return Boolean(mapped && normalizeHeader(mapped) !== normalizedRecordKey);
    }));
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

function hasAliasKey(
  value: Record<string, unknown>,
  canonicalKeys: Set<string>,
  section?: keyof typeof HEADER_ALIAS_SECTIONS
): boolean {
  const aliasLookup = section ? SECTION_ALIAS_LOOKUPS[section] : undefined;
  return Object.keys(value).some(key => {
    const normalized = normalizeHeader(key);
    if (canonicalKeys.has(normalized)) return true;
    const mapped = aliasLookup?.get(normalizeAliasKey(key));
    return mapped ? canonicalKeys.has(normalizeHeader(mapped)) : false;
  });
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
    'medicationKnowledge',
    'medicationRequest',
    'medicationStatement',
    'medicationAdministration',
    'medicationDispense',
    'deviceDispense',
    'deviceRequest',
    'deviceUsage',
    'encounterHistory',
    'flag',
    'list',
    'group',
    'healthcareService',
    'nutritionIntake',
    'nutritionOrder',
    'riskAssessment',
    'capabilityStatement',
    'operationOutcome',
    'parameters',
    'carePlan',
    'careTeam',
    'goal',
    'serviceRequest',
    'procedure',
    'condition',
    'appointment',
    'appointmentResponse',
    'claim',
    'claimResponse',
    'composition',
    'explanationOfBenefit',
    'coverage',
    'insurancePlan',
    'account',
    'chargeItem',
    'chargeItemDefinition',
    'device',
    'deviceMetric',
    'endpoint',
    'binary',
    'schedule',
    'slot',
    'diagnosticReport',
    'relatedPerson',
    'person',
    'location',
    'episodeOfCare',
    'verificationResult',
    'substance',
    'specimen',
    'imagingStudy',
    'allergyIntolerance',
    'immunization',
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
  const aliasLookup = SECTION_ALIAS_LOOKUPS[sectionKey as keyof typeof HEADER_ALIAS_SECTIONS];
  const row: TabularRow = {};
  for (const [key, rawValue] of Object.entries(value)) {
    const normalized = normalizeHeader(String(key));
    const mappedKey = aliasLookup?.get(normalizeAliasKey(String(key)));
    const canonicalKey = mappedKey ? normalizeHeader(mappedKey) : normalized;
    if (!canonicalKeys.has(canonicalKey)) continue;
    row[canonicalKey] = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
  }
  return row;
}

function readMongoWrappedString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isPlainRecord(value)) {
    if (typeof value.$oid === 'string') return value.$oid;
    if (typeof value.$date === 'string') return value.$date;
    if (value.$date instanceof Date) return value.$date.toISOString();
    const nestedName = typeof value.name === 'string' ? value.name.trim() : '';
    if (nestedName) return nestedName;
  }
  return undefined;
}

function readMongoWrappedNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function titleFromSnake(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function resolveSmartScaleUnit(key: string): string {
  if (key.endsWith('_kg')) return 'kg';
  if (key.includes('muscle') && !key.endsWith('_kg')) return '%';
  if (key.includes('left_arm') || key.includes('right_arm') || key.includes('left_leg') || key.includes('right_leg') || key.includes('all_body')) return 'Ohm';
  return '{score}';
}

function buildSmartScaleGroupedObservations(payload: Record<string, unknown>, payloadId?: string): CanonicalObservation[] {
  const observationPayload = isPlainRecord(payload.smartScale)
    ? payload.smartScale
    : (isPlainRecord(payload.obseravtion)
    ? payload.obseravtion
    : (isPlainRecord(payload.observation) ? payload.observation : undefined));
  if (!observationPayload) return [];

  const observationDate =
    readMongoWrappedString(observationPayload.testDateTime)
    || readMongoWrappedString(payload.testDateTime)
    || readMongoWrappedString(payload.appointment);

  const grouped: CanonicalObservation[] = [];

  const extData = isPlainRecord(observationPayload.extData) ? observationPayload.extData : undefined;
  if (extData) {
    const components = Object.entries(extData)
      .map(([key, rawValue]) => {
        const value = readMongoWrappedNumber(rawValue);
        if (value === undefined) return undefined;
        const unit = resolveSmartScaleUnit(key);
        return {
          code: {
            system: 'urn:scanbo:observation',
            code: key,
            display: titleFromSnake(key)
          },
          valueQuantity: {
            value,
            unit,
            system: 'http://unitsofmeasure.org',
            code: unit
          }
        };
      })
      .filter(Boolean) as NonNullable<CanonicalObservation['components']>;

    if (components.length > 0) {
      grouped.push({
        setId: payloadId ? `${payloadId}-segmental-body-composition` : undefined,
        code: {
          system: 'urn:scanbo:observation',
          code: 'segmental-body-composition',
          display: 'Segmental body composition'
        },
        status: 'final',
        date: observationDate,
        components
      });
    }
  }

  const impedanceArray = Array.isArray(observationPayload.impendences)
    ? observationPayload.impendences
    : undefined;

  const impedanceValues = impedanceArray
    ? impedanceArray.map(readMongoWrappedNumber).filter((value): value is number => value !== undefined)
    : [];

  if (impedanceValues.length > 0) {
    const components = impedanceValues.map((value, index) => ({
      code: {
        system: 'urn:scanbo:observation',
        code: `impedance-${index + 1}`,
        display: `Impedance ${index + 1}`
      },
      valueQuantity: {
        value,
        unit: 'Ohm',
        system: 'http://unitsofmeasure.org',
        code: 'Ohm'
      }
    }));

    grouped.push({
      setId: payloadId ? `${payloadId}-bioimpedance-series` : undefined,
      code: {
        system: 'urn:scanbo:observation',
        code: 'bioimpedance-series',
        display: 'Bioimpedance series'
      },
      status: 'final',
      date: observationDate,
      components
    });
  }

  return grouped;
}

function looksLikeScanboConsultationPayload(payload: unknown): payload is Record<string, unknown> {
  if (!isPlainRecord(payload)) return false;
  const hasPersonBlocks = isPlainRecord(payload.patient) || isPlainRecord(payload.doctor);
  const hasConsultationSignals =
    'prescription' in payload ||
    'diagnosis' in payload ||
    'supplementList' in payload ||
    'appointment' in payload ||
    'exercise' in payload ||
    'diet' in payload ||
    'mindSet' in payload ||
    'note' in payload ||
    isPlainRecord(payload.smartScale) ||
    isPlainRecord(payload.obseravtion) ||
    isPlainRecord(payload.observation);
  return hasPersonBlocks && hasConsultationSignals;
}

function buildRowsFromScanboConsultationPayload(payload: Record<string, unknown>): TabularRow[] {
  const rows: TabularRow[] = [];
  const payloadId = readMongoWrappedString(payload._id);
  const patient = isPlainRecord(payload.patient) ? payload.patient : {};
  const doctor = isPlainRecord(payload.doctor) ? payload.doctor : {};
  const observationPayload = isPlainRecord(payload.smartScale)
    ? payload.smartScale
    : (isPlainRecord(payload.obseravtion)
    ? payload.obseravtion
    : (isPlainRecord(payload.observation) ? payload.observation : undefined));

  const patientId =
    readMongoWrappedString(payload.patientMasterProfileId) ||
    readMongoWrappedString(payload.patientId) ||
    readMongoWrappedString(patient.masterProfileId) ||
    readMongoWrappedString(patient.masterProfile_id) ||
    readMongoWrappedString(patient._id);
  const practitionerId =
    readMongoWrappedString(payload.doctorId) ||
    readMongoWrappedString(doctor._id);

  const patientFirstName = readMongoWrappedString(patient.patientFirstName);
  const patientLastName = readMongoWrappedString(patient.patientLastName);
  const doctorFirstName = readMongoWrappedString(doctor.doctorFirstName);
  const doctorLastName = readMongoWrappedString(doctor.doctorLastName);
  const doctorQualification = readMongoWrappedString(doctor.qualification);

  const base: TabularRow = {};
  if (patientId) base.patient_id = patientId;
  if (patientFirstName) base.patient_first_name = patientFirstName;
  if (patientLastName) base.patient_last_name = patientLastName;
  if (practitionerId) base.practitioner_id = practitionerId;
  if (doctorFirstName) base.practitioner_first_name = doctorFirstName;
  if (doctorLastName) base.practitioner_last_name = doctorLastName;
  if (doctorQualification) {
    base.practitioner_qualification_code = doctorQualification;
    base.practitioner_qualification_display = doctorQualification;
  }

  const pushRow = (fields: Record<string, unknown>, includePractitioner = false) => {
    const row: TabularRow = {};
    if (base.patient_id) row.patient_id = base.patient_id;
    if (base.patient_first_name) row.patient_first_name = base.patient_first_name;
    if (base.patient_last_name) row.patient_last_name = base.patient_last_name;
    if (includePractitioner) {
      if (base.practitioner_id) row.practitioner_id = base.practitioner_id;
      if (base.practitioner_first_name) row.practitioner_first_name = base.practitioner_first_name;
      if (base.practitioner_last_name) row.practitioner_last_name = base.practitioner_last_name;
      if (base.practitioner_qualification_code) row.practitioner_qualification_code = base.practitioner_qualification_code;
      if (base.practitioner_qualification_display) row.practitioner_qualification_display = base.practitioner_qualification_display;
    }
    for (const [key, raw] of Object.entries(fields)) {
      if (raw === undefined || raw === null) continue;
      const value = String(raw).trim();
      if (!value) continue;
      row[key] = value;
    }
    if (Object.keys(row).length > 0) rows.push(row);
  };

  // Base row ensures Patient + Practitioner creation.
  pushRow({}, true);

  const appointmentDate = readMongoWrappedString(payload.appointment);
  const observationDate =
    (observationPayload && readMongoWrappedString(observationPayload.testDateTime))
    || readMongoWrappedString(payload.testDateTime)
    || appointmentDate;
  if (appointmentDate) {
    pushRow({
      appointment_id: payloadId ? `${payloadId}-appointment` : undefined,
      appointment_status: 'booked',
      appointment_start: appointmentDate,
      appointment_subject_id: patientId,
      appointment_participant_id: practitionerId
    });
  }

  const carePlanPieces = [
    isPlainRecord(payload.treatment) && readMongoWrappedString(payload.treatment.name) ? `Treatment: ${readMongoWrappedString(payload.treatment.name)}` : undefined,
    readMongoWrappedString(payload.exercise) ? `Exercise: ${readMongoWrappedString(payload.exercise)}` : undefined,
    readMongoWrappedString(payload.diet) ? `Diet: ${readMongoWrappedString(payload.diet)}` : undefined,
    isPlainRecord(payload.mindSet) && readMongoWrappedString(payload.mindSet.name) ? `Mindset: ${readMongoWrappedString(payload.mindSet.name)}` : undefined,
    Array.isArray(payload.followUps)
      ? `Follow-ups: ${payload.followUps
          .filter(isPlainRecord)
          .map(item => readMongoWrappedString(item.name))
          .filter(Boolean)
          .join(', ')}`
      : undefined,
    Array.isArray(payload.books)
      ? `Books: ${payload.books
          .filter(isPlainRecord)
          .map(item => readMongoWrappedString(item.name))
          .filter(Boolean)
          .join(', ')}`
      : undefined
  ].filter(Boolean) as string[];
  if (carePlanPieces.length > 0 || readMongoWrappedString(payload.note)) {
    pushRow({
      care_plan_id: payloadId ? `${payloadId}-care-plan` : undefined,
      care_plan_status: 'active',
      care_plan_intent: 'plan',
      care_plan_title: 'Scanbo Consultation Care Plan',
      care_plan_description: carePlanPieces.join(' | '),
      care_plan_subject_id: patientId,
      care_plan_note: readMongoWrappedString(payload.note)
    });
  }

  if (Array.isArray(payload.diagnosis)) {
    payload.diagnosis.filter(isPlainRecord).forEach((diag, index) => {
      const diagnosisText = readMongoWrappedString(diag.diagnosis) || readMongoWrappedString(diag.name);
      if (!diagnosisText) return;
      pushRow({
        condition_id: payloadId ? `${payloadId}-condition-${index + 1}` : undefined,
        condition_display: diagnosisText,
        condition_subject_id: patientId
      });
    });
  }

  if (Array.isArray(payload.prescription)) {
    payload.prescription.filter(isPlainRecord).forEach((rx, index) => {
      const medicationName = readMongoWrappedString(rx.drugName);
      if (!medicationName) return;
      const authoredOn = readMongoWrappedString(rx.testDateTime) || appointmentDate;
      const quantity = readMongoWrappedString(rx.quantity);
      const duration = readMongoWrappedString(rx.duration);
      const frequencyName = readMongoWrappedString(rx.frequencyName);
      const remarkName = readMongoWrappedString(rx.remarkName);
      const notes = readMongoWrappedString(rx.notes);
      const medId = payloadId ? `${payloadId}-med-${index + 1}` : undefined;
      const requestId = payloadId ? `${payloadId}-med-req-${index + 1}` : undefined;

      // Intentionally disabled for now:
      // Prescription drugName entries should create MedicationRequest only,
      // not standalone Medication resources.
      // pushRow({
      //   medication_id: medId,
      //   medication_display: medicationName,
      //   medication_code: medicationName,
      //   medication_code_system: 'urn:scanbo:medication'
      // });

      pushRow({
        medication_request_id: requestId,
        medication_status: 'active',
        medication_authored_on: authoredOn,
        medication_display: medicationName,
        medication_code_system: 'urn:scanbo:medication',
        medication_dose: quantity,
        medication_dose_unit: duration ? `day(s)` : undefined,
        medication_sig: [frequencyName, remarkName, notes].filter(Boolean).join(' | ')
      });
    });
  }

  if (Array.isArray(payload.supplementList)) {
    payload.supplementList.filter(isPlainRecord).forEach((supp, index) => {
      const supplementName = readMongoWrappedString(supp.supplementName) || `Supplement ${index + 1}`;

      pushRow({
        medication_id: payloadId ? `${payloadId}-supp-med-${index + 1}` : undefined,
        medication_display: supplementName,
        medication_code: supplementName,
        medication_code_system: 'urn:scanbo:supplement'
      });
    });
  }

  const pushObservationRow = (
    obsIdSuffix: string,
    display: string,
    value: unknown,
    options?: { code?: string; system?: string; unit?: string }
  ) => {
    const raw = readMongoWrappedString(value);
    if (!raw) return;
    pushRow({
      observation_id: payloadId ? `${payloadId}-${obsIdSuffix}` : undefined,
      observation_code: options?.code,
      observation_code_system: options?.system || (options?.code ? 'http://loinc.org' : undefined),
      observation_display: display,
      observation_value: raw,
      observation_unit: options?.unit,
      observation_date: observationDate,
      observation_status: 'final'
    });
  };

  // Nested observation block support (payload.observation / payload.obseravtion),
  // used by existing scanbo payloads that provide readingFromDevice-style fields.
  if (observationPayload) {
    const nestedType = readMongoWrappedString(observationPayload.type);
    const nestedDate = readMongoWrappedString(observationPayload.testDateTime) || observationDate;
    const normalizedNestedType = nestedType?.toLowerCase().replace(/[^a-z0-9]/g, '');
    let nestedHandled = false;

    if (normalizedNestedType === 'bloodpressure') {
      const systolic =
        readMongoWrappedString(observationPayload.systolicCalibratedReading)
        || readMongoWrappedString(observationPayload.systolicReadingFromDevice);
      const diastolic =
        readMongoWrappedString(observationPayload.diastolicCalibratedReading)
        || readMongoWrappedString(observationPayload.diastolicReadingFromDevice);

      if (systolic || diastolic) {
        pushRow({
          observation_id: payloadId ? `${payloadId}-nested-blood-pressure` : undefined,
          observation_type: 'bloodPressure',
          observation_systolic_value: systolic,
          observation_diastolic_value: diastolic,
          observation_unit: 'mmHg',
          observation_date: nestedDate,
          observation_status: 'final'
        });
        nestedHandled = true;
      }
    }

    if (normalizedNestedType === 'ecg') {
      const waves =
        readMongoWrappedString(observationPayload.PQRSTWaves)
        || readMongoWrappedString(observationPayload.pqrstWaves)
        || readMongoWrappedString(observationPayload.pqrstwaves)
        || readMongoWrappedString(observationPayload.observation_ecg_waves);
      const heartRate =
        readMongoWrappedString(observationPayload.heartRate)
        || readMongoWrappedString(observationPayload.heart_rate)
        || readMongoWrappedString(observationPayload.observation_ecg_heart_rate);
      const heartRateVariability =
        readMongoWrappedString(observationPayload.heartRateVariability)
        || readMongoWrappedString(observationPayload.heart_rate_variability)
        || readMongoWrappedString(observationPayload.observation_ecg_hrv);
      const breatheRate =
        readMongoWrappedString(observationPayload.breatheRate)
        || readMongoWrappedString(observationPayload.breathe_rate)
        || readMongoWrappedString(observationPayload.observation_ecg_breathe_rate);

      if (waves || heartRate || heartRateVariability || breatheRate) {
        pushRow({
          observation_id: payloadId ? `${payloadId}-nested-ecg` : undefined,
          observation_type: 'ecg',
          observation_ecg_waves: waves,
          observation_ecg_heart_rate: heartRate,
          observation_ecg_hrv: heartRateVariability,
          observation_ecg_breathe_rate: breatheRate,
          observation_date: nestedDate,
          observation_status: 'final'
        });
        nestedHandled = true;
      }
    }

    if (
      normalizedNestedType === 'bodytemperature' ||
      normalizedNestedType === 'bodytempreture' ||
      normalizedNestedType === 'bloodoxygen' ||
      normalizedNestedType === 'heartrate' ||
      normalizedNestedType === 'bloodglucose' ||
      normalizedNestedType === 'bloodgloucose'
    ) {
      const nestedValueForKnownType =
        readMongoWrappedString(observationPayload.calibratedReading)
        || readMongoWrappedString(observationPayload.readingFromDevice)
        || readMongoWrappedString(observationPayload.value);
      const nestedUnitForKnownType =
        readMongoWrappedString(observationPayload.measuringUnitShortName)
        || readMongoWrappedString(observationPayload.measuringUnitFullName);

      if (nestedValueForKnownType) {
        pushRow({
          observation_id: payloadId ? `${payloadId}-nested-${normalizedNestedType}` : undefined,
          observation_type: nestedType,
          observation_value: nestedValueForKnownType,
          observation_unit: nestedUnitForKnownType,
          observation_date: nestedDate,
          observation_status: 'final'
        });
        nestedHandled = true;
      }
    }

    const nestedValue =
      readMongoWrappedString(observationPayload.calibratedReading)
      || readMongoWrappedString(observationPayload.readingFromDevice)
      || readMongoWrappedString(observationPayload.value);
    const nestedUnit =
      readMongoWrappedString(observationPayload.measuringUnitShortName)
      || readMongoWrappedString(observationPayload.measuringUnitFullName);
    if (!nestedHandled && nestedValue) {
      pushRow({
        observation_id: payloadId ? `${payloadId}-nested-observation` : undefined,
        observation_type: nestedType,
        observation_display: nestedType ? titleFromSnake(nestedType) : 'Observation',
        observation_value: nestedValue,
        observation_unit: nestedUnit,
        observation_date: observationDate,
        observation_status: 'final'
      });
    }
  }

  // Vitals/Labs from Scanbo consultation payload -> Observation resources
  const bpRaw = readMongoWrappedString(payload.blood_pressure);
  if (bpRaw) {
    const bpMatch = bpRaw.match(/^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/);
    if (bpMatch) {
      pushRow({
        observation_id: payloadId ? `${payloadId}-blood-pressure` : undefined,
        observation_type: 'bloodPressure',
        observation_systolic_value: bpMatch[1],
        observation_diastolic_value: bpMatch[2],
        observation_unit: 'mmHg',
        observation_date: observationDate,
        observation_status: 'final'
      });
    }
  }

  pushObservationRow('bsl-random', 'Blood glucose random', payload.bsl_random, { code: '2339-0', unit: 'mg/dL' });
  pushObservationRow('insulin-fasting', 'Insulin fasting', payload.insulin_fasting, { code: '20448-7', unit: 'u[IU]/mL' });
  pushObservationRow('bsl-fasting', 'Blood glucose fasting', payload.bsl_fasting, { code: '1558-6', unit: 'mg/dL' });
  pushObservationRow('insulin-postprandial', 'Insulin postprandial', payload.insulin_postprandial, { unit: 'u[IU]/mL' });
  pushObservationRow('bsl-postprandial', 'Blood glucose postprandial', payload.bsl_postprandial, { code: '14771-0', unit: 'mg/dL' });
  pushObservationRow('hba1c', 'Hemoglobin A1c', payload.hba1c_percent, { code: '4548-4', unit: '%' });
  pushObservationRow('weight', 'Body weight', payload.weight_kg, { code: '29463-7', unit: 'kg' });
  pushObservationRow('tsh', 'TSH', payload.tsh_level, { code: '3016-3', unit: 'u[IU]/mL' });
  pushObservationRow('c-peptide-fasting', 'C-peptide fasting', payload.c_peptide_fasting, { unit: 'ng/mL' });
  pushObservationRow('c-peptide-postprandial', 'C-peptide postprandial', payload.c_peptide_postprandial, { unit: 'ng/mL' });
  pushObservationRow('creatinine', 'Creatinine', payload.creatinine_level, { code: '2160-0', unit: 'mg/dL' });

  // Smart-scale standalone body metrics
  if (observationPayload) {
    pushObservationRow('weight-kg', 'Body weight', observationPayload.weightKg, { code: '29463-7', unit: 'kg' });
    pushObservationRow('bmi', 'Body mass index (BMI) [Ratio]', observationPayload.bmi, { code: '39156-5', unit: 'kg/m2' });
    pushObservationRow('body-fat-percent', 'Body fat percentage', observationPayload.bodyFatPercent, { unit: '%' });
    pushObservationRow('muscle-percent', 'Muscle percentage', observationPayload.musclePercent, { unit: '%' });
    pushObservationRow('moisture-percent', 'Body water percentage', observationPayload.moisturePercent, { unit: '%' });
    pushObservationRow('bone-mass', 'Bone mass', observationPayload.boneMass, { unit: 'kg' });
    pushObservationRow('bmr', 'Basal metabolic rate', observationPayload.bmr, { unit: '{kcal}/d' });
  }

  const note = readMongoWrappedString(payload.note);
  if (note) {
    pushRow({
      document_id: payloadId ? `${payloadId}-note` : undefined,
      document_title: 'Consultation Note',
      document_description: 'Consultation note captured from Scanbo observation model',
      document_format: 'text/plain',
      document_content_type: 'text/plain',
      document_data: note,
      document_status: 'current'
    });
  }

  // Persist full source payload as base64 JSON in a dedicated DocumentReference
  // so downstream systems can reconstruct and inspect the original consultation payload.
  const payloadJson = JSON.stringify(payload);
  const payloadBase64 = Buffer.from(payloadJson, 'utf8').toString('base64');
  pushRow({
    document_id: payloadId ? `${payloadId}-source-payload` : undefined,
    document_title: 'Scanbo Source Payload',
    document_description: 'Original Scanbo consultation payload (base64 JSON)',
    document_format: 'json',
    document_content_type: 'application/json',
    document_data: payloadBase64,
    document_status: 'current'
  });

  return rows;
}

function hasCommunityWorkerMarker(payload: unknown): boolean {
  if (Array.isArray(payload)) {
    return payload.some(item => hasCommunityWorkerMarker(item));
  }
  if (!isPlainRecord(payload)) return false;

  const keys = Object.keys(payload).map(normalizeAliasKey);
  if (
    keys.includes('community_worker_first_name') ||
    keys.includes('community_worker_last_name') ||
    keys.includes('communityworkerfirstname') ||
    keys.includes('communityworkerlastname')
  ) {
    return true;
  }
  const practitionerType = normalizeAliasValue(payload.practitionerType ?? payload.practitioner_type);
  const sourceEntityType = normalizeAliasValue(payload.sourceEntityType ?? payload.source_entity_type);
  if (practitionerType === 'community_worker' || sourceEntityType === 'community_worker') {
    return true;
  }

  return Object.values(payload).some(value => hasCommunityWorkerMarker(value));
}

function applyCommunityWorkerQualificationDefault(canonical: CanonicalModel, payload: unknown) {
  if (!hasCommunityWorkerMarker(payload)) return;
  if (!canonical.practitioners?.length) return;

  for (const practitioner of canonical.practitioners) {
    practitioner.qualification = [{
      code: {
        code: 'Community Worker',
        display: 'Community Worker'
      }
    }];
  }
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

  // Accept common envelope wrappers from upstream systems:
  // { payload: {...} } or { data: {...} }.
  // Only unwrap when the wrapped value is an object/array to avoid
  // interfering with resources like Communication that use string payloads.
  if (isPlainRecord(parsed)) {
    const wrapped = parsed.payload ?? parsed.data;
    if (isPlainRecord(wrapped) || Array.isArray(wrapped)) {
      parsed = wrapped;
    }
  }

  if (looksLikeScanboConsultationPayload(parsed)) {
    const rows = buildRowsFromScanboConsultationPayload(parsed);
    if (rows.length > 0) {
      const canonical = mapTabularRowsToCanonical(rows, 'JSON');
      const groupedSmartScale = buildSmartScaleGroupedObservations(parsed, readMongoWrappedString(parsed._id));
      if (groupedSmartScale.length > 0) {
        canonical.observations = [...(canonical.observations || []), ...groupedSmartScale];
      }
      applyCommunityWorkerQualificationDefault(canonical, parsed);
      return canonical;
    }
  }

  if (looksLikeTabularJson(parsed)) {
    const rows = coerceTabularRows(parsed) || [];
    if (rows.length > 0) {
      const messageType = resolveMessageType(parsed) || 'JSON';
      const canonical = mapTabularRowsToCanonical(rows, messageType);
      applyCommunityWorkerQualificationDefault(canonical, parsed);
      const leftover = extractFlatLeftoverPayload(parsed);
      if (leftover) {
        const payloads = buildLeftoverSourcePayloads(canonical, leftover);
        if (payloads) canonical.sourcePayloads = payloads;
      }
      return canonical;
    }
  }

  // Allow multiple "documents" in one request.
  // NOTE: We intentionally check for tabular JSON first so that an array-of-rows
  // stays mapped via the tabular pathway.
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error('JSON validation failed: payload array must not be empty.');
    }

    const canonicals: CanonicalModel[] = parsed.map((item, index) => {
      try {
        // Each item may be an object or a JSON string; parseCustomJSON supports both.
        if (item === null || item === undefined) {
          throw new Error('Item is null or undefined');
        }
        return parseCustomJSON(item as any);
      } catch (e: any) {
        const msg = e?.message ? String(e.message) : String(e);
        throw new Error(`Invalid JSON item at index ${index}: ${msg}`);
      }
    });

    return mergeCanonicalModels(canonicals);
  }

  if (shouldPreferStructuredAlias(parsed)) {
    const rows = buildRowsFromStructuredAliasJson(parsed);
    if (rows.length > 0) {
      const canonical = mapTabularRowsToCanonical(rows, 'JSON');
      applyCommunityWorkerQualificationDefault(canonical, parsed);
      const leftover = extractFlatLeftoverPayload(parsed);
      if (leftover) {
        const payloads = buildLeftoverSourcePayloads(canonical, leftover);
        if (payloads) canonical.sourcePayloads = payloads;
      }
      return canonical;
    }
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
    if (rows.length > 0) {
      const canonical = mapTabularRowsToCanonical(rows, 'JSON');
      applyCommunityWorkerQualificationDefault(canonical, parsed);
      const leftover = extractFlatLeftoverPayload(parsed);
      if (leftover) {
        const payloads = buildLeftoverSourcePayloads(canonical, leftover);
        if (payloads) canonical.sourcePayloads = payloads;
      }
      return canonical;
    }
  }

  throw new Error('JSON validation failed: payload must match the global custom JSON schema.');
}

function mergeCanonicalModels(models: CanonicalModel[]): CanonicalModel {
  const out: CanonicalModel = {};

  for (const model of models) {
    if (!model || typeof model !== 'object') continue;

    for (const [key, value] of Object.entries(model)) {
      if (value === undefined) continue;

      // Arrays: concatenate
      if (Array.isArray(value)) {
        const existing = (out as any)[key];
        (out as any)[key] = Array.isArray(existing) ? existing.concat(value) : value.slice();
        continue;
      }

      // Plain objects: merge only for sourcePayloads, otherwise keep first value
      if (isPlainRecord(value)) {
        if (key === 'sourcePayloads') {
          const existing = (out as any)[key];
          (out as any)[key] = isPlainRecord(existing) ? { ...existing, ...value } : { ...value };
        } else {
          if ((out as any)[key] === undefined) (out as any)[key] = value;
        }
        continue;
      }

      // Scalars: keep first value
      if ((out as any)[key] === undefined) (out as any)[key] = value;
    }
  }

  return out;
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
  const medicationKnowledges = normalizeArray(validated.medication_knowledge);
  const medicationRequests = normalizeArray(validated.medication_request);
  const medicationStatements = normalizeArray(validated.medication_statement);
  const medicationAdministrations = normalizeArray(validated.medication_administration);
  const medicationDispenses = normalizeArray(validated.medication_dispense);
  const organizationAffiliations = normalizeArray(validated.organization_affiliation);
  const deviceDispenses = normalizeArray(validated.device_dispense);
  const deviceRequests = normalizeArray(validated.device_request);
  const deviceUsages = normalizeArray(validated.device_usage);
  const encounterHistories = normalizeArray(validated.encounter_history);
  const flags = normalizeArray(validated.flag);
  const observations = normalizeArray(validated.observation ?? validated.observations);
  const lists = normalizeArray(validated.list);
  const groups = normalizeArray(validated.group);
  const healthcareServices = normalizeArray(validated.healthcare_service);
  const nutritionIntakes = normalizeArray(validated.nutrition_intake);
  const nutritionOrders = normalizeArray(validated.nutrition_order);
  const riskAssessments = normalizeArray(validated.risk_assessment);
  const capabilityStatements = normalizeArray(validated.capability_statement);
  const operationOutcomes = normalizeArray(validated.operation_outcome);
  const parametersList = normalizeArray(validated.parameters);
  const carePlans = normalizeArray(validated.care_plan);
  const careTeams = normalizeArray(validated.care_team);
  const goals = normalizeArray(validated.goal);
  const serviceRequests = normalizeArray(validated.service_request);
  const tasks = normalizeArray(validated.task);
  const communications = normalizeArray(validated.communication);
  const communicationRequests = normalizeArray(validated.communication_request);
  const questionnaires = normalizeArray(validated.questionnaire);
  const questionnaireResponses = normalizeArray(validated.questionnaire_response);
  const codeSystems = normalizeArray(validated.code_system);
  const valueSets = normalizeArray(validated.value_set);
  const conceptMaps = normalizeArray(validated.concept_map);
  const namingSystems = normalizeArray(validated.naming_system);
  const terminologyCapabilities = normalizeArray(validated.terminology_capabilities);
  const provenances = normalizeArray(validated.provenance);
  const auditEvents = normalizeArray(validated.audit_event);
  const consents = normalizeArray(validated.consent);
  const procedures = normalizeArray(validated.procedure);
  const conditions = normalizeArray(validated.condition);
  const appointments = normalizeArray(validated.appointment);
  const appointmentResponses = normalizeArray(validated.appointment_response);
  const claims = normalizeArray(validated.claim);
  const claimResponses = normalizeArray(validated.claim_response);
  const compositions = normalizeArray(validated.composition);
  const explanationOfBenefits = normalizeArray(validated.explanation_of_benefit);
  const coverages = normalizeArray(validated.coverage);
  const insurancePlans = normalizeArray(validated.insurance_plan);
  const accounts = normalizeArray(validated.account);
  const chargeItems = normalizeArray(validated.charge_item);
  const chargeItemDefinitions = normalizeArray(validated.charge_item_definition);
  const devices = normalizeArray(validated.device);
  const deviceMetrics = normalizeArray(validated.device_metric);
  const endpoints = normalizeArray(validated.endpoint);
  const binaries = normalizeArray(validated.binary);
  const schedules = normalizeArray(validated.schedule);
  const slots = normalizeArray(validated.slot);
  const diagnosticReports = normalizeArray(validated.diagnostic_report);
  const relatedPersons = normalizeArray(validated.related_person);
  const persons = normalizeArray(validated.person);
  const locations = normalizeArray(validated.location);
  const episodesOfCare = normalizeArray(validated.episode_of_care);
  const verificationResults = normalizeArray(validated.verification_result);
  const substances = normalizeArray(validated.substance);
  const specimens = normalizeArray(validated.specimen);
  const imagingStudies = normalizeArray(validated.imaging_study);
  const allergyIntolerances = normalizeArray(validated.allergy_intolerance);
  const immunizations = normalizeArray(validated.immunization);
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
  if (medicationKnowledges.length) {
    canonical.medicationKnowledges = medicationKnowledges.map(buildCanonicalMedicationKnowledgeGlobal);
  }
  if (medicationRequests.length) {
    canonical.medicationRequests = medicationRequests.map(buildCanonicalMedicationRequestGlobal);
  }
  if (medicationStatements.length) {
    canonical.medicationStatements = medicationStatements.map(buildCanonicalMedicationStatementGlobal);
  }
  if (medicationAdministrations.length) {
    canonical.medicationAdministrations = medicationAdministrations.map(buildCanonicalMedicationAdministrationGlobal);
  }
  if (medicationDispenses.length) {
    canonical.medicationDispenses = medicationDispenses.map(buildCanonicalMedicationDispenseGlobal);
  }
  if (organizationAffiliations.length) {
    canonical.organizationAffiliations = organizationAffiliations.map(buildCanonicalOrganizationAffiliationGlobal);
  }
  if (deviceDispenses.length) {
    canonical.deviceDispenses = deviceDispenses.map(buildCanonicalDeviceDispenseGlobal);
  }
  if (deviceRequests.length) {
    canonical.deviceRequests = deviceRequests.map(buildCanonicalDeviceRequestGlobal);
  }
  if (deviceUsages.length) {
    canonical.deviceUsages = deviceUsages.map(buildCanonicalDeviceUsageGlobal);
  }
  if (encounterHistories.length) {
    canonical.encounterHistories = encounterHistories.map(buildCanonicalEncounterHistoryGlobal);
  }
  if (flags.length) {
    canonical.flags = flags.map(buildCanonicalFlagGlobal);
  }
  if (observations.length) {
    canonical.observations = observations.map(buildCanonicalObservationGlobal);
  }
  if (lists.length) {
    canonical.lists = lists.map(buildCanonicalListGlobal);
  }
  if (groups.length) {
    canonical.groups = groups.map(buildCanonicalGroupGlobal);
  }
  if (healthcareServices.length) {
    canonical.healthcareServices = healthcareServices.map(buildCanonicalHealthcareServiceGlobal);
  }
  if (nutritionIntakes.length) {
    canonical.nutritionIntakes = nutritionIntakes.map(buildCanonicalNutritionIntakeGlobal);
  }
  if (nutritionOrders.length) {
    canonical.nutritionOrders = nutritionOrders.map(buildCanonicalNutritionOrderGlobal);
  }
  if (riskAssessments.length) {
    canonical.riskAssessments = riskAssessments.map(buildCanonicalRiskAssessmentGlobal);
  }
  if (capabilityStatements.length) {
    canonical.capabilityStatements = capabilityStatements.map(buildCanonicalCapabilityStatementGlobal);
  }
  if (operationOutcomes.length) {
    canonical.operationOutcomes = operationOutcomes.map(buildCanonicalOperationOutcomeGlobal);
  }
  if (parametersList.length) {
    canonical.parameters = [buildCanonicalParametersGlobal(parametersList)];
  }
  if (carePlans.length) {
    canonical.carePlans = carePlans.map(buildCanonicalCarePlanGlobal);
  }
  if (careTeams.length) {
    canonical.careTeams = careTeams.map(buildCanonicalCareTeamGlobal);
  }
  if (goals.length) {
    canonical.goals = goals.map(buildCanonicalGoalGlobal);
  }
  if (serviceRequests.length) {
    canonical.serviceRequests = serviceRequests.map(buildCanonicalServiceRequestGlobal);
  }
  if (tasks.length) {
    canonical.tasks = tasks.map(buildCanonicalTaskGlobal);
  }
  if (communications.length) {
    canonical.communications = communications.map(buildCanonicalCommunicationGlobal);
  }
  if (communicationRequests.length) {
    canonical.communicationRequests = communicationRequests.map(buildCanonicalCommunicationRequestGlobal);
  }
  if (questionnaires.length) {
    canonical.questionnaires = questionnaires.map(buildCanonicalQuestionnaireGlobal);
  }
  if (questionnaireResponses.length) {
    canonical.questionnaireResponses = questionnaireResponses.map(buildCanonicalQuestionnaireResponseGlobal);
  }
  if (codeSystems.length) {
    canonical.codeSystems = codeSystems.map(buildCanonicalCodeSystemGlobal);
  }
  if (valueSets.length) {
    canonical.valueSets = valueSets.map(buildCanonicalValueSetGlobal);
  }
  if (conceptMaps.length) {
    canonical.conceptMaps = conceptMaps.map(buildCanonicalConceptMapGlobal);
  }
  if (namingSystems.length) {
    canonical.namingSystems = namingSystems.map(buildCanonicalNamingSystemGlobal);
  }
  if (terminologyCapabilities.length) {
    canonical.terminologyCapabilities = terminologyCapabilities.map(buildCanonicalTerminologyCapabilitiesGlobal);
  }
  if (provenances.length) {
    canonical.provenances = provenances.map(buildCanonicalProvenanceGlobal);
  }
  if (auditEvents.length) {
    canonical.auditEvents = auditEvents.map(buildCanonicalAuditEventGlobal);
  }
  if (consents.length) {
    canonical.consents = consents.map(buildCanonicalConsentGlobal);
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
  if (appointmentResponses.length) {
    canonical.appointmentResponses = appointmentResponses.map(buildCanonicalAppointmentResponseGlobal);
  }
  if (claims.length) {
    canonical.claims = claims.map(buildCanonicalClaimGlobal);
  }
  if (claimResponses.length) {
    canonical.claimResponses = claimResponses.map(buildCanonicalClaimResponseGlobal);
  }
  if (compositions.length) {
    canonical.compositions = compositions.map(buildCanonicalCompositionGlobal);
  }
  if (explanationOfBenefits.length) {
    canonical.explanationOfBenefits = explanationOfBenefits.map(buildCanonicalExplanationOfBenefitGlobal);
  }
  if (coverages.length) {
    canonical.coverages = coverages.map(buildCanonicalCoverageGlobal);
  }
  if (insurancePlans.length) {
    canonical.insurancePlans = insurancePlans.map(buildCanonicalInsurancePlanGlobal);
  }
  if (accounts.length) {
    canonical.accounts = accounts.map(buildCanonicalAccountGlobal);
  }
  if (chargeItems.length) {
    canonical.chargeItems = chargeItems.map(buildCanonicalChargeItemGlobal);
  }
  if (chargeItemDefinitions.length) {
    canonical.chargeItemDefinitions = chargeItemDefinitions.map(buildCanonicalChargeItemDefinitionGlobal);
  }
  if (devices.length) {
    canonical.devices = devices.map(buildCanonicalDeviceGlobal);
  }
  if (deviceMetrics.length) {
    canonical.deviceMetrics = deviceMetrics.map(buildCanonicalDeviceMetricGlobal);
  }
  if (endpoints.length) {
    canonical.endpoints = endpoints.map(buildCanonicalEndpointGlobal);
  }
  if (binaries.length) {
    canonical.binaries = binaries.map(buildCanonicalBinaryGlobal);
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
  if (persons.length) {
    canonical.persons = persons.map(buildCanonicalPersonGlobal);
  }
  if (locations.length) {
    canonical.locations = locations.map(buildCanonicalLocationGlobal);
  }
  if (episodesOfCare.length) {
    canonical.episodesOfCare = episodesOfCare.map(buildCanonicalEpisodeOfCareGlobal);
  }
  if (verificationResults.length) {
    canonical.verificationResults = verificationResults.map(buildCanonicalVerificationResultGlobal);
  }
  if (substances.length) {
    canonical.substances = substances.map(buildCanonicalSubstanceGlobal);
  }
  if (specimens.length) {
    canonical.specimens = specimens.map(buildCanonicalSpecimenGlobal);
  }
  if (imagingStudies.length) {
    canonical.imagingStudies = imagingStudies.map(buildCanonicalImagingStudyGlobal);
  }
  if (allergyIntolerances.length) {
    canonical.allergyIntolerances = allergyIntolerances.map(buildCanonicalAllergyIntoleranceGlobal);
  }
  if (immunizations.length) {
    canonical.immunizations = immunizations.map(buildCanonicalImmunizationGlobal);
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

  // Source payloads are attached only for flat JSON via leftover-only extensions.

  return canonical;
}

function normalizeArray<T>(value?: T | T[]): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== undefined && value !== null;
}

function collectSourcePayloads(resources: Record<string, unknown[] | undefined>) {
  const payloads: Record<string, unknown> = {};
  const idKeys: Record<string, string[]> = {
    patient: ['patient_id', 'id', 'identifier'],
    encounter: ['encounter_id', 'id', 'identifier'],
    medication: ['medication_id', 'id', 'identifier'],
    medication_knowledge: ['medication_knowledge_id', 'id', 'identifier'],
    medication_request: ['medication_request_id', 'id', 'identifier'],
    medication_statement: ['medication_statement_id', 'id', 'identifier'],
    medication_administration: ['medication_administration_id', 'id', 'identifier'],
    medication_dispense: ['medication_dispense_id', 'id', 'identifier'],
    device_dispense: ['device_dispense_id', 'id', 'identifier'],
    device_request: ['device_request_id', 'id', 'identifier'],
    device_usage: ['device_usage_id', 'id', 'identifier'],
    encounter_history: ['encounter_history_id', 'id', 'identifier'],
    flag: ['flag_id', 'id', 'identifier'],
    list: ['list_id', 'id', 'identifier'],
    group: ['group_id', 'id', 'identifier'],
    healthcare_service: ['healthcare_service_id', 'id', 'identifier'],
    nutrition_intake: ['nutrition_intake_id', 'id', 'identifier'],
    nutrition_order: ['nutrition_order_id', 'id', 'identifier'],
    risk_assessment: ['risk_assessment_id', 'id', 'identifier'],
    capability_statement: ['capability_statement_id', 'id', 'identifier'],
    operation_outcome: ['operation_outcome_id', 'id', 'identifier'],
    parameters: ['id', 'identifier'],
    care_plan: ['care_plan_id', 'id', 'identifier'],
    care_team: ['care_team_id', 'id', 'identifier'],
    goal: ['goal_id', 'id', 'identifier'],
    service_request: ['service_request_id', 'id', 'identifier'],
    task: ['task_id', 'id', 'identifier'],
    communication: ['communication_id', 'id', 'identifier'],
    communication_request: ['communication_request_id', 'id', 'identifier'],
    questionnaire: ['questionnaire_id', 'id', 'identifier'],
    questionnaire_response: ['questionnaire_response_id', 'id', 'identifier'],
    code_system: ['code_system_id', 'id', 'identifier'],
    value_set: ['value_set_id', 'id', 'identifier'],
    concept_map: ['concept_map_id', 'id', 'identifier'],
    naming_system: ['naming_system_id', 'id', 'identifier'],
    terminology_capabilities: ['terminology_capabilities_id', 'id', 'identifier'],
    provenance: ['provenance_id', 'id', 'identifier'],
    audit_event: ['audit_event_id', 'id', 'identifier'],
    consent: ['consent_id', 'id', 'identifier'],
    procedure: ['procedure_id', 'id', 'identifier'],
    condition: ['condition_id', 'id', 'identifier'],
    appointment: ['appointment_id', 'id', 'identifier'],
    appointment_response: ['appointment_response_id', 'id', 'identifier'],
    claim: ['claim_id', 'id', 'identifier'],
    claim_response: ['claim_response_id', 'id', 'identifier'],
    composition: ['composition_id', 'id', 'identifier'],
    explanation_of_benefit: ['explanation_of_benefit_id', 'id', 'identifier'],
    coverage: ['coverage_id', 'id', 'identifier'],
    insurance_plan: ['insurance_plan_id', 'id', 'identifier'],
    account: ['account_id', 'id', 'identifier'],
    charge_item: ['charge_item_id', 'id', 'identifier'],
    charge_item_definition: ['charge_item_definition_id', 'id', 'identifier'],
    device_metric: ['device_metric_id', 'id', 'identifier'],
    device: ['device_id', 'id', 'identifier'],
    endpoint: ['endpoint_id', 'id', 'identifier'],
    binary: ['binary_id', 'id', 'identifier'],
    schedule: ['schedule_id', 'id', 'identifier'],
    slot: ['slot_id', 'id', 'identifier'],
    diagnostic_report: ['diagnostic_report_id', 'id', 'identifier'],
    related_person: ['related_person_id', 'id', 'identifier'],
    person: ['person_id', 'id', 'identifier'],
    location: ['location_id', 'id', 'identifier'],
    episode_of_care: ['episode_of_care_id', 'id', 'identifier'],
    verification_result: ['verification_result_id', 'id', 'identifier'],
    substance: ['substance_id', 'id', 'identifier'],
    specimen: ['specimen_id', 'id', 'identifier'],
    imaging_study: ['imaging_study_id', 'id', 'identifier'],
    allergy_intolerance: ['allergy_id', 'allergy_intolerance_id', 'id', 'identifier'],
    immunization: ['immunization_id', 'id', 'identifier'],
    practitioner: ['practitioner_id', 'id', 'identifier'],
    practitioner_role: ['practitioner_role_id', 'id', 'identifier'],
    organization: ['organization_id', 'id', 'identifier']
  };

  const normalizeId = (value: unknown) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'string') return value.trim() || undefined;
    if (typeof value === 'number') return String(value);
    return undefined;
  };

  Object.entries(resources).forEach(([section, items]) => {
    if (!items || !items.length) return;
    const keys = idKeys[section] || ['id', 'identifier'];
    items.forEach((item, index) => {
      if (!item || typeof item !== 'object') return;
      const record = item as Record<string, unknown>;
      let id: string | undefined;
      for (const key of keys) {
        const value = normalizeId(record[key]);
        if (value) {
          id = value;
          break;
        }
      }
      if (!id) id = `index-${index}`;
      const resourceType = section
        .replace(/_([a-z])/g, (_, char: string) => char.toUpperCase())
        .replace(/^./, char => char.toUpperCase());
      payloads[`${resourceType}:${id}`] = record;
    });
  });

  return payloads;
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

  const normalizedResourceType = typeof value.resourceType === 'string'
    ? value.resourceType.trim().toLowerCase()
    : typeof value.resource_type === 'string'
      ? value.resource_type.trim().toLowerCase()
      : undefined;
  if (normalizedResourceType === 'patient') {
    return { patient: value };
  }

  const hasGlobalKey = ['patient', 'encounter', 'medication', 'medication_request', 'medication_statement', 'medication_administration', 'medication_dispense', 'organization_affiliation', 'device_dispense', 'device_request', 'device_usage', 'encounter_history', 'flag', 'observation', 'observations', 'list', 'nutrition_intake', 'nutrition_order', 'risk_assessment', 'capability_statement', 'operation_outcome', 'parameters', 'care_plan', 'care_team', 'goal', 'service_request', 'task', 'communication', 'communication_request', 'questionnaire', 'questionnaire_response', 'code_system', 'value_set', 'concept_map', 'naming_system', 'terminology_capabilities', 'provenance', 'audit_event', 'consent', 'procedure', 'condition', 'appointment', 'appointment_response', 'claim', 'claim_response', 'composition', 'explanation_of_benefit', 'coverage', 'account', 'charge_item', 'charge_item_definition', 'device', 'device_metric', 'binary', 'schedule', 'slot', 'diagnostic_report', 'related_person', 'person', 'location', 'episode_of_care', 'verification_result', 'substance', 'specimen', 'imaging_study', 'allergy_intolerance', 'immunization', 'practitioner', 'practitioner_role', 'organization']
    .some(key => key in value);
  if (hasGlobalKey) {
    const candidates = [
      value.patient,
      value.encounter,
      value.medication,
      value.medication_request,
      value.medication_statement,
      value.medication_administration,
      value.medication_dispense,
      value.organization_affiliation,
      value.device_dispense,
      value.device_request,
      value.device_usage,
      value.encounter_history,
      value.flag,
      value.observation,
      value.observations,
      value.list,
      value.nutrition_intake,
      value.nutrition_order,
      value.risk_assessment,
      value.capability_statement,
      value.operation_outcome,
      value.parameters,
      value.care_plan,
      value.care_team,
      value.goal,
      value.service_request,
      value.task,
      value.communication,
      value.communication_request,
      value.questionnaire,
      value.questionnaire_response,
      value.code_system,
      value.value_set,
      value.concept_map,
      value.naming_system,
      value.terminology_capabilities,
      value.provenance,
      value.audit_event,
      value.consent,
      value.procedure,
      value.condition,
      value.appointment,
      value.appointment_response,
      value.claim,
      value.claim_response,
      value.composition,
      value.explanation_of_benefit,
      value.coverage,
      value.account,
      value.charge_item,
      value.charge_item_definition,
      value.device,
      value.device_metric,
      value.binary,
      value.schedule,
      value.slot,
      value.diagnostic_report,
      value.related_person,
      value.person,
      value.location,
      value.episode_of_care,
      value.verification_result,
      value.substance,
      value.specimen,
      value.imaging_study,
      value.allergy_intolerance,
      value.immunization,
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
    if ('observation_id' in value || 'observation_code' in value) {
      return { observation: value };
    }
    if ('medication_request_id' in value || 'dosage_instruction' in value) {
      return { medication_request: value };
    }
    if ('medication_statement_id' in value || 'date_asserted' in value || 'effective_date' in value) {
      return { medication_statement: value };
    }
    if ('medication_administration_id' in value || 'occurrence_date' in value || 'dose_value' in value) {
      return { medication_administration: value };
    }
    if ('medication_dispense_id' in value || 'when_handed_over' in value || 'quantity_value' in value) {
      return { medication_dispense: value };
    }
    if ('organization_affiliation_id' in value || 'participating_organization_id' in value || 'organization_id' in value) {
      return { organization_affiliation: value };
    }
    if ('device_dispense_id' in value || 'device_dispense_status' in value || 'device_dispense_device_id' in value) {
      return { device_dispense: value };
    }
    if ('device_request_id' in value || 'device_request_status' in value || 'device_request_device_code' in value) {
      return { device_request: value };
    }
    if ('device_usage_id' in value || 'device_usage_status' in value || 'device_usage_device_code' in value) {
      return { device_usage: value };
    }
    if ('encounter_history_id' in value || 'encounter_history_status' in value || 'encounter_history_encounter_id' in value) {
      return { encounter_history: value };
    }
    if ('flag_id' in value || 'flag_status' in value || 'flag_code' in value) {
      return { flag: value };
    }
    if ('list_id' in value || 'list_status' in value || 'list_mode' in value) {
      return { list: value };
    }
    if ('nutrition_intake_id' in value || 'nutrition_intake_status' in value || 'nutrition_intake_code' in value) {
      return { nutrition_intake: value };
    }
    if ('nutrition_order_id' in value || 'nutrition_order_status' in value || 'nutrition_order_intent' in value) {
      return { nutrition_order: value };
    }
    if ('risk_assessment_id' in value || 'risk_assessment_status' in value || 'risk_assessment_code' in value) {
      return { risk_assessment: value };
    }
    if ('capability_statement_id' in value || 'capability_statement_url' in value || 'fhir_version' in value) {
      return { capability_statement: value };
    }
    if ('operation_outcome_id' in value || 'severity' in value || 'diagnostics' in value) {
      return { operation_outcome: value };
    }
    if ('parameter_name' in value || 'parameter_value' in value || 'value_string' in value) {
      return { parameters: value };
    }
    if ('care_plan_id' in value || 'title' in value || 'intent' in value) {
      return { care_plan: value };
    }
    if ('care_team_id' in value || 'participant_member_id' in value || 'participant_role' in value) {
      return { care_team: value };
    }
    if ('goal_id' in value || 'lifecycle_status' in value || 'description' in value) {
      return { goal: value };
    }
    if ('service_request_id' in value || 'requester_id' in value || 'occurrence_date' in value) {
      return { service_request: value };
    }
    if ('task_id' in value || 'task_status' in value || 'task_intent' in value) {
      return { task: value };
    }
    if ('communication_id' in value || 'sent' in value || 'payload' in value) {
      return { communication: value };
    }
    if ('communication_request_id' in value || 'occurrence_date' in value || 'authored_on' in value) {
      return { communication_request: value };
    }
    if ('questionnaire_id' in value || 'subject_type' in value || 'item_link_id' in value) {
      return { questionnaire: value };
    }
    if ('questionnaire_response_id' in value || 'authored' in value || 'item_answer' in value) {
      return { questionnaire_response: value };
    }
    if ('code_system_id' in value || 'url' in value || 'concept_code' in value) {
      return { code_system: value };
    }
    if ('value_set_id' in value || 'include_code' in value || 'include_system' in value) {
      return { value_set: value };
    }
    if ('concept_map_id' in value || 'element_code' in value || 'target_code' in value) {
      return { concept_map: value };
    }
    if ('naming_system_id' in value || 'unique_id_value' in value || 'kind' in value) {
      return { naming_system: value };
    }
    if ('terminology_capabilities_id' in value || 'code_search' in value || 'kind' in value) {
      return { terminology_capabilities: value };
    }
    if ('provenance_id' in value || 'activity' in value || 'recorded' in value) {
      return { provenance: value };
    }
    if ('audit_event_id' in value || 'severity' in value || 'action' in value) {
      return { audit_event: value };
    }
    if ('consent_id' in value || 'decision' in value || 'grantor_ids' in value) {
      return { consent: value };
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
    if ('appointment_response_id' in value || 'appointment_id' in value || 'participant_status' in value) {
      return { appointment_response: value };
    }
    if ('claim_id' in value || 'claim_status' in value || 'claim_type' in value) {
      return { claim: value };
    }
    if ('claim_response_id' in value || 'claim_response_status' in value || 'claim_response_type' in value) {
      return { claim_response: value };
    }
    if ('composition_id' in value || 'composition_title' in value || 'composition_status' in value) {
      return { composition: value };
    }
    if ('explanation_of_benefit_id' in value || 'explanation_of_benefit_status' in value || 'explanation_of_benefit_type' in value) {
      return { explanation_of_benefit: value };
    }
    if ('coverage_id' in value || 'coverage_status' in value || 'coverage_kind' in value || 'beneficiary_id' in value) {
      return { coverage: value };
    }
    if ('account_id' in value || 'account_status' in value || 'account_name' in value || 'billing_status' in value) {
      return { account: value };
    }
    if ('charge_item_id' in value || 'charge_item_status' in value || 'charge_item_code' in value) {
      return { charge_item: value };
    }
    if ('charge_item_definition_id' in value || 'charge_item_definition_status' in value || 'charge_item_definition_code' in value) {
      return { charge_item_definition: value };
    }
    if ('device_id' in value || 'device_status' in value || 'device_display_name' in value) {
      return { device: value };
    }
    if ('device_metric_id' in value || 'device_metric_status' in value || 'device_metric_type' in value) {
      return { device_metric: value };
    }
    if ('endpoint_id' in value || 'endpoint_status' in value || 'endpoint_address' in value) {
      return { endpoint: value };
    }
    if ('binary_id' in value || 'content_type' in value || 'security_context' in value || 'data' in value) {
      return { binary: value };
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
    if ('person_id' in value || 'first_name' in value || 'last_name' in value) {
      return { person: value };
    }
    if ('location_id' in value || 'location_name' in value || 'address_line1' in value) {
      return { location: value };
    }
    if ('episode_of_care_id' in value || 'care_manager_id' in value || 'period_start' in value) {
      return { episode_of_care: value };
    }
    if ('verification_result_id' in value || 'target_ids' in value || 'validation_type' in value) {
      return { verification_result: value };
    }
    if ('substance_id' in value || 'substance_code' in value || 'ingredient_substance' in value) {
      return { substance: value };
    }
    if ('specimen_id' in value || 'accession_identifier' in value || 'received_time' in value) {
      return { specimen: value };
    }
    if ('imaging_study_id' in value || 'imaging_study_identifier' in value || 'started' in value) {
      return { imaging_study: value };
    }
    if ('allergy_id' in value || 'clinical_status' in value || 'criticality' in value) {
      return { allergy_intolerance: value };
    }
    if ('immunization_id' in value || 'vaccine_code' in value || 'lot_number' in value) {
      return { immunization: value };
    }
    if ('medication_id' in value || 'brand_name' in value || 'strength' in value) {
      return { medication: value };
    }
    if ('medication_knowledge_id' in value || 'medication_knowledge_status' in value || 'medication_knowledge_code' in value) {
      return { medication_knowledge: value };
    }
    if ('practitioner_role_id' in value || 'role' in value || 'specialty' in value) {
      return { practitioner_role: value };
    }
    if ('practitioner_id' in value || '_id' in value || 'medicalRegNo' in value || 'doctorFirstName' in value || 'doctorLastName' in value || 'communityWorkerFirstName' in value || 'communityWorkerLastName' in value || 'registrationNumber' in value || 'license' in value || value.name?.first_name) {
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
    'medication_knowledge_id' in value ||
    'medication_knowledge_status' in value ||
    'medication_knowledge_code' in value ||
    'medication_request_id' in value ||
    'dosage_instruction' in value ||
    'medication_statement_id' in value ||
    'date_asserted' in value ||
    'effective_date' in value ||
    'medication_administration_id' in value ||
    'dose_value' in value ||
    'medication_dispense_id' in value ||
    'quantity_value' in value ||
    'when_handed_over' in value ||
    'organization_affiliation_id' in value ||
    'participating_organization_id' in value ||
    'organization_id' in value ||
    'device_dispense_id' in value ||
    'device_dispense_status' in value ||
    'device_dispense_device_id' in value ||
    'device_request_id' in value ||
    'device_request_status' in value ||
    'device_request_device_code' in value ||
    'device_usage_id' in value ||
    'device_usage_status' in value ||
    'device_usage_device_code' in value ||
    'encounter_history_id' in value ||
    'encounter_history_status' in value ||
    'encounter_history_encounter_id' in value ||
    'flag_id' in value ||
    'flag_status' in value ||
    'flag_code' in value ||
    'observation_id' in value ||
    'observation_code' in value ||
    'list_id' in value ||
    'list_status' in value ||
    'list_mode' in value ||
    'nutrition_intake_id' in value ||
    'nutrition_intake_status' in value ||
    'nutrition_intake_code' in value ||
    'nutrition_order_id' in value ||
    'nutrition_order_status' in value ||
    'nutrition_order_intent' in value ||
    'risk_assessment_id' in value ||
    'risk_assessment_status' in value ||
    'risk_assessment_code' in value ||
    'nutrition_intake_id' in value ||
    'nutrition_intake_status' in value ||
    'nutrition_intake_code' in value ||
    'capability_statement_id' in value ||
    'capability_statement_url' in value ||
    'fhir_version' in value ||
    'operation_outcome_id' in value ||
    'severity' in value ||
    'diagnostics' in value ||
    'parameter_name' in value ||
    'parameter_value' in value ||
    'value_string' in value ||
    'care_plan_id' in value ||
    'intent' in value ||
    'care_team_id' in value ||
    'participant_member_id' in value ||
    'goal_id' in value ||
    'lifecycle_status' in value ||
    'service_request_id' in value ||
    'requester_id' in value ||
    'task_id' in value ||
    'task_status' in value ||
    'communication_id' in value ||
    'sent' in value ||
    'payload' in value ||
    'communication_request_id' in value ||
    'occurrence_date' in value ||
    'authored_on' in value ||
    'questionnaire_id' in value ||
    'subject_type' in value ||
    'item_link_id' in value ||
    'questionnaire_response_id' in value ||
    'authored' in value ||
    'item_answer' in value ||
    'code_system_id' in value ||
    'concept_code' in value ||
    'value_set_id' in value ||
    'include_code' in value ||
    'include_system' in value ||
    'concept_map_id' in value ||
    'element_code' in value ||
    'target_code' in value ||
    'naming_system_id' in value ||
    'unique_id_value' in value ||
    'kind' in value ||
    'terminology_capabilities_id' in value ||
    'code_search' in value ||
    'provenance_id' in value ||
    'activity' in value ||
    'recorded' in value ||
    'audit_event_id' in value ||
    'severity' in value ||
    'action' in value ||
    'consent_id' in value ||
    'decision' in value ||
    'procedure_id' in value ||
    'occurrence_date' in value ||
    'occurrence_start' in value ||
    'condition_id' in value ||
    'clinical_status' in value ||
    'verification_status' in value ||
    'appointment_id' in value ||
    'appointment_response_id' in value ||
    'participant_status' in value ||
    'claim_id' in value ||
    'claim_status' in value ||
    'claim_type' in value ||
    'claim_response_id' in value ||
    'claim_response_status' in value ||
    'claim_response_type' in value ||
    'composition_id' in value ||
    'composition_title' in value ||
    'composition_status' in value ||
    'explanation_of_benefit_id' in value ||
    'explanation_of_benefit_status' in value ||
    'explanation_of_benefit_type' in value ||
    'coverage_id' in value ||
    'coverage_status' in value ||
    'coverage_kind' in value ||
    'account_id' in value ||
    'account_status' in value ||
    'account_name' in value ||
    'charge_item_id' in value ||
    'charge_item_status' in value ||
    'charge_item_code' in value ||
    'charge_item_definition_id' in value ||
    'charge_item_definition_status' in value ||
    'charge_item_definition_code' in value ||
    'device_id' in value ||
    'device_status' in value ||
    'device_display_name' in value ||
    'device_metric_id' in value ||
    'device_metric_status' in value ||
    'device_metric_type' in value ||
    'endpoint_id' in value ||
    'endpoint_status' in value ||
    'endpoint_address' in value ||
    'binary_id' in value ||
    'content_type' in value ||
    'security_context' in value ||
    'data' in value ||
    'beneficiary_id' in value ||
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
    'person_id' in value ||
    'first_name' in value ||
    'last_name' in value ||
    'location_id' in value ||
    'location_name' in value ||
    'episode_of_care_id' in value ||
    'care_manager_id' in value ||
    'period_start' in value ||
    'verification_result_id' in value ||
    'target_ids' in value ||
    'validation_type' in value ||
    'substance_id' in value ||
    'substance_code' in value ||
    'ingredient_substance' in value ||
    'specimen_id' in value ||
    'accession_identifier' in value ||
    'received_time' in value ||
    'imaging_study_id' in value ||
    'imaging_study_identifier' in value ||
    'started' in value ||
    'allergy_id' in value ||
    'clinical_status' in value ||
    'criticality' in value ||
    'immunization_id' in value ||
    'vaccine_code' in value ||
    'lot_number' in value ||
    'practitioner_id' in value ||
    '_id' in value ||
    'medicalRegNo' in value ||
    'doctorFirstName' in value ||
    'doctorLastName' in value ||
    'communityWorkerFirstName' in value ||
    'communityWorkerLastName' in value ||
    'registrationNumber' in value ||
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
    resourceType: patient.resource_type,
    name: {
      family: patient.name?.last_name,
      given: given.length ? given : undefined
    },
    gender: mapGender(patient.gender),
    birthDate: patient.date_of_birth,
    deceasedBoolean: patient.deceased_boolean !== undefined ? normalizeBoolean(patient.deceased_boolean) : undefined,
    maritalStatus: patient.marital_status ? {
      code: patient.marital_status,
      display: patient.marital_status
    } : undefined,
    patientType: patient.patient_type,
    photo: typeof patient.photo === 'string'
      ? { url: patient.photo }
      : patient.photo
        ? { contentType: patient.photo.content_type, url: patient.photo.url, title: patient.photo.title, data: patient.photo.data }
        : undefined,
    age: patient.age,
    weight: patient.weight,
    weightUnit: patient.weight_unit,
    height: patient.height,
    heightTaken: patient.height_taken,
    heightUnit: patient.height_unit,
    bloodGroup: patient.blood_group,
    isPregnant: patient.is_pregnant,
    isDiabetic: patient.is_diabetic,
    isHypertension: patient.is_hypertension,
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
    end: encounter.end_date,
    location: locationParts || undefined,
    status: encounter.status,
    participantPractitionerIds: encounter.practitioner_id ? [encounter.practitioner_id] : undefined,
    serviceProviderOrganizationId: encounter.organization_id
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

function buildCanonicalMedicationKnowledgeGlobal(knowledge: z.infer<typeof GlobalMedicationKnowledgeSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  const mapPeriod = (source?: z.infer<typeof GlobalPeriodSchema>) => {
    if (!source) return undefined;
    return { start: source.start, end: source.end };
  };

  const mapMoney = (source?: z.infer<typeof GlobalMoneySchema>) => {
    if (!source) return undefined;
    return { value: toNumber(source.value as any), currency: source.currency };
  };

  const mapQuantity = (source?: z.infer<typeof GlobalQuantitySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      unit: source.unit,
      system: source.system,
      code: source.code
    };
  };

  const mapRange = (source?: z.infer<typeof GlobalRangeSchema>) => {
    if (!source) return undefined;
    return {
      low: source.low_value !== undefined || source.low_unit
        ? { value: toNumber(source.low_value as any), unit: source.low_unit }
        : undefined,
      high: source.high_value !== undefined || source.high_unit
        ? { value: toNumber(source.high_value as any), unit: source.high_unit }
        : undefined
    };
  };

  return {
    id: knowledge.medication_knowledge_id,
    identifier: normalizeArray(knowledge.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    code: mapCodeable(knowledge.code),
    status: knowledge.status,
    author: knowledge.author_id,
    intendedJurisdiction: normalizeArray(knowledge.intended_jurisdiction).map(j => mapCodeable(j as any)).filter(isDefined),
    name: normalizeStringArray(knowledge.name),
    relatedMedicationKnowledge: normalizeArray(knowledge.related_medication_knowledge).map(rel => ({
      type: mapCodeable((rel as any).type),
      reference: normalizeStringArray((rel as any).reference_ids)
    })).filter(rel => rel.type || (rel.reference && rel.reference.length > 0)),
    associatedMedication: normalizeStringArray(knowledge.associated_medication_ids),
    productType: normalizeArray(knowledge.product_type).map(pt => mapCodeable(pt as any)).filter(isDefined),
    monograph: normalizeArray(knowledge.monograph).map(item => ({
      type: mapCodeable((item as any).type),
      source: (item as any).source_id
    })).filter(item => item.type || item.source),
    preparationInstruction: knowledge.preparation_instruction,
    cost: normalizeArray(knowledge.cost).map(cost => ({
      effectiveDate: normalizeArray((cost as any).effective_date).map((date: any) => mapPeriod(date)).filter(isDefined),
      type: mapCodeable((cost as any).type),
      source: (cost as any).source,
      costMoney: mapMoney((cost as any).cost_money),
      costCodeableConcept: mapCodeable((cost as any).cost_codeable_concept)
    })).filter(cost => (cost.effectiveDate && cost.effectiveDate.length > 0) || cost.type || cost.source || cost.costMoney || cost.costCodeableConcept),
    monitoringProgram: normalizeArray(knowledge.monitoring_program).map(program => ({
      type: mapCodeable((program as any).type),
      name: (program as any).name
    })).filter(program => program.type || program.name),
    medicineClassification: normalizeArray(knowledge.medicine_classification).map(item => ({
      type: mapCodeable((item as any).type),
      sourceString: (item as any).source_string,
      sourceUri: (item as any).source_uri,
      classification: normalizeArray((item as any).classification).map((cls: any) => mapCodeable(cls)).filter(isDefined)
    })).filter(item => item.type || item.sourceString || item.sourceUri || (item.classification && item.classification.length > 0)),
    packaging: normalizeArray(knowledge.packaging).map(pack => ({
      cost: normalizeArray((pack as any).cost).map((cost: any) => ({
        effectiveDate: normalizeArray(cost.effective_date).map((date: any) => mapPeriod(date)).filter(isDefined),
        type: mapCodeable(cost.type),
        source: cost.source,
        costMoney: mapMoney(cost.cost_money),
        costCodeableConcept: mapCodeable(cost.cost_codeable_concept)
      })).filter(cost => (cost.effectiveDate && cost.effectiveDate.length > 0) || cost.type || cost.source || cost.costMoney || cost.costCodeableConcept),
      packagedProduct: (pack as any).packaged_product_id
    })).filter(pack => (pack.cost && pack.cost.length > 0) || pack.packagedProduct),
    clinicalUseIssue: normalizeStringArray(knowledge.clinical_use_issue_ids),
    storageGuideline: normalizeArray(knowledge.storage_guideline).map(item => ({
      reference: (item as any).reference,
      note: normalizeStringArray((item as any).note),
      stabilityDuration: mapQuantity((item as any).stability_duration)
        ? {
            value: mapQuantity((item as any).stability_duration)?.value,
            unit: mapQuantity((item as any).stability_duration)?.unit
          }
        : undefined,
      environmentalSetting: normalizeArray((item as any).environmental_setting).map((setting: any) => ({
        type: mapCodeable(setting.type),
        valueQuantity: mapQuantity(setting.value_quantity),
        valueRange: mapRange(setting.value_range),
        valueCodeableConcept: mapCodeable(setting.value_codeable_concept)
      })).filter(setting => setting.type || setting.valueQuantity || setting.valueRange || setting.valueCodeableConcept)
    })).filter(item => item.reference || (item.note && item.note.length > 0) || item.stabilityDuration || (item.environmentalSetting && item.environmentalSetting.length > 0)),
    regulatory: normalizeArray(knowledge.regulatory).map(reg => ({
      regulatoryAuthority: (reg as any).regulatory_authority_id,
      substitution: normalizeArray((reg as any).substitution).map((sub: any) => ({
        type: mapCodeable(sub.type),
        allowed: normalizeBoolean(sub.allowed)
      })).filter(sub => sub.type || sub.allowed !== undefined),
      schedule: normalizeArray((reg as any).schedule).map((sch: any) => mapCodeable(sch)).filter(isDefined),
      maxDispense: (reg as any).max_dispense ? {
        quantity: mapQuantity((reg as any).max_dispense.quantity),
        period: mapQuantity((reg as any).max_dispense.period)
          ? {
              value: mapQuantity((reg as any).max_dispense.period)?.value,
              unit: mapQuantity((reg as any).max_dispense.period)?.unit
            }
          : undefined
      } : undefined
    })).filter(reg => reg.regulatoryAuthority || (reg.substitution && reg.substitution.length > 0) || (reg.schedule && reg.schedule.length > 0) || reg.maxDispense),
    definitional: knowledge.definitional ? {
      definition: normalizeStringArray(knowledge.definitional.definition_ids),
      doseForm: mapCodeable(knowledge.definitional.dose_form),
      intendedRoute: normalizeArray(knowledge.definitional.intended_route).map(route => mapCodeable(route as any)).filter(isDefined),
      ingredient: normalizeArray(knowledge.definitional.ingredient).map(ing => ({
        itemReference: (ing as any).item_reference_id,
        itemCodeableConcept: mapCodeable((ing as any).item_codeable_concept),
        type: mapCodeable((ing as any).type),
        strengthRatio: (ing as any).strength_ratio ? {
          numerator: mapQuantity((ing as any).strength_ratio.numerator),
          denominator: mapQuantity((ing as any).strength_ratio.denominator)
        } : undefined,
        strengthCodeableConcept: mapCodeable((ing as any).strength_codeable_concept),
        strengthQuantity: mapQuantity((ing as any).strength_quantity)
      })).filter(ing => ing.itemReference || ing.itemCodeableConcept || ing.type || ing.strengthRatio || ing.strengthCodeableConcept || ing.strengthQuantity),
      drugCharacteristic: normalizeArray(knowledge.definitional.drug_characteristic).map(char => ({
        type: mapCodeable((char as any).type),
        valueCodeableConcept: mapCodeable((char as any).value_codeable_concept),
        valueString: (char as any).value_string,
        valueQuantity: mapQuantity((char as any).value_quantity),
        valueBase64Binary: (char as any).value_base64_binary,
        valueAttachment: (char as any).value_attachment
          ? {
              contentType: (char as any).value_attachment.content_type,
              url: (char as any).value_attachment.url,
              title: (char as any).value_attachment.title,
              data: (char as any).value_attachment.data
            }
          : undefined
      })).filter(char => char.type || char.valueCodeableConcept || char.valueString || char.valueQuantity || char.valueBase64Binary || char.valueAttachment)
    } : undefined
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

function buildCanonicalMedicationAdministrationGlobal(admin: z.infer<typeof GlobalMedicationAdministrationSchema>) {
  const medText = admin.medication?.name;
  const medCoding = admin.medication?.medication_id ? [{
    system: admin.medication?.code_system || 'urn:hl7-org:local',
    code: admin.medication.medication_id,
    display: admin.medication?.name
  }] : undefined;

  const statusReasons = normalizeStringArray(admin.status_reason);
  const categories = normalizeStringArray(admin.category);
  const supportingInfo = normalizeStringArray(admin.supporting_info_ids);
  const subPotentReasons = normalizeStringArray(admin.sub_potent_reason);
  const reasons = normalizeStringArray(admin.reason);
  const notes = normalizeStringArray(admin.note);
  const basedOn = normalizeStringArray(admin.based_on_ids);
  const partOf = normalizeStringArray(admin.part_of_ids);
  const devices = normalizeStringArray(admin.device_ids);

  const doseQuantity = parseQuantity(admin.dose_value !== undefined ? String(admin.dose_value) : undefined);
  if (doseQuantity && admin.dose_unit) {
    doseQuantity.unit = admin.dose_unit;
  }

  const dosageText = [
    admin.dose_value !== undefined ? String(admin.dose_value) : undefined,
    admin.dose_unit,
    admin.route,
    admin.site,
    admin.method
  ].filter(Boolean).join(' ');

  const rateQuantity = admin.rate_value !== undefined ? {
    value: Number(admin.rate_value),
    unit: admin.rate_unit
  } : undefined;

  return {
    id: admin.medication_administration_id,
    identifier: admin.medication_administration_id,
    basedOn: basedOn.length ? basedOn : undefined,
    partOf: partOf.length ? partOf : undefined,
    status: admin.status,
    statusReason: statusReasons.length
      ? statusReasons.map(value => ({ code: value, display: value }))
      : undefined,
    category: categories.length
      ? categories.map(value => ({ code: value, display: value }))
      : undefined,
    medicationCodeableConcept: medText || medCoding ? {
      coding: medCoding,
      text: medText
    } : undefined,
    subject: admin.patient_id,
    encounter: admin.encounter_id,
    supportingInformation: supportingInfo.length ? supportingInfo : undefined,
    occurrenceDateTime: admin.occurrence_date,
    occurrencePeriod: admin.occurrence_start || admin.occurrence_end ? {
      start: admin.occurrence_start,
      end: admin.occurrence_end
    } : undefined,
    recorded: admin.recorded,
    isSubPotent: normalizeBoolean(admin.is_sub_potent as any),
    subPotentReason: subPotentReasons.length
      ? subPotentReasons.map(value => ({ code: value, display: value }))
      : undefined,
    performer: admin.performer_actor_id || admin.performer_function ? [{
      function: admin.performer_function ? { code: admin.performer_function, display: admin.performer_function } : undefined,
      actor: admin.performer_actor_id || undefined
    }] : undefined,
    reason: reasons.length ? reasons.map(value => ({ code: { display: value } })) : undefined,
    request: admin.request_id,
    device: devices.length ? devices : undefined,
    note: notes.length ? notes : undefined,
    dosage: dosageText || doseQuantity || admin.route || admin.site || admin.method || rateQuantity ? {
      text: dosageText || undefined,
      site: admin.site ? { code: admin.site, display: admin.site } : undefined,
      route: admin.route ? { code: admin.route, display: admin.route } : undefined,
      method: admin.method ? { code: admin.method, display: admin.method } : undefined,
      dose: doseQuantity || undefined,
      rateQuantity
    } : undefined
  };
}

function buildCanonicalMedicationDispenseGlobal(dispense: z.infer<typeof GlobalMedicationDispenseSchema>) {
  const medText = dispense.medication?.name;
  const medCoding = dispense.medication?.medication_id ? [{
    system: dispense.medication?.code_system || 'urn:hl7-org:local',
    code: dispense.medication.medication_id,
    display: dispense.medication?.name
  }] : undefined;

  const categories = normalizeStringArray(dispense.category);
  const supportingInfo = normalizeStringArray(dispense.supporting_info_ids);
  const authorizingPrescriptions = normalizeStringArray(dispense.authorizing_prescription_ids);
  const receivers = normalizeStringArray(dispense.receiver_ids);
  const notes = normalizeStringArray(dispense.note);
  const basedOn = normalizeStringArray(dispense.based_on_ids);
  const partOf = normalizeStringArray(dispense.part_of_ids);
  const eventHistory = normalizeStringArray(dispense.event_history_ids);
  const substitutionReasons = normalizeStringArray(dispense.substitution_reason);

  const quantity = parseQuantity(dispense.quantity_value !== undefined ? String(dispense.quantity_value) : undefined);
  if (quantity && dispense.quantity_unit) quantity.unit = dispense.quantity_unit;

  const daysSupply = parseQuantity(dispense.days_supply_value !== undefined ? String(dispense.days_supply_value) : undefined);
  if (daysSupply && dispense.days_supply_unit) daysSupply.unit = dispense.days_supply_unit;

  const dosageText = normalizeStringArray(dispense.dosage_instruction).join('; ');

  const hasSubstitution = dispense.substitution_was_substituted !== undefined ||
    dispense.substitution_type ||
    substitutionReasons.length ||
    dispense.substitution_responsible_party;

  return {
    id: dispense.medication_dispense_id,
    identifier: dispense.medication_dispense_id,
    basedOn: basedOn.length ? basedOn : undefined,
    partOf: partOf.length ? partOf : undefined,
    status: dispense.status,
    statusChanged: dispense.status_changed,
    category: categories.length ? categories.map(value => ({ code: value, display: value })) : undefined,
    medicationCodeableConcept: medText || medCoding ? {
      coding: medCoding,
      text: medText
    } : undefined,
    subject: dispense.patient_id,
    encounter: dispense.encounter_id,
    supportingInformation: supportingInfo.length ? supportingInfo : undefined,
    performer: dispense.performer_actor_id || dispense.performer_function ? [{
      function: dispense.performer_function ? { code: dispense.performer_function, display: dispense.performer_function } : undefined,
      actor: dispense.performer_actor_id || undefined
    }] : undefined,
    location: dispense.location,
    authorizingPrescription: authorizingPrescriptions.length ? authorizingPrescriptions : undefined,
    type: dispense.type ? { code: dispense.type, display: dispense.type } : undefined,
    quantity: quantity || undefined,
    daysSupply: daysSupply || undefined,
    recorded: dispense.recorded,
    whenPrepared: dispense.when_prepared,
    whenHandedOver: dispense.when_handed_over,
    destination: dispense.destination,
    receiver: receivers.length ? receivers : undefined,
    note: notes.length ? notes : undefined,
    renderedDosageInstruction: dispense.rendered_dosage_instruction,
    dosageInstruction: dosageText ? [{ text: dosageText }] : undefined,
    substitution: hasSubstitution ? {
      wasSubstituted: normalizeBoolean(dispense.substitution_was_substituted as any),
      type: dispense.substitution_type ? { code: dispense.substitution_type, display: dispense.substitution_type } : undefined,
      reason: substitutionReasons.length
        ? substitutionReasons.map(value => ({ code: value, display: value }))
        : undefined,
      responsibleParty: dispense.substitution_responsible_party
    } : undefined,
    eventHistory: eventHistory.length ? eventHistory : undefined
  };
}

function buildCanonicalOrganizationAffiliationGlobal(affiliation: z.infer<typeof GlobalOrganizationAffiliationSchema>) {
  const networks = normalizeStringArray(affiliation.network_ids);
  const codes = normalizeStringArray(affiliation.code);
  const specialties = normalizeStringArray(affiliation.specialty);
  const locations = normalizeStringArray(affiliation.location_ids);
  const services = normalizeStringArray(affiliation.healthcare_service_ids);
  const endpoints = normalizeStringArray(affiliation.endpoint_ids);

  const contactTelecom = [];
  if (affiliation.contact_phone) {
    contactTelecom.push({ system: 'phone', value: affiliation.contact_phone });
  }
  if (affiliation.contact_email) {
    contactTelecom.push({ system: 'email', value: affiliation.contact_email });
  }

  return {
    id: affiliation.organization_affiliation_id,
    identifier: affiliation.organization_affiliation_id,
    active: normalizeBoolean(affiliation.active as any),
    period: affiliation.period_start || affiliation.period_end ? {
      start: affiliation.period_start,
      end: affiliation.period_end
    } : undefined,
    organization: affiliation.organization_id,
    participatingOrganization: affiliation.participating_organization_id,
    network: networks.length ? networks : undefined,
    code: codes.length ? codes.map(value => ({ code: value, display: value })) : undefined,
    specialty: specialties.length ? specialties.map(value => ({ code: value, display: value })) : undefined,
    location: locations.length ? locations : undefined,
    healthcareService: services.length ? services : undefined,
    contact: (affiliation.contact_name || contactTelecom.length) ? [{
      name: affiliation.contact_name,
      telecom: contactTelecom.length ? contactTelecom : undefined
    }] : undefined,
    endpoint: endpoints.length ? endpoints : undefined
  };
}

function buildCanonicalCapabilityStatementGlobal(statement: z.infer<typeof GlobalCapabilityStatementSchema>) {
  const identifiers = normalizeStringArray(statement.identifier);
  const formats = normalizeStringArray(statement.format);

  const software = statement.software_name || statement.software_version || statement.software_release_date
    ? {
      name: statement.software_name,
      version: statement.software_version,
      releaseDate: statement.software_release_date
    }
    : undefined;

  const implementation = statement.implementation_url || statement.implementation_description
    ? {
      url: statement.implementation_url,
      description: statement.implementation_description
    }
    : undefined;

  const rest = statement.rest_mode || statement.rest_documentation
    ? [{
      mode: statement.rest_mode,
      documentation: statement.rest_documentation
    }]
    : undefined;

  return {
    id: statement.capability_statement_id,
    url: statement.url,
    identifier: identifiers.length ? identifiers : undefined,
    version: statement.version,
    versionAlgorithmString: statement.version_algorithm,
    name: statement.name,
    title: statement.title,
    status: statement.status,
    experimental: normalizeBoolean(statement.experimental as any),
    date: statement.date,
    publisher: statement.publisher,
    description: statement.description,
    kind: statement.kind,
    fhirVersion: statement.fhir_version,
    format: formats.length ? formats : undefined,
    software,
    implementation,
    rest
  };
}

function buildCanonicalOperationOutcomeGlobal(outcome: z.infer<typeof GlobalOperationOutcomeSchema>) {
  const locations = normalizeStringArray(outcome.location);
  const expressions = normalizeStringArray(outcome.expression);

  return {
    id: outcome.operation_outcome_id,
    issue: [{
      severity: outcome.severity,
      code: outcome.code,
      details: outcome.details_system || outcome.details_code || outcome.details_display ? {
        system: outcome.details_system,
        code: outcome.details_code,
        display: outcome.details_display
      } : undefined,
      diagnostics: outcome.diagnostics,
      location: locations.length ? locations : undefined,
      expression: expressions.length ? expressions : undefined
    }]
  };
}

function buildCanonicalParametersGlobal(parameters: z.infer<typeof GlobalParametersSchema>[]) {
  const parameterList = parameters.map(param => {
    const name = param.parameter_name || 'parameter';
    const valueString = param.value_string || param.parameter_value;

    const entry: {
      name: string;
      valueString?: string;
      valueCode?: string;
      valueBoolean?: boolean;
      valueDate?: string;
      valueDateTime?: string;
      valueInteger?: number;
      valueDecimal?: number;
      valueUri?: string;
      valueReference?: string;
    } = { name };

    if (valueString !== undefined) entry.valueString = valueString;
    if (param.value_code !== undefined) entry.valueCode = param.value_code;
    if (param.value_boolean !== undefined) entry.valueBoolean = normalizeBoolean(param.value_boolean as any);
    if (param.value_date !== undefined) entry.valueDate = param.value_date;
    if (param.value_datetime !== undefined) entry.valueDateTime = param.value_datetime;
    if (param.value_integer !== undefined) entry.valueInteger = Number(param.value_integer);
    if (param.value_decimal !== undefined) entry.valueDecimal = Number(param.value_decimal);
    if (param.value_uri !== undefined) entry.valueUri = param.value_uri;
    if (param.value_reference !== undefined) entry.valueReference = param.value_reference;

    return entry;
  });

  return {
    id: `PARAMS-${Date.now()}`,
    parameter: parameterList
  };
}

function buildCanonicalCarePlanGlobal(plan: z.infer<typeof GlobalCarePlanSchema>) {
  const instantiatesCanonical = normalizeStringArray(plan.instantiates_canonical);
  const instantiatesUri = normalizeStringArray(plan.instantiates_uri);
  const basedOnIds = normalizeStringArray(plan.based_on_ids);
  const replacesIds = normalizeStringArray(plan.replaces_ids);
  const partOfIds = normalizeStringArray(plan.part_of_ids);
  const categories = normalizeStringArray(plan.category);
  const contributorIds = normalizeStringArray(plan.contributor_ids);
  const careTeamIds = normalizeStringArray(plan.care_team_ids);
  const addresses = normalizeStringArray(plan.addresses);
  const supportingInfoIds = normalizeStringArray(plan.supporting_info_ids);
  const goalIds = normalizeStringArray(plan.goal_ids);
  const activityProgress = normalizeStringArray(plan.activity_progress);
  const activityPerformed = normalizeStringArray(plan.activity_performed);
  const notes = normalizeStringArray(plan.note);

  const activity = (plan.activity_reference || activityProgress.length || activityPerformed.length)
    ? [{
      plannedActivityReference: plan.activity_reference,
      progress: activityProgress.length ? activityProgress : undefined,
      performedActivity: activityPerformed.length
        ? activityPerformed.map(value => ({
          code: { code: value, display: value }
        }))
        : undefined
    }]
    : undefined;

  return {
    id: plan.care_plan_id,
    identifier: plan.care_plan_id,
    instantiatesCanonical: instantiatesCanonical.length ? instantiatesCanonical : undefined,
    instantiatesUri: instantiatesUri.length ? instantiatesUri : undefined,
    basedOn: basedOnIds.length ? basedOnIds : undefined,
    replaces: replacesIds.length ? replacesIds : undefined,
    partOf: partOfIds.length ? partOfIds : undefined,
    status: plan.status,
    intent: plan.intent,
    category: categories.length
      ? categories.map(value => ({ code: value, display: value }))
      : undefined,
    title: plan.title,
    description: plan.description,
    subject: plan.subject_id,
    encounter: plan.encounter_id,
    period: plan.period_start || plan.period_end
      ? { start: plan.period_start, end: plan.period_end }
      : undefined,
    created: plan.created,
    custodian: plan.custodian_id,
    contributor: contributorIds.length ? contributorIds : undefined,
    careTeam: careTeamIds.length ? careTeamIds : undefined,
    addresses: addresses.length
      ? addresses.map(value => ({ code: { code: value, display: value } }))
      : undefined,
    supportingInfo: supportingInfoIds.length ? supportingInfoIds : undefined,
    goal: goalIds.length ? goalIds : undefined,
    activity,
    note: notes.length ? notes : undefined
  };
}

function buildCanonicalCareTeamGlobal(team: z.infer<typeof GlobalCareTeamSchema>) {
  const categories = normalizeStringArray(team.category);
  const reasons = normalizeStringArray(team.reason);
  const managingOrgs = normalizeStringArray(team.managing_org_ids);
  const notes = normalizeStringArray(team.note);

  const telecom: Array<{ system: 'phone' | 'email' | 'fax' | 'url' | 'other'; value: string; use?: string }> = [];
  if (team.phone) telecom.push({ system: 'phone', value: team.phone });
  if (team.email) telecom.push({ system: 'email', value: team.email });

  const participant = team.participant_member_id || team.participant_role || team.participant_on_behalf_of_id
    ? [{
      role: team.participant_role ? { code: team.participant_role, display: team.participant_role } : undefined,
      member: team.participant_member_id,
      onBehalfOf: team.participant_on_behalf_of_id,
      coveragePeriod: team.participant_coverage_start || team.participant_coverage_end
        ? { start: team.participant_coverage_start, end: team.participant_coverage_end }
        : undefined
    }]
    : undefined;

  return {
    id: team.care_team_id,
    identifier: team.care_team_id,
    status: team.status,
    category: categories.length ? categories.map(value => ({ code: value, display: value })) : undefined,
    name: team.name,
    subject: team.subject_id,
    period: team.period_start || team.period_end ? { start: team.period_start, end: team.period_end } : undefined,
    participant,
    reason: reasons.length ? reasons.map(value => ({ code: { code: value, display: value } })) : undefined,
    managingOrganization: managingOrgs.length ? managingOrgs : undefined,
    telecom: telecom.length ? telecom : undefined,
    note: notes.length ? notes : undefined
  };
}

function buildCanonicalGoalGlobal(goal: z.infer<typeof GlobalGoalSchema>) {
  const categories = normalizeStringArray(goal.category);
  const addresses = normalizeStringArray(goal.addresses);
  const notes = normalizeStringArray(goal.note);
  const outcomes = normalizeStringArray(goal.outcome);

  return {
    id: goal.goal_id,
    identifier: goal.goal_id,
    lifecycleStatus: goal.lifecycle_status,
    achievementStatus: goal.achievement_status
      ? { code: goal.achievement_status, display: goal.achievement_status }
      : undefined,
    category: categories.length ? categories.map(value => ({ code: value, display: value })) : undefined,
    continuous: normalizeBoolean(goal.continuous),
    priority: goal.priority ? { code: goal.priority, display: goal.priority } : undefined,
    description: goal.description ? { text: goal.description } : undefined,
    subject: goal.subject_id,
    startDate: goal.start_date,
    startCodeableConcept: goal.start_code ? { code: goal.start_code, display: goal.start_code } : undefined,
    target: (goal.target_measure || goal.target_detail || goal.target_due_date) ? [{
      measure: goal.target_measure ? { code: goal.target_measure, display: goal.target_measure } : undefined,
      detailString: goal.target_detail,
      dueDate: goal.target_due_date
    }] : undefined,
    statusDate: goal.status_date,
    statusReason: goal.status_reason,
    source: goal.source_id,
    addresses: addresses.length ? addresses : undefined,
    note: notes.length ? notes : undefined,
    outcome: outcomes.length ? outcomes : undefined
  };
}

function buildCanonicalServiceRequestGlobal(request: z.infer<typeof GlobalServiceRequestSchema>) {
  const categories = normalizeStringArray(request.category);
  const performers = normalizeStringArray(request.performer_ids);
  const locations = normalizeStringArray(request.location_ids);
  const reasons = normalizeStringArray(request.reason);
  const supportingInfo = normalizeStringArray(request.supporting_info_ids);
  const specimens = normalizeStringArray(request.specimen_ids);
  const bodySites = normalizeStringArray(request.body_site);
  const notes = normalizeStringArray(request.note);
  const instructions = normalizeStringArray(request.patient_instruction);
  const instantiatesCanonical = normalizeStringArray(request.instantiates_canonical);
  const instantiatesUri = normalizeStringArray(request.instantiates_uri);
  const basedOn = normalizeStringArray(request.based_on_ids);
  const replaces = normalizeStringArray(request.replaces_ids);

  return {
    id: request.service_request_id,
    identifier: request.service_request_id,
    instantiatesCanonical: instantiatesCanonical.length ? instantiatesCanonical : undefined,
    instantiatesUri: instantiatesUri.length ? instantiatesUri : undefined,
    basedOn: basedOn.length ? basedOn : undefined,
    replaces: replaces.length ? replaces : undefined,
    requisition: request.requisition,
    status: request.status,
    intent: request.intent,
    category: categories.length ? categories.map(value => ({ code: value, display: value })) : undefined,
    priority: request.priority,
    doNotPerform: normalizeBoolean(request.do_not_perform),
    code: (request.code?.code || request.code?.code_system || request.code?.display)
      ? {
        code: request.code?.code,
        system: request.code?.code_system,
        display: request.code?.display
      }
      : undefined,
    subject: request.subject_id,
    encounter: request.encounter_id,
    occurrenceDateTime: request.occurrence_date,
    occurrencePeriod: request.occurrence_start || request.occurrence_end
      ? { start: request.occurrence_start, end: request.occurrence_end }
      : undefined,
    asNeededBoolean: normalizeBoolean(request.as_needed),
    authoredOn: request.authored_on,
    requester: request.requester_id,
    performerType: request.performer_type ? { code: request.performer_type, display: request.performer_type } : undefined,
    performer: performers.length ? performers : undefined,
    location: locations.length ? locations : undefined,
    reason: reasons.length ? reasons : undefined,
    supportingInfo: supportingInfo.length ? supportingInfo : undefined,
    specimen: specimens.length ? specimens : undefined,
    bodySite: bodySites.length ? bodySites.map(value => ({ code: value, display: value })) : undefined,
    note: notes.length ? notes : undefined,
    patientInstruction: instructions.length ? instructions : undefined
  };
}

function buildCanonicalTaskGlobal(task: z.infer<typeof GlobalTaskSchema>) {
  const requestedPerformers = normalizeStringArray(task.requested_performer_ids);
  const reasons = normalizeStringArray(task.reason);
  const insuranceIds = normalizeStringArray(task.insurance_ids);
  const notes = normalizeStringArray(task.note);
  const relevantHistory = normalizeStringArray(task.relevant_history_ids);
  const basedOn = normalizeStringArray(task.based_on_ids);
  const partOf = normalizeStringArray(task.part_of_ids);

  return {
    id: task.task_id,
    identifier: task.task_id,
    instantiatesCanonical: task.instantiates_canonical,
    instantiatesUri: task.instantiates_uri,
    basedOn: basedOn.length ? basedOn : undefined,
    groupIdentifier: task.group_identifier,
    partOf: partOf.length ? partOf : undefined,
    status: task.status,
    statusReason: task.status_reason,
    businessStatus: task.business_status,
    intent: task.intent,
    priority: task.priority,
    doNotPerform: normalizeBoolean(task.do_not_perform),
    code: (task.code?.code || task.code?.code_system || task.code?.display)
      ? {
        code: task.code?.code,
        system: task.code?.code_system,
        display: task.code?.display
      }
      : undefined,
    description: task.description,
    focus: task.focus_id,
    for: task.for_id,
    encounter: task.encounter_id,
    requestedPeriod: task.requested_start || task.requested_end
      ? { start: task.requested_start, end: task.requested_end }
      : undefined,
    executionPeriod: task.execution_start || task.execution_end
      ? { start: task.execution_start, end: task.execution_end }
      : undefined,
    authoredOn: task.authored_on,
    lastModified: task.last_modified,
    requester: task.requester_id,
    requestedPerformer: requestedPerformers.length ? requestedPerformers : undefined,
    owner: task.owner_id,
    performer: (task.performer_id || task.performer_function)
      ? [{
        actor: task.performer_id,
        function: task.performer_function ? {
          code: task.performer_function,
          display: task.performer_function
        } : undefined
      }]
      : undefined,
    location: task.location,
    reason: reasons.length ? reasons : undefined,
    insurance: insuranceIds.length ? insuranceIds : undefined,
    note: notes.length ? notes : undefined,
    relevantHistory: relevantHistory.length ? relevantHistory : undefined
  };
}

function buildCanonicalCommunicationGlobal(comm: z.infer<typeof GlobalCommunicationSchema>) {
  const categories = normalizeStringArray(comm.category);
  const mediums = normalizeStringArray(comm.medium);
  const about = normalizeStringArray(comm.about_ids);
  const recipients = normalizeStringArray(comm.recipient_ids);
  const reasons = normalizeStringArray(comm.reason);
  const payloads = normalizeStringArray(comm.payload);
  const notes = normalizeStringArray(comm.note);
  const instantiatesCanonical = normalizeStringArray(comm.instantiates_canonical);
  const instantiatesUri = normalizeStringArray(comm.instantiates_uri);
  const basedOn = normalizeStringArray(comm.based_on_ids);
  const partOf = normalizeStringArray(comm.part_of_ids);
  const inResponseTo = normalizeStringArray(comm.in_response_to_ids);

  const statusReason = comm.status_reason || comm.status_reason_code || comm.status_reason_display
    ? {
      system: comm.status_reason_system,
      code: comm.status_reason_code,
      display: comm.status_reason_display || comm.status_reason
    }
    : undefined;

  const topicValue = comm.topic || comm.topic_code || comm.topic_display;

  return {
    id: comm.communication_id,
    identifier: comm.communication_id,
    instantiatesCanonical: instantiatesCanonical.length ? instantiatesCanonical : undefined,
    instantiatesUri: instantiatesUri.length ? instantiatesUri : undefined,
    basedOn: basedOn.length ? basedOn : undefined,
    partOf: partOf.length ? partOf : undefined,
    inResponseTo: inResponseTo.length ? inResponseTo : undefined,
    status: comm.status,
    statusReason,
    category: categories.length ? categories.map(value => ({ code: value, display: value })) : undefined,
    priority: comm.priority,
    medium: mediums.length ? mediums.map(value => ({ code: value, display: value })) : undefined,
    subject: comm.subject_id,
    topic: topicValue
      ? {
        system: comm.topic_system,
        code: comm.topic_code || comm.topic,
        display: comm.topic_display || comm.topic
      }
      : undefined,
    about: about.length ? about : undefined,
    encounter: comm.encounter_id,
    sent: comm.sent,
    received: comm.received,
    recipient: recipients.length ? recipients : undefined,
    sender: comm.sender_id,
    reason: reasons.length ? reasons : undefined,
    payload: payloads.length ? payloads : undefined,
    note: notes.length ? notes : undefined
  };
}

function buildCanonicalCommunicationRequestGlobal(request: z.infer<typeof GlobalCommunicationRequestSchema>) {
  const categories = normalizeStringArray(request.category);
  const mediums = normalizeStringArray(request.medium);
  const about = normalizeStringArray(request.about_ids);
  const recipients = normalizeStringArray(request.recipient_ids);
  const informationProviders = normalizeStringArray(request.information_provider_ids);
  const reasons = normalizeStringArray(request.reason);
  const payloads = normalizeStringArray(request.payload);
  const notes = normalizeStringArray(request.note);
  const basedOn = normalizeStringArray(request.based_on_ids);
  const replaces = normalizeStringArray(request.replaces_ids);

  const statusReason = request.status_reason || request.status_reason_code || request.status_reason_display
    ? {
      system: request.status_reason_system,
      code: request.status_reason_code,
      display: request.status_reason_display || request.status_reason
    }
    : undefined;

  return {
    id: request.communication_request_id,
    identifier: request.communication_request_id,
    basedOn: basedOn.length ? basedOn : undefined,
    replaces: replaces.length ? replaces : undefined,
    groupIdentifier: request.group_identifier,
    status: request.status,
    statusReason,
    intent: request.intent,
    category: categories.length ? categories.map(value => ({ code: value, display: value })) : undefined,
    priority: request.priority,
    doNotPerform: normalizeBoolean(request.do_not_perform),
    medium: mediums.length ? mediums.map(value => ({ code: value, display: value })) : undefined,
    subject: request.subject_id,
    about: about.length ? about : undefined,
    encounter: request.encounter_id,
    payload: payloads.length ? payloads : undefined,
    occurrenceDateTime: request.occurrence_date,
    occurrencePeriod: request.occurrence_start || request.occurrence_end
      ? { start: request.occurrence_start, end: request.occurrence_end }
      : undefined,
    authoredOn: request.authored_on,
    requester: request.requester_id,
    recipient: recipients.length ? recipients : undefined,
    informationProvider: informationProviders.length ? informationProviders : undefined,
    reason: reasons.length ? reasons : undefined,
    note: notes.length ? notes : undefined
  };
}

function buildCanonicalQuestionnaireGlobal(qnr: z.infer<typeof GlobalQuestionnaireSchema>) {
  const subjectTypes = normalizeStringArray(qnr.subject_type);
  const itemsInput = normalizeArray(qnr.item);
  const items: Array<{ linkId?: string; text?: string; type?: string }> = [];

  for (const item of itemsInput) {
    if (!item) continue;
    items.push({
      linkId: item.link_id,
      text: item.text,
      type: item.type
    });
  }

  if (qnr.item_link_id || qnr.item_text || qnr.item_type) {
    items.push({
      linkId: qnr.item_link_id,
      text: qnr.item_text,
      type: qnr.item_type
    });
  }

  return {
    id: qnr.questionnaire_id,
    identifier: qnr.identifier || qnr.questionnaire_id,
    url: qnr.url,
    version: qnr.version,
    name: qnr.name,
    title: qnr.title,
    status: qnr.status,
    date: qnr.date,
    publisher: qnr.publisher,
    description: qnr.description,
    subjectType: subjectTypes.length ? subjectTypes : undefined,
    item: items.length ? items : undefined
  };
}

function buildCanonicalQuestionnaireResponseGlobal(resp: z.infer<typeof GlobalQuestionnaireResponseSchema>) {
  const basedOn = normalizeStringArray(resp.based_on_ids);
  const partOf = normalizeStringArray(resp.part_of_ids);
  const itemsInput = normalizeArray(resp.item);
  const items: Array<{ linkId?: string; text?: string; answer?: string[] }> = [];

  for (const item of itemsInput) {
    if (!item) continue;
    const answers = normalizeStringArray(item.answer);
    items.push({
      linkId: item.link_id,
      text: item.text,
      answer: answers.length ? answers : undefined
    });
  }

  if (resp.item_link_id || resp.item_text || resp.item_answer) {
    const answers = normalizeStringArray(resp.item_answer);
    items.push({
      linkId: resp.item_link_id,
      text: resp.item_text,
      answer: answers.length ? answers : undefined
    });
  }

  return {
    id: resp.questionnaire_response_id,
    identifier: resp.questionnaire_response_id,
    basedOn: basedOn.length ? basedOn : undefined,
    partOf: partOf.length ? partOf : undefined,
    questionnaire: resp.questionnaire,
    status: resp.status,
    subject: resp.subject_id,
    encounter: resp.encounter_id,
    authored: resp.authored,
    author: resp.author_id,
    source: resp.source_id,
    item: items.length ? items : undefined
  };
}

function buildCanonicalCodeSystemGlobal(system: z.infer<typeof GlobalCodeSystemSchema>) {
  const concepts = normalizeArray(system.concept).map(concept => ({
    code: concept.code,
    display: concept.display,
    definition: concept.definition
  }));

  if (system.concept_code || system.concept_display || system.concept_definition) {
    concepts.push({
      code: system.concept_code,
      display: system.concept_display,
      definition: system.concept_definition
    });
  }

  return {
    id: system.code_system_id,
    url: system.url,
    identifier: system.identifier,
    version: system.version,
    name: system.name,
    title: system.title,
    status: system.status,
    date: system.date,
    publisher: system.publisher,
    description: system.description,
    content: system.content,
    caseSensitive: normalizeBoolean(system.case_sensitive),
    concept: concepts.length ? concepts : undefined
  };
}

function buildCanonicalValueSetGlobal(valueSet: z.infer<typeof GlobalValueSetSchema>) {
  const includeConcept = valueSet.include_code || valueSet.include_display
    ? [{
      code: valueSet.include_code,
      display: valueSet.include_display
    }]
    : undefined;

  const composeInclude = valueSet.include_system || includeConcept
    ? [{ system: valueSet.include_system, concept: includeConcept }]
    : undefined;

  const expansionContains = valueSet.expansion_code || valueSet.expansion_display || valueSet.expansion_system
    ? [{
      system: valueSet.expansion_system,
      code: valueSet.expansion_code,
      display: valueSet.expansion_display
    }]
    : undefined;

  return {
    id: valueSet.value_set_id,
    url: valueSet.url,
    identifier: valueSet.identifier,
    version: valueSet.version,
    name: valueSet.name,
    title: valueSet.title,
    status: valueSet.status,
    date: valueSet.date,
    publisher: valueSet.publisher,
    description: valueSet.description,
    compose: composeInclude ? { include: composeInclude } : undefined,
    expansion: expansionContains ? { contains: expansionContains } : undefined
  };
}

function buildCanonicalConceptMapGlobal(conceptMap: z.infer<typeof GlobalConceptMapSchema>) {
  const targetEntry = conceptMap.target_code || conceptMap.target_display || conceptMap.target_relationship
    ? [{
      code: conceptMap.target_code,
      display: conceptMap.target_display,
      relationship: conceptMap.target_relationship
    }]
    : undefined;

  const elementEntry = conceptMap.element_code || conceptMap.element_display || targetEntry
    ? [{
      code: conceptMap.element_code,
      display: conceptMap.element_display,
      target: targetEntry
    }]
    : undefined;

  const groupEntry = conceptMap.group_source || conceptMap.group_target || elementEntry
    ? [{
      source: conceptMap.group_source,
      target: conceptMap.group_target,
      element: elementEntry
    }]
    : undefined;

  return {
    id: conceptMap.concept_map_id,
    url: conceptMap.url,
    identifier: conceptMap.identifier,
    version: conceptMap.version,
    name: conceptMap.name,
    title: conceptMap.title,
    status: conceptMap.status,
    date: conceptMap.date,
    publisher: conceptMap.publisher,
    description: conceptMap.description,
    sourceScope: conceptMap.source_scope,
    targetScope: conceptMap.target_scope,
    group: groupEntry
  };
}

function buildCanonicalNamingSystemGlobal(namingSystem: z.infer<typeof GlobalNamingSystemSchema>) {
  const uniqueId = namingSystem.unique_id_type || namingSystem.unique_id_value || namingSystem.unique_id_preferred !== undefined
    ? [{
      type: namingSystem.unique_id_type,
      value: namingSystem.unique_id_value,
      preferred: normalizeBoolean(namingSystem.unique_id_preferred)
    }]
    : undefined;

  return {
    id: namingSystem.naming_system_id,
    url: namingSystem.url,
    identifier: namingSystem.identifier,
    version: namingSystem.version,
    name: namingSystem.name,
    title: namingSystem.title,
    status: namingSystem.status,
    kind: namingSystem.kind,
    date: namingSystem.date,
    publisher: namingSystem.publisher,
    responsible: namingSystem.responsible,
    description: namingSystem.description,
    usage: namingSystem.usage,
    uniqueId: uniqueId
  };
}

function buildCanonicalTerminologyCapabilitiesGlobal(tc: z.infer<typeof GlobalTerminologyCapabilitiesSchema>) {
  return {
    id: tc.terminology_capabilities_id,
    url: tc.url,
    identifier: tc.identifier,
    version: tc.version,
    name: tc.name,
    title: tc.title,
    status: tc.status,
    date: tc.date,
    publisher: tc.publisher,
    description: tc.description,
    kind: tc.kind,
    codeSearch: tc.code_search
  };
}

function buildCanonicalProvenanceGlobal(prov: z.infer<typeof GlobalProvenanceSchema>) {
  const targets = normalizeStringArray(prov.target_ids);
  const agent = prov.agent_who || prov.agent_role
    ? [{
      who: prov.agent_who,
      role: prov.agent_role
    }]
    : undefined;

  return {
    id: prov.provenance_id,
    target: targets.length ? targets : undefined,
    recorded: prov.recorded,
    activity: prov.activity,
    agent: agent
  };
}

function buildCanonicalAuditEventGlobal(event: z.infer<typeof GlobalAuditEventSchema>) {
  const agent = event.agent_who || event.agent_role || event.agent_requestor !== undefined
    ? [{
      who: event.agent_who,
      role: event.agent_role,
      requestor: normalizeBoolean(event.agent_requestor)
    }]
    : undefined;

  return {
    id: event.audit_event_id,
    category: event.category,
    code: event.code,
    action: event.action,
    severity: event.severity,
    recorded: event.recorded,
    agent: agent
  };
}

function buildCanonicalConsentGlobal(consent: z.infer<typeof GlobalConsentSchema>) {
  const grantors = normalizeStringArray(consent.grantor_ids);
  const grantees = normalizeStringArray(consent.grantee_ids);

  return {
    id: consent.consent_id,
    status: consent.status,
    category: consent.category,
    subject: consent.subject_id,
    date: consent.date,
    decision: consent.decision,
    grantor: grantors.length ? grantors : undefined,
    grantee: grantees.length ? grantees : undefined
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

function buildCanonicalAppointmentResponseGlobal(response: z.infer<typeof GlobalAppointmentResponseSchema>) {
  const proposedNewTime = normalizeBoolean(response.proposed_new_time);
  const recurring = normalizeBoolean(response.recurring);
  const participantTypes = normalizeStringArray(response.participant_type);
  const recurrenceId = typeof response.recurrence_id === 'number'
    ? response.recurrence_id
    : response.recurrence_id ? Number(response.recurrence_id) : undefined;

  return {
    id: response.appointment_response_id,
    identifier: response.appointment_response_id,
    appointment: response.appointment_id,
    proposedNewTime,
    start: response.start,
    end: response.end,
    participantType: participantTypes.length ? participantTypes.map(value => ({
      code: value,
      display: value
    })) : undefined,
    actor: response.actor_id,
    participantStatus: response.participant_status,
    comment: response.comment,
    recurring,
    occurrenceDate: response.occurrence_date,
    recurrenceId: Number.isFinite(recurrenceId as number) ? recurrenceId : undefined
  };
}

function buildCanonicalClaimGlobal(claim: z.infer<typeof GlobalClaimSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const toNumberList = (value?: string | string[]) => {
    const values = normalizeStringArray(value);
    const numbers = values.map(item => Number(item)).filter(num => Number.isFinite(num));
    return numbers.length ? numbers : undefined;
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  const mapMoney = (source?: z.infer<typeof GlobalMoneySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      currency: source.currency
    };
  };

  const mapQuantity = (source?: z.infer<typeof GlobalQuantitySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      unit: source.unit,
      system: source.system,
      code: source.code
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const mapAddress = (source?: z.infer<typeof GlobalAddressSchema>) => {
    if (!source) return undefined;
    return {
      line: source.street ? [source.street] : undefined,
      city: source.city,
      state: source.state,
      postalCode: source.postal_code,
      country: source.country
    };
  };

  const related = normalizeArray(claim.related).map(entry => ({
    claim: entry.claim_id,
    relationship: mapCodeable(entry.relationship),
    reference: entry.reference ? { system: entry.reference.system, value: entry.reference.value } : undefined
  }));

  const events = normalizeArray(claim.event).map(entry => ({
    type: mapCodeable(entry.type),
    whenDateTime: entry.when_date_time,
    whenPeriod: entry.when_start || entry.when_end ? { start: entry.when_start, end: entry.when_end } : undefined
  }));

  const careTeams = normalizeArray(claim.care_team).map(entry => ({
    sequence: toNumber(entry.sequence as any),
    provider: entry.provider_id,
    responsible: normalizeBoolean(entry.responsible),
    role: mapCodeable(entry.role),
    specialty: mapCodeable(entry.specialty)
  }));

  const supportingInfo = normalizeArray(claim.supporting_info).map(entry => ({
    sequence: toNumber(entry.sequence as any),
    category: mapCodeable(entry.category),
    code: mapCodeable(entry.code),
    timingDate: entry.timing_date,
    timingPeriod: entry.timing_start || entry.timing_end ? { start: entry.timing_start, end: entry.timing_end } : undefined,
    valueBoolean: normalizeBoolean(entry.value_boolean),
    valueString: entry.value_string,
    valueQuantity: mapQuantity(entry.value_quantity),
    valueAttachment: entry.value_attachment ? {
      contentType: entry.value_attachment.content_type,
      url: entry.value_attachment.url,
      title: entry.value_attachment.title,
      data: entry.value_attachment.data
    } : undefined,
    valueReference: entry.value_reference_id,
    valueIdentifier: mapIdentifier(entry.value_identifier),
    reason: mapCodeable(entry.reason)
  }));

  const diagnoses = normalizeArray(claim.diagnosis).map(entry => ({
    sequence: toNumber(entry.sequence as any),
    diagnosisCodeableConcept: mapCodeable(entry.diagnosis_code),
    diagnosisReference: entry.diagnosis_reference_id,
    type: normalizeArray(entry.type).map(typeEntry => mapCodeable(typeEntry as any)).filter(isDefined),
    onAdmission: mapCodeable(entry.on_admission)
  }));

  const procedures = normalizeArray(claim.procedure).map(entry => ({
    sequence: toNumber(entry.sequence as any),
    type: normalizeArray(entry.type).map(typeEntry => mapCodeable(typeEntry as any)).filter(isDefined),
    date: entry.date,
    procedureCodeableConcept: mapCodeable(entry.procedure_code),
    procedureReference: entry.procedure_reference_id,
    udi: normalizeStringArray(entry.udi_ids)
  }));

  const insurance = normalizeArray(claim.insurance).map(entry => ({
    sequence: toNumber(entry.sequence as any),
    focal: normalizeBoolean(entry.focal),
    identifier: mapIdentifier(entry.identifier),
    coverage: entry.coverage_id,
    businessArrangement: entry.business_arrangement,
    preAuthRef: normalizeStringArray(entry.pre_auth_ref),
    claimResponse: entry.claim_response_id
  }));

  const items = normalizeArray(claim.item).map(entry => ({
    sequence: toNumber(entry.sequence as any),
    traceNumber: normalizeArray(entry.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    careTeamSequence: toNumberList(entry.care_team_sequence),
    diagnosisSequence: toNumberList(entry.diagnosis_sequence),
    procedureSequence: toNumberList(entry.procedure_sequence),
    informationSequence: toNumberList(entry.information_sequence),
    revenue: mapCodeable(entry.revenue),
    category: mapCodeable(entry.category),
    productOrService: mapCodeable(entry.product_or_service),
    productOrServiceEnd: mapCodeable(entry.product_or_service_end),
    request: normalizeStringArray(entry.request_ids),
    modifier: normalizeArray(entry.modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
    programCode: normalizeArray(entry.program_code).map(code => mapCodeable(code as any)).filter(isDefined),
    servicedDate: entry.serviced_date,
    servicedPeriod: entry.serviced_start || entry.serviced_end ? { start: entry.serviced_start, end: entry.serviced_end } : undefined,
    locationCodeableConcept: mapCodeable(entry.location_codeable),
    locationAddress: mapAddress(entry.location_address),
    locationReference: entry.location_reference_id,
    patientPaid: mapMoney(entry.patient_paid),
    quantity: mapQuantity(entry.quantity),
    unitPrice: mapMoney(entry.unit_price),
    factor: toNumber(entry.factor as any),
    tax: mapMoney(entry.tax),
    net: mapMoney(entry.net),
    udi: normalizeStringArray(entry.udi_ids),
    encounter: normalizeStringArray(entry.encounter_ids),
    detail: normalizeArray(entry.detail).map(detail => ({
      sequence: toNumber((detail as any).sequence),
      traceNumber: normalizeArray((detail as any).trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
      revenue: mapCodeable((detail as any).revenue),
      category: mapCodeable((detail as any).category),
      productOrService: mapCodeable((detail as any).product_or_service),
      productOrServiceEnd: mapCodeable((detail as any).product_or_service_end),
      modifier: normalizeArray((detail as any).modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
      programCode: normalizeArray((detail as any).program_code).map(code => mapCodeable(code as any)).filter(isDefined),
      patientPaid: mapMoney((detail as any).patient_paid),
      quantity: mapQuantity((detail as any).quantity),
      unitPrice: mapMoney((detail as any).unit_price),
      factor: toNumber((detail as any).factor),
      tax: mapMoney((detail as any).tax),
      net: mapMoney((detail as any).net),
      udi: normalizeStringArray((detail as any).udi_ids),
      subDetail: normalizeArray((detail as any).sub_detail).map(sub => ({
        sequence: toNumber((sub as any).sequence),
        traceNumber: normalizeArray((sub as any).trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
        revenue: mapCodeable((sub as any).revenue),
        category: mapCodeable((sub as any).category),
        productOrService: mapCodeable((sub as any).product_or_service),
        productOrServiceEnd: mapCodeable((sub as any).product_or_service_end),
        modifier: normalizeArray((sub as any).modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
        programCode: normalizeArray((sub as any).program_code).map(code => mapCodeable(code as any)).filter(isDefined),
        patientPaid: mapMoney((sub as any).patient_paid),
        quantity: mapQuantity((sub as any).quantity),
        unitPrice: mapMoney((sub as any).unit_price),
        factor: toNumber((sub as any).factor),
        tax: mapMoney((sub as any).tax),
        net: mapMoney((sub as any).net),
        udi: normalizeStringArray((sub as any).udi_ids)
      }))
    }))
  }));

  return {
    id: claim.claim_id,
    identifier: claim.claim_id ? [{ value: claim.claim_id }] : undefined,
    status: claim.status,
    type: mapCodeable(claim.type),
    subType: mapCodeable(claim.sub_type),
    use: claim.use,
    patient: claim.patient_id,
    billablePeriod: claim.billable_start || claim.billable_end ? { start: claim.billable_start, end: claim.billable_end } : undefined,
    created: claim.created,
    enterer: claim.enterer_id,
    insurer: claim.insurer_id,
    provider: claim.provider_id,
    priority: mapCodeable(claim.priority),
    fundsReserve: mapCodeable(claim.funds_reserve),
    related: related.length ? related : undefined,
    prescription: claim.prescription_id,
    originalPrescription: claim.original_prescription_id,
    payee: claim.payee ? {
      type: mapCodeable(claim.payee.type),
      party: claim.payee.party_id
    } : undefined,
    referral: claim.referral_id,
    encounter: normalizeStringArray(claim.encounter_ids),
    facility: claim.facility_id,
    diagnosisRelatedGroup: mapCodeable(claim.diagnosis_related_group),
    event: events.length ? events : undefined,
    careTeam: careTeams.length ? careTeams : undefined,
    supportingInfo: supportingInfo.length ? supportingInfo : undefined,
    diagnosis: diagnoses.length ? diagnoses : undefined,
    procedure: procedures.length ? procedures : undefined,
    insurance: insurance.length ? insurance : undefined,
    accident: claim.accident ? {
      date: claim.accident.date,
      type: mapCodeable(claim.accident.type),
      locationAddress: mapAddress(claim.accident.location_address),
      locationReference: claim.accident.location_reference_id
    } : undefined,
    patientPaid: mapMoney(claim.patient_paid),
    item: items.length ? items : undefined,
    total: mapMoney(claim.total)
  };
}

function buildCanonicalClaimResponseGlobal(response: z.infer<typeof GlobalClaimResponseSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const toNumberList = (value?: string | string[]) => {
    const values = normalizeStringArray(value);
    const numbers = values.map(item => Number(item)).filter(num => Number.isFinite(num));
    return numbers.length ? numbers : undefined;
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  const mapMoney = (source?: z.infer<typeof GlobalMoneySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      currency: source.currency
    };
  };

  const mapQuantity = (source?: z.infer<typeof GlobalQuantitySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      unit: source.unit,
      system: source.system,
      code: source.code
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const mapReviewOutcome = (entry?: z.infer<typeof GlobalClaimResponseReviewOutcomeSchema>) => {
    if (!entry) return undefined;
    return {
      decision: mapCodeable(entry.decision),
    reason: normalizeArray(entry.reason).map(reason => mapCodeable(reason as any)).filter(isDefined),
      preAuthRef: entry.pre_auth_ref,
      preAuthPeriod: mapPeriod(entry.pre_auth_start, entry.pre_auth_end)
    };
  };

  const mapAdjudication = (entry?: z.infer<typeof GlobalClaimResponseAdjudicationSchema>) => {
    if (!entry) return undefined;
    return {
      category: mapCodeable(entry.category),
      reason: mapCodeable(entry.reason),
      amount: mapMoney(entry.amount),
      quantity: mapQuantity(entry.quantity)
    };
  };

  const mapItemDetail = (detail: z.infer<typeof GlobalClaimResponseItemDetailSchema>) => ({
    detailSequence: toNumber(detail.detail_sequence as any),
    traceNumber: normalizeArray(detail.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    noteNumber: toNumberList(detail.note_number),
    reviewOutcome: mapReviewOutcome(detail.review_outcome),
    adjudication: normalizeArray(detail.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined),
    subDetail: normalizeArray(detail.sub_detail).map(sub => ({
      subDetailSequence: toNumber((sub as any).sub_detail_sequence),
      traceNumber: normalizeArray((sub as any).trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
      noteNumber: toNumberList((sub as any).note_number),
      reviewOutcome: mapReviewOutcome((sub as any).review_outcome),
      adjudication: normalizeArray((sub as any).adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined)
    }))
  });

  const mapItem = (item: z.infer<typeof GlobalClaimResponseItemSchema>) => ({
    itemSequence: toNumber(item.item_sequence as any),
    traceNumber: normalizeArray(item.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    noteNumber: toNumberList(item.note_number),
    reviewOutcome: mapReviewOutcome(item.review_outcome),
    adjudication: normalizeArray(item.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined),
    detail: normalizeArray(item.detail).map(detail => mapItemDetail(detail as any))
  });

  const mapAddItemDetail = (detail: z.infer<typeof GlobalClaimResponseAddItemDetailSchema>) => ({
    traceNumber: normalizeArray(detail.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    revenue: mapCodeable(detail.revenue),
    productOrService: mapCodeable(detail.product_or_service),
    productOrServiceEnd: mapCodeable(detail.product_or_service_end),
    modifier: normalizeArray(detail.modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
    quantity: mapQuantity(detail.quantity),
    unitPrice: mapMoney(detail.unit_price),
    factor: toNumber(detail.factor as any),
    tax: mapMoney(detail.tax),
    net: mapMoney(detail.net),
    noteNumber: toNumberList(detail.note_number),
    reviewOutcome: mapReviewOutcome(detail.review_outcome),
    adjudication: normalizeArray(detail.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined),
    subDetail: normalizeArray(detail.sub_detail).map(sub => ({
      traceNumber: normalizeArray((sub as any).trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
      revenue: mapCodeable((sub as any).revenue),
      productOrService: mapCodeable((sub as any).product_or_service),
      productOrServiceEnd: mapCodeable((sub as any).product_or_service_end),
      modifier: normalizeArray((sub as any).modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
      quantity: mapQuantity((sub as any).quantity),
      unitPrice: mapMoney((sub as any).unit_price),
      factor: toNumber((sub as any).factor),
      tax: mapMoney((sub as any).tax),
      net: mapMoney((sub as any).net),
      noteNumber: toNumberList((sub as any).note_number),
      reviewOutcome: mapReviewOutcome((sub as any).review_outcome),
      adjudication: normalizeArray((sub as any).adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined)
    }))
  });

  const mapAddItem = (item: z.infer<typeof GlobalClaimResponseAddItemSchema>) => ({
    itemSequence: toNumberList(item.item_sequence),
    detailSequence: toNumberList(item.detail_sequence),
    subdetailSequence: toNumberList(item.subdetail_sequence),
    traceNumber: normalizeArray(item.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    provider: normalizeStringArray(item.provider_ids),
    revenue: mapCodeable(item.revenue),
    productOrService: mapCodeable(item.product_or_service),
    productOrServiceEnd: mapCodeable(item.product_or_service_end),
    request: normalizeStringArray(item.request_ids),
    modifier: normalizeArray(item.modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
    programCode: normalizeArray(item.program_code).map(code => mapCodeable(code as any)).filter(isDefined),
    servicedDate: item.serviced_date,
    servicedPeriod: mapPeriod(item.serviced_start, item.serviced_end),
    locationCodeableConcept: mapCodeable(item.location_codeable),
    locationAddress: item.location_address ? {
      line: item.location_address.street ? [item.location_address.street] : undefined,
      city: item.location_address.city,
      state: item.location_address.state,
      postalCode: item.location_address.postal_code,
      country: item.location_address.country
    } : undefined,
    locationReference: item.location_reference_id,
    quantity: mapQuantity(item.quantity),
    unitPrice: mapMoney(item.unit_price),
    factor: toNumber(item.factor as any),
    tax: mapMoney(item.tax),
    net: mapMoney(item.net),
    noteNumber: toNumberList(item.note_number),
    reviewOutcome: mapReviewOutcome(item.review_outcome),
    adjudication: normalizeArray(item.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined),
    detail: normalizeArray(item.detail).map(detail => mapAddItemDetail(detail as any))
  });

  const events = normalizeArray(response.event).map(entry => ({
    type: mapCodeable((entry as any).type),
    whenDateTime: (entry as any).when_date_time,
    whenPeriod: mapPeriod((entry as any).when_start, (entry as any).when_end)
  }));

  return {
    id: response.claim_response_id,
    identifier: response.claim_response_id ? [{ value: response.claim_response_id }] : undefined,
    traceNumber: normalizeArray(response.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    status: response.status,
    type: mapCodeable(response.type),
    subType: mapCodeable(response.sub_type),
    use: response.use,
    patient: response.patient_id,
    created: response.created,
    insurer: response.insurer_id,
    requestor: response.requestor_id,
    request: response.request_id,
    outcome: response.outcome,
    decision: mapCodeable(response.decision),
    disposition: response.disposition,
    preAuthRef: response.pre_auth_ref,
    preAuthPeriod: mapPeriod(response.pre_auth_start, response.pre_auth_end),
    event: events.length ? events : undefined,
    payeeType: mapCodeable(response.payee_type),
    encounter: normalizeStringArray(response.encounter_ids),
    diagnosisRelatedGroup: mapCodeable(response.diagnosis_related_group),
    item: normalizeArray(response.item).map(item => mapItem(item as any)),
    addItem: normalizeArray(response.add_item).map(item => mapAddItem(item as any)),
    adjudication: normalizeArray(response.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined),
    total: normalizeArray(response.total).map(total => ({
      category: mapCodeable((total as any).category),
      amount: mapMoney((total as any).amount)
    })),
    payment: response.payment ? {
      type: mapCodeable(response.payment.type),
      adjustment: mapMoney(response.payment.adjustment),
      adjustmentReason: mapCodeable(response.payment.adjustment_reason),
      date: response.payment.date,
      amount: mapMoney(response.payment.amount),
      identifier: mapIdentifier(response.payment.identifier)
    } : undefined,
    fundsReserve: mapCodeable(response.funds_reserve),
    formCode: mapCodeable(response.form_code),
    form: response.form ? {
      contentType: response.form.content_type,
      url: response.form.url,
      title: response.form.title,
      data: response.form.data
    } : undefined,
    processNote: normalizeArray(response.process_note).map(note => ({
      number: toNumber((note as any).number),
      type: mapCodeable((note as any).type),
      text: (note as any).text,
      language: mapCodeable((note as any).language)
    })),
    communicationRequest: normalizeStringArray(response.communication_request_ids),
    insurance: normalizeArray(response.insurance).map(entry => ({
      sequence: toNumber((entry as any).sequence),
      focal: normalizeBoolean((entry as any).focal),
      coverage: (entry as any).coverage_id,
      businessArrangement: (entry as any).business_arrangement,
      claimResponse: (entry as any).claim_response_id
    })),
    error: normalizeArray(response.error).map(err => ({
      itemSequence: toNumber((err as any).item_sequence),
      detailSequence: toNumber((err as any).detail_sequence),
      subDetailSequence: toNumber((err as any).sub_detail_sequence),
      code: mapCodeable((err as any).code),
      expression: normalizeStringArray((err as any).expression)
    }))
  };
}

function buildCanonicalCompositionGlobal(composition: z.infer<typeof GlobalCompositionSchema>) {
  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const mapSection = (
    section: z.infer<typeof GlobalCompositionSectionSchema>
  ): NonNullable<CanonicalComposition['section']>[number] => ({
    title: section.title,
    code: mapCodeable(section.code),
    author: normalizeStringArray(section.author_ids),
    focus: section.focus_id,
    text: section.text,
    orderedBy: mapCodeable(section.ordered_by),
    entry: normalizeStringArray(section.entry_ids),
    emptyReason: mapCodeable(section.empty_reason),
    section: normalizeArray(section.section).map(child => mapSection(child as any))
  });

  const relatesTo = normalizeArray(composition.relates_to).map(rel => ({
    type: (rel as any).type,
    resource: (rel as any).resource_id,
    identifier: (rel as any).identifier ? mapIdentifier((rel as any).identifier) : undefined
  }));

  const events = normalizeArray(composition.event).map(evt => ({
    period: mapPeriod((evt as any).period_start, (evt as any).period_end),
    detail: normalizeStringArray((evt as any).detail_ids)
  }));

  return {
    id: composition.composition_id,
    identifier: normalizeArray(composition.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    url: composition.url,
    version: composition.version,
    status: composition.status,
    type: mapCodeable(composition.type),
    category: normalizeArray(composition.category).map(cat => mapCodeable(cat as any)).filter(isDefined),
    subject: normalizeStringArray(composition.subject_ids),
    encounter: composition.encounter_id,
    date: composition.date,
    useContext: normalizeArray(composition.use_context).map(ctx => ({
      code: mapCodeable((ctx as any).code),
      valueCodeableConcept: mapCodeable((ctx as any).value_codeable),
      valueReference: (ctx as any).value_reference_id
    })),
    author: normalizeStringArray(composition.author_ids),
    name: composition.name,
    title: composition.title,
    note: normalizeArray(composition.note).map(note => ({
      text: (note as any).text,
      author: (note as any).author,
      time: (note as any).time
    })),
    attester: normalizeArray(composition.attester).map(att => ({
      mode: mapCodeable((att as any).mode),
      time: (att as any).time,
      party: (att as any).party_id
    })),
    custodian: composition.custodian_id,
    relatesTo: relatesTo.length ? relatesTo : undefined,
    event: events.length ? events : undefined,
    section: normalizeArray(composition.section).map(section => mapSection(section as any))
  };
}

function buildCanonicalDeviceDispenseGlobal(dispense: z.infer<typeof GlobalDeviceDispenseSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: source.type ? {
        system: source.type.code_system,
        code: source.type.code,
        display: source.type.display
      } : undefined
    };
  };

  const mapCodeable = (value?: string) => {
    if (!value) return undefined;
    return { code: value, display: value };
  };

  return {
    id: dispense.device_dispense_id,
    identifier: normalizeArray(dispense.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    basedOn: normalizeStringArray(dispense.based_on_ids),
    partOf: normalizeStringArray(dispense.part_of_ids),
    status: dispense.status,
    statusReason: (dispense.status_reason_code || dispense.status_reason_reference_id) ? {
      concept: mapCodeable(dispense.status_reason_code),
      reference: dispense.status_reason_reference_id
    } : undefined,
    category: normalizeStringArray(dispense.category).map(code => mapCodeable(code)).filter(isDefined),
    deviceCodeableConcept: mapCodeable(dispense.device_code),
    deviceReference: dispense.device_reference_id,
    subject: dispense.subject_id,
    receiver: dispense.receiver_id,
    encounter: dispense.encounter_id,
    supportingInformation: normalizeStringArray(dispense.supporting_information_ids),
    performer: (dispense.performer_function || dispense.performer_actor_id) ? [{
      function: mapCodeable(dispense.performer_function),
      actor: dispense.performer_actor_id
    }] : undefined,
    location: dispense.location_id,
    type: mapCodeable(dispense.type),
    quantity: (dispense.quantity_value !== undefined || dispense.quantity_unit) ? {
      value: toNumber(dispense.quantity_value as any),
      unit: dispense.quantity_unit
    } : undefined,
    preparedDate: dispense.prepared_date,
    whenHandedOver: dispense.when_handed_over,
    destination: dispense.destination_id,
    note: normalizeStringArray(dispense.note),
    usageInstruction: dispense.usage_instruction,
    eventHistory: normalizeStringArray(dispense.event_history_ids)
  };
}

function buildCanonicalDeviceRequestGlobal(request: z.infer<typeof GlobalDeviceRequestSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: source.type ? {
        system: source.type.code_system,
        code: source.type.code,
        display: source.type.display
      } : undefined
    };
  };

  const mapCodeable = (value?: string) => {
    if (!value) return undefined;
    return { code: value, display: value };
  };

  const mapCodeableObject = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    if (!source.code && !source.display && !source.code_system) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapQuantity = (source?: z.infer<typeof GlobalQuantitySchema>) => {
    if (!source) return undefined;
    const value = toNumber(source.value as any);
    if (value === undefined && !source.unit && !source.system && !source.code) return undefined;
    return {
      value,
      unit: source.unit,
      system: source.system,
      code: source.code
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const parameters = normalizeArray(request.parameter).map(param => ({
    code: mapCodeableObject((param as any).code),
    valueCodeableConcept: mapCodeableObject((param as any).value_codeable_concept),
    valueQuantity: mapQuantity((param as any).value_quantity),
    valueBoolean: normalizeBoolean((param as any).value_boolean)
  })).filter(param => param.code || param.valueCodeableConcept || param.valueQuantity || param.valueBoolean !== undefined);

  return {
    id: request.device_request_id,
    identifier: normalizeArray(request.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    instantiatesCanonical: normalizeStringArray(request.instantiates_canonical),
    instantiatesUri: normalizeStringArray(request.instantiates_uri),
    basedOn: normalizeStringArray(request.based_on_ids),
    replaces: normalizeStringArray(request.replaces_ids),
    groupIdentifier: request.group_identifier ? mapIdentifier(request.group_identifier) : undefined,
    status: request.status,
    intent: request.intent,
    priority: request.priority,
    doNotPerform: normalizeBoolean(request.do_not_perform),
    codeCodeableConcept: mapCodeable(request.device_code),
    codeReference: request.device_reference_id,
    quantity: request.quantity_value !== undefined ? toNumber(request.quantity_value as any) : undefined,
    parameter: parameters.length ? parameters : undefined,
    subject: request.subject_id,
    encounter: request.encounter_id,
    occurrenceDateTime: request.occurrence_date_time,
    occurrencePeriod: mapPeriod(request.occurrence_start, request.occurrence_end),
    occurrenceTiming: request.occurrence_timing,
    authoredOn: request.authored_on,
    requester: request.requester_id,
    performer: request.performer_id,
    reason: normalizeStringArray(request.reason_ids),
    asNeeded: normalizeBoolean(request.as_needed),
    asNeededFor: mapCodeable(request.as_needed_for),
    insurance: normalizeStringArray(request.insurance_ids),
    supportingInfo: normalizeStringArray(request.supporting_info_ids),
    note: normalizeStringArray(request.note),
    relevantHistory: normalizeStringArray(request.relevant_history_ids)
  };
}

function buildCanonicalDeviceUsageGlobal(usage: z.infer<typeof GlobalDeviceUsageSchema>) {
  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: source.type ? {
        system: source.type.code_system,
        code: source.type.code,
        display: source.type.display
      } : undefined
    };
  };

  const mapCodeable = (value?: string) => {
    if (!value) return undefined;
    return { code: value, display: value };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  return {
    id: usage.device_usage_id,
    identifier: normalizeArray(usage.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    basedOn: normalizeStringArray(usage.based_on_ids),
    status: usage.status,
    category: normalizeStringArray(usage.category).map(code => mapCodeable(code)).filter(isDefined),
    patient: usage.patient_id,
    derivedFrom: normalizeStringArray(usage.derived_from_ids),
    context: usage.context_id,
    timingTiming: usage.timing_timing,
    timingPeriod: mapPeriod(usage.timing_start, usage.timing_end),
    timingDateTime: usage.timing_date_time,
    dateAsserted: usage.date_asserted,
    usageStatus: mapCodeable(usage.usage_status),
    usageReason: normalizeStringArray(usage.usage_reason).map(code => mapCodeable(code)).filter(isDefined),
    adherence: (usage.adherence_code || normalizeStringArray(usage.adherence_reason).length)
      ? {
          code: mapCodeable(usage.adherence_code),
          reason: normalizeStringArray(usage.adherence_reason).map(code => mapCodeable(code)).filter(isDefined)
        }
      : undefined,
    informationSource: usage.information_source_id,
    deviceCodeableConcept: mapCodeable(usage.device_code),
    deviceReference: usage.device_reference_id,
    reason: normalizeStringArray(usage.reason_ids),
    bodySite: usage.body_site_id,
    note: normalizeStringArray(usage.note)
  };
}

function buildCanonicalEncounterHistoryGlobal(history: z.infer<typeof GlobalEncounterHistorySchema>) {
  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: source.type ? {
        system: source.type.code_system,
        code: source.type.code,
        display: source.type.display
      } : undefined
    };
  };

  const mapCodeable = (value?: string) => {
    if (!value) return undefined;
    return { code: value, display: value };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const lengthValue = history.length_value !== undefined && history.length_value !== null
    ? Number(history.length_value)
    : undefined;

  const serviceTypeConcepts = normalizeStringArray(history.service_type).map(code => ({
    concept: mapCodeable(code)
  })).filter(item => item.concept);

  const serviceTypeReferences = normalizeStringArray(history.service_type_reference_ids).map(reference => ({
    reference
  })).filter(item => item.reference);

  const serviceType = [...serviceTypeConcepts, ...serviceTypeReferences];

  return {
    id: history.encounter_history_id,
    encounter: history.encounter_id,
    identifier: normalizeArray(history.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    status: history.status,
    class: mapCodeable(history.class),
    type: normalizeStringArray(history.type).map(code => mapCodeable(code)).filter(isDefined),
    serviceType: serviceType.length ? serviceType : undefined,
    subject: history.subject_id,
    subjectStatus: mapCodeable(history.subject_status),
    actualPeriod: mapPeriod(history.actual_start, history.actual_end),
    plannedStartDate: history.planned_start_date,
    plannedEndDate: history.planned_end_date,
    length: (lengthValue !== undefined || history.length_unit || history.length_system || history.length_code)
      ? {
          value: Number.isNaN(lengthValue as number) ? undefined : lengthValue,
          unit: history.length_unit,
          system: history.length_system,
          code: history.length_code
        }
      : undefined,
    location: (history.location_id || history.location_form)
      ? [{
          location: history.location_id,
          form: mapCodeable(history.location_form)
        }]
      : undefined
  };
}

function buildCanonicalFlagGlobal(flag: z.infer<typeof GlobalFlagSchema>) {
  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: source.type ? {
        system: source.type.code_system,
        code: source.type.code,
        display: source.type.display
      } : undefined
    };
  };

  const mapCodeable = (value?: string) => {
    if (!value) return undefined;
    return { code: value, display: value };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  return {
    id: flag.flag_id,
    identifier: normalizeArray(flag.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    status: flag.status,
    category: normalizeStringArray(flag.category).map(code => mapCodeable(code)).filter(isDefined),
    code: mapCodeable(flag.code),
    subject: flag.subject_id,
    period: mapPeriod(flag.period_start, flag.period_end),
    encounter: flag.encounter_id,
    author: flag.author_id
  };
}

function buildCanonicalObservationGlobal(obs: z.infer<typeof GlobalObservationSchema>) {
  const code = {
    system: obs.observation_code_system,
    code: obs.observation_code,
    display: obs.observation_display
  };
  return {
    setId: obs.observation_id,
    code,
    value: obs.observation_value,
    unit: obs.observation_unit,
    date: obs.observation_date,
    status: obs.observation_status || 'final'
  };
}

function buildCanonicalListGlobal(list: z.infer<typeof GlobalListSchema>) {
  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: source.type ? {
        system: source.type.code_system,
        code: source.type.code,
        display: source.type.display
      } : undefined
    };
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    if (!source.code && !source.display && !source.code_system) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const entries = normalizeArray(list.entry).map(entry => ({
    flag: mapCodeable((entry as any).flag),
    deleted: normalizeBoolean((entry as any).deleted),
    date: (entry as any).date,
    item: (entry as any).item_id
  })).filter(entry => entry.flag || entry.deleted !== undefined || entry.date || entry.item);

  return {
    id: list.list_id,
    identifier: normalizeArray(list.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    status: list.status,
    mode: list.mode,
    title: list.title,
    code: mapCodeable(list.code),
    subject: normalizeStringArray(list.subject_ids),
    encounter: list.encounter_id,
    date: list.date,
    source: list.source_id,
    orderedBy: mapCodeable(list.ordered_by),
    note: normalizeStringArray(list.note),
    entry: entries.length ? entries : undefined,
    emptyReason: mapCodeable(list.empty_reason)
  };
}

function buildCanonicalGroupGlobal(group: z.infer<typeof GlobalGroupSchema>) {
  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: source.type ? {
        system: source.type.code_system,
        code: source.type.code,
        display: source.type.display
      } : undefined
    };
  };

  const mapCodeable = (value?: z.infer<typeof GlobalCodeableConceptSchema> | string) => {
    if (!value) return undefined;
    if (typeof value === 'string') return { code: value, display: value };
    return {
      system: value.code_system,
      code: value.code,
      display: value.display
    };
  };

  const mapPeriod = (period?: z.infer<typeof GlobalPeriodSchema>) => {
    if (!period) return undefined;
    return {
      start: period.start,
      end: period.end
    };
  };

  const normalizeBoolean = (value: unknown) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      if (trimmed === 'true' || trimmed === 'yes' || trimmed === 'y' || trimmed === '1') return true;
      if (trimmed === 'false' || trimmed === 'no' || trimmed === 'n' || trimmed === '0') return false;
    }
    return undefined;
  };

  const characteristic = normalizeArray(group.characteristic).map(item => {
    if (!item) return undefined;
    const normalizeNumber = (value: unknown) => {
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const n = Number(value);
        return Number.isFinite(n) ? n : undefined;
      }
      return undefined;
    };
    return {
      code: mapCodeable(item.code),
      valueCodeableConcept: mapCodeable(item.value_codeable),
      valueBoolean: normalizeBoolean(item.value_boolean),
      valueQuantity: item.value_quantity ? {
        value: normalizeNumber(item.value_quantity.value),
        unit: item.value_quantity.unit,
        system: item.value_quantity.system,
        code: item.value_quantity.code
      } : undefined,
      valueRange: item.value_range ? {
        low: (item.value_range.low_value !== undefined || item.value_range.low_unit)
          ? { value: item.value_range.low_value, unit: item.value_range.low_unit }
          : undefined,
        high: (item.value_range.high_value !== undefined || item.value_range.high_unit)
          ? { value: item.value_range.high_value, unit: item.value_range.high_unit }
          : undefined
      } : undefined,
      valueReference: item.value_reference_id,
      exclude: normalizeBoolean(item.exclude),
      period: mapPeriod(item.period)
    };
  }).filter(isDefined);

  const member = normalizeArray(group.member).map(item => {
    if (!item) return undefined;
    return {
      entity: item.entity_id,
      period: mapPeriod(item.period),
      inactive: normalizeBoolean(item.inactive)
    };
  }).filter(isDefined);

  return {
    id: group.group_id,
    identifier: normalizeArray(group.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    active: normalizeBoolean(group.active),
    type: group.type,
    membership: group.membership,
    code: mapCodeable(group.code),
    name: group.name,
    description: group.description,
    quantity: typeof group.quantity === 'number' ? group.quantity : undefined,
    managingEntity: group.managing_entity_id,
    characteristic: characteristic.length ? characteristic : undefined,
    member: member.length ? member : undefined
  };
}

function buildCanonicalHealthcareServiceGlobal(service: z.infer<typeof GlobalHealthcareServiceSchema>) {
  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: source.type ? {
        system: source.type.code_system,
        code: source.type.code,
        display: source.type.display
      } : undefined
    };
  };

  const mapCodeable = (value?: z.infer<typeof GlobalCodeableConceptSchema> | string) => {
    if (!value) return undefined;
    if (typeof value === 'string') return { code: value, display: value };
    return {
      system: value.code_system,
      code: value.code,
      display: value.display
    };
  };

  const normalizeBoolean = (value: unknown) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const trimmed = value.trim().toLowerCase();
      if (trimmed === 'true' || trimmed === 'yes' || trimmed === 'y' || trimmed === '1') return true;
      if (trimmed === 'false' || trimmed === 'no' || trimmed === 'n' || trimmed === '0') return false;
    }
    return undefined;
  };

  const mapAttachment = (source?: z.infer<typeof GlobalAttachmentSchema>) => {
    if (!source) return undefined;
    return {
      contentType: source.content_type,
      url: source.url,
      title: source.title,
      data: source.data
    };
  };

  const contact = normalizeArray(service.contact).map(item => ({
    name: item.name,
    telecom: item.telecom?.map(t => ({
      system: t.system,
      value: t.value,
      use: t.use
    }))
  }));

  return {
    id: service.healthcare_service_id,
    identifier: normalizeArray(service.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    active: normalizeBoolean(service.active),
    providedBy: service.provided_by_id,
    offeredIn: normalizeStringArray(service.offered_in_ids),
    category: normalizeArray(service.category).map(mapCodeable).filter(isDefined),
    type: normalizeArray(service.type).map(mapCodeable).filter(isDefined),
    specialty: normalizeArray(service.specialty).map(mapCodeable).filter(isDefined),
    location: normalizeStringArray(service.location_ids),
    name: service.name,
    comment: service.comment,
    extraDetails: service.extra_details,
    photo: mapAttachment(service.photo),
    contact: contact.length ? contact : undefined,
    coverageArea: normalizeStringArray(service.coverage_area_ids),
    serviceProvisionCode: normalizeArray(service.service_provision_code).map(mapCodeable).filter(isDefined),
    eligibility: normalizeArray(service.eligibility).map(item => ({
      code: mapCodeable(item.code),
      comment: item.comment
    })).filter(item => item.code || item.comment),
    program: normalizeArray(service.program).map(mapCodeable).filter(isDefined),
    characteristic: normalizeArray(service.characteristic).map(mapCodeable).filter(isDefined),
    communication: normalizeArray(service.communication).map(mapCodeable).filter(isDefined),
    referralMethod: normalizeArray(service.referral_method).map(mapCodeable).filter(isDefined),
    appointmentRequired: normalizeBoolean(service.appointment_required),
    availability: service.availability?.map(item => ({
      daysOfWeek: normalizeStringArray(item.days_of_week),
      availableStartTime: item.available_start_time,
      availableEndTime: item.available_end_time,
      allDay: normalizeBoolean(item.all_day),
      available: normalizeBoolean(item.available)
    })),
    endpoint: normalizeStringArray(service.endpoint_ids)
  };
}

function buildCanonicalNutritionIntakeGlobal(intake: z.infer<typeof GlobalNutritionIntakeSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: source.type ? {
        system: source.type.code_system,
        code: source.type.code,
        display: source.type.display
      } : undefined
    };
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    if (!source.code && !source.display && !source.code_system) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const mapQuantity = (source?: z.infer<typeof GlobalQuantitySchema>) => {
    if (!source) return undefined;
    const value = toNumber(source.value as any);
    if (value === undefined && !source.unit && !source.system && !source.code) return undefined;
    return {
      value,
      unit: source.unit,
      system: source.system,
      code: source.code
    };
  };

  const consumedItems = normalizeArray(intake.consumed_item).map(item => ({
    type: mapCodeable((item as any).type),
    nutritionProductCodeableConcept: mapCodeable((item as any).nutrition_product_codeable),
    nutritionProductReference: (item as any).nutrition_product_reference_id,
    schedule: (item as any).schedule,
    amount: mapQuantity((item as any).amount),
    rate: mapQuantity((item as any).rate),
    notConsumed: normalizeBoolean((item as any).not_consumed),
    notConsumedReason: mapCodeable((item as any).not_consumed_reason)
  })).filter(item => item.type || item.nutritionProductCodeableConcept || item.nutritionProductReference || item.schedule || item.amount || item.rate || item.notConsumed !== undefined || item.notConsumedReason);

  const ingredientLabels = normalizeArray(intake.ingredient_label).map(item => ({
    nutrientCodeableConcept: mapCodeable((item as any).nutrient_codeable),
    nutrientReference: (item as any).nutrient_reference_id,
    amount: mapQuantity((item as any).amount)
  })).filter(item => item.nutrientCodeableConcept || item.nutrientReference || item.amount);

  const performers = normalizeArray(intake.performer).map(item => ({
    function: mapCodeable((item as any).function),
    actor: (item as any).actor_id
  })).filter(item => item.function || item.actor);

  return {
    id: intake.nutrition_intake_id,
    identifier: normalizeArray(intake.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    instantiatesCanonical: normalizeStringArray(intake.instantiates_canonical),
    instantiatesUri: normalizeStringArray(intake.instantiates_uri),
    basedOn: normalizeStringArray(intake.based_on_ids),
    partOf: normalizeStringArray(intake.part_of_ids),
    status: intake.status,
    statusReason: normalizeStringArray(intake.status_reason).map(code => ({ code, display: code })),
    code: mapCodeable(intake.code),
    subject: intake.subject_id,
    encounter: intake.encounter_id,
    occurrenceDateTime: intake.occurrence_date_time,
    occurrencePeriod: mapPeriod(intake.occurrence_start, intake.occurrence_end),
    recorded: intake.recorded,
    reportedBoolean: normalizeBoolean(intake.reported_boolean),
    reportedReference: intake.reported_reference_id,
    consumedItem: consumedItems.length ? consumedItems : undefined,
    ingredientLabel: ingredientLabels.length ? ingredientLabels : undefined,
    performer: performers.length ? performers : undefined,
    location: intake.location_id,
    derivedFrom: normalizeStringArray(intake.derived_from_ids),
    reason: normalizeStringArray(intake.reason_ids),
    note: normalizeStringArray(intake.note)
  };
}

function buildCanonicalNutritionOrderGlobal(order: z.infer<typeof GlobalNutritionOrderSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: source.type ? {
        system: source.type.code_system,
        code: source.type.code,
        display: source.type.display
      } : undefined
    };
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    if (!source.code && !source.display && !source.code_system) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapCodeableText = (value?: string) => {
    if (!value) return undefined;
    return { code: value, display: value };
  };

  const mapQuantity = (value?: string | number, unit?: string) => {
    const parsed = toNumber(value as any);
    if (parsed === undefined && !unit) return undefined;
    return { value: parsed, unit };
  };

  const performers: Array<{ concept?: { system?: string; code?: string; display?: string }; reference?: string }> = [];
  normalizeArray(order.performer_concept).forEach(entry => {
    const concept = mapCodeable(entry as any);
    if (concept) performers.push({ concept });
  });
  normalizeStringArray(order.performer_reference_ids).forEach(ref => performers.push({ reference: ref }));

  const oralDietTypes = normalizeStringArray(order.oral_diet_type).map(value => mapCodeableText(value)).filter(isDefined);
  const oralDietAsNeeded = normalizeBoolean(order.oral_diet_as_needed as any);
  const oralDiet = (oralDietTypes.length || order.oral_diet_schedule_timing || oralDietAsNeeded !== undefined || order.oral_diet_as_needed_for || order.oral_diet_instruction) ? {
    type: oralDietTypes.length ? oralDietTypes : undefined,
    scheduleTiming: order.oral_diet_schedule_timing,
    asNeeded: oralDietAsNeeded,
    asNeededFor: mapCodeableText(order.oral_diet_as_needed_for),
    instruction: order.oral_diet_instruction
  } : undefined;

  const supplementAsNeeded = normalizeBoolean(order.supplement_as_needed as any);
  const supplementQuantity = mapQuantity(order.supplement_quantity_value as any, order.supplement_quantity_unit);
  const supplement = (order.supplement_type_code || order.supplement_type_reference_id || order.supplement_product_name || order.supplement_schedule_timing || supplementAsNeeded !== undefined || order.supplement_as_needed_for || supplementQuantity || order.supplement_instruction) ? [{
    typeCodeableConcept: mapCodeableText(order.supplement_type_code),
    typeReference: order.supplement_type_reference_id,
    productName: order.supplement_product_name,
    scheduleTiming: order.supplement_schedule_timing,
    asNeeded: supplementAsNeeded,
    asNeededFor: mapCodeableText(order.supplement_as_needed_for),
    quantity: supplementQuantity || undefined,
    instruction: order.supplement_instruction
  }] : undefined;

  const enteralCaloricDensity = mapQuantity(order.enteral_caloric_density_value as any, order.enteral_caloric_density_unit);
  const enteralFormula = (order.enteral_base_formula_code || order.enteral_base_formula_reference_id || order.enteral_base_formula_product_name || order.enteral_route_of_administration || enteralCaloricDensity || order.enteral_administration_instruction) ? {
    baseFormulaTypeCodeableConcept: mapCodeableText(order.enteral_base_formula_code),
    baseFormulaTypeReference: order.enteral_base_formula_reference_id,
    baseFormulaProductName: order.enteral_base_formula_product_name,
    caloricDensity: enteralCaloricDensity || undefined,
    routeOfAdministration: mapCodeableText(order.enteral_route_of_administration),
    administrationInstruction: order.enteral_administration_instruction
  } : undefined;

  return {
    id: order.nutrition_order_id,
    identifier: normalizeArray(order.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    instantiatesCanonical: normalizeStringArray(order.instantiates_canonical),
    instantiatesUri: normalizeStringArray(order.instantiates_uri),
    instantiates: normalizeStringArray(order.instantiates),
    basedOn: normalizeStringArray(order.based_on_ids),
    groupIdentifier: order.group_identifier ? mapIdentifier(order.group_identifier) : undefined,
    status: order.status,
    intent: order.intent,
    priority: order.priority,
    subject: order.subject_id,
    encounter: order.encounter_id,
    supportingInformation: normalizeStringArray(order.supporting_information_ids),
    dateTime: order.date_time,
    orderer: order.orderer_id,
    performer: performers.length ? performers : undefined,
    allergyIntolerance: normalizeStringArray(order.allergy_intolerance_ids),
    foodPreferenceModifier: normalizeStringArray(order.food_preference_modifier).map(code => mapCodeableText(code)).filter(isDefined),
    excludeFoodModifier: normalizeStringArray(order.exclude_food_modifier).map(code => mapCodeableText(code)).filter(isDefined),
    outsideFoodAllowed: normalizeBoolean(order.outside_food_allowed as any),
    oralDiet,
    supplement,
    enteralFormula,
    note: normalizeStringArray(order.note)
  };
}

function buildCanonicalRiskAssessmentGlobal(assessment: z.infer<typeof GlobalRiskAssessmentSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: source.type ? {
        system: source.type.code_system,
        code: source.type.code,
        display: source.type.display
      } : undefined
    };
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    if (!source.code && !source.display && !source.code_system) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const mapRange = (source?: z.infer<typeof GlobalRangeSchema>) => {
    if (!source) return undefined;
    const lowValue = toNumber(source.low_value as any);
    const highValue = toNumber(source.high_value as any);
    const low = (lowValue !== undefined || source.low_unit) ? { value: lowValue, unit: source.low_unit } : undefined;
    const high = (highValue !== undefined || source.high_unit) ? { value: highValue, unit: source.high_unit } : undefined;
    if (!low && !high) return undefined;
    return { low, high };
  };

  const predictions = normalizeArray(assessment.prediction).map(pred => ({
    outcome: mapCodeable((pred as any).outcome),
    probabilityDecimal: toNumber((pred as any).probability_decimal as any),
    probabilityRange: mapRange((pred as any).probability_range),
    qualitativeRisk: mapCodeable((pred as any).qualitative_risk),
    relativeRisk: toNumber((pred as any).relative_risk as any),
    whenPeriod: (pred as any).when_period
      ? mapPeriod((pred as any).when_period.start, (pred as any).when_period.end)
      : undefined,
    whenRange: mapRange((pred as any).when_range),
    rationale: (pred as any).rationale
  })).filter(entry => entry.outcome || entry.probabilityDecimal !== undefined || entry.probabilityRange || entry.qualitativeRisk || entry.relativeRisk !== undefined || entry.whenPeriod || entry.whenRange || entry.rationale);

  return {
    id: assessment.risk_assessment_id,
    identifier: normalizeArray(assessment.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    basedOn: assessment.based_on_id,
    parent: assessment.parent_id,
    status: assessment.status,
    method: mapCodeable(assessment.method),
    code: mapCodeable(assessment.code),
    subject: assessment.subject_id,
    encounter: assessment.encounter_id,
    occurrenceDateTime: assessment.occurrence_date_time,
    occurrencePeriod: mapPeriod(assessment.occurrence_start, assessment.occurrence_end),
    condition: assessment.condition_id,
    performer: assessment.performer_id,
    reason: normalizeStringArray(assessment.reason_ids),
    basis: normalizeStringArray(assessment.basis_ids),
    prediction: predictions.length ? predictions : undefined,
    mitigation: assessment.mitigation,
    note: normalizeStringArray(assessment.note)
  };
}

function buildCanonicalExplanationOfBenefitGlobal(eob: z.infer<typeof GlobalExplanationOfBenefitSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const toNumberList = (value?: string | string[] | number | number[]) => {
    if (value === undefined || value === null) return undefined;
    const list = Array.isArray(value) ? value : [value];
    const parsed = list
      .map(entry => (typeof entry === 'number' ? entry : Number(entry)))
      .filter(entry => !Number.isNaN(entry));
    return parsed.length ? parsed : undefined;
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  const mapMoney = (source?: z.infer<typeof GlobalMoneySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      currency: source.currency
    };
  };

  const mapQuantity = (source?: z.infer<typeof GlobalQuantitySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      unit: source.unit,
      system: source.system,
      code: source.code
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const mapAddress = (source?: z.infer<typeof GlobalAddressSchema>) => {
    if (!source) return undefined;
    return {
      street: source.street,
      city: source.city,
      state: source.state,
      postalCode: source.postal_code,
      country: source.country
    };
  };

  const mapReviewOutcome = (entry?: z.infer<typeof GlobalClaimResponseReviewOutcomeSchema>) => {
    if (!entry) return undefined;
    return {
      decision: mapCodeable(entry.decision),
      reason: normalizeArray(entry.reason).map(reason => mapCodeable(reason as any)).filter(isDefined),
      preAuthRef: entry.pre_auth_ref,
      preAuthPeriod: mapPeriod(entry.pre_auth_start, entry.pre_auth_end)
    };
  };

  const mapAdjudication = (entry?: z.infer<typeof GlobalClaimResponseAdjudicationSchema>) => {
    if (!entry) return undefined;
    return {
      category: mapCodeable(entry.category),
      reason: mapCodeable(entry.reason),
      amount: mapMoney(entry.amount),
      quantity: mapQuantity(entry.quantity)
    };
  };

  const mapItemSubDetail = (sub: z.infer<typeof GlobalExplanationOfBenefitItemSubDetailSchema>) => ({
    sequence: toNumber(sub.sequence as any),
    traceNumber: normalizeArray(sub.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    revenue: mapCodeable(sub.revenue),
    category: mapCodeable(sub.category),
    productOrService: mapCodeable(sub.product_or_service),
    productOrServiceEnd: mapCodeable(sub.product_or_service_end),
    modifier: normalizeArray(sub.modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
    programCode: normalizeArray(sub.program_code).map(code => mapCodeable(code as any)).filter(isDefined),
    patientPaid: mapMoney(sub.patient_paid),
    quantity: mapQuantity(sub.quantity),
    unitPrice: mapMoney(sub.unit_price),
    factor: toNumber(sub.factor as any),
    tax: mapMoney(sub.tax),
    net: mapMoney(sub.net),
    udi: normalizeStringArray(sub.udi_ids),
    noteNumber: toNumberList(sub.note_number),
    reviewOutcome: mapReviewOutcome(sub.review_outcome),
    adjudication: normalizeArray(sub.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined)
  });

  const mapItemDetail = (detail: z.infer<typeof GlobalExplanationOfBenefitItemDetailSchema>) => ({
    sequence: toNumber(detail.sequence as any),
    traceNumber: normalizeArray(detail.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    revenue: mapCodeable(detail.revenue),
    category: mapCodeable(detail.category),
    productOrService: mapCodeable(detail.product_or_service),
    productOrServiceEnd: mapCodeable(detail.product_or_service_end),
    modifier: normalizeArray(detail.modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
    programCode: normalizeArray(detail.program_code).map(code => mapCodeable(code as any)).filter(isDefined),
    patientPaid: mapMoney(detail.patient_paid),
    quantity: mapQuantity(detail.quantity),
    unitPrice: mapMoney(detail.unit_price),
    factor: toNumber(detail.factor as any),
    tax: mapMoney(detail.tax),
    net: mapMoney(detail.net),
    udi: normalizeStringArray(detail.udi_ids),
    noteNumber: toNumberList(detail.note_number),
    reviewOutcome: mapReviewOutcome(detail.review_outcome),
    adjudication: normalizeArray(detail.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined),
    subDetail: normalizeArray(detail.sub_detail).map(sub => mapItemSubDetail(sub as any))
  });

  const mapItem = (item: z.infer<typeof GlobalExplanationOfBenefitItemSchema>) => ({
    sequence: toNumber(item.sequence as any),
    careTeamSequence: toNumberList(item.care_team_sequence),
    diagnosisSequence: toNumberList(item.diagnosis_sequence),
    procedureSequence: toNumberList(item.procedure_sequence),
    informationSequence: toNumberList(item.information_sequence),
    traceNumber: normalizeArray(item.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    revenue: mapCodeable(item.revenue),
    category: mapCodeable(item.category),
    productOrService: mapCodeable(item.product_or_service),
    productOrServiceEnd: mapCodeable(item.product_or_service_end),
    request: normalizeStringArray(item.request_ids),
    modifier: normalizeArray(item.modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
    programCode: normalizeArray(item.program_code).map(code => mapCodeable(code as any)).filter(isDefined),
    servicedDate: item.serviced_date,
    servicedPeriod: mapPeriod(item.serviced_start, item.serviced_end),
    locationCodeableConcept: mapCodeable(item.location_codeable),
    locationAddress: mapAddress(item.location_address as any),
    locationReference: item.location_reference_id,
    patientPaid: mapMoney(item.patient_paid),
    quantity: mapQuantity(item.quantity),
    unitPrice: mapMoney(item.unit_price),
    factor: toNumber(item.factor as any),
    tax: mapMoney(item.tax),
    net: mapMoney(item.net),
    udi: normalizeStringArray(item.udi_ids),
    noteNumber: toNumberList(item.note_number),
    reviewOutcome: mapReviewOutcome(item.review_outcome),
    adjudication: normalizeArray(item.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined),
    detail: normalizeArray(item.detail).map(detail => mapItemDetail(detail as any))
  });

  const mapAddItemSubDetail = (sub: z.infer<typeof GlobalExplanationOfBenefitItemSubDetailSchema>) => ({
    traceNumber: normalizeArray(sub.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    revenue: mapCodeable(sub.revenue),
    productOrService: mapCodeable(sub.product_or_service),
    productOrServiceEnd: mapCodeable(sub.product_or_service_end),
    modifier: normalizeArray(sub.modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
    patientPaid: mapMoney(sub.patient_paid),
    quantity: mapQuantity(sub.quantity),
    unitPrice: mapMoney(sub.unit_price),
    factor: toNumber(sub.factor as any),
    tax: mapMoney(sub.tax),
    net: mapMoney(sub.net),
    noteNumber: toNumberList(sub.note_number),
    reviewOutcome: mapReviewOutcome(sub.review_outcome),
    adjudication: normalizeArray(sub.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined)
  });

  const mapAddItemDetail = (detail: z.infer<typeof GlobalExplanationOfBenefitAddItemDetailSchema>) => ({
    traceNumber: normalizeArray(detail.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    revenue: mapCodeable(detail.revenue),
    productOrService: mapCodeable(detail.product_or_service),
    productOrServiceEnd: mapCodeable(detail.product_or_service_end),
    modifier: normalizeArray(detail.modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
    patientPaid: mapMoney(detail.patient_paid),
    quantity: mapQuantity(detail.quantity),
    unitPrice: mapMoney(detail.unit_price),
    factor: toNumber(detail.factor as any),
    tax: mapMoney(detail.tax),
    net: mapMoney(detail.net),
    noteNumber: toNumberList(detail.note_number),
    reviewOutcome: mapReviewOutcome(detail.review_outcome),
    adjudication: normalizeArray(detail.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined),
    subDetail: normalizeArray(detail.sub_detail).map(sub => mapAddItemSubDetail(sub as any))
  });

  const mapAddItem = (item: z.infer<typeof GlobalExplanationOfBenefitAddItemSchema>) => ({
    itemSequence: toNumberList(item.item_sequence),
    detailSequence: toNumberList(item.detail_sequence),
    subdetailSequence: toNumberList(item.subdetail_sequence),
    traceNumber: normalizeArray(item.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    provider: normalizeStringArray(item.provider_ids),
    revenue: mapCodeable(item.revenue),
    productOrService: mapCodeable(item.product_or_service),
    productOrServiceEnd: mapCodeable(item.product_or_service_end),
    request: normalizeStringArray(item.request_ids),
    modifier: normalizeArray(item.modifier).map(mod => mapCodeable(mod as any)).filter(isDefined),
    programCode: normalizeArray(item.program_code).map(code => mapCodeable(code as any)).filter(isDefined),
    servicedDate: item.serviced_date,
    servicedPeriod: mapPeriod(item.serviced_start, item.serviced_end),
    locationCodeableConcept: mapCodeable(item.location_codeable),
    locationAddress: mapAddress(item.location_address as any),
    locationReference: item.location_reference_id,
    patientPaid: mapMoney(item.patient_paid),
    quantity: mapQuantity(item.quantity),
    unitPrice: mapMoney(item.unit_price),
    factor: toNumber(item.factor as any),
    tax: mapMoney(item.tax),
    net: mapMoney(item.net),
    noteNumber: toNumberList(item.note_number),
    reviewOutcome: mapReviewOutcome(item.review_outcome),
    adjudication: normalizeArray(item.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined),
    detail: normalizeArray(item.detail).map(detail => mapAddItemDetail(detail as any))
  });

  return {
    id: eob.explanation_of_benefit_id,
    identifier: normalizeArray(eob.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    traceNumber: normalizeArray(eob.trace_number).map(id => mapIdentifier(id as any)).filter(isDefined),
    status: eob.status,
    type: mapCodeable(eob.type),
    subType: mapCodeable(eob.sub_type),
    use: eob.use,
    patient: eob.patient_id,
    billablePeriod: mapPeriod(eob.billable_start, eob.billable_end),
    created: eob.created,
    enterer: eob.enterer_id,
    insurer: eob.insurer_id,
    provider: eob.provider_id,
    priority: mapCodeable(eob.priority),
    fundsReserveRequested: mapCodeable(eob.funds_reserve_requested),
    fundsReserve: mapCodeable(eob.funds_reserve),
    related: normalizeArray(eob.related).map(rel => ({
      claim: (rel as any).claim_id,
      relationship: mapCodeable((rel as any).relationship),
      reference: (rel as any).reference ? mapIdentifier((rel as any).reference) : undefined
    })),
    prescription: eob.prescription_id,
    originalPrescription: eob.original_prescription_id,
    event: normalizeArray(eob.event).map(evt => ({
      type: mapCodeable((evt as any).type),
      whenDateTime: (evt as any).when_date_time,
      whenPeriod: mapPeriod((evt as any).when_start, (evt as any).when_end)
    })),
    payee: eob.payee ? {
      type: mapCodeable((eob.payee as any).type),
      party: (eob.payee as any).party_id
    } : undefined,
    referral: eob.referral_id,
    encounter: normalizeStringArray(eob.encounter_ids),
    facility: eob.facility_id,
    claim: eob.claim_id,
    claimResponse: eob.claim_response_id,
    outcome: eob.outcome,
    decision: mapCodeable(eob.decision),
    disposition: eob.disposition,
    preAuthRef: normalizeStringArray(eob.pre_auth_ref),
    preAuthRefPeriod: normalizeArray(eob.pre_auth_ref_period).map(period => mapPeriod((period as any).start, (period as any).end)).filter(isDefined),
    diagnosisRelatedGroup: mapCodeable(eob.diagnosis_related_group),
    careTeam: normalizeArray(eob.care_team).map(entry => ({
      sequence: toNumber((entry as any).sequence),
      provider: (entry as any).provider_id,
      responsible: normalizeBoolean((entry as any).responsible as any),
      role: mapCodeable((entry as any).role),
      specialty: mapCodeable((entry as any).specialty)
    })),
    supportingInfo: normalizeArray(eob.supporting_info).map(info => ({
      sequence: toNumber((info as any).sequence),
      category: mapCodeable((info as any).category),
      code: mapCodeable((info as any).code),
      timingDate: (info as any).timing_date,
      timingPeriod: mapPeriod((info as any).timing_start, (info as any).timing_end),
      valueBoolean: normalizeBoolean((info as any).value_boolean),
      valueString: (info as any).value_string,
      valueQuantity: mapQuantity((info as any).value_quantity),
      valueAttachment: (info as any).value_attachment ? {
        contentType: (info as any).value_attachment.content_type,
        url: (info as any).value_attachment.url,
        title: (info as any).value_attachment.title,
        data: (info as any).value_attachment.data
      } : undefined,
      valueReference: (info as any).value_reference_id,
      valueIdentifier: (info as any).value_identifier ? mapIdentifier((info as any).value_identifier) : undefined,
      reason: mapCodeable((info as any).reason)
    })),
    diagnosis: normalizeArray(eob.diagnosis).map(diag => ({
      sequence: toNumber((diag as any).sequence),
      diagnosisCodeableConcept: mapCodeable((diag as any).diagnosis_code),
      diagnosisReference: (diag as any).diagnosis_reference_id,
      type: normalizeArray((diag as any).type).map(t => mapCodeable(t as any)).filter(isDefined),
      onAdmission: mapCodeable((diag as any).on_admission)
    })),
    procedure: normalizeArray(eob.procedure).map(proc => ({
      sequence: toNumber((proc as any).sequence),
      type: normalizeArray((proc as any).type).map(t => mapCodeable(t as any)).filter(isDefined),
      date: (proc as any).date,
      procedureCodeableConcept: mapCodeable((proc as any).procedure_code),
      procedureReference: (proc as any).procedure_reference_id,
      udi: normalizeStringArray((proc as any).udi_ids)
    })),
    precedence: toNumber(eob.precedence as any),
    insurance: normalizeArray(eob.insurance).map(ins => ({
      focal: normalizeBoolean((ins as any).focal),
      coverage: (ins as any).coverage_id,
      preAuthRef: normalizeStringArray((ins as any).pre_auth_ref)
    })),
    accident: eob.accident ? {
      date: (eob.accident as any).date,
      type: mapCodeable((eob.accident as any).type),
      locationAddress: mapAddress((eob.accident as any).location_address),
      locationReference: (eob.accident as any).location_reference_id
    } : undefined,
    patientPaid: mapMoney(eob.patient_paid),
    item: normalizeArray(eob.item).map(item => mapItem(item as any)),
    addItem: normalizeArray(eob.add_item).map(item => mapAddItem(item as any)),
    adjudication: normalizeArray(eob.adjudication).map(entry => mapAdjudication(entry as any)).filter(isDefined),
    total: normalizeArray(eob.total).map(total => ({
      category: mapCodeable((total as any).category),
      amount: mapMoney((total as any).amount)
    })),
    payment: eob.payment ? {
      type: mapCodeable((eob.payment as any).type),
      adjustment: mapMoney((eob.payment as any).adjustment),
      adjustmentReason: mapCodeable((eob.payment as any).adjustment_reason),
      date: (eob.payment as any).date,
      amount: mapMoney((eob.payment as any).amount),
      identifier: (eob.payment as any).identifier ? mapIdentifier((eob.payment as any).identifier) : undefined
    } : undefined,
    formCode: mapCodeable(eob.form_code),
    form: eob.form ? {
      contentType: (eob.form as any).content_type,
      url: (eob.form as any).url,
      title: (eob.form as any).title,
      data: (eob.form as any).data
    } : undefined,
    processNote: normalizeArray(eob.process_note).map(note => ({
      number: toNumber((note as any).number),
      type: mapCodeable((note as any).type),
      text: (note as any).text,
      language: mapCodeable((note as any).language)
    })),
    benefitPeriod: eob.benefit_period ? mapPeriod((eob.benefit_period as any).start, (eob.benefit_period as any).end) : undefined,
    benefitBalance: normalizeArray(eob.benefit_balance).map(balance => ({
      category: mapCodeable((balance as any).category),
      excluded: normalizeBoolean((balance as any).excluded),
      name: (balance as any).name,
      description: (balance as any).description,
      network: mapCodeable((balance as any).network),
      unit: mapCodeable((balance as any).unit),
      term: mapCodeable((balance as any).term),
      financial: normalizeArray((balance as any).financial).map(fin => ({
        type: mapCodeable((fin as any).type),
        allowedUnsignedInt: toNumber((fin as any).allowed_unsigned_int),
        allowedString: (fin as any).allowed_string,
        allowedMoney: mapMoney((fin as any).allowed_money),
        usedUnsignedInt: toNumber((fin as any).used_unsigned_int),
        usedMoney: mapMoney((fin as any).used_money)
      }))
    }))
  };
}

function buildCanonicalBinaryGlobal(binary: z.infer<typeof GlobalBinarySchema>) {
  return {
    id: binary.binary_id,
    contentType: binary.content_type,
    securityContext: binary.security_context,
    data: binary.data
  };
}

function buildCanonicalCoverageGlobal(coverage: z.infer<typeof GlobalCoverageSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const mapMoney = (source?: z.infer<typeof GlobalMoneySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      currency: source.currency
    };
  };

  const mapQuantity = (source?: z.infer<typeof GlobalQuantitySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      unit: source.unit,
      system: source.system,
      code: source.code
    };
  };

  return {
    id: coverage.coverage_id,
    identifier: normalizeArray(coverage.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    status: coverage.status,
    kind: coverage.kind,
    paymentBy: normalizeArray(coverage.payment_by)
      .map(entry => ({
        party: (entry as any).party_id,
        responsibility: (entry as any).responsibility
      }))
      .filter(entry => entry.party || entry.responsibility),
    type: mapCodeable(coverage.type),
    policyHolder: coverage.policy_holder_id,
    subscriber: coverage.subscriber_id,
    subscriberId: normalizeArray(coverage.subscriber_identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    beneficiary: coverage.beneficiary_id,
    dependent: coverage.dependent,
    relationship: mapCodeable(coverage.relationship),
    period: mapPeriod(coverage.period_start, coverage.period_end),
    insurer: coverage.insurer_id,
    class: normalizeArray(coverage.class)
      .map(entry => ({
        type: mapCodeable((entry as any).type),
        value: (entry as any).value
          ? {
            system: ((entry as any).value as any).system,
            value: ((entry as any).value as any).value
          }
          : undefined,
        name: (entry as any).name
      }))
      .filter(entry => entry.type || entry.value || entry.name),
    order: toNumber(coverage.order as any),
    network: coverage.network,
    costToBeneficiary: normalizeArray(coverage.cost_to_beneficiary)
      .map(cost => ({
        type: mapCodeable((cost as any).type),
        category: mapCodeable((cost as any).category),
        network: mapCodeable((cost as any).network),
        unit: mapCodeable((cost as any).unit),
        term: mapCodeable((cost as any).term),
        valueQuantity: mapQuantity((cost as any).value_quantity),
        valueMoney: mapMoney((cost as any).value_money),
        exception: normalizeArray((cost as any).exception).map(ex => ({
          type: mapCodeable((ex as any).type),
          period: mapPeriod((ex as any).start, (ex as any).end)
        }))
      }))
      .filter(entry => entry.type || entry.category || entry.network || entry.unit || entry.term || entry.valueQuantity || entry.valueMoney || (entry.exception && entry.exception.length > 0)),
    subrogation: normalizeBoolean(coverage.subrogation as any),
    contract: normalizeStringArray(coverage.contract_ids),
    insurancePlan: coverage.insurance_plan_id
  };
}

function buildCanonicalInsurancePlanGlobal(plan: z.infer<typeof GlobalInsurancePlanSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  const mapQuantity = (source?: z.infer<typeof GlobalQuantitySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      unit: source.unit,
      system: source.system,
      code: source.code
    };
  };

  const mapMoney = (source?: z.infer<typeof GlobalMoneySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      currency: source.currency
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  return {
    id: plan.insurance_plan_id,
    identifier: normalizeArray(plan.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    status: plan.status,
    type: normalizeArray(plan.type).map(type => mapCodeable(type as any)).filter(isDefined),
    name: plan.name,
    alias: normalizeStringArray(plan.alias),
    period: plan.period ? mapPeriod((plan.period as any).start, (plan.period as any).end) : undefined,
    ownedBy: plan.owned_by_id,
    administeredBy: plan.administered_by_id,
    coverageArea: normalizeStringArray(plan.coverage_area_ids),
    contact: normalizeArray(plan.contact)
      .map(contact => ({
        name: (contact as any).name,
        telecom: normalizeArray((contact as any).telecom).map(point => ({
          system: (point as any).system,
          value: (point as any).value,
          use: (point as any).use
        })).filter(entry => entry.system || entry.value || entry.use)
      }))
      .filter(contact => contact.name || (contact.telecom && contact.telecom.length > 0)),
    endpoint: normalizeStringArray(plan.endpoint_ids),
    network: normalizeStringArray(plan.network_ids),
    coverage: normalizeArray(plan.coverage)
      .map(coverage => ({
        type: mapCodeable((coverage as any).type),
        network: normalizeStringArray((coverage as any).network_ids),
        benefit: normalizeArray((coverage as any).benefit)
          .map(benefit => ({
            type: mapCodeable((benefit as any).type),
            requirement: (benefit as any).requirement,
            limit: normalizeArray((benefit as any).limit)
              .map(limit => ({
                value: mapQuantity((limit as any).value),
                code: mapCodeable((limit as any).code)
              }))
              .filter(limit => limit.value || limit.code)
          }))
          .filter(benefit => benefit.type || benefit.requirement || (benefit.limit && benefit.limit.length > 0))
      }))
      .filter(entry => entry.type || (entry.network && entry.network.length > 0) || (entry.benefit && entry.benefit.length > 0)),
    plan: normalizeArray(plan.plan)
      .map(planEntry => ({
        identifier: normalizeArray((planEntry as any).identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
        type: mapCodeable((planEntry as any).type),
        coverageArea: normalizeStringArray((planEntry as any).coverage_area_ids),
        network: normalizeStringArray((planEntry as any).network_ids),
        generalCost: normalizeArray((planEntry as any).general_cost)
          .map(cost => ({
            type: mapCodeable((cost as any).type),
            groupSize: toNumber((cost as any).group_size as any),
            cost: mapMoney((cost as any).cost),
            comment: (cost as any).comment
          }))
          .filter(cost => cost.type || cost.groupSize !== undefined || cost.cost || cost.comment),
        specificCost: normalizeArray((planEntry as any).specific_cost)
          .map(spec => ({
            category: mapCodeable((spec as any).category),
            benefit: normalizeArray((spec as any).benefit)
              .map(benefit => ({
                type: mapCodeable((benefit as any).type),
                cost: normalizeArray((benefit as any).cost)
                  .map(cost => ({
                    type: mapCodeable((cost as any).type),
                    applicability: mapCodeable((cost as any).applicability),
                    qualifiers: normalizeArray((cost as any).qualifiers).map(q => mapCodeable(q as any)).filter(isDefined),
                    value: mapQuantity((cost as any).value)
                  }))
                  .filter(cost => cost.type || cost.applicability || (cost.qualifiers && cost.qualifiers.length > 0) || cost.value)
              }))
              .filter(benefit => benefit.type || (benefit.cost && benefit.cost.length > 0))
          }))
          .filter(spec => spec.category || (spec.benefit && spec.benefit.length > 0))
      }))
      .filter(entry =>
        (entry.identifier && entry.identifier.length > 0) ||
        entry.type ||
        (entry.coverageArea && entry.coverageArea.length > 0) ||
        (entry.network && entry.network.length > 0) ||
        (entry.generalCost && entry.generalCost.length > 0) ||
        (entry.specificCost && entry.specificCost.length > 0)
      )
  };
}

function buildCanonicalAccountGlobal(account: z.infer<typeof GlobalAccountSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const mapMoney = (source?: z.infer<typeof GlobalMoneySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      currency: source.currency
    };
  };

  const subjectIds = normalizeStringArray(account.subject_ids);

  return {
    id: account.account_id,
    identifier: normalizeArray(account.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    status: account.status,
    billingStatus: mapCodeable(account.billing_status),
    type: mapCodeable(account.type),
    name: account.name,
    subject: subjectIds.length ? subjectIds : undefined,
    servicePeriod: mapPeriod(account.service_period_start, account.service_period_end),
    coverage: normalizeArray(account.coverage).map(entry => ({
      coverage: (entry as any).coverage_id,
      priority: toNumber((entry as any).priority as any)
    })).filter(entry => entry.coverage || entry.priority !== undefined),
    owner: account.owner_id,
    description: account.description,
    guarantor: normalizeArray(account.guarantor).map(entry => ({
      party: (entry as any).party_id,
      onHold: normalizeBoolean((entry as any).on_hold as any),
      period: mapPeriod((entry as any).period_start, (entry as any).period_end)
    })).filter(entry => entry.party || entry.onHold !== undefined || entry.period),
    diagnosis: normalizeArray(account.diagnosis).map(entry => ({
      sequence: toNumber((entry as any).sequence as any),
      condition: ((entry as any).condition_id || (entry as any).condition_code)
        ? {
          reference: (entry as any).condition_id,
          code: mapCodeable((entry as any).condition_code)
        }
        : undefined,
      dateOfDiagnosis: (entry as any).date_of_diagnosis,
      type: normalizeArray((entry as any).type).map(code => mapCodeable(code as any)).filter(isDefined),
      onAdmission: normalizeBoolean((entry as any).on_admission as any),
      packageCode: normalizeArray((entry as any).package_code).map(code => mapCodeable(code as any)).filter(isDefined)
    })).filter(entry => entry.sequence !== undefined || entry.condition || entry.dateOfDiagnosis || entry.type?.length || entry.onAdmission !== undefined),
    procedure: normalizeArray(account.procedure).map(entry => ({
      sequence: toNumber((entry as any).sequence as any),
      code: ((entry as any).procedure_id || (entry as any).procedure_code)
        ? {
          reference: (entry as any).procedure_id,
          code: mapCodeable((entry as any).procedure_code)
        }
        : undefined,
      dateOfService: (entry as any).date_of_service,
      type: normalizeArray((entry as any).type).map(code => mapCodeable(code as any)).filter(isDefined),
      packageCode: normalizeArray((entry as any).package_code).map(code => mapCodeable(code as any)).filter(isDefined),
      device: normalizeStringArray((entry as any).device_ids)
    })).filter(entry => entry.sequence !== undefined || entry.code || entry.dateOfService || entry.type?.length || entry.packageCode?.length || entry.device?.length),
    relatedAccount: normalizeArray(account.related_account).map(entry => ({
      relationship: mapCodeable((entry as any).relationship),
      account: (entry as any).account_id
    })).filter(entry => entry.relationship || entry.account),
    currency: mapCodeable(account.currency),
    balance: normalizeArray(account.balance).map(entry => ({
      aggregate: mapCodeable((entry as any).aggregate),
      term: mapCodeable((entry as any).term),
      estimate: normalizeBoolean((entry as any).estimate as any),
      amount: mapMoney((entry as any).amount)
    })).filter(entry => entry.aggregate || entry.term || entry.estimate !== undefined || entry.amount),
    calculatedAt: account.calculated_at
  };
}

function buildCanonicalChargeItemGlobal(item: z.infer<typeof GlobalChargeItemSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  const mapQuantity = (source?: z.infer<typeof GlobalQuantitySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      unit: source.unit,
      system: source.system,
      code: source.code
    };
  };

  return {
    id: item.charge_item_id,
    identifier: normalizeArray(item.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    status: item.status,
    code: mapCodeable(item.code),
    subject: item.subject_id,
    encounter: item.encounter_id,
    occurrenceDateTime: item.occurrence_date_time,
    occurrencePeriod: mapPeriod(item.occurrence_start, item.occurrence_end),
    quantity: mapQuantity(item.quantity),
    enterer: item.enterer_id,
    enteredDate: item.entered_date,
    account: normalizeStringArray(item.account_ids),
    totalPriceComponent: (item.total_price_value !== undefined || item.total_price_currency)
      ? {
        amount: {
          value: toNumber(item.total_price_value as any),
          currency: item.total_price_currency
        }
      }
      : undefined
  };
}

function buildCanonicalChargeItemDefinitionGlobal(definition: z.infer<typeof GlobalChargeItemDefinitionSchema>) {
  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  return {
    id: definition.charge_item_definition_id,
    url: definition.url,
    identifier: normalizeArray(definition.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    version: definition.version,
    status: definition.status,
    name: definition.name,
    title: definition.title,
    publisher: definition.publisher,
    date: definition.date,
    code: mapCodeable(definition.code)
  };
}

function buildCanonicalDeviceGlobal(device: z.infer<typeof GlobalDeviceSchema>) {
  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  return {
    id: device.device_id,
    identifier: normalizeArray(device.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    status: device.status,
    displayName: device.display_name,
    manufacturer: device.manufacturer,
    modelNumber: device.model_number,
    serialNumber: device.serial_number,
    lotNumber: device.lot_number,
    owner: device.owner_id,
    location: device.location_id
  };
}

function buildCanonicalDeviceMetricGlobal(metric: z.infer<typeof GlobalDeviceMetricSchema>) {
  const toNumber = (value?: string | number) => {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  };

  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  const mapQuantity = (source?: z.infer<typeof GlobalQuantitySchema>) => {
    if (!source) return undefined;
    return {
      value: toNumber(source.value as any),
      unit: source.unit,
      system: source.system,
      code: source.code
    };
  };

  return {
    id: metric.device_metric_id,
    identifier: normalizeArray(metric.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    type: mapCodeable(metric.type),
    unit: mapCodeable(metric.unit),
    device: metric.device_id,
    operationalStatus: metric.operational_status,
    color: metric.color,
    category: metric.category,
    measurementFrequency: mapQuantity(metric.measurement_frequency)
  };
}

function buildCanonicalEndpointGlobal(endpoint: z.infer<typeof GlobalEndpointSchema>) {
  const mapCodeable = (source?: z.infer<typeof GlobalCodeableConceptSchema>) => {
    if (!source) return undefined;
    return {
      system: source.code_system,
      code: source.code,
      display: source.display
    };
  };

  const mapIdentifier = (source?: z.infer<typeof GlobalIdentifierObjectSchema>) => {
    if (!source) return undefined;
    return {
      system: source.system,
      value: source.value,
      type: mapCodeable(source.type)
    };
  };

  const mapPeriod = (start?: string, end?: string) => {
    if (!start && !end) return undefined;
    return { start, end };
  };

  return {
    id: endpoint.endpoint_id,
    identifier: normalizeArray(endpoint.identifier).map(id => mapIdentifier(id as any)).filter(isDefined),
    status: endpoint.status,
    connectionType: normalizeArray(endpoint.connection_type).map(code => mapCodeable(code as any)).filter(isDefined),
    name: endpoint.name,
    description: endpoint.description,
    environmentType: normalizeArray(endpoint.environment_type).map(code => mapCodeable(code as any)).filter(isDefined),
    managingOrganization: endpoint.managing_organization_id,
    period: mapPeriod(endpoint.period_start, endpoint.period_end),
    address: endpoint.address,
    header: normalizeStringArray(endpoint.header)
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

  const telecom: Array<{ system: 'phone' | 'email' | 'fax' | 'url' | 'other'; value: string; use?: string }> = [];
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

function buildCanonicalPersonGlobal(person: z.infer<typeof GlobalPersonSchema>) {
  const active = normalizeBoolean(person.active);
  const deceased = normalizeBoolean(person.deceased);
  const languagePreferred = normalizeBoolean(person.language_preferred);

  const telecom: Array<{ system: 'phone' | 'email' | 'fax' | 'url' | 'other'; value: string; use?: string }> = [];
  if (person.phone) telecom.push({ system: 'phone', value: person.phone });
  if (person.email) telecom.push({ system: 'email', value: person.email });

  const address = person.address_line1 || person.address_line2 || person.city
    ? [{
        line: [person.address_line1, person.address_line2].filter(Boolean) as string[],
        city: person.city,
        state: person.state,
        postalCode: person.postal_code,
        country: person.country
      }]
    : undefined;

  const communication = person.language ? [{
    language: {
      code: person.language,
      display: person.language
    },
    preferred: languagePreferred
  }] : undefined;

  return {
    id: person.person_id,
    identifier: person.person_id,
    active,
    name: (person.first_name || person.last_name) ? {
      family: person.last_name,
      given: person.first_name ? [person.first_name] : undefined
    } : undefined,
    telecom: telecom.length ? telecom : undefined,
    gender: person.gender,
    birthDate: person.birth_date,
    deceasedBoolean: person.deceased !== undefined ? deceased : undefined,
    deceasedDateTime: person.deceased_date,
    address,
    maritalStatus: person.marital_status ? {
      code: person.marital_status,
      display: person.marital_status
    } : undefined,
    communication,
    managingOrganization: person.managing_organization_id,
    link: person.link_target ? [{
      target: person.link_target,
      assurance: person.link_assurance
    }] : undefined
  };
}

function buildCanonicalSubstanceGlobal(substance: z.infer<typeof GlobalSubstanceSchema>) {
  const instance = normalizeBoolean(substance.instance);
  const category = normalizeStringArray(substance.category);

  const ingredient =
    substance.ingredient_substance ||
    substance.ingredient_substance_system ||
    substance.ingredient_substance_display ||
    substance.ingredient_quantity_numerator_value !== undefined ||
    substance.ingredient_quantity_denominator_value !== undefined
      ? [{
          quantity: (substance.ingredient_quantity_numerator_value !== undefined || substance.ingredient_quantity_denominator_value !== undefined)
            ? {
                numerator: substance.ingredient_quantity_numerator_value !== undefined ? {
                  value: typeof substance.ingredient_quantity_numerator_value === 'number'
                    ? substance.ingredient_quantity_numerator_value
                    : Number(substance.ingredient_quantity_numerator_value),
                  unit: substance.ingredient_quantity_numerator_unit
                } : undefined,
                denominator: substance.ingredient_quantity_denominator_value !== undefined ? {
                  value: typeof substance.ingredient_quantity_denominator_value === 'number'
                    ? substance.ingredient_quantity_denominator_value
                    : Number(substance.ingredient_quantity_denominator_value),
                  unit: substance.ingredient_quantity_denominator_unit
                } : undefined
              }
            : undefined,
          substanceCodeableConcept: substance.ingredient_substance
            ? {
                code: substance.ingredient_substance,
                system: substance.ingredient_substance_system,
                display: substance.ingredient_substance_display
              }
            : undefined
        }]
      : undefined;

  return {
    id: substance.substance_id,
    identifier: substance.substance_id || substance.identifier,
    instance,
    status: substance.status,
    category: category.length ? category.map(cat => ({
      code: cat,
      display: cat
    })) : undefined,
    code: substance.code?.code || substance.code?.display ? {
      system: substance.code?.code_system,
      code: substance.code?.code,
      display: substance.code?.display
    } : undefined,
    description: substance.description,
    expiry: substance.expiry,
    quantity: substance.quantity_value !== undefined || substance.quantity_unit ? {
      value: typeof substance.quantity_value === 'number'
        ? substance.quantity_value
        : substance.quantity_value !== undefined
          ? Number(substance.quantity_value)
          : undefined,
      unit: substance.quantity_unit
    } : undefined,
    ingredient
  };
}

function buildCanonicalVerificationResultGlobal(vr: z.infer<typeof GlobalVerificationResultSchema>) {
  const targetIds = normalizeStringArray(vr.target_ids);
  const targetLocations = normalizeStringArray(vr.target_location);
  const validationProcesses = normalizeStringArray(vr.validation_process);
  const primarySourceTypes = normalizeStringArray(vr.primary_source_type);
  const primarySourceComm = normalizeStringArray(vr.primary_source_communication_method);
  const primarySourcePushTypes = normalizeStringArray(vr.primary_source_push_type_available);

  return {
    id: vr.verification_result_id,
    target: targetIds.length ? targetIds : undefined,
    targetLocation: targetLocations.length ? targetLocations : undefined,
    need: vr.need ? { code: vr.need, display: vr.need } : undefined,
    status: vr.status,
    statusDate: vr.status_date,
    validationType: vr.validation_type ? { code: vr.validation_type, display: vr.validation_type } : undefined,
    validationProcess: validationProcesses.length
      ? validationProcesses.map(value => ({ code: value, display: value }))
      : undefined,
    frequency: vr.frequency ? { text: vr.frequency } : undefined,
    lastPerformed: vr.last_performed,
    nextScheduled: vr.next_scheduled,
    failureAction: vr.failure_action ? { code: vr.failure_action, display: vr.failure_action } : undefined,
    primarySource: (vr.primary_source_who_id || primarySourceTypes.length || primarySourceComm.length || vr.primary_source_validation_status)
      ? [{
          who: vr.primary_source_who_id,
          type: primarySourceTypes.length ? primarySourceTypes.map(value => ({ code: value, display: value })) : undefined,
          communicationMethod: primarySourceComm.length ? primarySourceComm.map(value => ({ code: value, display: value })) : undefined,
          validationStatus: vr.primary_source_validation_status ? { code: vr.primary_source_validation_status, display: vr.primary_source_validation_status } : undefined,
          validationDate: vr.primary_source_validation_date,
          canPushUpdates: vr.primary_source_can_push_updates ? { code: vr.primary_source_can_push_updates, display: vr.primary_source_can_push_updates } : undefined,
          pushTypeAvailable: primarySourcePushTypes.length ? primarySourcePushTypes.map(value => ({ code: value, display: value })) : undefined
        }]
      : undefined,
    attestation: (vr.attestation_who_id || vr.attestation_on_behalf_of_id || vr.attestation_date || vr.attestation_source_identity_certificate)
      ? {
          who: vr.attestation_who_id,
          onBehalfOf: vr.attestation_on_behalf_of_id,
          communicationMethod: vr.attestation_communication_method ? { code: vr.attestation_communication_method, display: vr.attestation_communication_method } : undefined,
          date: vr.attestation_date,
          sourceIdentityCertificate: vr.attestation_source_identity_certificate,
          proxyIdentityCertificate: vr.attestation_proxy_identity_certificate,
          proxySignature: vr.attestation_proxy_signature,
          sourceSignature: vr.attestation_source_signature
        }
      : undefined,
    validator: (vr.validator_organization_id || vr.validator_identity_certificate)
      ? [{
          organization: vr.validator_organization_id,
          identityCertificate: vr.validator_identity_certificate,
          attestationSignature: vr.validator_attestation_signature
        }]
      : undefined
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

function buildCanonicalSpecimenGlobal(specimen: z.infer<typeof GlobalSpecimenSchema>) {
  const parentIds = normalizeStringArray(specimen.parent_ids);
  const requestIds = normalizeStringArray(specimen.request_ids);
  const roles = normalizeStringArray(specimen.role);
  const additives = normalizeStringArray(specimen.processing_additive_ids);
  const conditions = normalizeStringArray(specimen.condition);
  const notes = normalizeStringArray(specimen.note);

  const collectedPeriod = specimen.collection_collected_start || specimen.collection_collected_end
    ? {
      start: specimen.collection_collected_start,
      end: specimen.collection_collected_end
    }
    : undefined;

  const processingTimePeriod = specimen.processing_time_start || specimen.processing_time_end
    ? {
      start: specimen.processing_time_start,
      end: specimen.processing_time_end
    }
    : undefined;

  return {
    id: specimen.specimen_id,
    identifier: specimen.specimen_id,
    accessionIdentifier: specimen.accession_identifier,
    status: specimen.status,
    type: specimen.type ? { code: specimen.type, display: specimen.type } : undefined,
    subject: specimen.subject_id,
    receivedTime: specimen.received_time,
    parent: parentIds.length ? parentIds : undefined,
    request: requestIds.length ? requestIds : undefined,
    combined: specimen.combined,
    role: roles.length ? roles.map(role => ({ code: role, display: role })) : undefined,
    feature: specimen.feature_type || specimen.feature_description ? [{
      type: specimen.feature_type ? { code: specimen.feature_type, display: specimen.feature_type } : undefined,
      description: specimen.feature_description
    }] : undefined,
    collection: (specimen.collection_collector_id || specimen.collection_collected_date || collectedPeriod || specimen.collection_method || specimen.collection_quantity_value !== undefined)
      ? {
        collector: specimen.collection_collector_id,
        collectedDateTime: specimen.collection_collected_date,
        collectedPeriod,
        duration: specimen.collection_duration_value !== undefined ? {
          value: Number(specimen.collection_duration_value),
          unit: specimen.collection_duration_unit
        } : undefined,
        quantity: specimen.collection_quantity_value !== undefined ? {
          value: Number(specimen.collection_quantity_value),
          unit: specimen.collection_quantity_unit
        } : undefined,
        method: specimen.collection_method ? { code: specimen.collection_method, display: specimen.collection_method } : undefined,
        device: specimen.collection_device_id,
        procedure: specimen.collection_procedure_id,
        bodySite: specimen.collection_body_site ? { code: specimen.collection_body_site, display: specimen.collection_body_site } : undefined,
        fastingStatusCodeableConcept: specimen.collection_fasting_status ? { code: specimen.collection_fasting_status, display: specimen.collection_fasting_status } : undefined,
        fastingStatusDuration: specimen.collection_fasting_duration_value !== undefined ? {
          value: Number(specimen.collection_fasting_duration_value),
          unit: specimen.collection_fasting_duration_unit
        } : undefined
      }
      : undefined,
    processing: (specimen.processing_description || specimen.processing_method || additives.length || specimen.processing_time_date || processingTimePeriod)
      ? [{
        description: specimen.processing_description,
        method: specimen.processing_method ? { code: specimen.processing_method, display: specimen.processing_method } : undefined,
        additive: additives.length ? additives : undefined,
        timeDateTime: specimen.processing_time_date,
        timePeriod: processingTimePeriod
      }]
      : undefined,
    container: (specimen.container_device_id || specimen.container_location_id || specimen.container_quantity_value !== undefined)
      ? [{
        device: specimen.container_device_id,
        location: specimen.container_location_id,
        specimenQuantity: specimen.container_quantity_value !== undefined ? {
          value: Number(specimen.container_quantity_value),
          unit: specimen.container_quantity_unit
        } : undefined
      }]
      : undefined,
    condition: conditions.length ? conditions.map(condition => ({ code: condition, display: condition })) : undefined,
    note: notes.length ? notes : undefined
  };
}

function buildCanonicalImagingStudyGlobal(study: z.infer<typeof GlobalImagingStudySchema>) {
  const modality = normalizeStringArray(study.modality).map(value => ({
    code: value,
    display: value
  }));
  const basedOn = normalizeStringArray(study.based_on_ids);
  const partOf = normalizeStringArray(study.part_of_ids);
  const endpoint = normalizeStringArray(study.endpoint_ids);
  const procedures = normalizeStringArray(study.procedure).map(value => ({
    code: value,
    display: value
  }));
  const reasons = normalizeStringArray(study.reason).map(value => ({
    code: { code: value, display: value }
  }));
  const notes = normalizeStringArray(study.note);

  const seriesEndpoint = normalizeStringArray(study.series_endpoint_ids);
  const seriesSpecimen = normalizeStringArray(study.series_specimen_ids);

  const series = (study.series_uid || study.series_number || study.series_modality || study.series_description)
    ? [{
      uid: study.series_uid,
      number: study.series_number !== undefined ? Number(study.series_number) : undefined,
      modality: study.series_modality ? { code: study.series_modality, display: study.series_modality } : undefined,
      description: study.series_description,
      numberOfInstances: study.series_number_of_instances !== undefined ? Number(study.series_number_of_instances) : undefined,
      endpoint: seriesEndpoint.length ? seriesEndpoint : undefined,
      bodySite: study.series_body_site ? { code: study.series_body_site, display: study.series_body_site } : undefined,
      laterality: study.series_laterality ? { code: study.series_laterality, display: study.series_laterality } : undefined,
      specimen: seriesSpecimen.length ? seriesSpecimen : undefined,
      started: study.series_started,
      performer: study.series_performer_id ? [{
        actor: study.series_performer_id
      }] : undefined,
      instance: (study.instance_uid || study.instance_sop_class || study.instance_number !== undefined || study.instance_title)
        ? [{
          uid: study.instance_uid,
          sopClass: study.instance_sop_class ? { code: study.instance_sop_class, display: study.instance_sop_class } : undefined,
          number: study.instance_number !== undefined ? Number(study.instance_number) : undefined,
          title: study.instance_title
        }]
        : undefined
    }]
    : undefined;

  return {
    id: study.imaging_study_id,
    identifier: study.imaging_study_identifier || study.imaging_study_id,
    status: study.status,
    modality: modality.length ? modality : undefined,
    subject: study.subject_id,
    encounter: study.encounter_id,
    started: study.started,
    basedOn: basedOn.length ? basedOn : undefined,
    partOf: partOf.length ? partOf : undefined,
    referrer: study.referrer_id,
    endpoint: endpoint.length ? endpoint : undefined,
    numberOfSeries: study.number_of_series !== undefined ? Number(study.number_of_series) : undefined,
    numberOfInstances: study.number_of_instances !== undefined ? Number(study.number_of_instances) : undefined,
    procedure: procedures.length ? procedures : undefined,
    location: study.location_id,
    reason: reasons.length ? reasons : undefined,
    note: notes.length ? notes : undefined,
    description: study.description,
    series
  };
}

function buildCanonicalAllergyIntoleranceGlobal(allergy: z.infer<typeof GlobalAllergyIntoleranceSchema>) {
  const categories = normalizeStringArray(allergy.category);
  const notes = normalizeStringArray(allergy.note);
  const reactionManifestation = normalizeStringArray(allergy.reaction_manifestation);
  const reactionNotes = normalizeStringArray(allergy.reaction_note);

  const onsetPeriod = allergy.onset_start || allergy.onset_end ? {
    start: allergy.onset_start,
    end: allergy.onset_end
  } : undefined;

  const participant = allergy.participant_actor_id || allergy.participant_function ? [{
    function: allergy.participant_function ? { code: allergy.participant_function, display: allergy.participant_function } : undefined,
    actor: allergy.participant_actor_id
  }] : undefined;

  const reaction = (allergy.reaction_substance || reactionManifestation.length || allergy.reaction_description || allergy.reaction_onset)
    ? [{
      substance: allergy.reaction_substance ? { code: allergy.reaction_substance, display: allergy.reaction_substance } : undefined,
      manifestation: reactionManifestation.length ? reactionManifestation.map(value => ({ code: value, display: value })) : undefined,
      description: allergy.reaction_description,
      onset: allergy.reaction_onset,
      severity: allergy.reaction_severity,
      exposureRoute: allergy.reaction_exposure_route ? { code: allergy.reaction_exposure_route, display: allergy.reaction_exposure_route } : undefined,
      note: reactionNotes.length ? reactionNotes : undefined
    }] : undefined;

  return {
    id: allergy.allergy_id,
    identifier: allergy.allergy_id,
    clinicalStatus: allergy.clinical_status ? { code: allergy.clinical_status, display: allergy.clinical_status } : undefined,
    verificationStatus: allergy.verification_status ? { code: allergy.verification_status, display: allergy.verification_status } : undefined,
    type: allergy.type ? { code: allergy.type, display: allergy.type } : undefined,
    category: categories.length ? categories : undefined,
    criticality: allergy.criticality,
    code: allergy.code?.code || allergy.code?.display ? {
      system: allergy.code?.code_system,
      code: allergy.code?.code,
      display: allergy.code?.display
    } : undefined,
    patient: allergy.patient_id,
    encounter: allergy.encounter_id,
    onsetDateTime: allergy.onset_date,
    onsetPeriod,
    onsetString: allergy.onset_text,
    recordedDate: allergy.recorded_date,
    participant,
    lastOccurrence: allergy.last_occurrence,
    note: notes.length ? notes : undefined,
    reaction
  };
}

function buildCanonicalImmunizationGlobal(immunization: z.infer<typeof GlobalImmunizationSchema>) {
  const basedOn = normalizeStringArray(immunization.based_on_ids);
  const supportingInfo = normalizeStringArray(immunization.supporting_info_ids);
  const notes = normalizeStringArray(immunization.note);
  const reasons = normalizeStringArray(immunization.reason);
  const subpotentReasons = normalizeStringArray(immunization.subpotent_reason);

  const doseValue = immunization.dose_value !== undefined ? Number(immunization.dose_value) : undefined;

  const performer = immunization.performer_actor_id || immunization.performer_function ? [{
    function: immunization.performer_function ? { code: immunization.performer_function, display: immunization.performer_function } : undefined,
    actor: immunization.performer_actor_id || undefined
  }] : undefined;

  const programEligibility = (immunization.program_eligibility_program || immunization.program_eligibility_status)
    ? [{
      program: immunization.program_eligibility_program ? {
        code: immunization.program_eligibility_program,
        display: immunization.program_eligibility_program
      } : undefined,
      programStatus: immunization.program_eligibility_status ? {
        code: immunization.program_eligibility_status,
        display: immunization.program_eligibility_status
      } : undefined
    }]
    : undefined;

  const reaction = (immunization.reaction_date || immunization.reaction_manifestation || immunization.reaction_reported !== undefined)
    ? [{
      date: immunization.reaction_date,
      manifestation: immunization.reaction_manifestation ? {
        code: immunization.reaction_manifestation,
        display: immunization.reaction_manifestation
      } : undefined,
      reported: normalizeBoolean(immunization.reaction_reported as any)
    }]
    : undefined;

  const protocolApplied = (immunization.protocol_series || immunization.protocol_authority_id || immunization.protocol_target_disease)
    ? [{
      series: immunization.protocol_series,
      authority: immunization.protocol_authority_id,
      targetDisease: immunization.protocol_target_disease ? [{
        code: immunization.protocol_target_disease,
        display: immunization.protocol_target_disease
      }] : undefined,
      doseNumber: immunization.protocol_dose_number,
      seriesDoses: immunization.protocol_series_doses
    }]
    : undefined;

  return {
    id: immunization.immunization_id,
    identifier: immunization.immunization_id,
    basedOn: basedOn.length ? basedOn : undefined,
    status: immunization.status,
    statusReason: immunization.status_reason ? { code: immunization.status_reason, display: immunization.status_reason } : undefined,
    vaccineCode: immunization.vaccine_code?.code || immunization.vaccine_code?.display ? {
      system: immunization.vaccine_code?.code_system,
      code: immunization.vaccine_code?.code,
      display: immunization.vaccine_code?.display
    } : undefined,
    administeredProduct: immunization.administered_product_id,
    manufacturer: immunization.manufacturer_id,
    lotNumber: immunization.lot_number,
    expirationDate: immunization.expiration_date,
    patient: immunization.patient_id,
    encounter: immunization.encounter_id,
    supportingInformation: supportingInfo.length ? supportingInfo : undefined,
    occurrenceDateTime: immunization.occurrence_date,
    occurrenceString: immunization.occurrence_string,
    primarySource: normalizeBoolean(immunization.primary_source as any),
    informationSource: immunization.information_source_id,
    location: immunization.location_id,
    site: immunization.site ? { code: immunization.site, display: immunization.site } : undefined,
    route: immunization.route ? { code: immunization.route, display: immunization.route } : undefined,
    doseQuantity: doseValue !== undefined ? { value: doseValue, unit: immunization.dose_unit } : undefined,
    performer,
    note: notes.length ? notes : undefined,
    reason: reasons.length ? reasons.map(value => ({ code: { display: value } })) : undefined,
    isSubpotent: normalizeBoolean(immunization.is_subpotent as any),
    subpotentReason: subpotentReasons.length ? subpotentReasons.map(value => ({ code: value, display: value })) : undefined,
    programEligibility,
    fundingSource: immunization.funding_source ? { code: immunization.funding_source, display: immunization.funding_source } : undefined,
    reaction,
    protocolApplied
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
