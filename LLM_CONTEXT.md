# LLM Context — Scanbo Matrix FHIR Converter

> **Read this file first.** It contains everything an LLM needs to understand, navigate, modify, and extend this codebase.

---

## 1 · What This Project Is

A **Node.js / TypeScript REST API** that converts healthcare data from **any legacy format** into **FHIR R5 Bundles**.

- **Input**: HL7 v2, HL7 v3, CDA (XML), custom JSON, CSV, Excel (XLSX/XLS), FHIR R4, binary files, and wearable-device JSON (Whoop, Dexcom, Apple HealthKit, Android Health Connect, Oura, Strava).
- **Output**: A single FHIR R5 `Bundle` (JSON) containing properly linked resources.
- **Runtime**: Node ≥ 20, ESM modules, Express on port `4000`.

One-liner summary:

```
Legacy healthcare data  →  auto-detect format  →  parse  →  CanonicalModel  →  map  →  FHIR R5 Bundle
```

---

## 2 · High-Level Architecture

```
                              ┌──────────────────┐
                              │   Express API     │
                              │   src/index.ts    │
                              └────────┬─────────┘
                                       │  calls
                              ┌────────▼─────────┐
                              │  Pipeline         │
                              │  convert.pipeline │
                              │  .ts              │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                   │
             ┌──────▼──────┐   ┌──────▼──────┐    ┌──────▼──────┐
             │  Parsers     │   │  Builder    │    │  Device     │
             │  (8 files)   │   │  (HL7v2     │    │  Parsers    │
             │              │   │   only)     │    │  (6 files)  │
             └──────┬──────┘   └──────┬──────┘    └──────┬──────┘
                    │                 │                   │
                    └─────────────────┼───────────────────┘
                                      │  all produce
                             ┌────────▼─────────┐
                             │  CanonicalModel   │  ← THE hub type
                             │  (canonical.types │
                             │   .ts, 80+ ifaces)│
                             └────────┬─────────┘
                                      │  consumed by
                             ┌────────▼─────────┐
                             │  FHIR Mapper      │
                             │  fhir.mapper.ts   │
                             │  + 78 resource    │
                             │    mappers        │
                             └────────┬─────────┘
                                      │
                             ┌────────▼─────────┐
                             │  FHIR R5 Bundle   │
                             │  (JSON output)    │
                             └──────────────────┘
```

### Key principle

Every parser outputs `CanonicalModel`. Every mapper consumes `CanonicalModel`. Adding a new input format = write one new parser. Adding a new FHIR resource = add one canonical type + one mapper + one template.

---

## 3 · Directory Map (every important path)

