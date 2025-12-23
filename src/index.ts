import express from 'express';
import multer from 'multer';
import path from 'path';
import { convertLegacyData, InputFormat, FhirOutputVersion } from './modules/pipeline/convert.pipeline.js';

const app = express();
app.use(express.json());
app.use(express.text({ type: ['text/xml', 'application/xml', 'text/plain'] }));
const upload = multer({ storage: multer.memoryStorage() });

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
    } else {
      return res.status(400).json({
        error: 'Invalid request body. Expected { input: string, format?: string } or raw text/XML body'
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
    let fhirVersion = (req.query.fhirVersion || req.body?.fhirVersion) as FhirOutputVersion | undefined;
    fhirVersion = fhirVersion || 'r5';
    // if (!input) {
    //   return res.status(400).json({ error: 'Input is required' });
    // }

    // Auto-detect HL7 version (v2 vs v3)
    // The detectInputFormat will identify hl7v2 or hl7v3
    const result = await convertLegacyData(input, 'hl7v3', fhirVersion);
    res.json(result);
  } catch (e: any) {
    console.error('HL7 Conversion error:', e);
    res.status(400).json({ error: e.message });
  }
});

app.listen(3000, () => console.log('FHIR Converter running on :3000'));