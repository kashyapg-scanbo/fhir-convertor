# JSON Context

## Scope
This document explains the JSON conversion flow implemented in:
- `src/modules/pipeline/convert.pipeline.ts`
- `src/modules/parsers/json.parser.ts`
- `src/modules/parsers/tabular.utils.ts`
- `src/shared/header-aliases.ts`

The target is `parseCustomJSON(...)`, which converts custom JSON input into `CanonicalModel`, then to FHIR R5 Bundle via mappers.

## End-to-End Flow
1. `POST /convert` receives payload.
2. `detectInputFormat(input)` returns `json` unless device heuristics match (`whoop`, `dexcom`, etc.).
3. `convertLegacyData(...)` calls `parseCustomJSON(input)`.
4. `parseCustomJSON(...)` parses and routes input through JSON parsing branches.
5. Returned `CanonicalModel` goes to `mapCanonicalToFHIR(...)`.

## JSON Input Modes Supported
`parseCustomJSON(...)` supports **4 practical input ways**:

1. Flat/Tabular JSON (primary)
- Shapes:
  - Array of flat records: `[ {...}, {...} ]`
  - Single flat record: `{...}`
  - Wrapped rows: `{ "rows": [ {...}, {...} ] }`
- Path:
  - `looksLikeTabularJson` -> `coerceTabularRows` -> `mapTabularRowsToCanonical`
- Notes:
  - Uses dynamic header aliases.
  - Unknown extra fields are captured into `sourcePayloads` via leftover logic.

2. Global Custom JSON (strict schema)
- Shape:
  - Structured payload with canonical sections (`patient`, `encounter`, `observation`, etc.)
- Path:
  - `normalizeGlobalPayload` -> `wrapGlobalPayload` -> `normalizeGlobalPayloadAliases` -> `GlobalCustomJSONSchema.parse(...)` -> `buildCanonicalFromGlobal`
- Notes:
  - Zod validation is strict.
  - Detailed validation errors are returned with field paths.

3. Single-Resource Auto-Wrap (global helper mode)
- Shape:
  - Single object that looks like one resource (for example a patient-like or encounter-like object).
- Path:
  - `wrapGlobalPayload(...)` wraps to global section (`{ patient: value }`, `{ encounter: value }`, etc.), then continues in Global Custom JSON path.
- Notes:
  - This is an extension of mode 2, but behaves as a separate compatibility mode.

4. Structured Alias JSON (sectioned but dynamic names)
- Shape:
  - Nested/sectioned payload where section names and field names are aliases, not strict canonical keys.
- Path:
  - `looksLikeStructuredAliasJson` -> `buildRowsFromStructuredAliasJson` -> `mapTabularRowsToCanonical`
- Notes:
  - Converts nested section objects/arrays to tabular rows before canonical mapping.
  - Unknown fields can still go to `sourcePayloads` when leftover extraction finds them.

## Dynamic Field Support
Dynamic support is implemented at multiple layers:

1. Key normalization
- `normalizeAliasKey(...)` and `normalizeHeader(...)` standardize key names:
  - lowercase
  - spaces/symbols -> underscores

2. Field alias remapping
- `HEADER_ALIAS_SECTIONS` drives alias-to-canonical mapping.
- Coverage in current code:
  - **75 alias sections** (resource/domain groups).
- Used by:
  - structured alias detection
  - global payload alias normalization
  - tabular row header canonicalization

3. Top-level section synonym remapping
- `GLOBAL_TOP_LEVEL_KEY_MAP` supports singular/plural/variant section names.
- Coverage in current code:
  - **200 top-level key mappings**.

4. Branch-specific dynamic support counts
- `normalizeGlobalPayloadAliases` mapping list: **61 sections** normalized.
- Structured alias row builder array sections: **59 sections** expanded into rows (with patient/encounter base merge).

## What Gets Mapped vs Preserved
1. Mapped fields
- Recognized fields are converted into `CanonicalModel` properties.
- Flat/structured-tabular routes use `mapTabularRowsToCanonical(...)`.
- Global route uses resource-specific builders inside `buildCanonicalFromGlobal(...)`.

2. Preserved extra fields
- Flat-like payloads run `extractFlatLeftoverPayload(...)`.
- Extra/unmapped fields are attached as `canonical.sourcePayloads` for traceability.

## Message Type Resolution
For tabular-like payloads, `messageType` is inferred from aliases like:
- `source_system`, `source`, `vendor`, `system`, `message_type`, `messagetype`

If none found, defaults to `JSON`.

## Failure Cases
`parseCustomJSON(...)` throws errors when:
1. Input is not valid JSON string.
2. Payload does not match any supported branch.
3. Global branch fails Zod validation (error includes per-path reasons).

## Practical Summary
For this JSON converter, support is broad and dynamic:
- **4 input ways** (flat/tabular, strict global, single-resource auto-wrap, structured alias).
- **75 field-alias sections** for dynamic field names.
- **200 top-level key variants** for dynamic section names.
- Strict validation exists for global mode; compatibility fallbacks exist for tabular and alias-shaped payloads.
