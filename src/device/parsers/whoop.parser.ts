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
  
  // Helper function to create observations with common fields
  const createObservation = (
    code: { system: string; code: string; display: string },
    value: string | number,
    unit: string,
    date: string | undefined,
    deviceUid: string,
    categoryCode: 'vital-signs' | 'activity' | 'exam' = 'vital-signs',
    categoryDisplay: string = categoryCode === 'vital-signs' ? 'Vital Signs' : categoryCode === 'activity' ? 'Activity' : 'Exam'
  ): CanonicalObservation => {
    const observation: CanonicalObservation = {
      code,
      value,
      unit,
      unitSystem: 'http://unitsofmeasure.org',
      unitCode: unit,
      date,
      device: {
        uid: deviceUid
      },
      status: 'final'
    };

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

  // Parse Recovery Data - Single Observation with Components
  if (data.recovery?.score) {
    const recovery = data.recovery;
    const score = recovery.score;
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;
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

  // Helper function to convert time-series data to valueSampledData format
  const convertTimeSeriesToSampledData = (
    timeSeries: Array<{ timestamp: string; value: number }>,
    periodSeconds: number = 1
  ): { origin: { value: number; unit: string }; period: number; dimensions: number; data: string } | null => {
    if (!timeSeries || timeSeries.length === 0) return null;

    // Sort by timestamp
    const sorted = [...timeSeries].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Extract values and create data string (space-separated)
    const values = sorted.map(item => Math.round(item.value));
    const dataString = values.join(' ');

    // Use first value as origin
    const originValue = values[0] || 0;

    return {
      origin: {
        value: originValue,
        unit: 'beats/min'
      },
      period: periodSeconds, // Period in seconds (1 = 1 second intervals)
      dimensions: 1, // Single dimension (heart rate)
      data: dataString
    };
  };

  // Parse Cycle (Strain/Workout) Data
  if (data.cycle?.score) {
    const cycle = data.cycle;
    const score = cycle.score;
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;
    const cycleDate = cycle.start || cycle.created_at;

    // Handle real-time heart rate time-series data if available
    if ((cycle as any).heart_rate_time_series && Array.isArray((cycle as any).heart_rate_time_series)) {
      const sampledData = convertTimeSeriesToSampledData((cycle as any).heart_rate_time_series, 1);
      if (sampledData) {
        const startTime = cycle.start || cycle.created_at;
        const endTime = cycle.end || new Date(new Date(startTime).getTime() + (sampledData.data.split(' ').length * 1000)).toISOString();
        
        observations.push({
          code: {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart Rate Time Series'
          },
          effectivePeriod: startTime && endTime ? {
            start: startTime,
            end: endTime
          } : undefined,
          date: startTime,
          device: {
            uid: deviceUid
          },
          status: 'final',
          category: [{
            system: 'http://terminology.hl7.org/CodeSystem/observation-category',
            code: 'vital-signs',
            display: 'Vital Signs'
          }],
          valueSampledData: sampledData
        });
      }
    }

    // Strain Score (device-specific, use local code since 93831-6 is actually for Deep sleep duration)
    // Use valueQuantity instead of valueInteger for FHIR R5 compatibility
    if (score.strain !== undefined) {
      observations.push(createObservation(
        {
          system: 'urn:hl7-org:local',
          code: 'whoop-strain-score',
          display: 'Physical activity strain score'
        },
        Math.round(score.strain),
        '{score}',
        cycleDate,
        deviceUid,
        'activity'
      ));
    }

    // Calories/Kilojoules
    if (score.kilojoule !== undefined) {
      // Convert kilojoules to calories (1 kJ = 0.239006 kcal)
      const calories = score.kilojoule * 0.239006;
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '41981-2',
          display: 'Calories burned'
        },
        Math.round(calories),
        'kcal',
        cycleDate,
        deviceUid,
        'activity'
      ));
    }

    // Average Heart Rate during Cycle (only if no time-series data)
    if (score.average_heart_rate !== undefined && !(cycle as any).heart_rate_time_series) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate'
        },
        score.average_heart_rate,
        '/min',
        cycleDate,
        deviceUid,
        'vital-signs'
      ));
    }

    // Max Heart Rate during Cycle
    if (score.max_heart_rate !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate'
        },
        score.max_heart_rate,
        '/min',
        cycleDate,
        deviceUid,
        'vital-signs'
      ));
    }
  }

  // Parse Sleep Data - Single Observation with Components
  if (data.sleep?.score) {
    const sleep = data.sleep;
    const score = sleep.score;
    const stageSummary = score.stage_summary;
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;

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
          unit: 'beats/min',
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
        }],
        components: sleepComponents
      });
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
  const workoutData = (data as any).workout;
  if (workoutData) {
    const workouts = Array.isArray(workoutData) ? workoutData : [workoutData];
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;

    for (const workout of workouts) {
      if (!workout?.score) continue;

      const score = workout.score;
      const workoutDate = workout.start || workout.created_at;

      // Handle real-time heart rate time-series data if available
      if (workout.heart_rate_time_series && Array.isArray(workout.heart_rate_time_series)) {
        const sampledData = convertTimeSeriesToSampledData(workout.heart_rate_time_series, 1);
        if (sampledData) {
          const startTime = workout.start || workout.created_at;
          const endTime = workout.end || new Date(new Date(startTime).getTime() + (sampledData.data.split(' ').length * 1000)).toISOString();
          
          observations.push({
            code: {
              system: 'http://loinc.org',
              code: '8867-4',
              display: 'Heart Rate Time Series'
            },
            effectivePeriod: startTime && endTime ? {
              start: startTime,
              end: endTime
            } : undefined,
            date: startTime,
            device: {
              uid: deviceUid
            },
            status: 'final',
            category: [{
              system: 'http://terminology.hl7.org/CodeSystem/observation-category',
              code: 'vital-signs',
              display: 'Vital Signs'
            }],
            valueSampledData: sampledData
          });
        }
      }

      // Strain Score
      if (score.strain !== undefined) {
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '93831-6',
            display: 'Physical activity strain score'
          },
          score.strain,
          '{score}',
          workoutDate,
          deviceUid,
          'activity'
        ));
      }

      // Calories/Kilojoules
      if (score.kilojoule !== undefined) {
        // Convert kilojoules to calories (1 kJ = 0.239006 kcal)
        const calories = score.kilojoule * 0.239006;
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '41981-2',
            display: 'Calories burned'
          },
          Math.round(calories),
          'kcal',
          workoutDate,
          deviceUid,
          'activity'
        ));
      }

      // Average Heart Rate during Workout (only if no time-series data)
      if (score.average_heart_rate !== undefined && !workout.heart_rate_time_series) {
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          },
          score.average_heart_rate,
          '/min',
          workoutDate,
          deviceUid,
          'vital-signs'
        ));
      }

      // Max Heart Rate during Workout
      if (score.max_heart_rate !== undefined) {
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '8867-4',
            display: 'Heart rate'
          },
          score.max_heart_rate,
          '/min',
          workoutDate,
          deviceUid,
          'vital-signs'
        ));
      }

      // Distance
      if (score.distance_meter !== undefined) {
        // Convert meters to kilometers
        const distanceKm = score.distance_meter / 1000;
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '55423-8',
            display: 'Distance traveled'
          },
          Math.round(distanceKm * 100) / 100, // Round to 2 decimals
          'km',
          workoutDate,
          deviceUid,
          'activity'
        ));
      }

      // Altitude Gain
      if (score.altitude_gain_meter !== undefined) {
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '93848-0',
            display: 'Elevation gain'
          },
          Math.round(score.altitude_gain_meter * 100) / 100, // Round to 2 decimals
          'm',
          workoutDate,
          deviceUid,
          'activity'
        ));
      }

      // Altitude Change
      if (score.altitude_change_meter !== undefined) {
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '93849-8',
            display: 'Elevation change'
          },
          Math.round(score.altitude_change_meter * 100) / 100, // Round to 2 decimals
          'm',
          workoutDate,
          deviceUid,
          'activity'
        ));
      }

      // Percent Recorded
      if (score.percent_recorded !== undefined) {
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '93850-6',
            display: 'Workout data completeness percentage'
          },
          score.percent_recorded,
          '%',
          workoutDate,
          deviceUid,
          'activity'
        ));
      }

      // Sport Name (as a codeable concept)
      if (workout.sport_name) {
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '93851-4',
            display: 'Exercise type'
          },
          workout.sport_name,
          '{text}',
          workoutDate,
          deviceUid,
          'activity'
        ));
      }

      // Zone Durations (if available)
      if (score.zone_durations && Object.keys(score.zone_durations).length > 0) {
        for (const [zoneName, durationMs] of Object.entries(score.zone_durations)) {
          const durationSeconds = Math.round((durationMs as number) / 1000);
          observations.push(createObservation(
            {
              system: 'http://loinc.org',
              code: '93852-2',
              display: `Heart rate zone duration: ${zoneName}`
            },
            durationSeconds,
            's',
            workoutDate,
            deviceUid,
            'activity'
          ));
        }
      }
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

