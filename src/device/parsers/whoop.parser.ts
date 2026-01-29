import { CanonicalModel, CanonicalObservation, CanonicalPatient } from '../../shared/types/canonical.types.js';
import type { WhoopData, WhoopCycle, WhoopRecovery, WhoopSleep, WhoopWorkout } from '../types/whoop.types.js';

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
 * - workout (individual workout/session data)
 */
export function parseWhoop(input: string): CanonicalModel {
  let data: WhoopData;
  
  try {
    data = JSON.parse(input);
  } catch (e) {
    throw new Error('Invalid JSON input for Whoop parser');
  }

  // Store original request body as base64 in DocumentReference
  const originalDataBase64 = Buffer.from(input, 'utf8').toString('base64');

  const observations: CanonicalObservation[] = [];
  const defaultDeviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;

  // Helper function to create observations with common fields
  const createObservation = (
    code: { system: string; code: string; display: string },
    value: string | number,
    unit?: string,
    date?: string,
    deviceUid?: string,
    categoryCode: 'vital-signs' | 'activity' | 'exam' = 'vital-signs',
    categoryDisplay: string = categoryCode === 'vital-signs' ? 'Vital Signs' : categoryCode === 'activity' ? 'Activity' : 'Exam'
  ): CanonicalObservation => {
    const observation: CanonicalObservation = {
      code,
      value,
      date,
      device: {
        uid: deviceUid
      },
      status: 'final'
    };

    if (unit) {
      observation.unit = unit;
      observation.unitSystem = 'http://unitsofmeasure.org';
      observation.unitCode = unit;
    }

    // Add category if provided
    if (categoryCode) {
      observation.category = [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: categoryCode,
        display: categoryDisplay
      }];
    }

    return observation;
  };
  
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

  // Helper function to create a unique key for recovery deduplication
  const getRecoveryKey = (recovery: WhoopRecovery): string => {
    const score = recovery.score;
    return `${recovery.cycle_id}_${recovery.created_at}_${score.recovery_score}_${score.resting_heart_rate}_${score.hrv_rmssd_milli}_${score.spo2_percentage}_${score.skin_temp_celsius}`;
  };

  // Parse Recovery Data - Single Observation with Components
  // Handle both single recovery and array of recoveries (for real-time data)
  const recoveryData = data.recovery;
  if (recoveryData) {
    const recoveries = Array.isArray(recoveryData) ? recoveryData : [recoveryData];
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;
    
    // Deduplicate recoveries based on cycle_id, created_at, and score values
    const seenRecoveries = new Set<string>();
    const uniqueRecoveries: WhoopRecovery[] = [];

    for (const recovery of recoveries) {
      if (!recovery?.score) continue;
      
      const recoveryKey = getRecoveryKey(recovery);
      
      // Only process recoveries we haven't seen before
      if (!seenRecoveries.has(recoveryKey)) {
        seenRecoveries.add(recoveryKey);
        uniqueRecoveries.push(recovery);
      }
    }

    // Process each unique recovery
    for (const recovery of uniqueRecoveries) {
      const score = recovery.score;
      const recoveryDate = recovery.created_at || recovery.updated_at;

      // Build components array for recovery metrics
      const recoveryComponents: Array<{
        code: { system: string; code: string; display: string };
        valueQuantity?: { value: number; unit: string; system?: string; code?: string };
        valueInteger?: number;
        valueBoolean?: boolean;
        valueCodeableConcept?: {
          system?: string;
          code?: string;
          display?: string;
        };
      }> = [];

      // Recovery Score (device-specific, use local code)
      if (score.recovery_score !== undefined) {
        recoveryComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-recovery-score',
            display: 'Recovery Score'
          },
          valueQuantity: {
            value: Math.round(score.recovery_score),
            unit: '{score}',
            system: 'http://unitsofmeasure.org',
            code: '{score}'
          }
        });
      }

      // Resting Heart Rate (valid LOINC code)
      if (score.resting_heart_rate !== undefined) {
        recoveryComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          },
          valueQuantity: {
            value: score.resting_heart_rate,
            unit: 'beats/min',
            system: 'http://unitsofmeasure.org',
            code: '/min'
          }
        });
      }

      // HRV RMSSD (valid LOINC code)
      if (score.hrv_rmssd_milli !== undefined) {
        recoveryComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '80404-7',
            display: 'R-R interval.standard deviation (Heart rate variability)'
          },
          valueQuantity: {
            value: score.hrv_rmssd_milli,
            unit: 'ms',
            system: 'http://unitsofmeasure.org',
            code: 'ms'
          }
        });
      }

      // SpO2 (valid LOINC code)
      if (score.spo2_percentage !== undefined) {
        recoveryComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '2708-6',
            display: 'Oxygen saturation in Arterial blood'
          },
          valueQuantity: {
            value: score.spo2_percentage,
            unit: '%',
            system: 'http://unitsofmeasure.org',
            code: '%'
          }
        });
      }

      // Skin Temperature (valid LOINC code)
      if (score.skin_temp_celsius !== undefined) {
        recoveryComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '8310-5',
            display: 'Body temperature'
          },
          valueQuantity: {
            value: score.skin_temp_celsius,
            unit: '°C',
            system: 'http://unitsofmeasure.org',
            code: 'Cel'
          }
        });
      }

      // User Calibrating Status (device-specific, use local code)
      if (score.user_calibrating !== undefined) {
        recoveryComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-device-calibrating',
            display: 'Device Calibration Status'
          },
          valueCodeableConcept: {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0136',
            code: score.user_calibrating ? 'Y' : 'N',
            display: score.user_calibrating ? 'Yes' : 'No'
          }
        });
      }

      // Create single Recovery Observation with all components
      if (recoveryComponents.length > 0) {
        observations.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-recovery-summary',
            display: 'WHOOP Recovery Summary'
          },
          date: recoveryDate,
          device: {
            uid: deviceUid
          },
          status: 'final',
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'activity',
            display: 'Activity'
          }],
          components: recoveryComponents
        });
      }
    }
  }

  // Helper function to create a unique key for cycle deduplication
  const getCycleKey = (cycle: WhoopCycle): string => {
    const score = cycle.score;
    return `${cycle.start || cycle.created_at}_${score.strain}_${score.kilojoule}_${score.average_heart_rate}_${score.max_heart_rate}`;
  };

  // Helper function to create a unique key for workout deduplication
  const getWorkoutKey = (workout: WhoopWorkout): string => {
    const score = workout.score;
    return `${workout.id}_${workout.start}_${workout.end}_${score.strain}_${score.kilojoule}_${score.average_heart_rate}_${score.max_heart_rate}`;
  };

  // Parse Cycle (Strain/Workout) Data
  // Handle both single cycle and array of cycles (for real-time data)
  const cycleData = data.cycle;
  if (cycleData) {
    const cycles = Array.isArray(cycleData) ? cycleData : [cycleData];
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;
    
    // Deduplicate cycles based on start time and score values
    // This prevents creating duplicate observations for the same cycle data
    const seenCycles = new Set<string>();
    const uniqueCycles: WhoopCycle[] = [];

    for (const cycle of cycles) {
      if (!cycle?.score) continue;
      
      const cycleKey = getCycleKey(cycle);
      
      // Only process cycles we haven't seen before
      if (!seenCycles.has(cycleKey)) {
        seenCycles.add(cycleKey);
        uniqueCycles.push(cycle);
      }
    }

    // Process each unique cycle as a single Observation with components
    for (const cycle of uniqueCycles) {
      const score = cycle.score;
      const cycleDate = cycle.start || cycle.created_at;

      const cycleComponents: Array<{
        code: { system: string; code: string; display: string };
        valueQuantity?: { value: number; unit: string; system?: string; code?: string };
        valueInteger?: number;
        valueBoolean?: boolean;
        valueCodeableConcept?: {
          system?: string;
          code?: string;
          display?: string;
        };
      }> = [];

      // Strain Score (device-specific, use local code since 93831-6 is actually for Deep sleep duration)
      if (score.strain !== undefined) {
        cycleComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-strain-score',
            display: 'Physical activity strain score'
          },
          valueQuantity: {
            value: Math.round(score.strain),
            unit: '{score}',
            system: 'http://unitsofmeasure.org',
            code: '{score}'
          }
        });
      }

      // Calories/Kilojoules
      if (score.kilojoule !== undefined) {
        const calories = score.kilojoule * 0.239006;
        cycleComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '41981-2',
            display: 'Calories burned'
          },
          valueQuantity: {
            value: Math.round(calories),
            unit: 'kcal',
            system: 'http://unitsofmeasure.org',
            code: 'kcal'
          }
        });
      }

      // Average Heart Rate during Cycle
      if (score.average_heart_rate !== undefined) {
        cycleComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          },
          valueQuantity: {
            value: score.average_heart_rate,
            unit: 'beats/min',
            system: 'http://unitsofmeasure.org',
            code: '/min'
          }
        });
      }

      // Max Heart Rate during Cycle
      if (score.max_heart_rate !== undefined) {
        cycleComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          },
          valueQuantity: {
            value: score.max_heart_rate,
            unit: 'beats/min',
            system: 'http://unitsofmeasure.org',
            code: '/min'
          }
        });
      }

      if (cycleComponents.length > 0) {
        observations.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-cycle-summary',
            display: 'WHOOP Cycle Summary'
          },
          effectivePeriod: cycle.start && cycle.end ? {
            start: cycle.start,
            end: cycle.end
          } : undefined,
          date: cycleDate,
          device: {
            uid: deviceUid
          },
          status: 'final',
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'activity',
            display: 'Activity'
          }],
          components: cycleComponents
        });
      }
    }
  }

  // Helper function to create a unique key for sleep deduplication
  const getSleepKey = (sleep: WhoopSleep): string => {
    const score = sleep.score;
    const stageSummary = score.stage_summary;
    return `${sleep.id}_${sleep.start}_${sleep.end}_${stageSummary?.total_in_bed_time_milli}_${score.sleep_efficiency_percentage}_${score.sleep_performance_percentage}`;
  };

  // Parse Sleep Data - Single Observation with Components
  // Handle both single sleep and array of sleeps (for real-time data)
  const sleepData = data.sleep;
  if (sleepData) {
    const sleeps = Array.isArray(sleepData) ? sleepData : [sleepData];
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;
    
    // Deduplicate sleeps based on id, start, end, and score values
    const seenSleeps = new Set<string>();
    const uniqueSleeps: WhoopSleep[] = [];

    for (const sleep of sleeps) {
      if (!sleep?.score) continue;
      
      const sleepKey = getSleepKey(sleep);
      
      // Only process sleeps we haven't seen before
      if (!seenSleeps.has(sleepKey)) {
        seenSleeps.add(sleepKey);
        uniqueSleeps.push(sleep);
      }
    }

    // Process each unique sleep
    for (const sleep of uniqueSleeps) {
      const score = sleep.score;
      const stageSummary = score.stage_summary;

      // Build components array for sleep metrics
      const sleepComponents: Array<{
        code: { system: string; code: string; display: string };
        valueQuantity?: { value: number; unit: string; system?: string; code?: string };
        valueInteger?: number;
        valueBoolean?: boolean;
        valueCodeableConcept?: {
          system?: string;
          code?: string;
          display?: string;
        };
      }> = [];

      // Total Sleep Time (total time in bed) - use local code to avoid constraint violation
      // (Observation code is 93832-4, so component can't use same code)
      if (stageSummary?.total_in_bed_time_milli !== undefined) {
        const durationSeconds = Math.round(stageSummary.total_in_bed_time_milli / 1000);
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-total-sleep-time',
            display: 'Total Sleep Time'
          },
          valueQuantity: {
            value: durationSeconds,
            unit: 'seconds',
            system: 'http://unitsofmeasure.org',
            code: 's'
          }
        });
      }

      // Sleep Efficiency (device-specific, use local code)
      if (score.sleep_efficiency_percentage !== undefined) {
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-sleep-efficiency',
            display: 'Sleep Efficiency'
          },
          valueQuantity: {
            value: score.sleep_efficiency_percentage,
            unit: '%',
            system: 'http://unitsofmeasure.org',
            code: '%'
          }
        });
      }

      // Sleep Performance (device-specific, use local code)
      if (score.sleep_performance_percentage !== undefined) {
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-sleep-performance',
            display: 'Sleep Performance'
          },
          valueQuantity: {
            value: Math.round(score.sleep_performance_percentage),
            unit: '{score}',
            system: 'http://unitsofmeasure.org',
            code: '{score}'
          }
        });
      }

      // Sleep Consistency (device-specific, use local code)
      if (score.sleep_consistency_percentage !== undefined) {
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-sleep-consistency',
            display: 'Sleep Consistency'
          },
          valueQuantity: {
            value: score.sleep_consistency_percentage,
            unit: '%',
            system: 'http://unitsofmeasure.org',
            code: '%'
          }
        });
      }

      // Deep Sleep (Slow Wave Sleep) (device-specific, use local code)
      if (stageSummary?.total_slow_wave_sleep_time_milli !== undefined) {
        const durationSeconds = Math.round(stageSummary.total_slow_wave_sleep_time_milli / 1000);
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-slow-wave-sleep',
            display: 'Slow Wave Sleep'
          },
          valueQuantity: {
            value: durationSeconds,
            unit: 'seconds',
            system: 'http://unitsofmeasure.org',
            code: 's'
          }
        });
      }

      // REM Sleep (device-specific, use local code)
      if (stageSummary?.total_rem_sleep_time_milli !== undefined) {
        const durationSeconds = Math.round(stageSummary.total_rem_sleep_time_milli / 1000);
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-rem-sleep',
            display: 'REM Sleep'
          },
          valueQuantity: {
            value: durationSeconds,
            unit: 'seconds',
            system: 'http://unitsofmeasure.org',
            code: 's'
          }
        });
      }

      // Light Sleep (device-specific, use local code)
      if (stageSummary?.total_light_sleep_time_milli !== undefined) {
        const durationSeconds = Math.round(stageSummary.total_light_sleep_time_milli / 1000);
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-light-sleep',
            display: 'Light Sleep'
          },
          valueQuantity: {
            value: durationSeconds,
            unit: 'seconds',
            system: 'http://unitsofmeasure.org',
            code: 's'
          }
        });
      }

      // Awake Time (device-specific, use local code)
      if (stageSummary?.total_awake_time_milli !== undefined) {
        const durationSeconds = Math.round(stageSummary.total_awake_time_milli / 1000);
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-awake-time',
            display: 'Awake Time'
          },
          valueQuantity: {
            value: durationSeconds,
            unit: 'seconds',
            system: 'http://unitsofmeasure.org',
            code: 's'
          }
        });
      }

      // Respiratory Rate during Sleep (valid LOINC code)
      if (score.respiratory_rate !== undefined) {
        sleepComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '9279-1',
            display: 'Respiratory rate'
          },
          valueQuantity: {
            value: score.respiratory_rate,
            unit: 'breaths/min',
            system: 'http://unitsofmeasure.org',
            code: '/min'
          }
        });
      }

      // Sleep Cycles Count (device-specific, use local code)
      if (stageSummary?.sleep_cycle_count !== undefined) {
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-sleep-cycle-count',
            display: 'Sleep Cycle Count'
          },
          valueQuantity: {
            value: stageSummary.sleep_cycle_count,
            unit: '{count}',
            system: 'http://unitsofmeasure.org',
            code: '{count}'
          }
        });
      }

      // Disturbance Count (device-specific, use local code)
      if (stageSummary?.disturbance_count !== undefined) {
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-sleep-disturbance-count',
            display: 'Disturbance Count'
          },
          valueQuantity: {
            value: stageSummary.disturbance_count,
            unit: '{count}',
            system: 'http://unitsofmeasure.org',
            code: '{count}'
          }
        });
      }

      // Total No Data Time (device-specific, use local code)
      if (stageSummary?.total_no_data_time_milli !== undefined) {
        const durationSeconds = Math.round(stageSummary.total_no_data_time_milli / 1000);
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-sleep-data-gap',
            display: 'Sleep Data Gap Duration'
          },
          valueQuantity: {
            value: durationSeconds,
            unit: 'seconds',
            system: 'http://unitsofmeasure.org',
            code: 's'
          }
        });
      }

      // Sleep Needed Metrics (device-specific, use local codes)
      if (score.sleep_needed) {
        const sleepNeeded = score.sleep_needed;

        // Baseline Sleep Need
        if (sleepNeeded.baseline_milli !== undefined) {
          const durationSeconds = Math.round(sleepNeeded.baseline_milli / 1000);
          sleepComponents.push({
            code: {
              system: 'urn:hl7-org:local',
              code: 'whoop-baseline-sleep-need',
              display: 'Baseline Sleep Need'
            },
            valueQuantity: {
              value: durationSeconds,
              unit: 'seconds',
              system: 'http://unitsofmeasure.org',
              code: 's'
            }
          });
        }

        // Sleep Need from Sleep Debt
        if (sleepNeeded.need_from_sleep_debt_milli !== undefined) {
          const durationSeconds = Math.round(sleepNeeded.need_from_sleep_debt_milli / 1000);
          sleepComponents.push({
            code: {
              system: 'urn:hl7-org:local',
              code: 'whoop-sleep-need-debt',
              display: 'Sleep Need from Sleep Debt'
            },
            valueQuantity: {
              value: durationSeconds,
              unit: 'seconds',
              system: 'http://unitsofmeasure.org',
              code: 's'
            }
          });
        }

        // Sleep Need from Recent Strain
        if (sleepNeeded.need_from_recent_strain_milli !== undefined) {
          const durationSeconds = Math.round(sleepNeeded.need_from_recent_strain_milli / 1000);
          sleepComponents.push({
            code: {
              system: 'urn:hl7-org:local',
              code: 'whoop-sleep-need-strain',
              display: 'Sleep Need from Recent Strain'
            },
            valueQuantity: {
              value: durationSeconds,
              unit: 'seconds',
              system: 'http://unitsofmeasure.org',
              code: 's'
            }
          });
        }

        // Sleep Need from Recent Nap
        if (sleepNeeded.need_from_recent_nap_milli !== undefined) {
          const durationSeconds = Math.round(sleepNeeded.need_from_recent_nap_milli / 1000);
          sleepComponents.push({
            code: {
              system: 'urn:hl7-org:local',
              code: 'whoop-sleep-need-nap',
              display: 'Sleep Need from Recent Nap'
            },
            valueQuantity: {
              value: durationSeconds,
              unit: 'seconds',
              system: 'http://unitsofmeasure.org',
              code: 's'
            }
          });
        }
      }

      // Nap Indicator (device-specific, use local code)
      if (sleep.nap !== undefined) {
        sleepComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-nap-indicator',
            display: 'Nap Indicator'
          },
          valueCodeableConcept: {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0136',
            code: sleep.nap ? 'Y' : 'N',
            display: sleep.nap ? 'Yes' : 'No'
          }
        });
      }

      // Create single Sleep Observation with all components
      if (sleepComponents.length > 0) {
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '93832-4',
            display: 'Sleep duration'
          },
          effectivePeriod: sleep.start && sleep.end ? {
            start: sleep.start,
            end: sleep.end
          } : undefined,
          date: sleep.start || sleep.end,
          device: {
            uid: deviceUid
          },
          status: 'final',
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }, {
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'activity',
            display: 'Activity'
          }],
          components: sleepComponents
        });
      }
    }
  }

  // Parse Body Measurements
  if (data.body) {
    const body = data.body;

    // Height (convert meters to centimeters for UCUM compliance)
    if (body.height_meter !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '8302-2',
          display: 'Body height'
        },
        body.height_meter * 100, // Convert meters to centimeters
        'cm',
        undefined,
        `whoop-device-${data.profile?.user_id || 'unknown'}`,
        'vital-signs'
      ));
    }

    // Weight
    if (body.weight_kilogram !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '29463-7',
          display: 'Body weight'
        },
        body.weight_kilogram,
        'kg',
        undefined,
        `whoop-device-${data.profile?.user_id || 'unknown'}`,
        'vital-signs'
      ));
    }

    // Calculate BMI if both height and weight are available
    if (body.height_meter && body.weight_kilogram) {
      const bmi = body.weight_kilogram / (body.height_meter * body.height_meter);
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '39156-5',
          display: 'Body mass index (BMI) [Ratio]'
        },
        Math.round(bmi * 10) / 10, // Round to 1 decimal
        'kg/m2',
        undefined,
        `whoop-device-${data.profile?.user_id || 'unknown'}`,
        'vital-signs'
      ));
    }

    // Max Heart Rate
    if (body.max_heart_rate !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate'
        },
        body.max_heart_rate,
        '/min',
        undefined,
        `whoop-device-${data.profile?.user_id || 'unknown'}`,
        'vital-signs'
      ));
    }
  }

  // Parse Workout Data
  // Handle both single workout and array of workouts (for real-time data)
  const workoutData = data.workout;
  if (workoutData) {
    const workouts = Array.isArray(workoutData) ? workoutData : [workoutData];
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;
    
    // Deduplicate workouts based on id, start, end, and score values
    const seenWorkouts = new Set<string>();
    const uniqueWorkouts: WhoopWorkout[] = [];

    for (const workout of workouts) {
      if (!workout?.score) continue;
      
      const workoutKey = getWorkoutKey(workout);
      
      // Only process workouts we haven't seen before
      if (!seenWorkouts.has(workoutKey)) {
        seenWorkouts.add(workoutKey);
        uniqueWorkouts.push(workout);
      }
    }

    // Process each unique workout as a single Observation with components
    for (const workout of uniqueWorkouts) {
      const score = workout.score;
      const workoutDate = workout.start || workout.created_at;

      const workoutComponents: Array<{
        code: { system: string; code: string; display: string };
        valueQuantity?: { value: number; unit: string; system?: string; code?: string };
        valueInteger?: number;
        valueBoolean?: boolean;
        valueCodeableConcept?: {
          system?: string;
          code?: string;
          display?: string;
        };
      }> = [];

      // Strain Score
      if (score.strain !== undefined) {
        workoutComponents.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-strain-score',
            display: 'Physical activity strain score'
          },
          valueQuantity: {
            value: score.strain,
            unit: '{score}',
            system: 'http://unitsofmeasure.org',
            code: '{score}'
          }
        });
      }

      // Calories/Kilojoules
      if (score.kilojoule !== undefined) {
        const calories = score.kilojoule * 0.239006;
        workoutComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '41981-2',
            display: 'Calories burned'
          },
          valueQuantity: {
            value: Math.round(calories),
            unit: 'kcal',
            system: 'http://unitsofmeasure.org',
            code: 'kcal'
          }
        });
      }

      // Average Heart Rate during Workout
      if (score.average_heart_rate !== undefined) {
        workoutComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          },
          valueQuantity: {
            value: score.average_heart_rate,
            unit: 'beats/min',
            system: 'http://unitsofmeasure.org',
            code: '/min'
          }
        });
      }

      // Max Heart Rate during Workout
      if (score.max_heart_rate !== undefined) {
        workoutComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          },
          valueQuantity: {
            value: score.max_heart_rate,
            unit: 'beats/min',
            system: 'http://unitsofmeasure.org',
            code: '/min'
          }
        });
      }

      // Distance
      if (score.distance_meter !== undefined) {
        const distanceKm = score.distance_meter / 1000;
        workoutComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '55423-8',
            display: 'Distance traveled'
          },
          valueQuantity: {
            value: Math.round(distanceKm * 100) / 100,
            unit: 'km',
            system: 'http://unitsofmeasure.org',
            code: 'km'
          }
        });
      }

      // Altitude Gain
      if (score.altitude_gain_meter !== undefined) {
        workoutComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '93848-0',
            display: 'Elevation gain'
          },
          valueQuantity: {
            value: Math.round(score.altitude_gain_meter * 100) / 100,
            unit: 'm',
            system: 'http://unitsofmeasure.org',
            code: 'm'
          }
        });
      }

      // Altitude Change
      if (score.altitude_change_meter !== undefined) {
        workoutComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '93849-8',
            display: 'Elevation change'
          },
          valueQuantity: {
            value: Math.round(score.altitude_change_meter * 100) / 100,
            unit: 'm',
            system: 'http://unitsofmeasure.org',
            code: 'm'
          }
        });
      }

      // Percent Recorded
      if (score.percent_recorded !== undefined) {
        workoutComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '93850-6',
            display: 'Workout data completeness percentage'
          },
          valueQuantity: {
            value: score.percent_recorded,
            unit: '%',
            system: 'http://unitsofmeasure.org',
            code: '%'
          }
        });
      }

      // Sport Name (as a codeable concept)
      if (workout.sport_name) {
        workoutComponents.push({
          code: {
            system: 'http://loinc.org',
            code: '93851-4',
            display: 'Exercise type'
          },
          valueCodeableConcept: {
            system: 'urn:hl7-org:local',
            code: workout.sport_id?.toString(),
            display: workout.sport_name
          }
        });
      }

      // Zone Durations (if available)
      if (score.zone_durations && Object.keys(score.zone_durations).length > 0) {
        for (const [zoneName, durationMs] of Object.entries(score.zone_durations)) {
          const durationSeconds = Math.round((durationMs as number) / 1000);
          workoutComponents.push({
            code: {
              system: 'http://loinc.org',
              code: '93852-2',
              display: `Heart rate zone duration: ${zoneName}`
            },
            valueQuantity: {
              value: durationSeconds,
              unit: 's',
              system: 'http://unitsofmeasure.org',
              code: 's'
            }
          });
        }
      }

      if (workoutComponents.length > 0) {
        observations.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'whoop-workout-summary',
            display: 'WHOOP Workout Summary'
          },
          effectivePeriod: workout.start && workout.end ? {
            start: workout.start,
            end: workout.end
          } : undefined,
          date: workoutDate,
          device: {
            uid: deviceUid
          },
          status: 'final',
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'activity',
            display: 'Activity'
          }],
          components: workoutComponents
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
          title: 'Whoop API Original Request Data',
          format: 'json'
        }
      }]
    }]
  };

  return result;
}
