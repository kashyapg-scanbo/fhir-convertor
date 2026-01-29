import { Buffer } from 'node:buffer';
import { XMLParser } from 'fast-xml-parser';
import {
  CanonicalDocumentReference,
  CanonicalMedication,
  CanonicalMedicationRequest,
  CanonicalMedicationStatement,
  CanonicalMedicationAdministration,
  CanonicalMedicationDispense,
  CanonicalProcedure,
  CanonicalCondition,
  CanonicalAppointment,
  CanonicalAppointmentResponse,
  CanonicalClaim,
  CanonicalClaimResponse,
  CanonicalComposition,
  CanonicalExplanationOfBenefit,
  CanonicalCoverage,
  CanonicalDeviceDispense,
  CanonicalDeviceRequest,
  CanonicalDeviceUsage,
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
  CanonicalConsent,
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
  const medicationDispenses = extractMedicationDispenses(
    clinicalDocument,
    patient.id,
    encounter?.id,
    practitionerData.authorIds[0]
  );
  const procedures = extractProcedures(clinicalDocument, patient.id, encounter?.id);
  const conditions = extractConditions(clinicalDocument, patient.id, encounter?.id);
  const appointments = extractAppointments(clinicalDocument, patient.id);
  const appointmentResponses = extractAppointmentResponses(clinicalDocument, patient.id);
  const claims = extractClaims(clinicalDocument, patient.id, encounter?.id);
  const claimResponses = extractClaimResponses(clinicalDocument, patient.id, encounter?.id);
  const compositions = extractCompositions(clinicalDocument, patient.id);
  const explanationOfBenefits = extractExplanationOfBenefits(clinicalDocument, patient.id, encounter?.id);
  const coverages = extractCoverages(clinicalDocument, patient.id);
  const deviceDispenses = extractDeviceDispenses(clinicalDocument, patient.id, encounter?.id);
  const deviceRequests = extractDeviceRequests(clinicalDocument, patient.id, encounter?.id);
  const deviceUsages = extractDeviceUsages(clinicalDocument, patient.id, encounter?.id);
  const encounterHistories = extractEncounterHistories(clinicalDocument, patient.id);
  const flags = extractFlags(clinicalDocument, patient.id, encounter?.id);
  const lists = extractLists(clinicalDocument, patient.id, encounter?.id);
  const nutritionIntakes = extractNutritionIntakes(clinicalDocument, patient.id, encounter?.id);
  const nutritionOrders = extractNutritionOrders(clinicalDocument, patient.id, encounter?.id);
  const riskAssessments = extractRiskAssessments(clinicalDocument, patient.id, encounter?.id);
  const binaries = extractBinaries(clinicalDocument, cdaXml);
  const accounts = extractAccounts(clinicalDocument, patient.id);
  const chargeItems = extractChargeItems(clinicalDocument, patient.id, encounter?.id);
  const chargeItemDefinitions = extractChargeItemDefinitions(clinicalDocument);
  const devices = extractDevices(clinicalDocument, patient.id);
  const deviceMetrics = extractDeviceMetrics(clinicalDocument, patient.id);
  const endpoints = extractEndpoints(clinicalDocument);
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
  const goals = extractGoals(clinicalDocument, patient.id);
  const serviceRequests = extractServiceRequests(clinicalDocument, patient.id, encounter?.id);
  const tasks = extractTasks(clinicalDocument, patient.id, encounter?.id);
  const communications = extractCommunications(clinicalDocument, patient.id, encounter?.id);
  const communicationRequests = extractCommunicationRequests(clinicalDocument, patient.id, encounter?.id);
  const questionnaires = extractQuestionnaires(clinicalDocument);
  const questionnaireResponses = extractQuestionnaireResponses(clinicalDocument, patient.id, encounter?.id);
  const codeSystems = extractCodeSystems(clinicalDocument);
  const valueSets = extractValueSets(clinicalDocument);
  const conceptMaps = extractConceptMaps(clinicalDocument);
  const namingSystems = extractNamingSystems(clinicalDocument);
  const terminologyCapabilities = extractTerminologyCapabilities(clinicalDocument);
  const provenances = extractProvenances(clinicalDocument);
  const auditEvents = extractAuditEvents(clinicalDocument);
  const consents = extractConsents(clinicalDocument);
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
  if (medicationDispenses.length) canonical.medicationDispenses = medicationDispenses;
  if (procedures.length) canonical.procedures = procedures;
  if (conditions.length) canonical.conditions = conditions;
  if (appointments.length) canonical.appointments = appointments;
  if (appointmentResponses.length) canonical.appointmentResponses = appointmentResponses;
  if (claims.length) canonical.claims = claims;
  if (claimResponses.length) canonical.claimResponses = claimResponses;
  if (compositions.length) canonical.compositions = compositions;
  if (explanationOfBenefits.length) canonical.explanationOfBenefits = explanationOfBenefits;
  if (coverages.length) canonical.coverages = coverages;
  if (deviceDispenses.length) canonical.deviceDispenses = deviceDispenses;
  if (deviceRequests.length) canonical.deviceRequests = deviceRequests;
  if (deviceUsages.length) canonical.deviceUsages = deviceUsages;
  if (encounterHistories.length) canonical.encounterHistories = encounterHistories;
  if (flags.length) canonical.flags = flags;
  if (lists.length) canonical.lists = lists;
  if (nutritionIntakes.length) canonical.nutritionIntakes = nutritionIntakes;
  if (nutritionOrders.length) canonical.nutritionOrders = nutritionOrders;
  if (riskAssessments.length) canonical.riskAssessments = riskAssessments;
  if (binaries.length) canonical.binaries = binaries;
  if (accounts.length) canonical.accounts = accounts;
  if (chargeItems.length) canonical.chargeItems = chargeItems;
  if (chargeItemDefinitions.length) canonical.chargeItemDefinitions = chargeItemDefinitions;
  if (devices.length) canonical.devices = devices;
  if (deviceMetrics.length) canonical.deviceMetrics = deviceMetrics;
  if (endpoints.length) canonical.endpoints = endpoints;
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
  if (goals.length) canonical.goals = goals;
  if (serviceRequests.length) canonical.serviceRequests = serviceRequests;
  if (tasks.length) canonical.tasks = tasks;
  if (communications.length) canonical.communications = communications;
  if (communicationRequests.length) canonical.communicationRequests = communicationRequests;
  if (questionnaires.length) canonical.questionnaires = questionnaires;
  if (questionnaireResponses.length) canonical.questionnaireResponses = questionnaireResponses;
  if (codeSystems.length) canonical.codeSystems = codeSystems;
  if (valueSets.length) canonical.valueSets = valueSets;
  if (conceptMaps.length) canonical.conceptMaps = conceptMaps;
  if (namingSystems.length) canonical.namingSystems = namingSystems;
  if (terminologyCapabilities.length) canonical.terminologyCapabilities = terminologyCapabilities;
  if (provenances.length) canonical.provenances = provenances;
  if (auditEvents.length) canonical.auditEvents = auditEvents;
  if (consents.length) canonical.consents = consents;
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
    if (!entry || typeof entry !== 'object') return;
    let observation = entry.observation || entry['cda:observation'];

    if (!observation) {
      const organizer = entry.organizer || entry['cda:organizer'];
      if (organizer) {
        const orgComponent = organizer.component || organizer['cda:component'];
        const orgComponentArray = orgComponent
          ? Array.isArray(orgComponent)
            ? orgComponent
            : [orgComponent]
          : [];
        observation = orgComponentArray
          .map((oc: any) => oc?.observation || oc?.['cda:observation'])
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
      const resolvedMedSystem = medSystem ? mapCodeSystem(medSystem) : undefined;
      const medSystemForCoding =
        resolvedMedSystem === 'http://www.nlm.nih.gov/research/umls/rxnorm' && medCode && !/^\d+$/.test(medCode)
          ? undefined
          : resolvedMedSystem;
      const medicationCodeableConcept = medCode
        ? {
            coding: [{
              system: medSystemForCoding,
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
      const documentEffectiveTime = extractAttribute(
        clinicalDocument.effectiveTime || clinicalDocument['cda:effectiveTime'],
        '@_value'
      );

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
        authoredOn: formatCDADateTime(effectiveValue || documentEffectiveTime),
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
        effectiveDateTime: formatCDADateTime(effectiveValue || documentEffectiveTime),
        dateAsserted: formatCDADateTime(effectiveValue || documentEffectiveTime),
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
      const resolvedMedSystem = medSystem ? mapCodeSystem(medSystem) : undefined;
      const medSystemForCoding =
        resolvedMedSystem === 'http://www.nlm.nih.gov/research/umls/rxnorm' && medCode && !/^\d+$/.test(medCode)
          ? undefined
          : resolvedMedSystem;

      if (!medCode && !medDisplay) continue;

      const statusCode = substance.statusCode || substance['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code') || 'completed';

      const effectiveTime = substance.effectiveTime || substance['cda:effectiveTime'];
      const effectiveNode = Array.isArray(effectiveTime) ? effectiveTime[0] : effectiveTime;
      const occurrence =
        extractAttribute(effectiveNode, '@_value') ||
        extractAttribute(effectiveNode?.low, '@_value');
      const documentEffectiveTime = extractAttribute(
        clinicalDocument.effectiveTime || clinicalDocument['cda:effectiveTime'],
        '@_value'
      );

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
            system: medSystemForCoding,
            code: medCode,
            display: medDisplay
          }] : undefined,
          text: medDisplay
        } : undefined,
        subject: patientId,
        encounter: encounterId,
        occurrenceDateTime: formatCDADateTime(occurrence || documentEffectiveTime),
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

function extractMedicationDispenses(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string,
  defaultPerformerId?: string
): CanonicalMedicationDispense[] {
  const dispenses: CanonicalMedicationDispense[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    if (!entry || typeof entry !== 'object') return;
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isDispenseSection = sectionCodeValue === 'MEDICATIONDISPENSE';
    if (!isDispenseSection) return;

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
      const resolvedMedSystem = medSystem ? mapCodeSystem(medSystem) : undefined;
      const medSystemForCoding =
        resolvedMedSystem === 'http://www.nlm.nih.gov/research/umls/rxnorm' && medCode && !/^\d+$/.test(medCode)
          ? undefined
          : resolvedMedSystem;

      if (!medCode && !medDisplay) continue;

      const statusCode = substance.statusCode || substance['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code') || 'completed';

      const effectiveTime = substance.effectiveTime || substance['cda:effectiveTime'];
      const effectiveNode = Array.isArray(effectiveTime) ? effectiveTime[0] : effectiveTime;
      const whenHandedOver =
        extractAttribute(effectiveNode, '@_value') ||
        extractAttribute(effectiveNode?.low, '@_value');

      const doseQuantity = substance.doseQuantity || substance['cda:doseQuantity'];
      const doseValue = extractAttribute(doseQuantity, '@_value');
      const doseUnit = extractAttribute(doseQuantity, '@_unit');

      const performerId =
        extractPerformerId(substance.performer || substance['cda:performer']) ||
        defaultPerformerId;

      dispenses.push({
        id: `MEDDISP-${medCode || dispenses.length + 1}`,
        identifier: medCode,
        status: status,
        medicationCodeableConcept: medCode || medDisplay ? {
          coding: medCode ? [{
            system: medSystemForCoding,
            code: medCode,
            display: medDisplay
          }] : undefined,
          text: medDisplay
        } : undefined,
        subject: patientId,
        encounter: encounterId,
        whenHandedOver: formatCDADateTime(whenHandedOver),
        performer: performerId ? [{ actor: performerId }] : undefined,
        quantity: doseValue ? { value: Number(doseValue), unit: doseUnit } : undefined
      });
    }
  });

  return dispenses;
}

function extractImmunizations(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string,
  defaultPerformerId?: string
): CanonicalImmunization[] {
  const immunizations: CanonicalImmunization[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isImmunizationSection = sectionCodeValue === '11369-6';
    if (!isImmunizationSection) return;

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
      const documentEffectiveTime = extractAttribute(
        clinicalDocument.effectiveTime || clinicalDocument['cda:effectiveTime'],
        '@_value'
      );

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
          system: vaccineSystem ? mapCodeSystem(vaccineSystem) : undefined,
          code: vaccineCode,
          display: vaccineDisplay
        } : undefined,
        lotNumber: lotNumber,
        patient: patientId,
        encounter: encounterId,
        occurrenceDateTime: formatCDADateTime(occurrence || documentEffectiveTime),
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
    format: ['xml'],
    implementation: {
      description: title || 'CDA document',
      url: publisherName ? `urn:cda:${publisherName}` : undefined
    },
    rest: [{
      mode: 'server',
      documentation: 'Derived from CDA document header'
    }]
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
    if (!entry || typeof entry !== 'object') return;
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

function extractGoals(
  clinicalDocument: any,
  patientId?: string
): CanonicalGoal[] {
  const goals: CanonicalGoal[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isGoalSection = sectionCodeValue === '61146-7';
    if (!isGoalSection) return;

    const observation = entry.observation || entry['cda:observation'];
    if (!observation) return;
    const observations = Array.isArray(observation) ? observation : [observation];

    for (const obs of observations) {
      const id = extractId(obs.id || obs['cda:id']);
      const statusCode = obs.statusCode || obs['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = obs.code || obs['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);

      const effectiveTime = obs.effectiveTime || obs['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName) continue;

      goals.push({
        id: id || `GOAL-${goals.length + 1}`,
        identifier: id,
        lifecycleStatus: status || 'active',
        description: displayName ? { text: displayName } : undefined,
        subject: patientId,
        startDate: start
      });
    }
  });

  return goals;
}

function extractServiceRequests(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string
): CanonicalServiceRequest[] {
  const requests: CanonicalServiceRequest[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isPlanSection = sectionCodeValue === '46209-3';
    if (!isPlanSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const req of acts) {
      const id = extractId(req.id || req['cda:id']);
      const statusCode = req.statusCode || req['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = req.code || req['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const effectiveTime = req.effectiveTime || req['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName) continue;

      requests.push({
        id: id || `SR-${requests.length + 1}`,
        identifier: id,
        status: status || 'active',
        intent: 'order',
        code: displayName ? { display: displayName } : undefined,
        subject: patientId,
        encounter: encounterId,
        authoredOn: start
      });
    }
  });

  return requests;
}

function extractTasks(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string
): CanonicalTask[] {
  const tasks: CanonicalTask[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isTaskSection = sectionCodeValue === 'TASK';
    if (!isTaskSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const task of acts) {
      const id = extractId(task.id || task['cda:id']);
      const statusCode = task.statusCode || task['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = task.code || task['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(task.text || task['cda:text']);

      const effectiveTime = task.effectiveTime || task['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !text) continue;

      tasks.push({
        id: id || `TASK-${tasks.length + 1}`,
        identifier: id,
        status: status || 'requested',
        intent: 'order',
        code: displayName ? { display: displayName } : undefined,
        description: text || displayName || undefined,
        for: patientId,
        encounter: encounterId,
        authoredOn: start
      });
    }
  });

  return tasks;
}

function extractCommunications(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string
): CanonicalCommunication[] {
  const communications: CanonicalCommunication[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isCommunicationSection = sectionCodeValue === 'COMM';
    if (!isCommunicationSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const comm of acts) {
      const id = extractId(comm.id || comm['cda:id']);
      const statusCode = comm.statusCode || comm['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = comm.code || comm['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(comm.text || comm['cda:text']);
      const effectiveTime = comm.effectiveTime || comm['cda:effectiveTime'];
      const sent = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !text) continue;

      communications.push({
        id: id || `COMM-${communications.length + 1}`,
        identifier: id,
        status: status || 'completed',
        topic: displayName ? { display: displayName } : undefined,
        subject: patientId,
        encounter: encounterId,
        sent: sent,
        note: text ? [text] : undefined
      });
    }
  });

  return communications;
}

function extractCommunicationRequests(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string
): CanonicalCommunicationRequest[] {
  const requests: CanonicalCommunicationRequest[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isCommunicationRequestSection = sectionCodeValue === 'COMREQ';
    if (!isCommunicationRequestSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const comm of acts) {
      const id = extractId(comm.id || comm['cda:id']);
      const statusCode = comm.statusCode || comm['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = comm.code || comm['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(comm.text || comm['cda:text']);
      const effectiveTime = comm.effectiveTime || comm['cda:effectiveTime'];
      const occurrence = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !text) continue;

      requests.push({
        id: id || `COMMREQ-${requests.length + 1}`,
        identifier: id,
        status: status || 'active',
        intent: 'order',
        category: displayName ? [{ display: displayName }] : undefined,
        subject: patientId,
        encounter: encounterId,
        occurrenceDateTime: occurrence,
        note: text ? [text] : undefined
      });
    }
  });

  return requests;
}

function extractQuestionnaires(
  clinicalDocument: any
): CanonicalQuestionnaire[] {
  const questionnaires: CanonicalQuestionnaire[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isQuestionnaireSection = sectionCodeValue === 'QNR';
    if (!isQuestionnaireSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const qnr of acts) {
      const id = extractId(qnr.id || qnr['cda:id']);
      const statusCode = qnr.statusCode || qnr['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = qnr.code || qnr['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(qnr.text || qnr['cda:text']);
      const effectiveTime = qnr.effectiveTime || qnr['cda:effectiveTime'];
      const date = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !text) continue;

      questionnaires.push({
        id: id || `QNR-${questionnaires.length + 1}`,
        identifier: id,
        status: status || 'active',
        title: displayName,
        description: text,
        date: date
      });
    }
  });

  return questionnaires;
}

function extractQuestionnaireResponses(
  clinicalDocument: any,
  patientId?: string,
  encounterId?: string
): CanonicalQuestionnaireResponse[] {
  const responses: CanonicalQuestionnaireResponse[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isResponseSection = sectionCodeValue === 'QNRRESP';
    if (!isResponseSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const resp of acts) {
      const id = extractId(resp.id || resp['cda:id']);
      const statusCode = resp.statusCode || resp['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const text = extractText(resp.text || resp['cda:text']);
      const effectiveTime = resp.effectiveTime || resp['cda:effectiveTime'];
      const authored = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !text) continue;

      responses.push({
        id: id || `QNRRESP-${responses.length + 1}`,
        identifier: id,
        status: status || 'completed',
        subject: patientId,
        encounter: encounterId,
        authored: authored,
        item: text ? [{ linkId: 'q1', text: 'Response', answer: [text] }] : undefined
      });
    }
  });

  return responses;
}

