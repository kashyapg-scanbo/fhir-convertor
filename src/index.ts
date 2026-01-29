import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import YAML from 'yaml';
import swaggerUi from 'swagger-ui-express';
import { convertLegacyData, InputFormat, FhirOutputVersion } from './modules/pipeline/convert.pipeline.js';

const app = express();
const bodyLimit = '50mb';
app.use(express.json({ limit: bodyLimit }));
app.use(express.text({ type: ['text/xml', 'application/xml', 'text/plain'], limit: bodyLimit }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const openApiPath = path.join(process.cwd(), 'docs', 'openapi.yaml');
const openApiDoc = fs.existsSync(openApiPath)
  ? YAML.parse(fs.readFileSync(openApiPath, 'utf8'))
  : undefined;

if (openApiDoc) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));
  app.get('/docs.json', (req, res) => res.json(openApiDoc));
}

/**
 * POST /convert
 * 
 * Accepts legacy data in HL7v2, CDA, or JSON format and converts to FHIR Bundle
 * 
 * Request body options:
 * 1. JSON body: { input: string, format?: 'hl7v2' | 'cda' | 'json' }
 * 2. Raw text/XML body: format specified via Content-Type header or query param
 * 
 * Query params:
 * - format: 'hl7v2' | 'cda' | 'json' (optional, auto-detected if not provided)
 */