```
src/
├── index.ts                                   # Express server + 4 API endpoints
│
├── modules/
│   ├── pipeline/
│   │   └── convert.pipeline.ts                # detectInputFormat() + convertLegacyData() — the main orchestrator
│   │
│   ├── parsers/                               # One parser per input format → CanonicalModel
│   │   ├── hl7.parser.ts                      #   HL7 v2 pipe-delimited → raw segments object
│   │   ├── cda.parser.ts                      #   CDA XML → CanonicalModel  (3 833 lines)
│   │   ├── json.parser.ts                     #   Custom JSON → CanonicalModel (14 187 lines, Zod schemas)
│   │   ├── r4.parser.ts                       #   FHIR R4 Bundle → CanonicalModel (5 312 lines)
│   │   ├── hl7v3.parser.ts                    #   HL7 v3 XML → CanonicalModel (3 057 lines)
│   │   ├── csv.parser.ts                      #   CSV text → CanonicalModel (delegates to tabular.utils)
│   │   ├── excel.parser.ts                    #   XLSX/XLS base64 → CanonicalModel (delegates to tabular.utils)
│   │   ├── binary.parser.ts                   #   Any binary file → DocumentReference wrapper
│   │   └── tabular.utils.ts                   #   Shared row→Canonical logic for CSV/Excel (large)
│   │
│   ├── builders/
│   │   └── canonical.builder.ts               # HL7v2-specific: raw segments → CanonicalModel (2 764 lines)
│   │
│   ├── mappers/                               # CanonicalModel → FHIR R5 Bundle entries
│   │   ├── fhir.mapper.ts                     #   Master orchestrator — calls all 78 resource mappers
│   │   ├── patient.mapper.ts                  #   CanonicalPatient → FHIR Patient entry
│   │   ├── observation.mapper.ts              #   CanonicalObservation[] → FHIR Observation entries
│   │   ├── encounter.mapper.ts                #   CanonicalEncounter → FHIR Encounter entry
│   │   ├── [74 more *.mapper.ts files]        #   One per FHIR resource type (see §5 for full list)
│   │   ├── fullUrlRegistry.ts                 #   Tracks urn:uuid: URLs for cross-resource references
│   │   ├── utils.ts                           #   cleanResource(), makeNarrative(), toFhirDate(), mapAbnormalFlag()
│   │   └── documentType.mapper.ts             #   Resolves document format → FHIR contentType
│   │
│   └── ai/
│       └── ollama.canonical.ts                # Experimental: LLM-based parsing via local Ollama
│
├── shared/
│   ├── header-aliases.ts                      # 1 571 lines of field-name aliases (enables flexible CSV/JSON/Excel headers)
│   ├── types/
│   │   ├── canonical.types.ts                 # ~6 433 lines — 80+ interfaces (CanonicalModel is defined here)
│   │   ├── documentTypes.mapping.ts           # 150+ legacy format → FHIR MIME-type mappings
│   │   └── hl7.types.ts                       # HL7 v2 message type (segments/fields/components)
│   └── templates/                             # 76 bare-bones JSON skeletons (one per FHIR resource)
│       ├── patient.json
│       ├── observation.json
│       └── ... (74 more)
│
└── device/                                    # Wearable / health-device data
    ├── index.ts                               # Barrel re-export
    ├── parsers/
    │   ├── whoop.parser.ts                    # Whoop band JSON → CanonicalModel
    │   ├── dexcom.parser.ts                   # Dexcom CGM JSON → CanonicalModel
    │   ├── apple_healthkit.parser.ts          # Apple HealthKit export → CanonicalModel
    │   ├── android_health_connect.parser.ts   # Android Health Connect → CanonicalModel
    │   ├── oura.parser.ts                     # Oura Ring → CanonicalModel
    │   └── strava.parser.ts                   # Strava activities → CanonicalModel
    ├── types/                                 # TypeScript interfaces per device
    └── examples/                              # Sample device payloads

tests/
├── mappers/   (4 test files)
└── parsers/   (4 test files)

scripts/
├── test-converter.mjs          # E2E convert + validate
├── validate-r5.mjs             # Local FHIR R5 validation
├── validate-r5-remote.mjs      # Remote FHIR R5 validation
├── run-regression.ts           # Generate regression baselines
└── compare-regression.ts       # Diff current vs baseline

docs/
├── openapi.yaml                # Full OpenAPI 3 spec (~177 KB)
├── UNIFIED_MAPPER_GUIDE.md
├── DOCUMENT_TYPES_REFERENCE.md
├── TESTING_GUIDE.md
└── ...

exmaple/                        # (typo is intentional, folder exists) — sample input files
postman/                        # Postman collection
```

---

## 4 · API Endpoints

| Method | Path | Content-Type | Purpose |
|--------|------|-------------|---------|
| `POST` | `/convert` | `application/json` or `text/xml` or `text/plain` | Main converter. Body: `{ input, format?, fhirVersion? }` or raw text |
| `POST` | `/convert/upload` | `multipart/form-data` | File upload (CSV, XLSX, HL7, XML…). Field: `file` |
| `POST` | `/convert/hl7` | `application/json` or `text/plain` | HL7 v2/v3 shortcut |
| `POST` | `/convert/deviceData` | `application/json` | Wearable device JSON. Accepts `{ data, deviceType? }` or direct device object |
| `GET`  | `/docs` | — | Swagger UI |
| `GET`  | `/docs.json` | — | OpenAPI spec as JSON |

