import { CanonicalModel, CanonicalObservation, CanonicalPatient } from '../../shared/types/canonical.types.js';
import type { DexcomData } from '../types/dexcom.types.js';

/**
 * Dexcom Device Data Parser
 * 
 * Converts Dexcom API JSON data to Canonical Model
 * 
 * Expected Dexcom JSON structure:
 * {
 *   "user": { "id": "...", "name": "..." },
 *   "egvs": [
 *     { "value": 120, "timestamp": "2024-01-01T08:00:00Z", "trend": "flat", "status": "ok" }
 *   ],
 *   "calibrations": [...],
 *   "events": [...],
 *   "device": { "transmitter_id": "...", "model": "G7" }
 * }
 */
export function parseDexcom(input: string): CanonicalModel {
  let data: DexcomData;
  
  try {
    data = JSON.parse(input);
  } catch (e) {
    throw new Error('Invalid JSON input for Dexcom parser');
  }

  const originalDataBase64 = Buffer.from(input, 'utf8').toString('base64');

  const recordType = (data as any).recordType;
  const records = (data as any).records;
  if (recordType && Array.isArray(records)) {
    const normalizedType = String(recordType).toLowerCase();
    if (normalizedType === 'egv' || normalizedType === 'egvs') {
      data.egvs = records;
    } else if (normalizedType === 'calibration' || normalizedType === 'calibrations') {
      data.calibrations = records;
    } else if (normalizedType === 'event' || normalizedType === 'events') {
      data.events = records;
    } else if (normalizedType === 'device' || normalizedType === 'devices') {
      data.devices = records;
    }
    if (!data.user && (data as any).userId) {
      data.user = { id: (data as any).userId };
    }
  }

  const observations: CanonicalObservation[] = [];
  const deviceInfo = data.device || data.devices?.[0];
  const defaultDeviceUid = deviceInfo?.transmitter_id
    ? `dexcom-${deviceInfo.transmitter_id}`
    : deviceInfo?.transmitterGeneration
      ? `dexcom-${deviceInfo.transmitterGeneration}`
      : deviceInfo?.model
        ? `dexcom-${deviceInfo.model}`
        : 'dexcom';
  const patient: CanonicalPatient = {
    name: {},
    identifier: data.user?.id
  };

  // Extract patient information
  if (data.user) {
    if (data.user.name) {
      const nameParts = data.user.name.split(' ');
      patient.name = {
        family: nameParts[nameParts.length - 1],
        given: nameParts.slice(0, -1)
      };
    }
    patient.birthDate = data.user.date_of_birth;
    patient.gender = mapGender(data.user.gender);
    if (data.user.id) {
      patient.id = data.user.id;
    }
  }

  const normalizeTimestamp = (value?: string): string | undefined => {
    if (!value) return undefined;
    if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) return value;
    return `${value}Z`;
  };

  const toDateOnly = (value?: string): string | undefined => {
    if (!value) return value;
    const tIndex = value.indexOf('T');
    return tIndex === -1 ? value : value.slice(0, tIndex);
  };

  const addSampleTimestampComponent = (components: CanonicalObservation['components'], timestamp?: string) => {
    if (!timestamp) return;
    components?.push({
      code: {
        system: 'urn:hl7-org:local',
        code: 'sample-timestamp',
        display: 'Sample timestamp'
      },
      valueString: timestamp
    });
  };

  // Parse EGV (Estimated Glucose Value) data
  if (data.egvs && Array.isArray(data.egvs)) {
    const grouped = new Map<string, CanonicalObservation['components']>();

    for (const egv of data.egvs) {
      const value = egv.value ?? egv.smoothed_value ?? egv.smoothedValue ?? egv.realtime_value ?? egv.realtimeValue;
      if (value !== undefined) {
        const timestamp = normalizeTimestamp(egv.timestamp || egv.systemTime || egv.display_time || egv.displayTime);
        // Main glucose observation
        const glucoseObs: CanonicalObservation = {
          code: {
            system: 'http://loinc.org',
            code: '2339-0',
            display: 'Glucose [Mass/volume] in Blood'
          },
          value,
          unit: egv.unit || 'mg/dL',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: egv.unit || 'mg/dL',
          date: timestamp,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory'
          }],
          status: mapDexcomStatus(egv.status)
        };

        // Add trend as component if available
        if (egv.trend) {
          glucoseObs.components = [{
            code: {
              system: 'urn:hl7-org:local',
              code: 'glucose-trend',
              display: 'Glucose trend'
            },
            valueString: egv.trend
          }];
        }

        // Add interpretation based on status
        if (egv.status) {
          glucoseObs.interpretation = [mapDexcomStatusToInterpretation(egv.status)];
        }

        observations.push(glucoseObs);

        // If smoothed value is different, add as separate observation
        const smoothed = egv.smoothed_value ?? egv.smoothedValue;
        if (smoothed !== undefined && smoothed !== null && smoothed !== value) {
          observations.push({
            code: {
              system: 'http://loinc.org',
              code: '2339-0',
              display: 'Glucose [Mass/volume] in Blood (smoothed)'
            },
            value: smoothed,
            unit: egv.unit || 'mg/dL',
            unitSystem: 'http://unitsofmeasure.org',
            unitCode: egv.unit || 'mg/dL',
            date: timestamp,
            category: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
              display: 'Laboratory'
            }],
            status: 'final'
          });
        }

        const dateOnly = toDateOnly(timestamp);
        if (dateOnly) {
          const components = grouped.get(dateOnly) || [];
          components.push({
            code: { system: 'http://loinc.org', code: '2339-0', display: 'Glucose [Mass/volume] in Blood' },
            valueQuantity: {
              value,
              unit: egv.unit || 'mg/dL',
              system: 'http://unitsofmeasure.org',
              code: egv.unit || 'mg/dL'
            }
          });
          addSampleTimestampComponent(components, timestamp);
          grouped.set(dateOnly, components);
        }
      }
    }

    for (const [date, components] of grouped.entries()) {
      if (!components?.length) continue;
      observations.push({
        code: { system: 'urn:hl7-org:local', code: 'dexcom-daily-glucose', display: 'Daily glucose samples' },
        date,
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'laboratory',
          display: 'Laboratory'
        }],
        components
      });
    }
  }

  // Parse Calibration data
  if (data.calibrations && Array.isArray(data.calibrations)) {
    for (const cal of data.calibrations) {
      if (cal.value !== undefined) {
        const timestamp = normalizeTimestamp(cal.timestamp || cal.systemTime || cal.displayTime);
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '2339-0',
            display: 'Glucose [Mass/volume] in Blood'
          },
          value: cal.value,
          unit: cal.unit || 'mg/dL',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: cal.unit || 'mg/dL',
          date: timestamp,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory'
          }],
          status: 'final',
          method: {
            code: 'calibration',
            description: 'Device calibration reading'
          }
        });
      }
    }
  }

  // Parse Events (alarms, alerts)
  if (data.events && Array.isArray(data.events)) {
    for (const event of data.events) {
      const eventType = event.event_type || event.eventType;
      const timestamp = normalizeTimestamp(event.timestamp || event.systemTime || event.displayTime);
      if (eventType === 'alarm' || eventType === 'alert') {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '2339-0',
            display: 'Glucose [Mass/volume] in Blood'
          },
          date: timestamp,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'laboratory',
            display: 'Laboratory'
          }],
          status: 'final',
          interpretation: [mapEventSeverityToInterpretation(event.severity)]
        });
      }
    }
  }

  for (const obs of observations) {
    if (!obs.device || !obs.device.uid) {
      obs.device = { uid: defaultDeviceUid };
    }
  }

  const result: CanonicalModel = {
    patient: Object.keys(patient).length > 1 ? patient : undefined,
    observations: observations.length > 0 ? observations : undefined,
    documentReferences: [{
      status: 'current',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: '34133-9',
          display: 'Summary of episode note'
        }]
      },
      date: new Date().toISOString(),
      content: [{
        attachment: {
          contentType: 'application/json',
          data: originalDataBase64,
          title: 'Dexcom API Original Request Data',
          format: 'json'
        }
      }]
    }]
  };

  return result;
}

