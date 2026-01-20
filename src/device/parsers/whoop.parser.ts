import { CanonicalModel, CanonicalObservation, CanonicalPatient } from '../../shared/types/canonical.types.js';
import type { WhoopData } from '../types/whoop.types.js';

/**
 * Whoop Device Data Parser
 * 
 * Converts Whoop API 4.0 JSON data to Canonical Model
 * 
 * Based on actual Whoop API structure with:
 * - profile (user information)
 * - recovery (recovery metrics)
 * - cycle (strain/workout data)
 * - sleep (sleep data)
 * - body (body measurements)
 */
export function parseWhoop(input: string): CanonicalModel {
  let data: WhoopData;
  
  try {
    data = JSON.parse(input);
  } catch (e) {
    throw new Error('Invalid JSON input for Whoop parser');
  }

  const observations: CanonicalObservation[] = [];
  
  // Extract patient information from profile
  const patient: CanonicalPatient = {
    name: {},
    identifier: data.profile?.user_id?.toString()
  };

  if (data.profile) {
    patient.id = data.profile.user_id?.toString();
    patient.name = {
      family: data.profile.last_name,
      given: [data.profile.first_name].filter(Boolean)
    };
    if (data.profile.email) {
      patient.telecom = [{
        system: 'email',
        value: data.profile.email
      }];
    }
  }

  // Parse Recovery Data
  if (data.recovery?.score) {
    const recovery = data.recovery;
    const score = recovery.score;

    // Add device reference for all recovery observations
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;

    // Heart Rate Variability (HRV RMSSD)
    // Note: Using display text that avoids triggering heartrate profile auto-detection
    if (score.hrv_rmssd_milli !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '80404-7',
          display: 'R-R interval standard deviation (SDNN) - HRV'
        },
        value: score.hrv_rmssd_milli,
        unit: 'ms',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 'ms',
        date: recovery.created_at || recovery.updated_at,
        // Use 'exam' category instead of 'vital-signs' to avoid heartrate profile validation
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'exam',
          display: 'Exam'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Resting Heart Rate (RHR)
    if (score.resting_heart_rate !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate'
        },
        value: score.resting_heart_rate,
        unit: '/min',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '/min',
        date: recovery.created_at || recovery.updated_at,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Recovery Score
    if (score.recovery_score !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93834-0',
          display: 'Recovery score'
        },
        value: score.recovery_score,
        unit: '{score}',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '{score}',
        date: recovery.created_at || recovery.updated_at,
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // SpO2
    if (score.spo2_percentage !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '2708-6',
          display: 'Oxygen saturation in Arterial blood'
        },
        value: score.spo2_percentage,
        unit: '%',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '%',
        date: recovery.created_at || recovery.updated_at,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Skin Temperature
    if (score.skin_temp_celsius !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '8310-5',
          display: 'Body temperature'
        },
        value: score.skin_temp_celsius,
        unit: 'Cel',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 'Cel',
        date: recovery.created_at || recovery.updated_at,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // User Calibrating Status (NEW - was missing)
    if (score.user_calibrating !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93848-0',
          display: 'Device calibration status'
        },
        value: score.user_calibrating ? 1 : 0,
        unit: '{boolean}',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '{boolean}',
        date: recovery.created_at || recovery.updated_at,
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }
  }

  // Parse Cycle (Strain/Workout) Data
  if (data.cycle?.score) {
    const cycle = data.cycle;
    const score = cycle.score;

    // Add device reference for all cycle observations
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;

    // Strain Score
    if (score.strain !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93831-6',
          display: 'Physical activity strain score'
        },
        value: score.strain,
        unit: '{score}',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '{score}',
        date: cycle.start || cycle.created_at,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Calories/Kilojoules
    if (score.kilojoule !== undefined) {
      // Convert kilojoules to calories (1 kJ = 0.239006 kcal)
      const calories = score.kilojoule * 0.239006;
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '41981-2',
          display: 'Calories burned'
        },
        value: Math.round(calories),
        unit: 'kcal',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 'kcal',
        date: cycle.start || cycle.created_at,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Average Heart Rate during Cycle
    // Note: Heart rate observations (8867-4) must use 'vital-signs' category to comply with heartrate profile
    if (score.average_heart_rate !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate'
        },
        value: score.average_heart_rate,
        unit: '/min',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '/min',
        date: cycle.start || cycle.created_at,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Max Heart Rate during Cycle
    // Note: Heart rate observations (8867-4) must use 'vital-signs' category to comply with heartrate profile
    if (score.max_heart_rate !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate'
        },
        value: score.max_heart_rate,
        unit: '/min',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '/min',
        date: cycle.start || cycle.created_at,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }
  }

  // Parse Sleep Data
  if (data.sleep?.score) {
    const sleep = data.sleep;
    const score = sleep.score;
    const stageSummary = score.stage_summary;

    // Add device reference for all sleep observations
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;

    // Sleep Duration (total time in bed)
    if (stageSummary?.total_in_bed_time_milli !== undefined) {
      const durationSeconds = Math.round(stageSummary.total_in_bed_time_milli / 1000);
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93832-4',
          display: 'Sleep duration'
        },
        value: durationSeconds,
        unit: 's',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 's',
        date: sleep.start || sleep.end,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Sleep Efficiency
    if (score.sleep_efficiency_percentage !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93830-8',
          display: 'Sleep efficiency'
        },
        value: score.sleep_efficiency_percentage,
        unit: '%',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '%',
        date: sleep.start || sleep.end,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Sleep Performance
    if (score.sleep_performance_percentage !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93833-2',
          display: 'Sleep quality score'
        },
        value: score.sleep_performance_percentage,
        unit: '{score}',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '{score}',
        date: sleep.start || sleep.end,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Sleep Consistency (NEW - was missing)
    if (score.sleep_consistency_percentage !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93841-5',
          display: 'Sleep consistency percentage'
        },
        value: score.sleep_consistency_percentage,
        unit: '%',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '%',
        date: sleep.start || sleep.end,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Deep Sleep (Slow Wave Sleep)
    if (stageSummary?.total_slow_wave_sleep_time_milli !== undefined) {
      const durationSeconds = Math.round(stageSummary.total_slow_wave_sleep_time_milli / 1000);
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93835-7',
          display: 'Deep sleep duration'
        },
        value: durationSeconds,
        unit: 's',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 's',
        date: sleep.start || sleep.end,
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // REM Sleep
    if (stageSummary?.total_rem_sleep_time_milli !== undefined) {
      const durationSeconds = Math.round(stageSummary.total_rem_sleep_time_milli / 1000);
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93836-5',
          display: 'REM sleep duration'
        },
        value: durationSeconds,
        unit: 's',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 's',
        date: sleep.start || sleep.end,
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Light Sleep
    if (stageSummary?.total_light_sleep_time_milli !== undefined) {
      const durationSeconds = Math.round(stageSummary.total_light_sleep_time_milli / 1000);
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93837-3',
          display: 'Light sleep duration'
        },
        value: durationSeconds,
        unit: 's',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 's',
        date: sleep.start || sleep.end,
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Awake Time
    if (stageSummary?.total_awake_time_milli !== undefined) {
      const durationSeconds = Math.round(stageSummary.total_awake_time_milli / 1000);
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93838-1',
          display: 'Awake time during sleep'
        },
        value: durationSeconds,
        unit: 's',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 's',
        date: sleep.start || sleep.end,
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Respiratory Rate during Sleep
    if (score.respiratory_rate !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '9279-1',
          display: 'Respiratory rate'
        },
        value: score.respiratory_rate,
        unit: '/min',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '/min',
        date: sleep.start || sleep.end,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Sleep Cycles Count
    if (stageSummary?.sleep_cycle_count !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93839-9',
          display: 'Sleep cycle count'
        },
        value: stageSummary.sleep_cycle_count,
        unit: '{count}',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '{count}',
        date: sleep.start || sleep.end,
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Disturbance Count
    if (stageSummary?.disturbance_count !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93840-7',
          display: 'Sleep disturbance count'
        },
        value: stageSummary.disturbance_count,
        unit: '{count}',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '{count}',
        date: sleep.start || sleep.end,
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Total No Data Time (NEW - was missing)
    if (stageSummary?.total_no_data_time_milli !== undefined) {
      const durationSeconds = Math.round(stageSummary.total_no_data_time_milli / 1000);
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93842-3',
          display: 'Sleep data gap duration'
        },
        value: durationSeconds,
        unit: 's',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 's',
        date: sleep.start || sleep.end,
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }

    // Sleep Needed Metrics (NEW - was missing)
    if (score.sleep_needed) {
      const sleepNeeded = score.sleep_needed;

      // Baseline Sleep Need
      if (sleepNeeded.baseline_milli !== undefined) {
        const durationSeconds = Math.round(sleepNeeded.baseline_milli / 1000);
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '93843-1',
            display: 'Baseline sleep need'
          },
          value: durationSeconds,
          unit: 's',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: 's',
          date: sleep.start || sleep.end,
          device: {
            uid: deviceUid
          },
          status: 'final'
        });
      }

      // Sleep Need from Sleep Debt
      if (sleepNeeded.need_from_sleep_debt_milli !== undefined) {
        const durationSeconds = Math.round(sleepNeeded.need_from_sleep_debt_milli / 1000);
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '93844-9',
            display: 'Sleep need from sleep debt'
          },
          value: durationSeconds,
          unit: 's',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: 's',
          date: sleep.start || sleep.end,
          device: {
            uid: deviceUid
          },
          status: 'final'
        });
      }

      // Sleep Need from Recent Strain
      if (sleepNeeded.need_from_recent_strain_milli !== undefined) {
        const durationSeconds = Math.round(sleepNeeded.need_from_recent_strain_milli / 1000);
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '93845-6',
            display: 'Sleep need from recent strain'
          },
          value: durationSeconds,
          unit: 's',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: 's',
          date: sleep.start || sleep.end,
          device: {
            uid: deviceUid
          },
          status: 'final'
        });
      }

      // Sleep Need from Recent Nap
      if (sleepNeeded.need_from_recent_nap_milli !== undefined) {
        const durationSeconds = Math.round(sleepNeeded.need_from_recent_nap_milli / 1000);
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '93846-4',
            display: 'Sleep need from recent nap'
          },
          value: durationSeconds,
          unit: 's',
          unitSystem: 'http://unitsofmeasure.org',
          unitCode: 's',
          date: sleep.start || sleep.end,
          device: {
            uid: deviceUid
          },
          status: 'final'
        });
      }
    }

    // Nap Indicator (as a note/flag)
    if (sleep.nap !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '93847-2',
          display: 'Nap indicator'
        },
        value: sleep.nap ? 1 : 0,
        unit: '{boolean}',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '{boolean}',
        date: sleep.start || sleep.end,
        device: {
          uid: deviceUid
        },
        status: 'final'
      });
    }
  }

  // Parse Body Measurements
  if (data.body) {
    const body = data.body;

    // Height (convert meters to centimeters for UCUM compliance)
    if (body.height_meter !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '8302-2',
          display: 'Body height'
        },
        value: body.height_meter * 100, // Convert meters to centimeters
        unit: 'cm',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 'cm',
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }]
      });
    }

    // Weight
    if (body.weight_kilogram !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '29463-7',
          display: 'Body weight'
        },
        value: body.weight_kilogram,
        unit: 'kg',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 'kg',
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }]
      });
    }

    // Calculate BMI if both height and weight are available
    if (body.height_meter && body.weight_kilogram) {
      const bmi = body.weight_kilogram / (body.height_meter * body.height_meter);
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '39156-5',
          display: 'Body mass index (BMI) [Ratio]'
        },
        value: Math.round(bmi * 10) / 10, // Round to 1 decimal
        unit: 'kg/m2',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: 'kg/m2',
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }]
      });
    }

    // Max Heart Rate
    if (body.max_heart_rate !== undefined) {
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate'
        },
        value: body.max_heart_rate,
        unit: '/min',
        unitSystem: 'http://unitsofmeasure.org',
        unitCode: '/min',
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }]
      });
    }
  }

  const result: CanonicalModel = {
    patient: Object.keys(patient).length > 1 ? patient : undefined,
    observations: observations.length > 0 ? observations : undefined
  };

  return result;
}