**Common query/body params:**
- `format`: `hl7v2 | cda | json | fhir-r4 | hl7v3 | csv | xlsx | xls | whoop | dexcom | apple-health-kit | android-health-connect | oura | strava`
- `fhirVersion`: `r5` (default) or `r6` (not yet implemented)

---

## 5 · Conversion Pipeline — Step by Step

### Step 1: `detectInputFormat(input)` → `InputFormat`

Located in `src/modules/pipeline/convert.pipeline.ts`. Detection logic:

| Check (in priority order) | Result |
|---------------------------|--------|
| Contains `<ClinicalDocument>` | `cda` |
| Contains `"resourceType"` | `fhir-r4` |
| Starts with `{` or `[` → parse JSON → device-field heuristics | `whoop`, `dexcom`, `apple-health-kit`, `android-health-connect`, `oura`, `strava`, or `json` |
| Has commas + newlines, no XML/HL7 markers | `csv` |
| XML with `urn:hl7-org:v3` or PRPA-style root | `hl7v3` |
| Starts with `MSH\|` or has pipe-delimited segment lines | `hl7v2` |
| Fallback | `hl7v2` |

### Step 2: Parse → `CanonicalModel`

```typescript
switch (detectedFormat) {
  case 'hl7v2':  canonical = buildCanonical(parseHL7(input)); break;
  case 'cda':    canonical = parseCDA(input);                 break;
  case 'json':   canonical = parseCustomJSON(input);          break;
  case 'fhir-r4':canonical = parseR4(input);                  break;
  case 'hl7v3':  canonical = parseHL7v3(input);               break;
  case 'csv':    canonical = parseCsv(input);                 break;
  case 'xlsx':   canonical = parseExcel(input);               break;
  case 'whoop':  canonical = parseWhoop(input);               break;
  // ... other device parsers
  default:       canonical = parseBinary(input, format);      break;
}
```

**Note**: HL7 v2 is the only format that uses a two-step process (parse → build). All other parsers output `CanonicalModel` directly.

### Step 3: `mapCanonicalToFHIR(canonical, version)` → FHIR Bundle

Located in `src/modules/mappers/fhir.mapper.ts`.

1. Creates empty Bundle (`type: 'collection'` or `'transaction'`)
2. Initialises `FullUrlRegistry` (reference tracker)
3. Calls mappers **in dependency order** (Patient first → then Practitioner → Organization → Encounter → Observations → etc.)
4. Each mapper returns `{ resource, fullUrl, request? }` entries
5. Attaches `sourcePayloads` as FHIR extensions if present
6. Runs `cleanResource()` on every entry (removes nulls, empty strings, empty arrays/objects)
7. Filters out resources that have only `resourceType` + `id` and nothing else
8. Returns the complete Bundle

---

## 6 · The Canonical Model (`CanonicalModel`)

**File**: `src/shared/types/canonical.types.ts` (~6 433 lines)

This is the **single most important type** in the system. Every parser produces it; every mapper consumes it.

### Top-level shape (simplified):

