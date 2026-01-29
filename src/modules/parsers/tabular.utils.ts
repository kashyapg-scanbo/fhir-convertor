import { HEADER_ALIASES } from '../../shared/header-aliases.js';
import { CanonicalModel } from '../../shared/types/canonical.types.js';

export type TabularRow = Record<string, string>;

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

function readValue(row: TabularRow, keys: string | string[]): string | undefined {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const value = row[key];
    if (value !== undefined && String(value).trim() !== '') return String(value).trim();
  }
  return undefined;
}

function readNumber(row: TabularRow, keys: string | string[]): number | undefined {
  const value = readValue(row, keys);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function readBoolean(row: TabularRow, keys: string | string[]): boolean | undefined {
  const value = readValue(row, keys);
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['true', 't', 'yes', 'y', '1'].includes(normalized)) return true;
  if (['false', 'f', 'no', 'n', '0'].includes(normalized)) return false;
  return undefined;
}

function splitValues(value?: string): string[] | undefined {
  if (!value) return undefined;
  const parts = value.split(/[|,;]/).map(part => part.trim()).filter(Boolean);
  return parts.length ? parts : undefined;
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

  const patientId = readValue(firstRow, 'patient_id');
  const patientFirst = readValue(firstRow, 'patient_first_name');
  const patientMiddle = readValue(firstRow, 'patient_middle_name');
  let patientLast = readValue(firstRow, 'patient_last_name');
  let fullNameGiven: string[] | undefined;
  if (!patientFirst && !patientLast) {
    const nameFromFull = splitFullName(readValue(firstRow, 'patient_name'));
    if (nameFromFull?.family) patientLast = nameFromFull.family;
    if (nameFromFull?.given?.length) fullNameGiven = nameFromFull.given;
  }

  const addressLine1 = readValue(firstRow, 'patient_address_line1');
  const addressLine2 = readValue(firstRow, 'patient_address_line2');
  const address = (addressLine1 || addressLine2 || readValue(firstRow, 'patient_city')) ? [{
    line: [addressLine1, addressLine2].filter(Boolean) as string[],
    city: readValue(firstRow, 'patient_city'),
    state: readValue(firstRow, 'patient_state'),
    postalCode: readValue(firstRow, 'patient_postal_code'),
    country: readValue(firstRow, 'patient_country')
  }] : undefined;

  const telecom: Array<{ system: 'phone' | 'email' | 'fax' | 'url' | 'other'; value: string; }> = [];
  const phone = readValue(firstRow, 'patient_phone');
  const email = readValue(firstRow, 'patient_email');
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
      gender: readValue(firstRow, 'patient_gender'),
      birthDate: readValue(firstRow, 'patient_birth_date'),
      address,
      telecom: telecom.length > 0 ? telecom : undefined
    }
  };

  const encounterId = readValue(firstRow, 'encounter_id');
  if (encounterId) {
    const participantIdsRaw = readValue(firstRow, 'encounter_practitioner_id') ?? readValue(firstRow, 'practitioner_id');
    const participantIds = participantIdsRaw
      ? participantIdsRaw.split(',').map(v => v.trim()).filter(Boolean)
      : undefined;
    const serviceProviderOrganizationId = readValue(firstRow, 'encounter_service_provider_id');

    canonical.encounter = {
      id: encounterId,
      class: readValue(firstRow, 'encounter_class'),
      start: readValue(firstRow, 'encounter_start'),
      location: readValue(firstRow, 'encounter_location'),
      status: readValue(firstRow, 'encounter_status'),
      participantPractitionerIds: participantIds && participantIds.length > 0 ? participantIds : undefined,
      serviceProviderOrganizationId: serviceProviderOrganizationId || undefined
    };
  }

  const observations = rows.map(row => {
    const code = readValue(row, 'observation_code');
    const value = readValue(row, 'observation_value');
    if (!code && value === undefined) return null;
    return {
      setId: readValue(row, 'observation_id'),
      code: {
        system: readValue(row, 'observation_code_system'),
        code: code,
        display: readValue(row, 'observation_display')
      },
      value: readNumber(row, 'observation_value') ?? value,
      unit: readValue(row, 'observation_unit'),
      date: readValue(row, 'observation_date'),
      status: readValue(row, 'observation_status') || 'final'
    };
  }).filter(Boolean);

  if (observations.length > 0) canonical.observations = observations as any[];

  const medications = rows.map(row => {
    const code = readValue(row, 'medication_code');
    if (!code) return null;
    return {
      id: readValue(row, 'medication_id'),
      identifier: readValue(row, 'medication_id'),
      code: {
        coding: [{
          system: readValue(row, 'medication_code_system'),
          code: code,
          display: readValue(row, 'medication_display')
        }],
        text: readValue(row, 'medication_display')
      }
    };
  }).filter(Boolean);
  if (medications.length > 0) canonical.medications = medications as any[];

  const medicationRequests = rows.map(row => {
    const medCode = readValue(row, 'medication_code');
    const requestId = readValue(row, 'medication_request_id');
    if (!medCode && !requestId) return null;
    return {
      id: requestId || medCode || undefined,
      status: readValue(row, 'medication_status') || 'active',
      intent: 'order',
      medicationCodeableConcept: medCode ? {
        coding: [{
          system: readValue(row, 'medication_code_system'),
          code: medCode,
          display: readValue(row, 'medication_display')
        }],
        text: readValue(row, 'medication_display')
      } : undefined,
      authoredOn: readValue(row, 'medication_authored_on'),
      dosageInstruction: (readValue(row, 'medication_dose') || readValue(row, 'medication_route')) ? [{
        text: readValue(row, 'medication_sig'),
        doseQuantity: readValue(row, 'medication_dose') ? {
          value: readNumber(row, 'medication_dose'),
          unit: readValue(row, 'medication_dose_unit')
        } : undefined,
        route: readValue(row, 'medication_route') ? {
          coding: [{
            code: readValue(row, 'medication_route'),
            display: readValue(row, 'medication_route_display')
          }]
        } : undefined
      }] : undefined
    };
  }).filter(Boolean);
  if (medicationRequests.length > 0) canonical.medicationRequests = medicationRequests as any[];

  const medicationStatements = rows.map(row => {
    const medCode = readValue(row, 'medication_statement_medication_code');
    const medDisplay = readValue(row, 'medication_statement_medication_display');
    const medSystem = readValue(row, 'medication_statement_medication_code_system');
    const statementId = readValue(row, 'medication_statement_id');
    const status = readValue(row, 'medication_statement_status');
    if (!medCode && !medDisplay && !statementId) return null;

    const effectiveStart = readValue(row, 'medication_statement_effective_start');
    const effectiveEnd = readValue(row, 'medication_statement_effective_end');
    const dosageDose = readValue(row, 'medication_statement_dose');
    const dosageUnit = readValue(row, 'medication_statement_dose_unit');
    const dosageRoute = readValue(row, 'medication_statement_route');
    const dosageRouteDisplay = readValue(row, 'medication_statement_route_display');

    return {
      id: statementId || undefined,
      identifier: statementId || undefined,
      status: status || 'recorded',
      medicationCodeableConcept: (medCode || medDisplay) ? {
        coding: medCode ? [{
          system: medSystem,
          code: medCode,
          display: medDisplay
        }] : undefined,
        text: medDisplay
      } : undefined,
      subject: readValue(row, 'medication_statement_subject_id'),
      encounter: readValue(row, 'medication_statement_encounter_id'),
      effectiveDateTime: readValue(row, 'medication_statement_effective_date'),
      effectivePeriod: (effectiveStart || effectiveEnd) ? {
        start: effectiveStart,
        end: effectiveEnd
      } : undefined,
      dateAsserted: readValue(row, 'medication_statement_date_asserted'),
      author: readValue(row, 'medication_statement_author'),
      informationSource: readValue(row, 'medication_statement_information_source')
        ?.split(',')
        .map(value => value.trim())
        .filter(Boolean),
      reason: readValue(row, 'medication_statement_reason') ? [{
        code: { display: readValue(row, 'medication_statement_reason') }
      }] : undefined,
      note: readValue(row, 'medication_statement_note') ? [readValue(row, 'medication_statement_note') as string] : undefined,
      dosage: (dosageDose || dosageRoute) ? [{
        text: readValue(row, 'medication_statement_note'),
        doseQuantity: dosageDose ? {
          value: readNumber(row, 'medication_statement_dose'),
          unit: dosageUnit
        } : undefined,
        route: dosageRoute ? {
          coding: [{
            code: dosageRoute,
            display: dosageRouteDisplay
          }]
        } : undefined
      }] : undefined
    };
  }).filter(Boolean);
  if (medicationStatements.length > 0) canonical.medicationStatements = medicationStatements as any[];

  const medicationAdministrations = rows.map(row => {
    const adminId = readValue(row, 'medication_administration_id');
    const status = readValue(row, 'medication_administration_status');
    const medCode = readValue(row, 'medication_administration_medication_code');
    const medDisplay = readValue(row, 'medication_administration_medication_display');
    const medSystem = readValue(row, 'medication_administration_medication_code_system');
    if (!adminId && !medCode && !medDisplay) return null;

    const occurrenceStart = readValue(row, 'medication_administration_occurrence_start');
    const occurrenceEnd = readValue(row, 'medication_administration_occurrence_end');
    const statusReasonRaw = readValue(row, 'medication_administration_status_reason');
    const categoryRaw = readValue(row, 'medication_administration_category');
    const supportingInfoRaw = readValue(row, 'medication_administration_supporting_info_ids');
    const subPotentReasonRaw = readValue(row, 'medication_administration_sub_potent_reason');
    const reasonRaw = readValue(row, 'medication_administration_reason');
    const basedOnRaw = readValue(row, 'medication_administration_based_on_ids');
    const partOfRaw = readValue(row, 'medication_administration_part_of_ids');
    const deviceRaw = readValue(row, 'medication_administration_device_ids');
    const note = readValue(row, 'medication_administration_note');

    const doseValue = readNumber(row, 'medication_administration_dose_value');
    const doseUnit = readValue(row, 'medication_administration_dose_unit');
    const route = readValue(row, 'medication_administration_route');
    const site = readValue(row, 'medication_administration_site');
    const method = readValue(row, 'medication_administration_method');
    const rateValue = readNumber(row, 'medication_administration_rate_value');
    const rateUnit = readValue(row, 'medication_administration_rate_unit');

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    return {
      id: adminId || undefined,
      identifier: adminId || undefined,
      basedOn: toList(basedOnRaw),
      partOf: toList(partOfRaw),
      status: status || undefined,
      statusReason: toList(statusReasonRaw)?.map(value => ({ code: value, display: value })),
      category: toList(categoryRaw)?.map(value => ({ code: value, display: value })),
      medicationCodeableConcept: (medCode || medDisplay) ? {
        coding: medCode ? [{
          system: medSystem,
          code: medCode,
          display: medDisplay
        }] : undefined,
        text: medDisplay
      } : undefined,
      subject: readValue(row, 'medication_administration_subject_id'),
      encounter: readValue(row, 'medication_administration_encounter_id'),
      supportingInformation: toList(supportingInfoRaw),
      occurrenceDateTime: readValue(row, 'medication_administration_occurrence_date'),
      occurrencePeriod: (occurrenceStart || occurrenceEnd) ? {
        start: occurrenceStart,
        end: occurrenceEnd
      } : undefined,
      recorded: readValue(row, 'medication_administration_recorded'),
      isSubPotent: readBoolean(row, 'medication_administration_is_sub_potent'),
      subPotentReason: toList(subPotentReasonRaw)?.map(value => ({ code: value, display: value })),
      performer: (readValue(row, 'medication_administration_performer_actor_id') || readValue(row, 'medication_administration_performer_function')) ? [{
        function: readValue(row, 'medication_administration_performer_function')
          ? { code: readValue(row, 'medication_administration_performer_function'), display: readValue(row, 'medication_administration_performer_function') }
          : undefined,
        actor: readValue(row, 'medication_administration_performer_actor_id') || undefined
      }] : undefined,
      reason: toList(reasonRaw)?.map(value => ({ code: { display: value } })),
      request: readValue(row, 'medication_administration_request_id') || undefined,
      device: toList(deviceRaw),
      note: note ? [note] : undefined,
      dosage: (doseValue !== undefined || route || site || method || rateValue !== undefined) ? {
        text: [doseValue, doseUnit, route, site, method].filter(Boolean).join(' ') || undefined,
        site: site ? { code: site, display: site } : undefined,
        route: route ? { code: route, display: route } : undefined,
        method: method ? { code: method, display: method } : undefined,
        dose: doseValue !== undefined ? { value: doseValue, unit: doseUnit } : undefined,
        rateQuantity: rateValue !== undefined ? { value: rateValue, unit: rateUnit } : undefined
      } : undefined
    };
  }).filter(Boolean);
  if (medicationAdministrations.length > 0) canonical.medicationAdministrations = medicationAdministrations as any[];

  const medicationDispenses = rows.map(row => {
    const dispenseId = readValue(row, 'medication_dispense_id');
    const status = readValue(row, 'medication_dispense_status');
    const medCode = readValue(row, 'medication_dispense_medication_code');
    const medDisplay = readValue(row, 'medication_dispense_medication_display');
    const medSystem = readValue(row, 'medication_dispense_medication_code_system');
    if (!dispenseId && !medCode && !medDisplay) return null;

    const statusChanged = readValue(row, 'medication_dispense_status_changed');
    const categoryRaw = readValue(row, 'medication_dispense_category');
    const supportingInfoRaw = readValue(row, 'medication_dispense_supporting_info_ids');
    const authorizingRaw = readValue(row, 'medication_dispense_authorizing_prescription_ids');
    const receiverRaw = readValue(row, 'medication_dispense_receiver_ids');
    const note = readValue(row, 'medication_dispense_note');
    const basedOnRaw = readValue(row, 'medication_dispense_based_on_ids');
    const partOfRaw = readValue(row, 'medication_dispense_part_of_ids');
    const eventHistoryRaw = readValue(row, 'medication_dispense_event_history_ids');

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    const quantityValue = readNumber(row, 'medication_dispense_quantity_value');
    const quantityUnit = readValue(row, 'medication_dispense_quantity_unit');
    const daysSupplyValue = readNumber(row, 'medication_dispense_days_supply_value');
    const daysSupplyUnit = readValue(row, 'medication_dispense_days_supply_unit');

    const substitutionReasonRaw = readValue(row, 'medication_dispense_substitution_reason');
    const substitutionWasSubstituted = readBoolean(row, 'medication_dispense_substitution_was_substituted');

    return {
      id: dispenseId || undefined,
      identifier: dispenseId || undefined,
      basedOn: toList(basedOnRaw),
      partOf: toList(partOfRaw),
      status: status || undefined,
      statusChanged: statusChanged || undefined,
      category: toList(categoryRaw)?.map(value => ({ code: value, display: value })),
      medicationCodeableConcept: (medCode || medDisplay) ? {
        coding: medCode ? [{
          system: medSystem,
          code: medCode,
          display: medDisplay
        }] : undefined,
        text: medDisplay
      } : undefined,
      subject: readValue(row, 'medication_dispense_subject_id'),
      encounter: readValue(row, 'medication_dispense_encounter_id'),
      supportingInformation: toList(supportingInfoRaw),
      performer: (readValue(row, 'medication_dispense_performer_actor_id') || readValue(row, 'medication_dispense_performer_function')) ? [{
        function: readValue(row, 'medication_dispense_performer_function')
          ? { code: readValue(row, 'medication_dispense_performer_function'), display: readValue(row, 'medication_dispense_performer_function') }
          : undefined,
        actor: readValue(row, 'medication_dispense_performer_actor_id') || undefined
      }] : undefined,
      location: readValue(row, 'medication_dispense_location') || undefined,
      authorizingPrescription: toList(authorizingRaw),
      type: readValue(row, 'medication_dispense_type') ? {
        code: readValue(row, 'medication_dispense_type'),
        display: readValue(row, 'medication_dispense_type')
      } : undefined,
      quantity: quantityValue !== undefined ? { value: quantityValue, unit: quantityUnit || undefined } : undefined,
      daysSupply: daysSupplyValue !== undefined ? { value: daysSupplyValue, unit: daysSupplyUnit || undefined } : undefined,
      recorded: readValue(row, 'medication_dispense_recorded') || undefined,
      whenPrepared: readValue(row, 'medication_dispense_when_prepared') || undefined,
      whenHandedOver: readValue(row, 'medication_dispense_when_handed_over') || undefined,
      destination: readValue(row, 'medication_dispense_destination') || undefined,
      receiver: toList(receiverRaw),
      note: note ? [note] : undefined,
      renderedDosageInstruction: readValue(row, 'medication_dispense_rendered_dosage_instruction') || undefined,
      dosageInstruction: readValue(row, 'medication_dispense_dosage_instruction')
        ? [{ text: readValue(row, 'medication_dispense_dosage_instruction') }]
        : undefined,
      substitution: (substitutionWasSubstituted !== undefined || substitutionReasonRaw || readValue(row, 'medication_dispense_substitution_type') || readValue(row, 'medication_dispense_substitution_responsible_party')) ? {
        wasSubstituted: substitutionWasSubstituted,
        type: readValue(row, 'medication_dispense_substitution_type')
          ? { code: readValue(row, 'medication_dispense_substitution_type'), display: readValue(row, 'medication_dispense_substitution_type') }
          : undefined,
        reason: toList(substitutionReasonRaw)?.map(value => ({ code: value, display: value })),
        responsibleParty: readValue(row, 'medication_dispense_substitution_responsible_party') || undefined
      } : undefined,
      eventHistory: toList(eventHistoryRaw)
    };
  }).filter(Boolean);
  if (medicationDispenses.length > 0) canonical.medicationDispenses = medicationDispenses as any[];

  const organizationAffiliations = rows.map(row => {
    const affiliationId = readValue(row, 'organization_affiliation_id');
    const organizationId = readValue(row, 'organization_affiliation_organization_id');
    const participatingOrgId = readValue(row, 'organization_affiliation_participating_organization_id');
    if (!affiliationId && !organizationId && !participatingOrgId) return null;

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    const code = readValue(row, 'organization_affiliation_code');
    const specialty = readValue(row, 'organization_affiliation_specialty');
    const contactName = readValue(row, 'organization_affiliation_contact_name');
    const contactPhone = readValue(row, 'organization_affiliation_contact_phone');
    const contactEmail = readValue(row, 'organization_affiliation_contact_email');

    const telecom = [];
    if (contactPhone) telecom.push({ system: 'phone', value: contactPhone });
    if (contactEmail) telecom.push({ system: 'email', value: contactEmail });

    return {
      id: affiliationId || undefined,
      identifier: affiliationId || undefined,
      active: readBoolean(row, 'organization_affiliation_active'),
      period: (readValue(row, 'organization_affiliation_period_start') || readValue(row, 'organization_affiliation_period_end')) ? {
        start: readValue(row, 'organization_affiliation_period_start') || undefined,
        end: readValue(row, 'organization_affiliation_period_end') || undefined
      } : undefined,
      organization: organizationId || undefined,
      participatingOrganization: participatingOrgId || undefined,
      network: toList(readValue(row, 'organization_affiliation_network_ids')),
      code: code ? [{ code, display: code }] : undefined,
      specialty: specialty ? [{ code: specialty, display: specialty }] : undefined,
      location: toList(readValue(row, 'organization_affiliation_location_ids')),
      healthcareService: toList(readValue(row, 'organization_affiliation_healthcare_service_ids')),
      contact: (contactName || telecom.length) ? [{ name: contactName || undefined, telecom: telecom.length ? telecom : undefined }] : undefined,
      endpoint: toList(readValue(row, 'organization_affiliation_endpoint_ids'))
    };
  }).filter(Boolean);
  if (organizationAffiliations.length > 0) canonical.organizationAffiliations = organizationAffiliations as any[];

  const deviceDispenses = rows.map(row => {
    const dispenseId = readValue(row, 'device_dispense_id');
    const status = readValue(row, 'device_dispense_status');
    const deviceCode = readValue(row, 'device_dispense_device_code');
    const deviceId = readValue(row, 'device_dispense_device_id');
    if (!dispenseId && !status && !deviceCode && !deviceId) return null;

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    const basedOnRaw = readValue(row, 'device_dispense_based_on_ids');
    const partOfRaw = readValue(row, 'device_dispense_part_of_ids');
    const categoryRaw = readValue(row, 'device_dispense_category');
    const supportingInfoRaw = readValue(row, 'device_dispense_supporting_information_ids');
    const eventHistoryRaw = readValue(row, 'device_dispense_event_history_ids');
    const note = readValue(row, 'device_dispense_note');

    const quantityValue = readNumber(row, 'device_dispense_quantity_value');
    const quantityUnit = readValue(row, 'device_dispense_quantity_unit');

    return {
      id: dispenseId || undefined,
      identifier: dispenseId ? [{ value: dispenseId }] : undefined,
      basedOn: toList(basedOnRaw),
      partOf: toList(partOfRaw),
      status: status || undefined,
      statusReason: (readValue(row, 'device_dispense_status_reason_code') || readValue(row, 'device_dispense_status_reason_reference_id')) ? {
        concept: readValue(row, 'device_dispense_status_reason_code')
          ? { code: readValue(row, 'device_dispense_status_reason_code'), display: readValue(row, 'device_dispense_status_reason_code') }
          : undefined,
        reference: readValue(row, 'device_dispense_status_reason_reference_id') || undefined
      } : undefined,
      category: toList(categoryRaw)?.map(value => ({ code: value, display: value })),
      deviceCodeableConcept: deviceCode ? { code: deviceCode, display: deviceCode } : undefined,
      deviceReference: deviceId || undefined,
      subject: readValue(row, 'device_dispense_subject_id') || undefined,
      receiver: readValue(row, 'device_dispense_receiver_id') || undefined,
      encounter: readValue(row, 'device_dispense_encounter_id') || undefined,
      supportingInformation: toList(supportingInfoRaw),
      performer: (readValue(row, 'device_dispense_performer_actor_id') || readValue(row, 'device_dispense_performer_function')) ? [{
        function: readValue(row, 'device_dispense_performer_function')
          ? { code: readValue(row, 'device_dispense_performer_function'), display: readValue(row, 'device_dispense_performer_function') }
          : undefined,
        actor: readValue(row, 'device_dispense_performer_actor_id') || undefined
      }] : undefined,
      location: readValue(row, 'device_dispense_location_id') || undefined,
      type: readValue(row, 'device_dispense_type') ? {
        code: readValue(row, 'device_dispense_type'),
        display: readValue(row, 'device_dispense_type')
      } : undefined,
      quantity: (quantityValue !== undefined || quantityUnit) ? { value: quantityValue, unit: quantityUnit || undefined } : undefined,
      preparedDate: readValue(row, 'device_dispense_prepared_date') || undefined,
      whenHandedOver: readValue(row, 'device_dispense_when_handed_over') || undefined,
      destination: readValue(row, 'device_dispense_destination_id') || undefined,
      note: note ? [note] : undefined,
      usageInstruction: readValue(row, 'device_dispense_usage_instruction') || undefined,
      eventHistory: toList(eventHistoryRaw)
    };
  }).filter(Boolean);
  if (deviceDispenses.length > 0) canonical.deviceDispenses = deviceDispenses as any[];

  const deviceRequests = rows.map(row => {
    const requestId = readValue(row, 'device_request_id');
    const status = readValue(row, 'device_request_status');
    const deviceCode = readValue(row, 'device_request_device_code');
    const deviceReferenceId = readValue(row, 'device_request_device_reference_id');
    if (!requestId && !status && !deviceCode && !deviceReferenceId) return null;

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    const basedOnRaw = readValue(row, 'device_request_based_on_ids');
    const replacesRaw = readValue(row, 'device_request_replaces_ids');
    const reasonRaw = readValue(row, 'device_request_reason_ids');
    const insuranceRaw = readValue(row, 'device_request_insurance_ids');
    const supportingInfoRaw = readValue(row, 'device_request_supporting_info_ids');
    const relevantHistoryRaw = readValue(row, 'device_request_relevant_history_ids');
    const instantiatesCanonicalRaw = readValue(row, 'device_request_instantiates_canonical');
    const instantiatesUriRaw = readValue(row, 'device_request_instantiates_uri');
    const note = readValue(row, 'device_request_note');

    const quantityValue = readNumber(row, 'device_request_quantity_value');
    const doNotPerform = readBoolean(row, 'device_request_do_not_perform');
    const asNeeded = readBoolean(row, 'device_request_as_needed');
    const parameterQuantityValue = readNumber(row, 'device_request_parameter_value_quantity_value');
    const parameterBoolean = readBoolean(row, 'device_request_parameter_value_boolean');
    const parameterQuantityUnit = readValue(row, 'device_request_parameter_value_quantity_unit');

    const parameterCode = readValue(row, 'device_request_parameter_code');
    const parameterValueCodeable = readValue(row, 'device_request_parameter_value_code');

    const parameters = (parameterCode || parameterValueCodeable || parameterQuantityValue !== undefined || parameterQuantityUnit || parameterBoolean !== undefined)
      ? [{
          code: parameterCode ? { code: parameterCode, display: parameterCode } : undefined,
          valueCodeableConcept: parameterValueCodeable ? { code: parameterValueCodeable, display: parameterValueCodeable } : undefined,
          valueQuantity: (parameterQuantityValue !== undefined || parameterQuantityUnit)
            ? { value: parameterQuantityValue, unit: parameterQuantityUnit || undefined }
            : undefined,
          valueBoolean: parameterBoolean
        }]
      : undefined;

    return {
      id: requestId || undefined,
      identifier: requestId ? [{ value: requestId }] : undefined,
      instantiatesCanonical: toList(instantiatesCanonicalRaw),
      instantiatesUri: toList(instantiatesUriRaw),
      basedOn: toList(basedOnRaw),
      replaces: toList(replacesRaw),
      groupIdentifier: readValue(row, 'device_request_group_identifier')
        ? { value: readValue(row, 'device_request_group_identifier') }
        : undefined,
      status: status || undefined,
      intent: readValue(row, 'device_request_intent') || undefined,
      priority: readValue(row, 'device_request_priority') || undefined,
      doNotPerform: doNotPerform,
      codeCodeableConcept: deviceCode ? { code: deviceCode, display: deviceCode } : undefined,
      codeReference: deviceReferenceId || undefined,
      quantity: quantityValue !== undefined ? quantityValue : undefined,
      parameter: parameters,
      subject: readValue(row, 'device_request_subject_id') || undefined,
      encounter: readValue(row, 'device_request_encounter_id') || undefined,
      occurrenceDateTime: readValue(row, 'device_request_occurrence_date_time') || undefined,
      occurrencePeriod: (readValue(row, 'device_request_occurrence_start') || readValue(row, 'device_request_occurrence_end'))
        ? {
            start: readValue(row, 'device_request_occurrence_start') || undefined,
            end: readValue(row, 'device_request_occurrence_end') || undefined
          }
        : undefined,
      occurrenceTiming: readValue(row, 'device_request_occurrence_timing') || undefined,
      authoredOn: readValue(row, 'device_request_authored_on') || undefined,
      requester: readValue(row, 'device_request_requester_id') || undefined,
      performer: readValue(row, 'device_request_performer_id') || undefined,
      reason: toList(reasonRaw),
      asNeeded: asNeeded,
      asNeededFor: readValue(row, 'device_request_as_needed_for')
        ? { code: readValue(row, 'device_request_as_needed_for'), display: readValue(row, 'device_request_as_needed_for') }
        : undefined,
      insurance: toList(insuranceRaw),
      supportingInfo: toList(supportingInfoRaw),
      note: note ? [note] : undefined,
      relevantHistory: toList(relevantHistoryRaw)
    };
  }).filter(Boolean);
  if (deviceRequests.length > 0) canonical.deviceRequests = deviceRequests as any[];

  const deviceUsages = rows.map(row => {
    const usageId = readValue(row, 'device_usage_id');
    const status = readValue(row, 'device_usage_status');
    const deviceCode = readValue(row, 'device_usage_device_code');
    const deviceReferenceId = readValue(row, 'device_usage_device_reference_id');
    if (!usageId && !status && !deviceCode && !deviceReferenceId) return null;

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    const basedOnRaw = readValue(row, 'device_usage_based_on_ids');
    const categoryRaw = readValue(row, 'device_usage_category');
    const derivedFromRaw = readValue(row, 'device_usage_derived_from_ids');
    const usageReasonRaw = readValue(row, 'device_usage_usage_reason');
    const adherenceReasonRaw = readValue(row, 'device_usage_adherence_reason');
    const reasonRaw = readValue(row, 'device_usage_reason_ids');
    const note = readValue(row, 'device_usage_note');

    return {
      id: usageId || undefined,
      identifier: usageId ? [{ value: usageId }] : undefined,
      basedOn: toList(basedOnRaw),
      status: status || undefined,
      category: toList(categoryRaw)?.map(value => ({ code: value, display: value })),
      patient: readValue(row, 'device_usage_patient_id') || undefined,
      derivedFrom: toList(derivedFromRaw),
      context: readValue(row, 'device_usage_context_id') || undefined,
      timingTiming: readValue(row, 'device_usage_timing_timing') || undefined,
      timingPeriod: (readValue(row, 'device_usage_timing_start') || readValue(row, 'device_usage_timing_end'))
        ? {
            start: readValue(row, 'device_usage_timing_start') || undefined,
            end: readValue(row, 'device_usage_timing_end') || undefined
          }
        : undefined,
      timingDateTime: readValue(row, 'device_usage_timing_date_time') || undefined,
      dateAsserted: readValue(row, 'device_usage_date_asserted') || undefined,
      usageStatus: readValue(row, 'device_usage_usage_status')
        ? { code: readValue(row, 'device_usage_usage_status'), display: readValue(row, 'device_usage_usage_status') }
        : undefined,
      usageReason: toList(usageReasonRaw)?.map(value => ({ code: value, display: value })),
      adherence: (readValue(row, 'device_usage_adherence_code') || adherenceReasonRaw)
        ? {
            code: readValue(row, 'device_usage_adherence_code')
              ? { code: readValue(row, 'device_usage_adherence_code'), display: readValue(row, 'device_usage_adherence_code') }
              : undefined,
            reason: toList(adherenceReasonRaw)?.map(value => ({ code: value, display: value }))
          }
        : undefined,
      informationSource: readValue(row, 'device_usage_information_source_id') || undefined,
      deviceCodeableConcept: deviceCode ? { code: deviceCode, display: deviceCode } : undefined,
      deviceReference: deviceReferenceId || undefined,
      reason: toList(reasonRaw),
      bodySite: readValue(row, 'device_usage_body_site_id') || undefined,
      note: note ? [note] : undefined
    };
  }).filter(Boolean);
  if (deviceUsages.length > 0) canonical.deviceUsages = deviceUsages as any[];

  const encounterHistories = rows.map(row => {
    const historyId = readValue(row, 'encounter_history_id');
    const status = readValue(row, 'encounter_history_status');
    const encounterId = readValue(row, 'encounter_history_encounter_id');
    if (!historyId && !status && !encounterId) return null;

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    const typeRaw = readValue(row, 'encounter_history_type');
    const serviceTypeRaw = readValue(row, 'encounter_history_service_type');
    const serviceTypeReferenceRaw = readValue(row, 'encounter_history_service_type_reference_ids');
    const locationId = readValue(row, 'encounter_history_location_id');
    const locationForm = readValue(row, 'encounter_history_location_form');

    const lengthValue = readNumber(row, 'encounter_history_length_value');

    return {
      id: historyId || undefined,
      identifier: historyId ? [{ value: historyId }] : undefined,
      encounter: encounterId || undefined,
      status: status || undefined,
      class: readValue(row, 'encounter_history_class')
        ? { code: readValue(row, 'encounter_history_class'), display: readValue(row, 'encounter_history_class') }
        : undefined,
      type: toList(typeRaw)?.map(value => ({ code: value, display: value })),
      serviceType: (() => {
        const conceptValues = toList(serviceTypeRaw)?.map(value => ({ concept: { code: value, display: value } })) || [];
        const referenceValues = toList(serviceTypeReferenceRaw)?.map(value => ({ reference: value })) || [];
        const merged = [...conceptValues, ...referenceValues];
        return merged.length ? merged : undefined;
      })(),
      subject: readValue(row, 'encounter_history_subject_id') || undefined,
      subjectStatus: readValue(row, 'encounter_history_subject_status')
        ? { code: readValue(row, 'encounter_history_subject_status'), display: readValue(row, 'encounter_history_subject_status') }
        : undefined,
      actualPeriod: (readValue(row, 'encounter_history_actual_start') || readValue(row, 'encounter_history_actual_end'))
        ? {
            start: readValue(row, 'encounter_history_actual_start') || undefined,
            end: readValue(row, 'encounter_history_actual_end') || undefined
          }
        : undefined,
      plannedStartDate: readValue(row, 'encounter_history_planned_start_date') || undefined,
      plannedEndDate: readValue(row, 'encounter_history_planned_end_date') || undefined,
      length: (lengthValue !== undefined || readValue(row, 'encounter_history_length_unit') || readValue(row, 'encounter_history_length_system') || readValue(row, 'encounter_history_length_code'))
        ? {
            value: lengthValue,
            unit: readValue(row, 'encounter_history_length_unit') || undefined,
            system: readValue(row, 'encounter_history_length_system') || undefined,
            code: readValue(row, 'encounter_history_length_code') || undefined
          }
        : undefined,
      location: (locationId || locationForm)
        ? [{
            location: locationId || undefined,
            form: locationForm ? { code: locationForm, display: locationForm } : undefined
          }]
        : undefined
    };
  }).filter(Boolean);
  if (encounterHistories.length > 0) canonical.encounterHistories = encounterHistories as any[];

  const flags = rows.map(row => {
    const flagId = readValue(row, 'flag_id');
    const status = readValue(row, 'flag_status');
    const code = readValue(row, 'flag_code');
    const subjectId = readValue(row, 'flag_subject_id');
    if (!flagId && !status && !code && !subjectId) return null;

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    const categoryRaw = readValue(row, 'flag_category');

    return {
      id: flagId || undefined,
      identifier: flagId ? [{ value: flagId }] : undefined,
      status: status || undefined,
      category: toList(categoryRaw)?.map(value => ({ code: value, display: value })),
      code: code ? { code, display: code } : undefined,
      subject: subjectId || undefined,
      period: (readValue(row, 'flag_period_start') || readValue(row, 'flag_period_end'))
        ? {
            start: readValue(row, 'flag_period_start') || undefined,
            end: readValue(row, 'flag_period_end') || undefined
          }
        : undefined,
      encounter: readValue(row, 'flag_encounter_id') || undefined,
      author: readValue(row, 'flag_author_id') || undefined
    };
  }).filter(Boolean);
  if (flags.length > 0) canonical.flags = flags as any[];

  const lists = rows.map(row => {
    const listId = readValue(row, 'list_id');
    const status = readValue(row, 'list_status');
    const mode = readValue(row, 'list_mode');
    if (!listId && !status && !mode) return null;

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    const subjectRaw = readValue(row, 'list_subject_ids');
    const note = readValue(row, 'list_note');

    return {
      id: listId || undefined,
      identifier: listId ? [{ value: listId }] : undefined,
      status: status || undefined,
      mode: mode || undefined,
      title: readValue(row, 'list_title') || undefined,
      code: readValue(row, 'list_code')
        ? { code: readValue(row, 'list_code'), display: readValue(row, 'list_code') }
        : undefined,
      subject: toList(subjectRaw),
      encounter: readValue(row, 'list_encounter_id') || undefined,
      date: readValue(row, 'list_date') || undefined,
      source: readValue(row, 'list_source_id') || undefined,
      orderedBy: readValue(row, 'list_ordered_by')
        ? { code: readValue(row, 'list_ordered_by'), display: readValue(row, 'list_ordered_by') }
        : undefined,
      note: note ? [note] : undefined,
      entry: (readValue(row, 'list_entry_item_id') || readValue(row, 'list_entry_flag') || readValue(row, 'list_entry_date'))
        ? [{
            flag: readValue(row, 'list_entry_flag')
              ? { code: readValue(row, 'list_entry_flag'), display: readValue(row, 'list_entry_flag') }
              : undefined,
            deleted: readBoolean(row, 'list_entry_deleted'),
            date: readValue(row, 'list_entry_date') || undefined,
            item: readValue(row, 'list_entry_item_id') || undefined
          }]
        : undefined,
      emptyReason: readValue(row, 'list_empty_reason')
        ? { code: readValue(row, 'list_empty_reason'), display: readValue(row, 'list_empty_reason') }
        : undefined
    };
  }).filter(Boolean);
  if (lists.length > 0) canonical.lists = lists as any[];

  const nutritionIntakes = rows.map(row => {
    const intakeId = readValue(row, 'nutrition_intake_id');
    const status = readValue(row, 'nutrition_intake_status');
    const code = readValue(row, 'nutrition_intake_code');
    if (!intakeId && !status && !code) return null;

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    const statusReasonRaw = readValue(row, 'nutrition_intake_status_reason');
    const basedOnRaw = readValue(row, 'nutrition_intake_based_on_ids');
    const partOfRaw = readValue(row, 'nutrition_intake_part_of_ids');
    const derivedFromRaw = readValue(row, 'nutrition_intake_derived_from_ids');
    const reasonRaw = readValue(row, 'nutrition_intake_reason_ids');
    const note = readValue(row, 'nutrition_intake_note');

    const reportedBoolean = readBoolean(row, 'nutrition_intake_reported_boolean');
    const consumedNotConsumed = readBoolean(row, 'nutrition_intake_consumed_not_consumed');

    const consumedAmountValue = readNumber(row, 'nutrition_intake_consumed_amount_value');
    const ingredientAmountValue = readNumber(row, 'nutrition_intake_ingredient_amount_value');

    return {
      id: intakeId || undefined,
      identifier: intakeId ? [{ value: intakeId }] : undefined,
      instantiatesCanonical: toList(readValue(row, 'nutrition_intake_instantiates_canonical')),
      instantiatesUri: toList(readValue(row, 'nutrition_intake_instantiates_uri')),
      basedOn: toList(basedOnRaw),
      partOf: toList(partOfRaw),
      status: status || undefined,
      statusReason: toList(statusReasonRaw)?.map(value => ({ code: value, display: value })),
      code: code ? { code, display: code } : undefined,
      subject: readValue(row, 'nutrition_intake_subject_id') || undefined,
      encounter: readValue(row, 'nutrition_intake_encounter_id') || undefined,
      occurrenceDateTime: readValue(row, 'nutrition_intake_occurrence_date_time') || undefined,
      occurrencePeriod: (readValue(row, 'nutrition_intake_occurrence_start') || readValue(row, 'nutrition_intake_occurrence_end'))
        ? {
            start: readValue(row, 'nutrition_intake_occurrence_start') || undefined,
            end: readValue(row, 'nutrition_intake_occurrence_end') || undefined
          }
        : undefined,
      recorded: readValue(row, 'nutrition_intake_recorded') || undefined,
      reportedBoolean: reportedBoolean,
      reportedReference: readValue(row, 'nutrition_intake_reported_reference_id') || undefined,
      consumedItem: (readValue(row, 'nutrition_intake_consumed_type') || readValue(row, 'nutrition_intake_consumed_product_code') || readValue(row, 'nutrition_intake_consumed_product_reference_id'))
        ? [{
            type: readValue(row, 'nutrition_intake_consumed_type')
              ? { code: readValue(row, 'nutrition_intake_consumed_type'), display: readValue(row, 'nutrition_intake_consumed_type') }
              : undefined,
            nutritionProductCodeableConcept: readValue(row, 'nutrition_intake_consumed_product_code')
              ? { code: readValue(row, 'nutrition_intake_consumed_product_code'), display: readValue(row, 'nutrition_intake_consumed_product_code') }
              : undefined,
            nutritionProductReference: readValue(row, 'nutrition_intake_consumed_product_reference_id') || undefined,
            amount: (consumedAmountValue !== undefined || readValue(row, 'nutrition_intake_consumed_amount_unit'))
              ? {
                  value: consumedAmountValue,
                  unit: readValue(row, 'nutrition_intake_consumed_amount_unit') || undefined
                }
              : undefined,
            notConsumed: consumedNotConsumed,
            notConsumedReason: readValue(row, 'nutrition_intake_consumed_not_consumed_reason')
              ? { code: readValue(row, 'nutrition_intake_consumed_not_consumed_reason'), display: readValue(row, 'nutrition_intake_consumed_not_consumed_reason') }
              : undefined
          }]
        : undefined,
      ingredientLabel: (readValue(row, 'nutrition_intake_ingredient_nutrient_code') || readValue(row, 'nutrition_intake_ingredient_nutrient_reference_id'))
        ? [{
            nutrientCodeableConcept: readValue(row, 'nutrition_intake_ingredient_nutrient_code')
              ? { code: readValue(row, 'nutrition_intake_ingredient_nutrient_code'), display: readValue(row, 'nutrition_intake_ingredient_nutrient_code') }
              : undefined,
            nutrientReference: readValue(row, 'nutrition_intake_ingredient_nutrient_reference_id') || undefined,
            amount: (ingredientAmountValue !== undefined || readValue(row, 'nutrition_intake_ingredient_amount_unit'))
              ? {
                  value: ingredientAmountValue,
                  unit: readValue(row, 'nutrition_intake_ingredient_amount_unit') || undefined
                }
              : undefined
          }]
        : undefined,
      performer: (readValue(row, 'nutrition_intake_performer_actor_id') || readValue(row, 'nutrition_intake_performer_function'))
        ? [{
            function: readValue(row, 'nutrition_intake_performer_function')
              ? { code: readValue(row, 'nutrition_intake_performer_function'), display: readValue(row, 'nutrition_intake_performer_function') }
              : undefined,
            actor: readValue(row, 'nutrition_intake_performer_actor_id') || undefined
          }]
        : undefined,
      location: readValue(row, 'nutrition_intake_location_id') || undefined,
      derivedFrom: toList(derivedFromRaw),
      reason: toList(reasonRaw),
      note: note ? [note] : undefined
    };
  }).filter(Boolean);
  if (nutritionIntakes.length > 0) canonical.nutritionIntakes = nutritionIntakes as any[];

  const nutritionOrders = rows.map(row => {
    const orderId = readValue(row, 'nutrition_order_id');
    const status = readValue(row, 'nutrition_order_status');
    const intent = readValue(row, 'nutrition_order_intent');
    if (!orderId && !status && !intent) return null;

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    const supportingInfoRaw = readValue(row, 'nutrition_order_supporting_information_ids');
    const basedOnRaw = readValue(row, 'nutrition_order_based_on_ids');
    const performerRefs = toList(readValue(row, 'nutrition_order_performer_reference_ids'));
    const performerConcept = readValue(row, 'nutrition_order_performer_concept');
    const allergyRaw = readValue(row, 'nutrition_order_allergy_intolerance_ids');
    const foodPrefRaw = readValue(row, 'nutrition_order_food_preference_modifier');
    const excludeFoodRaw = readValue(row, 'nutrition_order_exclude_food_modifier');
    const note = readValue(row, 'nutrition_order_note');

    const outsideFoodAllowed = readBoolean(row, 'nutrition_order_outside_food_allowed');
    const oralDietAsNeeded = readBoolean(row, 'nutrition_order_oral_diet_as_needed');
    const supplementAsNeeded = readBoolean(row, 'nutrition_order_supplement_as_needed');

    const supplementQuantityValue = readNumber(row, 'nutrition_order_supplement_quantity_value');
    const enteralCaloricValue = readNumber(row, 'nutrition_order_enteral_caloric_density_value');

    const performerEntries: Array<{ concept?: { code?: string; display?: string }; reference?: string }> = [];
    if (performerConcept) {
      performerEntries.push({ concept: { code: performerConcept, display: performerConcept } });
    }
    if (performerRefs?.length) {
      performerRefs.forEach(ref => performerEntries.push({ reference: ref }));
    }

    const oralDietType = toList(readValue(row, 'nutrition_order_oral_diet_type'));
    const oralDietTiming = readValue(row, 'nutrition_order_oral_diet_schedule_timing');
    const oralDietAsNeededFor = readValue(row, 'nutrition_order_oral_diet_as_needed_for');
    const oralDietInstruction = readValue(row, 'nutrition_order_oral_diet_instruction');

    const supplementTypeCode = readValue(row, 'nutrition_order_supplement_type_code');
    const supplementTypeReference = readValue(row, 'nutrition_order_supplement_type_reference_id');
    const supplementProductName = readValue(row, 'nutrition_order_supplement_product_name');
    const supplementScheduleTiming = readValue(row, 'nutrition_order_supplement_schedule_timing');
    const supplementAsNeededFor = readValue(row, 'nutrition_order_supplement_as_needed_for');
    const supplementQuantityUnit = readValue(row, 'nutrition_order_supplement_quantity_unit');
    const supplementInstruction = readValue(row, 'nutrition_order_supplement_instruction');

    const enteralBaseFormulaCode = readValue(row, 'nutrition_order_enteral_base_formula_code');
    const enteralBaseFormulaReference = readValue(row, 'nutrition_order_enteral_base_formula_reference_id');
    const enteralBaseFormulaProductName = readValue(row, 'nutrition_order_enteral_base_formula_product_name');
    const enteralRoute = readValue(row, 'nutrition_order_enteral_route_of_administration');
    const enteralCaloricUnit = readValue(row, 'nutrition_order_enteral_caloric_density_unit');
    const enteralInstruction = readValue(row, 'nutrition_order_enteral_administration_instruction');

    const groupIdentifier = readValue(row, 'nutrition_order_group_identifier');

    const hasOralDiet = Boolean(oralDietType?.length || oralDietTiming || oralDietAsNeeded !== undefined || oralDietAsNeededFor || oralDietInstruction);
    const hasSupplement = Boolean(supplementTypeCode || supplementTypeReference || supplementProductName || supplementScheduleTiming || supplementAsNeeded !== undefined || supplementAsNeededFor || supplementQuantityValue !== undefined || supplementQuantityUnit || supplementInstruction);
    const hasEnteral = Boolean(enteralBaseFormulaCode || enteralBaseFormulaReference || enteralBaseFormulaProductName || enteralRoute || enteralCaloricValue !== undefined || enteralCaloricUnit || enteralInstruction);

    return {
      id: orderId || undefined,
      identifier: orderId ? [{ value: orderId }] : undefined,
      instantiatesCanonical: toList(readValue(row, 'nutrition_order_instantiates_canonical')),
      instantiatesUri: toList(readValue(row, 'nutrition_order_instantiates_uri')),
      instantiates: toList(readValue(row, 'nutrition_order_instantiates')),
      basedOn: toList(basedOnRaw),
      groupIdentifier: groupIdentifier ? { value: groupIdentifier } : undefined,
      status: status || undefined,
      intent: intent || undefined,
      priority: readValue(row, 'nutrition_order_priority') || undefined,
      subject: readValue(row, 'nutrition_order_subject_id') || undefined,
      encounter: readValue(row, 'nutrition_order_encounter_id') || undefined,
      supportingInformation: toList(supportingInfoRaw),
      dateTime: readValue(row, 'nutrition_order_date_time') || undefined,
      orderer: readValue(row, 'nutrition_order_orderer_id') || undefined,
      performer: performerEntries.length ? performerEntries : undefined,
      allergyIntolerance: toList(allergyRaw),
      foodPreferenceModifier: toList(foodPrefRaw)?.map(value => ({ code: value, display: value })),
      excludeFoodModifier: toList(excludeFoodRaw)?.map(value => ({ code: value, display: value })),
      outsideFoodAllowed: outsideFoodAllowed,
      oralDiet: hasOralDiet ? {
        type: oralDietType?.map(value => ({ code: value, display: value })),
        scheduleTiming: oralDietTiming || undefined,
        asNeeded: oralDietAsNeeded,
        asNeededFor: oralDietAsNeededFor ? { code: oralDietAsNeededFor, display: oralDietAsNeededFor } : undefined,
        instruction: oralDietInstruction || undefined
      } : undefined,
      supplement: hasSupplement ? [{
        typeCodeableConcept: supplementTypeCode ? { code: supplementTypeCode, display: supplementTypeCode } : undefined,
        typeReference: supplementTypeReference || undefined,
        productName: supplementProductName || undefined,
        scheduleTiming: supplementScheduleTiming || undefined,
        asNeeded: supplementAsNeeded,
        asNeededFor: supplementAsNeededFor ? { code: supplementAsNeededFor, display: supplementAsNeededFor } : undefined,
        quantity: (supplementQuantityValue !== undefined || supplementQuantityUnit)
          ? { value: supplementQuantityValue, unit: supplementQuantityUnit || undefined }
          : undefined,
        instruction: supplementInstruction || undefined
      }] : undefined,
      enteralFormula: hasEnteral ? {
        baseFormulaTypeCodeableConcept: enteralBaseFormulaCode ? { code: enteralBaseFormulaCode, display: enteralBaseFormulaCode } : undefined,
        baseFormulaTypeReference: enteralBaseFormulaReference || undefined,
        baseFormulaProductName: enteralBaseFormulaProductName || undefined,
        caloricDensity: (enteralCaloricValue !== undefined || enteralCaloricUnit)
          ? { value: enteralCaloricValue, unit: enteralCaloricUnit || undefined }
          : undefined,
        routeOfAdministration: enteralRoute ? { code: enteralRoute, display: enteralRoute } : undefined,
        administrationInstruction: enteralInstruction || undefined
      } : undefined,
      note: note ? [note] : undefined
    };
  }).filter(Boolean);
  if (nutritionOrders.length > 0) canonical.nutritionOrders = nutritionOrders as any[];

  const riskAssessments = rows.map(row => {
    const assessmentId = readValue(row, 'risk_assessment_id');
    const status = readValue(row, 'risk_assessment_status');
    const code = readValue(row, 'risk_assessment_code');
    if (!assessmentId && !status && !code) return null;

    const toList = (value?: string) => value ? value.split(',').map(v => v.trim()).filter(Boolean) : undefined;

    const reasonRaw = readValue(row, 'risk_assessment_reason_ids');
    const basisRaw = readValue(row, 'risk_assessment_basis_ids');
    const mitigation = readValue(row, 'risk_assessment_mitigation');
    const note = readValue(row, 'risk_assessment_note');

    const probabilityDecimal = readNumber(row, 'risk_assessment_prediction_probability_decimal');
    const probabilityRangeLowValue = readNumber(row, 'risk_assessment_prediction_probability_range_low_value');
    const probabilityRangeHighValue = readNumber(row, 'risk_assessment_prediction_probability_range_high_value');
    const relativeRisk = readNumber(row, 'risk_assessment_prediction_relative_risk');
    const whenRangeLowValue = readNumber(row, 'risk_assessment_prediction_when_range_low_value');
    const whenRangeHighValue = readNumber(row, 'risk_assessment_prediction_when_range_high_value');

    const hasPrediction = Boolean(
      readValue(row, 'risk_assessment_prediction_outcome') ||
      probabilityDecimal !== undefined ||
      probabilityRangeLowValue !== undefined ||
      probabilityRangeHighValue !== undefined ||
      readValue(row, 'risk_assessment_prediction_qualitative_risk') ||
      relativeRisk !== undefined ||
      readValue(row, 'risk_assessment_prediction_when_start') ||
      readValue(row, 'risk_assessment_prediction_when_end') ||
      whenRangeLowValue !== undefined ||
      whenRangeHighValue !== undefined ||
      readValue(row, 'risk_assessment_prediction_rationale')
    );

    return {
      id: assessmentId || undefined,
      identifier: assessmentId ? [{ value: assessmentId }] : undefined,
      basedOn: readValue(row, 'risk_assessment_based_on_id') || undefined,
      parent: readValue(row, 'risk_assessment_parent_id') || undefined,
      status: status || undefined,
      method: readValue(row, 'risk_assessment_method')
        ? { code: readValue(row, 'risk_assessment_method'), display: readValue(row, 'risk_assessment_method') }
        : undefined,
      code: code ? { code, display: code } : undefined,
      subject: readValue(row, 'risk_assessment_subject_id') || undefined,
      encounter: readValue(row, 'risk_assessment_encounter_id') || undefined,
      occurrenceDateTime: readValue(row, 'risk_assessment_occurrence_date_time') || undefined,
      occurrencePeriod: (readValue(row, 'risk_assessment_occurrence_start') || readValue(row, 'risk_assessment_occurrence_end'))
        ? {
            start: readValue(row, 'risk_assessment_occurrence_start') || undefined,
            end: readValue(row, 'risk_assessment_occurrence_end') || undefined
          }
        : undefined,
      condition: readValue(row, 'risk_assessment_condition_id') || undefined,
      performer: readValue(row, 'risk_assessment_performer_id') || undefined,
      reason: toList(reasonRaw),
      basis: toList(basisRaw),
      prediction: hasPrediction
        ? [{
            outcome: readValue(row, 'risk_assessment_prediction_outcome')
              ? { code: readValue(row, 'risk_assessment_prediction_outcome'), display: readValue(row, 'risk_assessment_prediction_outcome') }
              : undefined,
            probabilityDecimal: probabilityDecimal,
            probabilityRange: (probabilityRangeLowValue !== undefined || probabilityRangeHighValue !== undefined || readValue(row, 'risk_assessment_prediction_probability_range_low_unit') || readValue(row, 'risk_assessment_prediction_probability_range_high_unit'))
              ? {
                  low: (probabilityRangeLowValue !== undefined || readValue(row, 'risk_assessment_prediction_probability_range_low_unit'))
                    ? {
                        value: probabilityRangeLowValue,
                        unit: readValue(row, 'risk_assessment_prediction_probability_range_low_unit') || undefined
                      }
                    : undefined,
                  high: (probabilityRangeHighValue !== undefined || readValue(row, 'risk_assessment_prediction_probability_range_high_unit'))
                    ? {
                        value: probabilityRangeHighValue,
                        unit: readValue(row, 'risk_assessment_prediction_probability_range_high_unit') || undefined
                      }
                    : undefined
                }
              : undefined,
            qualitativeRisk: readValue(row, 'risk_assessment_prediction_qualitative_risk')
              ? { code: readValue(row, 'risk_assessment_prediction_qualitative_risk'), display: readValue(row, 'risk_assessment_prediction_qualitative_risk') }
              : undefined,
            relativeRisk: relativeRisk,
            whenPeriod: (readValue(row, 'risk_assessment_prediction_when_start') || readValue(row, 'risk_assessment_prediction_when_end'))
              ? {
                  start: readValue(row, 'risk_assessment_prediction_when_start') || undefined,
                  end: readValue(row, 'risk_assessment_prediction_when_end') || undefined
                }
              : undefined,
            whenRange: (whenRangeLowValue !== undefined || whenRangeHighValue !== undefined || readValue(row, 'risk_assessment_prediction_when_range_low_unit') || readValue(row, 'risk_assessment_prediction_when_range_high_unit'))
              ? {
                  low: (whenRangeLowValue !== undefined || readValue(row, 'risk_assessment_prediction_when_range_low_unit'))
                    ? {
                        value: whenRangeLowValue,
                        unit: readValue(row, 'risk_assessment_prediction_when_range_low_unit') || undefined
                      }
                    : undefined,
                  high: (whenRangeHighValue !== undefined || readValue(row, 'risk_assessment_prediction_when_range_high_unit'))
                    ? {
                        value: whenRangeHighValue,
                        unit: readValue(row, 'risk_assessment_prediction_when_range_high_unit') || undefined
                      }
                    : undefined
                }
              : undefined,
            rationale: readValue(row, 'risk_assessment_prediction_rationale') || undefined
          }]
        : undefined,
      mitigation: mitigation || undefined,
      note: note ? [note] : undefined
    };
  }).filter(Boolean);
  if (riskAssessments.length > 0) canonical.riskAssessments = riskAssessments as any[];

  const capabilityStatements = rows.map(row => {
    const capabilityId = readValue(row, 'capability_statement_id');
    const url = readValue(row, 'capability_statement_url');
    const status = readValue(row, 'capability_statement_status');
    const fhirVersion = readValue(row, 'capability_statement_fhir_version');
    if (!capabilityId && !url && !status && !fhirVersion) return null;

    const format = readValue(row, 'capability_statement_format');
    const identifiers = readValue(row, 'capability_statement_identifier');

    return {
      id: capabilityId || undefined,
      url: url || undefined,
      identifier: identifiers ? identifiers.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      version: readValue(row, 'capability_statement_version'),
      name: readValue(row, 'capability_statement_name'),
      title: readValue(row, 'capability_statement_title'),
      status: status || undefined,
      date: readValue(row, 'capability_statement_date'),
      publisher: readValue(row, 'capability_statement_publisher'),
      kind: readValue(row, 'capability_statement_kind'),
      fhirVersion: fhirVersion || undefined,
      format: format ? format.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      description: readValue(row, 'capability_statement_description'),
      implementation: (readValue(row, 'capability_statement_implementation_url') || readValue(row, 'capability_statement_implementation_description')) ? {
        url: readValue(row, 'capability_statement_implementation_url'),
        description: readValue(row, 'capability_statement_implementation_description')
      } : undefined,
      software: (readValue(row, 'capability_statement_software_name') || readValue(row, 'capability_statement_software_version')) ? {
        name: readValue(row, 'capability_statement_software_name'),
        version: readValue(row, 'capability_statement_software_version'),
        releaseDate: readValue(row, 'capability_statement_software_release_date')
      } : undefined,
      rest: (readValue(row, 'capability_statement_rest_mode') || readValue(row, 'capability_statement_rest_documentation')) ? [{
        mode: readValue(row, 'capability_statement_rest_mode'),
        documentation: readValue(row, 'capability_statement_rest_documentation')
      }] : undefined
    };
  }).filter(Boolean);
  if (capabilityStatements.length > 0) canonical.capabilityStatements = capabilityStatements as any[];

  const operationOutcomes = rows.map(row => {
    const outcomeId = readValue(row, 'operation_outcome_id');
    const severity = readValue(row, 'operation_outcome_severity');
    const code = readValue(row, 'operation_outcome_code');
    const diagnostics = readValue(row, 'operation_outcome_diagnostics');
    if (!outcomeId && !severity && !code && !diagnostics) return null;

    const locationRaw = readValue(row, 'operation_outcome_location');
    const expressionRaw = readValue(row, 'operation_outcome_expression');

    return {
      id: outcomeId || undefined,
      issue: [{
        severity: severity || undefined,
        code: code || undefined,
        details: (readValue(row, 'operation_outcome_details_system') || readValue(row, 'operation_outcome_details_code') || readValue(row, 'operation_outcome_details_display'))
          ? {
            system: readValue(row, 'operation_outcome_details_system'),
            code: readValue(row, 'operation_outcome_details_code'),
            display: readValue(row, 'operation_outcome_details_display')
          }
          : undefined,
        diagnostics: diagnostics || undefined,
        location: locationRaw ? locationRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
        expression: expressionRaw ? expressionRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined
      }]
    };
  }).filter(Boolean);
  if (operationOutcomes.length > 0) canonical.operationOutcomes = operationOutcomes as any[];

  const parameters: Array<{ name: string; valueString?: string; valueCode?: string; valueBoolean?: boolean; valueDate?: string; valueDateTime?: string; valueInteger?: number; valueDecimal?: number; valueUri?: string; valueReference?: string; }> = [];
  for (const row of rows) {
    const name = readValue(row, 'parameter_name');
    const valueRaw = readValue(row, 'parameter_value');
    const valueString = readValue(row, 'parameter_value_string');
    const valueCode = readValue(row, 'parameter_value_code');
    const valueBoolean = readBoolean(row, 'parameter_value_boolean');
    const valueDate = readValue(row, 'parameter_value_date');
    const valueDateTime = readValue(row, 'parameter_value_datetime');
    const valueInteger = readNumber(row, 'parameter_value_integer');
    const valueDecimal = readNumber(row, 'parameter_value_decimal');
    const valueUri = readValue(row, 'parameter_value_uri');
    const valueReference = readValue(row, 'parameter_value_reference');

    if (!name && !valueRaw && !valueString && !valueCode) continue;

    const entry: any = { name: name || 'parameter' };
    if (valueString !== undefined || valueRaw !== undefined) entry.valueString = valueString ?? valueRaw;
    if (valueCode !== undefined) entry.valueCode = valueCode;
    if (valueBoolean !== undefined) entry.valueBoolean = valueBoolean;
    if (valueDate !== undefined) entry.valueDate = valueDate;
    if (valueDateTime !== undefined) entry.valueDateTime = valueDateTime;
    if (valueInteger !== undefined) entry.valueInteger = valueInteger;
    if (valueDecimal !== undefined) entry.valueDecimal = valueDecimal;
    if (valueUri !== undefined) entry.valueUri = valueUri;
    if (valueReference !== undefined) entry.valueReference = valueReference;

    parameters.push(entry);
  }
  if (parameters.length > 0) {
    canonical.parameters = [{
      id: `PARAMS-${Date.now()}`,
      parameter: parameters
    }] as any[];
  }

  const carePlans = rows.map(row => {
    const carePlanId = readValue(row, 'care_plan_id');
    const status = readValue(row, 'care_plan_status');
    const intent = readValue(row, 'care_plan_intent');
    const categoryRaw = readValue(row, 'care_plan_category');
    const title = readValue(row, 'care_plan_title');
    const description = readValue(row, 'care_plan_description');
    const subjectId = readValue(row, 'care_plan_subject_id');
    const encounterId = readValue(row, 'care_plan_encounter_id');
    const periodStart = readValue(row, 'care_plan_period_start');
    const periodEnd = readValue(row, 'care_plan_period_end');
    const created = readValue(row, 'care_plan_created');
    const custodianId = readValue(row, 'care_plan_custodian_id');
    const contributorIdsRaw = readValue(row, 'care_plan_contributor_ids');
    const careTeamIdsRaw = readValue(row, 'care_plan_care_team_ids');
    const addressesRaw = readValue(row, 'care_plan_addresses');
    const supportingInfoIdsRaw = readValue(row, 'care_plan_supporting_info_ids');
    const goalIdsRaw = readValue(row, 'care_plan_goal_ids');
    const activityReference = readValue(row, 'care_plan_activity_reference');
    const activityProgressRaw = readValue(row, 'care_plan_activity_progress');
    const activityPerformedRaw = readValue(row, 'care_plan_activity_performed');
    const noteRaw = readValue(row, 'care_plan_note');
    const instantiatesCanonicalRaw = readValue(row, 'care_plan_instantiates_canonical');
    const instantiatesUriRaw = readValue(row, 'care_plan_instantiates_uri');
    const basedOnIdsRaw = readValue(row, 'care_plan_based_on_ids');
    const replacesIdsRaw = readValue(row, 'care_plan_replaces_ids');
    const partOfIdsRaw = readValue(row, 'care_plan_part_of_ids');

    if (!carePlanId && !title && !description) return null;

    const contributorIds = contributorIdsRaw
      ? contributorIdsRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const careTeamIds = careTeamIdsRaw
      ? careTeamIdsRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const addresses = addressesRaw
      ? addressesRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const supportingInfoIds = supportingInfoIdsRaw
      ? supportingInfoIdsRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const goalIds = goalIdsRaw
      ? goalIdsRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const activityProgress = activityProgressRaw
      ? activityProgressRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const activityPerformed = activityPerformedRaw
      ? activityPerformedRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const instantiatesCanonical = instantiatesCanonicalRaw
      ? instantiatesCanonicalRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const instantiatesUri = instantiatesUriRaw
      ? instantiatesUriRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const basedOnIds = basedOnIdsRaw
      ? basedOnIdsRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const replacesIds = replacesIdsRaw
      ? replacesIdsRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;
    const partOfIds = partOfIdsRaw
      ? partOfIdsRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;

    return {
      id: carePlanId || undefined,
      identifier: carePlanId || undefined,
      status: status || 'active',
      intent: intent || 'plan',
      category: categoryRaw
        ? categoryRaw.split(',').map(value => ({
          code: value.trim(),
          display: value.trim()
        }))
        : undefined,
      title: title,
      description: description,
      subject: subjectId,
      encounter: encounterId,
      period: periodStart || periodEnd ? { start: periodStart, end: periodEnd } : undefined,
      created: created,
      custodian: custodianId,
      contributor: contributorIds,
      careTeam: careTeamIds,
      addresses: addresses?.map(value => ({ code: { display: value } })),
      supportingInfo: supportingInfoIds,
      goal: goalIds,
      activity: activityReference || activityProgress?.length || activityPerformed?.length
        ? [{
          plannedActivityReference: activityReference,
          progress: activityProgress,
          performedActivity: activityPerformed?.map(value => ({ code: { display: value } }))
        }]
        : undefined,
      note: noteRaw ? [noteRaw] : undefined,
      instantiatesCanonical,
      instantiatesUri,
      basedOn: basedOnIds,
      replaces: replacesIds,
      partOf: partOfIds
    };
  }).filter(Boolean);

  if (carePlans.length > 0) {
    canonical.carePlans = carePlans as any[];
  }

  const careTeams = rows.map(row => {
    const careTeamId = readValue(row, 'care_team_id');
    const status = readValue(row, 'care_team_status');
    const categoryRaw = readValue(row, 'care_team_category');
    const name = readValue(row, 'care_team_name');
    const subjectId = readValue(row, 'care_team_subject_id');
    const periodStart = readValue(row, 'care_team_period_start');
    const periodEnd = readValue(row, 'care_team_period_end');
    const participantRole = readValue(row, 'care_team_participant_role');
    const participantMemberId = readValue(row, 'care_team_participant_member_id');
    const participantOnBehalfOfId = readValue(row, 'care_team_participant_on_behalf_of_id');
    const participantCoverageStart = readValue(row, 'care_team_participant_coverage_start');
    const participantCoverageEnd = readValue(row, 'care_team_participant_coverage_end');
    const reasonRaw = readValue(row, 'care_team_reason');
    const managingOrgRaw = readValue(row, 'care_team_managing_org_ids');
    const phone = readValue(row, 'care_team_phone');
    const email = readValue(row, 'care_team_email');
    const noteRaw = readValue(row, 'care_team_note');

    if (!careTeamId && !name && !participantMemberId) return null;

    const category = categoryRaw
      ? categoryRaw.split(',').map(value => ({
        code: value.trim(),
        display: value.trim()
      }))
      : undefined;

    const reason = reasonRaw
      ? reasonRaw.split(',').map(value => ({
        code: { display: value.trim() }
      }))
      : undefined;

    const managingOrganization = managingOrgRaw
      ? managingOrgRaw.split(',').map(value => value.trim()).filter(Boolean)
      : undefined;

    const telecom: Array<{ system: 'phone' | 'email'; value: string }> = [];
    if (phone) telecom.push({ system: 'phone', value: phone });
    if (email) telecom.push({ system: 'email', value: email });

    const participant = participantMemberId || participantRole || participantOnBehalfOfId
      ? [{
        role: participantRole ? { display: participantRole } : undefined,
        member: participantMemberId,
        onBehalfOf: participantOnBehalfOfId,
        coveragePeriod: participantCoverageStart || participantCoverageEnd
          ? { start: participantCoverageStart, end: participantCoverageEnd }
          : undefined
      }]
      : undefined;

    return {
      id: careTeamId || undefined,
      identifier: careTeamId || undefined,
      status: status || 'active',
      category,
      name,
      subject: subjectId,
      period: periodStart || periodEnd ? { start: periodStart, end: periodEnd } : undefined,
      participant,
      reason,
      managingOrganization,
      telecom: telecom.length ? telecom : undefined,
      note: noteRaw ? [noteRaw] : undefined
    };
  }).filter(Boolean);

  if (careTeams.length > 0) {
    canonical.careTeams = careTeams as any[];
  }

  const goals = rows.map(row => {
    const goalId = readValue(row, 'goal_id');
    const lifecycleStatus = readValue(row, 'goal_lifecycle_status');
    const achievementStatus = readValue(row, 'goal_achievement_status');
    const categoryRaw = readValue(row, 'goal_category');
    const continuous = readBoolean(row, 'goal_continuous');
    const priority = readValue(row, 'goal_priority');
    const description = readValue(row, 'goal_description');
    const subjectId = readValue(row, 'goal_subject_id');
    const startDate = readValue(row, 'goal_start_date');
    const startCode = readValue(row, 'goal_start_code');
    const targetMeasure = readValue(row, 'goal_target_measure');
    const targetDetail = readValue(row, 'goal_target_detail');
    const targetDueDate = readValue(row, 'goal_target_due_date');
    const statusDate = readValue(row, 'goal_status_date');
    const statusReason = readValue(row, 'goal_status_reason');
    const sourceId = readValue(row, 'goal_source_id');
    const addressesRaw = readValue(row, 'goal_addresses');
    const noteRaw = readValue(row, 'goal_note');
    const outcomeRaw = readValue(row, 'goal_outcome');

    if (!goalId && !description && !subjectId) return null;

    return {
      id: goalId || undefined,
      identifier: goalId || undefined,
      lifecycleStatus: lifecycleStatus || 'active',
      achievementStatus: achievementStatus ? { display: achievementStatus } : undefined,
      category: categoryRaw
        ? categoryRaw.split(',').map(value => ({ display: value.trim() }))
        : undefined,
      continuous: continuous,
      priority: priority ? { display: priority } : undefined,
      description: description ? { text: description } : undefined,
      subject: subjectId,
      startDate: startDate,
      startCodeableConcept: startCode ? { display: startCode } : undefined,
      target: (targetMeasure || targetDetail || targetDueDate)
        ? [{
          measure: targetMeasure ? { display: targetMeasure } : undefined,
          detailString: targetDetail,
          dueDate: targetDueDate
        }]
        : undefined,
      statusDate: statusDate,
      statusReason: statusReason,
      source: sourceId,
      addresses: addressesRaw ? addressesRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      note: noteRaw ? [noteRaw] : undefined,
      outcome: outcomeRaw ? outcomeRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined
    };
  }).filter(Boolean);

  if (goals.length > 0) {
    canonical.goals = goals as any[];
  }

  const serviceRequests = rows.map(row => {
    const requestId = readValue(row, 'service_request_id');
    const status = readValue(row, 'service_request_status');
    const intent = readValue(row, 'service_request_intent');
    const categoryRaw = readValue(row, 'service_request_category');
    const priority = readValue(row, 'service_request_priority');
    const doNotPerform = readBoolean(row, 'service_request_do_not_perform');
    const code = readValue(row, 'service_request_code');
    const codeSystem = readValue(row, 'service_request_code_system');
    const codeDisplay = readValue(row, 'service_request_code_display');
    const subjectId = readValue(row, 'service_request_subject_id');
    const encounterId = readValue(row, 'service_request_encounter_id');
    const occurrenceDate = readValue(row, 'service_request_occurrence_date');
    const occurrenceStart = readValue(row, 'service_request_occurrence_start');
    const occurrenceEnd = readValue(row, 'service_request_occurrence_end');
    const asNeeded = readBoolean(row, 'service_request_as_needed');
    const authoredOn = readValue(row, 'service_request_authored_on');
    const requesterId = readValue(row, 'service_request_requester_id');
    const performerType = readValue(row, 'service_request_performer_type');
    const performerIdsRaw = readValue(row, 'service_request_performer_ids');
    const locationIdsRaw = readValue(row, 'service_request_location_ids');
    const reasonRaw = readValue(row, 'service_request_reason');
    const supportingInfoRaw = readValue(row, 'service_request_supporting_info_ids');
    const specimenRaw = readValue(row, 'service_request_specimen_ids');
    const bodySiteRaw = readValue(row, 'service_request_body_site');
    const noteRaw = readValue(row, 'service_request_note');
    const instructionRaw = readValue(row, 'service_request_patient_instruction');
    const instantiatesCanonicalRaw = readValue(row, 'service_request_instantiates_canonical');
    const instantiatesUriRaw = readValue(row, 'service_request_instantiates_uri');
    const basedOnRaw = readValue(row, 'service_request_based_on_ids');
    const replacesRaw = readValue(row, 'service_request_replaces_ids');
    const requisition = readValue(row, 'service_request_requisition');

    if (!requestId && !code && !codeDisplay) return null;

    return {
      id: requestId || undefined,
      identifier: requestId || undefined,
      status: status || 'active',
      intent: intent || 'order',
      category: categoryRaw
        ? categoryRaw.split(',').map(value => ({ display: value.trim() }))
        : undefined,
      priority: priority || undefined,
      doNotPerform: doNotPerform,
      code: (code || codeDisplay) ? {
        system: codeSystem,
        code: code,
        display: codeDisplay || code
      } : undefined,
      subject: subjectId,
      encounter: encounterId,
      occurrenceDateTime: occurrenceDate,
      occurrencePeriod: (occurrenceStart || occurrenceEnd)
        ? { start: occurrenceStart, end: occurrenceEnd }
        : undefined,
      asNeededBoolean: asNeeded,
      authoredOn: authoredOn,
      requester: requesterId,
      performerType: performerType ? { display: performerType } : undefined,
      performer: performerIdsRaw ? performerIdsRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      location: locationIdsRaw ? locationIdsRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      reason: reasonRaw ? reasonRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      supportingInfo: supportingInfoRaw ? supportingInfoRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      specimen: specimenRaw ? specimenRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      bodySite: bodySiteRaw ? bodySiteRaw.split(',').map(value => ({ display: value.trim() })) : undefined,
      note: noteRaw ? [noteRaw] : undefined,
      patientInstruction: instructionRaw ? [instructionRaw] : undefined,
      instantiatesCanonical: instantiatesCanonicalRaw ? instantiatesCanonicalRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      instantiatesUri: instantiatesUriRaw ? instantiatesUriRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      basedOn: basedOnRaw ? basedOnRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      replaces: replacesRaw ? replacesRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      requisition
    };
  }).filter(Boolean);

  if (serviceRequests.length > 0) {
    canonical.serviceRequests = serviceRequests as any[];
  }

  const tasks = rows.map(row => {
    const taskId = readValue(row, 'task_id');
    const status = readValue(row, 'task_status');
    const statusReason = readValue(row, 'task_status_reason');
    const businessStatus = readValue(row, 'task_business_status');
    const intent = readValue(row, 'task_intent');
    const priority = readValue(row, 'task_priority');
    const doNotPerform = readBoolean(row, 'task_do_not_perform');
    const code = readValue(row, 'task_code');
    const codeSystem = readValue(row, 'task_code_system');
    const codeDisplay = readValue(row, 'task_code_display');
    const description = readValue(row, 'task_description');
    const focusId = readValue(row, 'task_focus_id');
    const forId = readValue(row, 'task_for_id');
    const encounterId = readValue(row, 'task_encounter_id');
    const requestedStart = readValue(row, 'task_requested_start');
    const requestedEnd = readValue(row, 'task_requested_end');
    const executionStart = readValue(row, 'task_execution_start');
    const executionEnd = readValue(row, 'task_execution_end');
    const authoredOn = readValue(row, 'task_authored_on');
    const lastModified = readValue(row, 'task_last_modified');
    const requesterId = readValue(row, 'task_requester_id');
    const requestedPerformerRaw = readValue(row, 'task_requested_performer_ids');
    const ownerId = readValue(row, 'task_owner_id');
    const performerId = readValue(row, 'task_performer_id');
    const performerFunction = readValue(row, 'task_performer_function');
    const location = readValue(row, 'task_location');
    const reasonRaw = readValue(row, 'task_reason');
    const insuranceRaw = readValue(row, 'task_insurance_ids');
    const noteRaw = readValue(row, 'task_note');
    const relevantHistoryRaw = readValue(row, 'task_relevant_history_ids');
    const instantiatesCanonical = readValue(row, 'task_instantiates_canonical');
    const instantiatesUri = readValue(row, 'task_instantiates_uri');
    const basedOnRaw = readValue(row, 'task_based_on_ids');
    const partOfRaw = readValue(row, 'task_part_of_ids');
    const groupIdentifier = readValue(row, 'task_group_identifier');

    if (!taskId && !code && !description) return null;

    return {
      id: taskId || undefined,
      identifier: taskId || undefined,
      instantiatesCanonical: instantiatesCanonical || undefined,
      instantiatesUri: instantiatesUri || undefined,
      basedOn: basedOnRaw ? basedOnRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      partOf: partOfRaw ? partOfRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      groupIdentifier: groupIdentifier || undefined,
      status: status || 'requested',
      statusReason: statusReason || undefined,
      businessStatus: businessStatus || undefined,
      intent: intent || 'order',
      priority: priority || undefined,
      doNotPerform: doNotPerform,
      code: (code || codeDisplay) ? {
        system: codeSystem,
        code: code,
        display: codeDisplay || code
      } : undefined,
      description: description || undefined,
      focus: focusId || undefined,
      for: forId || undefined,
      encounter: encounterId || undefined,
      requestedPeriod: (requestedStart || requestedEnd) ? { start: requestedStart, end: requestedEnd } : undefined,
      executionPeriod: (executionStart || executionEnd) ? { start: executionStart, end: executionEnd } : undefined,
      authoredOn: authoredOn || undefined,
      lastModified: lastModified || undefined,
      requester: requesterId || undefined,
      requestedPerformer: requestedPerformerRaw ? requestedPerformerRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      owner: ownerId || undefined,
      performer: (performerId || performerFunction) ? [{
        actor: performerId || undefined,
        function: performerFunction ? { display: performerFunction } : undefined
      }] : undefined,
      location: location || undefined,
      reason: reasonRaw ? reasonRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      insurance: insuranceRaw ? insuranceRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      note: noteRaw ? [noteRaw] : undefined,
      relevantHistory: relevantHistoryRaw ? relevantHistoryRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined
    };
  }).filter(Boolean);

  if (tasks.length > 0) {
    canonical.tasks = tasks as any[];
  }

  const communications = rows.map(row => {
    const commId = readValue(row, 'communication_id');
    const status = readValue(row, 'communication_status');
    const statusReason = readValue(row, 'communication_status_reason');
    const categoryRaw = readValue(row, 'communication_category');
    const priority = readValue(row, 'communication_priority');
    const mediumRaw = readValue(row, 'communication_medium');
    const subjectId = readValue(row, 'communication_subject_id');
    const topic = readValue(row, 'communication_topic');
    const aboutRaw = readValue(row, 'communication_about_ids');
    const encounterId = readValue(row, 'communication_encounter_id');
    const sent = readValue(row, 'communication_sent');
    const received = readValue(row, 'communication_received');
    const recipientRaw = readValue(row, 'communication_recipient_ids');
    const senderId = readValue(row, 'communication_sender_id');
    const reasonRaw = readValue(row, 'communication_reason');
    const payloadRaw = readValue(row, 'communication_payload');
    const noteRaw = readValue(row, 'communication_note');
    const instantiatesCanonicalRaw = readValue(row, 'communication_instantiates_canonical');
    const instantiatesUriRaw = readValue(row, 'communication_instantiates_uri');
    const basedOnRaw = readValue(row, 'communication_based_on_ids');
    const partOfRaw = readValue(row, 'communication_part_of_ids');
    const inResponseToRaw = readValue(row, 'communication_in_response_to_ids');

    if (!commId && !topic && !payloadRaw) return null;

    return {
      id: commId || undefined,
      identifier: commId || undefined,
      instantiatesCanonical: instantiatesCanonicalRaw ? instantiatesCanonicalRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      instantiatesUri: instantiatesUriRaw ? instantiatesUriRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      basedOn: basedOnRaw ? basedOnRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      partOf: partOfRaw ? partOfRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      inResponseTo: inResponseToRaw ? inResponseToRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      status: status || 'completed',
      statusReason: statusReason ? { display: statusReason } : undefined,
      category: categoryRaw ? categoryRaw.split(',').map(value => ({ display: value.trim() })) : undefined,
      priority: priority || undefined,
      medium: mediumRaw ? mediumRaw.split(',').map(value => ({ display: value.trim() })) : undefined,
      subject: subjectId || undefined,
      topic: topic ? { display: topic } : undefined,
      about: aboutRaw ? aboutRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      encounter: encounterId || undefined,
      sent: sent || undefined,
      received: received || undefined,
      recipient: recipientRaw ? recipientRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      sender: senderId || undefined,
      reason: reasonRaw ? reasonRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      payload: payloadRaw ? payloadRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      note: noteRaw ? [noteRaw] : undefined
    };
  }).filter(Boolean);

  if (communications.length > 0) {
    canonical.communications = communications as any[];
  }

  const communicationRequests = rows.map(row => {
    const requestId = readValue(row, 'communication_request_id');
    const status = readValue(row, 'communication_request_status');
    const statusReason = readValue(row, 'communication_request_status_reason');
    const intent = readValue(row, 'communication_request_intent');
    const categoryRaw = readValue(row, 'communication_request_category');
    const priority = readValue(row, 'communication_request_priority');
    const doNotPerform = readBoolean(row, 'communication_request_do_not_perform');
    const mediumRaw = readValue(row, 'communication_request_medium');
    const subjectId = readValue(row, 'communication_request_subject_id');
    const aboutRaw = readValue(row, 'communication_request_about_ids');
    const encounterId = readValue(row, 'communication_request_encounter_id');
    const payloadRaw = readValue(row, 'communication_request_payload');
    const occurrenceDate = readValue(row, 'communication_request_occurrence_date');
    const occurrenceStart = readValue(row, 'communication_request_occurrence_start');
    const occurrenceEnd = readValue(row, 'communication_request_occurrence_end');
    const authoredOn = readValue(row, 'communication_request_authored_on');
    const requesterId = readValue(row, 'communication_request_requester_id');
    const recipientRaw = readValue(row, 'communication_request_recipient_ids');
    const informationProviderRaw = readValue(row, 'communication_request_information_provider_ids');
    const reasonRaw = readValue(row, 'communication_request_reason');
    const noteRaw = readValue(row, 'communication_request_note');
    const basedOnRaw = readValue(row, 'communication_request_based_on_ids');
    const replacesRaw = readValue(row, 'communication_request_replaces_ids');
    const groupIdentifier = readValue(row, 'communication_request_group_identifier');

    if (!requestId && !payloadRaw && !subjectId) return null;

    return {
      id: requestId || undefined,
      identifier: requestId || undefined,
      basedOn: basedOnRaw ? basedOnRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      replaces: replacesRaw ? replacesRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      groupIdentifier: groupIdentifier || undefined,
      status: status || 'active',
      statusReason: statusReason ? { display: statusReason } : undefined,
      intent: intent || 'order',
      category: categoryRaw ? categoryRaw.split(',').map(value => ({ display: value.trim() })) : undefined,
      priority: priority || undefined,
      doNotPerform: doNotPerform,
      medium: mediumRaw ? mediumRaw.split(',').map(value => ({ display: value.trim() })) : undefined,
      subject: subjectId || undefined,
      about: aboutRaw ? aboutRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      encounter: encounterId || undefined,
      payload: payloadRaw ? payloadRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      occurrenceDateTime: occurrenceDate,
      occurrencePeriod: (occurrenceStart || occurrenceEnd) ? { start: occurrenceStart, end: occurrenceEnd } : undefined,
      authoredOn: authoredOn || undefined,
      requester: requesterId || undefined,
      recipient: recipientRaw ? recipientRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      informationProvider: informationProviderRaw ? informationProviderRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      reason: reasonRaw ? reasonRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      note: noteRaw ? [noteRaw] : undefined
    };
  }).filter(Boolean);

  if (communicationRequests.length > 0) {
    canonical.communicationRequests = communicationRequests as any[];
  }

  const questionnaires = rows.map(row => {
    const questionnaireId = readValue(row, 'questionnaire_id');
    const url = readValue(row, 'questionnaire_url');
    const version = readValue(row, 'questionnaire_version');
    const name = readValue(row, 'questionnaire_name');
    const title = readValue(row, 'questionnaire_title');
    const status = readValue(row, 'questionnaire_status');
    const date = readValue(row, 'questionnaire_date');
    const publisher = readValue(row, 'questionnaire_publisher');
    const description = readValue(row, 'questionnaire_description');
    const subjectTypeRaw = readValue(row, 'questionnaire_subject_type');
    const itemLinkId = readValue(row, 'questionnaire_item_link_id');
    const itemText = readValue(row, 'questionnaire_item_text');
    const itemType = readValue(row, 'questionnaire_item_type');

    if (!questionnaireId && !title && !name) return null;

    return {
      id: questionnaireId || undefined,
      identifier: questionnaireId || undefined,
      url: url || undefined,
      version: version || undefined,
      name: name || undefined,
      title: title || undefined,
      status: status || 'active',
      date: date || undefined,
      publisher: publisher || undefined,
      description: description || undefined,
      subjectType: subjectTypeRaw ? subjectTypeRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      item: (itemLinkId || itemText || itemType)
        ? [{ linkId: itemLinkId, text: itemText, type: itemType }]
        : undefined
    };
  }).filter(Boolean);

  if (questionnaires.length > 0) {
    canonical.questionnaires = questionnaires as any[];
  }

  const questionnaireResponses = rows.map(row => {
    const responseId = readValue(row, 'questionnaire_response_id');
    const questionnaire = readValue(row, 'questionnaire_response_questionnaire');
    const status = readValue(row, 'questionnaire_response_status');
    const subjectId = readValue(row, 'questionnaire_response_subject_id');
    const encounterId = readValue(row, 'questionnaire_response_encounter_id');
    const authored = readValue(row, 'questionnaire_response_authored');
    const authorId = readValue(row, 'questionnaire_response_author_id');
    const sourceId = readValue(row, 'questionnaire_response_source_id');
    const basedOnRaw = readValue(row, 'questionnaire_response_based_on_ids');
    const partOfRaw = readValue(row, 'questionnaire_response_part_of_ids');
    const itemLinkId = readValue(row, 'questionnaire_response_item_link_id');
    const itemText = readValue(row, 'questionnaire_response_item_text');
    const itemAnswerRaw = readValue(row, 'questionnaire_response_item_answer');

    if (!responseId && !questionnaire && !itemAnswerRaw) return null;

    const answers = itemAnswerRaw ? itemAnswerRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;

    return {
      id: responseId || undefined,
      identifier: responseId || undefined,
      basedOn: basedOnRaw ? basedOnRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      partOf: partOfRaw ? partOfRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      questionnaire: questionnaire || undefined,
      status: status || 'completed',
      subject: subjectId || undefined,
      encounter: encounterId || undefined,
      authored: authored || undefined,
      author: authorId || undefined,
      source: sourceId || undefined,
      item: (itemLinkId || itemText || answers)
        ? [{ linkId: itemLinkId, text: itemText, answer: answers }]
        : undefined
    };
  }).filter(Boolean);

  if (questionnaireResponses.length > 0) {
    canonical.questionnaireResponses = questionnaireResponses as any[];
  }

  const codeSystems = rows.map(row => {
    const codeSystemId = readValue(row, 'code_system_id');
    const url = readValue(row, 'code_system_url');
    const identifier = readValue(row, 'code_system_id');
    const version = readValue(row, 'code_system_version');
    const name = readValue(row, 'code_system_name');
    const title = readValue(row, 'code_system_title');
    const status = readValue(row, 'code_system_status');
    const date = readValue(row, 'code_system_date');
    const publisher = readValue(row, 'code_system_publisher');
    const description = readValue(row, 'code_system_description');
    const content = readValue(row, 'code_system_content');
    const caseSensitive = readValue(row, 'code_system_case_sensitive');
    const conceptCode = readValue(row, 'code_system_concept_code');
    const conceptDisplay = readValue(row, 'code_system_concept_display');
    const conceptDefinition = readValue(row, 'code_system_concept_definition');

    if (!codeSystemId && !url && !conceptCode && !name && !title) return null;

    return {
      id: codeSystemId || undefined,
      url: url || undefined,
      identifier: identifier || undefined,
      version: version || undefined,
      name: name || undefined,
      title: title || undefined,
      status: status || undefined,
      date: date || undefined,
      publisher: publisher || undefined,
      description: description || undefined,
      content: content || undefined,
      caseSensitive: caseSensitive || undefined,
      concept: (conceptCode || conceptDisplay || conceptDefinition)
        ? [{ code: conceptCode, display: conceptDisplay, definition: conceptDefinition }]
        : undefined
    };
  }).filter(Boolean);

  if (codeSystems.length > 0) {
    canonical.codeSystems = codeSystems as any[];
  }

  const valueSets = rows.map(row => {
    const valueSetId = readValue(row, 'value_set_id');
    const url = readValue(row, 'value_set_url');
    const identifier = readValue(row, 'value_set_identifier');
    const version = readValue(row, 'value_set_version');
    const name = readValue(row, 'value_set_name');
    const title = readValue(row, 'value_set_title');
    const status = readValue(row, 'value_set_status');
    const date = readValue(row, 'value_set_date');
    const publisher = readValue(row, 'value_set_publisher');
    const description = readValue(row, 'value_set_description');
    const includeSystem = readValue(row, 'value_set_include_system');
    const includeCode = readValue(row, 'value_set_include_code');
    const includeDisplay = readValue(row, 'value_set_include_display');
    const expansionSystem = readValue(row, 'value_set_expansion_system');
    const expansionCode = readValue(row, 'value_set_expansion_code');
    const expansionDisplay = readValue(row, 'value_set_expansion_display');

    if (!valueSetId && !url && !includeCode && !name && !title) return null;

    const includeConcept = includeCode || includeDisplay
      ? [{ code: includeCode, display: includeDisplay }]
      : undefined;

    return {
      id: valueSetId || undefined,
      url: url || undefined,
      identifier: identifier || undefined,
      version: version || undefined,
      name: name || undefined,
      title: title || undefined,
      status: status || undefined,
      date: date || undefined,
      publisher: publisher || undefined,
      description: description || undefined,
      compose: includeSystem || includeConcept ? {
        include: [{ system: includeSystem, concept: includeConcept }]
      } : undefined,
      expansion: expansionSystem || expansionCode || expansionDisplay ? {
        contains: [{ system: expansionSystem, code: expansionCode, display: expansionDisplay }]
      } : undefined
    };
  }).filter(Boolean);

  if (valueSets.length > 0) {
    canonical.valueSets = valueSets as any[];
  }

  const conceptMaps = rows.map(row => {
    const conceptMapId = readValue(row, 'concept_map_id');
    const url = readValue(row, 'concept_map_url');
    const identifier = readValue(row, 'concept_map_id');
    const version = readValue(row, 'concept_map_version');
    const name = readValue(row, 'concept_map_name');
    const title = readValue(row, 'concept_map_title');
    const status = readValue(row, 'concept_map_status');
    const date = readValue(row, 'concept_map_date');
    const publisher = readValue(row, 'concept_map_publisher');
    const description = readValue(row, 'concept_map_description');
    const sourceScope = readValue(row, 'concept_map_source_scope');
    const targetScope = readValue(row, 'concept_map_target_scope');
    const groupSource = readValue(row, 'concept_map_group_source');
    const groupTarget = readValue(row, 'concept_map_group_target');
    const elementCode = readValue(row, 'concept_map_element_code');
    const elementDisplay = readValue(row, 'concept_map_element_display');
    const targetCode = readValue(row, 'concept_map_target_code');
    const targetDisplay = readValue(row, 'concept_map_target_display');
    const targetRelationship = readValue(row, 'concept_map_target_relationship');

    if (!conceptMapId && !url && !elementCode && !targetCode && !name && !title) return null;

    const targetEntry = targetCode || targetDisplay || targetRelationship
      ? [{ code: targetCode, display: targetDisplay, relationship: targetRelationship }]
      : undefined;

    const elementEntry = elementCode || elementDisplay || targetEntry
      ? [{ code: elementCode, display: elementDisplay, target: targetEntry }]
      : undefined;

    const groupEntry = groupSource || groupTarget || elementEntry
      ? [{ source: groupSource, target: groupTarget, element: elementEntry }]
      : undefined;

    return {
      id: conceptMapId || undefined,
      url: url || undefined,
      identifier: identifier || undefined,
      version: version || undefined,
      name: name || undefined,
      title: title || undefined,
      status: status || undefined,
      date: date || undefined,
      publisher: publisher || undefined,
      description: description || undefined,
      sourceScope: sourceScope || undefined,
      targetScope: targetScope || undefined,
      group: groupEntry
    };
  }).filter(Boolean);

  if (conceptMaps.length > 0) {
    canonical.conceptMaps = conceptMaps as any[];
  }

  const namingSystems = rows.map(row => {
    const namingSystemId = readValue(row, 'naming_system_id');
    const url = readValue(row, 'naming_system_url');
    const identifier = readValue(row, 'naming_system_id');
    const version = readValue(row, 'naming_system_version');
    const name = readValue(row, 'naming_system_name');
    const title = readValue(row, 'naming_system_title');
    const status = readValue(row, 'naming_system_status');
    const kind = readValue(row, 'naming_system_kind');
    const date = readValue(row, 'naming_system_date');
    const publisher = readValue(row, 'naming_system_publisher');
    const responsible = readValue(row, 'naming_system_responsible');
    const description = readValue(row, 'naming_system_description');
    const usage = readValue(row, 'naming_system_usage');
    const uniqueIdType = readValue(row, 'naming_system_unique_id_type');
    const uniqueIdValue = readValue(row, 'naming_system_unique_id_value');
    const uniqueIdPreferred = readValue(row, 'naming_system_unique_id_preferred');

    if (!namingSystemId && !url && !name && !title && !uniqueIdValue) return null;

    const uniqueId = uniqueIdType || uniqueIdValue || uniqueIdPreferred
      ? [{ type: uniqueIdType, value: uniqueIdValue, preferred: uniqueIdPreferred }]
      : undefined;

    return {
      id: namingSystemId || undefined,
      url: url || undefined,
      identifier: identifier || undefined,
      version: version || undefined,
      name: name || undefined,
      title: title || undefined,
      status: status || undefined,
      kind: kind || undefined,
      date: date || undefined,
      publisher: publisher || undefined,
      responsible: responsible || undefined,
      description: description || undefined,
      usage: usage || undefined,
      uniqueId: uniqueId
    };
  }).filter(Boolean);

  if (namingSystems.length > 0) {
    canonical.namingSystems = namingSystems as any[];
  }

  const terminologyCapabilities = rows.map(row => {
    const tcId = readValue(row, 'terminology_capabilities_id');
    const url = readValue(row, 'terminology_capabilities_url');
    const identifier = readValue(row, 'terminology_capabilities_id');
    const version = readValue(row, 'terminology_capabilities_version');
    const name = readValue(row, 'terminology_capabilities_name');
    const title = readValue(row, 'terminology_capabilities_title');
    const status = readValue(row, 'terminology_capabilities_status');
    const date = readValue(row, 'terminology_capabilities_date');
    const publisher = readValue(row, 'terminology_capabilities_publisher');
    const description = readValue(row, 'terminology_capabilities_description');
    const kind = readValue(row, 'terminology_capabilities_kind');
    const codeSearch = readValue(row, 'terminology_capabilities_code_search');

    if (!tcId && !url && !name && !title && !codeSearch) return null;

    return {
      id: tcId || undefined,
      url: url || undefined,
      identifier: identifier || undefined,
      version: version || undefined,
      name: name || undefined,
      title: title || undefined,
      status: status || undefined,
      date: date || undefined,
      publisher: publisher || undefined,
      description: description || undefined,
      kind: kind || undefined,
      codeSearch: codeSearch || undefined
    };
  }).filter(Boolean);

  if (terminologyCapabilities.length > 0) {
    canonical.terminologyCapabilities = terminologyCapabilities as any[];
  }

  const provenances = rows.map(row => {
    const provId = readValue(row, 'provenance_id');
    const targetIds = readValue(row, 'provenance_target_ids');
    const recorded = readValue(row, 'provenance_recorded');
    const activity = readValue(row, 'provenance_activity');
    const agentWho = readValue(row, 'provenance_agent_who');
    const agentRole = readValue(row, 'provenance_agent_role');

    if (!provId && !targetIds && !activity && !recorded) return null;

    const targets = targetIds ? targetIds.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const agent = agentWho || agentRole
      ? [{ who: agentWho, role: agentRole }]
      : undefined;

    return {
      id: provId || undefined,
      target: targets,
      recorded: recorded || undefined,
      activity: activity || undefined,
      agent: agent
    };
  }).filter(Boolean);

  if (provenances.length > 0) {
    canonical.provenances = provenances as any[];
  }

  const auditEvents = rows.map(row => {
    const auditEventId = readValue(row, 'audit_event_id');
    const category = readValue(row, 'audit_event_category');
    const code = readValue(row, 'audit_event_code');
    const action = readValue(row, 'audit_event_action');
    const severity = readValue(row, 'audit_event_severity');
    const recorded = readValue(row, 'audit_event_recorded');
    const agentWho = readValue(row, 'audit_event_agent_who');
    const agentRole = readValue(row, 'audit_event_agent_role');
    const agentRequestor = readValue(row, 'audit_event_agent_requestor');

    if (!auditEventId && !code && !action && !severity) return null;

    const agent = agentWho || agentRole || agentRequestor
      ? [{ who: agentWho, role: agentRole, requestor: agentRequestor }]
      : undefined;

    return {
      id: auditEventId || undefined,
      category: category || undefined,
      code: code || undefined,
      action: action || undefined,
      severity: severity || undefined,
      recorded: recorded || undefined,
      agent: agent
    };
  }).filter(Boolean);

  if (auditEvents.length > 0) {
    canonical.auditEvents = auditEvents as any[];
  }

  const consents = rows.map(row => {
    const consentId = readValue(row, 'consent_id');
    const status = readValue(row, 'consent_status');
    const category = readValue(row, 'consent_category');
    const subjectId = readValue(row, 'consent_subject_id');
    const date = readValue(row, 'consent_date');
    const decision = readValue(row, 'consent_decision');
    const grantorIds = readValue(row, 'consent_grantor_ids');
    const granteeIds = readValue(row, 'consent_grantee_ids');

    if (!consentId && !status && !decision) return null;

    const grantors = grantorIds ? grantorIds.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const grantees = granteeIds ? granteeIds.split(',').map(value => value.trim()).filter(Boolean) : undefined;

    return {
      id: consentId || undefined,
      status: status || undefined,
      category: category || undefined,
      subject: subjectId || undefined,
      date: date || undefined,
      decision: decision || undefined,
      grantor: grantors,
      grantee: grantees
    };
  }).filter(Boolean);

  if (consents.length > 0) {
    canonical.consents = consents as any[];
  }

  const procedures = rows.map(row => {
    const procCode = readValue(row, 'procedure_code');
    const procDisplay = readValue(row, 'procedure_display');
    const procSystem = readValue(row, 'procedure_code_system');
    const procId = readValue(row, 'procedure_id');
    const status = readValue(row, 'procedure_status');
    if (!procCode && !procDisplay && !procId) return null;

    const occurrenceStart = readValue(row, 'procedure_occurrence_start');
    const occurrenceEnd = readValue(row, 'procedure_occurrence_end');
    const bodySiteRaw = readValue(row, 'procedure_body_site');
    const reasonRaw = readValue(row, 'procedure_reason');
    const performerId = readValue(row, 'procedure_performer_id');

    return {
      id: procId || undefined,
      identifier: procId || undefined,
      status: status || 'completed',
      category: readValue(row, 'procedure_category') ? [{
        code: readValue(row, 'procedure_category'),
        display: readValue(row, 'procedure_category')
      }] : undefined,
      code: (procCode || procDisplay) ? {
        coding: procCode ? [{
          system: procSystem,
          code: procCode,
          display: procDisplay
        }] : undefined,
        text: procDisplay
      } : undefined,
      subject: readValue(row, 'procedure_subject_id'),
      encounter: readValue(row, 'procedure_encounter_id'),
      occurrenceDateTime: readValue(row, 'procedure_occurrence_date'),
      occurrencePeriod: (occurrenceStart || occurrenceEnd) ? {
        start: occurrenceStart,
        end: occurrenceEnd
      } : undefined,
      recorded: readValue(row, 'procedure_recorded'),
      performer: performerId ? [{
        actor: performerId
      }] : undefined,
      location: readValue(row, 'procedure_location'),
      reason: reasonRaw ? [{
        code: { display: reasonRaw }
      }] : undefined,
      bodySite: bodySiteRaw ? [{
        display: bodySiteRaw
      }] : undefined,
      note: readValue(row, 'procedure_note') ? [readValue(row, 'procedure_note') as string] : undefined
    };
  }).filter(Boolean);
  if (procedures.length > 0) canonical.procedures = procedures as any[];

  const conditions = rows.map(row => {
    const condCode = readValue(row, 'condition_code');
    const condDisplay = readValue(row, 'condition_display');
    const condSystem = readValue(row, 'condition_code_system');
    const condId = readValue(row, 'condition_id');
    if (!condCode && !condDisplay && !condId) return null;

    const onsetStart = readValue(row, 'condition_onset_start');
    const onsetEnd = readValue(row, 'condition_onset_end');
    const abatementStart = readValue(row, 'condition_abatement_start');
    const abatementEnd = readValue(row, 'condition_abatement_end');

    return {
      id: condId || undefined,
      identifier: condId || undefined,
      clinicalStatus: readValue(row, 'condition_clinical_status') ? {
        code: readValue(row, 'condition_clinical_status'),
        display: readValue(row, 'condition_clinical_status')
      } : undefined,
      verificationStatus: readValue(row, 'condition_verification_status') ? {
        code: readValue(row, 'condition_verification_status'),
        display: readValue(row, 'condition_verification_status')
      } : undefined,
      category: readValue(row, 'condition_category') ? [{
        code: readValue(row, 'condition_category'),
        display: readValue(row, 'condition_category')
      }] : undefined,
      severity: readValue(row, 'condition_severity') ? {
        code: readValue(row, 'condition_severity'),
        display: readValue(row, 'condition_severity')
      } : undefined,
      code: (condCode || condDisplay) ? {
        coding: condCode ? [{
          system: condSystem,
          code: condCode,
          display: condDisplay
        }] : undefined,
        text: condDisplay
      } : undefined,
      bodySite: readValue(row, 'condition_body_site') ? [{
        display: readValue(row, 'condition_body_site')
      }] : undefined,
      subject: readValue(row, 'condition_subject_id'),
      encounter: readValue(row, 'condition_encounter_id'),
      onsetDateTime: readValue(row, 'condition_onset_date'),
      onsetPeriod: (onsetStart || onsetEnd) ? {
        start: onsetStart,
        end: onsetEnd
      } : undefined,
      onsetString: readValue(row, 'condition_onset_text'),
      abatementDateTime: readValue(row, 'condition_abatement_date'),
      abatementPeriod: (abatementStart || abatementEnd) ? {
        start: abatementStart,
        end: abatementEnd
      } : undefined,
      abatementString: readValue(row, 'condition_abatement_text'),
      recordedDate: readValue(row, 'condition_recorded_date'),
      note: readValue(row, 'condition_note') ? [readValue(row, 'condition_note') as string] : undefined
    };
  }).filter(Boolean);
  if (conditions.length > 0) canonical.conditions = conditions as any[];

  const appointments = rows.map(row => {
    const apptId = readValue(row, 'appointment_id');
    const start = readValue(row, 'appointment_start');
    const end = readValue(row, 'appointment_end');
    const status = readValue(row, 'appointment_status');
    if (!apptId && !start && !end) return null;

    const minutes = readNumber(row, 'appointment_minutes_duration');
    const participantId = readValue(row, 'appointment_participant_id');
    const cancellationDisplay = readValue(row, 'appointment_cancellation_reason_display');
    const cancellationCode = readValue(row, 'appointment_cancellation_reason_code');
    const cancellationSystem = readValue(row, 'appointment_cancellation_reason_system');
    const extensions: Array<{ url: string; valueString?: string; valueBoolean?: boolean; valueDateTime?: string; valueUri?: string; valueCode?: string; valueId?: string; }> = [];

    const locationPhone = readValue(row, 'appointment_location_phone_number');
    if (locationPhone) {
      extensions.push({ url: 'urn:scanbo:appointment:location-phone-number', valueString: locationPhone });
    }

    const locationExtension = readValue(row, 'appointment_location_phone_extension');
    if (locationExtension) {
      extensions.push({ url: 'urn:scanbo:appointment:location-phone-extension', valueString: locationExtension });
    }

    const waitingRoomPath = readValue(row, 'appointment_waiting_room_path');
    if (waitingRoomPath) {
      extensions.push({ url: 'urn:scanbo:appointment:waiting-room-path', valueUri: waitingRoomPath });
    }

    const confirmationType = readValue(row, 'appointment_confirmation_type');
    if (confirmationType) {
      extensions.push({ url: 'urn:scanbo:appointment:confirmation-type', valueCode: confirmationType });
    }

    const lastModified = readValue(row, 'appointment_last_modified');
    if (lastModified) {
      extensions.push({ url: 'urn:scanbo:appointment:last-modified', valueDateTime: lastModified });
    }

    const providerLocationId = readValue(row, 'appointment_provider_location_id');
    if (providerLocationId) {
      extensions.push({ url: 'urn:scanbo:appointment:provider-location-id', valueId: providerLocationId });
    }

    const practiceId = readValue(row, 'appointment_practice_id');
    if (practiceId) {
      extensions.push({ url: 'urn:scanbo:appointment:practice-id', valueId: practiceId });
    }

    const visitReasonId = readValue(row, 'appointment_visit_reason_id');
    if (visitReasonId) {
      extensions.push({ url: 'urn:scanbo:appointment:visit-reason-id', valueId: visitReasonId });
    }

    const patientType = readValue(row, 'appointment_patient_type');
    if (patientType) {
      extensions.push({ url: 'urn:scanbo:appointment:patient-type', valueCode: patientType });
    }

    const isProviderResource = readBoolean(row, 'appointment_is_provider_resource');
    if (isProviderResource !== undefined) {
      extensions.push({ url: 'urn:scanbo:appointment:is-provider-resource', valueBoolean: isProviderResource });
    }

    return {
      id: apptId || undefined,
      identifier: apptId || undefined,
      status: status || 'proposed',
      extension: extensions.length > 0 ? extensions : undefined,
      description: readValue(row, 'appointment_description'),
      start: start,
      end: end,
      minutesDuration: minutes,
      created: readValue(row, 'appointment_created'),
      cancellationDate: readValue(row, 'appointment_cancellation_date'),
      cancellationReason: (cancellationDisplay || cancellationCode || cancellationSystem) ? {
        system: cancellationSystem,
        code: cancellationCode,
        display: cancellationDisplay
      } : undefined,
      subject: readValue(row, 'appointment_subject_id'),
      participant: participantId ? [{
        actor: participantId,
        status: readValue(row, 'appointment_participant_status')
      }] : undefined,
      note: readValue(row, 'appointment_note') ? [readValue(row, 'appointment_note') as string] : undefined
    };
  }).filter(Boolean);
  if (appointments.length > 0) canonical.appointments = appointments as any[];

  const appointmentResponses = rows.map(row => {
    const responseId = readValue(row, 'appointment_response_id');
    const appointmentId = readValue(row, 'appointment_response_appointment_id');
    const start = readValue(row, 'appointment_response_start');
    const end = readValue(row, 'appointment_response_end');
    if (!responseId && !appointmentId && !start && !end) return null;

    const participantType = readValue(row, 'appointment_response_participant_type');
    const proposedNewTime = readBoolean(row, 'appointment_response_proposed_new_time');
    const recurring = readBoolean(row, 'appointment_response_recurring');
    const recurrenceId = readNumber(row, 'appointment_response_recurrence_id');

    return {
      id: responseId || undefined,
      identifier: responseId || undefined,
      appointment: appointmentId || undefined,
      proposedNewTime,
      start: start,
      end: end,
      participantType: participantType ? [{
        code: participantType,
        display: participantType
      }] : undefined,
      actor: readValue(row, 'appointment_response_actor_id'),
      participantStatus: readValue(row, 'appointment_response_participant_status'),
      comment: readValue(row, 'appointment_response_comment'),
      recurring,
      occurrenceDate: readValue(row, 'appointment_response_occurrence_date'),
      recurrenceId
    };
  }).filter(Boolean);
  if (appointmentResponses.length > 0) canonical.appointmentResponses = appointmentResponses as any[];

  const claims = rows.map(row => {
    const claimId = readValue(row, 'claim_id');
    const status = readValue(row, 'claim_status');
    const type = readValue(row, 'claim_type');
    const use = readValue(row, 'claim_use');
    const patientId = readValue(row, 'claim_patient_id');
    if (!claimId && !status && !type && !use && !patientId) return null;

    const billableStart = readValue(row, 'claim_billable_start');
    const billableEnd = readValue(row, 'claim_billable_end');
    const created = readValue(row, 'claim_created');
    const entererId = readValue(row, 'claim_enterer_id');
    const insurerId = readValue(row, 'claim_insurer_id');
    const providerId = readValue(row, 'claim_provider_id');
    const priority = readValue(row, 'claim_priority');
    const fundsReserve = readValue(row, 'claim_funds_reserve');
    const referralId = readValue(row, 'claim_referral_id');
    const facilityId = readValue(row, 'claim_facility_id');
    const prescriptionId = readValue(row, 'claim_prescription_id');
    const originalPrescriptionId = readValue(row, 'claim_original_prescription_id');
    const drg = readValue(row, 'claim_drg');
    const accidentDate = readValue(row, 'claim_accident_date');
    const accidentType = readValue(row, 'claim_accident_type');

    const patientPaidValue = readNumber(row, 'claim_patient_paid_value');
    const patientPaidCurrency = readValue(row, 'claim_patient_paid_currency');
    const totalValue = readNumber(row, 'claim_total_value');
    const totalCurrency = readValue(row, 'claim_total_currency');

    const itemSequence = readNumber(row, 'claim_item_sequence');
    const itemProduct = readValue(row, 'claim_item_product_or_service');
    const itemQuantity = readNumber(row, 'claim_item_quantity');
    const itemUnitPrice = readNumber(row, 'claim_item_unit_price');
    const itemNet = readNumber(row, 'claim_item_net');
    const itemPatientPaid = readNumber(row, 'claim_item_patient_paid');
    const itemLocation = readValue(row, 'claim_item_location_id');

    return {
      id: claimId || undefined,
      identifier: claimId ? [{ value: claimId }] : undefined,
      status: status || undefined,
      type: type ? { code: type, display: type } : undefined,
      subType: readValue(row, 'claim_sub_type') ? {
        code: readValue(row, 'claim_sub_type'),
        display: readValue(row, 'claim_sub_type')
      } : undefined,
      use: use || undefined,
      patient: patientId || undefined,
      billablePeriod: (billableStart || billableEnd) ? { start: billableStart, end: billableEnd } : undefined,
      created: created || undefined,
      enterer: entererId || undefined,
      insurer: insurerId || undefined,
      provider: providerId || undefined,
      priority: priority ? { code: priority, display: priority } : undefined,
      fundsReserve: fundsReserve ? { code: fundsReserve, display: fundsReserve } : undefined,
      referral: referralId || undefined,
      facility: facilityId || undefined,
      prescription: prescriptionId || undefined,
      originalPrescription: originalPrescriptionId || undefined,
      diagnosisRelatedGroup: drg ? { code: drg, display: drg } : undefined,
      accident: (accidentDate || accidentType) ? {
        date: accidentDate,
        type: accidentType ? { code: accidentType, display: accidentType } : undefined
      } : undefined,
      patientPaid: (patientPaidValue !== undefined || patientPaidCurrency) ? {
        value: patientPaidValue,
        currency: patientPaidCurrency
      } : undefined,
      item: (itemSequence !== undefined || itemProduct || itemQuantity !== undefined || itemUnitPrice !== undefined || itemNet !== undefined || itemPatientPaid !== undefined || itemLocation) ? [{
        sequence: itemSequence,
        productOrService: itemProduct ? { code: itemProduct, display: itemProduct } : undefined,
        quantity: itemQuantity !== undefined ? { value: itemQuantity } : undefined,
        unitPrice: itemUnitPrice !== undefined ? { value: itemUnitPrice } : undefined,
        net: itemNet !== undefined ? { value: itemNet } : undefined,
        patientPaid: itemPatientPaid !== undefined ? { value: itemPatientPaid } : undefined,
        locationReference: itemLocation || undefined
      }] : undefined,
      total: (totalValue !== undefined || totalCurrency) ? {
        value: totalValue,
        currency: totalCurrency
      } : undefined
    };
  }).filter(Boolean);
  if (claims.length > 0) canonical.claims = claims as any[];

  const claimResponses = rows.map(row => {
    const responseId = readValue(row, 'claim_response_id');
    const status = readValue(row, 'claim_response_status');
    const type = readValue(row, 'claim_response_type');
    const outcome = readValue(row, 'claim_response_outcome');
    if (!responseId && !status && !type && !outcome) return null;

    const patientId = readValue(row, 'claim_response_patient_id');
    const created = readValue(row, 'claim_response_created');
    const insurerId = readValue(row, 'claim_response_insurer_id');
    const requestorId = readValue(row, 'claim_response_requestor_id');
    const requestId = readValue(row, 'claim_response_request_id');
    const disposition = readValue(row, 'claim_response_disposition');
    const preAuthRef = readValue(row, 'claim_response_pre_auth_ref');
    const preAuthStart = readValue(row, 'claim_response_pre_auth_start');
    const preAuthEnd = readValue(row, 'claim_response_pre_auth_end');
    const payeeType = readValue(row, 'claim_response_payee_type');
    const totalValue = readNumber(row, 'claim_response_total_value');
    const totalCurrency = readValue(row, 'claim_response_total_currency');

    const itemSequence = readNumber(row, 'claim_response_item_sequence');
    const itemCategory = readValue(row, 'claim_response_item_category');
    const itemAmount = readNumber(row, 'claim_response_item_amount');

    return {
      id: responseId || undefined,
      identifier: responseId ? [{ value: responseId }] : undefined,
      status: status || undefined,
      type: type ? { code: type, display: type } : undefined,
      subType: readValue(row, 'claim_response_sub_type') ? {
        code: readValue(row, 'claim_response_sub_type'),
        display: readValue(row, 'claim_response_sub_type')
      } : undefined,
      use: readValue(row, 'claim_response_use') || undefined,
      patient: patientId || undefined,
      created: created || undefined,
      insurer: insurerId || undefined,
      requestor: requestorId || undefined,
      request: requestId || undefined,
      outcome: outcome || undefined,
      disposition: disposition || undefined,
      preAuthRef: preAuthRef || undefined,
      preAuthPeriod: (preAuthStart || preAuthEnd) ? { start: preAuthStart, end: preAuthEnd } : undefined,
      payeeType: payeeType ? { code: payeeType, display: payeeType } : undefined,
      item: (itemSequence !== undefined || itemCategory || itemAmount !== undefined) ? [{
        itemSequence: itemSequence,
        adjudication: (itemCategory || itemAmount !== undefined) ? [{
          category: itemCategory ? { code: itemCategory, display: itemCategory } : undefined,
          amount: itemAmount !== undefined ? { value: itemAmount } : undefined
        }] : undefined
      }] : undefined,
      total: (totalValue !== undefined || totalCurrency) ? [{
        amount: {
          value: totalValue,
          currency: totalCurrency
        }
      }] : undefined
    };
  }).filter(Boolean);
  if (claimResponses.length > 0) canonical.claimResponses = claimResponses as any[];

  const explanationOfBenefits = rows.map(row => {
    const eobId = readValue(row, 'explanation_of_benefit_id');
    const status = readValue(row, 'explanation_of_benefit_status');
    const type = readValue(row, 'explanation_of_benefit_type');
    const use = readValue(row, 'explanation_of_benefit_use');
    const patientId = readValue(row, 'explanation_of_benefit_patient_id');
    if (!eobId && !status && !type && !use && !patientId) return null;

    const billableStart = readValue(row, 'explanation_of_benefit_billable_start');
    const billableEnd = readValue(row, 'explanation_of_benefit_billable_end');
    const created = readValue(row, 'explanation_of_benefit_created');
    const entererId = readValue(row, 'explanation_of_benefit_enterer_id');
    const insurerId = readValue(row, 'explanation_of_benefit_insurer_id');
    const providerId = readValue(row, 'explanation_of_benefit_provider_id');
    const priority = readValue(row, 'explanation_of_benefit_priority');
    const claimId = readValue(row, 'explanation_of_benefit_claim_id');
    const claimResponseId = readValue(row, 'explanation_of_benefit_claim_response_id');
    const outcome = readValue(row, 'explanation_of_benefit_outcome');
    const disposition = readValue(row, 'explanation_of_benefit_disposition');
    const preAuthRef = readValue(row, 'explanation_of_benefit_pre_auth_ref');
    const totalValue = readNumber(row, 'explanation_of_benefit_total_value');
    const totalCurrency = readValue(row, 'explanation_of_benefit_total_currency');

    const itemSequence = readNumber(row, 'explanation_of_benefit_item_sequence');
    const itemProduct = readValue(row, 'explanation_of_benefit_item_product_or_service');
    const itemQuantity = readNumber(row, 'explanation_of_benefit_item_quantity');
    const itemUnitPrice = readNumber(row, 'explanation_of_benefit_item_unit_price');
    const itemNet = readNumber(row, 'explanation_of_benefit_item_net');

    return {
      id: eobId || undefined,
      identifier: eobId ? [{ value: eobId }] : undefined,
      status: status || undefined,
      type: type ? { code: type, display: type } : undefined,
      subType: readValue(row, 'explanation_of_benefit_sub_type') ? {
        code: readValue(row, 'explanation_of_benefit_sub_type'),
        display: readValue(row, 'explanation_of_benefit_sub_type')
      } : undefined,
      use: use || undefined,
      patient: patientId || undefined,
      billablePeriod: (billableStart || billableEnd) ? { start: billableStart, end: billableEnd } : undefined,
      created: created || undefined,
      enterer: entererId || undefined,
      insurer: insurerId || undefined,
      provider: providerId || undefined,
      priority: priority ? { code: priority, display: priority } : undefined,
      claim: claimId || undefined,
      claimResponse: claimResponseId || undefined,
      outcome: outcome || undefined,
      disposition: disposition || undefined,
      preAuthRef: preAuthRef ? [preAuthRef] : undefined,
      item: (itemSequence !== undefined || itemProduct || itemQuantity !== undefined || itemUnitPrice !== undefined || itemNet !== undefined) ? [{
        sequence: itemSequence,
        productOrService: itemProduct ? { code: itemProduct, display: itemProduct } : undefined,
        quantity: itemQuantity !== undefined ? { value: itemQuantity } : undefined,
        unitPrice: itemUnitPrice !== undefined ? { value: itemUnitPrice } : undefined,
        net: itemNet !== undefined ? { value: itemNet } : undefined
      }] : undefined,
      total: (totalValue !== undefined || totalCurrency) ? [{
        amount: {
          value: totalValue,
          currency: totalCurrency
        }
      }] : undefined
    };
  }).filter(Boolean);
  if (explanationOfBenefits.length > 0) canonical.explanationOfBenefits = explanationOfBenefits as any[];

  const compositions = rows.map(row => {
    const compositionId = readValue(row, 'composition_id');
    const status = readValue(row, 'composition_status');
    const type = readValue(row, 'composition_type');
    const title = readValue(row, 'composition_title');
    if (!compositionId && !status && !type && !title) return null;

    const subjectId = readValue(row, 'composition_subject_id');
    const encounterId = readValue(row, 'composition_encounter_id');
    const authorId = readValue(row, 'composition_author_id');
    const date = readValue(row, 'composition_date');
    const url = readValue(row, 'composition_url');
    const version = readValue(row, 'composition_version');

    return {
      id: compositionId || undefined,
      identifier: compositionId ? [{ value: compositionId }] : undefined,
      status: status || undefined,
      type: type ? { code: type, display: type } : undefined,
      title: title || undefined,
      subject: subjectId ? [subjectId] : undefined,
      encounter: encounterId || undefined,
      author: authorId ? [authorId] : undefined,
      date: date || undefined,
      url: url || undefined,
      version: version || undefined
    };
  }).filter(Boolean);
  if (compositions.length > 0) canonical.compositions = compositions as any[];

  const accounts = rows.map(row => {
    const accountId = readValue(row, 'account_id');
    const status = readValue(row, 'account_status');
    const name = readValue(row, 'account_name');
    const subjectIds = splitValues(readValue(row, 'account_subject_ids'));
    if (!accountId && !status && !name && (!subjectIds || subjectIds.length === 0)) return null;

    const billingStatus = readValue(row, 'account_billing_status');
    const type = readValue(row, 'account_type');
    const servicePeriodStart = readValue(row, 'account_service_period_start');
    const servicePeriodEnd = readValue(row, 'account_service_period_end');
    const coverageId = readValue(row, 'account_coverage_id');
    const coveragePriority = readNumber(row, 'account_coverage_priority');
    const ownerId = readValue(row, 'account_owner_id');
    const description = readValue(row, 'account_description');
    const guarantorPartyId = readValue(row, 'account_guarantor_party_id');
    const guarantorOnHold = readBoolean(row, 'account_guarantor_on_hold');
    const guarantorPeriodStart = readValue(row, 'account_guarantor_period_start');
    const guarantorPeriodEnd = readValue(row, 'account_guarantor_period_end');
    const currency = readValue(row, 'account_currency');
    const balanceAmount = readNumber(row, 'account_balance_amount');
    const balanceCurrency = readValue(row, 'account_balance_currency');
    const calculatedAt = readValue(row, 'account_calculated_at');
    const relatedAccountId = readValue(row, 'account_related_account_id');
    const relatedAccountRelationship = readValue(row, 'account_related_account_relationship');
    const diagnosisConditionId = readValue(row, 'account_diagnosis_condition_id');
    const diagnosisSequence = readNumber(row, 'account_diagnosis_sequence');
    const diagnosisDate = readValue(row, 'account_diagnosis_date');
    const procedureCode = readValue(row, 'account_procedure_code');
    const procedureSequence = readNumber(row, 'account_procedure_sequence');
    const procedureDate = readValue(row, 'account_procedure_date');

    return {
      id: accountId || undefined,
      identifier: accountId ? [{ value: accountId }] : undefined,
      status: status || undefined,
      billingStatus: billingStatus ? { code: billingStatus, display: billingStatus } : undefined,
      type: type ? { code: type, display: type } : undefined,
      name: name || undefined,
      subject: subjectIds?.length ? subjectIds : undefined,
      servicePeriod: (servicePeriodStart || servicePeriodEnd) ? { start: servicePeriodStart, end: servicePeriodEnd } : undefined,
      coverage: (coverageId || coveragePriority !== undefined) ? [{
        coverage: coverageId || undefined,
        priority: coveragePriority ?? undefined
      }] : undefined,
      owner: ownerId || undefined,
      description: description || undefined,
      guarantor: (guarantorPartyId || guarantorOnHold !== undefined || guarantorPeriodStart || guarantorPeriodEnd) ? [{
        party: guarantorPartyId || undefined,
        onHold: guarantorOnHold,
        period: (guarantorPeriodStart || guarantorPeriodEnd) ? { start: guarantorPeriodStart, end: guarantorPeriodEnd } : undefined
      }] : undefined,
      diagnosis: (diagnosisConditionId || diagnosisSequence !== undefined || diagnosisDate) ? [{
        sequence: diagnosisSequence ?? undefined,
        condition: diagnosisConditionId ? { reference: diagnosisConditionId } : undefined,
        dateOfDiagnosis: diagnosisDate || undefined
      }] : undefined,
      procedure: (procedureCode || procedureSequence !== undefined || procedureDate) ? [{
        sequence: procedureSequence ?? undefined,
        code: procedureCode ? { code: { code: procedureCode, display: procedureCode } } : undefined,
        dateOfService: procedureDate || undefined
      }] : undefined,
      relatedAccount: (relatedAccountId || relatedAccountRelationship) ? [{
        account: relatedAccountId || undefined,
        relationship: relatedAccountRelationship ? { code: relatedAccountRelationship, display: relatedAccountRelationship } : undefined
      }] : undefined,
      currency: currency ? { code: currency, display: currency } : undefined,
      balance: (balanceAmount !== undefined || balanceCurrency) ? [{
        amount: { value: balanceAmount ?? undefined, currency: balanceCurrency || undefined }
      }] : undefined,
      calculatedAt: calculatedAt || undefined
    };
  }).filter(Boolean);
  if (accounts.length > 0) canonical.accounts = accounts as any[];

  const chargeItems = rows.map(row => {
    const chargeItemId = readValue(row, 'charge_item_id');
    const status = readValue(row, 'charge_item_status');
    const code = readValue(row, 'charge_item_code');
    const subjectId = readValue(row, 'charge_item_subject_id');
    if (!chargeItemId && !status && !code && !subjectId) return null;

    const encounterId = readValue(row, 'charge_item_encounter_id');
    const occurrenceDateTime = readValue(row, 'charge_item_occurrence_date_time');
    const occurrenceStart = readValue(row, 'charge_item_occurrence_start');
    const occurrenceEnd = readValue(row, 'charge_item_occurrence_end');
    const quantityValue = readNumber(row, 'charge_item_quantity_value');
    const quantityUnit = readValue(row, 'charge_item_quantity_unit');
    const entererId = readValue(row, 'charge_item_enterer_id');
    const enteredDate = readValue(row, 'charge_item_entered_date');
    const accountId = readValue(row, 'charge_item_account_id');
    const totalPriceValue = readNumber(row, 'charge_item_total_price_value');
    const totalPriceCurrency = readValue(row, 'charge_item_total_price_currency');

    return {
      id: chargeItemId || undefined,
      identifier: chargeItemId ? [{ value: chargeItemId }] : undefined,
      status: status || undefined,
      code: code ? { code: code, display: code } : undefined,
      subject: subjectId || undefined,
      encounter: encounterId || undefined,
      occurrenceDateTime: occurrenceDateTime || undefined,
      occurrencePeriod: (occurrenceStart || occurrenceEnd) ? { start: occurrenceStart, end: occurrenceEnd } : undefined,
      quantity: (quantityValue !== undefined || quantityUnit) ? { value: quantityValue, unit: quantityUnit || undefined } : undefined,
      enterer: entererId || undefined,
      enteredDate: enteredDate || undefined,
      account: accountId ? [accountId] : undefined,
      totalPriceComponent: (totalPriceValue !== undefined || totalPriceCurrency) ? {
        amount: { value: totalPriceValue ?? undefined, currency: totalPriceCurrency || undefined }
      } : undefined
    };
  }).filter(Boolean);
  if (chargeItems.length > 0) canonical.chargeItems = chargeItems as any[];

  const chargeItemDefinitions = rows.map(row => {
    const definitionId = readValue(row, 'charge_item_definition_id');
    const status = readValue(row, 'charge_item_definition_status');
    const code = readValue(row, 'charge_item_definition_code');
    const url = readValue(row, 'charge_item_definition_url');
    if (!definitionId && !status && !code && !url) return null;

    const version = readValue(row, 'charge_item_definition_version');
    const name = readValue(row, 'charge_item_definition_name');
    const title = readValue(row, 'charge_item_definition_title');
    const publisher = readValue(row, 'charge_item_definition_publisher');
    const date = readValue(row, 'charge_item_definition_date');

    return {
      id: definitionId || undefined,
      identifier: definitionId ? [{ value: definitionId }] : undefined,
      url: url || undefined,
      version: version || undefined,
      status: status || undefined,
      code: code ? { code: code, display: code } : undefined,
      name: name || undefined,
      title: title || undefined,
      publisher: publisher || undefined,
      date: date || undefined
    };
  }).filter(Boolean);
  if (chargeItemDefinitions.length > 0) canonical.chargeItemDefinitions = chargeItemDefinitions as any[];

  const devices = rows.map(row => {
    const deviceId = readValue(row, 'device_id');
    const status = readValue(row, 'device_status');
    const displayName = readValue(row, 'device_display_name');
    if (!deviceId && !status && !displayName) return null;

    const manufacturer = readValue(row, 'device_manufacturer');
    const modelNumber = readValue(row, 'device_model_number');
    const serialNumber = readValue(row, 'device_serial_number');
    const lotNumber = readValue(row, 'device_lot_number');
    const ownerId = readValue(row, 'device_owner_id');
    const locationId = readValue(row, 'device_location_id');

    return {
      id: deviceId || undefined,
      identifier: deviceId ? [{ value: deviceId }] : undefined,
      status: status || undefined,
      displayName: displayName || undefined,
      manufacturer: manufacturer || undefined,
      modelNumber: modelNumber || undefined,
      serialNumber: serialNumber || undefined,
      lotNumber: lotNumber || undefined,
      owner: ownerId || undefined,
      location: locationId || undefined
    };
  }).filter(Boolean);
  if (devices.length > 0) canonical.devices = devices as any[];

  const deviceMetrics = rows.map(row => {
    const metricId = readValue(row, 'device_metric_id');
    const status = readValue(row, 'device_metric_status');
    const type = readValue(row, 'device_metric_type');
    const deviceId = readValue(row, 'device_metric_device_id');
    if (!metricId && !status && !type && !deviceId) return null;

    const unit = readValue(row, 'device_metric_unit');
    const operationalStatus = readValue(row, 'device_metric_operational_status');
    const color = readValue(row, 'device_metric_color');
    const category = readValue(row, 'device_metric_category');
    const frequencyValue = readNumber(row, 'device_metric_frequency_value');
    const frequencyUnit = readValue(row, 'device_metric_frequency_unit');

    return {
      id: metricId || undefined,
      identifier: metricId ? [{ value: metricId }] : undefined,
      type: type ? { code: type, display: type } : undefined,
      unit: unit ? { code: unit, display: unit } : undefined,
      device: deviceId || undefined,
      operationalStatus: operationalStatus || undefined,
      color: color || undefined,
      category: category || undefined,
      measurementFrequency: (frequencyValue !== undefined || frequencyUnit)
        ? { value: frequencyValue, unit: frequencyUnit || undefined }
        : undefined
    };
  }).filter(Boolean);
  if (deviceMetrics.length > 0) canonical.deviceMetrics = deviceMetrics as any[];

  const endpoints = rows.map(row => {
    const endpointId = readValue(row, 'endpoint_id');
    const status = readValue(row, 'endpoint_status');
    const address = readValue(row, 'endpoint_address');
    if (!endpointId && !status && !address) return null;

    const name = readValue(row, 'endpoint_name');
    const description = readValue(row, 'endpoint_description');
    const managingOrganizationId = readValue(row, 'endpoint_managing_organization_id');
    const connectionType = readValue(row, 'endpoint_connection_type');
    const environmentType = readValue(row, 'endpoint_environment_type');

    return {
      id: endpointId || undefined,
      identifier: endpointId ? [{ value: endpointId }] : undefined,
      status: status || undefined,
      name: name || undefined,
      description: description || undefined,
      address: address || undefined,
      managingOrganization: managingOrganizationId || undefined,
      connectionType: connectionType ? [{ code: connectionType, display: connectionType }] : undefined,
      environmentType: environmentType ? [{ code: environmentType, display: environmentType }] : undefined
    };
  }).filter(Boolean);
  if (endpoints.length > 0) canonical.endpoints = endpoints as any[];

  const coverages = rows.map(row => {
    const coverageId = readValue(row, 'coverage_id');
    const status = readValue(row, 'coverage_status');
    const kind = readValue(row, 'coverage_kind');
    const type = readValue(row, 'coverage_type');
    const beneficiaryId = readValue(row, 'coverage_beneficiary_id');
    if (!coverageId && !status && !kind && !type && !beneficiaryId) return null;

    const policyHolderId = readValue(row, 'coverage_policy_holder_id');
    const subscriberId = readValue(row, 'coverage_subscriber_id');
    const dependent = readValue(row, 'coverage_dependent');
    const relationship = readValue(row, 'coverage_relationship');
    const periodStart = readValue(row, 'coverage_period_start');
    const periodEnd = readValue(row, 'coverage_period_end');
    const insurerId = readValue(row, 'coverage_insurer_id');
    const classType = readValue(row, 'coverage_class_type');
    const classValue = readValue(row, 'coverage_class_value');
    const className = readValue(row, 'coverage_class_name');
    const order = readNumber(row, 'coverage_order');
    const network = readValue(row, 'coverage_network');
    const paymentPartyId = readValue(row, 'coverage_payment_party_id');
    const paymentResponsibility = readValue(row, 'coverage_payment_responsibility');
    const costType = readValue(row, 'coverage_cost_type');
    const costCategory = readValue(row, 'coverage_cost_category');
    const costNetwork = readValue(row, 'coverage_cost_network');
    const costUnit = readValue(row, 'coverage_cost_unit');
    const costTerm = readValue(row, 'coverage_cost_term');
    const costValueQuantity = readNumber(row, 'coverage_cost_value_quantity');
    const costValueUnit = readValue(row, 'coverage_cost_value_unit');
    const costValueMoney = readNumber(row, 'coverage_cost_value_money');
    const costCurrency = readValue(row, 'coverage_cost_currency');
    const costExceptionType = readValue(row, 'coverage_cost_exception_type');
    const costExceptionStart = readValue(row, 'coverage_cost_exception_start');
    const costExceptionEnd = readValue(row, 'coverage_cost_exception_end');
    const subrogation = readBoolean(row, 'coverage_subrogation');
    const contractId = readValue(row, 'coverage_contract_id');
    const insurancePlanId = readValue(row, 'coverage_insurance_plan_id');

    return {
      id: coverageId || undefined,
      identifier: coverageId ? [{ value: coverageId }] : undefined,
      status: status || undefined,
      kind: kind || undefined,
      type: type ? { code: type, display: type } : undefined,
      policyHolder: policyHolderId || undefined,
      subscriber: subscriberId || undefined,
      beneficiary: beneficiaryId || undefined,
      dependent: dependent || undefined,
      relationship: relationship ? { code: relationship, display: relationship } : undefined,
      period: (periodStart || periodEnd) ? { start: periodStart, end: periodEnd } : undefined,
      insurer: insurerId || undefined,
      class: (classType || classValue || className) ? [{
        type: classType ? { code: classType, display: classType } : undefined,
        value: classValue ? { value: classValue } : undefined,
        name: className || undefined
      }] : undefined,
      order: order ?? undefined,
      network: network || undefined,
      paymentBy: (paymentPartyId || paymentResponsibility) ? [{
        party: paymentPartyId || undefined,
        responsibility: paymentResponsibility || undefined
      }] : undefined,
      costToBeneficiary: (costType || costCategory || costNetwork || costUnit || costTerm || costValueQuantity !== undefined || costValueMoney !== undefined || costCurrency || costExceptionType || costExceptionStart || costExceptionEnd) ? [{
        type: costType ? { code: costType, display: costType } : undefined,
        category: costCategory ? { code: costCategory, display: costCategory } : undefined,
        network: costNetwork ? { code: costNetwork, display: costNetwork } : undefined,
        unit: costUnit ? { code: costUnit, display: costUnit } : undefined,
        term: costTerm ? { code: costTerm, display: costTerm } : undefined,
        valueQuantity: (costValueQuantity !== undefined || costValueUnit) ? { value: costValueQuantity, unit: costValueUnit || undefined } : undefined,
        valueMoney: (costValueMoney !== undefined || costCurrency) ? { value: costValueMoney, currency: costCurrency || undefined } : undefined,
        exception: (costExceptionType || costExceptionStart || costExceptionEnd) ? [{
          type: costExceptionType ? { code: costExceptionType, display: costExceptionType } : undefined,
          period: (costExceptionStart || costExceptionEnd) ? { start: costExceptionStart, end: costExceptionEnd } : undefined
        }] : undefined
      }] : undefined,
      subrogation,
      contract: contractId ? [contractId] : undefined,
      insurancePlan: insurancePlanId || undefined
    };
  }).filter(Boolean);
  if (coverages.length > 0) canonical.coverages = coverages as any[];

  const schedules = rows.map(row => {
    const scheduleId = readValue(row, 'schedule_id');
    const name = readValue(row, 'schedule_name');
    const start = readValue(row, 'schedule_start');
    const end = readValue(row, 'schedule_end');
    if (!scheduleId && !name && !start && !end) return null;

    const actorId = readValue(row, 'schedule_actor_id');
    const active = readBoolean(row, 'schedule_active');

    return {
      id: scheduleId || undefined,
      identifier: scheduleId || undefined,
      active: active,
      name: name,
      actor: actorId ? [actorId] : undefined,
      planningHorizon: (start || end) ? {
        start: start,
        end: end
      } : undefined,
      comment: readValue(row, 'schedule_comment'),
      serviceCategory: readValue(row, 'schedule_service_category') ? [{
        code: readValue(row, 'schedule_service_category'),
        display: readValue(row, 'schedule_service_category')
      }] : undefined,
      serviceType: readValue(row, 'schedule_service_type') ? [{
        code: readValue(row, 'schedule_service_type'),
        display: readValue(row, 'schedule_service_type')
      }] : undefined,
      specialty: readValue(row, 'schedule_specialty') ? [{
        code: readValue(row, 'schedule_specialty'),
        display: readValue(row, 'schedule_specialty')
      }] : undefined
    };
  }).filter(Boolean);
  if (schedules.length > 0) canonical.schedules = schedules as any[];

  const slots = rows.map(row => {
    const slotId = readValue(row, 'slot_id');
    const start = readValue(row, 'slot_start');
    const end = readValue(row, 'slot_end');
    if (!slotId && !start && !end) return null;

    return {
      id: slotId || undefined,
      identifier: slotId || undefined,
      schedule: readValue(row, 'slot_schedule_id'),
      status: readValue(row, 'slot_status') || 'free',
      start: start,
      end: end,
      overbooked: readBoolean(row, 'slot_overbooked'),
      comment: readValue(row, 'slot_comment'),
      serviceCategory: readValue(row, 'slot_service_category') ? [{
        code: readValue(row, 'slot_service_category'),
        display: readValue(row, 'slot_service_category')
      }] : undefined,
      serviceType: readValue(row, 'slot_service_type') ? [{
        code: readValue(row, 'slot_service_type'),
        display: readValue(row, 'slot_service_type')
      }] : undefined,
      specialty: readValue(row, 'slot_specialty') ? [{
        code: readValue(row, 'slot_specialty'),
        display: readValue(row, 'slot_specialty')
      }] : undefined,
      appointmentType: readValue(row, 'slot_appointment_type') ? [{
        code: readValue(row, 'slot_appointment_type'),
        display: readValue(row, 'slot_appointment_type')
      }] : undefined
    };
  }).filter(Boolean);
  if (slots.length > 0) canonical.slots = slots as any[];

  const diagnosticReports = rows.map(row => {
    const reportId = readValue(row, 'diagnostic_report_id');
    const code = readValue(row, 'diagnostic_report_code');
    const display = readValue(row, 'diagnostic_report_display');
    const status = readValue(row, 'diagnostic_report_status');
    if (!reportId && !code && !display) return null;

    const effectiveStart = readValue(row, 'diagnostic_report_effective_start');
    const effectiveEnd = readValue(row, 'diagnostic_report_effective_end');
    const resultIds = readValue(row, 'diagnostic_report_result_ids');
    const performerId = readValue(row, 'diagnostic_report_performer_id');

    return {
      id: reportId || undefined,
      identifier: reportId || undefined,
      status: status || 'final',
      category: readValue(row, 'diagnostic_report_category') ? [{
        code: readValue(row, 'diagnostic_report_category'),
        display: readValue(row, 'diagnostic_report_category')
      }] : undefined,
      code: (code || display) ? {
        coding: code ? [{
          system: readValue(row, 'diagnostic_report_code_system'),
          code: code,
          display: display
        }] : undefined,
        text: display
      } : undefined,
      subject: readValue(row, 'diagnostic_report_subject_id'),
      encounter: readValue(row, 'diagnostic_report_encounter_id'),
      effectiveDateTime: readValue(row, 'diagnostic_report_effective_date'),
      effectivePeriod: (effectiveStart || effectiveEnd) ? {
        start: effectiveStart,
        end: effectiveEnd
      } : undefined,
      issued: readValue(row, 'diagnostic_report_issued'),
      performer: performerId ? [performerId] : undefined,
      result: resultIds ? resultIds.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      conclusion: readValue(row, 'diagnostic_report_conclusion'),
      note: readValue(row, 'diagnostic_report_note') ? [readValue(row, 'diagnostic_report_note') as string] : undefined
    };
  }).filter(Boolean);
  if (diagnosticReports.length > 0) canonical.diagnosticReports = diagnosticReports as any[];

  const relatedPersons = rows.map(row => {
    const rpId = readValue(row, 'related_person_id');
    const first = readValue(row, 'related_person_first_name');
    const last = readValue(row, 'related_person_last_name');
    if (!rpId && !first && !last) return null;

    const telecom: any[] = [];
    const phone = readValue(row, 'related_person_phone');
    const email = readValue(row, 'related_person_email');
    if (phone) telecom.push({ system: 'phone', value: phone });
    if (email) telecom.push({ system: 'email', value: email });

    const addressLine1 = readValue(row, 'related_person_address_line1');
    const addressLine2 = readValue(row, 'related_person_address_line2');
    const address = (addressLine1 || addressLine2 || readValue(row, 'related_person_city')) ? [{
      line: [addressLine1, addressLine2].filter(Boolean) as string[],
      city: readValue(row, 'related_person_city'),
      state: readValue(row, 'related_person_state'),
      postalCode: readValue(row, 'related_person_postal_code'),
      country: readValue(row, 'related_person_country')
    }] : undefined;

    return {
      id: rpId || undefined,
      identifier: rpId || undefined,
      active: readBoolean(row, 'related_person_active'),
      patient: readValue(row, 'related_person_patient_id'),
      relationship: readValue(row, 'related_person_relationship') ? [{
        code: readValue(row, 'related_person_relationship'),
        display: readValue(row, 'related_person_relationship')
      }] : undefined,
      name: (first || last) ? [{
        family: last,
        given: first ? [first] : undefined
      }] : undefined,
      telecom: telecom.length ? telecom : undefined,
      gender: readValue(row, 'related_person_gender'),
      birthDate: readValue(row, 'related_person_birth_date'),
      address
    };
  }).filter(Boolean);
  if (relatedPersons.length > 0) canonical.relatedPersons = relatedPersons as any[];

  const persons = rows.map(row => {
    const personId = readValue(row, 'person_id');
    const first = readValue(row, 'person_first_name');
    const last = readValue(row, 'person_last_name');
    if (!personId && !first && !last) return null;

    const telecom: any[] = [];
    const phone = readValue(row, 'person_phone');
    const email = readValue(row, 'person_email');
    if (phone) telecom.push({ system: 'phone', value: phone });
    if (email) telecom.push({ system: 'email', value: email });

    const addressLine1 = readValue(row, 'person_address_line1');
    const addressLine2 = readValue(row, 'person_address_line2');
    const address = (addressLine1 || addressLine2 || readValue(row, 'person_city')) ? [{
      line: [addressLine1, addressLine2].filter(Boolean) as string[],
      city: readValue(row, 'person_city'),
      state: readValue(row, 'person_state'),
      postalCode: readValue(row, 'person_postal_code'),
      country: readValue(row, 'person_country')
    }] : undefined;

    const language = readValue(row, 'person_language');
    const languagePreferred = readBoolean(row, 'person_language_preferred');

    return {
      id: personId || undefined,
      identifier: personId || undefined,
      active: readBoolean(row, 'person_active'),
      name: (first || last) ? {
        family: last,
        given: first ? [first] : undefined
      } : undefined,
      telecom: telecom.length ? telecom : undefined,
      gender: readValue(row, 'person_gender'),
      birthDate: readValue(row, 'person_birth_date'),
      deceasedBoolean: readBoolean(row, 'person_deceased'),
      deceasedDateTime: readValue(row, 'person_deceased_date'),
      address,
      maritalStatus: readValue(row, 'person_marital_status') ? {
        code: readValue(row, 'person_marital_status'),
        display: readValue(row, 'person_marital_status')
      } : undefined,
      communication: language ? [{
        language: { code: language, display: language },
        preferred: languagePreferred
      }] : undefined,
      managingOrganization: readValue(row, 'person_managing_organization_id'),
      link: readValue(row, 'person_link_target') ? [{
        target: readValue(row, 'person_link_target'),
        assurance: readValue(row, 'person_link_assurance')
      }] : undefined
    };
  }).filter(Boolean);
  if (persons.length > 0) canonical.persons = persons as any[];

  const locations = rows.map(row => {
    const locationId = readValue(row, 'location_id');
    const name = readValue(row, 'location_name');
    const status = readValue(row, 'location_status');
    const description = readValue(row, 'location_description');
    const mode = readValue(row, 'location_mode');
    const type = readValue(row, 'location_type');
    const aliasRaw = readValue(row, 'location_alias');
    const alias = aliasRaw ? aliasRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const addressLine1 = readValue(row, 'location_address_line1');
    const addressLine2 = readValue(row, 'location_address_line2');
    const address = (addressLine1 || addressLine2 || readValue(row, 'location_city')) ? {
      line: [addressLine1, addressLine2].filter(Boolean) as string[],
      city: readValue(row, 'location_city'),
      state: readValue(row, 'location_state'),
      postalCode: readValue(row, 'location_postal_code'),
      country: readValue(row, 'location_country')
    } : undefined;
    const managingOrganization = readValue(row, 'location_managing_org_id');
    const partOf = readValue(row, 'location_part_of_id');

    if (!locationId && !name && !status && !description && !mode && !type && !alias?.length && !address && !managingOrganization && !partOf) {
      return null;
    }

    return {
      id: locationId || undefined,
      identifier: locationId || undefined,
      status: status || undefined,
      name: name || undefined,
      alias: alias && alias.length ? alias : undefined,
      description: description || undefined,
      mode: mode || undefined,
      type: type ? [{
        code: type,
        display: type
      }] : undefined,
      address,
      managingOrganization: managingOrganization || undefined,
      partOf: partOf || undefined
    };
  }).filter(Boolean);
  if (locations.length > 0) canonical.locations = locations as any[];

  const episodesOfCare = rows.map(row => {
    const episodeId = readValue(row, 'episode_of_care_id');
    const status = readValue(row, 'episode_status');
    const type = readValue(row, 'episode_type');
    const patientId = readValue(row, 'episode_patient_id');
    const managingOrgId = readValue(row, 'episode_managing_org_id');
    const periodStart = readValue(row, 'episode_period_start');
    const periodEnd = readValue(row, 'episode_period_end');
    const careManagerId = readValue(row, 'episode_care_manager_id');
    const careTeamRaw = readValue(row, 'episode_care_team_ids');
    const accountRaw = readValue(row, 'episode_account_ids');
    const referralRaw = readValue(row, 'episode_referral_request_ids');
    const reasonRaw = readValue(row, 'episode_reason');
    const diagnosisRaw = readValue(row, 'episode_diagnosis');
    const statusHistoryStatus = readValue(row, 'episode_status_history_status');
    const statusHistoryStart = readValue(row, 'episode_status_history_start');
    const statusHistoryEnd = readValue(row, 'episode_status_history_end');

    if (!episodeId && !status && !type && !patientId && !periodStart && !periodEnd) return null;

    const statusHistory = (statusHistoryStatus || statusHistoryStart || statusHistoryEnd) ? [{
      status: statusHistoryStatus,
      period: (statusHistoryStart || statusHistoryEnd) ? {
        start: statusHistoryStart,
        end: statusHistoryEnd
      } : undefined
    }] : undefined;

    return {
      id: episodeId || undefined,
      identifier: episodeId || undefined,
      status: status || undefined,
      type: type ? [{
        code: type,
        display: type
      }] : undefined,
      reason: reasonRaw ? [{
        code: { display: reasonRaw }
      }] : undefined,
      diagnosis: diagnosisRaw ? [{
        condition: { display: diagnosisRaw }
      }] : undefined,
      patient: patientId || undefined,
      managingOrganization: managingOrgId || undefined,
      period: (periodStart || periodEnd) ? { start: periodStart, end: periodEnd } : undefined,
      referralRequest: referralRaw ? referralRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      careManager: careManagerId || undefined,
      careTeam: careTeamRaw ? careTeamRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      account: accountRaw ? accountRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      statusHistory
    };
  }).filter(Boolean);
  if (episodesOfCare.length > 0) canonical.episodesOfCare = episodesOfCare as any[];

  const specimens = rows.map(row => {
    const specimenId = readValue(row, 'specimen_id');
    const accessionIdentifier = readValue(row, 'specimen_accession_identifier');
    const status = readValue(row, 'specimen_status');
    const type = readValue(row, 'specimen_type');
    const subjectId = readValue(row, 'specimen_subject_id');
    const receivedTime = readValue(row, 'specimen_received_time');
    const parentIds = readValue(row, 'specimen_parent_ids');
    const requestIds = readValue(row, 'specimen_request_ids');
    const combined = readValue(row, 'specimen_combined');
    const role = readValue(row, 'specimen_role');
    const featureType = readValue(row, 'specimen_feature_type');
    const featureDescription = readValue(row, 'specimen_feature_description');
    const collectorId = readValue(row, 'specimen_collection_collector_id');
    const collectedDate = readValue(row, 'specimen_collection_collected_date');
    const collectedStart = readValue(row, 'specimen_collection_collected_start');
    const collectedEnd = readValue(row, 'specimen_collection_collected_end');
    const durationValue = readNumber(row, 'specimen_collection_duration_value');
    const durationUnit = readValue(row, 'specimen_collection_duration_unit');
    const quantityValue = readNumber(row, 'specimen_collection_quantity_value');
    const quantityUnit = readValue(row, 'specimen_collection_quantity_unit');
    const method = readValue(row, 'specimen_collection_method');
    const deviceId = readValue(row, 'specimen_collection_device_id');
    const procedureId = readValue(row, 'specimen_collection_procedure_id');
    const bodySite = readValue(row, 'specimen_collection_body_site');
    const fastingStatus = readValue(row, 'specimen_collection_fasting_status');
    const fastingDurationValue = readNumber(row, 'specimen_collection_fasting_duration_value');
    const fastingDurationUnit = readValue(row, 'specimen_collection_fasting_duration_unit');
    const processingDescription = readValue(row, 'specimen_processing_description');
    const processingMethod = readValue(row, 'specimen_processing_method');
    const processingAdditiveIds = readValue(row, 'specimen_processing_additive_ids');
    const processingTimeDate = readValue(row, 'specimen_processing_time_date');
    const processingTimeStart = readValue(row, 'specimen_processing_time_start');
    const processingTimeEnd = readValue(row, 'specimen_processing_time_end');
    const containerDeviceId = readValue(row, 'specimen_container_device_id');
    const containerLocationId = readValue(row, 'specimen_container_location_id');
    const containerQuantityValue = readNumber(row, 'specimen_container_quantity_value');
    const containerQuantityUnit = readValue(row, 'specimen_container_quantity_unit');
    const condition = readValue(row, 'specimen_condition');
    const note = readValue(row, 'specimen_note');

    if (!specimenId && !accessionIdentifier && !type && !subjectId && !receivedTime) return null;

    const collectionPeriod = collectedStart || collectedEnd ? { start: collectedStart, end: collectedEnd } : undefined;
    const processingPeriod = processingTimeStart || processingTimeEnd ? { start: processingTimeStart, end: processingTimeEnd } : undefined;

    return {
      id: specimenId || undefined,
      identifier: specimenId || undefined,
      accessionIdentifier: accessionIdentifier || undefined,
      status: status || undefined,
      type: type ? { code: type, display: type } : undefined,
      subject: subjectId || undefined,
      receivedTime: receivedTime || undefined,
      parent: parentIds ? parentIds.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      request: requestIds ? requestIds.split(',').map(value => value.trim()).filter(Boolean) : undefined,
      combined: combined || undefined,
      role: role ? [{ code: role, display: role }] : undefined,
      feature: featureType || featureDescription ? [{
        type: featureType ? { code: featureType, display: featureType } : undefined,
        description: featureDescription
      }] : undefined,
      collection: (collectorId || collectedDate || collectionPeriod || method || quantityValue !== undefined) ? {
        collector: collectorId || undefined,
        collectedDateTime: collectedDate || undefined,
        collectedPeriod: collectionPeriod,
        duration: durationValue !== undefined ? { value: durationValue, unit: durationUnit } : undefined,
        quantity: quantityValue !== undefined ? { value: quantityValue, unit: quantityUnit } : undefined,
        method: method ? { code: method, display: method } : undefined,
        device: deviceId || undefined,
        procedure: procedureId || undefined,
        bodySite: bodySite ? { display: bodySite } : undefined,
        fastingStatusCodeableConcept: fastingStatus ? { display: fastingStatus } : undefined,
        fastingStatusDuration: fastingDurationValue !== undefined ? { value: fastingDurationValue, unit: fastingDurationUnit } : undefined
      } : undefined,
      processing: (processingDescription || processingMethod || processingAdditiveIds || processingTimeDate || processingPeriod) ? [{
        description: processingDescription,
        method: processingMethod ? { code: processingMethod, display: processingMethod } : undefined,
        additive: processingAdditiveIds ? processingAdditiveIds.split(',').map(value => value.trim()).filter(Boolean) : undefined,
        timeDateTime: processingTimeDate,
        timePeriod: processingPeriod
      }] : undefined,
      container: (containerDeviceId || containerLocationId || containerQuantityValue !== undefined) ? [{
        device: containerDeviceId || undefined,
        location: containerLocationId || undefined,
        specimenQuantity: containerQuantityValue !== undefined ? { value: containerQuantityValue, unit: containerQuantityUnit } : undefined
      }] : undefined,
      condition: condition ? [{ display: condition }] : undefined,
      note: note ? [note] : undefined
    };
  }).filter(Boolean);
  if (specimens.length > 0) canonical.specimens = specimens as any[];

  const imagingStudies = rows.map(row => {
    const studyId = readValue(row, 'imaging_study_id');
    const identifier = readValue(row, 'imaging_study_identifier');
    const status = readValue(row, 'imaging_study_status');
    const modality = readValue(row, 'imaging_study_modality');
    const subjectId = readValue(row, 'imaging_study_subject_id');
    const encounterId = readValue(row, 'imaging_study_encounter_id');
    const started = readValue(row, 'imaging_study_started');
    const basedOnRaw = readValue(row, 'imaging_study_based_on_ids');
    const partOfRaw = readValue(row, 'imaging_study_part_of_ids');
    const referrerId = readValue(row, 'imaging_study_referrer_id');
    const endpointRaw = readValue(row, 'imaging_study_endpoint_ids');
    const numberOfSeries = readNumber(row, 'imaging_study_number_of_series');
    const numberOfInstances = readNumber(row, 'imaging_study_number_of_instances');
    const procedureRaw = readValue(row, 'imaging_study_procedure');
    const locationId = readValue(row, 'imaging_study_location_id');
    const reasonRaw = readValue(row, 'imaging_study_reason');
    const note = readValue(row, 'imaging_study_note');
    const description = readValue(row, 'imaging_study_description');

    const seriesUid = readValue(row, 'imaging_series_uid');
    const seriesNumber = readNumber(row, 'imaging_series_number');
    const seriesModality = readValue(row, 'imaging_series_modality');
    const seriesDescription = readValue(row, 'imaging_series_description');
    const seriesInstances = readNumber(row, 'imaging_series_number_of_instances');
    const seriesEndpointRaw = readValue(row, 'imaging_series_endpoint_ids');
    const seriesBodySite = readValue(row, 'imaging_series_body_site');
    const seriesLaterality = readValue(row, 'imaging_series_laterality');
    const seriesSpecimenRaw = readValue(row, 'imaging_series_specimen_ids');
    const seriesStarted = readValue(row, 'imaging_series_started');
    const seriesPerformerId = readValue(row, 'imaging_series_performer_id');
    const instanceUid = readValue(row, 'imaging_instance_uid');
    const instanceSopClass = readValue(row, 'imaging_instance_sop_class');
    const instanceNumber = readNumber(row, 'imaging_instance_number');
    const instanceTitle = readValue(row, 'imaging_instance_title');

    if (!studyId && !identifier && !status && !modality && !started) return null;

    const basedOnIds = basedOnRaw ? basedOnRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const partOfIds = partOfRaw ? partOfRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const endpointIds = endpointRaw ? endpointRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const procedures = procedureRaw ? procedureRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const reasons = reasonRaw ? reasonRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const seriesEndpoints = seriesEndpointRaw ? seriesEndpointRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const seriesSpecimens = seriesSpecimenRaw ? seriesSpecimenRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;

    const series = (seriesUid || seriesNumber !== undefined || seriesModality || seriesDescription)
      ? [{
        uid: seriesUid || undefined,
        number: seriesNumber !== undefined ? seriesNumber : undefined,
        modality: seriesModality ? { code: seriesModality, display: seriesModality } : undefined,
        description: seriesDescription,
        numberOfInstances: seriesInstances !== undefined ? seriesInstances : undefined,
        endpoint: seriesEndpoints,
        bodySite: seriesBodySite ? { display: seriesBodySite } : undefined,
        laterality: seriesLaterality ? { display: seriesLaterality } : undefined,
        specimen: seriesSpecimens,
        started: seriesStarted,
        performer: seriesPerformerId ? [{ actor: seriesPerformerId }] : undefined,
        instance: (instanceUid || instanceSopClass || instanceNumber !== undefined || instanceTitle) ? [{
          uid: instanceUid || undefined,
          sopClass: instanceSopClass ? { code: instanceSopClass, display: instanceSopClass } : undefined,
          number: instanceNumber !== undefined ? instanceNumber : undefined,
          title: instanceTitle
        }] : undefined
      }] : undefined;

    return {
      id: studyId || undefined,
      identifier: identifier || studyId || undefined,
      status: status || undefined,
      modality: modality ? [{ code: modality, display: modality }] : undefined,
      subject: subjectId || undefined,
      encounter: encounterId || undefined,
      started: started || undefined,
      basedOn: basedOnIds,
      partOf: partOfIds,
      referrer: referrerId || undefined,
      endpoint: endpointIds,
      numberOfSeries,
      numberOfInstances,
      procedure: procedures ? procedures.map(value => ({ code: value, display: value })) : undefined,
      location: locationId || undefined,
      reason: reasons ? reasons.map(value => ({ code: { display: value } })) : undefined,
      note: note ? [note] : undefined,
      description: description || undefined,
      series
    };
  }).filter(Boolean);
  if (imagingStudies.length > 0) canonical.imagingStudies = imagingStudies as any[];

  const allergyIntolerances = rows.map(row => {
    const allergyId = readValue(row, 'allergy_id');
    const clinicalStatus = readValue(row, 'allergy_clinical_status');
    const verificationStatus = readValue(row, 'allergy_verification_status');
    const type = readValue(row, 'allergy_type');
    const categoryRaw = readValue(row, 'allergy_category');
    const criticality = readValue(row, 'allergy_criticality');
    const code = readValue(row, 'allergy_code');
    const codeSystem = readValue(row, 'allergy_code_system');
    const display = readValue(row, 'allergy_display');
    const patientId = readValue(row, 'allergy_patient_id');
    const encounterId = readValue(row, 'allergy_encounter_id');
    const onsetDate = readValue(row, 'allergy_onset_date');
    const onsetStart = readValue(row, 'allergy_onset_start');
    const onsetEnd = readValue(row, 'allergy_onset_end');
    const onsetText = readValue(row, 'allergy_onset_text');
    const recordedDate = readValue(row, 'allergy_recorded_date');
    const participantActorId = readValue(row, 'allergy_participant_actor_id');
    const participantFunction = readValue(row, 'allergy_participant_function');
    const lastOccurrence = readValue(row, 'allergy_last_occurrence');
    const note = readValue(row, 'allergy_note');
    const reactionSubstance = readValue(row, 'allergy_reaction_substance');
    const reactionManifestation = readValue(row, 'allergy_reaction_manifestation');
    const reactionDescription = readValue(row, 'allergy_reaction_description');
    const reactionOnset = readValue(row, 'allergy_reaction_onset');
    const reactionSeverity = readValue(row, 'allergy_reaction_severity');
    const reactionExposureRoute = readValue(row, 'allergy_reaction_exposure_route');
    const reactionNote = readValue(row, 'allergy_reaction_note');

    if (!allergyId && !code && !display && !reactionSubstance) return null;

    const onsetPeriod = onsetStart || onsetEnd ? { start: onsetStart, end: onsetEnd } : undefined;
    const categories = categoryRaw ? categoryRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;

    return {
      id: allergyId || undefined,
      identifier: allergyId || undefined,
      clinicalStatus: clinicalStatus ? { code: clinicalStatus, display: clinicalStatus } : undefined,
      verificationStatus: verificationStatus ? { code: verificationStatus, display: verificationStatus } : undefined,
      type: type ? { code: type, display: type } : undefined,
      category: categories && categories.length ? categories : undefined,
      criticality: criticality || undefined,
      code: (code || display) ? {
        system: codeSystem,
        code: code,
        display: display
      } : undefined,
      patient: patientId || undefined,
      encounter: encounterId || undefined,
      onsetDateTime: onsetDate || undefined,
      onsetPeriod,
      onsetString: onsetText || undefined,
      recordedDate: recordedDate || undefined,
      participant: (participantActorId || participantFunction) ? [{
        function: participantFunction ? { code: participantFunction, display: participantFunction } : undefined,
        actor: participantActorId || undefined
      }] : undefined,
      lastOccurrence: lastOccurrence || undefined,
      note: note ? [note] : undefined,
      reaction: (reactionSubstance || reactionManifestation || reactionDescription) ? [{
        substance: reactionSubstance ? { code: reactionSubstance, display: reactionSubstance } : undefined,
        manifestation: reactionManifestation ? [{ display: reactionManifestation }] : undefined,
        description: reactionDescription,
        onset: reactionOnset,
        severity: reactionSeverity,
        exposureRoute: reactionExposureRoute ? { code: reactionExposureRoute, display: reactionExposureRoute } : undefined,
        note: reactionNote ? [reactionNote] : undefined
      }] : undefined
    };
  }).filter(Boolean);
  if (allergyIntolerances.length > 0) canonical.allergyIntolerances = allergyIntolerances as any[];

  const immunizations = rows.map(row => {
    const immunizationId = readValue(row, 'immunization_id');
    const status = readValue(row, 'immunization_status');
    const statusReason = readValue(row, 'immunization_status_reason');
    const basedOnRaw = readValue(row, 'immunization_based_on_ids');
    const vaccineCode = readValue(row, 'immunization_vaccine_code');
    const vaccineSystem = readValue(row, 'immunization_vaccine_system');
    const vaccineDisplay = readValue(row, 'immunization_vaccine_display');
    const administeredProductId = readValue(row, 'immunization_administered_product_id');
    const manufacturerId = readValue(row, 'immunization_manufacturer_id');
    const lotNumber = readValue(row, 'immunization_lot_number');
    const expirationDate = readValue(row, 'immunization_expiration_date');
    const patientId = readValue(row, 'immunization_patient_id');
    const encounterId = readValue(row, 'immunization_encounter_id');
    const supportingInfoIds = readValue(row, 'immunization_supporting_info_ids');
    const occurrenceDate = readValue(row, 'immunization_occurrence_date');
    const occurrenceString = readValue(row, 'immunization_occurrence_string');
    const primarySource = readBoolean(row, 'immunization_primary_source');
    const informationSourceId = readValue(row, 'immunization_information_source_id');
    const locationId = readValue(row, 'immunization_location_id');
    const site = readValue(row, 'immunization_site');
    const route = readValue(row, 'immunization_route');
    const doseValue = readNumber(row, 'immunization_dose_value');
    const doseUnit = readValue(row, 'immunization_dose_unit');
    const performerActorId = readValue(row, 'immunization_performer_actor_id');
    const performerFunction = readValue(row, 'immunization_performer_function');
    const note = readValue(row, 'immunization_note');
    const reasonRaw = readValue(row, 'immunization_reason');
    const isSubpotent = readBoolean(row, 'immunization_is_subpotent');
    const subpotentReasonRaw = readValue(row, 'immunization_subpotent_reason');
    const programEligibilityProgram = readValue(row, 'immunization_program_eligibility_program');
    const programEligibilityStatus = readValue(row, 'immunization_program_eligibility_status');
    const fundingSource = readValue(row, 'immunization_funding_source');
    const reactionDate = readValue(row, 'immunization_reaction_date');
    const reactionManifestation = readValue(row, 'immunization_reaction_manifestation');
    const reactionReported = readBoolean(row, 'immunization_reaction_reported');
    const protocolSeries = readValue(row, 'immunization_protocol_series');
    const protocolAuthorityId = readValue(row, 'immunization_protocol_authority_id');
    const protocolTargetDisease = readValue(row, 'immunization_protocol_target_disease');
    const protocolDoseNumber = readValue(row, 'immunization_protocol_dose_number');
    const protocolSeriesDoses = readValue(row, 'immunization_protocol_series_doses');

    if (!immunizationId && !vaccineCode && !vaccineDisplay && !lotNumber && !occurrenceDate) return null;

    const basedOn = basedOnRaw ? basedOnRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const supportingInfo = supportingInfoIds ? supportingInfoIds.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const reasons = reasonRaw ? reasonRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;
    const subpotentReasons = subpotentReasonRaw ? subpotentReasonRaw.split(',').map(value => value.trim()).filter(Boolean) : undefined;

    return {
      id: immunizationId || undefined,
      identifier: immunizationId || undefined,
      basedOn: basedOn && basedOn.length ? basedOn : undefined,
      status: status || undefined,
      statusReason: statusReason ? { code: statusReason, display: statusReason } : undefined,
      vaccineCode: (vaccineCode || vaccineDisplay) ? {
        system: vaccineSystem,
        code: vaccineCode,
        display: vaccineDisplay
      } : undefined,
      administeredProduct: administeredProductId || undefined,
      manufacturer: manufacturerId || undefined,
      lotNumber: lotNumber || undefined,
      expirationDate: expirationDate || undefined,
      patient: patientId || undefined,
      encounter: encounterId || undefined,
      supportingInformation: supportingInfo && supportingInfo.length ? supportingInfo : undefined,
      occurrenceDateTime: occurrenceDate || undefined,
      occurrenceString: occurrenceString || undefined,
      primarySource: primarySource,
      informationSource: informationSourceId || undefined,
      location: locationId || undefined,
      site: site ? { code: site, display: site } : undefined,
      route: route ? { code: route, display: route } : undefined,
      doseQuantity: doseValue !== undefined ? { value: doseValue, unit: doseUnit } : undefined,
      performer: (performerActorId || performerFunction) ? [{
        function: performerFunction ? { code: performerFunction, display: performerFunction } : undefined,
        actor: performerActorId || undefined
      }] : undefined,
      note: note ? [note] : undefined,
      reason: reasons ? reasons.map(value => ({ code: { display: value } })) : undefined,
      isSubpotent: isSubpotent,
      subpotentReason: subpotentReasons ? subpotentReasons.map(value => ({ code: value, display: value })) : undefined,
      programEligibility: (programEligibilityProgram || programEligibilityStatus) ? [{
        program: programEligibilityProgram ? { code: programEligibilityProgram, display: programEligibilityProgram } : undefined,
        programStatus: programEligibilityStatus ? { code: programEligibilityStatus, display: programEligibilityStatus } : undefined
      }] : undefined,
      fundingSource: fundingSource ? { code: fundingSource, display: fundingSource } : undefined,
      reaction: (reactionDate || reactionManifestation || reactionReported !== undefined) ? [{
        date: reactionDate,
        manifestation: reactionManifestation ? { code: reactionManifestation, display: reactionManifestation } : undefined,
        reported: reactionReported
      }] : undefined,
      protocolApplied: (protocolSeries || protocolAuthorityId || protocolTargetDisease) ? [{
        series: protocolSeries,
        authority: protocolAuthorityId || undefined,
        targetDisease: protocolTargetDisease ? [{ code: protocolTargetDisease, display: protocolTargetDisease }] : undefined,
        doseNumber: protocolDoseNumber,
        seriesDoses: protocolSeriesDoses
      }] : undefined
    };
  }).filter(Boolean);
  if (immunizations.length > 0) canonical.immunizations = immunizations as any[];

  const documentReferences = rows.map(row => {
    const format = readValue(row, 'document_format');
    const url = readValue(row, 'document_url');
    const data = readValue(row, 'document_data');
    if (!format && !url && !data) return null;
    return {
      id: readValue(row, 'document_id'),
      title: readValue(row, 'document_title'),
      description: readValue(row, 'document_description'),
      format: format,
      url: url,
      data: data,
      contentType: readValue(row, 'document_content_type'),
      status: readValue(row, 'document_status')
    };
  }).filter(Boolean);
  if (documentReferences.length > 0) canonical.documentReferences = documentReferences as any[];

  const binaries = rows.map(row => {
    const contentType = readValue(row, 'binary_content_type');
    const data = readValue(row, 'binary_data');
    const securityContext = readValue(row, 'binary_security_context');
    if (!contentType && !data && !securityContext && !readValue(row, 'binary_id')) return null;
    return {
      id: readValue(row, 'binary_id'),
      contentType: contentType || undefined,
      securityContext: securityContext || undefined,
      data: data || undefined
    };
  }).filter(Boolean);
  if (binaries.length > 0) canonical.binaries = binaries as any[];

  const practitioners = rows.map(row => {
    const practitionerId = readValue(row, 'practitioner_id');
    const practitionerFirst = readValue(row, 'practitioner_first_name');
    const practitionerMiddle = readValue(row, 'practitioner_middle_name');
    let practitionerLast = readValue(row, 'practitioner_last_name');
    let fullNameGiven: string[] | undefined;
    if (!practitionerFirst && !practitionerLast) {
      const nameFromFull = splitFullName(readValue(row, 'practitioner_name'));
      if (nameFromFull?.family) practitionerLast = nameFromFull.family;
      if (nameFromFull?.given?.length) fullNameGiven = nameFromFull.given;
    }

    const addressLine1 = readValue(row, 'practitioner_address_line1');
    const addressLine2 = readValue(row, 'practitioner_address_line2');
    const address = (addressLine1 || addressLine2 || readValue(row, 'practitioner_city')) ? [{
      line: [addressLine1, addressLine2].filter(Boolean) as string[],
      city: readValue(row, 'practitioner_city'),
      state: readValue(row, 'practitioner_state'),
      postalCode: readValue(row, 'practitioner_postal_code'),
      country: readValue(row, 'practitioner_country')
    }] : undefined;

    const telecom: Array<{ system: 'phone' | 'email' | 'fax' | 'url' | 'other'; value: string; }> = [];
    const phone = readValue(row, 'practitioner_phone');
    const email = readValue(row, 'practitioner_email');
    if (phone) telecom.push({ system: 'phone', value: phone });
    if (email) telecom.push({ system: 'email', value: email });

    const givenValues = (fullNameGiven ?? [practitionerFirst, practitionerMiddle].filter(Boolean)) as string[];
    const qualificationCode = readValue(row, 'practitioner_qualification_code');
    const qualification = qualificationCode ? [{
      code: {
        system: readValue(row, 'practitioner_qualification_system'),
        code: qualificationCode,
        display: readValue(row, 'practitioner_qualification_display')
      }
    }] : undefined;

    if (!practitionerId && !practitionerLast && !givenValues.length && !telecom.length && !address) {
      return null;
    }

    return {
      id: practitionerId,
      identifier: practitionerId,
      name: {
        family: practitionerLast,
        given: givenValues.length > 0 ? givenValues : undefined
      },
      gender: readValue(row, 'practitioner_gender'),
      birthDate: readValue(row, 'practitioner_birth_date'),
      address,
      telecom: telecom.length > 0 ? telecom : undefined,
      qualification,
      active: readBoolean(row, 'practitioner_active')
    };
  }).filter(Boolean);
  if (practitioners.length > 0) canonical.practitioners = practitioners as any[];

  const practitionerRoles = rows.map(row => {
    const roleId = readValue(row, 'practitioner_role_id');
    const practitionerId = readValue(row, 'practitioner_role_practitioner_id');
    const organizationId = readValue(row, 'practitioner_role_organization_id');
    const roleCode = readValue(row, 'practitioner_role_code');
    const specialtyCode = readValue(row, 'practitioner_role_specialty');
    const periodStart = readValue(row, 'practitioner_role_period_start');
    const periodEnd = readValue(row, 'practitioner_role_period_end');

    if (!roleId && !practitionerId && !organizationId && !roleCode && !specialtyCode) {
      return null;
    }

    return {
      id: roleId,
      practitionerId,
      organizationId,
      code: roleCode ? [{
        system: readValue(row, 'practitioner_role_code_system'),
        code: roleCode,
        display: readValue(row, 'practitioner_role_code_display')
      }] : undefined,
      specialty: specialtyCode ? [{
        system: readValue(row, 'practitioner_role_specialty_system'),
        code: specialtyCode,
        display: readValue(row, 'practitioner_role_specialty_display')
      }] : undefined,
      period: (periodStart || periodEnd) ? {
        start: periodStart,
        end: periodEnd
      } : undefined,
      active: readBoolean(row, 'practitioner_role_active')
    };
  }).filter(Boolean);
  if (practitionerRoles.length > 0) canonical.practitionerRoles = practitionerRoles as any[];

  const organizations = rows.map(row => {
    const organizationId = readValue(row, 'organization_id');
    const organizationName = readValue(row, 'organization_name');
    const aliasRaw = readValue(row, 'organization_alias');
    const aliases = aliasRaw ? aliasRaw.split(',').map(v => v.trim()).filter(Boolean) : undefined;
    const typeCode = readValue(row, 'organization_type_code');

    const addressLine1 = readValue(row, 'organization_address_line1');
    const addressLine2 = readValue(row, 'organization_address_line2');
    const address = (addressLine1 || addressLine2 || readValue(row, 'organization_city')) ? [{
      line: [addressLine1, addressLine2].filter(Boolean) as string[],
      city: readValue(row, 'organization_city'),
      state: readValue(row, 'organization_state'),
      postalCode: readValue(row, 'organization_postal_code'),
      country: readValue(row, 'organization_country')
    }] : undefined;

    const telecom: Array<{ system: 'phone' | 'email' | 'fax' | 'url' | 'other'; value: string; }> = [];
    const phone = readValue(row, 'organization_phone');
    const email = readValue(row, 'organization_email');
    if (phone) telecom.push({ system: 'phone', value: phone });
    if (email) telecom.push({ system: 'email', value: email });

    if (!organizationId && !organizationName && !aliases?.length && !typeCode && !address && !telecom.length) {
      return null;
    }

    return {
      id: organizationId,
      identifier: organizationId,
      name: organizationName,
      alias: aliases && aliases.length > 0 ? aliases : undefined,
      type: typeCode ? [{
        system: readValue(row, 'organization_type_system'),
        code: typeCode,
        display: readValue(row, 'organization_type_display')
      }] : undefined,
      telecom: telecom.length > 0 ? telecom : undefined,
      address,
      partOf: readValue(row, 'organization_part_of'),
      active: readBoolean(row, 'organization_active')
    };
  }).filter(Boolean);
  if (organizations.length > 0) canonical.organizations = organizations as any[];

  return canonical;
}
