# Testing Guide - Legacy Data to FHIR R5 Converter

This guide explains how to test the converter with any legacy data format and validate the output on [https://validator.fhir.org/](https://validator.fhir.org/).

## Quick Start

### 1. Start the Server

```bash
npm run dev
# Server runs on http://localhost:3000
```

### 2. Test with Examples

```bash
# Test HL7v2 example
npm run test:example:hl7

# Test JSON example
npm run test:example:json

# Test CDA example
npm run test:example:cda
```

### 3. Test with Your Own Data

```bash
# Test with a file (auto-detects format)
node scripts/test-converter.mjs your-input.hl7 --validate

# Test with specific format
node scripts/test-converter.mjs your-input.json --format=json --validate

# Test and save output
node scripts/test-converter.mjs your-input.hl7 --output=my-bundle.json --validate
```

## Test Tool Usage

The `test-converter.mjs` script provides a comprehensive testing tool:

```bash
node scripts/test-converter.mjs <input-file> [options]
node scripts/test-converter.mjs --example=<format> [options]
```

### Options

- `--format=<format>` - Force format: `hl7v2`, `cda`, or `json` (auto-detected if not provided)
- `--validate` - Validate output with FHIR Validator API
- `--output=<file>` - Save output to specific file (default: `tmp/test-bundle.json`)
- `--example=<format>` - Use built-in example (`hl7v2`, `json`, or `cda`)

### Examples

```bash
# Test HL7v2 file with validation
node scripts/test-converter.mjs input.hl7 --format=hl7v2 --validate

# Test JSON file
node scripts/test-converter.mjs input.json --format=json --validate

# Use example input
node scripts/test-converter.mjs --example=hl7v2 --validate

# Test and save to custom location
node scripts/test-converter.mjs input.hl7 --output=output/my-bundle.json
```

## Input Formats Supported

### 1. HL7v2 (Pipe-delimited)

Example:
```
MSH|^~\&|RAD|HOSP|EHR|HOSP|202401011230||ORU^R01|MSG00002|P|2.5.1
PID|1||123456^^^HOSP^MR||DOE^JOHN||19800101|M
OBR|1||ORDER123|CTCHEST^CT Chest|||202401011100
OBX|1|ED|DICOM^DICOM Study||^DICOM^URI^https://example.com/images/ct-chest-scan.dcm
```

Save as `.hl7` or `.txt` file.

### 2. JSON (Custom Structure)

Example:
```json
{
  "patient": {
    "id": "P1",
    "firstName": "John",
    "lastName": "Doe",
    "gender": "male",
    "birthDate": "1980-01-01",
    "address": {
      "line1": "123 Main St",
      "city": "Springfield",
      "state": "IL",
      "postalCode": "62701"
    }
  },
  "documentReferences": [{
    "format": "pdf",
    "url": "https://example.com/report.pdf",
    "date": "2024-01-15"
  }]
}
```

Save as `.json` file.

### 3. CDA (XML)

Example:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<ClinicalDocument xmlns="urn:hl7-org:v3">
  <realmCode code="US"/>
  <typeId root="2.16.840.1.113883.1.3" extension="POCD_HD000040"/>
  <id root="2.16.840.1.113883.19" extension="123456"/>
  <recordTarget>
    <patientRole>
      <patient>
        <name>
          <given>John</given>
          <family>Doe</family>
        </name>
      </patient>
    </patientRole>
  </recordTarget>
</ClinicalDocument>
```

Save as `.xml` file.

## Validation

### Automatic Validation

The test tool can automatically validate with the FHIR Validator:

```bash
node scripts/test-converter.mjs input.hl7 --validate
```

This will:
1. Convert your input to FHIR R5 Bundle
2. Save the bundle to `tmp/test-bundle.json`
3. Validate with https://validator.fhir.org/
4. Show validation results (errors, warnings, information)

### Manual Validation

1. **Convert your data:**
   ```bash
   node scripts/test-converter.mjs input.hl7 --output=my-bundle.json
   ```

2. **Open https://validator.fhir.org/**

3. **Upload the bundle:**
   - Click "Choose File" or drag and drop
   - Select `my-bundle.json` (or `tmp/test-bundle.json`)
   - Select "R5" as the FHIR version
   - Click "Validate"

4. **Review results:**
   - Green = No errors
   - Yellow = Warnings
   - Red = Errors

### Validation Results

The test tool shows:
- **Fatal**: Critical issues that prevent the resource from being valid
- **Errors**: Issues that violate FHIR rules
- **Warnings**: Best practice violations
- **Information**: Informational messages

## Output Files

All test outputs are saved in the `tmp/` directory:

- `tmp/test-bundle.json` - The converted FHIR R5 Bundle
- `tmp/test-validation-result.json` - Validation results from the validator API

## API Testing

You can also test via the HTTP API:

### Using curl

```bash
# Test HL7v2
curl -X POST http://localhost:3000/convert \
  -H "Content-Type: application/json" \
  -d '{
    "input": "MSH|^~\\&|RAD|HOSP|EHR|HOSP|202401011230||ORU^R01|MSG00002|P|2.5.1\nPID|1||123456^^^HOSP^MR||DOE^JOHN||19800101|M",
    "format": "hl7v2"
  }'

# Test JSON
curl -X POST http://localhost:3000/convert \
  -H "Content-Type: application/json" \
  -d '{
    "input": "{\"patient\":{\"firstName\":\"John\",\"lastName\":\"Doe\"}}",
    "format": "json"
  }'
```

### Using Postman/Insomnia

1. **POST** to `http://localhost:3000/convert`
2. **Headers**: `Content-Type: application/json`
3. **Body**:
   ```json
   {
     "input": "your input data here",
     "format": "hl7v2" // or "cda" or "json"
   }
   ```

## Troubleshooting

### Server Not Running

```bash
# Start the server
npm run dev
```

### Validation API Not Working

If automatic validation fails:
1. The bundle is still saved to `tmp/test-bundle.json`
2. Manually upload to https://validator.fhir.org/
3. The tool will show the file path

### Format Detection Issues

If auto-detection fails, specify the format explicitly:
```bash
node scripts/test-converter.mjs input.txt --format=hl7v2
```

### Invalid Bundle Structure

Check the bundle file:
```bash
cat tmp/test-bundle.json | jq .
```

Ensure it has:
- `resourceType: "Bundle"`
- `type: "collection"` or `"transaction"`
- `entry[]` array with resources

## Next Steps

1. **Test with your data**: Use the test tool with your legacy data files
2. **Validate output**: Always validate on https://validator.fhir.org/
3. **Review issues**: Fix any validation errors or warnings
4. **Integrate**: Use the converter in your application

## Support

For issues or questions:
- Check the [UNIFIED_MAPPER_GUIDE.md](./UNIFIED_MAPPER_GUIDE.md) for architecture details
- Review [DOCUMENT_TYPES_REFERENCE.md](./DOCUMENT_TYPES_REFERENCE.md) for document type mappings
- Check test files in `tests/` directory for examples



