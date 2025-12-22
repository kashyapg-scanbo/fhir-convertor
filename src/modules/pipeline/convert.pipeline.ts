import { parseHL7 } from '../parsers/hl7.parser.js';
import { buildCanonical } from '../builders/canonical.builder.js';
import { parseCDA } from '../parsers/cda.parser.js';
import { parseCustomJSON } from '../parsers/json.parser.js';
import { mapCanonicalToFHIR } from '../mappers/fhir.mapper.js';
import { CanonicalModel } from '../../shared/types/canonical.types.js';

export type InputFormat = 'hl7v2' | 'cda' | 'json';

/**
 * Detect input format based on content
 */
export function detectInputFormat(input: string): InputFormat {
  const trimmed = input.trim();

  // CDA typically starts with XML declaration or <ClinicalDocument
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<ClinicalDocument') || trimmed.includes('<ClinicalDocument')) {
    return 'cda';
  }

  // JSON typically starts with { or [
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return 'json';
  }

  // HL7 v2 typically starts with MSH|
  if (trimmed.startsWith('MSH|') || trimmed.split('\n').some(line => line.trim().match(/^[A-Z]{2,4}\|/))) {
    return 'hl7v2';
  }

  // Default to HL7v2 for backward compatibility
  return 'hl7v2';
}

/**
 * Convert legacy data (HL7v2, CDA, or JSON) to FHIR Bundle
 */
