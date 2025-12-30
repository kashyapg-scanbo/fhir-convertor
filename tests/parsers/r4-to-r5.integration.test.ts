import { describe, expect, it } from 'vitest';
import { parseR4 } from '../../src/modules/parsers/r4.parser.js';
import { mapCanonicalToFHIR } from '../../src/modules/mappers/fhir.mapper.js';

const basePatient = {
  resourceType: 'Patient',
  id: 'PAT-1',
  identifier: [{ value: 'PAT-1' }],
  name: [{ family: 'Doe', given: ['Jane'] }],
  gender: 'female',
  birthDate: '1990-01-01'
};

function toR5Bundle(resources: any[]) {
  const r4Bundle = {
    resourceType: 'Bundle',
    entry: resources.map(resource => ({ resource }))
  };
  const canonical = parseR4(JSON.stringify(r4Bundle));
  return mapCanonicalToFHIR(canonical, 'r5');
}

function getEntry(bundle: any, resourceType: string, predicate?: (resource: any) => boolean) {
  return bundle.entry.find((entry: any) => {
    const resource = entry?.resource;
    if (!resource || resource.resourceType !== resourceType) return false;
    return predicate ? predicate(resource) : true;
  });
}

function getResource(bundle: any, resourceType: string, predicate?: (resource: any) => boolean) {
  return getEntry(bundle, resourceType, predicate)?.resource;
}

function getFullUrl(bundle: any, resourceType: string, predicate?: (resource: any) => boolean) {
  return getEntry(bundle, resourceType, predicate)?.fullUrl;
}

