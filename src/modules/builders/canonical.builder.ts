import { HL7Message } from '../../shared/types/hl7.types.js';
import { CanonicalObservation, CanonicalDocumentReference, CanonicalEncounter, CanonicalMedicationStatement, CanonicalProcedure, CanonicalCondition, CanonicalAppointment, CanonicalSchedule, CanonicalSlot, CanonicalDiagnosticReport, CanonicalRelatedPerson, CanonicalLocation, CanonicalEpisodeOfCare } from '../../shared/types/canonical.types.js';
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

  /* ───── MedicationStatements (from RXA) ───── */
  const medicationStatements: CanonicalMedicationStatement[] = [];
  const rxaSegments = parsed.RXA ?? [];
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

    conditions.push({
      id: `DG1-${codeValue || Date.now()}`,
      identifier: codeValue,
      clinicalStatus: clinicalStatus ? {
        code: clinicalStatus,
        display: clinicalStatus
      } : undefined,
      code: {
        coding: codeValue ? [{
          system: mapCodingSystem(system),
          code: codeValue,
          display: display
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
  const obrSegments = parsed.OBR ?? [];
  for (const obr of obrSegments) {
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
  if (!date || date.length < 8) return undefined;
  return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
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

function toFHIRDateTime(dateTime?: string) {
  if (!dateTime || dateTime.length < 8) return undefined;
  // Handle formats: YYYYMMDD, YYYYMMDDHH, YYYYMMDDHHMM, YYYYMMDDHHMMSS
  if (dateTime.length === 8) {
    return `${dateTime.slice(0, 4)}-${dateTime.slice(4, 6)}-${dateTime.slice(6, 8)}`;
  }
  if (dateTime.length >= 10) {
    const year = dateTime.slice(0, 4);
    const month = dateTime.slice(4, 6);
    const day = dateTime.slice(6, 8);
    const hour = dateTime.slice(8, 10) || '00';
    const minute = dateTime.length >= 12 ? dateTime.slice(10, 12) : '00';
    const second = dateTime.length >= 14 ? dateTime.slice(12, 14) : '00';
    return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  }
  return undefined;
}