function extractCodeSystems(
  clinicalDocument: any
): CanonicalCodeSystem[] {
  const codeSystems: CanonicalCodeSystem[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isCodeSystemSection = sectionCodeValue === 'CODESYS';
    if (!isCodeSystemSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const cs of acts) {
      const id = extractId(cs.id || cs['cda:id']);
      const statusCode = cs.statusCode || cs['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = cs.code || cs['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(cs.text || cs['cda:text']);
      const effectiveTime = cs.effectiveTime || cs['cda:effectiveTime'];
      const date = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !codeValue && !text) continue;

      codeSystems.push({
        id: id || `CODESYS-${codeSystems.length + 1}`,
        identifier: id,
        url: codeSystem,
        status: status || 'active',
        title: displayName,
        description: text,
        date: date,
        concept: codeValue || displayName ? [{
          code: codeValue,
          display: displayName,
          definition: text
        }] : undefined
      });
    }
  });

  return codeSystems;
}

function extractValueSets(
  clinicalDocument: any
): CanonicalValueSet[] {
  const valueSets: CanonicalValueSet[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isValueSetSection = sectionCodeValue === 'VALUESET';
    if (!isValueSetSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const vs of acts) {
      const id = extractId(vs.id || vs['cda:id']);
      const statusCode = vs.statusCode || vs['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = vs.code || vs['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(vs.text || vs['cda:text']);
      const effectiveTime = vs.effectiveTime || vs['cda:effectiveTime'];
      const date = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !codeValue && !text) continue;

      valueSets.push({
        id: id || `VALUESET-${valueSets.length + 1}`,
        identifier: id,
        status: status || 'active',
        title: displayName,
        description: text,
        date: date,
        compose: codeSystem || codeValue || displayName ? {
          include: [{
            system: codeSystem,
            concept: codeValue || displayName ? [{
              code: codeValue,
              display: displayName
            }] : undefined
          }]
        } : undefined
      });
    }
  });

  return valueSets;
}

