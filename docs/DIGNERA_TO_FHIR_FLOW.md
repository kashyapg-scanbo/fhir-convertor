# Dignera API -> FHIR Converter Flow

This document defines a practical integration flow between:
- Source API: `D:\dignera\dignera-api` (default `http://localhost:5001`)
- Converter API: `D:\scanbo-matrix-fhir-converter` (default `http://localhost:4000`)

## Goal
Fetch clinical/non-PHI data from Dignera API, normalize it into the converter's custom JSON shape, and convert it to FHIR (R4/R5).

## Recommended Architecture
Use `dignera-api` as the orchestrator:
1. Fetch raw data from Dignera internal services/routes.
2. Transform to converter-compatible JSON (`snake_case` canonical input).
3. Call converter endpoint `POST /convert` with `format: "json"`.
4. Return FHIR Bundle to caller (or store/publish it).

This keeps converter focused on transformation and avoids coupling converter to Dignera internals.

## End-to-End Flow
1. Client requests FHIR from Dignera:
   - Example: `GET /api/v1/patients/:patientId/fhir`
2. Dignera service gathers source payloads:
   - PHI data: `GET /api/v1/phi/data/:did` (or patient-level references + resolve)
   - OPD data: `GET /api/v1/opd`
   - Optional inventory/orders/prescriptions endpoints as needed
3. Dignera builds converter payload (important):
   - Map Dignera camelCase fields to converter `snake_case` fields
   - Include at least one supported section like `patient`, `encounter`, `observation`, etc.
4. Dignera calls converter:
   - `POST http://localhost:4000/convert`
   - Body:
     ```json
     {
       "input": "<stringified-mapped-json>",
       "format": "json",
       "fhirVersion": "r5"
     }
     ```
5. Converter pipeline executes:
   - `parseCustomJSON` -> canonical model -> `mapCanonicalToFHIR`
6. Dignera returns FHIR Bundle to client or forwards to downstream FHIR server.

## Why this works with current code
- Converter already supports JSON conversion through `POST /convert`.
- Auto-detect also works, but explicit `format: "json"` is safer.
- Converter expects custom JSON sections mostly in snake_case.

## Mapping Strategy (Dignera -> Converter JSON)
Suggested minimum v1 mapping:

- Dignera patient fields:
  - `patientName` -> `patient.name.first_name`
  - `lastName` -> `patient.name.last_name`
  - `mobile` -> `patient.contact_info.phone`
  - `dob` -> `patient.date_of_birth`
  - `patientId` -> `patient.patient_id`

- Dignera encounter/appointment fields:
  - `encounter.id` -> `encounter.encounter_id`
  - `encounter.patientId` -> `encounter.patient_id`
  - `encounter.doctor` -> `encounter.practitioner_id` (or map via practitioner table)
  - `encounter.department` -> `encounter.encounter_type`

- Dignera vitals/orders/prescriptions:
  - Vitals -> `observation[]`
  - Orders -> `service_request[]`
  - Prescriptions -> `medication_request[]` and/or `medication[]`

## Adapter Skeleton (in dignera-api)
Create a service in Dignera (example `services/fhir/fhirBridge.service.js`):

```js
const axios = require('axios');

const CONVERTER_URL = process.env.FHIR_CONVERTER_URL || 'http://localhost:4000';

function toConverterPayload(digneraData) {
  return {
    patient: {
      patient_id: digneraData.patientId,
      name: {
        first_name: digneraData.patientName,
        last_name: digneraData.lastName
      },
      date_of_birth: digneraData.dob,
      contact_info: {
        phone: digneraData.mobile
      }
    }
  };
}

async function convertToFhir(digneraData, fhirVersion = 'r5') {
  const mapped = toConverterPayload(digneraData);
  const response = await axios.post(`${CONVERTER_URL}/convert`, {
    input: JSON.stringify(mapped),
    format: 'json',
    fhirVersion
  });
  return response.data;
}

module.exports = { convertToFhir };
```

## Suggested API contract (Dignera side)
Add endpoint in `dignera-api`:
- `GET /api/v1/patients/:patientId/fhir?version=r5`

Processing:
1. Load patient + relevant encounter/vitals/orders.
2. Map data to converter JSON.
3. Call converter `/convert`.
4. Return converter response directly.

## Operational Notes
- Ports:
  - Dignera: `5001`
  - Converter: `4000`
- Timeouts/retries:
  - Use 5-10s timeout and retry on 429/5xx.
- Observability:
  - Pass `X-Request-ID` from Dignera to converter for traceability.
- Security:
  - If both are internal, restrict by network.
  - If exposed, add API key/JWT in converter.

## Common Pitfalls
- Sending raw JS object to converter `input` instead of stringified JSON.
- Using Dignera camelCase directly without mapping to converter shape.
- Relying only on auto-detect; prefer explicit `format: "json"`.
- Mixing PHI reference objects instead of resolved PHI data from `/phi/data/:did`.

## Quick Test
1. Start converter: `npm run dev` in `scanbo-matrix-fhir-converter`.
2. Start Dignera API: `npm run dev` in `dignera-api`.
3. In Dignera, run adapter on one known patient payload.
4. Validate returned Bundle has expected `resourceType: "Bundle"` and entries.

## Future Improvement
- Add a dedicated converter endpoint like `POST /convert/from-dignera` with direct Dignera schema support.
- Version mapping profiles (`v1`, `v2`) to avoid breaking changes.
