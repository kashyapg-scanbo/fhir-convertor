import { describe, expect, it } from 'vitest';
import { parseHL7v3 } from '../../src/modules/parsers/hl7v3.parser.js';
import { mapCanonicalToFHIR } from '../../src/modules/mappers/fhir.mapper.js';

function buildRegistrationEvent(options: {
  patientId: string;
  family: string;
  given: string;
  gender?: string;
  birthDate?: string;
  active?: boolean;
  includeAddress?: boolean;
  includeTelecom?: boolean;
  custodianOrg?: {
    id: string;
    name: string;
    code?: { code: string; display: string; system: string };
    includeTelecom?: boolean;
    includeAddress?: boolean;
  };
}) {
  const {
    patientId,
    family,
    given,
    gender = 'F',
    birthDate = '19900101',
    active = false,
    includeAddress = false,
    includeTelecom = false,
    custodianOrg
  } = options;

  const addressXml = includeAddress
    ? `
      <addr use="H">
        <streetAddressLine>1 Main St</streetAddressLine>
        <city>Austin</city>
        <state>TX</state>
        <postalCode>78701</postalCode>
      </addr>`
    : '';

  const telecomXml = includeTelecom
    ? `<telecom value="tel:+15550100" use="HP"/>`
    : '';

  const custodianXml = custodianOrg
    ? `
      <custodian>
        <assignedCustodian>
          <representedCustodianOrganization>
            <id extension="${custodianOrg.id}"/>
            <name>${custodianOrg.name}</name>
            ${custodianOrg.code
              ? `<code code="${custodianOrg.code.code}" displayName="${custodianOrg.code.display}" codeSystem="${custodianOrg.code.system}"/>`
              : ''}
            ${custodianOrg.includeTelecom ? `<telecom value="tel:+15550200" use="WP"/>` : ''}
            ${custodianOrg.includeAddress
              ? `<addr><city>Dallas</city><state>TX</state></addr>`
              : ''}
          </representedCustodianOrganization>
        </assignedCustodian>
      </custodian>`
    : '';

  return `
    <registrationEvent>
      <subject1>
        <patient>
          <id extension="${patientId}"/>
          <patientPerson>
            <name>
              <family>${family}</family>
              <given>${given}</given>
            </name>
            <administrativeGenderCode code="${gender}"/>
            <birthTime value="${birthDate}"/>
          </patientPerson>
          ${active ? '<statusCode code="active"/>' : ''}
          ${addressXml}
          ${telecomXml}
        </patient>
      </subject1>
      ${custodianXml}
    </registrationEvent>`;
}

function wrapV3(subjects: string[], authors: string[] = []) {
  return `<?xml version="1.0"?>
<PRPA_IN101001>
  <controlActProcess>
    ${subjects.join('\n')}
  </controlActProcess>
  ${authors.join('\n')}
</PRPA_IN101001>`;
}