export async function convertLegacyData(input: string, format?: InputFormat): Promise<any> {
  const detectedFormat = format || detectInputFormat(input);
  let canonical: CanonicalModel;

  switch (detectedFormat) {
    case 'hl7v2':
      // // Create 
            input =`MSH|^~\\&|ADT1|MCM|LABADT|MCM|198808181126|SECURITY|ADT^A01|MSG00001|P|2.2
      PID|1||PATID1234^5^M11||JONES^WILLIAM^A^III||19610615|M-||2106-3|1200 N ELM STREET^^GREENSBORO^NC^27401-1020|GL|(919)379-1212|(919)271-3434||S||PATID12345001^2^M10|123456789|987654^NC|
      PV1|1|I|2000^2012^01||||004777^LEBAUER^SIDNEY^J.|||SUR||-||1|A0-`


//       input =`MSH|^~\&|MONITOR|HOSPITAL|FHIR|CONVERTER|202512180845||ORU^R01|MSG00002|P|2.5
// PID|1||MRN123456^^^HOSPITAL||Sharma^Amit||19900510|M
// OBR|1|||8867-4^Heart rate^LN|||202512180845
// OBX|1|NM|8867-4^Heart rate^LN||78|/min|60-100|N|||F`

// input =`MSH|^~\&|EHR|HOSPITAL|PHARMACY|HOSPITAL|202512181230||RDE^O11|MSG00011|P|2.5
// PID|1||PAT67890^^^HOSPITAL^MR||PATEL^RAJ||19790210|M
// PV1|1|O|OPD^202^02||||5678^KUMAR^ANIL
// ORC|NW|ORD67890|||
// RXO|860975^Metformin 500 MG Oral Tablet^RXNORM|500|MG|TAB|PO|BID
// RXR|PO^Oral^HL70162
// RXE|1|860975^Metformin 500 MG Oral Tablet^RXNORM|500|MG|BID|||30|TAB`
      // // Update 
      //   input =`MSH|^~\&|ADT1|MCM|LABADT|MCM|202512170930||ADT^A08|MSG00002|P|2.2
      // PID|1||PATID1234^5^M11||SMITH^JOHN^B||19610615|M||2106-3|221B BAKER STREET^^LONDON^LDN^NW1 6XE|GL|(919)379-1212|(919)271-3434||S||PATID12345001^2^M10|123456789|987654^NC`

      // input =`MSH|^~\&|ADTApp|GHHSFacility^2.16.840.1.122848.1.30^ISO|EHRApp^1.Edu^ISO|GHHRFacility^2.16.840.1.1122848.1.32^ISO|198908181126+0215|SECURITY|ADT^A01^ADT_A01|MSG00001|P|2.8|||||USA||en-US|||22 GHH Inc.|23 GHH Inc.|24GHH^2.16.840.1.114884.10.20^ISO|25GHH^2.16.840.1.114884.10.23^ISO
      // SFT|Orion|2.4.3.52854|Rhapsody|2.4.3|Testactivity|20070725111624
      // EVN|A01|20290801070624+0115|20290801070724|01^Patient request^HL70062|C08^Woolfson^Kathleen^2ndname^Jr^Dr^MD^^DRNBR&1.3.6.1.4.1.44750.1.2.2&ISO^L^^^ANON|20210817151943.4+0200|Cona_Health^1.3.6.1.4.1.44750.1.4^ISO
      // PID|1|1234567^4^M11^test^MR^University Hospital^19241011^19241012|PATID1234^5^M11^test1&2.16.1&HCD^MR^GOOD HEALTH HOSPITAL~123456789^^^USSSA^SS|PATID567^^^test2|EVERYMAN&&&&Aniston^ADAM^A^III^Dr.^MD^D^^^19241012^^^^PF^Addsm~Josh&&&&Bing^^stanley^^^^L^^^^^19241010^19241015|SMITH^Angela^L|198808181126+0215|M|elbert^Son|2106-3^White^HL70005~2028-9^Asian^HL70005|1000&Hospital Lane^Ste. 123^Ann Arbor ^MI^99999^USA^M^^&W^^^20000110&20000120^^^^^^^Near Highway|GL|78788788^^CP^5555^^^1111^^^^^2222^20010110^20020110^^^^18~12121212^^CP|7777^^CP~1111^^TDD|ara^^HL70296^eng^English-us^HL70296^v2^v2.1^TextInEnglish|M^Married|AME|4000776^^^AccMgr&1.3.6.1.4.1.44750.1.2.2&ISO^VN^1^19241011^19241012|PSSN123121234|DLN-123^US^20010123|1212121^^^NTH&rt23&HCD^AND^^19241011^19241012|N^NOT HISPANIC OR LATINO^HL70189|St. Francis Community Hospital of Lower South Side|N|2|US^United States of America^ISO3166_1|Vet123^retired^ART|BT^Bhutan^ISO3166_1|20080825111630+0115|Y|||20050110015014+0315||125097000^Goat^SCT|4880003^Beagle^SCT|||CA^Canada^ISO3166_1|89898989^WPN^Internet
      // PD1|S^^ACR||LINDAS TEST ORGANIZATION^^SIISCLIENT818|88^Hippo^rold^H^V^Dr^MD^^TE^^^M10^DN^^||||||||||Methodist Church|||20150202^20150202
      // ARV|1|A|DEM|PAT|Access restricted to clinicians other than the consulting clinician|20211118103000+0215^20221118103000+0215
      // ROL|1|AD|PP^Primary Care Provider^HL70443|12377H87^Smith^John^A^III^DR^PHD^^PERSONNELt&1.23&HCD^B^^^BR^^^^^^19241010^19241015^Al|20220101000000|20220202000000|||408443003^General practice^SNOMED|2^Physician Clinic^HL70406|1234 Magnolia Lane, Ste. 231^^Houston^TX^33612^USA|^^Internet^fred@nnnn.com^111^813^8853999^1234|HUH AE OMU&9.8&ISO^OMU B^Bed 03^HOMERTON UNIVER^^C^Homerton UH^Floor5|Good Health Hospital^L^^^^CMS^XX^^A|
      // NK1|1|Evan&&&&Aniston^ADAM^A^III^Dr.^MD^D|EMC^test^ACR^CHD^^^9.0^10.0|2222&HOME&STREET^Highway^GREENSBORO^NC^27401-1020^US^BI^^jkdha&test^^^^20000110^20050111~111&Duck ST^^Fowl|78788788^WPN^Internet^5555^^^^^^^^^20010110^20020110^^^^18~121111^PRN^CP|88888888^PRN^CP^5555^^^^^^^^878777^20010110^20020110^^^^18~6666666^^BP|O|20210818|20211218|||12345567^4^M11^T1&2.16.840.1.113883.19&HCD^MR^University Hospital^19241011^19241012|TestOrg^^O12^^^^EI^^^Org12||F^^^M|19620110045504||||ara||||||||||Green^John^A^II^DR^MD^D^^^19241012^G~Josh&&&&Bing^^stanley^^^^L|898989898^^FX~88888888^^CP|Street1&Palkstreet~ST-2|I-123^^^^BA~I-222^^^^DI||2106-3^test^FDDC||Security no-23|||1515151515^WPN^CP^555544^^^^^^^^777^20010110^20020110^^^^1|444444^^CP
      // PV1|1|P|HUH AE OMU&9.8&ISO^OMU B^Bed 03^HOMERTON UNIVER^^C^Homerton UH^Floor5|E|1234567^4^M11^t&2.16.840.1.113883.19&HCD^ANON^University Hospital^19241011^19241012|4 East, room 136, bed B 4E^136^B^CommunityHospital^^N^^^|1122334^Alaz^Mohammed^Mahi^JR^Dr.^MD^^PERSONNELt&1.23&HCD^B^^^BR^^^^^^19241010^19241015^Al|C006^Woolfson^Kathleen^^^Dr^^^TEST&23.2&HCD^MSK^^^BA|C008^Condoc^leen^^^Dr^^^&1.3.6.1.4.1.44750.1.2.2&ISO^NAV^^^BR|SUR|Internal Medicine^^^UH Hospitals^^D^Briones Bone^3b^||R|NHS Provider-General (inc.A\T\E-this Hosp)||VIP^Very Important Person^L^IMP^^DCM^v1.1^v1.2^Inportant Person|37^DISNEY^WALT^^^^^^AccMgr^^^^ANC|Inpatient|40007716^^^AccMng&1.2&HCD^AM|||||||||||||||||Admitted as Inpatient^Sample^ACR|22&Homes&FDK|Vegan^Vegetarian|HOMERTON UNIVER||Active|POC^Room-2^Bed-103^^^C^Greenland|Nursing home^^^^^^Rosewood|20150208113419+0110||||||50^^^T123&1.3.6.1.4.1.44750.1.2.2&ISO^MR||Othhel^^^^^^^^testing&&HCD||EOC124^5^M11^Etest&2.16.1&HCD^MR^CommunityHospital
      // PV2|^ROOM1&2.16.840.1.113883.4.642.1.1108&ISO^BED1^FACILITY1^^^BUILDING1^FLOOR1^^^||140004^Chronic pharyngitis^SCT||||||||2|Health Checkup|12188^Hippocrates^Harold^H^IV^Dr^MD^^TE&Provider Master.Community Health and Hospitals&DNS^^^M10^DN^^|||||||||N|||2^^^3^^^V1.2^V1.3|||||||||||||C
      // ARV|1|X|LOC|PHY|No disclosure of patient location|20211118103000+0215^20221118103000+0215
      // ROL|1|AD|PP^Primary Care Provider^HL70443|12377H87^Smith^John^A^III^DR^PHD^^PERSONNELt&1.23&HCD^B^^^BR^^^^^^19241010^19241015^Al|20220101000000|20220202000000|||408443003^General practice^SNOMED|2^Physician Clinic^HL70406|1234 Magnolia Lane, Ste. 231^^Houston^TX^33612^USA|^^Internet^fred@nnnn.com^111^813^8853999^1234|HUH AE OMU&9.8&ISO^OMU B^Bed 03^HOMERTON UNIVER^^C^Homerton UH^Floor5|Good Health Hospital^L^^^^CMS^XX^^A|
      // DB1|1|PT|DB123^4^M11^t&1.3.6.1.4.1.44750.1.2.2&ISO^MR^UH^19241011^19241012|Y|20210830|20210930|
      // OBX|27|NM|8867-4^heartrate^LN||60~120|beats/min^^ISO|70-80|A^A^HL7nnnn~B^B|||S|||19990702|Org15^ID of producer^CAS|1134^Aly^Zafar^Mahendra^JR^Dr.^MD^^PERSt&1.23&HCD^B^^^BR^^^^^^19241010^19241015^Al~2234^Pauly^Berrie^Raud|OBS^This is test method^AS4|EI12.3^NI2^426d2726-51fc-89fe-a946-8596e80a80eb^GUID~^^1.3.6.1.4.1.44750.1.2.2^ISO|19990702|BU^Observation site^E5|EI21^OII||FairOaks Hspital|Research Park^Fairfax^VA^22031^USA|MD-25^Atchinson^Christopher^^MD|||||||PAI-1^FAI-1
      // AL1|1|EA|P^PENICILLIN^ICDO|MI|CODE16|20210824
      // DG1|1|I9|422504002^Ischemic stroke(disorder)^SCT|Stroke|20040125114025+0420|A|||||||||1|005454^DIAG^ROBIN^B|||20200501133015+0215|DI20^Diagnosis^1.3.6.1.4.1.44750.1.2.2^CLIP|A|^^1.3.6.1.4.1.44750.1.2.2^CLIP
      // PR1|1||76164006^Biopsy of colon (procedure)^SCT|Biopsy of colon, which was part of colonoscopy|200501251140+0100|D^Diagnostic Procedure^HL70230|2|1210^ANES^MARK^B|||121188^Patrick^Harold^H^IV^Dr^MD^^&Provider Master.Community Health and Hospitals&L^L^9^M10^DN^&Good Health Hospital.Community Health and Hospitals&L^A|12345689^Everyman2^Adam2^A^III^DR^PHD^ADT01^^L^4^M11^MR|||799008^Sigmoid colon ulcer^SCT||||PR1006||||OT^201||PR1001
      // ROL|1|AD|PP^Primary Care Provider^HL70443|121^Phoeb^Harold^H|20220101000000|20220202000000|||408443003^General practice^SNOMED|2^Physician Clinic^HL70406||^^Internet^Pheob@nnnn.com^|InternalMedicine^^^UniversityHospitals^^C^Briones^3^|L Multispeciality Hospital^L^^^^CMS^XX^^A|
      // GT1|1|1516^4^M11^test^MR^Unity Hospital^19241011^19241012|RADIANT^LUCY^^|Rebecca^Jonas|1619 SOUTH UNIVERSITY^^MADISON^WI^53703^US|6082517777^^Internet^8484~717171^^PH|021212^^MD|20010412|M|P/F|SEL|G-SSN-12|20010410|20010415|2|EHS GENERIC EMPLOYER|1979 MILKY WAY^^VERONA^WI^53593^US|082719000^^PH|55121^^^^FI|3||N|SLF|20080825111630+0115|Y||||1231^^^^BC|M|20091010|20101010||||ger||||||MothersMaiden|BT^Bhutan^ISO3166_1||Ben^Charles~Ben2|000352^^CP~00121^^FX|Urgent requirement||||GEOrg|||||Germany
      // IN1|1|BAV^Blue Advantage HMO|IC-1.31^24^BCV^&2.16.840.1.113883.1.1&ISO^NIIP^^19291011^19291012|Blue Cross Blue Shield of Texas|1979 MILKY WAY^^VERONA^WI^53593^US|Henry&&&&Roth^Rony^A^III^Dr.^MD^D^^^19251012|(555)555-5555^BPN^PH|PUBSUMB|SelfPay||Sam P. Hil|19891001|20501001||HMO^health maintenance organization policy|Doe^Rosallie^John^III^Mrs.^Bachelors^R|SPO^Spouse|19750228|3857 Velvet Treasure Terrace^^Midnight^NC^27878^US|||||||||||||||||PN-145|150&USD^DC||||||F^Female|2000 MILKY WAY^^VERONA^WI^53593^US|||B||HMO-12345^^^&2.16.840.1.113883.1.3&ISO^NI
      // IN2|1117^4^M11^&2.16.840.1.113883.1.4&ISO^EI^University Hospital~1118^^^^BC|425-57-9745|||I^Insurance company|Medicare-12345|Jack&&&&Aniston^ADAM^A^III^Dr.^MD^D^^^19241012^^^^PF^Addsm|MCN-008||MI-12345||||||||||||||||||||||||eng^English|||||||||||||||Richard^Paul|254622222^^PH|||||||||||PNM1234^4^M11^PM&2.6.1&HCD^MR^University Hospital^19241011^19241012||0005245^WPN^Internet~^^CP|555777888^^FX~^^PH||||||Max Life Insurance||02^Spouse
      // RF1|P^Pending^HL7283|A^ASAP^HL7280|EXTERNAL|||123-1^name|||19900501120100+0515|R-1^Reason^C4|123-2^Testname|||Patient has a spinal fracture|||||AuthProvider^L^4.4^3^M10^CMS^LR^^^A|114^Beverly^Crusher^An^Mr^Dr.^AHP^^2.3^B^^^BR^^^^^^19241010^19241015^Al||||Check for metastatic disease|U
      // ACC|20140317||Route 50 intersection||Y|N|10535^Goldbergn&van^Ludwig^A^III^Dr^PHD^^&MPI.Community Health and Hospitals&L^L^3^M10^MR^& Good Health Hospital.Community Health and Hospitals&L^A|vehicle acident||Y|Route 50&Fairfax^VA^^^20324||5348
      // PDA|I21^Acute myocardial infarction^I10|ICCU^Room1^Bed25^GHH|Y|20211102123000+0115|005454^DeathCert^Robin^B|Y|20211102103000+0115^20211102113000+0115|002324^Autopsy^John^K|N`


      // input = `MSH|^~\\&|ADT1|MCM|LABADT|MCM|198808181126|SECURITY|ADT^A01|MSG00001|P|2.2
      //   OBX|5|NM|2823-3^Potassium^LN||4.2|mmol/L|3.5-5.1|N|||F|||20250101100000`
      const parsed = parseHL7(input);
      canonical = buildCanonical(parsed);
      break;

    case 'cda':
      canonical = parseCDA(input);
      break;

    case 'json':
      canonical = parseCustomJSON(input);
      break;

    default:
      throw new Error(`Unsupported input format: ${detectedFormat}`);
  }

  return mapCanonicalToFHIR(canonical);
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use convertLegacyData instead
 */
export async function convertHL7(input: string) {
  return convertLegacyData(input, 'hl7v2');
}
