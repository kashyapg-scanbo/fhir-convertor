# Partner Integration Guide

This guide explains how partners can send data to your API and receive FHIR R5 output.

## What you should provide to partners
- Base URL for each environment (dev/stage/prod).
- Authentication method and credentials (API key, OAuth, JWT).
- Rate limits and retry guidance.
- JSON schema (required/optional fields) and examples.
- Error format and common error codes.
- Sample Postman collection or cURL examples.
- Support contact and versioning policy.

## Base URL
Example (local): `http://localhost:3000`

## Endpoints
- `POST /json` : custom JSON input -> FHIR R5 Bundle (recommended for partners)
- `POST /convert` : auto-detect input (json/hl7/cda/csv/xls/xlsx) -> FHIR R5 Bundle
- `POST /convert/upload` : file upload -> FHIR R5 Bundle
- `POST /convert/hl7` : HL7 only -> FHIR R5 Bundle
- `GET /docs` : Swagger UI
- `GET /docs.json` : OpenAPI spec JSON

## Authentication (recommended)
Not enforced by default. Recommended options for production:
- API key: `x-api-key: <key>`
- OAuth2 Bearer token: `Authorization: Bearer <token>`

## Rate limits (recommended)
Not enforced by default. Suggested policy:
- 60 requests/minute per API key
- Burst up to 10 requests/second
- Retry after `429` with exponential backoff

## Error response format
All errors return HTTP 400 with:
```json
{ "error": "Human readable message" }
```

## Custom JSON schema (accepted by `POST /json`)

This endpoint accepts the **global custom JSON** (snake_case) below.

At least one resource section is required:
- `patient`, `encounter`, `medication`, `medication_request`, `practitioner`, `practitioner_role`, `organization`

Each resource can be **an object or an array of objects**.

Top-level optional fields:
- `operation` (string: `create` | `update` | `delete`)
- `messageType` (string)

### patient
Key fields:
- `patient_id`, `ihi`, `name.{first_name,middle_name,last_name}`, `date_of_birth`, `gender`
- `contact_info.{phone,email,address}`, `address.{street,city,state,postal_code,country}`
- `emergency_contact`, `insurance`, `medical_history` (all optional)

### encounter
Key fields:
- `encounter_id`, `patient_id`, `practitioner_id`, `encounter_type`, `reason_for_visit`
- `start_date`, `end_date`, `status`, `location`, `diagnoses`, `services_provided`
- `billing_info`, `follow_up`, `note` (all optional)

### medication
Key fields:
- `medication_id`, `name`, `brand_name`, `form`, `strength`, `manufacturer`, `ingredients`
- `package`, `status`, `expiration_date`, `lot_number` (all optional)

### medication_request
Key fields:
- `medication_request_id`, `patient_id`, `practitioner_id`, `medication`
- `dosage_instruction`, `dispense_request`, `substitution_allowed`
- `reason_for_prescription`, `status`, `authored_on`, `note` (all optional)

### practitioner
Key fields:
- `practitioner_id`, `name`, `date_of_birth`, `gender`, `contact_info`
- `license`, `specialization`, `years_of_experience`, `languages_spoken`
- `practice_location`, `qualifications` (all optional)

### practitioner_role
Key fields:
- `practitioner_role_id`, `practitioner_id`, `organization_id`, `role`, `specialty`
- `location`, `telecom`, `available_hours`, `service_period` (all optional)

### organization
Key fields:
- `organization_id`, `name`, `type`, `contact_info`, `departments`
- `affiliations`, `services_offered`, `operating_hours` (all optional)

## Example requests

### 1) Patient only
`POST /json`
```json
{
  "patient": {
    "patient_id": "P-10001",
    "ihi": "1234098753",
    "name": {
      "first_name": "John",
      "middle_name": "A.",
      "last_name": "Doe"
    },
    "date_of_birth": "1980-05-15",
    "gender": "male",
    "contact_info": {
      "phone": "+1-555-555-5555",
      "email": "john.doe@example.com",
      "address": {
        "street": "123 Main St",
        "city": "Springfield",
        "state": "IL",
        "postal_code": "62701",
        "country": "USA"
      }
    }
  }
}
```

### 2) Encounter only
`POST /json`
```json
{
  "encounter": {
    "encounter_id": "ENC345678",
    "patient_id": "12345",
    "practitioner_id": "98765",
    "encounter_type": "Outpatient",
    "reason_for_visit": "Routine check-up",
    "start_date": "2024-08-15T09:00:00Z",
    "end_date": "2024-08-15T09:30:00Z",
    "status": "completed"
  }
}
```

### 3) Full clinical bundle
`POST /json`
```json
{
  "operation": "create",
  "patient": {
    "patient_id": "P-10001",
    "name": {
      "first_name": "John",
      "last_name": "Doe"
    },
    "date_of_birth": "1980-05-15"
  },
  "encounter": {
    "encounter_id": "ENC345678",
    "encounter_type": "Outpatient",
    "start_date": "2024-08-15T09:00:00Z",
    "status": "completed"
  },
  "medication": {
    "medication_id": "MED987654",
    "name": "Atorvastatin",
    "strength": "20 mg"
  },
  "medication_request": {
    "medication_request_id": "MRQ123456",
    "medication": {
      "medication_id": "MED987654",
      "name": "Atorvastatin"
    }
  },
  "practitioner": {
    "practitioner_id": "98765",
    "name": {
      "first_name": "Emily",
      "last_name": "Smith"
    }
  },
  "practitioner_role": {
    "practitioner_role_id": "PR123456",
    "practitioner_id": "98765",
    "role": "Cardiologist"
  },
  "organization": {
    "organization_id": "ORG001",
    "name": "Healthy Heart Clinic"
  }
}
```

## Sample Postman collection
See `postman/scanbo-fhir-converter.postman_collection.json`.