function extractConceptMaps(
  clinicalDocument: any
): CanonicalConceptMap[] {
  const conceptMaps: CanonicalConceptMap[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isConceptMapSection = sectionCodeValue === 'CONCEPTMAP';
    if (!isConceptMapSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const cm of acts) {
      const id = extractId(cm.id || cm['cda:id']);
      const statusCode = cm.statusCode || cm['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = cm.code || cm['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(cm.text || cm['cda:text']);
      const effectiveTime = cm.effectiveTime || cm['cda:effectiveTime'];
      const date = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !codeValue && !text) continue;

      conceptMaps.push({
        id: id || `CONCEPTMAP-${conceptMaps.length + 1}`,
        identifier: id,
        status: status || 'active',
        title: displayName,
        description: text,
        date: date,
        group: codeSystem || codeValue || displayName ? [{
          source: codeSystem,
          element: [{
            code: codeValue,
            display: displayName,
            target: displayName ? [{
              code: codeValue,
              display: displayName,
              relationship: 'equivalent'
            }] : undefined
          }]
        }] : undefined
      });
    }
  });

  return conceptMaps;
}

function extractNamingSystems(
  clinicalDocument: any
): CanonicalNamingSystem[] {
  const namingSystems: CanonicalNamingSystem[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isNamingSystemSection = sectionCodeValue === 'NAMESYS';
    if (!isNamingSystemSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const ns of acts) {
      const id = extractId(ns.id || ns['cda:id']);
      const statusCode = ns.statusCode || ns['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = ns.code || ns['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(ns.text || ns['cda:text']);
      const effectiveTime = ns.effectiveTime || ns['cda:effectiveTime'];
      const date = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !codeValue && !text) continue;

      namingSystems.push({
        id: id || `NAMESYS-${namingSystems.length + 1}`,
        identifier: id,
        status: status || 'active',
        name: displayName,
        description: text,
        date: date,
        kind: codeSystem,
        uniqueId: displayName ? [{
          type: 'uri',
          value: displayName,
          preferred: true
        }] : undefined
      });
    }
  });

  return namingSystems;
}

