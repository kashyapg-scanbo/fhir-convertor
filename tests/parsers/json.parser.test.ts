import { describe, expect, it } from 'vitest';
import { parseCustomJSON } from '../../src/modules/parsers/json.parser.js';

describe('parseCustomJSON', () => {
  it('maps all supported canonical resources from input JSON', () => {
    const input = {
      operation: 'create',
      messageType: 'ORU^R01',
      patient: {
        patient_id: 'PAT-1',
        name: {
          first_name: 'Jane',
          last_name: 'Doe'
        },
        gender: 'female',
        date_of_birth: '1980-01-01',
        contact_info: {
          phone: '+15551230000',
          email: 'jane.doe@example.com',
          address: {
            street: '11 Main St',
            city: 'Centerville',
            state: 'NY',
            postal_code: '10010',
            country: 'US'
          }
        },
      },
      encounter: {
        encounter_id: 'ENC-1',
        encounter_type: 'AMB',
        start_date: '2024-01-01T10:00:00Z',
        practitioner_id: 'PRAC-1',
        location: {
          facility_name: 'OPD',
          room: '1A'
        }
      },
      medication: {
        medication_id: 'MED-1',
        name: 'Metformin',
        strength: '500 MG',
        form: 'tablet',
        status: 'active'
      },
      medication_request: {
        medication_request_id: 'MEDREQ-1',
        patient_id: 'PAT-1',
        practitioner_id: 'PRAC-1',
        status: 'active',
        authored_on: '2024-01-01T10:05:00Z',
        dosage_instruction: {
          dose: '1',
          route: 'oral',
          frequency: 'BID'
        },
        medication: {
          medication_id: 'MED-1',
          name: 'Metformin',
          strength: '500 MG'
        }
      },
      practitioner: {
        practitioner_id: 'PRAC-1',
        name: {
          first_name: 'Amy',
          last_name: 'Clinician'
        }
      },
      practitioner_role: {
        practitioner_role_id: 'ROLE-1',
        practitioner_id: 'PRAC-1',
        organization_id: 'ORG-1',
        role: 'PP',
        specialty: 'Primary Care Provider'
      },
      organization: {
        organization_id: 'ORG-1',
        name: 'Good Health',
        type: 'prov'
      }
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
    expect(canonical.encounter?.location).toBe('OPD - 1A');

    // Medication / MedicationRequest mapping
    expect(canonical.medications?.[0]?.code?.coding?.[0]?.code).toBe('MED-1');
    expect(canonical.medications?.[0]?.code?.text).toBe('Metformin 500 MG');
    expect(canonical.medicationRequests?.[0]?.medicationCodeableConcept?.coding?.[0]?.code).toBe('MED-1');
    expect(canonical.medicationRequests?.[0]?.dosageInstruction?.[0]?.text).toContain('BID');
    expect(canonical.medicationRequests?.[0]?.dosageInstruction?.[0]?.route?.text).toBe('oral');

    // Practitioner and role mapping
    expect(canonical.practitioners?.[0]?.id).toBe('PRAC-1');
    expect(canonical.practitioners?.[0]?.name?.family).toBe('Clinician');
    expect(canonical.practitionerRoles?.[0]?.organizationId).toBe('ORG-1');
    expect(canonical.organizations?.[0]?.name).toBe('Good Health');
  });
});
