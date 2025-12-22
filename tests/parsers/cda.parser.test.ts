import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { parseCDA } from '../../src/modules/parsers/cda.parser.js';

const SAMPLE_CDA = `
<ClinicalDocument xmlns="urn:hl7-org:v3" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <id root="2.16.840.1.113883.19.5.99999.1"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <title>Example CCD</title>
  <effectiveTime value="20240101120000-0500"/>
  <recordTarget>
    <patientRole>
      <id extension="PAT-1"/>
      <addr>
        <streetAddressLine>123 Main St</streetAddressLine>
        <city>Centerville</city>
        <state>CA</state>
        <postalCode>12345</postalCode>
        <country>US</country>
      </addr>
      <telecom value="tel:+15551230000" use="HP"/>
      <patient>
        <name>
          <given>Jane</given>
          <family>Doe</family>
        </name>
        <administrativeGenderCode code="F"/>
        <birthTime value="19800101"/>
      </patient>
    </patientRole>
  </recordTarget>
  <author>
    <time value="20240101120000-0500"/>
    <assignedAuthor>
      <id extension="AUTH-1"/>
      <assignedPerson>
        <name>
          <given>Amy</given>
          <family>Clinician</family>
        </name>
      </assignedPerson>
      <representedOrganization>
        <id root="ORG-1"/>
        <name>Good Health</name>
      </representedOrganization>
    </assignedAuthor>
  </author>
  <custodian>
    <assignedCustodian>
      <representedCustodianOrganization>
        <id root="ORG-1"/>
        <name>Good Health</name>
      </representedCustodianOrganization>
    </assignedCustodian>
  </custodian>
  <componentOf>
    <encompassingEncounter>
      <id root="ENC-1"/>
      <code code="AMB"/>
      <effectiveTime value="20240101100000-0500"/>
    </encompassingEncounter>
  </componentOf>
  <component>
    <structuredBody>
      <component>
        <section>
          <code code="12345-6" codeSystem="2.16.840.1.113883.6.1"/>
          <entry>
            <observation classCode="OBS" moodCode="EVN">
              <code code="8867-4" codeSystem="2.16.840.1.113883.6.1" displayName="Heart rate"/>
              <value xsi:type="PQ" value="80" unit="/min"/>
              <effectiveTime value="20240101101500-0500"/>
            </observation>
          </entry>
        </section>
      </component>
      <component>
        <section>
          <code code="10160-0"/>
          <entry>
            <substanceAdministration classCode="SBADM" moodCode="INT">
              <id root="MEDREQ-1"/>
              <effectiveTime value="20240101120000-0500"/>
              <doseQuantity value="1" unit="tablet"/>
              <routeCode code="PO" displayName="Oral route"/>
              <consumable>
                <manufacturedProduct>
                  <manufacturedMaterial>
                    <code code="860975" codeSystem="2.16.840.1.113883.6.88" displayName="Metformin 500 MG Oral Tablet"/>
                  </manufacturedMaterial>
                </manufacturedProduct>
              </consumable>
            </substanceAdministration>
          </entry>
        </section>
      </component>
    </structuredBody>
  </component>
</ClinicalDocument>
`.trim();

describe('parseCDA', () => {
  it('builds canonical model with expected resources from CDA', () => {
    const canonical = parseCDA(SAMPLE_CDA);

    expect(canonical.patient.id).toBe('PAT-1');
    expect(canonical.encounter?.id).toBe('ENC-1');
    expect(canonical.encounter?.start).toBe('2024-01-01T10:00:00-05:00');

    expect(canonical.observations?.[0]?.code).toBe('8867-4');
    expect(canonical.observations?.[0]?.value).toBe(80);

    expect(canonical.medicationRequests?.[0]?.medicationCodeableConcept?.coding?.[0]?.code).toBe('860975');
    expect(canonical.medicationRequests?.[0]?.requester).toBe('AUTH-1');
    expect(canonical.medications?.[0]?.code?.coding?.[0]?.system).toBe('http://www.nlm.nih.gov/research/umls/rxnorm');

    expect(canonical.practitioners?.[0]?.id).toBe('AUTH-1');
    expect(canonical.practitionerRoles?.[0]?.organizationId).toBe('ORG-1');

    expect(canonical.organizations?.[0]?.id).toBe('ORG-1');

    const docRef = canonical.documentReferences?.[0];
    expect(docRef?.subject).toBe('PAT-1');
    expect(docRef?.author?.[0]).toBe('AUTH-1');
    expect(docRef?.content?.[0]?.attachment?.data).toBe(Buffer.from(SAMPLE_CDA, 'utf8').toString('base64'));
  });
});
