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

  const observations: CanonicalObservation[] = [];
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

  // Parse EGV (Estimated Glucose Value) data
  if (data.egvs && Array.isArray(data.egvs)) {
    for (const egv of data.egvs) {
      if (egv.value !== undefined) {
        // Main glucose observation
        const glucoseObs: CanonicalObservation = {
          code: {
            system: 'http://loinc.org',
            code: '14745-4',
            display: 'Glucose [Mass/volume] in Serum or Plasma'
          },
          value: egv.value,
          unit: 'mg/dL',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: 'mg/dL',
          date: egv.timestamp || egv.display_time,
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
              system: 'http://loinc.org',
              code: '8861-0',
              display: 'Glucose trend'
            },
            valueCodeableConcept: {
              coding: [{
                system: 'http://snomed.info/sct',
                code: mapTrendToSNOMED(egv.trend),
                display: egv.trend
              }]
            }
          }];
        }

        // Add interpretation based on status
        if (egv.status) {
          glucoseObs.interpretation = [mapDexcomStatusToInterpretation(egv.status)];
        }

        observations.push(glucoseObs);

        // If smoothed value is different, add as separate observation
        if (egv.smoothed_value !== undefined && egv.smoothed_value !== egv.value) {
          observations.push({
            code: {
              system: 'http://loinc.org',
              code: '14745-4',
              display: 'Glucose [Mass/volume] in Serum or Plasma (smoothed)'
            },
            value: egv.smoothed_value,
            unit: 'mg/dL',
            unitSystem: 'http://unitsofmeasure.org',
            unitCode: 'mg/dL',
            date: egv.timestamp || egv.display_time,
            category: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'laboratory',
              display: 'Laboratory'
            }],
            status: 'final'
          });
        }
      }
    }
  }

  // Parse Calibration data
  if (data.calibrations && Array.isArray(data.calibrations)) {
    for (const cal of data.calibrations) {
      if (cal.value !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '14745-4',
            display: 'Glucose [Mass/volume] in Serum or Plasma'
          },
          value: cal.value,
          unit: cal.unit || 'mg/dL',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: cal.unit || 'mg/dL',
          date: cal.timestamp,
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
      if (event.event_type === 'alarm' || event.event_type === 'alert') {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '2339-0',
            display: 'Glucose [Mass/volume] in Blood'
          },
          date: event.timestamp,
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

  const result: CanonicalModel = {
    patient: Object.keys(patient).length > 1 ? patient : undefined,
    observations: observations.length > 0 ? observations : undefined
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
    case 'rising':
    case 'risingquickly':
      return '260410001'; // Increasing
    case 'falling':
    case 'fallingquickly':
      return '260412009'; // Decreasing
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

