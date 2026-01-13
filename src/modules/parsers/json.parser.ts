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

const GlobalCustomJSONSchema = z.object({
  operation: z.enum(['create', 'update', 'delete']).optional(),
  messageType: z.string().optional(),
  patient: z.union([GlobalPatientSchema, z.array(GlobalPatientSchema)]).optional(),
  encounter: z.union([GlobalEncounterSchema, z.array(GlobalEncounterSchema)]).optional(),
  medication: z.union([GlobalMedicationSchema, z.array(GlobalMedicationSchema)]).optional(),
  medication_request: z.union([GlobalMedicationRequestSchema, z.array(GlobalMedicationRequestSchema)]).optional(),
  medication_statement: z.union([GlobalMedicationStatementSchema, z.array(GlobalMedicationStatementSchema)]).optional(),
  medication_administration: z.union([GlobalMedicationAdministrationSchema, z.array(GlobalMedicationAdministrationSchema)]).optional(),
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
  procedure: z.union([GlobalProcedureSchema, z.array(GlobalProcedureSchema)]).optional(),
  condition: z.union([GlobalConditionSchema, z.array(GlobalConditionSchema)]).optional(),
  appointment: z.union([GlobalAppointmentSchema, z.array(GlobalAppointmentSchema)]).optional(),
  schedule: z.union([GlobalScheduleSchema, z.array(GlobalScheduleSchema)]).optional(),
  slot: z.union([GlobalSlotSchema, z.array(GlobalSlotSchema)]).optional(),
  diagnostic_report: z.union([GlobalDiagnosticReportSchema, z.array(GlobalDiagnosticReportSchema)]).optional(),
  related_person: z.union([GlobalRelatedPersonSchema, z.array(GlobalRelatedPersonSchema)]).optional(),
  location: z.union([GlobalLocationSchema, z.array(GlobalLocationSchema)]).optional(),
  episode_of_care: z.union([GlobalEpisodeOfCareSchema, z.array(GlobalEpisodeOfCareSchema)]).optional(),
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
    value.medication_request ||
    value.medication_statement ||
    value.medication_administration ||
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
    value.procedure ||
    value.condition ||
    value.appointment ||
    value.schedule ||
    value.slot ||
    value.diagnostic_report ||
    value.related_person ||
    value.location ||
    value.episode_of_care ||
    value.specimen ||
    value.imaging_study ||
    value.allergy_intolerance ||
    value.immunization ||
    value.practitioner ||
    value.practitioner_role ||
    value.organization
  );
}, {
  message: 'At least one resource section is required (patient, encounter, medication, medication_request, medication_statement, medication_administration, capability_statement, operation_outcome, parameters, care_plan, care_team, goal, service_request, task, communication, communication_request, questionnaire, questionnaire_response, code_system, value_set, concept_map, naming_system, procedure, condition, appointment, schedule, slot, diagnostic_report, related_person, location, episode_of_care, specimen, imaging_study, allergy_intolerance, immunization, practitioner, practitioner_role, organization).',
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
  medicationAdministrations: 'medicationAdministration',
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
  procedures: 'procedure',
  conditions: 'condition',
  appointments: 'appointment',
  schedules: 'schedule',
  slots: 'slot',
  diagnosticReports: 'diagnosticReport',
  relatedPersons: 'relatedPerson',
  locations: 'location',
  episodesOfCare: 'episodeOfCare',
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
  medication_request: 'medicationRequest',
  medication_requests: 'medicationRequest',
  medication_statement: 'medicationStatement',
  medication_statements: 'medicationStatement',
  medication_administration: 'medicationAdministration',
  medication_administrations: 'medicationAdministration',
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
  medication_administration: 'medication_administration',
  medication_administrations: 'medication_administration',
  medicationadministration: 'medication_administration',
  medicationadministrations: 'medication_administration',
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
    case 'medicationAdministration':
      return normalizeGlobalMedicationAdministrationAliases(value);
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
    ['medicationRequest', 'medication_request'],
    ['medicationStatement', 'medication_statement'],
    ['medicationAdministration', 'medication_administration'],
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
    ['schedule', 'schedule'],
    ['slot', 'slot'],
    ['diagnosticReport', 'diagnostic_report'],
    ['relatedPerson', 'related_person'],
    ['location', 'location'],
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
    'medicationAdministration',
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
    'schedule',
    'slot',
    'diagnosticReport',
    'relatedPerson',
    'location',
    'episodeOfCare',
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
  const medicationAdministrations = normalizeArray(validated.medication_administration);
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
  const procedures = normalizeArray(validated.procedure);
  const conditions = normalizeArray(validated.condition);
  const appointments = normalizeArray(validated.appointment);
  const schedules = normalizeArray(validated.schedule);
  const slots = normalizeArray(validated.slot);
  const diagnosticReports = normalizeArray(validated.diagnostic_report);
  const relatedPersons = normalizeArray(validated.related_person);
  const locations = normalizeArray(validated.location);
  const episodesOfCare = normalizeArray(validated.episode_of_care);
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
  if (medicationRequests.length) {
    canonical.medicationRequests = medicationRequests.map(buildCanonicalMedicationRequestGlobal);
  }
  if (medicationStatements.length) {
    canonical.medicationStatements = medicationStatements.map(buildCanonicalMedicationStatementGlobal);
  }
  if (medicationAdministrations.length) {
    canonical.medicationAdministrations = medicationAdministrations.map(buildCanonicalMedicationAdministrationGlobal);
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

  const hasGlobalKey = ['patient', 'encounter', 'medication', 'medication_request', 'medication_statement', 'medication_administration', 'capability_statement', 'operation_outcome', 'parameters', 'care_plan', 'care_team', 'goal', 'service_request', 'task', 'communication', 'communication_request', 'questionnaire', 'questionnaire_response', 'code_system', 'value_set', 'concept_map', 'naming_system', 'procedure', 'condition', 'appointment', 'schedule', 'slot', 'diagnostic_report', 'related_person', 'location', 'episode_of_care', 'specimen', 'imaging_study', 'allergy_intolerance', 'immunization', 'practitioner', 'practitioner_role', 'organization']
    .some(key => key in value);
  if (hasGlobalKey) {
    const candidates = [
      value.patient,
      value.encounter,
      value.medication,
      value.medication_request,
      value.medication_statement,
      value.medication_administration,
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
      value.procedure,
      value.condition,
      value.appointment,
      value.schedule,
      value.slot,
      value.diagnostic_report,
      value.related_person,
      value.location,
      value.episode_of_care,
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
    if ('medication_request_id' in value || 'dosage_instruction' in value) {
      return { medication_request: value };
    }
    if ('medication_statement_id' in value || 'date_asserted' in value || 'effective_date' in value) {
      return { medication_statement: value };
    }
    if ('medication_administration_id' in value || 'occurrence_date' in value || 'dose_value' in value) {
      return { medication_administration: value };
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
    'medication_administration_id' in value ||
    'dose_value' in value ||
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

  const telecom = [];
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