function extractTerminologyCapabilities(
  clinicalDocument: any
): CanonicalTerminologyCapabilities[] {
  const terminologyCapabilities: CanonicalTerminologyCapabilities[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isTerminologyCapabilitiesSection = sectionCodeValue === 'TERMCAP';
    if (!isTerminologyCapabilitiesSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const tc of acts) {
      const id = extractId(tc.id || tc['cda:id']);
      const statusCode = tc.statusCode || tc['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = tc.code || tc['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const kind = extractAttribute(code, '@_codeSystem');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(tc.text || tc['cda:text']);
      const effectiveTime = tc.effectiveTime || tc['cda:effectiveTime'];
      const date = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !codeValue && !text) continue;

      terminologyCapabilities.push({
        id: id || `TERMCAP-${terminologyCapabilities.length + 1}`,
        identifier: id,
        status: status || 'active',
        name: displayName,
        description: text,
        date: date,
        kind: kind,
        codeSearch: codeValue
      });
    }
  });

  return terminologyCapabilities;
}

function extractProvenances(
  clinicalDocument: any
): CanonicalProvenance[] {
  const provenances: CanonicalProvenance[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isProvenanceSection = sectionCodeValue === 'PROVENANCE';
    if (!isProvenanceSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const prov of acts) {
      const id = extractId(prov.id || prov['cda:id']);
      const code = prov.code || prov['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(prov.text || prov['cda:text']);
      const effectiveTime = prov.effectiveTime || prov['cda:effectiveTime'];
      const recorded = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !text) continue;

      provenances.push({
        id: id || `PROV-${provenances.length + 1}`,
        recorded: recorded,
        activity: displayName || text,
        agent: text ? [{ who: text, role: 'source' }] : undefined
      });
    }
  });

  return provenances;
}

