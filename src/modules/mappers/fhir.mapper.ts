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
    return registry.resolve(resourceType, idOrIdentifier) || `${resourceType}/${idOrIdentifier}`;
  };

  const patientResult = mapPatient({ patient: canonical.patient, operation, registry });
  const patientFullUrl = patientResult.patientFullUrl;
  bundle.entry.push(patientResult.entry);

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

  const medicationEntries = mapMedications({
    medications: canonical.medications,
    operation,
    registry,
    resolveRef
  });
  if (medicationEntries.length > 0) {
    bundle.entry.push(...medicationEntries);
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
