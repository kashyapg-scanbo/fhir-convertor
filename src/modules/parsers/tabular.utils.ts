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
    const participantIdsRaw = readValue(firstRow, 'encounter_practitioner_id');
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

    return {
      id: apptId || undefined,
      identifier: apptId || undefined,
      status: status || 'proposed',
      description: readValue(row, 'appointment_description'),
      start: start,
      end: end,
      minutesDuration: minutes,
      created: readValue(row, 'appointment_created'),
      cancellationDate: readValue(row, 'appointment_cancellation_date'),
      subject: readValue(row, 'appointment_subject_id'),
      participant: participantId ? [{
        actor: participantId,
        status: readValue(row, 'appointment_participant_status')
      }] : undefined,
      note: readValue(row, 'appointment_note') ? [readValue(row, 'appointment_note') as string] : undefined
    };
  }).filter(Boolean);
  if (appointments.length > 0) canonical.appointments = appointments as any[];

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
