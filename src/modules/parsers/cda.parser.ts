import { Buffer } from 'node:buffer';
import { XMLParser } from 'fast-xml-parser';
import {
  CanonicalDocumentReference,
  CanonicalMedication,
  CanonicalMedicationRequest,
  CanonicalMedicationStatement,
  CanonicalMedicationAdministration,
  CanonicalProcedure,
  CanonicalCondition,
  CanonicalAppointment,
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
  CanonicalPatient,
  CanonicalModel,
  CanonicalObservation,
  CanonicalOrganization,
  CanonicalPractitioner,
  CanonicalPractitionerRole
} from '../../shared/types/canonical.types.js';

/**
 * Parse CDA (Clinical Document Architecture) XML to Canonical Model
 */
export function parseCDA(cdaXml: string): CanonicalModel {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    parseAttributeValue: false,
    trimValues: true,
  });

  const jsonObj = parser.parse(cdaXml);
  
  // Navigate CDA structure - handle both namespaced and non-namespaced
  const clinicalDocument = jsonObj.ClinicalDocument || 
                          jsonObj['cda:ClinicalDocument'] ||
                          findCDARoot(jsonObj);
  
  if (!clinicalDocument) {
    throw new Error('Invalid CDA document: ClinicalDocument root not found');
  }

  const patient = buildPatientFromCDA(clinicalDocument);
  const encounter = buildEncounterFromCDA(clinicalDocument);
  const practitionerData = extractPractitionerData(clinicalDocument);
  const observations = extractObservations(clinicalDocument);
  const { medicationRequests, medications, medicationStatements } = extractMedications(
    clinicalDocument,
    patient.id,
    encounter?.id,
    practitionerData.authorIds[0]
  );
  const medicationAdministrations = extractMedicationAdministrations(
    clinicalDocument,
    patient.id,
    encounter?.id,
    practitionerData.authorIds[0]
  );
  const procedures = extractProcedures(clinicalDocument, patient.id, encounter?.id);
  const conditions = extractConditions(clinicalDocument, patient.id, encounter?.id);
  const appointments = extractAppointments(clinicalDocument, patient.id);
  const schedules = extractSchedules(clinicalDocument, patient.id);
  const slots = extractSlots(clinicalDocument, patient.id);
  const diagnosticReports = extractDiagnosticReports(clinicalDocument, patient.id, encounter?.id);
  const relatedPersons = extractRelatedPersons(clinicalDocument, patient.id);
  const locations = extractLocations(clinicalDocument);
  const episodesOfCare = extractEpisodesOfCare(clinicalDocument, patient.id);
  const specimens = extractSpecimens(clinicalDocument, patient.id);
  const imagingStudies = extractImagingStudies(clinicalDocument, patient.id, encounter?.id);
  const allergyIntolerances = extractAllergyIntolerances(clinicalDocument, patient.id, encounter?.id);
  const immunizations = extractImmunizations(clinicalDocument, patient.id, encounter?.id, practitionerData.authorIds[0]);
  const capabilityStatements = extractCapabilityStatements(clinicalDocument);
  const operationOutcomes = extractOperationOutcomes(clinicalDocument);
  const parameters = extractParameters(clinicalDocument);
  const carePlans = extractCarePlans(clinicalDocument, patient.id, encounter?.id);
  const careTeams = extractCareTeams(clinicalDocument, patient.id);
  const custodianOrgs = extractCustodianOrganizations(clinicalDocument);
  const organizations = mergeOrganizations(practitionerData.organizations, custodianOrgs);
  const documentReference = buildDocumentReference({
    clinicalDocument,
    cdaXml,
    patientId: patient.id,
    encounterId: encounter?.id,
    authorIds: practitionerData.authorIds,
    custodianId: custodianOrgs[0]?.id
  });

  const canonical: CanonicalModel = { patient };

  if (encounter) canonical.encounter = encounter;
  if (observations.length) canonical.observations = observations;
  if (medicationRequests.length) canonical.medicationRequests = medicationRequests;
  if (medications.length) canonical.medications = medications;
  if (medicationStatements.length) canonical.medicationStatements = medicationStatements;
  if (medicationAdministrations.length) canonical.medicationAdministrations = medicationAdministrations;
  if (procedures.length) canonical.procedures = procedures;
  if (conditions.length) canonical.conditions = conditions;
  if (appointments.length) canonical.appointments = appointments;
  if (schedules.length) canonical.schedules = schedules;
  if (slots.length) canonical.slots = slots;
  if (diagnosticReports.length) canonical.diagnosticReports = diagnosticReports;
  if (relatedPersons.length) canonical.relatedPersons = relatedPersons;
  if (locations.length) canonical.locations = locations;
  if (episodesOfCare.length) canonical.episodesOfCare = episodesOfCare;
  if (specimens.length) canonical.specimens = specimens;
  if (imagingStudies.length) canonical.imagingStudies = imagingStudies;
  if (allergyIntolerances.length) canonical.allergyIntolerances = allergyIntolerances;
  if (immunizations.length) canonical.immunizations = immunizations;
  if (capabilityStatements.length) canonical.capabilityStatements = capabilityStatements;
  if (operationOutcomes.length) canonical.operationOutcomes = operationOutcomes;
  if (parameters.length) canonical.parameters = parameters;

  if (carePlans.length) canonical.carePlans = carePlans;
  if (careTeams.length) canonical.careTeams = careTeams;
  if (practitionerData.practitioners.length) canonical.practitioners = practitionerData.practitioners;
  if (practitionerData.practitionerRoles.length) canonical.practitionerRoles = practitionerData.practitionerRoles;
  if (organizations.length) canonical.organizations = organizations;
  if (documentReference) canonical.documentReferences = [documentReference];

  return canonical;
}

/**
 * Helper function to find CDA root element
 */