```typescript
interface CanonicalModel {
  messageType?: string;              // e.g. 'ADT^A01', 'ORU^R01', 'CDA-DOCUMENT', ...
  operation?: 'create' | 'update' | 'delete';

  // Required
  patient: CanonicalPatient;

  // Optional resource arrays
  encounter?: CanonicalEncounter;
  observations?: CanonicalObservation[];
  practitioners?: CanonicalPractitioner[];
  practitionerRoles?: CanonicalPractitionerRole[];
  organizations?: CanonicalOrganization[];
  medications?: CanonicalMedication[];
  medicationRequests?: CanonicalMedicationRequest[];
  medicationStatements?: CanonicalMedicationStatement[];
  medicationAdministrations?: CanonicalMedicationAdministration[];
  medicationDispenses?: CanonicalMedicationDispense[];
  medicationKnowledges?: CanonicalMedicationKnowledge[];
  conditions?: CanonicalCondition[];
  procedures?: CanonicalProcedure[];
  appointments?: CanonicalAppointment[];
  appointmentResponses?: CanonicalAppointmentResponse[];
  claims?: CanonicalClaim[];
  claimResponses?: CanonicalClaimResponse[];
  explanationOfBenefits?: CanonicalExplanationOfBenefit[];
  coverages?: CanonicalCoverage[];
  accounts?: CanonicalAccount[];
  chargeItems?: CanonicalChargeItem[];
  chargeItemDefinitions?: CanonicalChargeItemDefinition[];
  compositions?: CanonicalComposition[];
  devices?: CanonicalDevice[];
  deviceMetrics?: CanonicalDeviceMetric[];
  deviceRequests?: CanonicalDeviceRequest[];
  deviceUsages?: CanonicalDeviceUsage[];
  deviceDispenses?: CanonicalDeviceDispense[];
  diagnosticReports?: CanonicalDiagnosticReport[];
  documentReferences?: CanonicalDocumentReference[];
  binaries?: CanonicalBinary[];
  encounterHistories?: CanonicalEncounterHistory[];
  flags?: CanonicalFlag[];
  lists?: CanonicalList[];
  groups?: CanonicalGroup[];
  healthcareServices?: CanonicalHealthcareService[];
  insurancePlans?: CanonicalInsurancePlan[];
  nutritionIntakes?: CanonicalNutritionIntake[];
  nutritionOrders?: CanonicalNutritionOrder[];
  riskAssessments?: CanonicalRiskAssessment[];
  endpoints?: CanonicalEndpoint[];
  episodesOfCare?: CanonicalEpisodeOfCare[];
  locations?: CanonicalLocation[];
  persons?: CanonicalPerson[];
  relatedPersons?: CanonicalRelatedPerson[];
  schedules?: CanonicalSchedule[];
  slots?: CanonicalSlot[];
  specimens?: CanonicalSpecimen[];
  substances?: CanonicalSubstance[];
  imagingStudies?: CanonicalImagingStudy[];
  allergyIntolerances?: CanonicalAllergyIntolerance[];
  immunizations?: CanonicalImmunization[];
  organizationAffiliations?: CanonicalOrganizationAffiliation[];
  verificationResults?: CanonicalVerificationResult[];
  capabilityStatements?: CanonicalCapabilityStatement[];
  operationOutcomes?: CanonicalOperationOutcome[];
  parameters?: CanonicalParameters[];
  carePlans?: CanonicalCarePlan[];
  careTeams?: CanonicalCareTeam[];
  goals?: CanonicalGoal[];
  serviceRequests?: CanonicalServiceRequest[];
  tasks?: CanonicalTask[];
  communications?: CanonicalCommunication[];
  communicationRequests?: CanonicalCommunicationRequest[];
  questionnaires?: CanonicalQuestionnaire[];
  questionnaireResponses?: CanonicalQuestionnaireResponse[];
  codeSystems?: CanonicalCodeSystem[];
  valueSets?: CanonicalValueSet[];
  conceptMaps?: CanonicalConceptMap[];
  namingSystems?: CanonicalNamingSystem[];
  terminologyCapabilities?: CanonicalTerminologyCapabilities[];
  provenances?: CanonicalProvenance[];
  auditEvents?: CanonicalAuditEvent[];
  consents?: CanonicalConsent[];

  sourcePayloads?: Record<string, any>;  // Attached as FHIR extensions in output
}
```

### Common sub-interface pattern:

```typescript
interface CanonicalPatient {
  id?: string;
  identifier?: string;
  name: { family?: string; given?: string[] };
  gender?: string;
  birthDate?: string;
  address?: Array<{ line?: string[]; city?: string; state?: string; postalCode?: string; country?: string; use?: string }>;
  telecom?: Array<{ system: 'phone' | 'email' | 'fax' | 'url' | 'other'; value: string; use?: string }>;
  active?: boolean;
}

interface CanonicalObservation {
  code?: string;
  codeSystem?: string;
  codeDisplay?: string;
  value?: string;
  valueNumeric?: number;
  unit?: string;
  date?: string;
  status?: string;
  category?: string;
  referenceRange?: { low?: string; high?: string; text?: string };
  interpretation?: string;
  abnormalFlag?: string;
  // ... more fields
}
```

---

## 7 · Resource Mapper Pattern

All 78 mapper files in `src/modules/mappers/` follow this **exact** pattern:

```typescript
// 1. Import template + types + utilities
import template from '../../shared/templates/<resource>.json' with { type: 'json' };
import type { Canonical<Resource> } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { cleanResource, makeNarrative, toFhirDate } from './utils.js';

// 2. Define args interface
interface MapperArgs {
  <resources>?: Canonical<Resource>[];       // Array of canonical items
  operation?: OperationType;                 // create | update | delete
  registry: FullUrlRegistry;                 // For registering references
  resolveRef: (type: string, id?: string) => string | undefined;  // For resolving references
  patientFullUrl?: string;                   // Pre-resolved patient reference
  encounterFullUrl?: string;                 // Pre-resolved encounter reference
}

// 3. Export mapper function
export function map<Resources>(args: MapperArgs): any[] {
  if (!args.<resources>?.length) return [];

  return args.<resources>.map(item => {
    // a. Clone the JSON template
    const resource = structuredClone(template) as any;

    // b. Set UUID
    resource.id = crypto.randomUUID();

    // c. Populate fields from canonical data
    resource.status = item.status || 'unknown';
    resource.subject = args.patientFullUrl ? { reference: args.patientFullUrl } : undefined;
    resource.encounter = args.encounterFullUrl ? { reference: args.encounterFullUrl } : undefined;
    // ... more field mappings

    // d. Generate narrative
    resource.text = makeNarrative('ResourceType', summary);

    // e. Register in FullUrlRegistry for cross-references
    const fullUrl = `urn:uuid:${resource.id}`;
    args.registry.register('ResourceType', { identifier: item.id, id: resource.id }, fullUrl);

    // f. Build entry
    const entry: any = { resource, fullUrl };
    if (args.operation) {
      entry.request = { method: 'PUT', url: `ResourceType/${resource.id}` };
    }

    return entry;
  });
}
```

### Full list of the 78 resource mapper files:

`account`, `allergyIntolerance`, `appointment`, `appointmentResponse`, `auditEvent`, `binary`, `capabilityStatement`, `carePlan`, `careTeam`, `chargeItem`, `chargeItemDefinition`, `claim`, `claimResponse`, `codeSystem`, `communication`, `communicationRequest`, `composition`, `conceptMap`, `condition`, `consent`, `coverage`, `device`, `deviceDispense`, `deviceMetric`, `deviceRequest`, `deviceUsage`, `diagnosticReport`, `documentReference`, `documentType`, `encounter`, `encounterHistory`, `endpoint`, `episodeOfCare`, `explanationOfBenefit`, `fhir` (orchestrator), `flag`, `goal`, `group`, `healthcareService`, `imagingStudy`, `immunization`, `insurancePlan`, `list`, `location`, `medication`, `medicationAdministration`, `medicationDispense`, `medicationKnowledge`, `medicationRequest`, `medicationStatement`, `namingSystem`, `nutritionIntake`, `nutritionOrder`, `observation`, `operationOutcome`, `organization`, `organizationAffiliation`, `parameters`, `patient`, `person`, `practitioner`, `practitionerRole`, `procedure`, `provenance`, `questionnaire`, `questionnaireResponse`, `relatedPerson`, `riskAssessment`, `schedule`, `serviceRequest`, `slot`, `specimen`, `substance`, `task`, `terminologyCapabilities`, `valueSet`, `verificationResult`

---

## 8 · Cross-Resource Reference System

**Problem**: In a FHIR Bundle, resources reference each other (e.g., `Observation.subject` → `Patient`). UUIDs are generated at mapping time, so references must be resolved dynamically.

**Solution**: `FullUrlRegistry` (`src/modules/mappers/fullUrlRegistry.ts`)

```typescript
class FullUrlRegistry {
  register(resourceType, { identifier, id, additionalKeys }, fullUrl): void;
  resolve(resourceType, idOrIdentifier): string | undefined;
}
```

- When a mapper creates a resource, it **registers** its identifier → `urn:uuid:xxx`
- When another mapper needs a reference, it calls `resolveRef(resourceType, id)` which looks up the registry
- Supports lookup by both identifier and resource ID
- The `resolveRef` helper in `fhir.mapper.ts` also handles stripping `ResourceType/` prefixes

