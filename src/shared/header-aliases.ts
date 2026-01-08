export type HeaderAliasMap = Record<string, string[]>;
export type HeaderAliasSections = Record<string, HeaderAliasMap>;

export const HEADER_ALIAS_SECTIONS: HeaderAliasSections = {
  patient: {
    patient_id: ['patient_identifier', 'patient_mrn', 'mrn', 'medical_record_number', 'patientid'],
    patient_first_name: ['first_name', 'fname', 'given_name', 'given', 'patient_given', 'patient_given_name'],
    patient_middle_name: ['middle_name', 'middlename'],
    patient_last_name: ['last_name', 'lname', 'family_name', 'surname', 'patient_family', 'patient_family_name'],
    patient_name: ['name', 'patientname', 'full_name', 'patient_full_name', 'pt_name'],
    patient_gender: ['gender', 'sex', 'gndr'],
    patient_birth_date: ['dob', 'date_of_birth', 'birth_date', 'birthdate'],
    patient_phone: ['phone', 'phone_number', 'mobile', 'cell', 'cell_phone', 'patient_phone_number', 'patient_mobile', 'patient_home_phone'],
    patient_email: ['email', 'email_address'],
    patient_address_line1: ['address', 'address1', 'address_line1', 'street', 'street_address', 'patient_address1', 'patient_address_1'],
    patient_address_line2: ['address2', 'address_line2', 'street2', 'street_address_2', 'patient_address2', 'patient_address_2'],
    patient_city: ['city', 'town'],
    patient_state: ['state', 'province', 'region', 'patient_province'],
    patient_postal_code: ['zip', 'zipcode', 'postal', 'postal_code', 'patient_zip'],
    patient_country: ['country']
  },
  encounter: {
    encounter_id: ['visit_id', 'encounter_identifier', 'encounterid', 'visitid'],
    encounter_class: ['encounter_type', 'visit_class', 'encounterclass'],
    encounter_start: ['encounter_start_time', 'visit_start', 'visit_start_time', 'admit_time', 'admit_datetime'],
    encounter_location: ['visit_location', 'encounter_room'],
    encounter_status: ['encounterstate'],
    encounter_practitioner_id: ['encounter_participant_id', 'encounter_practitioner_ids'],
    encounter_service_provider_id: ['service_provider_id', 'service_provider_organization_id']
  },
  observation: {
    observation_id: ['obs_id', 'observation_identifier', 'observationid'],
    observation_code: ['obs_code', 'test_code', 'loinc_code', 'observationcode'],
    observation_code_system: ['obs_code_system', 'loinc_system'],
    observation_display: ['obs_display', 'test_name', 'observation_name', 'observation_display_name'],
    observation_value: ['obs_value', 'result_value'],
    observation_unit: ['obs_unit', 'result_unit'],
    observation_date: ['obs_date', 'observation_datetime', 'observation_time', 'recorded_datetime'],
    observation_status: ['obs_status', 'result_status']
  },
  medication: {
    medication_id: ['med_id', 'medication_identifier', 'medicationid'],
    medication_code: ['med_code', 'rxnorm_code', 'ndc_code', 'medicationcode'],
    medication_code_system: ['med_code_system', 'rxnorm_system', 'ndc_system'],
    medication_display: ['med_display', 'medication_name', 'drug_name']
  },
  medicationRequest: {
    medication_request_id: ['med_request_id', 'prescription_id', 'order_id'],
    medication_status: ['med_status', 'medication_request_status'],
    medication_authored_on: ['med_authored_on', 'order_date'],
    medication_dose: ['med_dose'],
    medication_dose_unit: ['med_dose_unit', 'dose_unit'],
    medication_route: ['med_route'],
    medication_route_display: ['med_route_display', 'route_display'],
    medication_sig: ['med_sig', 'sig', 'instructions']
  },
  documentReference: {
    document_id: ['doc_id', 'document_identifier', 'documentid'],
    document_title: ['doc_title'],
    document_description: ['doc_description'],
    document_format: ['doc_format'],
    document_url: ['doc_url'],
    document_data: ['doc_data'],
    document_content_type: ['doc_content_type', 'mime_type'],
    document_status: ['doc_status']
  },
  practitioner: {
    practitioner_id: ['provider_id', 'clinician_id', 'practitioner_identifier', 'practitionerid'],
    practitioner_first_name: ['practitioner_given', 'practitioner_given_name', 'provider_first_name', 'clinician_first_name'],
    practitioner_middle_name: ['practitioner_middlename', 'provider_middle_name', 'clinician_middle_name'],
    practitioner_last_name: ['practitioner_family', 'practitioner_family_name', 'provider_last_name', 'clinician_last_name'],
    practitioner_name: ['practitioner_full_name', 'provider_name', 'clinician_name'],
    practitioner_gender: ['practitioner_sex', 'provider_gender', 'clinician_gender'],
    practitioner_birth_date: ['practitioner_dob', 'provider_dob', 'clinician_dob'],
    practitioner_phone: ['practitioner_phone_number', 'provider_phone', 'clinician_phone', 'practitioner_mobile', 'practitioner_home_phone'],
    practitioner_email: ['practitioner_email_address', 'provider_email', 'clinician_email'],
    practitioner_address_line1: ['practitioner_address', 'practitioner_address1', 'provider_address1', 'practitioner_address_1'],
    practitioner_address_line2: ['practitioner_address2', 'provider_address2', 'practitioner_address_2'],
    practitioner_city: ['practitioner_city', 'provider_city'],
    practitioner_state: ['practitioner_state', 'provider_state', 'practitioner_province'],
    practitioner_postal_code: ['practitioner_zip', 'provider_zip', 'practitioner_postal'],
    practitioner_country: ['practitioner_country', 'provider_country'],
    practitioner_qualification_code: ['practitioner_qualification', 'provider_qualification_code'],
    practitioner_qualification_system: ['practitioner_qualification_system', 'provider_qualification_system'],
    practitioner_qualification_display: ['practitioner_qualification_display', 'provider_qualification_display'],
    practitioner_active: ['provider_active', 'clinician_active']
  },
  practitionerRole: {
    practitioner_role_id: ['role_id', 'practitionerrole_id', 'practitioner_role_identifier'],
    practitioner_role_practitioner_id: ['role_practitioner_id', 'role_provider_id'],
    practitioner_role_organization_id: ['role_organization_id'],
    practitioner_role_code: ['role_code', 'practitionerrole_code'],
    practitioner_role_code_system: ['role_code_system'],
    practitioner_role_code_display: ['role_code_display'],
    practitioner_role_specialty: ['role_specialty', 'specialty_code'],
    practitioner_role_specialty_system: ['specialty_system'],
    practitioner_role_specialty_display: ['specialty_display'],
    practitioner_role_period_start: ['role_period_start', 'role_start'],
    practitioner_role_period_end: ['role_period_end', 'role_end'],
    practitioner_role_active: ['role_active']
  },
  organization: {
    organization_id: ['org_id', 'organization_identifier', 'organizationid'],
    organization_name: ['org_name', 'facility_name'],
    organization_alias: ['org_alias', 'organization_aliases'],
    organization_type_code: ['org_type_code', 'organization_type'],
    organization_type_system: ['org_type_system'],
    organization_type_display: ['org_type_display'],
    organization_phone: ['org_phone', 'organization_phone_number'],
    organization_email: ['org_email', 'organization_email_address'],
    organization_address_line1: ['org_address', 'org_address1', 'organization_address1', 'organization_address_1'],
    organization_address_line2: ['org_address2', 'organization_address2', 'organization_address_2'],
    organization_city: ['org_city', 'organization_city'],
    organization_state: ['org_state', 'organization_state', 'organization_province'],
    organization_postal_code: ['org_zip', 'organization_zip', 'organization_postal'],
    organization_country: ['org_country', 'organization_country'],
    organization_part_of: ['org_parent_id', 'parent_organization_id', 'organization_parent_id'],
    organization_active: ['org_active']
  }
};

export const HEADER_ALIASES: HeaderAliasMap = Object.values(HEADER_ALIAS_SECTIONS)
  .reduce((acc, section) => ({ ...acc, ...section }), {} as HeaderAliasMap);
