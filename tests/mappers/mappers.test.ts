import { describe, expect, it } from 'vitest';
import { FullUrlRegistry } from '../../src/modules/mappers/fullUrlRegistry.js';
import { mapPatient } from '../../src/modules/mappers/patient.mapper.js';
import { mapEncounter } from '../../src/modules/mappers/encounter.mapper.js';
import { mapObservations } from '../../src/modules/mappers/observation.mapper.js';
import { mapPractitioners } from '../../src/modules/mappers/practitioner.mapper.js';
import { mapPractitionerRoles } from '../../src/modules/mappers/practitionerRole.mapper.js';
import { mapOrganizations } from '../../src/modules/mappers/organization.mapper.js';
import { mapMedicationRequests } from '../../src/modules/mappers/medicationRequest.mapper.js';
import { mapMedications } from '../../src/modules/mappers/medication.mapper.js';
import { mapDocumentReferences } from '../../src/modules/mappers/documentReference.mapper.js';
import type {
  CanonicalDocumentReference,
  CanonicalEncounter,
  CanonicalMedication,
  CanonicalMedicationRequest,
  CanonicalObservation,
  CanonicalOrganization,
  CanonicalPatient,
  CanonicalPractitioner,
  CanonicalPractitionerRole
} from '../../src/shared/types/canonical.types.js';

const createResolveRef = (registry: FullUrlRegistry) => {
  return (resourceType: string, idOrIdentifier?: string) => {
    if (!idOrIdentifier) return undefined;
    return registry.resolve(resourceType, idOrIdentifier) || `${resourceType}/${idOrIdentifier}`;
  };
};

describe('patient mapper', () => {
  it('maps patient demographics and registers reference', () => {
    const registry = new FullUrlRegistry();
    const patient: CanonicalPatient = {
      id: 'MRN-1',
      identifier: 'MRN-1',
      name: { family: 'Doe', given: ['Jane'] },
      gender: 'female',
      birthDate: '1990-01-01'
    };

    const { entry, patientFullUrl } = mapPatient({ patient, operation: 'create', registry });

    expect(entry.resource.identifier[0].value).toBe('MRN-1');
    expect(entry.resource.gender).toBe('female');
    expect(entry.request?.url).toContain('Patient?identifier');
    expect(registry.resolve('Patient', 'MRN-1')).toBe(patientFullUrl);
  });
});

describe('encounter mapper', () => {
  it('maps encounter referencing patient', () => {
    const registry = new FullUrlRegistry();
    const patientFullUrl = 'urn:uuid:patient';
    registry.register('Patient', { identifier: 'MRN-1', id: 'patient' }, patientFullUrl);

    const encounter: CanonicalEncounter = {
      id: 'ENC-1',
      class: 'IMP'
    };

    const result = mapEncounter({
      encounter,
      operation: 'create',
      registry,
      patientFullUrl,
      resolveRef: (type, id) => registry.resolve(type, id)
    });

    expect(result.entries.length).toBe(1);
    const encounterEntry = result.entries[0];
    expect(encounterEntry.resource.subject.reference).toBe(patientFullUrl);
    expect(result.encounterFullUrl).toBeDefined();
  });
});

