import { CanonicalModel, CanonicalObservation, CanonicalPatient } from '../../shared/types/canonical.types.js';

/**
 * Whoop Device Data Parser
 * 
 * Converts Whoop API JSON data to Canonical Model
 * 
 * Expected Whoop JSON structure:
 * {
 *   "user": { "id": "...", "name": "..." },
 *   "sleep": [{ "id": "...", "score": 85, "duration": 28800, ... }],
 *   "recovery": [{ "id": "...", "score": 75, "hrv": 45, "rhr": 55, ... }],
 *   "workout": [{ "id": "...", "strain": 12.5, "calories": 450, ... }],
 *   "respiratory_rate": [{ "value": 14.5, "timestamp": "2024-01-01T08:00:00Z" }]
 * }
 */

export interface WhoopSleepData {
  id?: string;
  score?: number;
  duration?: number; // seconds
  efficiency?: number; // percentage
  start?: string; // ISO timestamp
  end?: string; // ISO timestamp
  cycles?: {
    awake?: number;
    light?: number;
    deep?: number;
    rem?: number;
  };
  respiratory_rate?: number;
}

export interface WhoopRecoveryData {
  id?: string;
  score?: number; // 0-100
  hrv?: number; // milliseconds
  rhr?: number; // resting heart rate, beats per minute
  skin_temp?: number; // celsius
  spo2?: number; // percentage
  timestamp?: string; // ISO timestamp
}

export interface WhoopWorkoutData {
  id?: string;
  strain?: number; // 0-21
  calories?: number;
  avg_heart_rate?: number;
  max_heart_rate?: number;
  duration?: number; // seconds
  start?: string; // ISO timestamp
  end?: string; // ISO timestamp
}

export interface WhoopUserData {
  id?: string;
  name?: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
}

export interface WhoopData {
  user?: WhoopUserData;
  sleep?: WhoopSleepData[];
  recovery?: WhoopRecoveryData[];
  workout?: WhoopWorkoutData[];
  respiratory_rate?: Array<{
    value?: number;
    timestamp?: string;
  }>;
  heart_rate?: Array<{
    value?: number;
    timestamp?: string;
  }>;
}

/**
 * Parse Whoop device data JSON to Canonical Model
 */