function extractAuditEvents(
  clinicalDocument: any
): CanonicalAuditEvent[] {
  const auditEvents: CanonicalAuditEvent[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isAuditSection = sectionCodeValue === 'AUDITEVENT';
    if (!isAuditSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const audit of acts) {
      const id = extractId(audit.id || audit['cda:id']);
      const statusCode = audit.statusCode || audit['cda:statusCode'];
      const action = extractAttribute(statusCode, '@_code');
      const code = audit.code || audit['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(audit.text || audit['cda:text']);
      const effectiveTime = audit.effectiveTime || audit['cda:effectiveTime'];
      const recorded = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !codeValue && !text) continue;

      auditEvents.push({
        id: id || `AUDIT-${auditEvents.length + 1}`,
        code: displayName,
        severity: codeValue,
        action: action,
        recorded: recorded,
        agent: text ? [{ who: text, role: 'actor' }] : undefined
      });
    }
  });

  return auditEvents;
}

function extractConsents(
  clinicalDocument: any
): CanonicalConsent[] {
  const consents: CanonicalConsent[] = [];

  iterateSectionEntries(clinicalDocument, (entry, section) => {
    const sectionCode = section?.code || section?.['cda:code'];
    const sectionCodeValue = extractAttribute(sectionCode, '@_code');
    const isConsentSection = sectionCodeValue === 'CONSENT';
    if (!isConsentSection) return;

    const act = entry.act || entry['cda:act'];
    if (!act) return;
    const acts = Array.isArray(act) ? act : [act];

    for (const consent of acts) {
      const id = extractId(consent.id || consent['cda:id']);
      const statusCode = consent.statusCode || consent['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = consent.code || consent['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const text = extractText(consent.text || consent['cda:text']);
      const effectiveTime = consent.effectiveTime || consent['cda:effectiveTime'];
      const date = formatCDADateTime(extractAttribute(effectiveTime, '@_value') || extractAttribute(effectiveTime?.low, '@_value'));

      if (!id && !displayName && !text) continue;

      consents.push({
        id: id || `CONSENT-${consents.length + 1}`,
        status: status || 'active',
        category: displayName,
        date: date,
        decision: codeValue
      });
    }
  });

  return consents;
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
      const rawDisplay = valueDisplay || displayName;
      const finalDisplay = normalizeSnomedDisplay(finalSystem, finalCode, rawDisplay);

      if (!finalCode && !finalDisplay) continue;

      conditions.push({
        id: `COND-${finalCode || conditions.length + 1}`,
        identifier: finalCode,
        clinicalStatus: {
          system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
          code: 'active',
          display: 'Active'
        },
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

function normalizeSnomedDisplay(system?: string, code?: string, display?: string) {
  if (!system || !code) return display;
  const isSnomed = system === '2.16.840.1.113883.6.96' || system === 'http://snomed.info/sct';
  if (!isSnomed) return display;
  if (code === '44054006') return 'Diabetes mellitus type II';
  return display;
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
      const normalizedStart = start || end;
      const normalizedEnd = end || start;

      if (!id && !normalizedStart && !normalizedEnd && !displayName) continue;

      appointments.push({
        id: id || `APPT-${appointments.length + 1}`,
        identifier: id,
        status: status || 'proposed',
        description: displayName,
        start: normalizedStart,
        end: normalizedEnd,
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
      const normalizedStart = start || end;
      const normalizedEnd = end || start;

      if (!scheduleId && !normalizedStart && !normalizedEnd) continue;

      slots.push({
        id: scheduleId ? `SLOT-${scheduleId}` : `SLOT-${slots.length + 1}`,
        identifier: scheduleId,
        schedule: scheduleId,
        status: 'free',
        start: normalizedStart,
        end: normalizedEnd,
        comment: patientId ? `Patient ${patientId}` : undefined
      });
    }
  });

  return slots;
}

// Placeholder extractors for newly added resource types (no CDA mapping yet)
function extractEntryNodes(entry: any, tag: string): any[] {
  if (!entry || typeof entry !== 'object') return [];
  const node = entry[tag] || entry[`cda:${tag}`];
  if (!node) return [];
  return Array.isArray(node) ? node : [node];
}

function extractAppointmentResponses(clinicalDocument: any, patientId?: string): CanonicalAppointmentResponse[] {
  const responses: CanonicalAppointmentResponse[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'appointmentResponse');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime?.low, '@_value') || extractAttribute(effectiveTime, '@_value'));
      const end = formatCDADateTime(extractAttribute(effectiveTime?.high, '@_value'));
      const normalizedStart = start || end;
      const normalizedEnd = end || start;

      if (!id && !displayName && !normalizedStart && !normalizedEnd) continue;

      responses.push({
        id: id || `APPTRESP-${responses.length + 1}`,
        identifier: id,
        appointment: id,
        participantStatus: status || 'accepted',
        start: normalizedStart,
        end: normalizedEnd,
        actor: patientId,
        comment: displayName
      });
    }
  });

  return responses;
}