describe('observation mapper', () => {
  it('maps numeric observation with interpretation and references', () => {
    const registry = new FullUrlRegistry();
    const observations: CanonicalObservation[] = [{
      setId: '1',
      code: { system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' },
      value: 72,
      unit: '/min',
      abnormalFlags: ['H'],
      referenceRange: '60-100',
      date: '2024-01-01T00:00:00Z'
    }];

    const entries = mapObservations({
      observations,
      registry,
      patientFullUrl: 'urn:uuid:patient',
      encounterFullUrl: 'urn:uuid:encounter'
    });

    expect(entries.length).toBe(1);
    const resource = entries[0].resource;
    expect(resource.valueQuantity.value).toBe(72);
    expect(resource.referenceRange[0].text).toBe('60-100');
    expect(resource.interpretation[0].coding[0].code).toBe('H');
  });

  it('maps body temperature unit C to UCUM Cel code', () => {
    const registry = new FullUrlRegistry();
    const observations: CanonicalObservation[] = [{
      setId: 'temp-1',
      code: { system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' },
      value: 36.7,
      unit: 'C',
      date: '2024-01-01T00:00:00Z'
    }];

    const entries = mapObservations({
      observations,
      registry,
      patientFullUrl: 'urn:uuid:patient'
    });

    expect(entries.length).toBe(1);
    const resource = entries[0].resource;
    expect(resource.valueQuantity.value).toBe(36.7);
    expect(resource.valueQuantity.unit).toBe('C');
    expect(resource.valueQuantity.system).toBe('http://unitsofmeasure.org');
    expect(resource.valueQuantity.code).toBe('Cel');
  });

  it('maps blood pressure units to UCUM mm[Hg] for BP profile', () => {
    const registry = new FullUrlRegistry();
    const observations: CanonicalObservation[] = [
      {
        setId: 'bp-1',
        code: { system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' },
        value: 120,
        unit: 'mmHg',
        date: '2024-01-01T00:00:00Z'
      },
      {
        setId: 'bp-2',
        code: { system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' },
        value: 80,
        unit: 'mmHg',
        date: '2024-01-01T00:00:00Z'
      }
    ];

    const entries = mapObservations({
      observations,
      registry,
      patientFullUrl: 'urn:uuid:patient'
    });

    expect(entries.length).toBe(1);
    const resource = entries[0].resource;
    expect(resource.code.coding[0].code).toBe('85354-9');
    expect(resource.component[0].valueQuantity.code).toBe('mm[Hg]');
    expect(resource.component[1].valueQuantity.code).toBe('mm[Hg]');
  });
});

describe('practitioner mapper', () => {
  it('maps practitioner core fields and handles delete operation', () => {
    const registry = new FullUrlRegistry();
    const practitioners: CanonicalPractitioner[] = [{
      id: 'PRAC-1',
      identifier: 'PRAC-1',
      name: { family: 'Smith', given: ['Sam'] },
      active: true
    }];

    const entries = mapPractitioners({ practitioners, operation: 'delete', registry });
    expect(entries.length).toBe(1);
    expect(entries[0].resource.active).toBe(false);
    expect(entries[0].request?.url).toBe('Practitioner/PRAC-1');
  });
});

describe('practitioner role mapper', () => {
  it('links practitioner and organization references', () => {
    const registry = new FullUrlRegistry();
    const resolveRef = createResolveRef(registry);
    registry.register('Practitioner', { identifier: 'PRAC-1', id: 'PRAC-1' }, 'urn:uuid:prac');
    registry.register('Organization', { identifier: 'ORG-1', id: 'ORG-1' }, 'urn:uuid:org');

    const roles: CanonicalPractitionerRole[] = [{
      id: 'ROLE-1',
      practitionerId: 'PRAC-1',
      organizationId: 'ORG-1',
      code: [{ system: 'http://example.com', code: 'cardio', display: 'Cardiologist' }]
    }];

    const entries = mapPractitionerRoles({ practitionerRoles: roles, operation: 'create', registry, resolveRef });
    expect(entries.length).toBe(1);
    const resource = entries[0].resource;
    expect(resource.practitioner.reference).toBe('urn:uuid:prac');
    expect(resource.organization.reference).toBe('urn:uuid:org');
  });
});

describe('organization mapper', () => {
  it('maps organization and handles partOf references', () => {
    const registry = new FullUrlRegistry();
    const resolveRef = createResolveRef(registry);
    registry.register('Organization', { identifier: 'PARENT', id: 'PARENT' }, 'urn:uuid:parent');

    const organizations: CanonicalOrganization[] = [{
      id: 'ORG-1',
      identifier: 'ORG-1',
      name: 'Child Org',
      partOf: 'PARENT'
    }];

    const entries = mapOrganizations({ organizations, operation: 'create', registry, resolveRef });
    expect(entries.length).toBe(1);
    expect(entries[0].resource.partOf.reference).toBe('urn:uuid:parent');
  });
});

describe('medication mapper', () => {
  it('maps medication definitions', () => {
    const registry = new FullUrlRegistry();
    const resolveRef = createResolveRef(registry);
    registry.register('Organization', { identifier: 'MFR', id: 'MFR' }, 'urn:uuid:mfr');

    const medications: CanonicalMedication[] = [{
      id: 'MED-1',
      code: { text: 'Acetaminophen' },
      manufacturer: 'MFR'
    }];

    const entries = mapMedications({ medications, registry, resolveRef });
    expect(entries.length).toBe(1);
    expect(entries[0].resource.marketingAuthorizationHolder.reference).toBe('urn:uuid:mfr');
  });
});

describe('medication request mapper', () => {
  it('maps medication requests tying to patient and encounter', () => {
    const registry = new FullUrlRegistry();
    const resolveRef = createResolveRef(registry);
    registry.register('Medication', { identifier: 'MED-1', id: 'MED-1' }, 'urn:uuid:med');

    const medRequests: CanonicalMedicationRequest[] = [{
      id: 'MR-1',
      status: 'active',
      intent: 'order',
      subject: 'PATIENT-1',
      encounter: 'ENC-1',
      medicationReference: 'MED-1',
      authoredOn: '2024-01-01'
    }];

    const entries = mapMedicationRequests({
      medicationRequests: medRequests,
      registry,
      resolveRef,
      patientFullUrl: 'urn:uuid:patient',
      encounterFullUrl: 'urn:uuid:encounter'
    });

    expect(entries.length).toBe(1);
    const resource = entries[0].resource;
    expect(resource.subject.reference).toBe('Patient/PATIENT-1');
    expect(resource.medication.reference.reference).toBe('urn:uuid:med');
  });
});

describe('document reference mapper', () => {
  it('maps document references with context', () => {
    const registry = new FullUrlRegistry();
    const resolveRef = createResolveRef(registry);
    registry.register('Encounter', { identifier: 'ENC-1', id: 'ENC-1' }, 'urn:uuid:encounter');

    const documents: CanonicalDocumentReference[] = [{
      id: 'DOC-1',
      status: 'current',
      subject: 'PATIENT-1',
      description: 'Discharge summary',
      context: {
        encounter: ['ENC-1']
      }
    }];

    const entries = mapDocumentReferences({
      documentReferences: documents,
      registry,
      resolveRef,
      patientFullUrl: 'urn:uuid:patient'
    });

    expect(entries.length).toBe(1);
    const resource = entries[0].resource;
    expect(resource.subject.reference).toBe('Patient/PATIENT-1');
    expect(resource.context.encounter[0].reference).toBe('urn:uuid:encounter');
  });
});