function findCDARoot(obj: any): any {
  if (obj && typeof obj === 'object') {
    for (const key in obj) {
      if (key.includes('ClinicalDocument') || key.includes('Clinical')) {
        return obj[key];
      }
      const found = findCDARoot(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

function buildPatientFromCDA(clinicalDocument: any): CanonicalPatient {
  const recordTarget = clinicalDocument.recordTarget || clinicalDocument['cda:recordTarget'];
  const patientRole = Array.isArray(recordTarget)
    ? recordTarget[0]?.patientRole || recordTarget[0]?.['cda:patientRole']
    : recordTarget?.patientRole || recordTarget?.['cda:patientRole'];

  if (!patientRole) {
    throw new Error('Patient information not found in CDA document');
  }

  const patient = patientRole.patient || patientRole['cda:patient'];
  const patientId = extractPatientId(patientRole);

  const name = patient?.name || patient?.['cda:name'];
  const nameObj = Array.isArray(name) ? name[0] : name;
  const familyName = extractText(nameObj?.family) || extractText(nameObj?.['cda:family']);
  const givenNames = extractGivenNames(nameObj?.given || nameObj?.['cda:given']);

  const administrativeGenderCode = patient?.administrativeGenderCode || patient?.['cda:administrativeGenderCode'];
  const genderCode = extractAttribute(administrativeGenderCode, '@_code');

  const birthTime = patient?.birthTime || patient?.['cda:birthTime'];
  const birthDate = extractAttribute(birthTime, '@_value');

  const addr = patientRole.addr || patientRole['cda:addr'];
  const address = extractAddresses(addr);
  const telecom = extractTelecom(patientRole.telecom || patientRole['cda:telecom']);

  return {
    id: patientId,
    identifier: patientId,
    name: {
      family: familyName,
      given: givenNames
    },
    gender: mapCDAGender(genderCode),
    birthDate: formatCDADate(birthDate),
    address,
    telecom
  };
}

function buildEncounterFromCDA(clinicalDocument: any): CanonicalModel['encounter'] | undefined {
  const componentOf = clinicalDocument.componentOf || clinicalDocument['cda:componentOf'];
  const encounterNode = componentOf?.encompassingEncounter || componentOf?.['cda:encompassingEncounter'];
  if (!encounterNode) return undefined;

  const encounterId = extractId(encounterNode.id || encounterNode['cda:id']);
  const encounterClass = extractEncounterClass(encounterNode);
  const effectiveTime = encounterNode.effectiveTime || encounterNode['cda:effectiveTime'];
  const effectiveTimeObj = Array.isArray(effectiveTime) ? effectiveTime[0] : effectiveTime;
  const startValue =
    extractAttribute(effectiveTimeObj, '@_value') ||
    extractAttribute(effectiveTimeObj?.low, '@_value');

  const responsibleParty = encounterNode.responsibleParty || encounterNode['cda:responsibleParty'];
  const assignedEntity = responsibleParty?.assignedEntity || responsibleParty?.['cda:assignedEntity'];
  const responsiblePractitionerId = extractId(assignedEntity?.id || assignedEntity?.['cda:id']);
  const representedOrg = assignedEntity?.representedOrganization || assignedEntity?.['cda:representedOrganization'];
  const responsibleOrgId = extractId(representedOrg?.id || representedOrg?.['cda:id']);

  return {
    id: encounterId,
    class: encounterClass,
    start: formatCDADateTime(startValue),
    participantPractitionerIds: responsiblePractitionerId ? [responsiblePractitionerId] : undefined,
    serviceProviderOrganizationId: responsibleOrgId
  };
}

function extractPatientId(patientRole: any): string | undefined {
  const id = patientRole.id || patientRole['cda:id'];
  return extractId(id);
}

function extractText(value: any): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (value['#text']) return value['#text'];
  if (Array.isArray(value) && value[0]) {
    return typeof value[0] === 'string' ? value[0] : value[0]['#text'];
  }
  return undefined;
}

function extractGivenNames(given: any): string[] {
  if (!given) return [];
  if (typeof given === 'string') return [given];
  if (Array.isArray(given)) {
    return given.map(g => extractText(g)).filter(Boolean) as string[];
  }
  const text = extractText(given);
  return text ? [text] : [];
}

function extractId(node: any): string | undefined {
  if (!node) return undefined;
  const target = Array.isArray(node) ? node[0] : node;
  return extractAttribute(target, '@_extension') || extractAttribute(target, '@_root');
}

function extractAttribute(obj: any, attr: string): string | undefined {
  if (!obj) return undefined;
  if (Array.isArray(obj)) return extractAttribute(obj[0], attr);
  if (typeof obj === 'object') return obj[attr];
  return undefined;
}

function extractAddresses(addr: any): CanonicalPatient['address'] {
  if (!addr) return [];
  
  const addrArray = Array.isArray(addr) ? addr : [addr];
  
  return addrArray.map((a: any) => {
    const streetAddressLine = a.streetAddressLine || a['cda:streetAddressLine'];
    const lines = Array.isArray(streetAddressLine) 
      ? streetAddressLine.map((line: any) => extractText(line))
      : extractText(streetAddressLine) ? [extractText(streetAddressLine)] : [];
    
    return {
      line: lines.filter(Boolean) as string[],
      city: extractText(a.city || a['cda:city']),
      state: extractText(a.state || a['cda:state']),
      postalCode: extractText(a.postalCode || a['cda:postalCode']),
      country: extractText(a.country || a['cda:country']),
      use: mapAddressUse(extractAttribute(a, '@_use')),
    };
  }).filter(a => a.line?.length || a.city || a.state || a.postalCode);
}

function extractTelecom(telecom: any): CanonicalPatient['telecom'] {
  if (!telecom) return [];
  
  const telecomArray = Array.isArray(telecom) ? telecom : [telecom];
  
  return telecomArray.map((t: any) => {
    const value = extractAttribute(t, '@_value') || '';
    const use = mapTelecomUse(extractAttribute(t, '@_use')) || 'home';
    
    let system: 'phone' | 'email' | 'fax' | 'url' | 'other' = 'other';
    let cleanValue = value;
    
    if (value.startsWith('tel:')) {
      system = 'phone';
      cleanValue = value.replace(/^tel:/, '');
    } else if (value.startsWith('mailto:')) {
      system = 'email';
      cleanValue = value.replace(/^mailto:/, '');
    } else if (value.startsWith('fax:')) {
      system = 'fax';
      cleanValue = value.replace(/^fax:/, '');
    } else if (value.startsWith('http')) {
      system = 'url';
    } else if (value.match(/^[0-9+\-() ]+$/)) {
      system = 'phone';
    } else if (value.includes('@')) {
      system = 'email';
    }
    
    return { system, value: cleanValue, use };
  }).filter(t => t.value);
}

type CanonicalTelecomUse = NonNullable<CanonicalPatient['telecom']>[number]['use'];
type CanonicalAddressUse = NonNullable<CanonicalPatient['address']>[number]['use'];

function mapTelecomUse(use?: string): CanonicalTelecomUse | undefined {
  if (!use) return undefined;
  const normalized = use.toUpperCase();
  if (normalized === 'MC' || normalized === 'MOBILE') return 'mobile';
  if (normalized === 'WP' || normalized === 'DIR' || normalized === 'WORK') return 'work';
  if (normalized === 'H' || normalized === 'HP' || normalized === 'HV' || normalized === 'HOME') return 'home';
  if (normalized === 'TMP' || normalized === 'TEMP') return 'temp';
  if (normalized === 'OLD') return 'old';
  return undefined;
}

function mapAddressUse(use?: string): CanonicalAddressUse | undefined {
  if (!use) return undefined;
  const normalized = use.toUpperCase();
  if (normalized === 'WP' || normalized === 'WORK') return 'work';
  if (normalized === 'H' || normalized === 'HP' || normalized === 'HV' || normalized === 'HOME') return 'home';
  if (normalized === 'TMP' || normalized === 'TEMP') return 'temp';
  if (normalized === 'OLD' || normalized === 'BAD') return 'old';
  if (normalized === 'BILL' || normalized === 'B') return 'billing';
  return undefined;
}

function iterateSectionEntries(clinicalDocument: any, handler: (entry: any, section?: any) => void) {
  const component = clinicalDocument.component || clinicalDocument['cda:component'];
  const structuredBody = component?.structuredBody || component?.['cda:structuredBody'];
  if (!structuredBody) return;

  const bodyComponents = structuredBody.component || structuredBody['cda:component'] || [];
  const componentArray = Array.isArray(bodyComponents) ? bodyComponents : [bodyComponents];

  for (const comp of componentArray) {
    const section = comp.section || comp['cda:section'];
    if (!section) continue;
    const entries = section.entry || section['cda:entry'] || [];
    const entryArray = Array.isArray(entries) ? entries : [entries];
    for (const entry of entryArray) {
      handler(entry, section);
    }
  }
}

function extractObservations(clinicalDocument: any): CanonicalObservation[] {
  const observations: CanonicalObservation[] = [];

  iterateSectionEntries(clinicalDocument, entry => {
    let observation = entry.observation || entry['cda:observation'];

    if (!observation) {
      const organizer = entry.organizer || entry['cda:organizer'];
      if (organizer) {
        const orgComponent = organizer.component || organizer['cda:component'];
        const orgComponentArray = Array.isArray(orgComponent) ? orgComponent : [orgComponent];
        observation = orgComponentArray
          .map((oc: any) => oc.observation || oc['cda:observation'])
          .filter(Boolean);
      }
    }

    if (!observation) return;
    const obsArray = Array.isArray(observation) ? observation : [observation];

    for (const obs of obsArray) {
      const code = obs.code || obs['cda:code'];
      if (!code) continue;

      const codeCode = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem') || extractAttribute(code, '@_codeSystemName');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code.displayName || code['cda:displayName']);

      const value = obs.value || obs['cda:value'];
      const valueValue = extractAttribute(value, '@_value') ?? extractText(value);
      const unit = extractAttribute(value, '@_unit');

      const effectiveTime = obs.effectiveTime || obs['cda:effectiveTime'];
      const effectiveTimeValue = extractAttribute(effectiveTime, '@_value');

      if (codeCode && valueValue !== undefined) {
        observations.push({
          code: {
            system: mapCodeSystem(codeSystem),
            code: codeCode,
            display: displayName
          },
          value: !isNaN(Number(valueValue)) ? Number(valueValue) : valueValue,
          unit,
          date: formatCDADateTime(effectiveTimeValue),
          status: 'final'
        });
      }
    }
  });

  return observations;
}

function extractMedications(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string,
  defaultRequesterId?: string
): { medicationRequests: CanonicalMedicationRequest[]; medications: CanonicalMedication[]; medicationStatements: CanonicalMedicationStatement[] } {
  const medicationRequests: CanonicalMedicationRequest[] = [];
  const medicationMap = new Map<string, CanonicalMedication>();
  const medicationStatements: CanonicalMedicationStatement[] = [];

  iterateSectionEntries(clinicalDocument, entry => {
    const admin = entry.substanceAdministration || entry['cda:substanceAdministration'];
    if (!admin) return;
    const administrations = Array.isArray(admin) ? admin : [admin];

    for (const substance of administrations) {
      const medId = extractId(substance.id || substance['cda:id']) || `MEDREQ-${medicationRequests.length + 1}`;
      const consumable = substance.consumable || substance['cda:consumable'];
      const manufacturedProduct = consumable?.manufacturedProduct || consumable?.['cda:manufacturedProduct'];
      const manufacturedMaterial = manufacturedProduct?.manufacturedMaterial || manufacturedProduct?.['cda:manufacturedMaterial'];
      const code = manufacturedMaterial?.code || manufacturedMaterial?.['cda:code'];
      const medCode = extractAttribute(code, '@_code');
      const medSystem = extractAttribute(code, '@_codeSystem');
      const medDisplay = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const medicationCodeableConcept = medCode
        ? {
            coding: [{
              system: mapCodeSystem(medSystem),
              code: medCode,
              display: medDisplay
            }],
            text: medDisplay
          }
        : undefined;

      if (medCode && !medicationMap.has(medCode)) {
        medicationMap.set(medCode, {
          id: `MED-${medCode}`,
          identifier: medCode,
          code: medicationCodeableConcept,
          status: 'active'
        });
      }

      const effectiveTime = substance.effectiveTime || substance['cda:effectiveTime'];
      const effectiveNode = Array.isArray(effectiveTime) ? effectiveTime[0] : effectiveTime;
      const effectiveValue =
        extractAttribute(effectiveNode, '@_value') ||
        extractAttribute(effectiveNode?.low, '@_value');

      const doseQuantity = substance.doseQuantity || substance['cda:doseQuantity'];
      const doseValue = extractAttribute(doseQuantity, '@_value');
      const doseUnit = extractAttribute(doseQuantity, '@_unit');
      const routeCode = substance.routeCode || substance['cda:routeCode'];
      const routeDisplay = extractAttribute(routeCode, '@_displayName') || extractAttribute(routeCode, '@_code');

      const requester =
        extractPerformerId(substance.performer || substance['cda:performer']) ||
        defaultRequesterId;

      const dosage = buildDosageFromSubstance({
        doseValue,
        doseUnit,
        route: routeDisplay,
        effectiveNode
      });

      medicationRequests.push({
        id: medId,
        identifier: medId,
        status: mapMedicationStatus(substance),
        intent: 'order',
        medicationCodeableConcept,
        subject: patientId,
        encounter: encounterId,
        authoredOn: formatCDADateTime(effectiveValue),
        requester,
        dosageInstruction: dosage ? [dosage] : undefined
      });

      medicationStatements.push({
        id: `MEDSTAT-${medId}`,
        identifier: medId,
        status: mapMedicationStatus(substance) || 'recorded',
        medicationCodeableConcept,
        subject: patientId,
        encounter: encounterId,
        effectiveDateTime: formatCDADateTime(effectiveValue),
        dateAsserted: formatCDADateTime(effectiveValue),
        author: requester,
        dosage: dosage ? [dosage] : undefined
      });
    }
  });

  return {
    medicationRequests,
    medications: Array.from(medicationMap.values()),
    medicationStatements
  };
}

function extractMedicationAdministrations(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string,
  defaultPerformerId?: string
): CanonicalMedicationAdministration[] {
  const administrations: CanonicalMedicationAdministration[] = [];

  iterateSectionEntries(clinicalDocument, entry => {
    const admin = entry.substanceAdministration || entry['cda:substanceAdministration'];
    if (!admin) return;
    const list = Array.isArray(admin) ? admin : [admin];

    for (const substance of list) {
      const consumable = substance.consumable || substance['cda:consumable'];
      const manufacturedProduct = consumable?.manufacturedProduct || consumable?.['cda:manufacturedProduct'];
      const manufacturedMaterial = manufacturedProduct?.manufacturedMaterial || manufacturedProduct?.['cda:manufacturedMaterial'];
      const code = manufacturedMaterial?.code || manufacturedMaterial?.['cda:code'];
      const medCode = extractAttribute(code, '@_code');
      const medSystem = extractAttribute(code, '@_codeSystem');
      const medDisplay = extractAttribute(code, '@_displayName') || extractText(code?.displayName);

      if (!medCode && !medDisplay) continue;

      const statusCode = substance.statusCode || substance['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code') || 'completed';

      const effectiveTime = substance.effectiveTime || substance['cda:effectiveTime'];
      const effectiveNode = Array.isArray(effectiveTime) ? effectiveTime[0] : effectiveTime;
      const occurrence =
        extractAttribute(effectiveNode, '@_value') ||
        extractAttribute(effectiveNode?.low, '@_value');

      const doseQuantity = substance.doseQuantity || substance['cda:doseQuantity'];
      const doseValue = extractAttribute(doseQuantity, '@_value');
      const doseUnit = extractAttribute(doseQuantity, '@_unit');

      const routeCode = substance.routeCode || substance['cda:routeCode'];
      const routeDisplay = extractAttribute(routeCode, '@_displayName') || extractAttribute(routeCode, '@_code');

      const performerId =
        extractPerformerId(substance.performer || substance['cda:performer']) ||
        defaultPerformerId;

      administrations.push({
        id: `MEDADMIN-${medCode || administrations.length + 1}`,
        identifier: medCode,
        status: status,
        medicationCodeableConcept: medCode || medDisplay ? {
          coding: medCode ? [{
            system: mapCodeSystem(medSystem),
            code: medCode,
            display: medDisplay
          }] : undefined,
          text: medDisplay
        } : undefined,
        subject: patientId,
        encounter: encounterId,
        occurrenceDateTime: formatCDADateTime(occurrence),
        performer: performerId ? [{ actor: performerId }] : undefined,
        dosage: (doseValue || routeDisplay) ? {
          text: [doseValue, doseUnit, routeDisplay].filter(Boolean).join(' ') || undefined,
          route: routeDisplay ? { code: routeDisplay, display: routeDisplay } : undefined,
          dose: doseValue ? { value: Number(doseValue), unit: doseUnit } : undefined
        } : undefined
      });
    }
  });

  return administrations;
}

function extractImmunizations(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string,
  defaultPerformerId?: string
): CanonicalImmunization[] {
  const immunizations: CanonicalImmunization[] = [];

  iterateSectionEntries(clinicalDocument, entry => {
    const admin = entry.substanceAdministration || entry['cda:substanceAdministration'];
    if (!admin) return;
    const administrations = Array.isArray(admin) ? admin : [admin];

    for (const substance of administrations) {
      const consumable = substance.consumable || substance['cda:consumable'];
      const manufacturedProduct = consumable?.manufacturedProduct || consumable?.['cda:manufacturedProduct'];
      const manufacturedMaterial = manufacturedProduct?.manufacturedMaterial || manufacturedProduct?.['cda:manufacturedMaterial'];
      const code = manufacturedMaterial?.code || manufacturedMaterial?.['cda:code'];
      const vaccineCode = extractAttribute(code, '@_code');
      const vaccineSystem = extractAttribute(code, '@_codeSystem');
      const vaccineDisplay = extractAttribute(code, '@_displayName') || extractText(code?.displayName);

      if (!vaccineCode && !vaccineDisplay) continue;

      const statusCode = substance.statusCode || substance['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code') || 'completed';

      const effectiveTime = substance.effectiveTime || substance['cda:effectiveTime'];
      const effectiveNode = Array.isArray(effectiveTime) ? effectiveTime[0] : effectiveTime;
      const occurrence =
        extractAttribute(effectiveNode, '@_value') ||
        extractAttribute(effectiveNode?.low, '@_value');

      const doseQuantity = substance.doseQuantity || substance['cda:doseQuantity'];
      const doseValue = extractAttribute(doseQuantity, '@_value');
      const doseUnit = extractAttribute(doseQuantity, '@_unit');

      const routeCode = substance.routeCode || substance['cda:routeCode'];
      const routeDisplay = extractAttribute(routeCode, '@_displayName') || extractAttribute(routeCode, '@_code');

      const lotNumber = extractText(manufacturedProduct?.lotNumberText || manufacturedProduct?.['cda:lotNumberText']);

      const performerId =
        extractPerformerId(substance.performer || substance['cda:performer']) ||
        defaultPerformerId;

      immunizations.push({
        id: `IMM-${vaccineCode || immunizations.length + 1}`,
        identifier: vaccineCode,
        status: status,
        vaccineCode: vaccineCode ? {
          system: mapCodeSystem(vaccineSystem),
          code: vaccineCode,
          display: vaccineDisplay
        } : undefined,
        lotNumber: lotNumber,
        patient: patientId,
        encounter: encounterId,
        occurrenceDateTime: formatCDADateTime(occurrence),
        route: routeDisplay ? { code: routeDisplay, display: routeDisplay } : undefined,
        doseQuantity: doseValue ? { value: Number(doseValue), unit: doseUnit } : undefined,
        performer: performerId ? [{ actor: performerId }] : undefined
      });
    }
  });

  return immunizations;
}

function extractCapabilityStatements(clinicalDocument: any): CanonicalCapabilityStatement[] {
  const statements: CanonicalCapabilityStatement[] = [];
  const title = extractText(clinicalDocument.title || clinicalDocument['cda:title']);
  const effectiveTime = clinicalDocument.effectiveTime || clinicalDocument['cda:effectiveTime'];
  const date = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

  const custodian = clinicalDocument.custodian || clinicalDocument['cda:custodian'];
  const assignedCustodian = custodian?.assignedCustodian || custodian?.['cda:assignedCustodian'];
  const org = assignedCustodian?.representedCustodianOrganization || assignedCustodian?.['cda:representedCustodianOrganization'];
  const publisherName = extractText(org?.name || org?.['cda:name']);

  if (!title && !publisherName) return statements;

  statements.push({
    id: `CAP-${Date.now()}`,
    url: publisherName ? `urn:cda:${publisherName}` : undefined,
    name: title || publisherName || undefined,
    title: title || undefined,
    status: 'active',
    date: date,
    publisher: publisherName || undefined,
    kind: 'instance',
    fhirVersion: '5.0.0',
    format: ['xml']
  });

  return statements;
}

function extractOperationOutcomes(clinicalDocument: any): CanonicalOperationOutcome[] {
  const outcomes: CanonicalOperationOutcome[] = [];
  const components = clinicalDocument.component?.structuredBody?.component
    || clinicalDocument.component?.['cda:structuredBody']?.['cda:component']
    || [];
  const sections = Array.isArray(components) ? components : [components];

  for (const component of sections) {
    const section = component.section || component['cda:section'];
    if (!section) continue;
    const title = extractText(section.title || section['cda:title'])?.toLowerCase();
    const code = section.code || section['cda:code'];
    const codeValue = extractAttribute(code, '@_code');
    if (!title?.includes('operationoutcome') && codeValue !== 'OP-OUTCOME') continue;

    const text = extractText(section.text || section['cda:text']);
    const severity = 'error';
    const issue = {
      severity,
      code: 'processing',
      diagnostics: text || undefined
    };
    outcomes.push({
      id: `OO-${Date.now()}`,
      issue: [issue]
    });
  }

  return outcomes;
}

function extractParameters(clinicalDocument: any): CanonicalParameters[] {
  const title = extractText(clinicalDocument.title || clinicalDocument['cda:title']);
  const effectiveTime = clinicalDocument.effectiveTime || clinicalDocument['cda:effectiveTime'];
  const date = extractAttribute(effectiveTime, '@_value');

  if (!title && !date) return [];

  const params: Array<{ name: string; valueString?: string }> = [];
  if (title) params.push({ name: 'documentTitle', valueString: title });
  if (date) params.push({ name: 'documentDate', valueString: date });

  return [{
    id: `PARAMS-${Date.now()}`,
    parameter: params
  }];
}

function extractCarePlans(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string
): CanonicalCarePlan[] {
  const carePlans: CanonicalCarePlan[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isCarePlanSection = sectionCodeValue === '18776-5';
    if (!isCarePlanSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const plan of acts) {
      const id = extractId(plan.id || plan['cda:id']);
      const statusCode = plan.statusCode || plan['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = plan.code || plan['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(plan.text || plan['cda:text']);

      const effectiveTime = plan.effectiveTime || plan['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime?.low, '@_value') || extractAttribute(effectiveTime, '@_value'));
      const end = formatCDADateTime(extractAttribute(effectiveTime?.high, '@_value'));

      if (!id && !displayName && !text && !start && !end) continue;

      carePlans.push({
        id: id || `CAREPLAN-${carePlans.length + 1}`,
        identifier: id,
        status: status || 'active',
        intent: 'plan',
        title: displayName,
        description: text,
        subject: patientId,
        encounter: encounterId,
        period: start || end ? { start, end } : undefined
      });
    }
  });

  return carePlans;
}

function extractCareTeams(
  clinicalDocument: any,
  patientId?: string
): CanonicalCareTeam[] {
  const careTeams: CanonicalCareTeam[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isCareTeamSection = sectionCodeValue === '85847-2';
    if (!isCareTeamSection) return;

    const title = extractText(section?.title || section?.['cda:title']);
    const text = extractText(section?.text || section?.['cda:text']);

    const performer = entry.performer || entry['cda:performer'];
    const performers = Array.isArray(performer) ? performer : performer ? [performer] : [];
    const participants = performers
      .map(p => extractPerformerId(p))
      .filter(Boolean)
      .map(id => ({ member: id as string }));

    if (!title && !text && participants.length === 0) return;

    careTeams.push({
      id: `CARETEAM-${careTeams.length + 1}`,
      identifier: `CARETEAM-${careTeams.length + 1}`,
      status: 'active',
      name: title || 'Care Team',
      subject: patientId,
      note: text ? [text] : undefined,
      participant: participants.length ? participants : undefined
    });
  });

  return careTeams;
}

function extractProcedures(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string
): CanonicalProcedure[] {
  const procedures: CanonicalProcedure[] = [];

  iterateSectionEntries(clinicalDocument, entry => {
    const procedure = entry.procedure || entry['cda:procedure'];
    if (!procedure) return;
    const proceduresArray = Array.isArray(procedure) ? procedure : [procedure];

    for (const proc of proceduresArray) {
      const code = proc.code || proc['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      if (!codeValue && !displayName) continue;

      const statusCode = proc.statusCode || proc['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code') || 'completed';

      const effectiveTime = proc.effectiveTime || proc['cda:effectiveTime'];
      const effectiveValue = extractAttribute(effectiveTime, '@_value') ||
        extractAttribute(effectiveTime?.low, '@_value');

      const performerId = extractPerformerId(proc.performer || proc['cda:performer']);

      procedures.push({
        id: `PROC-${codeValue || procedures.length + 1}`,
        identifier: codeValue,
        status: status,
        code: {
          coding: codeValue ? [{
            system: mapCodeSystem(codeSystem),
            code: codeValue,
            display: displayName
          }] : undefined,
          text: displayName
        },
        subject: patientId,
        encounter: encounterId,
        occurrenceDateTime: formatCDADateTime(effectiveValue),
        performer: performerId ? [{
          actor: performerId
        }] : undefined
      });
    }
  });

  return procedures;
}

function extractConditions(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string
): CanonicalCondition[] {
  const conditions: CanonicalCondition[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isProblemSection = sectionCodeValue === '11450-4' || sectionCodeValue === '46241-6' || sectionCodeValue === '29308-4';
    if (!isProblemSection) return;

    const observation = entry.observation || entry['cda:observation'];
    const obsArray = observation ? (Array.isArray(observation) ? observation : [observation]) : [];
    for (const obs of obsArray) {
      const code = obs.code || obs['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);

      const value = obs.value || obs['cda:value'];
      const valueCode = extractAttribute(value, '@_code');
      const valueSystem = extractAttribute(value, '@_codeSystem');
      const valueDisplay = extractAttribute(value, '@_displayName') || extractText(value?.displayName);

      const onset = formatCDADateTime(extractAttribute(obs.effectiveTime || obs['cda:effectiveTime'], '@_value'));
      const recordedDate = formatCDADateTime(extractAttribute(obs.author?.time || obs['cda:author']?.time, '@_value'));

      const finalCode = valueCode || codeValue;
      const finalSystem = valueCode ? valueSystem : codeSystem;
      const finalDisplay = valueDisplay || displayName;

      if (!finalCode && !finalDisplay) continue;

      conditions.push({
        id: `COND-${finalCode || conditions.length + 1}`,
        identifier: finalCode,
        code: {
          coding: finalCode ? [{
            system: mapCodeSystem(finalSystem),
            code: finalCode,
            display: finalDisplay
          }] : undefined,
          text: finalDisplay
        },
        subject: patientId,
        encounter: encounterId,
        onsetDateTime: onset,
        recordedDate: recordedDate
      });
    }
  });

  return conditions;
}

function extractAppointments(
  clinicalDocument: any,
  patientId?: string
): CanonicalAppointment[] {
  const appointments: CanonicalAppointment[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isEncounterSection = sectionCodeValue === '46240-8';
    if (!isEncounterSection) return;

    const encounter = entry.encounter || entry['cda:encounter'];
    if (!encounter) return;
    const encounters = Array.isArray(encounter) ? encounter : [encounter];

    for (const enc of encounters) {
      const id = extractId(enc.id || enc['cda:id']);
      const statusCode = enc.statusCode || enc['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = enc.code || enc['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);

      const effectiveTime = enc.effectiveTime || enc['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime?.low, '@_value') || extractAttribute(effectiveTime, '@_value'));
      const end = formatCDADateTime(extractAttribute(effectiveTime?.high, '@_value'));

      if (!id && !start && !end && !displayName) continue;

      appointments.push({
        id: id || `APPT-${appointments.length + 1}`,
        identifier: id,
        status: status || 'proposed',
        description: displayName,
        start: start,
        end: end,
        subject: patientId
      });
    }
  });

  return appointments;
}

function extractSchedules(
  clinicalDocument: any,
  patientId?: string
): CanonicalSchedule[] {
  const schedules: CanonicalSchedule[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isEncounterSection = sectionCodeValue === '46240-8';
    if (!isEncounterSection) return;

    const encounter = entry.encounter || entry['cda:encounter'];
    if (!encounter) return;
    const encounters = Array.isArray(encounter) ? encounter : [encounter];

    for (const enc of encounters) {
      const id = extractId(enc.id || enc['cda:id']);
      const code = enc.code || enc['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);

      const effectiveTime = enc.effectiveTime || enc['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime?.low, '@_value') || extractAttribute(effectiveTime, '@_value'));
      const end = formatCDADateTime(extractAttribute(effectiveTime?.high, '@_value'));

      if (!id && !start && !end && !displayName) continue;

      schedules.push({
        id: id || `SCHED-${schedules.length + 1}`,
        identifier: id,
        active: true,
        name: displayName,
        actor: patientId ? [patientId] : undefined,
        planningHorizon: start || end ? { start, end } : undefined
      });
    }
  });

  return schedules;
}

function extractSlots(
  clinicalDocument: any,
  patientId?: string
): CanonicalSlot[] {
  const slots: CanonicalSlot[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isEncounterSection = sectionCodeValue === '46240-8';
    if (!isEncounterSection) return;

    const encounter = entry.encounter || entry['cda:encounter'];
    if (!encounter) return;
    const encounters = Array.isArray(encounter) ? encounter : [encounter];

    for (const enc of encounters) {
      const scheduleId = extractId(enc.id || enc['cda:id']);
      const effectiveTime = enc.effectiveTime || enc['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime?.low, '@_value') || extractAttribute(effectiveTime, '@_value'));
      const end = formatCDADateTime(extractAttribute(effectiveTime?.high, '@_value'));

      if (!scheduleId && !start && !end) continue;

      slots.push({
        id: scheduleId ? `SLOT-${scheduleId}` : `SLOT-${slots.length + 1}`,
        identifier: scheduleId,
        schedule: scheduleId,
        status: 'free',
        start: start,
        end: end,
        comment: patientId ? `Patient ${patientId}` : undefined
      });
    }
  });

  return slots;
}

function extractDiagnosticReports(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string
): CanonicalDiagnosticReport[] {
  const reports: CanonicalDiagnosticReport[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isDiagnosticSection = sectionCodeValue === '30954-2' || sectionCodeValue === '18748-4';
    if (!isDiagnosticSection) return;

    const organizer = entry.organizer || entry['cda:organizer'];
    const observations = entry.observation || entry['cda:observation'];
    const blocks = [];
    if (organizer) blocks.push(...(Array.isArray(organizer) ? organizer : [organizer]));
    if (observations) blocks.push(...(Array.isArray(observations) ? observations : [observations]));

    for (const block of blocks) {
      const code = block.code || block['cda:code'] || sectionCode;
      const codeValue = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);

      const statusCode = block.statusCode || block['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code') || 'final';

      const effectiveTime = block.effectiveTime || block['cda:effectiveTime'];
      const effectiveValue = extractAttribute(effectiveTime, '@_value') ||
        extractAttribute(effectiveTime?.low, '@_value');

      if (!codeValue && !displayName) continue;

      reports.push({
        id: `DR-${codeValue || reports.length + 1}`,
        identifier: codeValue,
        status: status,
        code: {
          coding: codeValue ? [{
            system: mapCodeSystem(codeSystem),
            code: codeValue,
            display: displayName
          }] : undefined,
          text: displayName
        },
        subject: patientId,
        encounter: encounterId,
        effectiveDateTime: formatCDADateTime(effectiveValue)
      });
    }
  });

  return reports;
}

function extractRelatedPersons(
  clinicalDocument: any,
  patientId?: string
): CanonicalRelatedPerson[] {
  const relatedPersons: CanonicalRelatedPerson[] = [];
  const recordTarget = clinicalDocument.recordTarget || clinicalDocument['cda:recordTarget'];
  const patientRole = Array.isArray(recordTarget)
    ? recordTarget[0]?.patientRole || recordTarget[0]?.['cda:patientRole']
    : recordTarget?.patientRole || recordTarget?.['cda:patientRole'];

  const guardian = patientRole?.guardian || patientRole?.['cda:guardian'];
  const guardians = guardian ? (Array.isArray(guardian) ? guardian : [guardian]) : [];

  guardians.forEach((g, index) => {
    const guardianPerson = g.guardianPerson || g['cda:guardianPerson'];
    const name = guardianPerson?.name || guardianPerson?.['cda:name'];
    const nameObj = Array.isArray(name) ? name[0] : name;
    const familyName = extractText(nameObj?.family) || extractText(nameObj?.['cda:family']);
    const givenNames = extractGivenNames(nameObj?.given || nameObj?.['cda:given']);

    const relationshipCode = g.code || g['cda:code'];
    const relationship = extractAttribute(relationshipCode, '@_code') || extractAttribute(relationshipCode, '@_displayName');

    const telecom = extractTelecom(g.telecom || g['cda:telecom']);
    const address = extractAddresses(g.addr || g['cda:addr']);

    relatedPersons.push({
      id: `REL-${index + 1}`,
      patient: patientId,
      relationship: relationship ? [{
        code: relationship,
        display: relationship
      }] : undefined,
      name: (familyName || (givenNames && givenNames.length)) ? [{
        family: familyName,
        given: givenNames
      }] : undefined,
      telecom: telecom && telecom.length ? telecom : undefined,
      address: address && address.length ? address : undefined,
      active: true
    });
  });

  return relatedPersons;
}

function extractEpisodesOfCare(
  clinicalDocument: any,
  patientId?: string
): CanonicalEpisodeOfCare[] {
  const episodes: CanonicalEpisodeOfCare[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isEncounterSection = sectionCodeValue === '46240-8';
    if (!isEncounterSection) return;

    const encounter = entry.encounter || entry['cda:encounter'];
    if (!encounter) return;
    const encounters = Array.isArray(encounter) ? encounter : [encounter];

    for (const enc of encounters) {
      const id = extractId(enc.id || enc['cda:id']);
      const statusCode = enc.statusCode || enc['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = enc.code || enc['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);

      const effectiveTime = enc.effectiveTime || enc['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime?.low, '@_value') || extractAttribute(effectiveTime, '@_value'));
      const end = formatCDADateTime(extractAttribute(effectiveTime?.high, '@_value'));

      if (!id && !start && !end && !displayName) continue;

      episodes.push({
        id: id || `EOC-${episodes.length + 1}`,
        identifier: id,
        status: status || (end ? 'finished' : 'active'),
        type: displayName ? [{
          code: displayName,
          display: displayName
        }] : undefined,
        patient: patientId,
        period: start || end ? { start, end } : undefined
      });
    }
  });

  return episodes;
}

function extractSpecimens(
  clinicalDocument: any,
  patientId?: string
): CanonicalSpecimen[] {
  const specimens: CanonicalSpecimen[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const specimenNode = entry.specimen || entry['cda:specimen'];
    if (!specimenNode) return;
    const specimensArray = Array.isArray(specimenNode) ? specimenNode : [specimenNode];

    for (const sp of specimensArray) {
      const specimenRole = sp.specimenRole || sp['cda:specimenRole'] || sp;
      const specimenId = extractId(specimenRole.id || specimenRole['cda:id']);
      const specimenPlaying = specimenRole.specimenPlayingEntity || specimenRole['cda:specimenPlayingEntity'];
      const code = specimenPlaying?.code || specimenPlaying?.['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);

      const receivedTime = extractAttribute(specimenRole.receivedTime || specimenRole['cda:receivedTime'], '@_value');
      const collectedTime = extractAttribute(specimenRole.effectiveTime || specimenRole['cda:effectiveTime'], '@_value');

      if (!specimenId && !codeValue && !displayName) continue;

      specimens.push({
        id: specimenId || `SPEC-${specimens.length + 1}`,
        identifier: specimenId,
        status: 'available',
        type: (codeValue || displayName) ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        subject: patientId,
        receivedTime: formatCDADateTime(receivedTime),
        collection: collectedTime ? {
          collectedDateTime: formatCDADateTime(collectedTime)
        } : undefined
      });
    }
  });

  return specimens;
}

function extractImagingStudies(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string
): CanonicalImagingStudy[] {
  const studies: CanonicalImagingStudy[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isImagingSection = sectionCodeValue === '18748-4' || sectionCodeValue === '30954-2';
    if (!isImagingSection) return;

    const organizer = entry.organizer || entry['cda:organizer'];
    const observation = entry.observation || entry['cda:observation'];
    const blocks = [];
    if (organizer) blocks.push(...(Array.isArray(organizer) ? organizer : [organizer]));
    if (observation) blocks.push(...(Array.isArray(observation) ? observation : [observation]));

    for (const block of blocks) {
      const code = block.code || block['cda:code'] || sectionCode;
      const codeValue = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);

      const statusCode = block.statusCode || block['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');

      const effectiveTime = block.effectiveTime || block['cda:effectiveTime'];
      const effectiveValue = extractAttribute(effectiveTime, '@_value') ||
        extractAttribute(effectiveTime?.low, '@_value');

      if (!codeValue && !displayName) continue;

      studies.push({
        id: `IMG-${codeValue || studies.length + 1}`,
        identifier: codeValue,
        status: status || 'available',
        modality: (codeValue || displayName) ? [{
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        }] : undefined,
        subject: patientId,
        encounter: encounterId,
        started: formatCDADateTime(effectiveValue),
        description: displayName
      });
    }
  });

  return studies;
}

function extractAllergyIntolerances(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string
): CanonicalAllergyIntolerance[] {
  const allergies: CanonicalAllergyIntolerance[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isAllergySection = sectionCodeValue === '48765-2' || sectionCodeValue === '48765-2';
    if (!isAllergySection) return;

    const observation = entry.observation || entry['cda:observation'];
    const observations = observation ? (Array.isArray(observation) ? observation : [observation]) : [];

    for (const obs of observations) {
      const code = obs.code || obs['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);

      const value = obs.value || obs['cda:value'];
      const valueCode = extractAttribute(value, '@_code');
      const valueSystem = extractAttribute(value, '@_codeSystem');
      const valueDisplay = extractAttribute(value, '@_displayName') || extractText(value?.displayName);

      const onset = formatCDADateTime(extractAttribute(obs.effectiveTime || obs['cda:effectiveTime'], '@_value'));
      const recordedDate = formatCDADateTime(extractAttribute(obs.author?.time || obs['cda:author']?.time, '@_value'));

      const finalCode = valueCode || codeValue;
      const finalSystem = valueCode ? valueSystem : codeSystem;
      const finalDisplay = valueDisplay || displayName;

      if (!finalCode && !finalDisplay) continue;

      allergies.push({
        id: `ALG-${finalCode || allergies.length + 1}`,
        identifier: finalCode,
        clinicalStatus: { code: 'active', display: 'active' },
        verificationStatus: { code: 'confirmed', display: 'confirmed' },
        code: {
          system: mapCodeSystem(finalSystem),
          code: finalCode,
          display: finalDisplay
        },
        patient: patientId,
        encounter: encounterId,
        onsetDateTime: onset,
        recordedDate: recordedDate
      });
    }
  });

  return allergies;
}

function extractLocations(clinicalDocument: any): CanonicalLocation[] {
  const locations: CanonicalLocation[] = [];

  const componentOf = clinicalDocument.componentOf || clinicalDocument['cda:componentOf'];
  const encounterNode = componentOf?.encompassingEncounter || componentOf?.['cda:encompassingEncounter'];
  const encounterLocations = encounterNode?.location || encounterNode?.['cda:location'];
  const encounterLocationList = encounterLocations ? (Array.isArray(encounterLocations) ? encounterLocations : [encounterLocations]) : [];

  for (const loc of encounterLocationList) {
    const location = mapCDALocationNode(loc);
    if (location) locations.push(location);
  }

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isEncounterSection = sectionCodeValue === '46240-8';
    if (!isEncounterSection) return;

    const encounter = entry.encounter || entry['cda:encounter'];
    if (!encounter) return;
    const encounters = Array.isArray(encounter) ? encounter : [encounter];

    for (const enc of encounters) {
      const locationNode = enc.location || enc['cda:location'];
      const locationFromParticipant = enc.participant || enc['cda:participant'];
      const participantArray = locationFromParticipant ? (Array.isArray(locationFromParticipant) ? locationFromParticipant : [locationFromParticipant]) : [];

      const location = mapCDALocationNode(locationNode);
      if (location) locations.push(location);

      for (const participant of participantArray) {
        const participantRole = participant.participantRole || participant['cda:participantRole'];
        const playingEntity = participantRole?.playingEntity || participantRole?.['cda:playingEntity'];
        if (!playingEntity) continue;
        const locationFromPlaying = mapCDALocationNode(playingEntity);
        if (locationFromPlaying) locations.push(locationFromPlaying);
      }
    }
  });

  return locations;
}