describe('R4 to R5 via canonical', () => {
  describe('Patient', () => {
    it('maps demographics into R5 patient', () => {
      const bundle = toR5Bundle([basePatient]);
      const patient = getResource(bundle, 'Patient');

      expect(patient.identifier[0].value).toBe('PAT-1');
      expect(patient.name[0].family).toBe('Doe');
      expect(patient.gender).toBe('female');
      expect(patient.birthDate).toBe('1990-01-01');
    });

    it('maps telecom, address, and active flag', () => {
      const r4Patient = {
        resourceType: 'Patient',
        id: 'PAT-2',
        identifier: [{ value: 'PAT-2' }],
        name: [{ family: 'Roe', given: ['Riley'] }],
        active: false,
        telecom: [{ system: 'phone', value: '555-0100', use: 'mobile' }],
        address: [{ line: ['1 Main St'], city: 'Austin', use: 'home' }]
      };

      const bundle = toR5Bundle([r4Patient]);
      const patient = getResource(bundle, 'Patient');

      expect(patient.active).toBe(false);
      expect(patient.telecom[0].use).toBe('mobile');
      expect(patient.address[0].use).toBe('home');
    });
  });

  describe('Encounter', () => {
    it('maps class, status, period, and service provider', () => {
      const organization = {
        resourceType: 'Organization',
        id: 'ORG-1',
        name: 'General Hospital'
      };
      const encounter = {
        resourceType: 'Encounter',
        id: 'ENC-1',
        status: 'finished',
        class: { code: 'IMP' },
        period: { start: '2024-01-01T10:00:00Z' },
        serviceProvider: { reference: 'Organization/ORG-1' }
      };

      const bundle = toR5Bundle([basePatient, organization, encounter]);
      const encounterResource = getResource(bundle, 'Encounter');
      const orgFullUrl = getFullUrl(bundle, 'Organization');

      expect(encounterResource.class[0].coding[0].code).toBe('IMP');
      expect(encounterResource.status).toBe('finished');
      expect(encounterResource.actualPeriod.start).toBe('2024-01-01T10:00:00Z');
      expect(encounterResource.serviceProvider.reference).toBe(orgFullUrl);
    });

    it('maps participants and location display', () => {
      const practitioner = {
        resourceType: 'Practitioner',
        id: 'PRAC-1',
        name: [{ family: 'Smith', given: ['Sam'] }]
      };
      const encounter = {
        resourceType: 'Encounter',
        id: 'ENC-2',
        status: 'in-progress',
        participant: [{ individual: { reference: 'Practitioner/PRAC-1' } }],
        location: [{ location: { display: 'Room 1' } }]
      };

      const bundle = toR5Bundle([basePatient, practitioner, encounter]);
      const encounterResource = getResource(bundle, 'Encounter');
      const practitionerFullUrl = getFullUrl(bundle, 'Practitioner');

      expect(encounterResource.participant[0].actor.reference).toBe(practitionerFullUrl);
      expect(encounterResource.location[0].location.display).toBe('Room 1');
    });
  });

  describe('Observation', () => {
    it('maps numeric observation values and subject reference', () => {
      const observation = {
        resourceType: 'Observation',
        id: 'OBS-1',
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }]
        },
        valueQuantity: { value: 72, unit: 'beats/min' },
        effectiveDateTime: '2024-01-02T00:00:00Z'
      };

      const bundle = toR5Bundle([basePatient, observation]);
      const observationResource = getResource(bundle, 'Observation');
      const patientFullUrl = getFullUrl(bundle, 'Patient');

      expect(observationResource.valueQuantity.value).toBe(72);
      expect(observationResource.code.coding[0].code).toBe('8867-4');
      expect(observationResource.subject.reference).toBe(patientFullUrl);
    });

    it('maps string observations to valueString', () => {
      const observation = {
        resourceType: 'Observation',
        id: 'OBS-2',
        status: 'final',
        code: {
          coding: [{ system: 'urn:hl7-org:local', code: 'LOCAL-1', display: 'Result' }]
        },
        valueString: 'positive'
      };

      const bundle = toR5Bundle([basePatient, observation]);
      const observationResource = getResource(bundle, 'Observation', resource => resource.valueString === 'positive');

      expect(observationResource.valueString).toBe('positive');
      expect(observationResource.status).toBe('final');
    });
  });

  describe('Practitioner', () => {
    it('maps basic demographics and telecom', () => {
      const practitioner = {
        resourceType: 'Practitioner',
        id: 'PRAC-2',
        name: [{ family: 'Nguyen', given: ['Ava'] }],
        telecom: [{ system: 'phone', value: '555-0101' }],
        active: true
      };

      const bundle = toR5Bundle([basePatient, practitioner]);
      const practitionerResource = getResource(bundle, 'Practitioner');

      expect(practitionerResource.name[0].family).toBe('Nguyen');
      expect(practitionerResource.telecom[0].system).toBe('phone');
      expect(practitionerResource.active).toBe(true);
    });

    it('maps practitioner qualifications', () => {
      const practitioner = {
        resourceType: 'Practitioner',
        id: 'PRAC-3',
        name: [{ family: 'Lee', given: ['Taylor'] }],
        qualification: [{
          code: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0360', code: 'MD', display: 'Doctor' }] }
        }]
      };

      const bundle = toR5Bundle([basePatient, practitioner]);
      const practitionerResource = getResource(bundle, 'Practitioner');

      expect(practitionerResource.qualification[0].code.coding[0].code).toBe('MD');
    });
  });

  describe('PractitionerRole', () => {
    it('resolves practitioner and organization references', () => {
      const practitioner = {
        resourceType: 'Practitioner',
        id: 'PRAC-4',
        name: [{ family: 'Patel', given: ['Mia'] }]
      };
      const organization = {
        resourceType: 'Organization',
        id: 'ORG-2',
        name: 'Clinic A'
      };
      const role = {
        resourceType: 'PractitionerRole',
        id: 'ROLE-1',
        practitioner: { reference: 'Practitioner/PRAC-4' },
        organization: { reference: 'Organization/ORG-2' }
      };

      const bundle = toR5Bundle([basePatient, practitioner, organization, role]);
      const roleResource = getResource(bundle, 'PractitionerRole');
      const practitionerFullUrl = getFullUrl(bundle, 'Practitioner');
      const organizationFullUrl = getFullUrl(bundle, 'Organization');

      expect(roleResource.practitioner.reference).toBe(practitionerFullUrl);
      expect(roleResource.organization.reference).toBe(organizationFullUrl);
    });

    it('maps role period', () => {
      const practitioner = {
        resourceType: 'Practitioner',
        id: 'PRAC-5',
        name: [{ family: 'Kim', given: ['Jordan'] }]
      };
      const role = {
        resourceType: 'PractitionerRole',
        id: 'ROLE-2',
        practitioner: { reference: 'Practitioner/PRAC-5' },
        period: { start: '2023-01-01', end: '2023-12-31' }
      };

      const bundle = toR5Bundle([basePatient, practitioner, role]);
      const roleResource = getResource(bundle, 'PractitionerRole');

      expect(roleResource.period.start).toBe('2023-01-01');
      expect(roleResource.period.end).toBe('2023-12-31');
    });
  });

  describe('Organization', () => {
    it('maps partOf references', () => {
      const parent = {
        resourceType: 'Organization',
        id: 'ORG-PARENT',
        name: 'Parent Org'
      };
      const child = {
        resourceType: 'Organization',
        id: 'ORG-CHILD',
        name: 'Child Org',
        partOf: { reference: 'Organization/ORG-PARENT' }
      };

      const bundle = toR5Bundle([basePatient, parent, child]);
      const childResource = getResource(bundle, 'Organization', resource => resource.name === 'Child Org');
      const parentFullUrl = getFullUrl(bundle, 'Organization', resource => resource.name === 'Parent Org');

      expect(childResource.partOf.reference).toBe(parentFullUrl);
    });

    it('maps telecom and address into contact', () => {
      const organization = {
        resourceType: 'Organization',
        id: 'ORG-3',
        name: 'Health Center',
        telecom: [{ system: 'phone', value: '555-0200' }],
        address: [{ city: 'Denver', state: 'CO' }]
      };

      const bundle = toR5Bundle([basePatient, organization]);
      const organizationResource = getResource(bundle, 'Organization');

      expect(organizationResource.contact[0].telecom[0].value).toBe('555-0200');
      expect(organizationResource.contact[0].address[0].city).toBe('Denver');
    });
  });

  describe('Medication', () => {
    it('maps medication code text', () => {
      const medication = {
        resourceType: 'Medication',
        id: 'MED-1',
        code: {
          text: 'Acetaminophen',
          coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '123', display: 'Acetaminophen' }]
        }
      };

      const bundle = toR5Bundle([basePatient, medication]);
      const medicationResource = getResource(bundle, 'Medication');

      expect(medicationResource.code.text).toBe('Acetaminophen');
    });

    it('maps manufacturer and total volume', () => {
      const organization = {
        resourceType: 'Organization',
        id: 'ORG-MFR',
        name: 'Pharma Inc'
      };
      const medication = {
        resourceType: 'Medication',
        id: 'MED-2',
        manufacturer: { reference: 'Organization/ORG-MFR' },
        amount: { numerator: { value: 500, unit: 'mg' } }
      };

      const bundle = toR5Bundle([basePatient, organization, medication]);
      const medicationResource = getResource(bundle, 'Medication');
      const organizationFullUrl = getFullUrl(bundle, 'Organization');

      expect(medicationResource.marketingAuthorizationHolder.reference).toBe(organizationFullUrl);
      expect(medicationResource.totalVolume.value).toBe(500);
    });
  });

  describe('MedicationRequest', () => {
    it('maps medication reference and subject', () => {
      const medication = {
        resourceType: 'Medication',
        id: 'MED-3',
        code: { text: 'Ibuprofen' }
      };
      const medicationRequest = {
        resourceType: 'MedicationRequest',
        id: 'MR-1',
        status: 'active',
        intent: 'order',
        medicationReference: { reference: 'Medication/MED-3' },
        subject: { reference: 'Patient/PAT-1' }
      };

      const bundle = toR5Bundle([basePatient, medication, medicationRequest]);
      const medicationRequestResource = getResource(bundle, 'MedicationRequest');
      const medicationFullUrl = getFullUrl(bundle, 'Medication');
      const patientFullUrl = getFullUrl(bundle, 'Patient');

      expect(medicationRequestResource.medication.reference.reference).toBe(medicationFullUrl);
      expect(medicationRequestResource.subject.reference).toBe(patientFullUrl);
    });

    it('maps dosage instructions to doseAndRate', () => {
      const medicationRequest = {
        resourceType: 'MedicationRequest',
        id: 'MR-2',
        status: 'active',
        intent: 'order',
        medicationCodeableConcept: {
          coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '456', display: 'Amoxicillin' }],
          text: 'Amoxicillin'
        },
        dosageInstruction: [{
          text: 'Take two tablets',
          doseAndRate: [{ doseQuantity: { value: 2, unit: 'tab' } }]
        }]
      };

      const bundle = toR5Bundle([basePatient, medicationRequest]);
      const medicationRequestResource = getResource(bundle, 'MedicationRequest');

      expect(medicationRequestResource.dosageInstruction[0].doseAndRate[0].doseQuantity.value).toBe(2);
    });
  });

  describe('DocumentReference', () => {
    it('maps content attachments', () => {
      const documentReference = {
        resourceType: 'DocumentReference',
        id: 'DOC-1',
        status: 'current',
        description: 'Discharge Summary',
        content: [{
          attachment: {
            contentType: 'application/pdf',
            data: 'dGVzdA==',
            title: 'Report'
          }
        }]
      };

      const bundle = toR5Bundle([basePatient, documentReference]);
      const documentResource = getResource(bundle, 'DocumentReference');

      expect(documentResource.content[0].attachment.contentType).toBe('application/pdf');
      expect(documentResource.content[0].attachment.data).toBe('dGVzdA==');
    });

    it('resolves author and custodian references', () => {
      const practitioner = {
        resourceType: 'Practitioner',
        id: 'PRAC-6',
        name: [{ family: 'Jones', given: ['Casey'] }]
      };
      const organization = {
        resourceType: 'Organization',
        id: 'ORG-4',
        name: 'Archive Org'
      };
      const documentReference = {
        resourceType: 'DocumentReference',
        id: 'DOC-2',
        status: 'current',
        author: [{ reference: 'Practitioner/PRAC-6' }],
        custodian: { reference: 'Organization/ORG-4' }
      };

      const bundle = toR5Bundle([basePatient, practitioner, organization, documentReference]);
      const documentResource = getResource(bundle, 'DocumentReference');
      const practitionerFullUrl = getFullUrl(bundle, 'Practitioner');
      const organizationFullUrl = getFullUrl(bundle, 'Organization');

      expect(documentResource.author[0].reference).toBe(practitionerFullUrl);
      expect(documentResource.custodian.reference).toBe(organizationFullUrl);
    });
  });
});
