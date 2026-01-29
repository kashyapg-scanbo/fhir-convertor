import { Buffer } from 'node:buffer';
import { HL7Message } from '../../shared/types/hl7.types.js';
import {
  CanonicalObservation,
  CanonicalDocumentReference,
  CanonicalEncounter,
  CanonicalMedicationStatement,
  CanonicalMedicationAdministration,
  CanonicalMedicationDispense,
  CanonicalOrganizationAffiliation,
  CanonicalPerson,
  CanonicalDeviceDispense,
  CanonicalDeviceRequest,
  CanonicalDeviceUsage,
  CanonicalProcedure,
  CanonicalCondition,
  CanonicalAppointment,
  CanonicalAppointmentResponse,
  CanonicalClaim,
  CanonicalClaimResponse,
  CanonicalComposition,
  CanonicalExplanationOfBenefit,
  CanonicalCoverage,
  CanonicalEncounterHistory,
  CanonicalFlag,
  CanonicalList,
  CanonicalNutritionIntake,
  CanonicalNutritionOrder,
  CanonicalRiskAssessment,
  CanonicalBinary,
  CanonicalAccount,
  CanonicalChargeItem,
  CanonicalChargeItemDefinition,
  CanonicalDevice,
  CanonicalDeviceMetric,
  CanonicalEndpoint,
  CanonicalSchedule,
  CanonicalSlot,
  CanonicalDiagnosticReport,
  CanonicalRelatedPerson,
  CanonicalLocation,
  CanonicalEpisodeOfCare,
  CanonicalSpecimen,
  CanonicalImagingStudy,
  CanonicalAllergyIntolerance,
  CanonicalImmunization,
  CanonicalCapabilityStatement,
  CanonicalOperationOutcome,
  CanonicalParameters,
  CanonicalCarePlan,
  CanonicalCareTeam,
  CanonicalGoal,
  CanonicalServiceRequest,
  CanonicalTask,
  CanonicalCommunication,
  CanonicalCommunicationRequest,
  CanonicalQuestionnaire,
  CanonicalQuestionnaireResponse,
  CanonicalCodeSystem,
  CanonicalValueSet,
  CanonicalConceptMap,
  CanonicalNamingSystem,
  CanonicalTerminologyCapabilities,
  CanonicalProvenance,
  CanonicalAuditEvent,
  CanonicalConsent
} from '../../shared/types/canonical.types.js';
import { getFhirContentType } from '../../shared/types/documentTypes.mapping.js';