function mapCDALocationNode(node: any): CanonicalLocation | undefined {
  if (!node) return undefined;

  const locationContainer =
    node.healthCareFacility ||
    node['cda:healthCareFacility'] ||
    node.serviceDeliveryLocation ||
    node['cda:serviceDeliveryLocation'] ||
    node;

  const locationDetail =
    locationContainer?.location ||
    locationContainer?.['cda:location'] ||
    locationContainer;

  const locationId = extractId(locationDetail?.id || locationDetail?.['cda:id'] || locationContainer?.id || locationContainer?.['cda:id']);
  const name = extractText(locationDetail?.name || locationDetail?.['cda:name'] || locationContainer?.name || locationContainer?.['cda:name']);
  const statusCode = locationDetail?.statusCode || locationDetail?.['cda:statusCode'];
  const status = extractAttribute(statusCode, '@_code');
  const description = extractText(locationDetail?.desc || locationDetail?.['cda:desc']);
  const address = extractAddresses(
    locationDetail?.addr ||
    locationDetail?.['cda:addr'] ||
    locationContainer?.addr ||
    locationContainer?.['cda:addr']
  );

  if (!locationId && !name && !description && (!address || !address.length)) return undefined;

  return {
    id: locationId,
    identifier: locationId,
    status: status || undefined,
    name: name || undefined,
    description: description || undefined,
    address: address && address.length ? address[0] : undefined
  };
}