function mapGender(gender?: string): string | undefined {
  if (!gender) return undefined;
  const normalized = gender.toLowerCase();
  if (normalized.startsWith('m') || normalized === 'male') return 'male';
  if (normalized.startsWith('f') || normalized === 'female') return 'female';
  if (normalized.startsWith('o') || normalized === 'other') return 'other';
  return 'unknown';
}

function mapDexcomStatus(status?: string): string {
  if (!status) return 'final';
  const normalized = status.toLowerCase();
  if (normalized === 'ok') return 'final';
  if (normalized === 'low' || normalized === 'high') return 'final';
  if (normalized === 'urgentlow' || normalized === 'urgenthigh') return 'final';
  return 'final';
}

function mapTrendToSNOMED(trend?: string): string {
  if (!trend) return '260385009'; // No change
  const normalized = trend.toLowerCase();
  switch (normalized) {
    case 'doubleup':
    case 'singleup':
    case 'fortyfiveup':
    case 'rising':
    case 'risingquickly':
      return '260410001'; // Increasing
    case 'doubledown':
    case 'singledown':
    case 'fortyfivedown':
    case 'falling':
    case 'fallingquickly':
      return '260412009'; // Decreasing
    case 'rateoutofrange':
    case 'notcomputable':
    case 'flat':
      return '260385009'; // No change
    default:
      return '260385009'; // No change
  }
}

function mapDexcomStatusToInterpretation(status?: string): string {
  if (!status) return 'N'; // Normal
  const normalized = status.toLowerCase();
  if (normalized === 'ok') return 'N'; // Normal
  if (normalized === 'low' || normalized === 'urgentlow') return 'L'; // Low
  if (normalized === 'high' || normalized === 'urgenthigh') return 'H'; // High
  return 'N';
}

function mapEventSeverityToInterpretation(severity?: string): string {
  if (!severity) return 'N';
  const normalized = severity.toLowerCase();
  if (normalized === 'critical' || normalized === 'urgent') return 'H'; // High/Critical
  if (normalized === 'warning') return 'A'; // Abnormal
  return 'N'; // Normal
}
