import type { CanonicalModel } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { cleanResource } from './utils.js';
import { mapPatient } from './patient.mapper.js';
import { mapEncounter } from './encounter.mapper.js';
import { mapObservations } from './observation.mapper.js';
import { mapPractitioners } from './practitioner.mapper.js';
import { mapPractitionerRoles } from './practitionerRole.mapper.js';
import { mapOrganizations } from './organization.mapper.js';
import { mapMedicationRequests } from './medicationRequest.mapper.js';
import { mapMedications } from './medication.mapper.js';
import { mapMedicationStatements } from './medicationStatement.mapper.js';
import { mapMedicationAdministrations } from './medicationAdministration.mapper.js';
import { mapMedicationDispenses } from './medicationDispense.mapper.js';
import { mapOrganizationAffiliations } from './organizationAffiliation.mapper.js';
import { mapPersons } from './person.mapper.js';
import { mapDeviceDispenses } from './deviceDispense.mapper.js';
import { mapDeviceRequests } from './deviceRequest.mapper.js';
import { mapDeviceUsages } from './deviceUsage.mapper.js';
import { mapEncounterHistories } from './encounterHistory.mapper.js';
import { mapFlags } from './flag.mapper.js';
import { mapLists } from './list.mapper.js';
import { mapNutritionIntakes } from './nutritionIntake.mapper.js';
import { mapNutritionOrders } from './nutritionOrder.mapper.js';
import { mapRiskAssessments } from './riskAssessment.mapper.js';
import { mapCapabilityStatements } from './capabilityStatement.mapper.js';
import { mapOperationOutcomes } from './operationOutcome.mapper.js';
import { mapParameters } from './parameters.mapper.js';
import { mapCarePlans } from './carePlan.mapper.js';
import { mapCareTeams } from './careTeam.mapper.js';
import { mapGoals } from './goal.mapper.js';
import { mapServiceRequests } from './serviceRequest.mapper.js';
import { mapTasks } from './task.mapper.js';
import { mapCommunications } from './communication.mapper.js';
import { mapCommunicationRequests } from './communicationRequest.mapper.js';
import { mapQuestionnaires } from './questionnaire.mapper.js';
import { mapQuestionnaireResponses } from './questionnaireResponse.mapper.js';
import { mapCodeSystems } from './codeSystem.mapper.js';
import { mapValueSets } from './valueSet.mapper.js';
import { mapConceptMaps } from './conceptMap.mapper.js';
import { mapNamingSystems } from './namingSystem.mapper.js';
import { mapTerminologyCapabilities } from './terminologyCapabilities.mapper.js';
import { mapProvenances } from './provenance.mapper.js';
import { mapAuditEvents } from './auditEvent.mapper.js';
import { mapConsents } from './consent.mapper.js';
import { mapProcedures } from './procedure.mapper.js';
import { mapConditions } from './condition.mapper.js';
import { mapAppointments } from './appointment.mapper.js';
import { mapAppointmentResponses } from './appointmentResponse.mapper.js';
import { mapClaims } from './claim.mapper.js';
import { mapClaimResponses } from './claimResponse.mapper.js';
import { mapExplanationOfBenefits } from './explanationOfBenefit.mapper.js';
import { mapCompositions } from './composition.mapper.js';
import { mapCoverages } from './coverage.mapper.js';
import { mapAccounts } from './account.mapper.js';
import { mapChargeItems } from './chargeItem.mapper.js';
import { mapChargeItemDefinitions } from './chargeItemDefinition.mapper.js';
import { mapDevices } from './device.mapper.js';
import { mapDeviceMetrics } from './deviceMetric.mapper.js';
import { mapEndpoints } from './endpoint.mapper.js';
import { mapSchedules } from './schedule.mapper.js';
import { mapSlots } from './slot.mapper.js';
import { mapDiagnosticReports } from './diagnosticReport.mapper.js';
import { mapRelatedPersons } from './relatedPerson.mapper.js';
import { mapLocations } from './location.mapper.js';
import { mapEpisodesOfCare } from './episodeOfCare.mapper.js';
import { mapSpecimens } from './specimen.mapper.js';
import { mapImagingStudies } from './imagingStudy.mapper.js';
import { mapAllergyIntolerances } from './allergyIntolerance.mapper.js';
import { mapImmunizations } from './immunization.mapper.js';
import { mapDocumentReferences } from './documentReference.mapper.js';
import { mapBinaries } from './binary.mapper.js';