function extractPractitionerData(clinicalDocument: any) {
  const practitioners = new Map<string, CanonicalPractitioner>();
  const organizations = new Map<string, CanonicalOrganization>();
  const practitionerRoles: CanonicalPractitionerRole[] = [];
  const authorIds: string[] = [];

  const author = clinicalDocument.author || clinicalDocument['cda:author'];
  const authorArray = Array.isArray(author) ? author : author ? [author] : [];

  authorArray.forEach((auth, index) => {
    const assignedAuthor = auth?.assignedAuthor || auth?.['cda:assignedAuthor'];
    if (!assignedAuthor) return;
    const practitionerId = extractId(assignedAuthor.id || assignedAuthor['cda:id']);
    const assignedPerson = assignedAuthor.assignedPerson || assignedAuthor['cda:assignedPerson'];
    const name = assignedPerson?.name || assignedPerson?.['cda:name'];
    if (practitionerId && name) {
      const practitioner = buildPractitioner(practitionerId, name);
      practitioners.set(practitionerId, practitioner);
      authorIds.push(practitionerId);
    }

    const representedOrg = assignedAuthor.representedOrganization || assignedAuthor['cda:representedOrganization'];
    const organization = buildOrganizationFromCDA(representedOrg);
    if (organization?.id) {
      organizations.set(organization.id, organization);
      if (practitionerId) {
        practitionerRoles.push({
          id: `ROLE-${practitionerId}-${index + 1}`,
          practitionerId,
          organizationId: organization.id,
          code: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
            code: 'AUT',
            display: 'author'
          }]
        });
      }
    }
  });

  return {
    practitioners: Array.from(practitioners.values()),
    practitionerRoles,
    organizations: Array.from(organizations.values()),
    authorIds
  };
}