export function buildCanonical(parsed: any) {
  const msh = parsed.MSH?.[0];
  const pid = parsed.PID?.[0];
  const pv1 = parsed.PV1?.[0];
  const obxSegments = parsed.OBX ?? [];

  /* ───── Message Type (MSH-9) ───── */
  // MSH-9 is at index 8 (field 9): MSH|^~\&|...|...|...|...|...|...|ADT^A01|...
  const messageTypeField = msh?.[8]?.[0] ?? [];
  const messageType = messageTypeField[0] && messageTypeField[1]
    ? `${messageTypeField[0]}^${messageTypeField[1]}`
    : undefined;
  const triggerEvent = messageTypeField[1]; // e.g., 'A01', 'A08'

  // Determine operation type
  let operation: 'create' | 'update' | 'delete' | undefined;
  let isDelete = false;

  if (messageType) {
    if (triggerEvent === 'A01') {
      // ADT^A01: Create/Admit patient
      operation = 'create';
    } else if (triggerEvent === 'A08') {
            // ADT^A08: Update patient demographics or Delete (set inactive)
            // Check for delete indicators:
            // - ZPD segment (Patient Deactivate)
            // - ZIN segment (Inactivate)
            // - PID-18 Patient Death Indicator = 'D'
            // - Any Z-segment starting with 'ZD' (Delete indicator)
      const hasDeleteIndicator = parsed.ZPD?.length > 0 ||
        parsed.ZIN?.length > 0 ||
        Object.keys(parsed).some(key => key.startsWith('ZD')) ||
        (pid?.[18]?.[0]?.[0] && pid[18][0][0].toUpperCase() === 'D');

      if (hasDeleteIndicator) {
        operation = 'delete';
        isDelete = true;
      } else {
        operation = 'update';
      }
    }
  }

  /* ───── Patient ───── */
  const patientId = pid?.[2]?.[0]?.[0];

  const nameParts = pid?.[4]?.[0] ?? [];
  const family = nameParts[0];
  const given = nameParts.slice(1, 3).filter(Boolean);

  const birthDate = toFHIRDate(pid?.[6]?.[0]?.[0]);
  const gender = mapGender(pid?.[7]?.[0]?.[0]);

  const addr = pid?.[10]?.[0];
  const address = addr
    ? [{
      line: addr[0] ? [addr[0]] : undefined,
      city: addr[2],
      state: addr[3],
      postalCode: addr[4]
    }]
    : [];

  const telecom: any[] = [];

  if (pid?.[12]?.[0]?.[0]) {
    telecom.push({ system: 'phone', value: pid[12][0][0], use: 'home' });
  }
  if (pid?.[13]?.[0]?.[0]) {
    telecom.push({ system: 'phone', value: pid[13][0][0], use: 'work' });
  }

  /* ───── Encounter ───── */
  // Only include encounter if PV1 segment exists
  let encounter: CanonicalEncounter | undefined;
  const locations: CanonicalLocation[] = [];
  if (pv1) {
    const encounterClass = pv1?.[1]?.[0]?.[0] === 'I' ? 'IMP' : 'AMB';
    const encounterId = pv1?.[18]?.[0]?.[0];
    const encounterParticipants = new Set<string>();

    const participantFields = [6, 7, 8, 16]; // PV1-7/8/9/17
    for (const fieldIndex of participantFields) {
      const reps = pv1?.[fieldIndex] ?? [];
      for (const rep of reps) {
        const participantId = Array.isArray(rep) ? rep[0] : undefined;
        if (participantId) encounterParticipants.add(participantId);
      }
    }

    const serviceProviderOrgId =
      pv1?.[2]?.[0]?.[3] || // PV1-3.4: Facility
      pv1?.[38]?.[0]?.[0]; // PV1-39: Servicing Facility

    const locationComponents = pv1?.[2]?.[0] ?? [];
    const pointOfCare = locationComponents[0];
    const room = locationComponents[1];
    const bed = locationComponents[2];
    const facility = locationComponents[3];
    const locationStatus = locationComponents[4];
    const locationDescription = locationComponents[8];
    const locationName = locationDescription || [pointOfCare, room && `Room ${room}`, bed && `Bed ${bed}`]
      .filter(Boolean)
      .join(', ');
    const locationId = facility || pointOfCare || room || bed;
    if (locationId || locationName) {
      locations.push({
        id: locationId,
        identifier: locationId,
        status: locationStatus,
        name: locationName || undefined,
        description: locationDescription || undefined
      });
    }

    encounter = {
      id: encounterId,
      class: encounterClass,
      location: locationName || facility || undefined,
      participantPractitionerIds: encounterParticipants.size > 0
        ? Array.from(encounterParticipants)
        : undefined,
      serviceProviderOrganizationId: serviceProviderOrgId
    };
  }

  /* ───── Observations and DocumentReferences (OBX) ───── */
  // Separate OBX segments into Observations and DocumentReferences
  // OBX segments with ED (Encapsulated Data) type become DocumentReferences
  const observations: CanonicalObservation[] = [];
  const documentReferences: CanonicalDocumentReference[] = [];

  if (obxSegments.length > 0) {
    for (const obx of obxSegments) {
      // OBX-1: Set ID
      const setId = obx?.[0]?.[0]?.[0];

      // OBX-2: Value Type
      const valueType = obx?.[1]?.[0]?.[0];

      // OBX-3: Observation Identifier (code^display^system)
      const codeParts = obx?.[2]?.[0] ?? [];
      const observationCode = codeParts[0];
      const observationDisplay = codeParts[1];
      const observationSystem = codeParts[2];

      if (!observationCode) continue; // Skip if no code

      // Check if this is an ED (Encapsulated Data) type - should be DocumentReference
      if (valueType?.toUpperCase() === 'ED') {
        // Parse ED format: OBX-5 contains ^type^encoding^data
        // Format: ^PDF^Base64^JVBERi0xLjQKJcfs...
        const rawValueField = obx?.[4];
        let documentData: string | undefined;
        let documentType: string | undefined;
        let encoding: string | undefined;

        if (Array.isArray(rawValueField) && rawValueField.length > 0) {
          // Join all repetitions to get the full value
          const fullValue = rawValueField
            .map((rep: any) => Array.isArray(rep) ? rep.join('^') : String(rep))
            .join('~');

          // Parse ED format: ^type^encoding^data
          // Handle cases where it might start with ^ or not
          const parts = fullValue.split('^');
          if (parts.length >= 5) {
            // Format: ^type^subtype^encoding^data (ED datatype)
            documentType = parts[2]?.trim() || parts[1]?.trim();
            encoding = parts[3]?.trim();
            documentData = parts.slice(4).join('^'); // Rejoin in case data contains ^
          } else if (parts.length === 4) {
            // Format: ^type^encoding^data
            documentType = parts[1]?.trim();
            encoding = parts[2]?.trim();
            documentData = parts.slice(3).join('^');
          } else if (parts.length === 3) {
            // Format: type^encoding^data (no leading ^)
            documentType = parts[0]?.trim();
            encoding = parts[1]?.trim();
            documentData = parts[2]?.trim();
          } else if (fullValue.trim()) {
            // Fallback: treat entire value as base64 data, try to detect type from code
            documentData = fullValue.trim();
            // Try to infer type from observation code or display
            if (observationDisplay?.toLowerCase().includes('pdf')) {
              documentType = 'PDF';
            } else if (observationDisplay?.toLowerCase().includes('image')) {
              documentType = 'JPEG';
            } else {
              documentType = 'PDF'; // Default
            }
            encoding = 'Base64';
          }
        }

        // Only create DocumentReference if we have data
        if (documentData) {
          // OBX-14: Date/Time of the Observation (index 13 in 0-based)
          const documentDate = toFHIRDate(obx?.[13]?.[0]?.[0]) || toFHIRDateTime(obx?.[13]?.[0]?.[0]);

          // OBX-16: Responsible Observer (index 15) - can be author
          const observerReps = obx?.[15] ?? [];
          const authorIds: string[] = observerReps
            .map((rep: any[]) => {
              if (!Array.isArray(rep)) return null;
              return rep[0]; // First component is ID
            })
            .filter(Boolean);

          // OBX-22: Performing Organization Name (index 21) - can be custodian
          const performerOrgName = obx?.[21]?.[0]?.[0];
          const custodianId = performerOrgName;

          const docRef: CanonicalDocumentReference = {
            id: setId || `DOC-${observationCode}`,
            identifier: setId || observationCode,
            status: 'current',
            subject: patientId,
            date: documentDate,
            description: observationDisplay || observationCode,
            author: authorIds.length > 0 ? authorIds : undefined,
            custodian: custodianId,
            type: {
              coding: [{
                system: mapCodingSystem(observationSystem),
                code: observationCode,
                display: observationDisplay
              }]
            },
            content: [{
              attachment: {
                contentType: getFhirContentType(documentType || 'pdf') || 'application/octet-stream',
                data: documentData,
                title: observationDisplay || `${documentType || 'Document'} Report`,
                format: documentType // Legacy format field for backward compatibility
              }
            }]
          };

          documentReferences.push(docRef);
        }
        continue; // Skip adding as observation
      }

      // Regular observation processing (non-ED types)
      // const observation = processObservationSegment(obx, patientId, encounter?.id);
      const observation = processObservationSegment(obx, patientId);

      if (observation) {
        observations.push(observation);
      }
    }
  }

  // Helper function to process regular observation segments
  function processObservationSegment(obx: any, patientId?: string): CanonicalObservation | null {
    // OBX-1: Set ID
    const setId = obx?.[0]?.[0]?.[0];

    // OBX-2: Value Type
    const valueType = obx?.[1]?.[0]?.[0];

    // OBX-3: Observation Identifier (code^display^system)
    const codeParts = obx?.[2]?.[0] ?? [];
    const observationCode = codeParts[0];
    const observationDisplay = codeParts[1];
    const observationSystem = codeParts[2];

    if (!observationCode) return null; // Skip if no code

    // OBX-5: Observation Value (can have multiple values separated by ~)
    // Structure: obx[4] is array of repetitions, each repetition is array of components
    // "60~120" becomes obx[4] = [["60"], ["120"]]
    // OBX-5 Observation Value
    const rawValueField = obx?.[4];

    // Convert repetitions safely to string
    let observationValue: string | number | (string | number)[] | undefined;

    if (Array.isArray(rawValueField)) {
      const values = rawValueField
        .map((rep: any) =>
          Array.isArray(rep) ? rep.join('') : String(rep)
        )
        .filter(Boolean);

      if (values.length > 1) {
        observationValue = values.map(v => {
          const n = Number(v);
          return isNaN(n) ? v : n;
        });
      } else if (values.length === 1) {
        const n = Number(values[0]);
        observationValue = isNaN(n) ? values[0] : n;
      }
    }


    // OBX-6: Units (unit^unitSystem^unitCode)
    const unitParts = obx?.[5]?.[0] ?? [];
    const unit = unitParts[0];
    const unitSystem = unitParts[2];
    const unitCode = unitParts[1];

    // OBX-7: References Range
    const referenceRange = obx?.[6]?.[0]?.[0];

    // OBX-8: Abnormal Flags (can have multiple flags separated by ~)
    const abnormalFlagsField = obx?.[7]?.[0] ?? [];
    const abnormalFlags = abnormalFlagsField.length > 0
      ? abnormalFlagsField.map((flag: string) => flag.split('^')[0]).filter(Boolean)
      : undefined;

    // OBX-11: Observation Result Status
    const status = obx?.[10]?.[0]?.[0];

    // OBX-14: Date/Time of the Observation (index 13 in 0-based)
    const observationDate = toFHIRDate(obx?.[13]?.[0]?.[0]);

    // OBX-15: Producer's ID (Organization ID and System) - index 14
    const producerField = obx?.[14]?.[0] ?? [];
    const producer = producerField.length > 0 ? {
      organizationId: producerField[0],
      system: producerField[2]
    } : undefined;

    // OBX-16: Responsible Observer (index 15) - can have multiple observers separated by ~
    const observerReps = obx?.[15] ?? [];

    const observers = observerReps.map((rep: any[]) => {
      if (!Array.isArray(rep)) return null;

      const [
        id,
        family,
        given,
        middle,
        suffix,
        prefix,
        degree
      ] = rep;

      const name = [
        prefix,
        given,
        middle,
        family,
        suffix
      ].filter(Boolean).join(' ');

      return {
        id,
        name: name || undefined,
        qualification: degree || undefined
      };
    }).filter(Boolean);


    // OBX-17: Observation Method (index 16)
    const methodField = obx?.[16]?.[0] ?? [];
    const method = methodField.length > 0 ? {
      code: methodField[0],
      description: methodField[1]
    } : undefined;

    // OBX-18: Equipment Instance Identifier (index 17)
    const deviceField = obx?.[17]?.[0] ?? [];
    const device = deviceField.length > 0 ? {
      uid: deviceField.find((d: string) => d.includes('-'))?.split('^')[0], // UUID-like value
      oid: deviceField.find((d: string) => d.startsWith('1.'))?.split('^')[0] // OID
    } : undefined;

    // OBX-19: Date/Time of the Analysis (index 18)
    const analysisDate = toFHIRDate(obx?.[18]?.[0]?.[0]);

    // OBX-20: Observation Site (index 19)
    const siteField = obx?.[19]?.[0] ?? [];
    const site = siteField.length > 0 ? {
      code: siteField[0],
      display: siteField[1]
    } : undefined;

    // OBX-22: Performing Organization Name (index 21)
    const performerOrgName = obx?.[21]?.[0]?.[0];

    // OBX-23: Performing Organization Address (index 22)
    const performerOrgAddrField = obx?.[22]?.[0] ?? [];
    const performerOrganization = (performerOrgName || performerOrgAddrField.length > 0) ? {
      name: performerOrgName,
      address: performerOrgAddrField.length > 0 ? {
        city: performerOrgAddrField[1],
        state: performerOrgAddrField[2],
        postalCode: performerOrgAddrField[3],
        country: performerOrgAddrField[4]
      } : undefined
    } : undefined;

    // OBX-27: Observation Type/Interpretation (index 26)
    const interpretationField = obx?.[26]?.[0] ?? [];
    const interpretation = interpretationField.length > 0
      ? interpretationField.map((interp: string) => interp.split('^')[0]).filter(Boolean)
      : undefined;

    const result: CanonicalObservation = {
      setId,
      valueType,
      code: {
        system: mapCodingSystem(observationSystem),
        code: observationCode,
        display: observationDisplay
      }
    };

    // Only add optional fields if they have values
    if (observationValue !== undefined) result.value = observationValue;
    if (unit) result.unit = unit;
    if (unitSystem) result.unitSystem = unitSystem;
    if (unitCode) result.unitCode = unitCode;
    if (referenceRange) result.referenceRange = referenceRange;
    if (abnormalFlags && abnormalFlags.length > 0) result.abnormalFlags = abnormalFlags;
    if (status) result.status = mapObservationStatus(status);
    if (observationDate || analysisDate) result.date = observationDate || analysisDate;
    if (producer) result.producer = producer;
    if (observers && observers.length > 0) result.observer = observers;
    if (method) result.method = method;
    if (device && (device.uid || device.oid)) result.device = device;
    if (site) result.site = site;
    if (performerOrganization) result.performerOrganization = performerOrganization;
    if (interpretation && interpretation.length > 0) result.interpretation = interpretation;

    return result;
  }


  const result: any = {
    operation,
    messageType,
    patient: {
      id: patientId,
      identifier: patientId,
      name: { family, given },
      gender,
      birthDate,
      address,
      telecom,
      active: isDelete ? false : undefined // Set active to false for delete operations
    }
  };

  // Only include encounter if PV1 segment was present
  if (encounter) {
    result.encounter = encounter;
  }

  // Only include observations if OBX segments were present
  if (observations.length > 0) {
    result.observations = observations;
  }

  // Only include document references if ED type OBX segments were present
  if (documentReferences.length > 0) {
    result.documentReferences = documentReferences;
  }

  /* ───── Additional Resources (custom HL7v2 OBX mapping) ───── */
  const appointmentResponses: CanonicalAppointmentResponse[] = [];
  const claims: CanonicalClaim[] = [];
  const claimResponses: CanonicalClaimResponse[] = [];
  const compositions: CanonicalComposition[] = [];
  const explanationOfBenefits: CanonicalExplanationOfBenefit[] = [];
  const coverages: CanonicalCoverage[] = [];
  const deviceDispenses: CanonicalDeviceDispense[] = [];
  const deviceRequests: CanonicalDeviceRequest[] = [];
  const deviceUsages: CanonicalDeviceUsage[] = [];
  const encounterHistories: CanonicalEncounterHistory[] = [];
  const flags: CanonicalFlag[] = [];
  const lists: CanonicalList[] = [];
  const nutritionIntakes: CanonicalNutritionIntake[] = [];
  const nutritionOrders: CanonicalNutritionOrder[] = [];
  const riskAssessments: CanonicalRiskAssessment[] = [];
  const binaries: CanonicalBinary[] = [];
  const accounts: CanonicalAccount[] = [];
  const chargeItems: CanonicalChargeItem[] = [];
  const chargeItemDefinitions: CanonicalChargeItemDefinition[] = [];
  const devices: CanonicalDevice[] = [];
  const deviceMetrics: CanonicalDeviceMetric[] = [];
  const endpoints: CanonicalEndpoint[] = [];

  const messageId = msh?.[9]?.[0]?.[0];
  const messageDate = msh?.[6]?.[0]?.[0];
  const messageDateTime = toFHIRDateTime(messageDate) || toFHIRDate(messageDate);

  for (const obx of obxSegments) {
    const codeParts = obx?.[2]?.[0] ?? [];
    const codeValue = String(codeParts[0] ?? '').trim();
    const displayName = String(codeParts[1] ?? codeValue).trim();
    const normalized = codeValue.toUpperCase();
    const textValue = obx?.[4]?.[0]?.[0];
    const valueText = textValue !== undefined ? String(textValue) : undefined;
    const idValue = obx?.[3]?.[0]?.[0] || messageId;

    switch (normalized) {
      case 'APPOINTMENTRESPONSE':
        appointmentResponses.push({
          id: idValue || `APPTRESP-${Date.now()}`,
          identifier: idValue,
          appointment: idValue,
          participantStatus: 'accepted',
          comment: valueText || displayName,
          actor: patientId
        });
        break;
      case 'CLAIM':
        claims.push({
          id: idValue || `CLAIM-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'active',
          type: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          patient: patientId,
          created: messageDateTime
        });
        break;
      case 'CLAIMRESPONSE':
        claimResponses.push({
          id: idValue || `CLMRESP-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'active',
          type: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          patient: patientId,
          created: messageDateTime
        });
        break;
      case 'COMPOSITION':
        compositions.push({
          id: idValue || `COMP-${Date.now()}`,
          status: 'final',
          type: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          subject: patientId ? [patientId] : undefined,
          date: messageDateTime,
          title: valueText || displayName
        });
        break;
      case 'EXPLANATIONOFBENEFIT':
        explanationOfBenefits.push({
          id: idValue || `EOB-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'active',
          type: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          patient: patientId,
          created: messageDateTime
        });
        break;
      case 'COVERAGE':
        coverages.push({
          id: idValue || `COV-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'active',
          type: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          beneficiary: patientId,
          period: messageDateTime ? { start: messageDateTime } : undefined
        });
        break;
      case 'DEVICEDISPENSE':
        deviceDispenses.push({
          id: idValue || `DEV-DISP-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'completed',
          deviceCodeableConcept: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          subject: patientId,
          encounter: encounter?.id,
          preparedDate: messageDateTime
        });
        break;
      case 'DEVICEREQUEST':
        deviceRequests.push({
          id: idValue || `DEV-REQ-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'active',
          intent: 'order',
          codeCodeableConcept: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          subject: patientId,
          encounter: encounter?.id,
          authoredOn: messageDateTime
        });
        break;
      case 'DEVICEUSAGE':
        deviceUsages.push({
          id: idValue || `DEV-USE-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'active',
          deviceCodeableConcept: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          patient: patientId,
          context: encounter?.id,
          timingDateTime: messageDateTime
        });
        break;
      case 'ENCOUNTERHISTORY':
        encounterHistories.push({
          id: idValue || `ENC-HIST-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'completed',
          class: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          subject: patientId,
          actualPeriod: messageDateTime ? { start: messageDateTime } : undefined
        });
        break;
      case 'FLAG':
        flags.push({
          id: idValue || `FLAG-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'active',
          code: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          subject: patientId,
          encounter: encounter?.id
        });
        break;
      case 'LIST':
        lists.push({
          id: idValue || `LIST-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'current',
          title: valueText || displayName,
          code: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          subject: patientId ? [patientId] : undefined,
          encounter: encounter?.id,
          date: messageDateTime
        });
        break;
      case 'NUTRITIONINTAKE':
        nutritionIntakes.push({
          id: idValue || `NINT-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'completed',
          code: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          subject: patientId,
          encounter: encounter?.id,
          occurrenceDateTime: messageDateTime
        });
        break;
      case 'NUTRITIONORDER':
        nutritionOrders.push({
          id: idValue || `NORD-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'active',
          intent: 'order',
          subject: patientId,
          encounter: encounter?.id,
          dateTime: messageDateTime,
          note: valueText || displayName ? [valueText || displayName] : undefined
        });
        break;
      case 'RISKASSESSMENT':
        riskAssessments.push({
          id: idValue || `RISK-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'final',
          code: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          subject: patientId,
          encounter: encounter?.id,
          occurrenceDateTime: messageDateTime
        });
        break;
      case 'ACCOUNT':
        accounts.push({
          id: idValue || `ACC-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'active',
          name: valueText || displayName,
          subject: patientId ? [patientId] : undefined,
          servicePeriod: messageDateTime ? { start: messageDateTime } : undefined
        });
        break;
      case 'CHARGEITEM':
        chargeItems.push({
          id: idValue || `CHG-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'planned',
          code: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          subject: patientId,
          occurrenceDateTime: messageDateTime
        });
        break;
      case 'CHARGEITEMDEFINITION':
        chargeItemDefinitions.push({
          id: idValue || `CHGDEF-${Date.now()}`,
          status: 'active',
          title: valueText || displayName,
          date: messageDateTime,
          code: codeValue || displayName ? { code: codeValue, display: displayName } : undefined
        });
        break;
      case 'DEVICE':
        devices.push({
          id: idValue || `DEV-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'active',
          displayName: valueText || displayName,
          name: valueText || displayName ? [{ value: valueText || displayName, type: 'user-friendly-name' }] : undefined
        });
        break;
      case 'DEVICEMETRIC':
        deviceMetrics.push({
          id: idValue || `METRIC-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          type: codeValue || displayName ? { code: codeValue, display: displayName } : undefined,
          category: 'measurement'
        });
        break;
      case 'ENDPOINT':
        endpoints.push({
          id: idValue || `ENDPT-${Date.now()}`,
          identifier: idValue ? [{ value: idValue }] : undefined,
          status: 'active',
          name: displayName,
          address: valueText
        });
        break;
      case 'BINARY':
        if (valueText) {
          binaries.push({
            id: idValue || `BIN-${Date.now()}`,
            contentType: 'text/plain',
            data: Buffer.from(valueText).toString('base64')
          });
        }
        break;
      default:
        break;
    }
  }

  if (appointmentResponses.length > 0) result.appointmentResponses = appointmentResponses;
  if (claims.length > 0) result.claims = claims;
  if (claimResponses.length > 0) result.claimResponses = claimResponses;
  if (compositions.length > 0) result.compositions = compositions;
  if (explanationOfBenefits.length > 0) result.explanationOfBenefits = explanationOfBenefits;
  if (coverages.length > 0) result.coverages = coverages;
  if (deviceDispenses.length > 0) result.deviceDispenses = deviceDispenses;
  if (deviceRequests.length > 0) result.deviceRequests = deviceRequests;
  if (deviceUsages.length > 0) result.deviceUsages = deviceUsages;
  if (encounterHistories.length > 0) result.encounterHistories = encounterHistories;
  if (flags.length > 0) result.flags = flags;
  if (lists.length > 0) result.lists = lists;
  if (nutritionIntakes.length > 0) result.nutritionIntakes = nutritionIntakes;
  if (nutritionOrders.length > 0) result.nutritionOrders = nutritionOrders;
  if (riskAssessments.length > 0) result.riskAssessments = riskAssessments;
  if (binaries.length > 0) result.binaries = binaries;
  if (accounts.length > 0) result.accounts = accounts;
  if (chargeItems.length > 0) result.chargeItems = chargeItems;
  if (chargeItemDefinitions.length > 0) result.chargeItemDefinitions = chargeItemDefinitions;
  if (devices.length > 0) result.devices = devices;
  if (deviceMetrics.length > 0) result.deviceMetrics = deviceMetrics;
  if (endpoints.length > 0) result.endpoints = endpoints;

  /* ───── Parameters (from OBX) ───── */
  const parameters: CanonicalParameters[] = [];
  if (obxSegments.length > 0) {
    const paramList = obxSegments.map((obx: any) => {
      const codeParts = obx?.[2]?.[0] ?? [];
      const name = codeParts[1] || codeParts[0] || 'parameter';
      const value = obx?.[4]?.[0]?.[0];
      if (!name && value === undefined) return null;
      return {
        name,
        valueString: value !== undefined ? String(value) : undefined
      };
    }).filter(Boolean) as Array<{ name: string; valueString?: string }>;

    if (paramList.length > 0) {
      parameters.push({
        id: `PARAMS-${Date.now()}`,
        parameter: paramList
      });
    }
  }

  if (parameters.length > 0) {
    result.parameters = parameters;
  }

  /* ───── CarePlans (from ORC/OBR) ───── */
  const carePlans: CanonicalCarePlan[] = [];
  const orcSegments = parsed.ORC ?? [];
  const obrSegments = parsed.OBR ?? [];

  for (const orc of orcSegments) {
    const placerId = orc?.[1]?.[0]?.[0];
    const fillerId = orc?.[2]?.[0]?.[0];
    const planId = placerId || fillerId;
    const status = orc?.[4]?.[0]?.[0];
    const orderControl = orc?.[0]?.[0]?.[0];
    const description = orc?.[6]?.[0]?.[0];

    if (!planId && !orderControl && !description) continue;

    carePlans.push({
      id: planId || `ORC-${Date.now()}`,
      identifier: planId,
      status: status || 'active',
      intent: 'plan',
      title: orderControl ? `Order ${orderControl}` : undefined,
      description: description,
      subject: patientId,
      encounter: encounter?.id
    });
  }

  for (const obr of obrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const planId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const title = codeParts[1] || codeParts[0];
    const codeSystem = codeParts[2];
    const start = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!planId && !title) continue;

    carePlans.push({
      id: planId || `OBR-${Date.now()}`,
      identifier: planId,
      status: 'active',
      intent: 'plan',
      title: title,
      category: title ? [{
        system: mapCodingSystem(codeSystem),
        code: codeParts[0],
        display: title
      }] : undefined,
      period: start ? { start } : undefined,
      subject: patientId,
      encounter: encounter?.id
    });
  }

  if (carePlans.length > 0) {
    result.carePlans = carePlans;
  }

  /* ───── Organizations (from MSH, ORC, OBX, PV1, PRD) ───── */
  const organizations: any[] = [];
  const orgIndex = new Map<string, any>();

  function registerOrganization(org: any) {
    if (!org) return;
    const key = org.identifier || org.id || org.name;
    if (!key) return;
    if (orgIndex.has(key)) return;
    orgIndex.set(key, org);
    organizations.push(org);
  }

  // Extract Organization from MSH (Sending/Receiving Facilities)
  // MSH-3: Sending Application, MSH-4: Sending Facility
  // MSH-5: Receiving Application, MSH-6: Receiving Facility
  if (msh) {
    const sendingFacility = msh?.[3]?.[0]?.[0];
    const receivingFacility = msh?.[5]?.[0]?.[0];

    if (sendingFacility) {
      registerOrganization({
        id: `MSH-SEND-${sendingFacility}`,
        identifier: sendingFacility,
        name: msh?.[3]?.[0]?.[1] || sendingFacility,
        active: isDelete ? false : undefined,
        type: [{
          system: 'http://terminology.hl7.org/CodeSystem/organization-type',
          code: 'prov',
          display: 'Healthcare Provider'
        }]
      });
    }

    if (receivingFacility) {
      registerOrganization({
        id: `MSH-RECV-${receivingFacility}`,
        identifier: receivingFacility,
        name: msh?.[5]?.[0]?.[1] || receivingFacility,
        active: isDelete ? false : undefined,
        type: [{
          system: 'http://terminology.hl7.org/CodeSystem/organization-type',
          code: 'prov',
          display: 'Healthcare Provider'
        }]
      });
    }
  }

  if (encounter?.serviceProviderOrganizationId) {
    registerOrganization({
      id: `PV1-FAC-${encounter.serviceProviderOrganizationId}`,
      identifier: encounter.serviceProviderOrganizationId,
      name: encounter.serviceProviderOrganizationId,
      active: isDelete ? false : undefined
    });
  }

  if (organizations.length > 0) {
    result.organizations = organizations;
  }

  /* ───── Practitioners (from PRD) ───── */
  const practitioners: any[] = [];
  const practitionerRoles: any[] = [];
  const practitionerIndex = new Map<string, any>();

  function registerPractitioner(practitioner: any) {
    if (!practitioner) return;
    const key = practitioner.identifier || practitioner.id;
    if (!key) return;
    if (practitionerIndex.has(key)) return;
    practitionerIndex.set(key, practitioner);
    practitioners.push(practitioner);
  }

  function parseXcn(field: any[]) {
    const id = field?.[0];
    const family = field?.[1];
    const given = field?.[2] ? [field[2]].filter(Boolean) : [];
    const prefix = field?.[5] ? [field[5]].filter(Boolean) : undefined;
    const suffix = field?.[4] ? [field[4]].filter(Boolean) : undefined;
    return {
      id,
      name: {
        family,
        given,
        prefix,
        suffix
      }
    };
  }
  // PRD segments: Provider Data
  const prdSegments = parsed.PRD ?? [];
  for (const prd of prdSegments) {
    const providerName = prd?.[1]?.[0] ?? [];
    const parsedPerson = parseXcn(providerName);
    if (parsedPerson.id) {
      registerPractitioner({
        id: parsedPerson.id,
        identifier: parsedPerson.id,
        name: parsedPerson.name,
        active: isDelete ? false : undefined
      });
    }

    const orgField = prd?.[6]?.[0] ?? [];
    const orgId = orgField[0];
    const orgName = orgField[1] || orgId;
    if (orgId || orgName) {
      registerOrganization({
        id: `PRD-ORG-${orgId || orgName}`,
        identifier: orgId || orgName,
        name: orgName,
        active: isDelete ? false : undefined,
        type: [{
          system: 'http://terminology.hl7.org/CodeSystem/organization-type',
          code: 'prov',
          display: 'Healthcare Provider'
        }]
      });
    }

  }

  /* ───── Practitioners (from ROL) ───── */
  const rolSegments = parsed.ROL ?? [];
  for (const rol of rolSegments) {
    // ROL-4: Role Person (ID + name components)
    const rolePerson = rol?.[3]?.[0] ?? [];
    const rolePersonId = rolePerson[0];

    if (rolePersonId) {
      const nameParts = rolePerson.slice(1, 5).filter(Boolean);
      const family = nameParts[nameParts.length - 1];
      const given = nameParts.slice(0, -1);

      registerPractitioner({
        id: rolePersonId,
        identifier: rolePersonId,
        name: {
          family,
          given
        },
        active: isDelete ? false : undefined
      });

      // ROL-3: Role (code^display), ROL-5/6: Begin/End
      const roleCode = rol?.[2]?.[0] ?? [];
      const roleKey = `${rolePersonId}-${roleCode[0] || ''}-${roleCode[1] || ''}`;
      if (!practitionerRoles.find(pr => pr.id === `ROL-${roleKey}`)) {
        practitionerRoles.push({
          id: `ROL-${roleKey}`,
          practitionerId: rolePersonId,
          code: roleCode.length > 0 ? [{
            code: roleCode[0],
            display: roleCode[1]
          }] : undefined,
          period: {
            start: toFHIRDate(rol?.[4]?.[0]?.[0]), // ROL-5: Role Begin Date/Time
            end: toFHIRDate(rol?.[5]?.[0]?.[0])    // ROL-6: Role End Date/Time
          }
        });
      }
    }
  }

  if (practitioners.length > 0) {
    result.practitioners = practitioners;
  }
  if (practitionerRoles.length > 0) {
    result.practitionerRoles = practitionerRoles;
  }

  /* ───── PractitionerRole (from PRT) ───── */
  const prtSegments = parsed.PRT ?? [];
  for (const prt of prtSegments) {
    const participantId = prt?.[3]?.[0]?.[0];
    if (participantId && !practitionerRoles.find(pr => pr.practitionerId === participantId)) {
      practitionerRoles.push({
        id: `PRT-${participantId}`,
        practitionerId: participantId,
        organizationId: prt?.[5]?.[0]?.[0], // PRT-5: Organization Unit Type
        code: prt?.[2]?.[0]?.[0] ? [{
          code: prt[2][0][0],
          display: prt[2][0][1]
        }] : undefined
      });
    }
  }

  if (practitionerRoles.length > 0) {
    result.practitionerRoles = practitionerRoles;
  }

  /* ───── CareTeams (from PRD/ROL) ───── */
  const careTeams: CanonicalCareTeam[] = [];
  const careTeamParticipants: Array<{
    member: string;
    role?: { code?: string; display?: string };
    onBehalfOf?: string;
  }> = [];

  for (const prd of prdSegments) {
    const providerName = prd?.[1]?.[0] ?? [];
    const parsedPerson = parseXcn(providerName);
    if (parsedPerson.id) {
      careTeamParticipants.push({ member: parsedPerson.id });
    }

    const orgField = prd?.[6]?.[0] ?? [];
    const orgId = orgField[0] || orgField[1];
    if (orgId && careTeamParticipants.length > 0) {
      careTeamParticipants[careTeamParticipants.length - 1].onBehalfOf = orgId;
    }
  }

  for (const rol of rolSegments) {
    const rolePerson = rol?.[3]?.[0] ?? [];
    const rolePersonId = rolePerson[0];
    const roleCode = rol?.[2]?.[0] ?? [];
    if (rolePersonId) {
      careTeamParticipants.push({
        member: rolePersonId,
        role: roleCode.length > 0 ? { code: roleCode[0], display: roleCode[1] } : undefined
      });
    }
  }

  if (careTeamParticipants.length > 0) {
    const careTeamId = `CARETEAM-${Date.now()}`;
    careTeams.push({
      id: careTeamId,
      identifier: careTeamId,
      status: 'active',
      name: 'Care Team',
      subject: patientId,
      participant: careTeamParticipants.map(participant => ({
        member: participant.member,
        role: participant.role,
        onBehalfOf: participant.onBehalfOf
      }))
    });
  }

  if (careTeams.length > 0) {
    result.careTeams = careTeams;
  }

  /* ───── Goals (from OBX/GOL) ───── */
  const goals: CanonicalGoal[] = [];
  const golSegments = parsed.GOL ?? [];
  for (const gol of golSegments) {
    const goalId = gol?.[0]?.[0]?.[0];
    const goalDesc = gol?.[3]?.[0]?.[1] || gol?.[3]?.[0]?.[0];
    const status = gol?.[4]?.[0]?.[0];
    if (!goalId && !goalDesc) continue;
    goals.push({
      id: goalId || `GOL-${Date.now()}`,
      identifier: goalId,
      lifecycleStatus: status || 'active',
      description: { text: goalDesc },
      subject: patientId
    });
  }

  if (goals.length === 0 && obxSegments.length > 0) {
    for (const obx of obxSegments) {
      const codeParts = obx?.[2]?.[0] ?? [];
      const display = codeParts[1] || codeParts[0];
      if (!display) continue;
      goals.push({
        id: `GOAL-${Date.now()}`,
        identifier: codeParts[0],
        lifecycleStatus: 'active',
        description: { text: display },
        subject: patientId
      });
      break;
    }
  }

  if (goals.length > 0) {
    result.goals = goals;
  }

  /* ───── ServiceRequests (from ORC/OBR) ───── */
  const serviceRequests: CanonicalServiceRequest[] = [];
  const srOrcSegments = parsed.ORC ?? [];
  const srObrSegments = parsed.OBR ?? [];

  for (const orc of srOrcSegments) {
    const placerId = orc?.[1]?.[0]?.[0];
    const fillerId = orc?.[2]?.[0]?.[0];
    const requestId = placerId || fillerId;
    const status = orc?.[4]?.[0]?.[0];
    const control = orc?.[0]?.[0]?.[0];

    if (!requestId && !control) continue;

    serviceRequests.push({
      id: requestId || `ORC-${Date.now()}`,
      identifier: requestId,
      status: status || 'active',
      intent: 'order',
      subject: patientId,
      encounter: encounter?.id
    });
  }

  for (const obr of srObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const requestId = placerId || fillerId;
    const serviceCode = obr?.[3]?.[0] ?? [];
    const codeValue = serviceCode[0];
    const display = serviceCode[1];
    const system = serviceCode[2];
    const status = obr?.[24]?.[0]?.[0];
    const authoredOn = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!requestId && !codeValue && !display) continue;

    serviceRequests.push({
      id: requestId || `OBR-${Date.now()}`,
      identifier: requestId,
      status: status || 'active',
      intent: 'order',
      code: codeValue || display ? {
        system: mapCodingSystem(system),
        code: codeValue,
        display: display
      } : undefined,
      subject: patientId,
      encounter: encounter?.id,
      authoredOn: authoredOn
    });
  }

  if (serviceRequests.length > 0) {
    result.serviceRequests = serviceRequests;
  }

  /* ───── Tasks (from ORC/OBR) ───── */
  const tasks: CanonicalTask[] = [];
  const taskOrcSegments = parsed.ORC ?? [];
  const taskObrSegments = parsed.OBR ?? [];

  for (const orc of taskOrcSegments) {
    const placerId = orc?.[1]?.[0]?.[0];
    const fillerId = orc?.[2]?.[0]?.[0];
    const taskId = placerId || fillerId;
    const status = orc?.[5]?.[0]?.[0] || orc?.[4]?.[0]?.[0];
    const control = orc?.[0]?.[0]?.[0];

    if (!taskId && !control) continue;

    tasks.push({
      id: taskId || `TASK-ORC-${Date.now()}`,
      identifier: taskId,
      status: status || 'requested',
      intent: 'order',
      for: patientId,
      encounter: encounter?.id
    });
  }

  for (const obr of taskObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const taskId = placerId || fillerId;
    const taskCode = obr?.[3]?.[0] ?? [];
    const codeValue = taskCode[0];
    const display = taskCode[1];
    const system = taskCode[2];
    const status = obr?.[25]?.[0]?.[0] || obr?.[24]?.[0]?.[0];
    const authoredOn = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!taskId && !codeValue && !display) continue;

    tasks.push({
      id: taskId || `TASK-OBR-${Date.now()}`,
      identifier: taskId,
      status: status || 'requested',
      intent: 'order',
      code: codeValue || display ? {
        system: mapCodingSystem(system),
        code: codeValue,
        display: display
      } : undefined,
      description: display || undefined,
      for: patientId,
      encounter: encounter?.id,
      authoredOn: authoredOn
    });
  }

  if (tasks.length > 0) {
    result.tasks = tasks;
  }

  /* ───── Communications (from ORC/OBR) ───── */
  const communications: CanonicalCommunication[] = [];
  const commOrcSegments = parsed.ORC ?? [];
  const commObrSegments = parsed.OBR ?? [];

  for (const orc of commOrcSegments) {
    const placerId = orc?.[1]?.[0]?.[0];
    const fillerId = orc?.[2]?.[0]?.[0];
    const commId = placerId || fillerId;
    const status = orc?.[5]?.[0]?.[0] || orc?.[4]?.[0]?.[0];
    const control = orc?.[0]?.[0]?.[0];

    if (!commId && !control) continue;

    communications.push({
      id: commId || `COMM-ORC-${Date.now()}`,
      identifier: commId,
      status: status || 'completed',
      subject: patientId,
      encounter: encounter?.id
    });
  }

  for (const obr of commObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const commId = placerId || fillerId;
    const topicCode = obr?.[3]?.[0] ?? [];
    const codeValue = topicCode[0];
    const display = topicCode[1];
    const system = topicCode[2];
    const status = obr?.[25]?.[0]?.[0] || obr?.[24]?.[0]?.[0];
    const sent = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!commId && !codeValue && !display) continue;

    communications.push({
      id: commId || `COMM-OBR-${Date.now()}`,
      identifier: commId,
      status: status || 'completed',
      topic: codeValue || display ? {
        system: mapCodingSystem(system),
        code: codeValue,
        display: display
      } : undefined,
      subject: patientId,
      encounter: encounter?.id,
      sent: sent
    });
  }

  if (communications.length > 0) {
    result.communications = communications;
  }

  /* ───── CommunicationRequests (from ORC/OBR) ───── */
  const communicationRequests: CanonicalCommunicationRequest[] = [];
  const commReqOrcSegments = parsed.ORC ?? [];
  const commReqObrSegments = parsed.OBR ?? [];

  for (const orc of commReqOrcSegments) {
    const placerId = orc?.[1]?.[0]?.[0];
    const fillerId = orc?.[2]?.[0]?.[0];
    const reqId = placerId || fillerId;
    const status = orc?.[5]?.[0]?.[0] || orc?.[4]?.[0]?.[0];
    const control = orc?.[0]?.[0]?.[0];

    if (!reqId && !control) continue;

    communicationRequests.push({
      id: reqId || `COMMREQ-ORC-${Date.now()}`,
      identifier: reqId,
      status: status || 'active',
      intent: 'order',
      subject: patientId,
      encounter: encounter?.id
    });
  }

  for (const obr of commReqObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const reqId = placerId || fillerId;
    const topicCode = obr?.[3]?.[0] ?? [];
    const codeValue = topicCode[0];
    const display = topicCode[1];
    const system = topicCode[2];
    const status = obr?.[25]?.[0]?.[0] || obr?.[24]?.[0]?.[0];
    const occurrence = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!reqId && !codeValue && !display) continue;

    communicationRequests.push({
      id: reqId || `COMMREQ-OBR-${Date.now()}`,
      identifier: reqId,
      status: status || 'active',
      intent: 'order',
      category: codeValue || display ? [{
        system: mapCodingSystem(system),
        code: codeValue,
        display: display
      }] : undefined,
      subject: patientId,
      encounter: encounter?.id,
      occurrenceDateTime: occurrence
    });
  }

  if (communicationRequests.length > 0) {
    result.communicationRequests = communicationRequests;
  }

  /* ───── Questionnaires (from OBR) ───── */
  const questionnaires: CanonicalQuestionnaire[] = [];
  const qnrObrSegments = parsed.OBR ?? [];
  for (const obr of qnrObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const questionnaireId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const codeValue = codeParts[0];
    const display = codeParts[1];
    const system = codeParts[2];
    const date = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!questionnaireId && !display && !codeValue) continue;

    questionnaires.push({
      id: questionnaireId || `QNR-${Date.now()}`,
      identifier: questionnaireId,
      url: questionnaireId ? `urn:hl7v2:questionnaire:${questionnaireId}` : undefined,
      status: 'active',
      title: display,
      name: codeValue,
      date: date,
      item: display ? [{ linkId: codeValue || `Q${questionnaires.length + 1}`, text: display, type: 'string' }] : undefined
    });
  }

  if (questionnaires.length > 0) {
    result.questionnaires = questionnaires;
  }

  /* ───── QuestionnaireResponses (from OBR/OBX) ───── */
  const questionnaireResponses: CanonicalQuestionnaireResponse[] = [];
  const qnrRespObrSegments = parsed.OBR ?? [];
  const qnrRespObxSegments = parsed.OBX ?? [];

  for (const obr of qnrRespObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const responseId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const questionnaireId = codeParts[0];
    const display = codeParts[1];
    const authored = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);
    const questionnaireRef = questionnaireId
      ? `urn:hl7v2:questionnaire:${questionnaireId}`
      : responseId
        ? `urn:hl7v2:questionnaire:${responseId}`
        : 'urn:hl7v2:questionnaire:obr';

    if (!responseId && !questionnaireId && !display) continue;

    questionnaireResponses.push({
      id: responseId || `QNRRESP-${Date.now()}`,
      identifier: responseId,
      status: 'completed',
      questionnaire: questionnaireRef,
      subject: patientId,
      encounter: encounter?.id,
      authored: authored,
      item: display ? [{ linkId: questionnaireId || `Q${questionnaireResponses.length + 1}`, text: display }] : undefined
    });
  }

  for (const obx of qnrRespObxSegments) {
    const codeParts = obx?.[2]?.[0] ?? [];
    const linkId = codeParts[0];
    const text = codeParts[1] || linkId;
    const value = obx?.[5]?.[0]?.[0];
    if (!linkId && !text && !value) continue;

    const obxQuestionnaireRef = linkId ? `urn:hl7v2:questionnaire:${linkId}` : 'urn:hl7v2:questionnaire:obx';
    questionnaireResponses.push({
      id: `QNRRESP-OBX-${Date.now()}`,
      status: 'completed',
      questionnaire: obxQuestionnaireRef,
      subject: patientId,
      encounter: encounter?.id,
      item: [{
        linkId: linkId,
        text: text,
        answer: value ? [String(value)] : undefined
      }]
    });
  }

  if (questionnaireResponses.length > 0) {
    result.questionnaireResponses = questionnaireResponses;
  }

  /* ───── CodeSystems (from OBR) ───── */
  const codeSystems: CanonicalCodeSystem[] = [];
  const codeSystemObrSegments = parsed.OBR ?? [];
  for (const obr of codeSystemObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const codeSystemId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const codeValue = codeParts[0];
    const display = codeParts[1];
    const system = codeParts[2];
    const date = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!codeSystemId && !codeValue && !display) continue;

    codeSystems.push({
      id: codeSystemId || `CODESYS-${Date.now()}`,
      identifier: codeSystemId,
      status: 'active',
      name: codeValue,
      title: display,
      url: system,
      date: date,
      concept: codeValue || display ? [{
        code: codeValue,
        display: display
      }] : undefined
    });
  }

  if (codeSystems.length > 0) {
    result.codeSystems = codeSystems;
  }

  /* ───── ValueSets (from OBR) ───── */
  const valueSets: CanonicalValueSet[] = [];
  const valueSetObrSegments = parsed.OBR ?? [];
  for (const obr of valueSetObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const valueSetId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const codeValue = codeParts[0];
    const display = codeParts[1];
    const system = codeParts[2];
    const date = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!valueSetId && !codeValue && !display) continue;

    valueSets.push({
      id: valueSetId || `VALSET-${Date.now()}`,
      identifier: valueSetId,
      status: 'active',
      title: display,
      date: date,
      compose: system || codeValue || display ? {
        include: [{
          system: system,
          concept: codeValue || display ? [{
            code: codeValue,
            display: display
          }] : undefined
        }]
      } : undefined
    });
  }

  if (valueSets.length > 0) {
    result.valueSets = valueSets;
  }

  /* ───── ConceptMaps (from OBR) ───── */
  const conceptMaps: CanonicalConceptMap[] = [];
  const conceptMapObrSegments = parsed.OBR ?? [];
  for (const obr of conceptMapObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const conceptMapId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const codeValue = codeParts[0];
    const display = codeParts[1];
    const system = codeParts[2];
    const date = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!conceptMapId && !codeValue && !display) continue;

    conceptMaps.push({
      id: conceptMapId || `CONMAP-${Date.now()}`,
      identifier: conceptMapId,
      status: 'active',
      title: display,
      date: date,
      group: system || codeValue || display ? [{
        source: system,
        element: [{
          code: codeValue,
          display: display,
          target: display ? [{
            code: codeValue,
            display: display,
            relationship: 'equivalent'
          }] : undefined
        }]
      }] : undefined
    });
  }

  if (conceptMaps.length > 0) {
    result.conceptMaps = conceptMaps;
  }

  /* ───── NamingSystems (from OBR) ───── */
  const namingSystems: CanonicalNamingSystem[] = [];
  const namingSystemObrSegments = parsed.OBR ?? [];
  for (const obr of namingSystemObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const namingSystemId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const codeValue = codeParts[0];
    const display = codeParts[1];
    const system = codeParts[2];
    const date = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!namingSystemId && !codeValue && !display) continue;

    namingSystems.push({
      id: namingSystemId || `NAMESYS-${Date.now()}`,
      identifier: namingSystemId,
      status: 'active',
      name: display,
      date: date,
      kind: system,
      uniqueId: display ? [{
        type: 'uri',
        value: display,
        preferred: true
      }] : undefined
    });
  }

  if (namingSystems.length > 0) {
    result.namingSystems = namingSystems;
  }

  /* ───── TerminologyCapabilities (from OBR) ───── */
  const terminologyCapabilities: CanonicalTerminologyCapabilities[] = [];
  const terminologyCapabilitiesObrSegments = parsed.OBR ?? [];
  for (const obr of terminologyCapabilitiesObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const tcId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const codeValue = codeParts[0];
    const display = codeParts[1];
    const system = codeParts[2];
    const date = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!tcId && !codeValue && !display) continue;

    terminologyCapabilities.push({
      id: tcId || `TERMCAP-${Date.now()}`,
      identifier: tcId,
      status: 'active',
      name: display,
      date: date,
      kind: system,
      codeSearch: codeValue
    });
  }

  if (terminologyCapabilities.length > 0) {
    result.terminologyCapabilities = terminologyCapabilities;
  }

  /* ───── Provenances (from OBR) ───── */
  const provenances: CanonicalProvenance[] = [];
  const provenanceObrSegments = parsed.OBR ?? [];
  for (const obr of provenanceObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const provId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const codeValue = codeParts[0];
    const display = codeParts[1];
    const date = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!provId && !codeValue && !display) continue;

    provenances.push({
      id: provId || `PROV-${Date.now()}`,
      recorded: date,
      activity: display || codeValue
    });
  }

  if (provenances.length > 0) {
    result.provenances = provenances;
  }

  /* ───── AuditEvents (from OBR) ───── */
  const auditEvents: CanonicalAuditEvent[] = [];
  const auditEventObrSegments = parsed.OBR ?? [];
  for (const obr of auditEventObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const auditId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const codeValue = codeParts[0];
    const display = codeParts[1];
    const action = codeParts[2];
    const date = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!auditId && !codeValue && !display) continue;

    auditEvents.push({
      id: auditId || `AUDIT-${Date.now()}`,
      code: display || codeValue,
      severity: codeValue,
      action: action,
      recorded: date
    });
  }

  if (auditEvents.length > 0) {
    result.auditEvents = auditEvents;
  }

  /* ───── Consents (from OBR) ───── */
  const consents: CanonicalConsent[] = [];
  const consentObrSegments = parsed.OBR ?? [];
  for (const obr of consentObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const consentId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const codeValue = codeParts[0];
    const display = codeParts[1];
    const status = codeParts[2];
    const date = toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!consentId && !codeValue && !display) continue;

    consents.push({
      id: consentId || `CONSENT-${Date.now()}`,
      status: status || 'active',
      category: display,
      date: date,
      decision: codeValue
    });
  }

  if (consents.length > 0) {
    result.consents = consents;
  }

  /* ───── MedicationRequests (from RXO, RXE) ───── */
  const medicationRequests: any[] = [];

  // RXO: Pharmacy/Treatment Order
  const rxoSegments = parsed.RXO ?? [];
  for (const rxo of rxoSegments) {
    const requestedGiveCode = rxo?.[1]?.[0] ?? [];
    medicationRequests.push({
      id: `RXO-${rxo?.[0]?.[0]?.[0] || Date.now()}`,
      identifier: rxo?.[0]?.[0]?.[0],
      intent: 'order',
      status: 'active',
      medicationCodeableConcept: {
        coding: requestedGiveCode[0] ? [{
          code: requestedGiveCode[0],
          display: requestedGiveCode[1],
          system: mapCodingSystem(requestedGiveCode[2])
        }] : [],
        text: requestedGiveCode[1]
      },
      dosageInstruction: rxo?.[4]?.[0]?.[0] ? [{
        text: rxo[4][0][0] // RXO-5: Requested Give Amount - Minimum
      }] : []
    });
  }

  // RXE: Pharmacy/Treatment Encoded Order
  const rxeSegments = parsed.RXE ?? [];
  for (const rxe of rxeSegments) {
    const giveCode = rxe?.[2]?.[0] ?? [];
    medicationRequests.push({
      id: `RXE-${rxe?.[0]?.[0]?.[0] || Date.now()}`,
      identifier: rxe?.[0]?.[0]?.[0],
      intent: 'order',
      status: 'active',
      medicationCodeableConcept: {
        coding: giveCode[0] ? [{
          code: giveCode[0],
          display: giveCode[1],
          system: mapCodingSystem(giveCode[2])
        }] : [],
        text: giveCode[1]
      },
      dosageInstruction: rxe?.[5]?.[0]?.[0] ? [{
        text: rxe[5][0][0] // RXE-6: Give Units
      }] : []
    });
  }

  if (medicationRequests.length > 0) {
    result.medicationRequests = medicationRequests;
  }

  const rxaSegments = parsed.RXA ?? [];

  /* ───── MedicationStatements (from RXA) ───── */
  const medicationStatements: CanonicalMedicationStatement[] = [];
  for (const rxa of rxaSegments) {
    const administeredCode = rxa?.[4]?.[0] ?? [];
    const medCode = administeredCode[0];
    const medDisplay = administeredCode[1];
    const medSystem = administeredCode[2];
    if (!medCode && !medDisplay) continue;

    const doseValue = rxa?.[5]?.[0]?.[0];
    const doseUnit = rxa?.[5]?.[0]?.[1];
    const effectiveDate = toFHIRDateTime(rxa?.[2]?.[0]?.[0]) || toFHIRDate(rxa?.[2]?.[0]?.[0]);

    medicationStatements.push({
      id: `RXA-${medCode || Date.now()}`,
      identifier: medCode,
      status: 'recorded',
      medicationCodeableConcept: {
        coding: medCode ? [{
          system: mapCodingSystem(medSystem),
          code: medCode,
          display: medDisplay
        }] : undefined,
        text: medDisplay
      },
      subject: patientId,
      encounter: encounter?.id,
      effectiveDateTime: effectiveDate,
      dosage: doseValue ? [{
        doseQuantity: {
          value: Number(doseValue),
          unit: doseUnit
        }
      }] : undefined
    });
  }

  if (medicationStatements.length > 0) {
    result.medicationStatements = medicationStatements;
  }

  /* ───── MedicationAdministrations (from RXA) ───── */
  const medicationAdministrations: CanonicalMedicationAdministration[] = [];
  for (const rxa of rxaSegments) {
    const administeredCode = rxa?.[4]?.[0] ?? [];
    const medCode = administeredCode[0];
    const medDisplay = administeredCode[1];
    const medSystem = administeredCode[2];
    if (!medCode && !medDisplay) continue;

    const doseValue = rxa?.[5]?.[0]?.[0];
    const doseUnit = rxa?.[5]?.[0]?.[1];
    const occurrenceDate = toFHIRDateTime(rxa?.[2]?.[0]?.[0]) || toFHIRDate(rxa?.[2]?.[0]?.[0]);

    medicationAdministrations.push({
      id: `RXA-ADMIN-${medCode || Date.now()}`,
      identifier: medCode,
      status: 'completed',
      medicationCodeableConcept: medCode ? {
        coding: [{
          system: mapCodingSystem(medSystem),
          code: medCode,
          display: medDisplay
        }],
        text: medDisplay
      } : undefined,
      subject: patientId,
      encounter: encounter?.id,
      occurrenceDateTime: occurrenceDate,
      dosage: doseValue ? {
        dose: {
          value: Number(doseValue),
          unit: doseUnit
        }
      } : undefined
    });
  }

  if (medicationAdministrations.length > 0) {
    result.medicationAdministrations = medicationAdministrations;
  }

  /* ───── MedicationDispenses (from RXD) ───── */
  const medicationDispenses: CanonicalMedicationDispense[] = [];
  const rxdSegments = parsed.RXD ?? [];
  for (const rxd of rxdSegments) {
    const dispenseCode = rxd?.[1]?.[0] ?? [];
    const medCode = dispenseCode[0];
    const medDisplay = dispenseCode[1];
    const medSystem = dispenseCode[2];
    if (!medCode && !medDisplay) continue;

    const quantityValue = rxd?.[3]?.[0]?.[0];
    const quantityUnit = rxd?.[4]?.[0]?.[0];
    const whenHandedOver = toFHIRDateTime(rxd?.[7]?.[0]?.[0]) || toFHIRDate(rxd?.[7]?.[0]?.[0]);

    medicationDispenses.push({
      id: `RXD-${medCode || Date.now()}`,
      identifier: medCode,
      status: 'completed',
      medicationCodeableConcept: medCode || medDisplay ? {
        coding: medCode ? [{
          system: mapCodingSystem(medSystem),
          code: medCode,
          display: medDisplay
        }] : undefined,
        text: medDisplay
      } : undefined,
      subject: patientId,
      encounter: encounter?.id,
      whenHandedOver: whenHandedOver,
      quantity: quantityValue ? {
        value: Number(quantityValue),
        unit: quantityUnit
      } : undefined
    });
  }

  if (medicationDispenses.length > 0) {
    result.medicationDispenses = medicationDispenses;
  }

  /* ───── OrganizationAffiliations (from OBR) ───── */
  const organizationAffiliations: CanonicalOrganizationAffiliation[] = [];
  const orgAffilObrSegments = parsed.OBR ?? [];
  for (const obr of orgAffilObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const affiliationId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const codeValue = codeParts[0];
    const display = codeParts[1];
    const system = codeParts[2];
    const date = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!affiliationId && !codeValue && !display) continue;

    organizationAffiliations.push({
      id: affiliationId || `ORGAFF-${Date.now()}`,
      identifier: affiliationId,
      active: true,
      period: date ? { start: date } : undefined,
      code: (codeValue || display) ? [{
        system: mapCodingSystem(system),
        code: codeValue,
        display: display
      }] : undefined
    });
  }

  if (organizationAffiliations.length > 0) {
    result.organizationAffiliations = organizationAffiliations;
  }

  /* ───── Persons (from OBR) ───── */
  const persons: CanonicalPerson[] = [];
  const personObrSegments = parsed.OBR ?? [];
  for (const obr of personObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const personId = placerId || fillerId;
    const codeParts = obr?.[3]?.[0] ?? [];
    const display = codeParts[1];
    const date = toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!personId && !display) continue;

    persons.push({
      id: personId || `PERSON-${Date.now()}`,
      identifier: personId,
      name: display ? { family: display } : undefined,
      birthDate: date
    });
  }

  if (persons.length > 0) {
    result.persons = persons;
  }

  /* ───── Immunizations (from RXA) ───── */
  const immunizations: CanonicalImmunization[] = [];
  for (const rxa of rxaSegments) {
    const administeredCode = rxa?.[4]?.[0] ?? [];
    const vaccineCode = administeredCode[0];
    const vaccineDisplay = administeredCode[1];
    const vaccineSystem = administeredCode[2];
    if (!vaccineCode && !vaccineDisplay) continue;

    const lotNumber = rxa?.[14]?.[0]?.[0];
    const expirationDate = rxa?.[15]?.[0]?.[0];
    const occurrenceDate = toFHIRDateTime(rxa?.[2]?.[0]?.[0]) || toFHIRDate(rxa?.[2]?.[0]?.[0]);
    const doseValue = rxa?.[5]?.[0]?.[0];
    const doseUnit = rxa?.[5]?.[0]?.[1];
    const status = rxa?.[19]?.[0]?.[0];

    immunizations.push({
      id: `IMMU-${vaccineCode || Date.now()}`,
      identifier: vaccineCode,
      status: status || 'completed',
      vaccineCode: vaccineCode || vaccineDisplay ? {
        system: mapCodingSystem(vaccineSystem),
        code: vaccineCode,
        display: vaccineDisplay
      } : undefined,
      lotNumber: lotNumber,
      expirationDate: expirationDate ? toFHIRDate(expirationDate) : undefined,
      patient: patientId,
      encounter: encounter?.id,
      occurrenceDateTime: occurrenceDate,
      doseQuantity: doseValue ? {
        value: Number(doseValue),
        unit: doseUnit
      } : undefined
    });
  }

  if (immunizations.length > 0) {
    result.immunizations = immunizations;
  }

  /* ───── OperationOutcomes (from MSA/ERR) ───── */
  const operationOutcomes: CanonicalOperationOutcome[] = [];
  const msaSegments = parsed.MSA ?? [];
  const errSegments = parsed.ERR ?? [];

  if (msaSegments.length || errSegments.length) {
    const issues: Array<{
      severity?: string;
      code?: string;
      diagnostics?: string;
    }> = [];

    for (const msa of msaSegments) {
      const ackCode = msa?.[0]?.[0]?.[0];
      const message = msa?.[2]?.[0]?.[0];
      if (ackCode || message) {
        issues.push({
          severity: ackCode && ackCode !== 'AA' ? 'error' : 'information',
          code: 'processing',
          diagnostics: message || `HL7v2 acknowledgement: ${ackCode || 'AA'}`
        });
      }
    }

    for (const err of errSegments) {
      const errText = err?.[7]?.[0]?.[0] || err?.[8]?.[0]?.[0];
      if (errText) {
        issues.push({
          severity: 'error',
          code: 'processing',
          diagnostics: errText
        });
      }
    }

    if (issues.length > 0) {
      operationOutcomes.push({
        id: `OO-${Date.now()}`,
        issue: issues
      });
    }
  }

  if (operationOutcomes.length > 0) {
    result.operationOutcomes = operationOutcomes;
  }

  /* ───── Procedures (from PR1) ───── */
  const procedures: CanonicalProcedure[] = [];
  const pr1Segments = parsed.PR1 ?? [];
  for (const pr1 of pr1Segments) {
    const procCodeParts = pr1?.[2]?.[0] ?? [];
    const procCode = procCodeParts[0];
    const procDisplay = procCodeParts[1];
    const procSystem = procCodeParts[2];
    if (!procCode && !procDisplay) continue;

    const occurrence = toFHIRDateTime(pr1?.[5]?.[0]?.[0]) || toFHIRDate(pr1?.[5]?.[0]?.[0]);
    const performerId = pr1?.[7]?.[0]?.[0];

    procedures.push({
      id: `PR1-${procCode || Date.now()}`,
      identifier: procCode,
      status: 'completed',
      code: {
        coding: procCode ? [{
          system: mapCodingSystem(procSystem),
          code: procCode,
          display: procDisplay
        }] : undefined,
        text: procDisplay
      },
      subject: patientId,
      encounter: encounter?.id,
      occurrenceDateTime: occurrence,
      performer: performerId ? [{ actor: performerId }] : undefined
    });
  }

  if (procedures.length > 0) {
    result.procedures = procedures;
  }

  /* ───── Conditions (from DG1) ───── */
  const conditions: CanonicalCondition[] = [];
  const dg1Segments = parsed.DG1 ?? [];
  for (const dg1 of dg1Segments) {
    const diagnosisCode = dg1?.[2]?.[0] ?? [];
    const codeValue = diagnosisCode[0];
    const display = diagnosisCode[1];
    const system = diagnosisCode[2];
    if (!codeValue && !display) continue;

    const onset = toFHIRDateTime(dg1?.[4]?.[0]?.[0]) || toFHIRDate(dg1?.[4]?.[0]?.[0]);
    const clinicalStatus = dg1?.[5]?.[0]?.[0];
    const mappedClinicalStatus = mapConditionClinicalStatus(clinicalStatus);
    const codingSystem = mapCodingSystem(system);
    const codingDisplay = codingSystem === 'http://snomed.info/sct' ? undefined : display;

    conditions.push({
      id: `DG1-${codeValue || Date.now()}`,
      identifier: codeValue,
      clinicalStatus: mappedClinicalStatus ? {
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: mappedClinicalStatus,
        display: mapConditionClinicalStatusDisplay(mappedClinicalStatus)
      } : undefined,
      code: {
        coding: codeValue ? [{
          system: codingSystem,
          code: codeValue,
          display: codingDisplay
        }] : undefined,
        text: display
      },
      subject: patientId,
      encounter: encounter?.id,
      onsetDateTime: onset
    });
  }

  if (conditions.length > 0) {
    result.conditions = conditions;
  }

  /* ───── Appointments (from SCH/ARQ) ───── */
  const appointments: CanonicalAppointment[] = [];
  const schSegments = parsed.SCH ?? [];
  const arqSegments = parsed.ARQ ?? [];

  for (const sch of schSegments) {
    const placerId = sch?.[0]?.[0]?.[0];
    const fillerId = sch?.[1]?.[0]?.[0];
    const appointmentId = placerId || fillerId;
    const status = sch?.[24]?.[0]?.[0];
    const description = sch?.[6]?.[0]?.[1] || sch?.[6]?.[0]?.[0];
    const timing = sch?.[10]?.[0];
    const start = toFHIRDateTime(timing?.[0]) || toFHIRDateTime(sch?.[11]?.[0]?.[0]);
    const end = toFHIRDateTime(timing?.[1]);
    const durationValue = sch?.[8]?.[0]?.[0];
    const minutesDuration = durationValue ? Number(durationValue) : undefined;

    if (!appointmentId && !start && !end) continue;

    appointments.push({
      id: appointmentId || `SCH-${Date.now()}`,
      identifier: appointmentId || undefined,
      status: status || 'proposed',
      description: description,
      start: start,
      end: end,
      minutesDuration: Number.isFinite(minutesDuration) ? minutesDuration : undefined,
      subject: patientId
    });
  }

  for (const arq of arqSegments) {
    const placerId = arq?.[0]?.[0]?.[0];
    const appointmentId = placerId;
    const status = arq?.[6]?.[0]?.[0];
    const timing = arq?.[9]?.[0];
    const start = toFHIRDateTime(timing?.[0]) || toFHIRDateTime(arq?.[10]?.[0]?.[0]);
    const end = toFHIRDateTime(timing?.[1]);
    const durationValue = arq?.[8]?.[0]?.[0];
    const minutesDuration = durationValue ? Number(durationValue) : undefined;

    if (!appointmentId && !start && !end) continue;

    appointments.push({
      id: appointmentId || `ARQ-${Date.now()}`,
      identifier: appointmentId || undefined,
      status: status || 'proposed',
      start: start,
      end: end,
      minutesDuration: Number.isFinite(minutesDuration) ? minutesDuration : undefined,
      subject: patientId
    });
  }

  if (appointments.length > 0) {
    result.appointments = appointments;
  }

  /* ───── Schedules & Slots (from SCH/ARQ) ───── */
  const schedules: CanonicalSchedule[] = [];
  const slots: CanonicalSlot[] = [];
  for (const sch of schSegments) {
    const placerId = sch?.[0]?.[0]?.[0];
    const fillerId = sch?.[1]?.[0]?.[0];
    const scheduleId = placerId || fillerId;
    const name = sch?.[5]?.[0]?.[1] || sch?.[5]?.[0]?.[0];
    const timing = sch?.[10]?.[0];
    const start = toFHIRDateTime(timing?.[0]) || toFHIRDateTime(sch?.[11]?.[0]?.[0]);
    const end = toFHIRDateTime(timing?.[1]);

    if (!scheduleId && !start && !end && !name) continue;

    schedules.push({
      id: scheduleId || `SCH-SCHED-${Date.now()}`,
      identifier: scheduleId,
      active: true,
      name: name,
      actor: patientId ? [patientId] : undefined,
      planningHorizon: start || end ? { start, end } : undefined
    });

    if (start || end) {
      slots.push({
        id: `SCH-SLOT-${scheduleId || Date.now()}`,
        identifier: scheduleId,
        schedule: scheduleId,
        status: 'free',
        start: start,
        end: end
      });
    }
  }

  for (const arq of arqSegments) {
    const placerId = arq?.[0]?.[0]?.[0];
    const scheduleId = placerId;
    const timing = arq?.[9]?.[0];
    const start = toFHIRDateTime(timing?.[0]) || toFHIRDateTime(arq?.[10]?.[0]?.[0]);
    const end = toFHIRDateTime(timing?.[1]);

    if (!scheduleId && !start && !end) continue;

    schedules.push({
      id: scheduleId || `ARQ-SCHED-${Date.now()}`,
      identifier: scheduleId,
      active: true,
      actor: patientId ? [patientId] : undefined,
      planningHorizon: start || end ? { start, end } : undefined
    });

    if (start || end) {
      slots.push({
        id: `ARQ-SLOT-${scheduleId || Date.now()}`,
        identifier: scheduleId,
        schedule: scheduleId,
        status: 'free',
        start: start,
        end: end
      });
    }
  }

  if (schedules.length > 0) {
    result.schedules = schedules;
  }
  if (slots.length > 0) {
    result.slots = slots;
  }

  /* ───── DiagnosticReports (from OBR) ───── */
  const diagnosticReports: CanonicalDiagnosticReport[] = [];
  const diagnosticObrSegments = parsed.OBR ?? [];
  for (const obr of diagnosticObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const reportId = placerId || fillerId;
    const serviceCode = obr?.[3]?.[0] ?? [];
    const codeValue = serviceCode[0];
    const display = serviceCode[1];
    const system = serviceCode[2];
    const status = obr?.[24]?.[0]?.[0];
    const effective = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);
    const issued = toFHIRDateTime(obr?.[21]?.[0]?.[0]) || toFHIRDateTime(obr?.[22]?.[0]?.[0]);

    if (!reportId && !codeValue && !display) continue;

    diagnosticReports.push({
      id: reportId || `OBR-${Date.now()}`,
      identifier: reportId,
      status: status || 'final',
      code: codeValue || display ? {
        coding: codeValue ? [{
          system: mapCodingSystem(system),
          code: codeValue,
          display: display
        }] : undefined,
        text: display
      } : undefined,
      subject: patientId,
      encounter: encounter?.id,
      effectiveDateTime: effective,
      issued: issued
    });
  }

  if (diagnosticReports.length > 0) {
    result.diagnosticReports = diagnosticReports;
  }

  /* ───── ImagingStudies (from OBR) ───── */
  const imagingStudies: CanonicalImagingStudy[] = [];
  for (const obr of diagnosticObrSegments) {
    const placerId = obr?.[1]?.[0]?.[0];
    const fillerId = obr?.[2]?.[0]?.[0];
    const studyId = placerId || fillerId;
    const serviceCode = obr?.[3]?.[0] ?? [];
    const codeValue = serviceCode[0];
    const display = serviceCode[1];
    const system = serviceCode[2];
    const status = obr?.[24]?.[0]?.[0];
    const started = toFHIRDateTime(obr?.[6]?.[0]?.[0]) || toFHIRDate(obr?.[6]?.[0]?.[0]);

    if (!studyId && !codeValue && !display) continue;

    imagingStudies.push({
      id: studyId || `OBR-IMG-${Date.now()}`,
      identifier: studyId,
      status: status || 'available',
      modality: (codeValue || display) ? [{
        system: mapCodingSystem(system),
        code: codeValue,
        display: display
      }] : undefined,
      subject: patientId,
      encounter: encounter?.id,
      started: started,
      description: display
    });
  }

  if (imagingStudies.length > 0) {
    result.imagingStudies = imagingStudies;
  }

  /* ───── AllergyIntolerances (from AL1) ───── */
  const allergyIntolerances: CanonicalAllergyIntolerance[] = [];
  const al1Segments = parsed.AL1 ?? [];
  for (const al1 of al1Segments) {
    const setId = al1?.[0]?.[0]?.[0];
    const allergyType = al1?.[1]?.[0]?.[0];
    const codeParts = al1?.[2]?.[0] ?? [];
    const codeValue = codeParts[0];
    const display = codeParts[1];
    const system = codeParts[2];
    const severity = al1?.[3]?.[0]?.[0];
    const mappedSeverity = mapAllergySeverity(severity);
    const criticality = mappedSeverity === 'severe' ? 'high' : mappedSeverity ? 'low' : undefined;
    const reactionText = al1?.[4]?.[0]?.[0];
    const identificationDate = toFHIRDateTime(al1?.[5]?.[0]?.[0]) || toFHIRDate(al1?.[5]?.[0]?.[0]);

    if (!codeValue && !display && !reactionText) continue;

    allergyIntolerances.push({
      id: setId || `AL1-${codeValue || Date.now()}`,
      identifier: setId || codeValue,
      clinicalStatus: {
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical',
        code: 'active',
        display: 'active'
      },
      verificationStatus: {
        system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification',
        code: 'confirmed',
        display: 'confirmed'
      },
      type: allergyType ? { code: allergyType, display: allergyType } : undefined,
      criticality: criticality,
      code: codeValue || display ? {
        system: mapCodingSystem(system),
        code: codeValue,
        display: display
      } : undefined,
      patient: patientId,
      encounter: encounter?.id,
      recordedDate: identificationDate,
      reaction: reactionText ? [{
        description: reactionText,
        manifestation: [{
          display: reactionText
        }],
        severity: mappedSeverity
      }] : undefined
    });
  }

  if (allergyIntolerances.length > 0) {
    result.allergyIntolerances = allergyIntolerances;
  }

  /* ───── RelatedPersons (from NK1) ───── */
  const relatedPersons: CanonicalRelatedPerson[] = [];
  const nk1Segments = parsed.NK1 ?? [];
  for (const nk1 of nk1Segments) {
    const relatedId = nk1?.[0]?.[0]?.[0];
    const nameParts = nk1?.[1]?.[0] ?? [];
    const family = nameParts[0];
    const given = nameParts.slice(1, 3).filter(Boolean);
    const relationship = nk1?.[2]?.[0]?.[1] || nk1?.[2]?.[0]?.[0];
    const phone = nk1?.[4]?.[0]?.[0];
    const address = nk1?.[3]?.[0];

    relatedPersons.push({
      id: relatedId || undefined,
      identifier: relatedId || undefined,
      active: true,
      patient: patientId,
      relationship: relationship ? [{
        code: relationship,
        display: relationship
      }] : undefined,
      name: (family || given.length) ? [{
        family: family,
        given: given.length ? given : undefined
      }] : undefined,
      telecom: phone ? [{ system: 'phone', value: phone }] : undefined,
      address: address ? [{
        line: address[0] ? [address[0]] : undefined,
        city: address[2],
        state: address[3],
        postalCode: address[4]
      }] : undefined
    });
  }

  if (relatedPersons.length > 0) {
    result.relatedPersons = relatedPersons;
  }
  if (locations.length > 0) {
    result.locations = locations;
  }

  /* ───── EpisodesOfCare (from PV1) ───── */
  const episodesOfCare: CanonicalEpisodeOfCare[] = [];
  if (pv1) {
    const episodeId = encounter?.id || pv1?.[18]?.[0]?.[0];
    const admitDate = toFHIRDateTime(pv1?.[43]?.[0]?.[0]) || toFHIRDate(pv1?.[43]?.[0]?.[0]);
    const dischargeDate = toFHIRDateTime(pv1?.[44]?.[0]?.[0]) || toFHIRDate(pv1?.[44]?.[0]?.[0]);
    const careManagerId = pv1?.[6]?.[0]?.[0];
    const status = dischargeDate ? 'finished' : 'active';

    if (episodeId || admitDate || dischargeDate) {
      episodesOfCare.push({
        id: episodeId,
        identifier: episodeId,
        status,
        patient: patientId,
        managingOrganization: encounter?.serviceProviderOrganizationId,
        period: (admitDate || dischargeDate) ? {
          start: admitDate,
          end: dischargeDate
        } : undefined,
        careManager: careManagerId
      });
    }
  }

  if (episodesOfCare.length > 0) {
    result.episodesOfCare = episodesOfCare;
  }

  /* ───── Specimens (from SPM) ───── */
  const specimens: CanonicalSpecimen[] = [];
  const spmSegments = parsed.SPM ?? [];
  for (const spm of spmSegments) {
    const specimenId = spm?.[1]?.[0]?.[0] || spm?.[0]?.[0]?.[0];
    const typeParts = spm?.[3]?.[0] ?? [];
    const typeCode = typeParts[0];
    const typeDisplay = typeParts[1];
    const receivedTime = toFHIRDateTime(spm?.[16]?.[0]?.[0]) || toFHIRDateTime(spm?.[17]?.[0]?.[0]);
    const collectedTime = toFHIRDateTime(spm?.[6]?.[0]?.[0]) || toFHIRDateTime(spm?.[7]?.[0]?.[0]);

    if (!specimenId && !typeCode && !typeDisplay) continue;

    specimens.push({
      id: specimenId || `SPM-${Date.now()}`,
      identifier: specimenId,
      status: 'available',
      type: (typeCode || typeDisplay) ? {
        system: mapCodingSystem(typeParts[2]),
        code: typeCode,
        display: typeDisplay
      } : undefined,
      subject: patientId,
      receivedTime: receivedTime,
      collection: collectedTime ? {
        collectedDateTime: collectedTime
      } : undefined
    });
  }

  if (specimens.length > 0) {
    result.specimens = specimens;
  }

  /* ───── Medications (from RXC) ───── */
  const medications: any[] = [];
  const rxcSegments = parsed.RXC ?? [];
  for (const rxc of rxcSegments) {
    const componentCode = rxc?.[2]?.[0] ?? [];
    if (componentCode[0]) {
      medications.push({
        id: `RXC-${componentCode[0]}`,
        identifier: componentCode[0],
        code: {
          coding: [{
            code: componentCode[0],
            display: componentCode[1],
            system: mapCodingSystem(componentCode[2])
          }],
          text: componentCode[1]
        },
        status: 'active'
      });
    }
  }

  if (medications.length > 0) {
    result.medications = medications;
  }

  return result;
}

function mapCodingSystem(system?: string) {
  if (!system) return undefined;
  if (/^https?:\/\//i.test(system) || /^urn:/i.test(system)) return system;
  const normalized = system.toUpperCase();
  if (normalized === 'LN' || normalized === 'LOINC') return 'http://loinc.org';
  if (normalized === 'SNOMED' || normalized === 'SCT') return 'http://snomed.info/sct';
  if (normalized === 'L' || normalized === 'LOCAL') return 'urn:hl7-org:local';
  return 'urn:hl7-org:local';
}


/* helpers */

function toFHIRDate(date?: string) {
  if (!date) return undefined;
  const match = date.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return undefined;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function mapGender(g?: string) {
  if (!g) return 'unknown';
  if (g.startsWith('M')) return 'male';
  if (g.startsWith('F')) return 'female';
  return 'unknown';
}

function mapObservationStatus(status?: string): string {
  if (!status) return 'final';
  const statusUpper = status.toUpperCase();
  // HL7 OBX-11 status codes: P=Preliminary, F=Final, C=Corrected, X=Cancelled, etc.
  if (statusUpper === 'F' || statusUpper === 'FINAL') return 'final';
  if (statusUpper === 'P' || statusUpper === 'PRELIMINARY') return 'preliminary';
  if (statusUpper === 'C' || statusUpper === 'CORRECTED') return 'corrected';
  if (statusUpper === 'X' || statusUpper === 'CANCELLED') return 'cancelled';
  if (statusUpper === 'S' || statusUpper === 'STATUS') return 'final'; // S typically means status/signed
  return 'final';
}

function mapConditionClinicalStatus(status?: string) {
  if (!status) return undefined;
  const value = status.trim().toUpperCase();
  if (value === 'A' || value === 'ACTIVE') return 'active';
  if (value === 'I' || value === 'INACTIVE') return 'inactive';
  if (value === 'R' || value === 'RESOLVED') return 'resolved';
  if (value === 'REC' || value === 'RECURRENCE') return 'recurrence';
  if (value === 'REL' || value === 'RELAPSE') return 'relapse';
  if (value === 'REM' || value === 'REMISSION') return 'remission';
  return undefined;
}

function mapConditionClinicalStatusDisplay(code: string) {
  if (code === 'active') return 'Active';
  if (code === 'inactive') return 'Inactive';
  if (code === 'resolved') return 'Resolved';
  if (code === 'recurrence') return 'Recurrence';
  if (code === 'relapse') return 'Relapse';
  if (code === 'remission') return 'Remission';
  return code;
}

function mapAllergySeverity(severity?: string) {
  if (!severity) return undefined;
  const value = severity.trim().toUpperCase();
  if (value === 'MI' || value === 'MILD') return 'mild';
  if (value === 'MO' || value === 'MOD' || value === 'MODERATE') return 'moderate';
  if (value === 'SV' || value === 'SEV' || value === 'SEVERE') return 'severe';
  return undefined;
}

function toFHIRDateTime(dateTime?: string) {
  if (!dateTime) return undefined;
  const match = dateTime.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?([+-]\d{4})?$/);
  if (!match) return undefined;
  const year = match[1];
  const month = match[2];
  const day = match[3];
  const hour = match[4];
  const minute = match[5] || '00';
  const second = match[6] || '00';
  const tz = match[7];

  if (!hour) {
    return `${year}-${month}-${day}`;
  }

  const tzSuffix = tz ? `${tz.slice(0, 3)}:${tz.slice(3, 5)}` : 'Z';
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${tzSuffix}`;
}