**Mapper call order in `fhir.mapper.ts` matters** — Patient and Practitioner are mapped first so their fullUrls are available for downstream resources.

---

## 9 · Parser Details

### 9.1 HL7 v2 (`hl7.parser.ts` → `canonical.builder.ts`)

**Two-step:**
1. `parseHL7(input)` → `HL7Message` — splits pipe-delimited text into segments/fields/repetitions/components
2. `buildCanonical(parsed)` → `CanonicalModel` — interprets HL7 segments:

| Segment | Maps to |
|---------|---------|
| MSH | messageType, operation |
| PID | patient (name, DOB, gender, address, telecom) |
| PV1 | encounter (class, location, start/end, participants) |
| OBR | diagnostic report context |
| OBX | observations, document references, binaries |
| AL1 | allergy intolerances |
| DG1 | conditions/diagnoses |
| RXA/RXE | medications, immunizations |
| IN1 | coverages |
| NK1 | related persons |
| ... | and many more |

### 9.2 CDA (`cda.parser.ts`)

Uses `fast-xml-parser` to parse XML. Extracts from CDA sections:
- `recordTarget` → Patient
- `componentOf/encompassingEncounter` → Encounter
- Section entries → Observations, Medications, Procedures, Conditions, Immunizations, etc.
- Has 110+ helper functions for extraction

### 9.3 JSON (`json.parser.ts`)

The largest parser (14 187 lines). Uses **Zod schemas** for validation.
- Defines schemas for every resource type
- Uses `header-aliases.ts` to normalize field names (so `"patient_first_name"`, `"patientFirstName"`, `"first_name"`, `"firstName"` all resolve to the same canonical field)
- Supports both flat records and deeply nested structures
- The `HEADER_ALIAS_SECTIONS` object in `header-aliases.ts` groups aliases by domain (patient, encounter, observation, medication, etc.)

### 9.4 FHIR R4 (`r4.parser.ts`)

Parses an existing FHIR R4 Bundle and maps each R4 resource to its canonical equivalent. This enables **R4 → R5 migration**.

### 9.5 CSV / Excel (`csv.parser.ts`, `excel.parser.ts`, `tabular.utils.ts`)

- CSV: parses lines (handles quoted fields)
- Excel: uses `xlsx` library to read spreadsheets
- Both delegate to `tabular.utils.ts` which uses `header-aliases.ts` to normalize column headers and map rows to `CanonicalModel`

### 9.6 Device Parsers

Each device parser lives in `src/device/parsers/` and understands the specific JSON schema of that device's API response:

| Device | Key Input Fields | Primary FHIR Resources Generated |
|--------|-----------------|----------------------------------|
| Whoop | `profile`, `recovery.score`, `cycle.score`, `sleep.score` | Observations (HR, HRV, sleep stages, recovery score, strain) |
| Dexcom | `egvs`, `calibrations`, `device` | Observations (blood glucose readings) |
| Apple HealthKit | `heart.data`, `sleep.data`, `activity.data`, … | Observations (multi-category health metrics) |
| Android Health Connect | `Steps`, `Distance`, `Exercise`, `Blood Glucose`, … | Observations (activity, vitals, glucose) |
| Oura | `Daily Activity`, `Sleep Detailed`, `Heart Rate`, … | Observations (sleep, activity, readiness, HR) |
| Strava | `profile`, `activities[]` | Observations (exercise, distance, elevation, power) |

---

## 10 · Header Alias System

**File**: `src/shared/header-aliases.ts` (1 571 lines)

This is what makes the JSON/CSV/Excel parser **robust to naming variations**. It maps hundreds of possible column/field names to a canonical key.

**Example**: the canonical key `patient_first_name` can be matched by any of:

```
patient_first_name, patientFirstName, first_name, firstName, given_name, 
givenName, patient_given_name, forename, nombre, prenom, vorname, ...
```

