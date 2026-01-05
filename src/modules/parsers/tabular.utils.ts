import { CanonicalModel } from '../../shared/types/canonical.types.js';

export type TabularRow = Record<string, string>;

const HEADER_ALIASES: Record<string, string[]> = {
  patient_id: ['patient_identifier', 'patient_mrn', 'mrn', 'medical_record_number', 'patientid'],
  patient_first_name: ['first_name', 'firstname', 'given_name', 'given', 'patient_given_name'],
  patient_middle_name: ['middle_name', 'middlename'],
  patient_last_name: ['last_name', 'lastname', 'family_name', 'surname', 'patient_family_name'],
  patient_name: ['name', 'patientname', 'full_name', 'patient_full_name', 'pt_name'],
  patient_gender: ['gender', 'sex', 'gndr'],
  patient_birth_date: ['dob', 'date_of_birth', 'birth_date', 'birthdate'],
  patient_phone: ['phone', 'phone_number', 'mobile', 'cell', 'cell_phone', 'patient_phone_number'],
  patient_email: ['email', 'email_address'],
  patient_address_line1: ['address', 'address1', 'address_line1', 'street', 'street_address'],
  patient_address_line2: ['address2', 'address_line2', 'street2', 'street_address_2'],
  patient_city: ['city', 'town'],
  patient_state: ['state', 'province', 'region'],
  patient_postal_code: ['zip', 'zipcode', 'postal', 'postal_code'],
  patient_country: ['country']
};

function applyHeaderAliases(normalized: string): string {
  for (const [canonical, aliases] of Object.entries(HEADER_ALIASES)) {
    if (normalized === canonical) return canonical;
    if (aliases.includes(normalized)) return canonical;
  }
  return normalized;
}

export function normalizeHeader(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '_');
  return applyHeaderAliases(normalized);
}

function readValue(row: TabularRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return undefined;
}

function readNumber(row: TabularRow, keys: string[]): number | undefined {
  const value = readValue(row, keys);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function splitFullName(fullName?: string): { given?: string[]; family?: string } | undefined {
  if (!fullName) return undefined;
  const trimmed = fullName.trim();
  if (!trimmed) return undefined;
  if (trimmed.includes(',')) {
    const [familyPart, givenPart] = trimmed.split(',', 2).map(part => part.trim()).filter(Boolean);
    const givenTokens = givenPart ? givenPart.split(/\s+/).filter(Boolean) : [];
    return {
      family: familyPart || undefined,
      given: givenTokens.length > 0 ? givenTokens : undefined
    };
  }
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    return { family: tokens[0] };
  }
  return {
    family: tokens[tokens.length - 1],
    given: tokens.slice(0, -1)
  };
}

