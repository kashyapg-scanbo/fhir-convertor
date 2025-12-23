
import { convertLegacyData } from '../src/modules/pipeline/convert.pipeline.js';

async function runTests() {
    console.log('🧪 Testing New Format Converters...\n');

    // 1. FHIR R4 Test
    console.log('👉 Testing FHIR R4 Conversion...');
    const r4Patient = JSON.stringify({
        resourceType: 'Patient',
        id: 'R4-PAT-001',
        name: [{ family: 'R4Family', given: ['R4Given'] }],
        gender: 'female',
        birthDate: '1990-01-01'
    });

    try {
        const r5Bundle = await convertLegacyData(r4Patient, 'fhir-r4');
        const pat = r5Bundle.entry?.find((e: any) => e.resource.resourceType === 'Patient')?.resource;
        if (pat.name[0].family === 'R4Family') {
            console.log('✅ FHIR R4 conversion passed');
        } else {
            console.error('❌ FHIR R4 conversion failed: Name mismatch', pat);
        }
    } catch (e) {
        console.error('❌ FHIR R4 conversion error:', e);
    }

    // 2. HL7 v3 Test
    console.log('\n👉 Testing HL7 v3 Conversion...');
    const hl7v3 = `
    <PRPA_IN201305UV02 xmlns="urn:hl7-org:v3">
      <controlActProcess>
        <subject>
          <registrationEvent>
            <subject1>
              <patient>
                <id extension="V3-PAT-001"/>
                <patientPerson>
                  <name>
                    <family>V3Family</family>
                    <given>V3Given</given>
                  </name>
                  <administrativeGenderCode code="M"/>
                  <birthTime value="19800101"/>
                </patientPerson>
                <statusCode code="active"/>
              </patient>
            </subject1>
          </registrationEvent>
        </subject>
      </controlActProcess>
    </PRPA_IN201305UV02>
  `;

    try {
        const r5BundleV3 = await convertLegacyData(hl7v3, 'hl7v3');
        const patV3 = r5BundleV3.entry?.find((e: any) => e.resource.resourceType === 'Patient')?.resource;
        if (patV3.name[0].family === 'V3Family') {
            console.log('✅ HL7 v3 conversion passed');
        } else {
            console.error('❌ HL7 v3 conversion failed: Name mismatch', patV3);
        }
    } catch (e) {
        console.error('❌ HL7 v3 conversion error:', e);
    }

    // 3. Binary/Legacy Document Test
    console.log('\n👉 Testing Legacy Binary Conversion...');
    const dummyPdf = 'JVBERi0xLjQK...'; // Fake base64
    try {
        const r5BundleDoc = await convertLegacyData(dummyPdf, 'pdf');
        const docRef = r5BundleDoc.entry?.find((e: any) => e.resource.resourceType === 'DocumentReference')?.resource;
        const attachment = docRef.content[0].attachment;

        if (attachment.contentType === 'application/pdf' && attachment.data === dummyPdf) {
            console.log('✅ Binary PDF conversion passed');
        } else {
            console.error('❌ Binary PDF conversion failed:', attachment);
        }
    } catch (e) {
        console.error('❌ Binary conversion error:', e);
    }
}

runTests().catch(console.error);
