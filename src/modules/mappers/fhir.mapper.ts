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
import { mapProcedures } from './procedure.mapper.js';
import { mapConditions } from './condition.mapper.js';
import { mapAppointments } from './appointment.mapper.js';
import { mapSchedules } from './schedule.mapper.js';
import { mapSlots } from './slot.mapper.js';
import { mapDiagnosticReports } from './diagnosticReport.mapper.js';
import { mapRelatedPersons } from './relatedPerson.mapper.js';
import { mapLocations } from './location.mapper.js';
import { mapEpisodesOfCare } from './episodeOfCare.mapper.js';
import { mapSpecimens } from './specimen.mapper.js';
import { mapDocumentReferences } from './documentReference.mapper.js';

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