export function mapTabularRowsToCanonical(rows: TabularRow[], messageType: string): CanonicalModel {
  const firstRow = rows[0] || {};

  const patientId = readValue(firstRow, ['patient_id', 'patient_identifier', 'patient_mrn']);
  const patientFirst = readValue(firstRow, ['patient_first_name', 'patient_given', 'patient_given_name']);
  const patientMiddle = readValue(firstRow, ['patient_middle_name']);
  let patientLast = readValue(firstRow, ['patient_last_name', 'patient_family', 'patient_family_name']);
  let fullNameGiven: string[] | undefined;
  if (!patientFirst && !patientLast) {
    const nameFromFull = splitFullName(readValue(firstRow, ['patient_name']));
    if (nameFromFull?.family) patientLast = nameFromFull.family;
    if (nameFromFull?.given?.length) fullNameGiven = nameFromFull.given;
  }

  const addressLine1 = readValue(firstRow, ['patient_address_line1', 'patient_address_1']);
  const addressLine2 = readValue(firstRow, ['patient_address_line2', 'patient_address_2']);
  const address = (addressLine1 || addressLine2 || readValue(firstRow, ['patient_city'])) ? [{
    line: [addressLine1, addressLine2].filter(Boolean) as string[],
    city: readValue(firstRow, ['patient_city']),
    state: readValue(firstRow, ['patient_state', 'patient_province']),
    postalCode: readValue(firstRow, ['patient_postal_code', 'patient_zip']),
    country: readValue(firstRow, ['patient_country'])
  }] : undefined;

  const telecom: Array<{ system: 'phone' | 'email' | 'fax' | 'url' | 'other'; value: string; }> = [];
  const phone = readValue(firstRow, ['patient_phone', 'patient_mobile', 'patient_home_phone']);
  const email = readValue(firstRow, ['patient_email']);
  if (phone) telecom.push({ system: 'phone', value: phone });
  if (email) telecom.push({ system: 'email', value: email });

  const givenValues = (fullNameGiven ?? [patientFirst, patientMiddle].filter(Boolean)) as string[];
  const canonical: CanonicalModel = {
    messageType,
    patient: {
      id: patientId,
      identifier: patientId,
      name: {
        family: patientLast,
        given: givenValues.length > 0 ? givenValues : undefined
      },
      gender: readValue(firstRow, ['patient_gender', 'patient_sex']),
      birthDate: readValue(firstRow, ['patient_birth_date', 'patient_dob']),
      address,
      telecom: telecom.length > 0 ? telecom : undefined
    }
  };

  const encounterId = readValue(firstRow, ['encounter_id', 'visit_id']);
  if (encounterId) {
    const participantIdsRaw = readValue(firstRow, [
      'encounter_practitioner_id',
      'encounter_participant_id',
      'encounter_practitioner_ids'
    ]);
    const participantIds = participantIdsRaw
      ? participantIdsRaw.split(',').map(v => v.trim()).filter(Boolean)
      : undefined;
    const serviceProviderOrganizationId = readValue(firstRow, [
      'encounter_service_provider_id',
      'service_provider_id',
      'service_provider_organization_id'
    ]);

    canonical.encounter = {
      id: encounterId,
      class: readValue(firstRow, ['encounter_class', 'encounter_type']),
      start: readValue(firstRow, ['encounter_start', 'encounter_start_time']),
      location: readValue(firstRow, ['encounter_location']),
      status: readValue(firstRow, ['encounter_status']),
      participantPractitionerIds: participantIds && participantIds.length > 0 ? participantIds : undefined,
      serviceProviderOrganizationId: serviceProviderOrganizationId || undefined
    };
  }

  const observations = rows.map(row => {
    const code = readValue(row, ['observation_code', 'obs_code']);
    const value = readValue(row, ['observation_value', 'obs_value']);
    if (!code && value === undefined) return null;
    return {
      setId: readValue(row, ['observation_id', 'obs_id']),
      code: {
        system: readValue(row, ['observation_code_system', 'obs_code_system']),
        code: code,
        display: readValue(row, ['observation_display', 'obs_display'])
      },
      value: readNumber(row, ['observation_value', 'obs_value']) ?? value,
      unit: readValue(row, ['observation_unit', 'obs_unit']),
      date: readValue(row, ['observation_date', 'obs_date', 'recorded_datetime']),
      status: readValue(row, ['observation_status', 'obs_status']) || 'final'
    };
  }).filter(Boolean);

  if (observations.length > 0) canonical.observations = observations as any[];

  const medications = rows.map(row => {
    const code = readValue(row, ['medication_code', 'med_code']);
    if (!code) return null;
    return {
      id: readValue(row, ['medication_id', 'med_id']),
      identifier: readValue(row, ['medication_id', 'med_id']),
      code: {
        coding: [{
          system: readValue(row, ['medication_code_system', 'med_code_system']),
          code: code,
          display: readValue(row, ['medication_display', 'med_display'])
        }],
        text: readValue(row, ['medication_display', 'med_display'])
      }
    };
  }).filter(Boolean);
  if (medications.length > 0) canonical.medications = medications as any[];

  const medicationRequests = rows.map(row => {
    const medCode = readValue(row, ['medication_code', 'med_code']);
    const requestId = readValue(row, ['medication_request_id', 'med_request_id']);
    if (!medCode && !requestId) return null;
    return {
      id: requestId || medCode || undefined,
      status: readValue(row, ['medication_status', 'med_status']) || 'active',
      intent: 'order',
      medicationCodeableConcept: medCode ? {
        coding: [{
          system: readValue(row, ['medication_code_system', 'med_code_system']),
          code: medCode,
          display: readValue(row, ['medication_display', 'med_display'])
        }],
        text: readValue(row, ['medication_display', 'med_display'])
      } : undefined,
      authoredOn: readValue(row, ['medication_authored_on', 'med_authored_on']),
      dosageInstruction: (readValue(row, ['medication_dose', 'med_dose']) || readValue(row, ['medication_route', 'med_route'])) ? [{
        text: readValue(row, ['medication_sig', 'med_sig']),
        doseQuantity: readValue(row, ['medication_dose', 'med_dose']) ? {
          value: readNumber(row, ['medication_dose', 'med_dose']),
          unit: readValue(row, ['medication_dose_unit', 'med_dose_unit'])
        } : undefined,
        route: readValue(row, ['medication_route', 'med_route']) ? {
          coding: [{
            code: readValue(row, ['medication_route', 'med_route']),
            display: readValue(row, ['medication_route_display', 'med_route_display'])
          }]
        } : undefined
      }] : undefined
    };
  }).filter(Boolean);
  if (medicationRequests.length > 0) canonical.medicationRequests = medicationRequests as any[];

  const documentReferences = rows.map(row => {
    const format = readValue(row, ['document_format', 'doc_format']);
    const url = readValue(row, ['document_url', 'doc_url']);
    const data = readValue(row, ['document_data', 'doc_data']);
    if (!format && !url && !data) return null;
    return {
      id: readValue(row, ['document_id', 'doc_id']),
      title: readValue(row, ['document_title', 'doc_title']),
      description: readValue(row, ['document_description', 'doc_description']),
      format: format,
      url: url,
      data: data,
      contentType: readValue(row, ['document_content_type', 'doc_content_type']),
      status: readValue(row, ['document_status', 'doc_status'])
    };
  }).filter(Boolean);
  if (documentReferences.length > 0) canonical.documentReferences = documentReferences as any[];

  return canonical;
}