function toR5Bundle(hl7v3Xml: string) {
  const canonical = parseHL7v3(hl7v3Xml);
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

describe('HL7 v3 to R5 via canonical', () => {
  describe('Patient', () => {
    it('maps demographics and identifiers', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-100',
            family: 'Doe',
            given: 'Jane',
            gender: 'F',
            birthDate: '19900203'
          })}
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const patient = getResource(bundle, 'Patient');

      expect(patient.identifier[0].value).toBe('PAT-100');
      expect(patient.name[0].family).toBe('Doe');
      expect(patient.gender).toBe('female');
      expect(patient.birthDate).toBe('1990-02-03');
    });

    it('maps address, telecom, and active flag', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-101',
            family: 'Roe',
            given: 'Riley',
            active: true,
            includeAddress: true,
            includeTelecom: true
          })}
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const patient = getResource(bundle, 'Patient');

      expect(patient.active).toBe(true);
      expect(patient.address[0].city).toBe('Austin');
      expect(patient.telecom[0].system).toBe('phone');
    });
  });

  describe('Encounter', () => {
    it('maps class, status, period, and participant references', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-200',
            family: 'Doe',
            given: 'Janet',
            custodianOrg: { id: 'ORG-1', name: 'General Hospital' }
          })}
          <encounterEvent>
            <id extension="ENC-1"/>
            <code code="IMP"/>
            <effectiveTime value="20240102103000"/>
            <statusCode code="active"/>
            <responsibleParty>
              <assignedEntity>
                <id extension="PRAC-1"/>
                <assignedPerson>
                  <name>
                    <family>Smith</family>
                    <given>Sam</given>
                  </name>
                </assignedPerson>
                <representedOrganization>
                  <id extension="ORG-1"/>
                </representedOrganization>
              </assignedEntity>
            </responsibleParty>
          </encounterEvent>
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const encounter = getResource(bundle, 'Encounter');
      const practitionerFullUrl = getFullUrl(bundle, 'Practitioner');
      const organizationFullUrl = getFullUrl(bundle, 'Organization');

      expect(encounter.class[0].coding[0].code).toBe('IMP');
      expect(encounter.status).toBe('in-progress');
      expect(encounter.actualPeriod.start).toBe('2024-01-02T10:30:00Z');
      expect(encounter.participant[0].actor.reference).toBe(practitionerFullUrl);
      expect(encounter.serviceProvider.reference).toBe(organizationFullUrl);
    });

    it('maps location details', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-201',
            family: 'Lee',
            given: 'Alex'
          })}
          <encounterEvent>
            <id extension="ENC-2"/>
            <code code="VR"/>
            <statusCode code="active"/>
            <location>
              <healthCareFacility>
                <location>
                  <pointOfCare>A</pointOfCare>
                  <room>2</room>
                  <bed>1</bed>
                </location>
              </healthCareFacility>
            </location>
          </encounterEvent>
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const encounter = getResource(bundle, 'Encounter');

      expect(encounter.class[0].coding[0].code).toBe('VR');
      expect(encounter.location[0].location.display).toContain('Room 2');
    });
  });

  describe('Practitioner', () => {
    it('maps author practitioner with telecom', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-300',
            family: 'Doe',
            given: 'Janet'
          })}
        </subject>`;
      const author = `
        <author>
          <assignedAuthor>
            <id extension="PRAC-A1"/>
            <assignedPerson>
              <name>
                <family>Nguyen</family>
                <given>Ava</given>
              </name>
            </assignedPerson>
            <telecom value="tel:+15550111"/>
          </assignedAuthor>
        </author>`;

      const bundle = toR5Bundle(wrapV3([subject], [author]));
      const practitioner = getResource(bundle, 'Practitioner');

      expect(practitioner.identifier[0].value).toBe('PRAC-A1');
      expect(practitioner.name[0].family).toBe('Nguyen');
      expect(practitioner.telecom[0].value).toBe('+15550111');
    });

    it('maps responsible party practitioner', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-301',
            family: 'Kim',
            given: 'Jordan'
          })}
          <encounterEvent>
            <id extension="ENC-3"/>
            <responsibleParty>
              <assignedEntity>
                <id extension="PRAC-R1"/>
                <assignedPerson>
                  <name>
                    <family>Patel</family>
                    <given>Mia</given>
                  </name>
                </assignedPerson>
              </assignedEntity>
            </responsibleParty>
          </encounterEvent>
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const practitioner = getResource(bundle, 'Practitioner');

      expect(practitioner.identifier[0].value).toBe('PRAC-R1');
      expect(practitioner.name[0].family).toBe('Patel');
    });
  });

  describe('PractitionerRole', () => {
    it('maps role from author with organization reference', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-400',
            family: 'Doe',
            given: 'Jamie'
          })}
        </subject>`;
      const author = `
        <author>
          <assignedAuthor>
            <id extension="PRAC-A2"/>
            <assignedPerson>
              <name>
                <family>Stone</family>
                <given>Rory</given>
              </name>
            </assignedPerson>
            <representedOrganization>
              <id extension="ORG-A2"/>
              <name>Clinic A</name>
            </representedOrganization>
            <code code="PHY" displayName="Physician" codeSystem="http://example.org"/>
          </assignedAuthor>
        </author>`;
      const bundle = toR5Bundle(wrapV3([subject], [author]));
      const role = getResource(bundle, 'PractitionerRole');
      const practitionerFullUrl = getFullUrl(bundle, 'Practitioner');
      const organizationFullUrl = getFullUrl(bundle, 'Organization');

      expect(role.practitioner.reference).toBe(practitionerFullUrl);
      expect(role.organization.reference).toBe(organizationFullUrl);
    });

    it('maps role from responsible party', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-401',
            family: 'Roe',
            given: 'Taylor',
            custodianOrg: { id: 'ORG-R1', name: 'General Hospital' }
          })}
          <encounterEvent>
            <id extension="ENC-4"/>
            <responsibleParty>
              <assignedEntity>
                <id extension="PRAC-R2"/>
                <assignedPerson>
                  <name>
                    <family>Choi</family>
                    <given>Lee</given>
                  </name>
                </assignedPerson>
                <representedOrganization>
                  <id extension="ORG-R1"/>
                </representedOrganization>
                <code code="CARD" displayName="Cardiology" codeSystem="http://example.org"/>
              </assignedEntity>
            </responsibleParty>
          </encounterEvent>
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const role = getResource(bundle, 'PractitionerRole');
      const practitionerFullUrl = getFullUrl(bundle, 'Practitioner');
      const organizationFullUrl = getFullUrl(bundle, 'Organization');

      expect(role.practitioner.reference).toBe(practitionerFullUrl);
      expect(role.organization.reference).toBe(organizationFullUrl);
    });
  });

  describe('Organization', () => {
    it('maps custodian organization contact fields', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-500',
            family: 'Doe',
            given: 'Jordan',
            custodianOrg: {
              id: 'ORG-C1',
              name: 'General Hospital',
              includeTelecom: true,
              includeAddress: true
            }
          })}
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const organization = getResource(bundle, 'Organization');

      expect(organization.name).toBe('General Hospital');
      expect(organization.contact[0].telecom[0].value).toBe('+15550200');
      expect(organization.contact[0].address[0].city).toBe('Dallas');
    });

    it('maps organization type from author', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-501',
            family: 'Doe',
            given: 'Alex'
          })}
        </subject>`;
      const author = `
        <author>
          <assignedAuthor>
            <id extension="PRAC-A3"/>
            <assignedPerson>
              <name>
                <family>Gomez</family>
                <given>Sky</given>
              </name>
            </assignedPerson>
            <representedOrganization>
              <id extension="ORG-A3"/>
              <name>Clinic B</name>
              <code code="prov" displayName="Provider" codeSystem="http://terminology.hl7.org/CodeSystem/organization-type"/>
            </representedOrganization>
          </assignedAuthor>
        </author>`;
      const bundle = toR5Bundle(wrapV3([subject], [author]));
      const organization = getResource(bundle, 'Organization');

      expect(organization.name).toBe('Clinic B');
      expect(organization.type[0].coding[0].code).toBe('prov');
    });
  });

  describe('Observation', () => {
    it('maps numeric value and code', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-600',
            family: 'Doe',
            given: 'Jamie'
          })}
          <observationEvent>
            <observation>
              <code code="8867-4" codeSystem="http://loinc.org" displayName="Heart rate"/>
              <value value="72" unit="beats/min"/>
              <effectiveTime value="20240102120000"/>
            </observation>
          </observationEvent>
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const observation = getResource(bundle, 'Observation');

      expect(observation.valueQuantity.value).toBe(72);
      expect(observation.code.coding[0].code).toBe('8867-4');
    });

    it('maps method and body site', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-601',
            family: 'Doe',
            given: 'Riley'
          })}
          <observationEvent>
            <observation>
              <code code="1234-5" codeSystem="http://loinc.org" displayName="Test observation"/>
              <value value="1" unit="mg/dL"/>
              <methodCode code="MAN" displayName="Manual"/>
              <targetSiteCode code="LA" displayName="Left Arm"/>
              <effectiveTime value="20240102120000"/>
            </observation>
          </observationEvent>
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const observation = getResource(bundle, 'Observation');

      expect(observation.method.coding[0].code).toBe('MAN');
      expect(observation.bodySite.coding[0].code).toBe('LA');
    });
  });

  describe('Medication', () => {
    it('maps medication code text', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-700',
            family: 'Doe',
            given: 'Alex'
          })}
          <substanceAdministration>
            <consumable>
              <manufacturedProduct>
                <manufacturedMaterial>
                  <code code="12345" displayName="Ibuprofen"/>
                </manufacturedMaterial>
              </manufacturedProduct>
            </consumable>
          </substanceAdministration>
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const medication = getResource(bundle, 'Medication', resource => resource.code?.text === 'Ibuprofen');

      expect(medication.code.text).toBe('Ibuprofen');
      expect(medication.identifier[0].value).toBe('12345');
    });

    it('maps medication coding system and code', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-701',
            family: 'Doe',
            given: 'Casey'
          })}
          <substanceAdministration>
            <consumable>
              <manufacturedProduct>
                <manufacturedMaterial>
                  <code code="67890" displayName="Amoxicillin"/>
                </manufacturedMaterial>
              </manufacturedProduct>
            </consumable>
          </substanceAdministration>
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const medication = getResource(bundle, 'Medication', resource => resource.identifier?.[0]?.value === '67890');

      expect(medication.code.coding[0].system).toContain('rxnorm');
      expect(medication.code.coding[0].code).toBe('67890');
    });
  });

  describe('MedicationRequest', () => {
    it('maps medication reference and subject', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-800',
            family: 'Doe',
            given: 'Sam'
          })}
          <substanceAdministration>
            <consumable>
              <manufacturedProduct>
                <manufacturedMaterial>
                  <code code="24680" displayName="Metformin"/>
                </manufacturedMaterial>
              </manufacturedProduct>
            </consumable>
          </substanceAdministration>
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const medicationFullUrl = getFullUrl(bundle, 'Medication');
      const patientFullUrl = getFullUrl(bundle, 'Patient');
      const medRequest = getResource(bundle, 'MedicationRequest');

      expect(medRequest.medication.reference.reference).toBe(medicationFullUrl);
      expect(medRequest.subject.reference).toBe(patientFullUrl);
    });

    it('maps dosage instruction to doseAndRate', () => {
      const subject = `
        <subject>
          ${buildRegistrationEvent({
            patientId: 'PAT-801',
            family: 'Doe',
            given: 'Taylor'
          })}
          <substanceAdministration>
            <consumable>
              <manufacturedProduct>
                <manufacturedMaterial>
                  <code code="13579" displayName="Atorvastatin"/>
                </manufacturedMaterial>
              </manufacturedProduct>
            </consumable>
            <doseQuantity value="2" unit="tab"/>
            <routeCode code="PO" displayName="Oral"/>
            <effectiveTime value="20240103080000"/>
          </substanceAdministration>
        </subject>`;
      const bundle = toR5Bundle(wrapV3([subject]));
      const medRequest = getResource(bundle, 'MedicationRequest');

      expect(medRequest.dosageInstruction[0].doseAndRate[0].doseQuantity.value).toBe(2);
      expect(medRequest.dosageInstruction[0].route.coding[0].code).toBe('PO');
    });
  });
});