export function parseWhoop(input: string): CanonicalModel {
  let data: WhoopData;
  
  try {
    data = JSON.parse(input);
  } catch (e) {
    throw new Error('Invalid JSON input for Whoop parser');
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

  // Parse Sleep Data
  if (data.sleep && Array.isArray(data.sleep)) {
    for (const sleep of data.sleep) {
      // Sleep Duration Observation
      if (sleep.duration !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '93832-4',
            display: 'Sleep duration'
          },
          value: sleep.duration,
          unit: 's',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: 's',
          date: sleep.start || sleep.end,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }],
          status: 'final'
        });
      }

      // Sleep Efficiency Observation
      if (sleep.efficiency !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '93830-8',
            display: 'Sleep efficiency'
          },
          value: sleep.efficiency,
          unit: '%',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: '%',
          date: sleep.start || sleep.end,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }],
          status: 'final'
        });
      }

      // Sleep Score Observation
      if (sleep.score !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '93833-2',
            display: 'Sleep quality score'
          },
          value: sleep.score,
          unit: '{score}',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: '{score}',
          date: sleep.start || sleep.end,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }],
          status: 'final'
        });
      }

      // Sleep Stage Observations (if cycles data available)
      if (sleep.cycles) {
        if (sleep.cycles.deep !== undefined) {
          observations.push({
            code: {
              system: 'http://loinc.org',
              code: '93835-7',
              display: 'Deep sleep duration'
            },
            value: sleep.cycles.deep,
            unit: 's',
            unitSystem: 'http://unitsofmeasure.org',
            unitCode: 's',
            date: sleep.start || sleep.end,
            status: 'final'
          });
        }

        if (sleep.cycles.rem !== undefined) {
          observations.push({
            code: {
              system: 'http://loinc.org',
              code: '93836-5',
              display: 'REM sleep duration'
            },
            value: sleep.cycles.rem,
            unit: 's',
            unitSystem: 'http://unitsofmeasure.org',
            unitCode: 's',
            date: sleep.start || sleep.end,
            status: 'final'
          });
        }

        if (sleep.cycles.light !== undefined) {
          observations.push({
            code: {
              system: 'http://loinc.org',
              code: '93837-3',
              display: 'Light sleep duration'
            },
            value: sleep.cycles.light,
            unit: 's',
            unitSystem: 'http://unitsofmeasure.org',
            unitCode: 's',
            date: sleep.start || sleep.end,
            status: 'final'
          });
        }
      }

      // Respiratory Rate during Sleep
      if (sleep.respiratory_rate !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '9279-1',
            display: 'Respiratory rate'
          },
          value: sleep.respiratory_rate,
          unit: '/min',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: '/min',
          date: sleep.start || sleep.end,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }],
          status: 'final'
        });
      }
    }
  }

  // Parse Recovery Data
  if (data.recovery && Array.isArray(data.recovery)) {
    for (const recovery of data.recovery) {
      // Heart Rate Variability (HRV)
      if (recovery.hrv !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '80404-7',
            display: 'R-R interval.standard deviation (SDNN) Heart rate variability'
          },
          value: recovery.hrv,
          unit: 'ms',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: 'ms',
          date: recovery.timestamp,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }],
          status: 'final'
        });
      }

      // Resting Heart Rate (RHR)
      if (recovery.rhr !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          },
          value: recovery.rhr,
          unit: '/min',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: '/min',
          date: recovery.timestamp,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }],
          status: 'final'
        });
      }

      // Recovery Score
      if (recovery.score !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '93834-0',
            display: 'Recovery score'
          },
          value: recovery.score,
          unit: '{score}',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: '{score}',
          date: recovery.timestamp,
          status: 'final'
        });
      }

      // Skin Temperature
      if (recovery.skin_temp !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body temperature'
          },
          value: recovery.skin_temp,
          unit: 'Cel',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: 'Cel',
          date: recovery.timestamp,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }],
          status: 'final'
        });
      }

      // SpO2
      if (recovery.spo2 !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '2708-6',
            display: 'Oxygen saturation in Arterial blood'
          },
          value: recovery.spo2,
          unit: '%',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: '%',
          date: recovery.timestamp,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }],
          status: 'final'
        });
      }
    }
  }

  // Parse Workout/Strain Data
  if (data.workout && Array.isArray(data.workout)) {
    for (const workout of data.workout) {
      // Strain Score
      if (workout.strain !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '93831-6',
            display: 'Physical activity strain score'
          },
          value: workout.strain,
          unit: '{score}',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: '{score}',
          date: workout.start || workout.end,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'activity',
            display: 'Activity'
          }],
          status: 'final'
        });
      }

      // Average Heart Rate during Workout
      if (workout.avg_heart_rate !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          },
          value: workout.avg_heart_rate,
          unit: '/min',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: '/min',
          date: workout.start || workout.end,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'activity',
            display: 'Activity'
          }],
          status: 'final'
        });
      }

      // Max Heart Rate during Workout
      if (workout.max_heart_rate !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          },
          value: workout.max_heart_rate,
          unit: '/min',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: '/min',
          date: workout.start || workout.end,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'activity',
            display: 'Activity'
          }],
          status: 'final'
        });
      }

      // Calories Burned
      if (workout.calories !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '41981-2',
            display: 'Calories burned'
          },
          value: workout.calories,
          unit: 'kcal',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: 'kcal',
          date: workout.start || workout.end,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'activity',
            display: 'Activity'
          }],
          status: 'final'
        });
      }

      // Workout Duration
      if (workout.duration !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '93829-0',
            display: 'Physical activity duration'
          },
          value: workout.duration,
          unit: 's',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: 's',
          date: workout.start || workout.end,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'activity',
            display: 'Activity'
          }],
          status: 'final'
        });
      }
    }
  }

  // Parse Respiratory Rate time-series data
  if (data.respiratory_rate && Array.isArray(data.respiratory_rate)) {
    for (const rr of data.respiratory_rate) {
      if (rr.value !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '9279-1',
            display: 'Respiratory rate'
          },
          value: rr.value,
          unit: '/min',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: '/min',
          date: rr.timestamp,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }],
          status: 'final'
        });
      }
    }
  }

  // Parse Heart Rate time-series data
  if (data.heart_rate && Array.isArray(data.heart_rate)) {
    for (const hr of data.heart_rate) {
      if (hr.value !== undefined) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          },
          value: hr.value,
          unit: '/min',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: '/min',
          date: hr.timestamp,
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }],
          status: 'final'
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