function extractClaims(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalClaim[] {
  const claims: CanonicalClaim[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'claim');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const created = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !codeValue && !displayName && !created) continue;

      claims.push({
        id: id || `CLAIM-${claims.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'active',
        type: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        patient: patientId,
        encounter: encounterId ? [encounterId] : undefined,
        created
      });
    }
  });

  return claims;
}

function extractClaimResponses(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalClaimResponse[] {
  const responses: CanonicalClaimResponse[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'claimResponse');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const created = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !codeValue && !displayName && !created) continue;

      responses.push({
        id: id || `CLMRESP-${responses.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'active',
        type: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        patient: patientId,
        created
      });
    }
  });

  return responses;
}

function extractCompositions(clinicalDocument: any, patientId?: string): CanonicalComposition[] {
  const compositions: CanonicalComposition[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'composition');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const date = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !displayName && !date) continue;

      compositions.push({
        id: id || `COMP-${compositions.length + 1}`,
        status: status || 'final',
        type: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        subject: patientId ? [patientId] : undefined,
        date,
        title: displayName
      });
    }
  });

  return compositions;
}

function extractExplanationOfBenefits(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalExplanationOfBenefit[] {
  const benefits: CanonicalExplanationOfBenefit[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'explanationOfBenefit');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const created = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !codeValue && !displayName && !created) continue;

      benefits.push({
        id: id || `EOB-${benefits.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'active',
        type: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        patient: patientId,
        encounter: encounterId ? [encounterId] : undefined,
        created
      });
    }
  });

  return benefits;
}

function extractCoverages(clinicalDocument: any, patientId?: string): CanonicalCoverage[] {
  const coverages: CanonicalCoverage[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'coverage');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime?.low, '@_value') || extractAttribute(effectiveTime, '@_value'));
      const end = formatCDADateTime(extractAttribute(effectiveTime?.high, '@_value'));

      if (!id && !codeValue && !displayName && !start && !end) continue;

      coverages.push({
        id: id || `COV-${coverages.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'active',
        type: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        beneficiary: patientId,
        period: start || end ? { start, end } : undefined
      });
    }
  });

  return coverages;
}