function buildPractitioner(id: string, nameNode: any): CanonicalPractitioner {
  const nameObj = Array.isArray(nameNode) ? nameNode[0] : nameNode;
  const familyName = extractText(nameObj?.family || nameObj?.['cda:family']);
  const givenNames = extractGivenNames(nameObj?.given || nameObj?.['cda:given']);
  return {
    id,
    identifier: id,
    name: {
      family: familyName,
      given: givenNames.length ? givenNames : undefined
    }
  };
}

function extractCustodianOrganizations(clinicalDocument: any): CanonicalOrganization[] {
  const organizations: CanonicalOrganization[] = [];
  const custodian = clinicalDocument.custodian || clinicalDocument['cda:custodian'];
  if (!custodian) return organizations;
  const assignedCustodian = custodian.assignedCustodian || custodian['cda:assignedCustodian'];
  const representedOrg = assignedCustodian?.representedCustodianOrganization ||
    assignedCustodian?.['cda:representedCustodianOrganization'];
  const organization = buildOrganizationFromCDA(representedOrg);
  if (organization) organizations.push(organization);
  return organizations;
}

function buildOrganizationFromCDA(orgNode: any): CanonicalOrganization | undefined {
  if (!orgNode) return undefined;
  const organizationNode = Array.isArray(orgNode) ? orgNode[0] : orgNode;
  const orgId = extractId(organizationNode.id || organizationNode['cda:id']) || extractText(organizationNode.id);
  const orgName = extractText(organizationNode.name || organizationNode['cda:name']) || orgId;
  if (!orgId && !orgName) return undefined;
  return {
    id: orgId || orgName,
    identifier: orgId || orgName,
    name: orgName
  };
}