export type FhirVersion = 'r5' | 'r6';

export function mapCanonicalToFHIRR5(canonical: CanonicalModel) {
  const operation = canonical.operation;
  const bundleType = operation ? 'transaction' : 'collection';
  const bundle: any = {
    resourceType: 'Bundle',
    type: bundleType,
    meta: {
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
      versionId: '1'
    },
    timestamp: new Date().toISOString(),
    entry: []
  };

  const registry = new FullUrlRegistry();
  const resolveRef = (resourceType: string, idOrIdentifier?: string) => {
    if (!idOrIdentifier) return undefined;
    // Try direct lookup
    let resolved = registry.resolve(resourceType, idOrIdentifier);
    if (resolved) return resolved;

    // Try stripping resource type prefix (e.g. "Patient/123" -> "123")
    const prefix = `${resourceType}/`;
    if (idOrIdentifier.startsWith(prefix)) {
      const id = idOrIdentifier.slice(prefix.length);
      resolved = registry.resolve(resourceType, id);
    }
    return resolved;
  };

  const patientResult = canonical.patient
    ? mapPatient({ patient: canonical.patient, operation, registry })
    : undefined;
  const patientFullUrl = patientResult?.patientFullUrl;
  if (patientResult?.entry) {
    bundle.entry.push(patientResult.entry);
  }

  const practitionerEntries = mapPractitioners({ practitioners: canonical.practitioners, operation, registry });
  if (practitionerEntries.length > 0) {
    bundle.entry.push(...practitionerEntries);
  }

  const organizationEntries = mapOrganizations({
    organizations: canonical.organizations,
    operation,
    registry,
    resolveRef
  });
  if (organizationEntries.length > 0) {
    bundle.entry.push(...organizationEntries);
  }

  const practitionerRoleEntries = mapPractitionerRoles({
    practitionerRoles: canonical.practitionerRoles,
    operation,
    registry,
    resolveRef
  });
  if (practitionerRoleEntries.length > 0) {
    bundle.entry.push(...practitionerRoleEntries);
  }

  const encounterResult = mapEncounter({
    encounter: canonical.encounter,
    operation,
    registry,
    patientFullUrl,
    resolveRef
  });
  if (encounterResult.entries.length > 0) {
    bundle.entry.push(...encounterResult.entries);
  }
  const encounterFullUrl = encounterResult.encounterFullUrl;

  const observationEntries = mapObservations({
    observations: canonical.observations,
    registry,
    patientFullUrl,
    encounterFullUrl
  });
  if (observationEntries.length > 0) {
    bundle.entry.push(...observationEntries);
  }

  const medicationEntries = mapMedications({
    medications: canonical.medications,
    operation,
    registry,
    resolveRef
  });
  if (medicationEntries.length > 0) {
    bundle.entry.push(...medicationEntries);
  }

  const medicationRequestEntries = mapMedicationRequests({
    medicationRequests: canonical.medicationRequests,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (medicationRequestEntries.length > 0) {
    bundle.entry.push(...medicationRequestEntries);
  }

  const medicationStatementEntries = mapMedicationStatements({
    medicationStatements: canonical.medicationStatements,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (medicationStatementEntries.length > 0) {
    bundle.entry.push(...medicationStatementEntries);
  }

  const medicationAdministrationEntries = mapMedicationAdministrations({
    medicationAdministrations: canonical.medicationAdministrations,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (medicationAdministrationEntries.length > 0) {
    bundle.entry.push(...medicationAdministrationEntries);
  }

  const medicationDispenseEntries = mapMedicationDispenses({
    medicationDispenses: canonical.medicationDispenses,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (medicationDispenseEntries.length > 0) {
    bundle.entry.push(...medicationDispenseEntries);
  }

  const organizationAffiliationEntries = mapOrganizationAffiliations({
    organizationAffiliations: canonical.organizationAffiliations,
    operation,
    registry,
    resolveRef
  });
  if (organizationAffiliationEntries.length > 0) {
    bundle.entry.push(...organizationAffiliationEntries);
  }

  const personEntries = mapPersons({
    persons: canonical.persons,
    operation,
    registry,
    resolveRef
  });
  if (personEntries.length > 0) {
    bundle.entry.push(...personEntries);
  }

  const deviceDispenseEntries = mapDeviceDispenses({
    deviceDispenses: canonical.deviceDispenses,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (deviceDispenseEntries.length > 0) {
    bundle.entry.push(...deviceDispenseEntries);
  }

  const deviceRequestEntries = mapDeviceRequests({
    deviceRequests: canonical.deviceRequests,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (deviceRequestEntries.length > 0) {
    bundle.entry.push(...deviceRequestEntries);
  }

  const deviceUsageEntries = mapDeviceUsages({
    deviceUsages: canonical.deviceUsages,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (deviceUsageEntries.length > 0) {
    bundle.entry.push(...deviceUsageEntries);
  }

  const encounterHistoryEntries = mapEncounterHistories({
    encounterHistories: canonical.encounterHistories,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (encounterHistoryEntries.length > 0) {
    bundle.entry.push(...encounterHistoryEntries);
  }

  const flagEntries = mapFlags({
    flags: canonical.flags,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (flagEntries.length > 0) {
    bundle.entry.push(...flagEntries);
  }

  const listEntries = mapLists({
    lists: canonical.lists,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (listEntries.length > 0) {
    bundle.entry.push(...listEntries);
  }

  const nutritionIntakeEntries = mapNutritionIntakes({
    nutritionIntakes: canonical.nutritionIntakes,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (nutritionIntakeEntries.length > 0) {
    bundle.entry.push(...nutritionIntakeEntries);
  }

  const nutritionOrderEntries = mapNutritionOrders({
    nutritionOrders: canonical.nutritionOrders,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (nutritionOrderEntries.length > 0) {
    bundle.entry.push(...nutritionOrderEntries);
  }

  const riskAssessmentEntries = mapRiskAssessments({
    riskAssessments: canonical.riskAssessments,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (riskAssessmentEntries.length > 0) {
    bundle.entry.push(...riskAssessmentEntries);
  }

  const capabilityEntries = mapCapabilityStatements({
    capabilityStatements: canonical.capabilityStatements,
    operation,
    registry,
    resolveRef
  });
  if (capabilityEntries.length > 0) {
    bundle.entry.push(...capabilityEntries);
  }

  const operationOutcomeEntries = mapOperationOutcomes({
    operationOutcomes: canonical.operationOutcomes,
    operation,
    registry
  });
  if (operationOutcomeEntries.length > 0) {
    bundle.entry.push(...operationOutcomeEntries);
  }

  const parameterEntries = mapParameters({
    parameters: canonical.parameters,
    operation,
    registry
  });
  if (parameterEntries.length > 0) {
    bundle.entry.push(...parameterEntries);
  }

  const carePlanEntries = mapCarePlans({
    carePlans: canonical.carePlans,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (carePlanEntries.length > 0) {
    bundle.entry.push(...carePlanEntries);
  }

  const careTeamEntries = mapCareTeams({
    careTeams: canonical.careTeams,
    operation,
    registry,
    resolveRef,
    patientFullUrl
  });
  if (careTeamEntries.length > 0) {
    bundle.entry.push(...careTeamEntries);
  }

  const goalEntries = mapGoals({
    goals: canonical.goals,
    operation,
    registry,
    resolveRef,
    patientFullUrl
  });
  if (goalEntries.length > 0) {
    bundle.entry.push(...goalEntries);
  }

  const serviceRequestEntries = mapServiceRequests({
    serviceRequests: canonical.serviceRequests,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (serviceRequestEntries.length > 0) {
    bundle.entry.push(...serviceRequestEntries);
  }

  const taskEntries = mapTasks({
    tasks: canonical.tasks,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (taskEntries.length > 0) {
    bundle.entry.push(...taskEntries);
  }

  const communicationEntries = mapCommunications({
    communications: canonical.communications,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (communicationEntries.length > 0) {
    bundle.entry.push(...communicationEntries);
  }

  const communicationRequestEntries = mapCommunicationRequests({
    communicationRequests: canonical.communicationRequests,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (communicationRequestEntries.length > 0) {
    bundle.entry.push(...communicationRequestEntries);
  }

  const questionnaireEntries = mapQuestionnaires({
    questionnaires: canonical.questionnaires,
    operation,
    registry
  });
  if (questionnaireEntries.length > 0) {
    bundle.entry.push(...questionnaireEntries);
  }

  const questionnaireResponseEntries = mapQuestionnaireResponses({
    questionnaireResponses: canonical.questionnaireResponses,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (questionnaireResponseEntries.length > 0) {
    bundle.entry.push(...questionnaireResponseEntries);
  }

  const codeSystemEntries = mapCodeSystems({
    codeSystems: canonical.codeSystems,
    operation,
    registry
  });
  if (codeSystemEntries.length > 0) {
    bundle.entry.push(...codeSystemEntries);
  }

  const valueSetEntries = mapValueSets({
    valueSets: canonical.valueSets,
    operation,
    registry
  });
  if (valueSetEntries.length > 0) {
    bundle.entry.push(...valueSetEntries);
  }

  const conceptMapEntries = mapConceptMaps({
    conceptMaps: canonical.conceptMaps,
    operation,
    registry
  });
  if (conceptMapEntries.length > 0) {
    bundle.entry.push(...conceptMapEntries);
  }

  const namingSystemEntries = mapNamingSystems({
    namingSystems: canonical.namingSystems,
    operation,
    registry
  });
  if (namingSystemEntries.length > 0) {
    bundle.entry.push(...namingSystemEntries);
  }

  const terminologyCapabilitiesEntries = mapTerminologyCapabilities({
    terminologyCapabilities: canonical.terminologyCapabilities,
    operation,
    registry
  });
  if (terminologyCapabilitiesEntries.length > 0) {
    bundle.entry.push(...terminologyCapabilitiesEntries);
  }

  const provenanceEntries = mapProvenances({
    provenances: canonical.provenances,
    operation,
    registry,
    resolveRef
  });
  if (provenanceEntries.length > 0) {
    bundle.entry.push(...provenanceEntries);
  }

  const auditEventEntries = mapAuditEvents({
    auditEvents: canonical.auditEvents,
    operation,
    registry,
    resolveRef
  });
  if (auditEventEntries.length > 0) {
    bundle.entry.push(...auditEventEntries);
  }

  const consentEntries = mapConsents({
    consents: canonical.consents,
    operation,
    registry,
    resolveRef
  });
  if (consentEntries.length > 0) {
    bundle.entry.push(...consentEntries);
  }

  const procedureEntries = mapProcedures({
    procedures: canonical.procedures,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (procedureEntries.length > 0) {
    bundle.entry.push(...procedureEntries);
  }

  const conditionEntries = mapConditions({
    conditions: canonical.conditions,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (conditionEntries.length > 0) {
    bundle.entry.push(...conditionEntries);
  }

  const appointmentEntries = mapAppointments({
    appointments: canonical.appointments,
    operation,
    registry,
    resolveRef,
    patientFullUrl
  });
  if (appointmentEntries.length > 0) {
    bundle.entry.push(...appointmentEntries);
  }

  const appointmentResponseEntries = mapAppointmentResponses({
    appointmentResponses: canonical.appointmentResponses,
    operation,
    registry,
    resolveRef
  });
  if (appointmentResponseEntries.length > 0) {
    bundle.entry.push(...appointmentResponseEntries);
  }

  const claimEntries = mapClaims({
    claims: canonical.claims,
    operation,
    registry,
    resolveRef
  });
  if (claimEntries.length > 0) {
    bundle.entry.push(...claimEntries);
  }

  const claimResponseEntries = mapClaimResponses({
    claimResponses: canonical.claimResponses,
    operation,
    registry,
    resolveRef
  });
  if (claimResponseEntries.length > 0) {
    bundle.entry.push(...claimResponseEntries);
  }

  const explanationOfBenefitEntries = mapExplanationOfBenefits({
    explanationOfBenefits: canonical.explanationOfBenefits,
    operation,
    registry,
    resolveRef
  });
  if (explanationOfBenefitEntries.length > 0) {
    bundle.entry.push(...explanationOfBenefitEntries);
  }

  const compositionEntries = mapCompositions({
    compositions: canonical.compositions,
    operation,
    registry,
    resolveRef
  });
  if (compositionEntries.length > 0) {
    bundle.entry.push(...compositionEntries);
  }

  const coverageEntries = mapCoverages({
    coverages: canonical.coverages,
    operation,
    registry,
    resolveRef
  });
  if (coverageEntries.length > 0) {
    bundle.entry.push(...coverageEntries);
  }

  const accountEntries = mapAccounts({
    accounts: canonical.accounts,
    operation,
    registry,
    resolveRef
  });
  if (accountEntries.length > 0) {
    bundle.entry.push(...accountEntries);
  }

  const chargeItemEntries = mapChargeItems({
    chargeItems: canonical.chargeItems,
    operation,
    registry,
    resolveRef
  });
  if (chargeItemEntries.length > 0) {
    bundle.entry.push(...chargeItemEntries);
  }

  const chargeItemDefinitionEntries = mapChargeItemDefinitions({
    chargeItemDefinitions: canonical.chargeItemDefinitions,
    operation,
    registry
  });
  if (chargeItemDefinitionEntries.length > 0) {
    bundle.entry.push(...chargeItemDefinitionEntries);
  }

  const deviceEntries = mapDevices({
    devices: canonical.devices,
    operation,
    registry,
    resolveRef
  });
  if (deviceEntries.length > 0) {
    bundle.entry.push(...deviceEntries);
  }

  const deviceMetricEntries = mapDeviceMetrics({
    deviceMetrics: canonical.deviceMetrics,
    operation,
    registry,
    resolveRef
  });
  if (deviceMetricEntries.length > 0) {
    bundle.entry.push(...deviceMetricEntries);
  }

  const endpointEntries = mapEndpoints({
    endpoints: canonical.endpoints,
    operation,
    registry,
    resolveRef
  });
  if (endpointEntries.length > 0) {
    bundle.entry.push(...endpointEntries);
  }

  const scheduleEntries = mapSchedules({
    schedules: canonical.schedules,
    operation,
    registry,
    resolveRef,
    patientFullUrl
  });
  if (scheduleEntries.length > 0) {
    bundle.entry.push(...scheduleEntries);
  }

  const slotEntries = mapSlots({
    slots: canonical.slots,
    operation,
    registry,
    resolveRef
  });
  if (slotEntries.length > 0) {
    bundle.entry.push(...slotEntries);
  }

  const diagnosticReportEntries = mapDiagnosticReports({
    diagnosticReports: canonical.diagnosticReports,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (diagnosticReportEntries.length > 0) {
    bundle.entry.push(...diagnosticReportEntries);
  }

  const relatedPersonEntries = mapRelatedPersons({
    relatedPersons: canonical.relatedPersons,
    operation,
    registry,
    resolveRef,
    patientFullUrl
  });
  if (relatedPersonEntries.length > 0) {
    bundle.entry.push(...relatedPersonEntries);
  }

  const locationEntries = mapLocations({
    locations: canonical.locations,
    operation,
    registry,
    resolveRef
  });
  if (locationEntries.length > 0) {
    bundle.entry.push(...locationEntries);
  }

  const episodeEntries = mapEpisodesOfCare({
    episodesOfCare: canonical.episodesOfCare,
    operation,
    registry,
    resolveRef,
    patientFullUrl
  });
  if (episodeEntries.length > 0) {
    bundle.entry.push(...episodeEntries);
  }

  const specimenEntries = mapSpecimens({
    specimens: canonical.specimens,
    operation,
    registry,
    resolveRef,
    patientFullUrl
  });
  if (specimenEntries.length > 0) {
    bundle.entry.push(...specimenEntries);
  }

  const imagingEntries = mapImagingStudies({
    imagingStudies: canonical.imagingStudies,
    operation,
    registry,
    resolveRef,
    patientFullUrl
  });
  if (imagingEntries.length > 0) {
    bundle.entry.push(...imagingEntries);
  }

  const allergyEntries = mapAllergyIntolerances({
    allergyIntolerances: canonical.allergyIntolerances,
    operation,
    registry,
    resolveRef,
    patientFullUrl
  });
  if (allergyEntries.length > 0) {
    bundle.entry.push(...allergyEntries);
  }

  const immunizationEntries = mapImmunizations({
    immunizations: canonical.immunizations,
    operation,
    registry,
    resolveRef,
    patientFullUrl,
    encounterFullUrl
  });
  if (immunizationEntries.length > 0) {
    bundle.entry.push(...immunizationEntries);
  }

  const documentReferenceEntries = mapDocumentReferences({
    documentReferences: canonical.documentReferences,
    operation,
    registry,
    resolveRef,
    patientFullUrl
  });
  if (documentReferenceEntries.length > 0) {
    bundle.entry.push(...documentReferenceEntries);
  }

  const binaryEntries = mapBinaries({
    binaries: canonical.binaries,
    operation,
    registry,
    resolveRef
  });
  if (binaryEntries.length > 0) {
    bundle.entry.push(...binaryEntries);
  }

  const sourcePayloads = canonical.sourcePayloads;
  if (sourcePayloads && bundle.entry.length > 0) {
    bundle.entry.forEach((entry: any) => {
      const resource = entry?.resource;
      if (!resource?.resourceType) return;
      const identifierValue = resource.identifier?.[0]?.value || resource.id;
      if (!identifierValue) return;
      const key = `${resource.resourceType}:${identifierValue}`;
      const payload = sourcePayloads[key] ?? sourcePayloads[`${resource.resourceType}:*`];
      if (!payload) return;
      const extensionEntry = {
        url: 'urn:scanbo:source-payload',
        valueString: JSON.stringify(payload)
      };
      resource.extension = resource.extension?.length
        ? [...resource.extension, extensionEntry]
        : [extensionEntry];
    });
  }

  bundle.entry = (bundle.entry || [])
    .map((entry: any) => {
      if (!entry || !entry.resource) return null;
      const cleaned = cleanResource(entry.resource);
      if (!cleaned) return null;
      if (!cleaned.resourceType && entry.resource.resourceType) {
        cleaned.resourceType = entry.resource.resourceType;
      }
      entry.resource = cleaned;
      return entry;
    })
    .filter((entry: any) => {
      if (!entry) return false;
      const resource = entry.resource;
      if (!resource || !resource.resourceType) return false;
      const keys = Object.keys(resource).filter(key => key !== 'resourceType' && key !== 'id');
      return keys.length > 0;
    });

  return bundle;
}

export function mapCanonicalToFHIR(canonical: CanonicalModel, version: FhirVersion = 'r5') {
  if (version === 'r5') {
    return mapCanonicalToFHIRR5(canonical);
  }
  throw new Error(`FHIR version not supported yet: ${version}`);
}
