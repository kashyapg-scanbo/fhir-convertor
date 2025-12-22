import { HL7Message } from '../../shared/types/hl7.types.js';
import { CanonicalObservation } from '../../shared/types/canonical.types.js';

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
    let encounter: { class: string } | undefined;
    if (pv1) {
        const encounterClass = pv1?.[1]?.[0]?.[0] === 'I' ? 'IMP' : 'AMB';
        encounter = {
            class: encounterClass
        };
    }

    /* ───── Observations (OBX) ───── */
    // Only include observations if OBX segments exist
    const observations: CanonicalObservation[] = obxSegments.length > 0
        ? obxSegments
            .map((obx: any): CanonicalObservation | null => {
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
            })
            .filter((o: CanonicalObservation | null): o is CanonicalObservation => o !== null && Boolean(o.code && typeof o.code === 'object' && !Array.isArray(o.code) && o.code.code))
        : [];


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

    /* ───── Organizations (from MSH, ORC) ───── */
    const organizations: any[] = [];
    
    // Extract Organization from MSH (Sending/Receiving Facilities)
    // MSH-3: Sending Application, MSH-4: Sending Facility
    // MSH-5: Receiving Application, MSH-6: Receiving Facility
    if (msh) {
      const sendingFacility = msh?.[3]?.[0]?.[0];
      const receivingFacility = msh?.[5]?.[0]?.[0];
      
      if (sendingFacility) {
        organizations.push({
          id: `MSH-SEND-${sendingFacility}`,
          identifier: sendingFacility,
          name: msh?.[3]?.[0]?.[1] || sendingFacility,
          type: [{
            system: 'http://terminology.hl7.org/CodeSystem/organization-type',
            code: 'prov',
            display: 'Healthcare Provider'
          }]
        });
      }
      
      if (receivingFacility) {
        organizations.push({
          id: `MSH-RECV-${receivingFacility}`,
          identifier: receivingFacility,
          name: msh?.[5]?.[0]?.[1] || receivingFacility,
          type: [{
            system: 'http://terminology.hl7.org/CodeSystem/organization-type',
            code: 'prov',
            display: 'Healthcare Provider'
          }]
        });
      }
    }
    
    // Extract Organization from ORC (Ordering Facility)
    const orcSegments = parsed.ORC ?? [];
    for (const orc of orcSegments) {
      const orderingFacility = orc?.[21]?.[0]?.[0];
      if (orderingFacility) {
        organizations.push({
          id: `ORC-${orderingFacility}`,
          identifier: orderingFacility,
          name: orc?.[21]?.[0]?.[1] || orderingFacility,
          type: [{
            system: 'http://terminology.hl7.org/CodeSystem/organization-type',
            code: 'prov',
            display: 'Healthcare Provider'
          }]
        });
      }
    }
    
    if (organizations.length > 0) {
      result.organizations = organizations;
    }

    /* ───── Practitioners (from ROL) ───── */
    const rolSegments = parsed.ROL ?? [];
    const practitioners: any[] = [];
    const practitionerRoles: any[] = [];
    
    for (const rol of rolSegments) {
      // ROL-2: Action Code, ROL-3: Role (ROL.3.1=code, ROL.3.2=text)
      // ROL-4: Role Person (practitioner name and ID)
      const rolePerson = rol?.[3]?.[0] ?? [];
      const rolePersonId = rolePerson[0];
      
      if (rolePersonId) {
        const nameParts = rolePerson.slice(1, 5).filter(Boolean);
        const family = nameParts[nameParts.length - 1];
        const given = nameParts.slice(0, -1);
        
        practitioners.push({
          id: rolePersonId,
          identifier: rolePersonId,
          name: {
            family,
            given
          }
        });
        
        // ROL-4: Role Code (for PractitionerRole)
        const roleCode = rol?.[2]?.[0] ?? [];
        practitionerRoles.push({
          id: `ROL-${rolePersonId}`,
          practitionerId: rolePersonId,
          code: roleCode.length > 0 ? [{
            code: roleCode[0],
            display: roleCode[1]
          }] : undefined,
          period: {
            start: toFHIRDate(rol?.[5]?.[0]?.[0]), // ROL-5: Role Begin Date/Time
            end: toFHIRDate(rol?.[6]?.[0]?.[0])    // ROL-6: Role End Date/Time
          }
        });
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
        authoredOn: toFHIRDate(rxe?.[4]?.[0]?.[0]), // RXE-5: Give Amount
        dosageInstruction: rxe?.[5]?.[0]?.[0] ? [{
          text: rxe[5][0][0] // RXE-6: Give Units
        }] : []
      });
    }
    
    if (medicationRequests.length > 0) {
      result.medicationRequests = medicationRequests;
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
    if (!system) return 'http://loinc.org';
    if (system === 'LN') return 'http://loinc.org';
    if (system === 'SNOMED') return 'http://snomed.info/sct';
    return 'urn:hl7-org:v2';
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
