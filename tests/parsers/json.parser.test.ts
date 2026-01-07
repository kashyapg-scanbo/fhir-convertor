import { describe, expect, it } from 'vitest';
import { parseCustomJSON } from '../../src/modules/parsers/json.parser.js';

describe('parseCustomJSON', () => {
  it('maps all supported canonical resources from input JSON', () => {
    const input = {
      operation: 'create',
      messageType: 'ORU^R01',
      patient: {
        id: 'PAT-1',
        firstName: 'Jane',
        lastName: 'Doe',
        gender: 'female',
        birthDate: '1980-01-01',
        address: {
          line1: '11 Main St',
          city: 'Centerville',
          state: 'NY',
          postalCode: '10010',
          country: 'US'
        },
        contacts: [{
          type: 'mobile',
          value: '+15551230000'
        }]
      },
      encounter: {
        id: 'ENC-1',
        classCode: 'AMB',
        startDateTime: '2024-01-01T10:00:00Z',
        location: 'OPD'
      },
      observations: [{
        id: 'OBS-1',
        code: '8867-4',
        codeSystem: 'LOINC',
        display: 'Heart rate',
        value: 80,
        unit: '/min',
        recordedDateTime: '2024-01-01T10:15:00Z',
        status: 'final'
      }],
      medications: [{
        id: 'MED-1',
        code: '860975',
        codeSystem: 'RXNORM',
        display: 'Metformin 500 MG',
        status: 'active'
      }],
      medicationRequests: [{
        id: 'MEDREQ-1',
        medicationCode: '860975',
        medicationCodeSystem: 'RXNORM',
        medicationDisplay: 'Metformin 500 MG Oral Tablet',
        dose: 1,
        doseUnit: 'tablet',
        frequency: 'BID',
        route: 'PO',
        subjectId: 'PAT-1',
        requesterId: 'PRAC-1'
      }],
      practitioners: [{
        id: 'PRAC-1',
        firstName: 'Amy',
        lastName: 'Clinician'
      }],
      practitionerRoles: [{
        practitionerId: 'PRAC-1',
        organizationId: 'ORG-1',
        roleCode: 'PP',
        roleDisplay: 'Primary Care Provider',
        roleSystem: 'urn:hl7-org:v2:HL70443'
      }],
      organizations: [{
        id: 'ORG-1',
        name: 'Good Health',
        typeCode: 'prov',
        typeDisplay: 'Healthcare Provider',
        typeSystem: 'http://terminology.hl7.org/CodeSystem/organization-type'
      }],
      documentReferences: [{
        id: 'DOC-1',
        contentType: 'text/plain',
        data: 'ZmlsZSBjb250ZW50',
        status: 'current',
        date: '2024-01-01T10:20:00Z'
      }]
    };

    const canonical = parseCustomJSON(input);

    // Patient mapping
    expect(canonical.patient!.id).toBe('PAT-1');
    expect(canonical.patient!.name.family).toBe('Doe');
    expect(canonical.patient!.name.given?.[0]).toBe('Jane');
    expect(canonical.patient!.gender).toBe('female');
    expect(canonical.patient!.address?.[0]?.city).toBe('Centerville');
    expect(canonical.patient!.telecom?.[0]?.value).toBe('+15551230000');

    // Encounter mapping
    expect(canonical.encounter?.id).toBe('ENC-1');
    expect(canonical.encounter?.class).toBe('AMB');
    expect(canonical.encounter?.start).toBe('2024-01-01T10:00:00Z');

    // Observation mapping
    expect((canonical.observations?.[0]?.code as any)?.code).toBe('8867-4');
    expect(canonical.observations?.[0]?.value).toBe(80);
    expect(canonical.observations?.[0]?.unit).toBe('/min');

    // Medication / MedicationRequest mapping
    expect(canonical.medications?.[0]?.code?.coding?.[0]?.code).toBe('860975');
    expect(canonical.medicationRequests?.[0]?.medicationCodeableConcept?.coding?.[0]?.code).toBe('860975');
    expect(canonical.medicationRequests?.[0]?.dosageInstruction?.[0]?.text).toContain('BID');

    // Practitioner and role mapping
    expect(canonical.practitioners?.[0]?.id).toBe('PRAC-1');
    expect(canonical.practitioners?.[0]?.name?.family).toBe('Clinician');
    expect(canonical.practitionerRoles?.[0]?.organizationId).toBe('ORG-1');
    expect(canonical.organizations?.[0]?.name).toBe('Good Health');

    // DocumentReference mapping
    expect(canonical.documentReferences?.[0]?.content?.[0]?.attachment?.data).toBe('ZmlsZSBjb250ZW50');
    expect(canonical.documentReferences?.[0]?.status).toBe('current');
  });
});
