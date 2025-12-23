
import { convertLegacyData } from '../src/modules/pipeline/convert.pipeline.js';

async function runExpandedTests() {
    console.log('🧪 Testing Expanded Converter Coverage...\n');

    // 1. R4 Bundle with Multiple Resource Types
    console.log('👉 Testing FHIR R4 Bundle with Multiple Resources...');
    const r4Bundle = JSON.stringify({
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
            {
                resource: {
                    resourceType: 'Patient',
                    id: 'pat-001',
                    name: [{ family: 'TestFamily', given: ['TestGiven'] }],
                    gender: 'female',
                    birthDate: '1990-01-01'
                }
            },
            {
                resource: {
                    resourceType: 'Practitioner',
                    id: 'pract-001',
                    name: [{ family: 'DrSmith', given: ['John'] }],
                    qualification: [{ code: { coding: [{ system: 'http://example.org', code: 'MD', display: 'Doctor of Medicine' }] } }]
                }
            },
            {
                resource: {
                    resourceType: 'Organization',
                    id: 'org-001',
                    name: 'Test Hospital',
                    type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'prov', display: 'Healthcare Provider' }] }]
                }
            },
            {
                resource: {
                    resourceType: 'MedicationRequest',
                    id: 'medreq-001',
                    status: 'active',
                    intent: 'order',
                    medicationCodeableConcept: {
                        coding: [{ system: 'http://www.nlm.nih.gov/research/umls/rxnorm', code: '197361', display: 'Aspirin 81 MG' }]
                    },
                    subject: { reference: 'Patient/pat-001' }
                }
            },
            {
                resource: {
                    resourceType: 'DocumentReference',
                    id: 'doc-001',
                    status: 'current',
                    type: { coding: [{ system: 'http://loinc.org', code: '34133-9', display: 'Summary of episode note' }] },
                    subject: { reference: 'Patient/pat-001' },
                    content: [{ attachment: { contentType: 'application/pdf', title: 'Test Document' } }]
                }
            }
        ]
    });

    try {
        const r5Bundle = await convertLegacyData(r4Bundle, 'fhir-r4');
        const resourceTypes = r5Bundle.entry?.map((e: any) => e.resource.resourceType) || [];

        const hasPatient = resourceTypes.includes('Patient');
        const hasPractitioner = resourceTypes.includes('Practitioner');
        const hasOrganization = resourceTypes.includes('Organization');
        const hasMedicationRequest = resourceTypes.includes('MedicationRequest');
        const hasDocumentReference = resourceTypes.includes('DocumentReference');

        if (hasPatient && hasPractitioner && hasOrganization && hasMedicationRequest && hasDocumentReference) {
            console.log('✅ R4 Bundle conversion passed - All resource types present');
            console.log(`   Found: ${resourceTypes.join(', ')}`);
        } else {
            console.error('❌ R4 Bundle conversion failed - Missing resources');
            console.error(`   Found: ${resourceTypes.join(', ')}`);
        }
    } catch (e) {
        console.error('❌ R4 Bundle conversion error:', e);
    }

    // 2. HL7 v3 with Practitioner and Organization
    console.log('\n👉 Testing HL7 v3 with Practitioner and Organization...');
    const hl7v3Extended = `
    <PRPA_IN201305UV02 xmlns="urn:hl7-org:v3">
      <author>
        <assignedAuthor>
          <id extension="PRACT-001"/>
          <assignedPerson>
            <name>
              <family>DrJones</family>
              <given>Sarah</given>
            </name>
          </assignedPerson>
          <representedOrganization>
            <id extension="ORG-001"/>
            <name>City Medical Center</name>
          </representedOrganization>
        </assignedAuthor>
      </author>
      <controlActProcess>
        <subject>
          <registrationEvent>
            <subject1>
              <patient>
                <id extension="V3-PAT-002"/>
                <patientPerson>
                  <name>
                    <family>V3Extended</family>
                    <given>Test</given>
                  </name>
                  <administrativeGenderCode code="F"/>
                  <birthTime value="19850515"/>
                </patientPerson>
                <statusCode code="active"/>
              </patient>
            </subject1>
            <custodian>
              <assignedCustodian>
                <representedCustodianOrganization>
                  <id extension="CUST-001"/>
                  <name>Records Department</name>
                </representedCustodianOrganization>
              </assignedCustodian>
            </custodian>
          </registrationEvent>
        </subject>
      </controlActProcess>
    </PRPA_IN201305UV02>
  `;

    try {
        const r5BundleV3 = await convertLegacyData(hl7v3Extended, 'hl7v3');
        const resourceTypes = r5BundleV3.entry?.map((e: any) => e.resource.resourceType) || [];

        const hasPatient = resourceTypes.includes('Patient');
        const hasPractitioner = resourceTypes.includes('Practitioner');
        const hasOrganization = resourceTypes.includes('Organization');

        if (hasPatient && hasPractitioner && hasOrganization) {
            console.log('✅ HL7 v3 extended conversion passed');
            console.log(`   Found: ${resourceTypes.join(', ')}`);
        } else {
            console.error('❌ HL7 v3 extended conversion failed');
            console.error(`   Found: ${resourceTypes.join(', ')}`);
        }
    } catch (e) {
        console.error('❌ HL7 v3 extended conversion error:', e);
    }

    console.log('\n✨ Expanded coverage testing complete!');
}

runExpandedTests().catch(console.error);
