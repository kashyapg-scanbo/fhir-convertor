import { describe, expect, it } from 'vitest';
import { parseCustomJSON } from '../../src/modules/parsers/json.parser.js';
import { mapCanonicalToFHIR } from '../../src/modules/mappers/fhir.mapper.js';

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

  it('accepts a top-level array of custom JSON documents and merges results', () => {
    const input = [
      {
        operation: 'create',
        messageType: 'ORU^R01',
        patient: {
          patient_id: 'PAT-1',
          name: { first_name: 'Jane', last_name: 'Doe' },
          gender: 'female',
          date_of_birth: '1980-01-01'
        },
        medication: {
          medication_id: 'MED-1',
          name: 'Metformin',
          strength: '500 MG',
          form: 'tablet',
          status: 'active'
        }
      },
      {
        medication: {
          medication_id: 'MED-2',
          name: 'Atorvastatin',
          strength: '20 MG',
          form: 'tablet',
          status: 'active'
        },
        medication_request: {
          medication_request_id: 'MEDREQ-2',
          patient_id: 'PAT-1',
          status: 'active',
          authored_on: '2024-01-02T10:05:00Z',
          dosage_instruction: {
            dose: '1',
            route: 'oral',
            frequency: 'QD'
          },
          medication: {
            medication_id: 'MED-2',
            name: 'Atorvastatin',
            strength: '20 MG'
          }
        }
      }
    ];

    const canonical = parseCustomJSON(input as any);

    // Keeps scalar fields from first document
    expect(canonical.patient!.id).toBe('PAT-1');
    expect(canonical.messageType).toBe('ORU^R01');

    // Merges array-backed resources
    expect(canonical.medications?.length).toBe(2);
    const medCodes = canonical.medications?.map(m => m.code?.coding?.[0]?.code);
    expect(medCodes).toContain('MED-1');
    expect(medCodes).toContain('MED-2');

    expect(canonical.medicationRequests?.length).toBe(1);
    expect(canonical.medicationRequests?.[0]?.id).toBe('MEDREQ-2');
  });

  it('emits multiple Patient entries when tabular JSON has multiple patient rows', () => {
    const input = [
      {
        patient_id: 'PAT-1',
        patient_first_name: 'Example patient 1',
        patient_last_name: 'Example patient 1',
        patient_gender: 'male',
        patient_birth_date: '2024-05-11T10:01:00Z',
        patient_phone: '555-0101',
        patient_email: 'user1@example.org',
        patient_address_line1: '101 Main St',
        patient_address_line2: 'Suite 101',
        patient_city: 'Metropolis',
        patient_state: 'CA',
        patient_postal_code: 'CODE-1',
        patient_country: '11'
      },
      {
        patient_id: 'PAT-2',
        patient_first_name: 'Example patient 2',
        patient_last_name: 'Example patient 2',
        patient_gender: 'female',
        patient_birth_date: '2024-05-12T10:02:00Z',
        patient_phone: '555-0102',
        patient_email: 'user2@example.org',
        patient_address_line1: '102 Main St',
        patient_address_line2: 'Suite 102',
        patient_city: 'Metropolis',
        patient_state: 'CA',
        patient_postal_code: 'CODE-2',
        patient_country: '21'
      }
    ];

    const canonical = parseCustomJSON(input as any);
    expect(canonical.patients?.length).toBe(2);
    expect(canonical.patients?.map(p => p.identifier)).toEqual(['PAT-1', 'PAT-2']);

    const bundle = mapCanonicalToFHIR(canonical, 'r5');
    const patientEntries = (bundle.entry || []).filter((e: any) => e?.resource?.resourceType === 'Patient');
    expect(patientEntries.length).toBe(2);
    const identifiers = patientEntries.map((e: any) => e.resource.identifier?.[0]?.value);
    expect(identifiers).toContain('PAT-1');
    expect(identifiers).toContain('PAT-2');
  });

  it('does not set practitioner qualification when not provided', () => {
    const input = {
      _id: 'DOC-1',
      doctorFirstName: 'Bhushan',
      doctorLastName: 'Bafna',
      gender: 'Male',
      birthDate: '1999-07-01T19:45:12.133Z'
    };

    const canonical = parseCustomJSON(input as any);
    const practitioner = canonical.practitioners?.[0];
    expect(practitioner?.name?.given?.[0]).toBe('Bhushan');
    expect(practitioner?.name?.family).toBe('Bafna');
    expect(practitioner?.qualification).toBeUndefined();
  });

  it('maps community worker payload and sets qualification to Community Worker', () => {
    const input = {
      _id: '671800c8b17ef535c9fcdb44',
      communityWorkerFirstName: 'New',
      communityWorkerLastName: 'Text',
      gender: 'Male',
      age: 24,
      birthdate: '2000-02-01T00:00:00.000Z',
      registrationNumber: 'Njdn',
      workingWithOrganazation: false
    };

    const canonical = parseCustomJSON(input as any);
    const practitioner = canonical.practitioners?.[0];
    expect(practitioner?.id).toBe('671800c8b17ef535c9fcdb44');
    expect(practitioner?.identifier).toBe('Njdn');
    expect(practitioner?.name?.given?.[0]).toBe('New');
    expect(practitioner?.name?.family).toBe('Text');
    expect(practitioner?.qualification?.[0]?.code?.code).toBe('Community Worker');
  });

  it('accepts community worker payload with null experience and practitionerType marker', () => {
    const input = {
      _id: '671800c8b17ef535c9fcdc16',
      communityWorkerId: '671800c8b17ef535c9fcdc16',
      doctorFirstName: 'Arvind',
      doctorLastName: 'Rajan',
      medicalRegNo: '75245713',
      noOfExperience: null,
      hospitalTime: null,
      hospitalContactNumber: null,
      gender: 'Male',
      photo: null,
      age: 50,
      weight: null,
      height: null,
      birthDate: '1974-07-01T19:45:12.747Z',
      bloodGroup: null,
      address: null,
      zipCode: '600130',
      city: 'Kanchipuram',
      state: 'Tamil nadu',
      country: 'India',
      qualification: 'MBBS',
      period: '',
      practitionerType: 'community_worker',
      sourceEntityType: 'community_worker'
    };

    const canonical = parseCustomJSON(input as any);
    const practitioner = canonical.practitioners?.[0];
    expect(practitioner?.id).toBe('671800c8b17ef535c9fcdc16');
    expect(practitioner?.identifier).toBe('75245713');
    expect(practitioner?.name?.given?.[0]).toBe('Arvind');
    expect(practitioner?.name?.family).toBe('Rajan');
    expect(practitioner?.qualification?.[0]?.code?.code).toBe('Community Worker');
  });

  it('accepts community worker payload wrapped in top-level payload object', () => {
    const input = {
      payload: {
        _id: '671800c9b17ef535c9fcddc4',
        communityWorkerId: '671800c9b17ef535c9fcddc4',
        doctorFirstName: 'Mayur',
        doctorLastName: 'Testworker',
        medicalRegNo: '',
        noOfExperience: null,
        hospitalTime: null,
        hospitalContactNumber: null,
        gender: 'Male',
        photo: null,
        age: null,
        weight: null,
        height: null,
        birthDate: '2000-07-01T00:00:00.000Z',
        bloodGroup: null,
        address: null,
        zipCode: '401105',
        city: 'Thane',
        state: 'Maharashtra',
        country: 'India',
        qualification: null,
        period: '',
        practitionerType: 'community_worker',
        sourceEntityType: 'community_worker'
      }
    };

    const canonical = parseCustomJSON(input as any);
    const practitioner = canonical.practitioners?.[0];
    expect(practitioner?.id).toBe('671800c9b17ef535c9fcddc4');
    expect(practitioner?.name?.given?.[0]).toBe('Mayur');
    expect(practitioner?.name?.family).toBe('Testworker');
    expect(practitioner?.qualification?.[0]?.code?.code).toBe('Community Worker');
  });

  it('accepts patient payload with null patientType and boolean maritalStatus', () => {
    const input = {
      _id: '671800c8b17ef535c9fcdb04',
      masterProfileId: '671800c8b17ef535c9fcdaf8',
      patientFirstName: 'Om',
      patientMiddleName: null,
      patientLastName: 'K',
      patientType: null,
      mobileNumber: '',
      countryCode: '',
      gender: 'Male',
      birthDate: '1999-07-01T19:45:12.255Z',
      photo: '',
      weight: 65,
      weightUnit: 'kg',
      height: 0,
      heightUnit: 'cm',
      bloodGroup: "I don't know",
      maritalStatus: false,
      isPregnant: false,
      isDiabetic: false,
      isHypertension: false,
      deceasedBoolean: false,
      email: null,
      address: '-',
      zipCode: '400602',
      city: 'Thane',
      state: 'Maharashtra',
      country: 'India'
    };

    const canonical = parseCustomJSON(input as any);
    expect(canonical.patient?.id).toBe('671800c8b17ef535c9fcdaf8');
    expect(canonical.patient?.name?.given?.[0]).toBe('Om');
    expect(canonical.patient?.name?.family).toBe('K');
    expect(canonical.patient?.weight).toBe(65);
    expect(canonical.patient?.height).toBe(0);
    expect(canonical.patient?.maritalStatus).toBeUndefined();
    expect(canonical.patient?.deceasedBoolean).toBe(false);
  });

  it('maps nested payload patient/doctor/observation sections with hospital null', () => {
    const input = {
      payload: {
        patient: {
          _id: '671800c8b17ef535c9fcdad6',
          masterProfileId: '671800c8b17ef535c9fcdac4',
          patientFirstName: 'Bhushan',
          patientMiddleName: null,
          patientLastName: 'Bafna',
          patientType: null,
          mobileNumber: '',
          countryCode: '',
          gender: 'Male',
          birthDate: '1999-07-01T19:45:12.166Z',
          photo: '',
          weight: 53,
          weightUnit: 'kg',
          height: 0,
          heightUnit: 'cm',
          bloodGroup: "I don't know",
          maritalStatus: false,
          isPregnant: false,
          isDiabetic: false,
          isHypertension: false,
          deceasedBoolean: false,
          email: null,
          address: '-',
          zipCode: '400063',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India'
        },
        doctor: {
          _id: '671800c8b17ef535c9fcdac8',
          doctorFirstName: 'Bhushan',
          doctorLastName: 'Bafna',
          medicalRegNo: '123456',
          noOfExperience: 0,
          hospitalTime: '',
          hospitalContactNumber: '',
          gender: 'Male',
          photo: '',
          age: 25,
          weight: 53,
          height: 0,
          birthDate: '1999-07-01T19:45:12.133Z',
          bloodGroup: "I don't know",
          address: '-',
          zipCode: '400063',
          city: 'Mumbai',
          state: 'Maharashtra',
          country: 'India',
          qualification: 'MBBS',
          period: '10/2024'
        },
        hospital: null,
        observation: {
          testDateTime: '2019-05-16T14:18:49.000Z',
          readingFromDevice: 28.188888888888886,
          calibratedReading: 28.188888888888886,
          measuringUnitFullName: 'Celsius',
          measuringUnitShortName: 'C'
        }
      }
    };

    const canonical = parseCustomJSON(input as any);
    expect(canonical.patient?.id).toBe('671800c8b17ef535c9fcdac4');
    const doctor = canonical.practitioners?.find(p => p.id === '671800c8b17ef535c9fcdac8');
    expect(doctor?.id).toBe('671800c8b17ef535c9fcdac8');
    const practitionerQualification = doctor?.qualification?.[0]?.code;
    expect(practitionerQualification?.code || practitionerQualification?.display).toBe('MBBS');
    expect(canonical.observations?.[0]?.value).toBe(28.188888888888886);
    expect(canonical.observations?.[0]?.unit).toBe('C');
    expect(canonical.observations?.[0]?.date).toBe('2019-05-16T14:18:49.000Z');
  });

  it('maps observation type aliases to standard LOINC codes', () => {
    const bodyTemperatureInput = {
      payload: {
        observation: {
          type: 'bodyTempreture',
          testDateTime: '2019-05-16T14:18:49.000Z',
          readingFromDevice: 28.1,
          measuringUnitShortName: 'C'
        }
      }
    };

    const bloodGlucoseInput = {
      payload: {
        observation: {
          type: 'bloodGloucose',
          testDateTime: '2019-05-16T14:18:49.000Z',
          readingFromDevice: 98,
          measuringUnitShortName: 'mg/dL'
        }
      }
    };

    const bodyCanonical = parseCustomJSON(bodyTemperatureInput as any);
    const glucoseCanonical = parseCustomJSON(bloodGlucoseInput as any);
    const bodyCode = Array.isArray(bodyCanonical.observations?.[0]?.code)
      ? bodyCanonical.observations?.[0]?.code?.[0]
      : bodyCanonical.observations?.[0]?.code;
    const glucoseCode = Array.isArray(glucoseCanonical.observations?.[0]?.code)
      ? glucoseCanonical.observations?.[0]?.code?.[0]
      : glucoseCanonical.observations?.[0]?.code;

    expect(bodyCode?.code).toBe('8310-5');
    expect(bodyCode?.system).toBe('http://loinc.org');
    expect(bodyCode?.display).toBe('Body temperature');

    expect(glucoseCode?.code).toBe('2339-0');
    expect(glucoseCode?.system).toBe('http://loinc.org');
    expect(glucoseCode?.display).toBe('Glucose [Mass/volume] in Blood');
  });

  it('maps blood pressure, blood oxygen, heart rate and ecg observation payloads', () => {
    const bloodPressureInput = {
      payload: {
        observation: {
          type: 'bloodPressure',
          testDateTime: '2019-05-17T08:51:15.000Z',
          systolicReadingFromDevice: 58,
          diastolicReadingFromDevice: 46
        }
      }
    };
    const oxygenInput = {
      payload: {
        observation: {
          type: 'bloodOxygen',
          testDateTime: '2019-05-17T08:40:02.000Z',
          readingFromDevice: 99
        }
      }
    };
    const heartRateInput = {
      payload: {
        observation: {
          type: 'heartRate',
          testDateTime: '2019-05-17T08:40:02.000Z',
          readingFromDevice: 85
        }
      }
    };
    const ecgInput = {
      payload: {
        observation: {
          type: 'ecg',
          testDateTime: '2019-05-16T14:23:32.000Z',
          PQRSTWaves: '0,1,2,3,2,1,0',
          heartRate: 66,
          heartRateVariability: '32',
          breatheRate: '18'
        }
      }
    };

    const bpCanonical = parseCustomJSON(bloodPressureInput as any);
    const bpCodes = (bpCanonical.observations || []).map(obs => {
      const code = Array.isArray(obs.code) ? obs.code[0] : obs.code;
      return code?.code;
    });
    expect(bpCodes).toContain('8480-6');
    expect(bpCodes).toContain('8462-4');
    expect(bpCanonical.observations?.find(obs => (Array.isArray(obs.code) ? obs.code[0] : obs.code)?.code === '8480-6')?.value).toBe(58);
    expect(bpCanonical.observations?.find(obs => (Array.isArray(obs.code) ? obs.code[0] : obs.code)?.code === '8462-4')?.value).toBe(46);

    const oxygenCanonical = parseCustomJSON(oxygenInput as any);
    const oxygenCode = Array.isArray(oxygenCanonical.observations?.[0]?.code)
      ? oxygenCanonical.observations?.[0]?.code?.[0]
      : oxygenCanonical.observations?.[0]?.code;
    expect(oxygenCode?.code).toBe('2708-6');
    expect(oxygenCanonical.observations?.[0]?.unit).toBe('%');

    const heartRateCanonical = parseCustomJSON(heartRateInput as any);
    const heartRateCode = Array.isArray(heartRateCanonical.observations?.[0]?.code)
      ? heartRateCanonical.observations?.[0]?.code?.[0]
      : heartRateCanonical.observations?.[0]?.code;
    expect(heartRateCode?.code).toBe('8867-4');
    expect(heartRateCanonical.observations?.[0]?.unit).toBe('/min');

    const ecgCanonical = parseCustomJSON(ecgInput as any);
    const ecgCode = Array.isArray(ecgCanonical.observations?.[0]?.code)
      ? ecgCanonical.observations?.[0]?.code?.[0]
      : ecgCanonical.observations?.[0]?.code;
    expect(ecgCode?.code).toBe('11524-6');
    expect(ecgCanonical.observations?.[0]?.value).toBe('0,1,2,3,2,1,0');
    expect(ecgCanonical.observations?.[0]?.components?.length).toBe(3);
  });

  it('maps scanbo consultation payload to patient/practitioner/appointment/condition/medication/careplan/document resources', () => {
    const input = {
      _id: '69b405097b2f9de46afbf471',
      exercise: '30 minutes walking daily',
      diet: 'Low carb diabetic diet',
      mindSet: {
        _id: '68e50d791f242bf1e6cec99d',
        name: 'RECORDED DIABETES EDUCATION SEMINAR'
      },
      appointment: '2026-02-04T18:30:00.000Z',
      note: 'Test1001',
      supplementList: [
        {
          quantity: 2,
          frequencyName: 'daily 3',
          frequencyDayCount: 3,
          duration: 10,
          remark: 'Testing remark'
        }
      ],
      followUps: [{ name: 'S. Insulin Fasting & PP' }],
      books: [{ name: 'Spring of Inspiration' }],
      diagnosis: [{ diagnosis: 'B12 DEFICIANCY' }],
      prescription: [
        {
          testDateTime: '2026-02-04T09:07:05.701Z',
          drugName: 'REMO 100',
          frequencyName: 'Once daily after dinner or for one week',
          remarkName: null,
          quantity: 1,
          duration: 1,
          notes: ''
        },
        {
          testDateTime: '2026-02-04T09:07:05.701Z',
          drugName: 'Once daily',
          frequencyName: 'Once daily after dinner or for one week',
          remarkName: null,
          quantity: 1,
          duration: 1,
          notes: ''
        }
      ],
      patient: {
        _id: '6981c756d8e8c4987f61c366',
        patientFirstName: 'Kashyap',
        patientLastName: 'Oooo'
      },
      doctor: {
        _id: '671800c8b17ef535c9fcdb36',
        doctorFirstName: 'Shivan',
        doctorLastName: 'Patel'
      }
    };

    const canonical = parseCustomJSON(input as any);
    const bundle = mapCanonicalToFHIR(canonical, 'r5');
    const resourceTypes = (bundle.entry || []).map((e: any) => e?.resource?.resourceType);
    const medicationCount = resourceTypes.filter((type: string) => type === 'Medication').length;
    const medicationRequestCount = resourceTypes.filter((type: string) => type === 'MedicationRequest').length;

    expect(resourceTypes).toContain('Patient');
    expect(resourceTypes).toContain('Practitioner');
    expect(resourceTypes).toContain('Appointment');
    expect(resourceTypes).toContain('Condition');
    expect(resourceTypes).toContain('Medication');
    expect(resourceTypes).toContain('MedicationRequest');
    expect(resourceTypes).toContain('CarePlan');
    expect(resourceTypes).toContain('DocumentReference');
    expect(medicationCount).toBe(3);
    expect(medicationRequestCount).toBe(2);
  });
});