**Structure**:
```typescript
export const HEADER_ALIAS_SECTIONS = {
  patient: {
    patient_id: ['patient_id', 'patientId', 'pid', 'patient_identifier', ...],
    patient_first_name: ['first_name', 'firstName', 'given_name', ...],
    // ...
  },
  encounter: { /* ... */ },
  observation: { /* ... */ },
  medication: { /* ... */ },
  // ... more sections
};
```

The JSON parser builds reverse-lookup maps from these aliases for O(1) field resolution.

---

## 11 · FHIR Resource Templates

**Directory**: `src/shared/templates/` (76 JSON files)

Each file is a **bare-bones skeleton** of a FHIR R5 resource with all possible fields set to empty defaults (`""`, `[]`, `{}`, `false`, `0`).

**Purpose**: Mappers `structuredClone()` these templates, populate the relevant fields, and the final `cleanResource()` pass removes all the empty defaults.

**Example** (`patient.json`):
```json
{
  "resourceType": "Patient",
  "identifier": [],
  "active": false,
  "name": [],
  "telecom": [],
  "gender": "",
  "birthDate": "",
  "address": [],
  "maritalStatus": {},
  "contact": [{ "relationship": [], "name": {}, "telecom": [], ... }],
  "communication": [{ "language": {}, "preferred": false }],
  ...
}
```

---

## 12 · Utility Functions

### `cleanResource(obj)` — `src/modules/mappers/utils.ts`
Recursively removes `undefined`, `null`, empty strings (after trim), empty arrays, and empty objects from any value. This ensures FHIR output is clean.

### `makeNarrative(resourceType, summary)` — same file
Generates FHIR `text` (narrative) field:
```json
{ "status": "generated", "div": "<div xmlns='http://www.w3.org/1999/xhtml'><p>Patient: John Doe</p></div>" }
```

### `toFhirDate(value)` — same file
Normalizes date strings. Converts `YYYY-MM-DDTHH:mm:ss` to `YYYY-MM-DD` for date-only FHIR fields.

### `mapAbnormalFlag(flag)` — same file
Maps HL7 abnormal flags (`L` → `Low`, `H` → `High`, `HH` → `Critical High`, etc.)

---

## 13 · Document Type Mapping

**File**: `src/shared/types/documentTypes.mapping.ts`

Contains 150+ entries mapping legacy format identifiers to FHIR MIME types.

```typescript
interface DocumentTypeMapping {
  legacy: string;           // e.g. 'pdf', 'dicom', 'jpg'
  fhirContentType: string;  // e.g. 'application/pdf', 'application/dicom', 'image/jpeg'
  description: string;
  category: string;         // 'document' | 'medical-imaging' | 'image' | 'video' | 'audio' | ...
}
```

**Exported functions**:
- `getFhirContentType(format)` → `string | undefined`
- `isLegacyTypeSupported(format)` → `boolean`

**Categories**: document, medical-imaging, image, video, audio, structured-data, archive, presentation, medical-data, genomics

---

## 14 · Testing

| Command | What it does |
|---------|-------------|
| `npm test` | Runs Vitest unit tests (`tests/`) |
| `npm run test:convert` | Full E2E conversion test |
| `npm run test:example:hl7` | Run HL7v2 examples with R5 validation |
| `npm run test:example:json` | Run JSON examples with R5 validation |
| `npm run test:example:cda` | Run CDA examples with R5 validation |
| `npm run regression` | Generate current output + compare with baseline |

**Test files**:
- `tests/mappers/mappers.test.ts` — general mapper tests
- `tests/mappers/documentType.mapper.test.ts` — document type resolution
- `tests/parsers/cda.parser.test.ts` — CDA parsing
- `tests/parsers/json.parser.test.ts` — JSON parsing
- `tests/parsers/hl7v3-to-r5.integration.test.ts` — HL7v3 end-to-end
- `tests/parsers/r4-to-r5.integration.test.ts` — R4 → R5 end-to-end

---

## 15 · NPM Scripts & Development

```bash
npm run dev          # Hot-reload dev server (tsx watch)
npm run build        # TypeScript → dist/
npm run start        # Run compiled dist/index.js
npm run test         # Vitest unit tests
```

**Key dependencies**:

| Package | Purpose |
|---------|---------|
| `express` | HTTP API |
| `multer` | File upload |
| `fast-xml-parser` | XML parsing (CDA, HL7v3) |
| `zod` | JSON schema validation |
| `xlsx` | Excel file parsing |
| `swagger-ui-express` | API docs |
| `yaml` | OpenAPI spec parsing |
| `node-fetch` | HTTP (Ollama AI) |

---

## 16 · Common Modification Scenarios

### Adding a new input format
1. Create `src/modules/parsers/<format>.parser.ts`
2. Export a function that takes `string` input and returns `CanonicalModel`
3. Add the format to `InputFormat` type in `convert.pipeline.ts`
4. Add a `case` in the `switch` block of `convertLegacyData()`
5. Add detection logic to `detectInputFormat()` if auto-detection is desired

### Adding a new FHIR resource type
1. Add `Canonical<Resource>` interface to `canonical.types.ts`
2. Add `<resources>?: Canonical<Resource>[]` to `CanonicalModel`
3. Create `src/shared/templates/<resource>.json` with skeleton
4. Create `src/modules/mappers/<resource>.mapper.ts` following the standard pattern
5. Import and call the mapper in `fhir.mapper.ts`
6. Update relevant parsers to populate the new canonical field

### Adding a new device
1. Create type definition in `src/device/types/<device>.types.ts`
2. Create parser in `src/device/parsers/<device>.parser.ts` → returns `CanonicalModel`
3. Export from `src/device/parsers/index.ts` and `src/device/index.ts`
4. Import in `convert.pipeline.ts`, add switch case
5. Add detection heuristics in `detectInputFormat()` and the `/convert/deviceData` endpoint

### Modifying a mapper
- Open `src/modules/mappers/<resource>.mapper.ts`
- The canonical → FHIR field mapping is explicit (no magic)
- Template fields not populated will be cleaned up automatically

---

## 17 · Key Conventions

1. **All file imports use `.js` extension** (ESM requirement, even though source is `.ts`)
2. **JSON templates imported** with `with { type: 'json' }` (ESM JSON import assertion)
3. **IDs are always `crypto.randomUUID()`** — never reuse input IDs as resource IDs
4. **`urn:uuid:<id>`** pattern for all fullUrl values in Bundle entries
5. **`structuredClone()`** used on templates to avoid mutation
6. **Mapper call order** in `fhir.mapper.ts` is intentional — dependencies must be registered before dependents
7. **`cleanResource()`** is the final safety net — don't worry about setting fields to `undefined`, it gets cleaned
8. **Field name aliases** resolve at parse time, not map time
9. **Error handling**: parsers throw `Error` with descriptive messages; Express catches and returns 400

---

## 18 · Type Definitions Quick Reference

```typescript
// HL7 v2 types (src/shared/types/hl7.types.ts)
type HL7Component = string;
type HL7Repetition = HL7Component[];        // components within a repetition
type HL7Field = HL7Repetition[];            // repetitions within a field
type HL7Segment = HL7Field[];               // fields within a segment occurrence
type HL7Message = Record<string, HL7Segment[]>;  // segment name → occurrences

// Pipeline types (src/modules/pipeline/convert.pipeline.ts)
type InputFormat = 'hl7v2' | 'cda' | 'json' | 'fhir-r4' | 'hl7v3' | 'csv' | 'xlsx' | 'xls'
                 | 'whoop' | 'dexcom' | 'apple-health-kit' | 'android-health-connect'
                 | 'oura' | 'strava' | string;
type FhirOutputVersion = 'r5' | 'r6';

// FHIR mapper (src/modules/mappers/fhir.mapper.ts)
type FhirVersion = 'r5' | 'r6';
```

---

## 19 · What This Project Does NOT Do

- Does **not** persist data — it's a stateless converter
- Does **not** validate FHIR output against official profiles (validation is in separate scripts)
- Does **not** handle authentication or authorization
- Does **not** support FHIR R6 output yet (only R5)
- Does **not** do semantic translation (e.g., it maps codes as-is, no terminology lookups)
- The Ollama/LLM integration (`ai/ollama.canonical.ts`) is **experimental and unused** in the main pipeline