function mergeOrganizations(...orgLists: CanonicalOrganization[][]): CanonicalOrganization[] {
  const map = new Map<string, CanonicalOrganization>();
  orgLists.flat().forEach(org => {
    if (!org) return;
    const key = org.identifier || org.id || org.name;
    if (key && !map.has(key)) {
      map.set(key, org);
    }
  });
  return Array.from(map.values());
}

interface DocumentReferenceArgs {
  clinicalDocument: any;
  cdaXml: string;
  patientId?: string;
  encounterId?: string;
  authorIds?: string[];
  custodianId?: string;
}

function buildDocumentReference({
  clinicalDocument,
  cdaXml,
  patientId,
  encounterId,
  authorIds,
  custodianId
}: DocumentReferenceArgs): CanonicalDocumentReference | undefined {
  const docId = extractId(clinicalDocument.id || clinicalDocument['cda:id']);
  const typeId = clinicalDocument.typeId || clinicalDocument['cda:typeId'];
  const typeSystem = extractAttribute(typeId, '@_root');
  const typeCode = extractAttribute(typeId, '@_extension');
  const codeNode = clinicalDocument.code || clinicalDocument['cda:code'];
  const docCode = extractAttribute(codeNode, '@_code');
  const docCodeSystem = extractAttribute(codeNode, '@_codeSystem');
  const effectiveTime = extractAttribute(
    clinicalDocument.effectiveTime || clinicalDocument['cda:effectiveTime'],
    '@_value'
  );
  const title = extractText(clinicalDocument.title || clinicalDocument['cda:title']);

  const attachmentData = Buffer.from(cdaXml, 'utf8').toString('base64');

  return {
    id: docId || 'CDA-DOC',
    identifier: docId,
    status: 'current',
    subject: patientId,
    date: formatCDADateTime(effectiveTime),
    author: authorIds && authorIds.length ? authorIds : undefined,
    custodian: custodianId,
    type: docCode || docCodeSystem
      ? { coding: [{ system: mapCodeSystem(docCodeSystem), code: docCode }] }
      : (typeSystem || typeCode ? { coding: [{ system: normalizeCodeSystem(typeSystem), code: typeCode }] } : undefined),
    content: [{
      attachment: {
        contentType: 'text/xml',
        data: attachmentData,
        title: title || undefined
      }
    }],
    context: encounterId ? { encounter: [encounterId] } : undefined
  };
}