app.post('/convert', async (req, res) => {
  try {
    let input: string;
    let format: InputFormat | undefined;
    let fhirVersion: FhirOutputVersion | undefined;

    // Check if request is JSON body with input field
    if (req.body && typeof req.body === 'object' && 'input' in req.body) {
      input = req.body.input;
      format = req.body.format as InputFormat;
      fhirVersion = req.body.fhirVersion as FhirOutputVersion;
      fhirVersion = fhirVersion || 'r5';
    }
    // Check if request is raw text/XML body
    else if (typeof req.body === 'string') {
      input = req.body;
      // Try to get format from query param or Content-Type header
      format = req.query.format as InputFormat;
      fhirVersion = req.query.fhirVersion as FhirOutputVersion;
      fhirVersion = fhirVersion || 'r5';
      if (!format) {
        const contentType = req.get('Content-Type') || '';
        if (contentType.includes('xml')) {
          format = 'cda';
        } else if (contentType.includes('json')) {
          format = 'json';
        }
      }
    }
    // Check if request is direct JSON object (no input key)
    else if (req.body && typeof req.body === 'object') {
      input = JSON.stringify(req.body);
      format = (req.query.format as InputFormat) || 'json';
      fhirVersion = (req.query.fhirVersion as FhirOutputVersion) || 'r5';
    } else {
      return res.status(400).json({
        error: 'Invalid request body. Expected { input: string, format?: string }, raw text/XML body, or JSON object'
      });
    }

    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    console.log('Converting input format:', format || 'auto-detect');
    const result = await convertLegacyData(input, format, fhirVersion);
    res.json(result);
  } catch (e: any) {
    console.error('Conversion error:', e);
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /convert/upload
 *
 * Accepts multipart/form-data with a file field named "file".
 * Optional form field: format (csv, xlsx, xls, hl7v2, cda, json, etc.)
 * Optional form field: fhirVersion (r4, r5)
 */
app.post('/convert/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const requestedFormat = req.body?.format as InputFormat | undefined;
    let fhirVersion = req.body?.fhirVersion as FhirOutputVersion | undefined;
    fhirVersion = fhirVersion || 'r5';
    const ext = path.extname(file.originalname || '').toLowerCase();

    let format = requestedFormat;
    if (!format) {
      if (ext === '.csv') format = 'csv';
      else if (ext === '.xlsx') format = 'xlsx';
      else if (ext === '.xls') format = 'xls';
      else if (ext === '.xml') format = 'cda';
      else if (ext === '.hl7' || ext === '.txt') format = 'hl7v2';
    }

    if (!format) {
      return res.status(400).json({
        error: 'Format is required (e.g., csv, xlsx, xls) or use a known extension.'
      });
    }

    const input = (format === 'xlsx' || format === 'xls')
      ? file.buffer.toString('base64')
      : file.buffer.toString('utf8');

    const result = await convertLegacyData(input, format, fhirVersion);
    res.json(result);
  } catch (e: any) {
    console.error('Upload conversion error:', e);
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /convert/hl7
 * Unified endpoint for all HL7 versions (v2, v3)
 * Automatically detects the version based on input format
 */
app.post('/convert/hl7', async (req, res) => {
  try {
    const input = typeof req.body === 'string' ? req.body : req.body.input;
    const format = (req.query.format || req.body?.format) as InputFormat | undefined;
    let fhirVersion = (req.query.fhirVersion || req.body?.fhirVersion) as FhirOutputVersion | undefined;
    fhirVersion = fhirVersion || 'r5';
    // if (!input) {
    //   return res.status(400).json({ error: 'Input is required' });
    // }

    // Auto-detect HL7 version (v2 vs v3)
    // The detectInputFormat will identify hl7v2 or hl7v3
    const result = await convertLegacyData(input, format, fhirVersion);
    res.json(result);
  } catch (e: any) {
    console.error('HL7 Conversion error:', e);
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /convert/deviceData
 * 
 * Dedicated endpoint for wearable device data (Whoop, Dexcom, etc.)
 * Accepts device-specific JSON and converts to FHIR R5 Bundle
 * 
 * Request body:
 * - JSON object with device data (Whoop or Dexcom format)
 * - OR { data: object, deviceType?: 'whoop' | 'dexcom' | 'apple-health-kit' | 'android-health-connect' | 'strava' }
 * 
 * Query params:
 * - deviceType: 'whoop' | 'dexcom' | 'apple-health-kit' | 'android-health-connect' | 'strava' (optional, auto-detected if not provided)
 * - fhirVersion: 'r4' | 'r5' (default: 'r5')
 * 
 * Example:
 * POST /convert/deviceData?deviceType=whoop
 * Body: { "user": {...}, "sleep": [...], "recovery": [...] }
 */
app.post('/convert/deviceData', async (req, res) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({
        error: 'Request body must be a JSON object containing device data'
      });
    }

    let deviceData: any;
    let deviceType: InputFormat | undefined;
    let fhirVersion: FhirOutputVersion | undefined;

    // Check if data is wrapped in a 'data' field
    if ('data' in req.body && typeof req.body.data === 'object') {
      deviceData = req.body.data;
      deviceType = req.body.deviceType as InputFormat;
      fhirVersion = req.body.fhirVersion as FhirOutputVersion;
    } else {
      // Direct device data object
      deviceData = req.body;
      deviceType = req.query.deviceType as InputFormat;
      fhirVersion = (req.query.fhirVersion as FhirOutputVersion) || 'r5';
    }

    // Default to r5 if not specified
    fhirVersion = fhirVersion || 'r5';

    // Auto-detect device type if not specified
    if (!deviceType) {
      // Check for Whoop-specific fields (actual API structure)
      if (deviceData.profile?.user_id || deviceData.recovery?.score || deviceData.cycle?.score || deviceData.sleep?.score) {
        deviceType = 'whoop';
      }
      // Check for Dexcom-specific fields
      else if (deviceData.egvs || deviceData.calibrations || (deviceData.device && deviceData.device.transmitter_id)) {
        deviceType = 'dexcom';
      }
      else if (deviceData.heart?.data || deviceData.respiratory?.data || deviceData.hearing?.data || deviceData.reproductive?.data || deviceData.body?.data || deviceData.activity?.data || deviceData.sleep?.data || deviceData.sleepAnalysis?.data || deviceData.workouts?.data) {
        deviceType = 'apple-health-kit';
      } else if (deviceData['Daily Activity'] || deviceData['Sleep Detailed'] || deviceData['Sleep'] || deviceData['Workout'] || deviceData['Heart Rate']) {
        deviceType = 'android-health-connect';
      } else if (deviceData.profile?.id || Array.isArray(deviceData.activities)) {
        deviceType = 'strava';
      } else {
        return res.status(400).json({
          error: 'Unable to detect device type. Please specify deviceType parameter (whoop, dexcom, apple-health-kit, android-health-connect, or strava) or provide data in recognized format.',
          hint: 'Whoop data should contain: profile.user_id, recovery.score, cycle.score, or sleep.score. Dexcom data should contain: egvs, calibrations, or device.transmitter_id. Apple HealthKit data should contain: heart.data, respiratory.data, hearing.data, reproductive.data, body.data, activity.data, sleep.data, sleepAnalysis.data, or workouts.data. Android Health Connect data should contain: Daily Activity, Sleep Detailed, Sleep, Workout, or Heart Rate. Strava data should contain: profile.id or activities[].'
        });
      }
    }

    // Validate device type
    if (deviceType !== 'whoop' && deviceType !== 'dexcom' && deviceType !== 'apple-health-kit' && deviceType !== 'android-health-connect' && deviceType !== 'strava') {
      return res.status(400).json({
        error: `Unsupported device type: ${deviceType}. Supported types: whoop, dexcom, apple-health-kit, android-health-connect, strava`
      });
    }

    // Convert device data to JSON string for the parser
    const input = JSON.stringify(deviceData);

    console.log(`Converting ${deviceType} device data to FHIR ${fhirVersion}`);
    const result = await convertLegacyData(input, deviceType, fhirVersion);
    
    // Return FHIR Bundle with metadata in response headers
    res.set('X-Device-Type', deviceType);
    res.set('X-FHIR-Version', fhirVersion);
    res.json(result);
  } catch (e: any) {
    console.error('Device data conversion error:', e);
    res.status(400).json({ 
      error: e.message,
      details: e.stack
    });
  }
});

app.listen(4000, () => console.log('FHIR Converter running on :4000'));