function extractDeviceDispenses(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalDeviceDispense[] {
  const dispenses: CanonicalDeviceDispense[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'deviceDispense');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const preparedDate = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !codeValue && !displayName && !preparedDate) continue;

      dispenses.push({
        id: id || `DEV-DISP-${dispenses.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'completed',
        deviceCodeableConcept: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        subject: patientId,
        encounter: encounterId,
        preparedDate
      });
    }
  });

  return dispenses;
}

function extractDeviceRequests(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalDeviceRequest[] {
  const requests: CanonicalDeviceRequest[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'deviceRequest');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const authoredOn = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !codeValue && !displayName && !authoredOn) continue;

      requests.push({
        id: id || `DEV-REQ-${requests.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'active',
        intent: 'order',
        codeCodeableConcept: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        subject: patientId,
        encounter: encounterId,
        authoredOn
      });
    }
  });

  return requests;
}

function extractDeviceUsages(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalDeviceUsage[] {
  const usages: CanonicalDeviceUsage[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'deviceUsage');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const timing = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !codeValue && !displayName && !timing) continue;

      usages.push({
        id: id || `DEV-USE-${usages.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'active',
        deviceCodeableConcept: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        patient: patientId,
        context: encounterId,
        timingDateTime: timing
      });
    }
  });

  return usages;
}

function extractEncounterHistories(clinicalDocument: any, patientId?: string): CanonicalEncounterHistory[] {
  const histories: CanonicalEncounterHistory[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'encounterHistory');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime?.low, '@_value') || extractAttribute(effectiveTime, '@_value'));
      const end = formatCDADateTime(extractAttribute(effectiveTime?.high, '@_value'));

      if (!id && !codeValue && !displayName && !start && !end) continue;

      histories.push({
        id: id || `ENC-HIST-${histories.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'completed',
        class: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        subject: patientId,
        actualPeriod: start || end ? { start, end } : undefined
      });
    }
  });

  return histories;
}

function extractFlags(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalFlag[] {
  const flags: CanonicalFlag[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'flag');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime?.low, '@_value') || extractAttribute(effectiveTime, '@_value'));
      const end = formatCDADateTime(extractAttribute(effectiveTime?.high, '@_value'));

      if (!id && !codeValue && !displayName && !start && !end) continue;

      flags.push({
        id: id || `FLAG-${flags.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'active',
        code: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        subject: patientId,
        encounter: encounterId,
        period: start || end ? { start, end } : undefined
      });
    }
  });

  return flags;
}

function extractLists(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalList[] {
  const lists: CanonicalList[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'list');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const title = extractText(node.title || node['cda:title']) || displayName;
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const date = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !title && !codeValue && !date) continue;

      lists.push({
        id: id || `LIST-${lists.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'current',
        title,
        code: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        subject: patientId ? [patientId] : undefined,
        encounter: encounterId,
        date
      });
    }
  });

  return lists;
}

function extractNutritionIntakes(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalNutritionIntake[] {
  const intakes: CanonicalNutritionIntake[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'nutritionIntake');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const occurrence = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !codeValue && !displayName && !occurrence) continue;

      intakes.push({
        id: id || `NINT-${intakes.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'completed',
        code: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        subject: patientId,
        encounter: encounterId,
        occurrenceDateTime: occurrence
      });
    }
  });

  return intakes;
}

function extractNutritionOrders(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalNutritionOrder[] {
  const orders: CanonicalNutritionOrder[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'nutritionOrder');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const dateTime = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !codeValue && !displayName && !dateTime) continue;

      orders.push({
        id: id || `NORD-${orders.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'active',
        intent: 'order',
        subject: patientId,
        encounter: encounterId,
        dateTime,
        note: displayName ? [displayName] : undefined
      });
    }
  });

  return orders;
}

function extractRiskAssessments(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalRiskAssessment[] {
  const risks: CanonicalRiskAssessment[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'riskAssessment');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const occurrence = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !codeValue && !displayName && !occurrence) continue;

      risks.push({
        id: id || `RISK-${risks.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'final',
        code: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        subject: patientId,
        encounter: encounterId,
        occurrenceDateTime: occurrence
      });
    }
  });

  return risks;
}

function extractBinaries(clinicalDocument: any, cdaXml: string): CanonicalBinary[] {
  const documentId = extractId(clinicalDocument?.id || clinicalDocument?.['cda:id']);
  if (!cdaXml) return [];
  return [{
    id: documentId || `BIN-${Date.now()}`,
    contentType: 'application/xml',
    data: Buffer.from(cdaXml).toString('base64')
  }];
}

function extractAccounts(clinicalDocument: any, patientId?: string): CanonicalAccount[] {
  const accounts: CanonicalAccount[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'account');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const start = formatCDADateTime(extractAttribute(effectiveTime?.low, '@_value') || extractAttribute(effectiveTime, '@_value'));
      const end = formatCDADateTime(extractAttribute(effectiveTime?.high, '@_value'));

      if (!id && !displayName && !start && !end) continue;

      accounts.push({
        id: id || `ACC-${accounts.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'active',
        name: displayName,
        subject: patientId ? [patientId] : undefined,
        servicePeriod: start || end ? { start, end } : undefined
      });
    }
  });

  return accounts;
}