function normalizeCodeSystem(system?: string): string | undefined {
  if (!system) return undefined;
  if (/^\d+(\.\d+)+$/.test(system)) {
    return `urn:oid:${system}`;
  }
  return mapCodeSystem(system);
}

function mapCDAGender(code?: string): string {
  if (!code) return 'unknown';
  const codeUpper = code.toUpperCase();
  if (codeUpper === 'M' || codeUpper === 'MALE') return 'male';
  if (codeUpper === 'F' || codeUpper === 'FEMALE') return 'female';
  return 'other';
}

function buildDosageFromSubstance({
  doseValue,
  doseUnit,
  route,
  effectiveNode
}: {
  doseValue?: string;
  doseUnit?: string;
  route?: string;
  effectiveNode?: any;
}) {
  const doseQuantity = doseValue || doseUnit
    ? {
        value: doseValue ? Number(doseValue) : undefined,
        unit: doseUnit
      }
    : undefined;

  const frequency = extractFrequencyText(effectiveNode);
  const textParts: string[] = [];
  if (doseQuantity?.value !== undefined) {
    textParts.push(`${doseQuantity.value}${doseQuantity.unit ? ` ${doseQuantity.unit}` : ''}`.trim());
  } else if (doseQuantity?.unit) {
    textParts.push(doseQuantity.unit);
  }
  if (route) textParts.push(route);
  if (frequency) textParts.push(frequency);

  if (!doseQuantity && textParts.length === 0) return undefined;
  return {
    text: textParts.join(' ').trim() || undefined,
    doseQuantity
  };
}

