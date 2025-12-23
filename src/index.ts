import express from 'express';
import { convertLegacyData, InputFormat } from './modules/pipeline/convert.pipeline.js';

const app = express();
app.use(express.json());
app.use(express.text({ type: ['text/xml', 'application/xml', 'text/plain'] }));

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

    // Check if request is JSON body with input field
    if (req.body && typeof req.body === 'object' && 'input' in req.body) {
      input = req.body.input;
      format = req.body.format as InputFormat;
    }
    // Check if request is raw text/XML body
    else if (typeof req.body === 'string') {
      input = req.body;
      // Try to get format from query param or Content-Type header
      format = req.query.format as InputFormat;

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
    const result = await convertLegacyData(input, format);
    res.json(result);
  } catch (e: any) {
    console.error('Conversion error:', e);
    res.status(400).json({ error: e.message });
  }
});

/**
 * POST /convert/hl7v2
 * Legacy endpoint for HL7v2 conversion (backward compatibility)
 */
app.post('/convert/hl7v2', async (req, res) => {
  try {
    const input = typeof req.body === 'string' ? req.body : req.body.input;
    // if (!input) {
    //   return res.status(400).json({ error: 'Input is required' });
    // }
    const result = await convertLegacyData(input, 'hl7v2');
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

app.listen(3000, () => console.log('FHIR Converter running on :3000'));