function extractChargeItems(clinicalDocument: any, patientId?: string, encounterId?: string): CanonicalChargeItem[] {
  const items: CanonicalChargeItem[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'chargeItem');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const occurrence = formatCDADateTime(extractAttribute(effectiveTime?.low, '@_value') || extractAttribute(effectiveTime, '@_value'));

      if (!id && !codeValue && !displayName && !occurrence) continue;

      items.push({
        id: id || `CHG-${items.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'planned',
        code: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        subject: patientId,
        encounter: encounterId,
        occurrenceDateTime: occurrence
      });
    }
  });

  return items;
}

function extractChargeItemDefinitions(clinicalDocument: any): CanonicalChargeItemDefinition[] {
  const definitions: CanonicalChargeItemDefinition[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'chargeItemDefinition');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');
      const effectiveTime = node.effectiveTime || node['cda:effectiveTime'];
      const date = formatCDADateTime(extractAttribute(effectiveTime, '@_value'));

      if (!id && !codeValue && !displayName && !date) continue;

      definitions.push({
        id: id || `CHGDEF-${definitions.length + 1}`,
        status: status || 'active',
        date,
        title: displayName,
        code: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined
      });
    }
  });

  return definitions;
}

function extractDevices(clinicalDocument: any, patientId?: string): CanonicalDevice[] {
  const devices: CanonicalDevice[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'device');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeValue = extractAttribute(code, '@_code');
      const codeSystem = extractAttribute(code, '@_codeSystem');

      if (!id && !displayName && !codeValue) continue;

      devices.push({
        id: id || `DEV-${devices.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'active',
        type: codeValue || displayName ? [{
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        }] : undefined,
        name: displayName ? [{ value: displayName, type: 'user-friendly-name' }] : undefined
      });
    }
  });

  return devices;
}

function extractDeviceMetrics(clinicalDocument: any, patientId?: string): CanonicalDeviceMetric[] {
  const metrics: CanonicalDeviceMetric[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'deviceMetric');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const codeValue = extractAttribute(code, '@_code');
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const codeSystem = extractAttribute(code, '@_codeSystem');

      if (!id && !codeValue && !displayName) continue;

      metrics.push({
        id: id || `METRIC-${metrics.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        type: codeValue || displayName ? {
          system: mapCodeSystem(codeSystem),
          code: codeValue,
          display: displayName
        } : undefined,
        operationalStatus: status || undefined,
        category: 'measurement'
      });
    }
  });

  return metrics;
}

function extractEndpoints(clinicalDocument: any): CanonicalEndpoint[] {
  const endpoints: CanonicalEndpoint[] = [];

  iterateSectionEntries(clinicalDocument, (entry) => {
    const nodes = extractEntryNodes(entry, 'endpoint');
    for (const node of nodes) {
      const id = extractId(node.id || node['cda:id']);
      const statusCode = node.statusCode || node['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code');
      const code = node.code || node['cda:code'];
      const displayName = extractAttribute(code, '@_displayName') || extractText(code?.displayName);
      const telecom = node.telecom || node['cda:telecom'];
      const address = extractAttribute(telecom, '@_value') || extractText(node.address || node['cda:address']);

      if (!id && !displayName && !address) continue;

      endpoints.push({
        id: id || `ENDPT-${endpoints.length + 1}`,
        identifier: id ? [{ value: id }] : undefined,
        status: status || 'active',
        name: displayName,
        address
      });
    }
  });

  return endpoints;
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
    const sectionCodeSystem = extractAttribute(sectionCode, '@_codeSystem');
    const sectionDisplayName = extractAttribute(sectionCode, '@_displayName') || extractText(sectionCode?.displayName);
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
      const isLoincCode = (value?: string) => Boolean(value && /^\d{1,7}-\d$/.test(value));

      const statusCode = block.statusCode || block['cda:statusCode'];
      const status = extractAttribute(statusCode, '@_code') || 'final';

      const effectiveTime = block.effectiveTime || block['cda:effectiveTime'];
      const effectiveValue = extractAttribute(effectiveTime, '@_value') ||
        extractAttribute(effectiveTime?.low, '@_value');

      if (!codeValue && !displayName && !sectionCodeValue && !sectionDisplayName) continue;

      let finalCodeValue = codeValue;
      let finalSystem = codeSystem ? mapCodeSystem(codeSystem) : undefined;
      let finalDisplayName = displayName;

      if (finalSystem === 'http://loinc.org' && finalCodeValue && !isLoincCode(finalCodeValue)) {
        if (isLoincCode(sectionCodeValue)) {
          finalCodeValue = sectionCodeValue;
          finalSystem = sectionCodeSystem ? mapCodeSystem(sectionCodeSystem) : 'http://loinc.org';
          if (!finalDisplayName) finalDisplayName = sectionDisplayName;
        } else {
          finalSystem = undefined;
        }
      }

      reports.push({
        id: `DR-${codeValue || reports.length + 1}`,
        identifier: codeValue,
        status: status,
        code: {
          coding: finalCodeValue ? [{
            system: finalSystem,
            code: finalCodeValue,
            display: finalDisplayName
          }] : undefined,
          text: finalDisplayName || displayName || sectionDisplayName
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
    const isImagingSection = sectionCodeValue === '18748-4';
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