function extractFrequencyText(effectiveNode?: any): string | undefined {
  if (!effectiveNode) return undefined;
  const period = effectiveNode.period || effectiveNode['cda:period'];
  const periodValue = extractAttribute(period, '@_value');
  const periodUnit = extractAttribute(period, '@_unit');
  if (periodValue && periodUnit) {
    return `every ${periodValue} ${periodUnit}`;
  }
  const frequency = effectiveNode.frequency || effectiveNode['cda:frequency'];
  const frequencyValue = extractAttribute(frequency, '@_value');
  if (frequencyValue) {
    return `${frequencyValue} times`;
  }
  return undefined;
}

function extractPerformerId(performer: any): string | undefined {
  if (!performer) return undefined;
  const performerNode = Array.isArray(performer) ? performer[0] : performer;
  const assignedEntity = performerNode?.assignedEntity || performerNode?.['cda:assignedEntity'];
  return extractId(assignedEntity?.id || assignedEntity?.['cda:id']);
}

function mapMedicationStatus(substance: any): string {
  const moodCode = extractAttribute(substance, '@_moodCode')?.toUpperCase();
  if (moodCode && ['INT', 'RQO', 'PRMS'].includes(moodCode)) return 'active';
  return 'completed';
}

function extractEncounterClass(encounter: any): string {
  if (!encounter) return 'AMB';
  
  const code = encounter.code || encounter['cda:code'];
  const codeValue = extractAttribute(code, '@_code');
  
  return mapEncounterClass(codeValue);
}

function mapEncounterClass(code?: string): string {
  if (!code) return 'AMB';
  // Map CDA encounter codes to FHIR encounter classes
  const codeUpper = code.toUpperCase();
  if (codeUpper.includes('IMP') || codeUpper.includes('INPATIENT') || codeUpper === 'AMB-IMP') return 'IMP';
  if (codeUpper.includes('AMB') || codeUpper.includes('AMBULATORY')) return 'AMB';
  if (codeUpper.includes('EMER') || codeUpper.includes('EMERGENCY')) return 'EMER';
  if (codeUpper.includes('VR') || codeUpper.includes('VIRTUAL')) return 'VR';
  return 'AMB';
}

function mapCodeSystem(system?: string): string {
  if (!system) return 'http://loinc.org';
  // Common CDA code systems
  if (/^https?:\/\//i.test(system)) {
    return system;
  }
  const systemLower = system.toLowerCase();
  if (systemLower.includes('loinc') || system === '2.16.840.1.113883.6.1') {
    return 'http://loinc.org';
  }
  if (systemLower.includes('snomed') || system === '2.16.840.1.113883.6.96') {
    return 'http://snomed.info/sct';
  }
  if (systemLower.includes('icd-10') || system === '2.16.840.1.113883.6.3') {
    return 'http://hl7.org/fhir/sid/icd-10';
  }
  if (systemLower.includes('icd-9') || system === '2.16.840.1.113883.6.103') {
    return 'http://hl7.org/fhir/sid/icd-9-cm';
  }
  if (system === '2.16.840.1.113883.6.88') {
    return 'http://www.nlm.nih.gov/research/umls/rxnorm';
  }
  if (/^\d+(\.\d+)+$/.test(system)) {
    return `urn:oid:${system}`;
  }
  return system;
}

function formatCDADate(cdaDate?: string): string | undefined {
  const dateTime = formatCDADateTime(cdaDate);
  return dateTime ? dateTime.slice(0, 10) : undefined;
}

function formatCDADateTime(value?: string): string | undefined {
  if (!value) return undefined;
  const match = value
    .replace(/[^0-9Z+\-]/g, '')
    .match(/^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})?(\d{2})?)?(Z|[+-]\d{4})?$/);
  if (!match) return undefined;

  const [, year, month, day, hour, minute, second, zone] = match;
  if (!hour) return `${year}-${month}-${day}`;

  const hh = hour.padStart(2, '0');
  const mm = (minute ?? '00').padStart(2, '0');
  const ss = (second ?? '00').padStart(2, '0');
  const offset = zone
    ? zone === 'Z'
      ? 'Z'
      : `${zone.slice(0, 3)}:${zone.slice(3)}`
    : 'Z';

  return `${year}-${month}-${day}T${hh}:${mm}:${ss}${offset}`;
}
