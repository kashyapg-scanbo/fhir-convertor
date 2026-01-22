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

  // Parse Recovery Data
  if (data.recovery?.score) {
    const recovery = data.recovery;
    const score = recovery.score;

    // Add device reference for all recovery observations
    const deviceUid = `whoop-device-${data.profile?.user_id || 'unknown'}`;

    // Heart Rate Variability (HRV RMSSD)
    // Note: Using display text that avoids triggering heartrate profile auto-detection
    if (score.hrv_rmssd_milli !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '80404-7',
          display: 'R-R interval standard deviation (SDNN) - HRV'
        },
        score.hrv_rmssd_milli,
        'ms',
        recovery.created_at || recovery.updated_at,
        deviceUid,
        'exam'
      ));
    }

    // Resting Heart Rate (RHR)
    if (score.resting_heart_rate !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate'
        },
        score.resting_heart_rate,
        '/min',
        recovery.created_at || recovery.updated_at,
        deviceUid,
        'vital-signs'
      ));
    }

    // Recovery Score
    if (score.recovery_score !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93834-0',
          display: 'Recovery score'
        },
        score.recovery_score,
        '{score}',
        recovery.created_at || recovery.updated_at,
        deviceUid
      ));
    }

    // SpO2
    if (score.spo2_percentage !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '2708-6',
          display: 'Oxygen saturation in Arterial blood'
        },
        score.spo2_percentage,
        '%',
        recovery.created_at || recovery.updated_at,
        deviceUid,
        'vital-signs'
      ));
    }

    // Skin Temperature
    if (score.skin_temp_celsius !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '8310-5',
          display: 'Body temperature'
        },
        score.skin_temp_celsius,
        'Cel',
        recovery.created_at || recovery.updated_at,
        deviceUid,
        'vital-signs'
      ));
    }

    // User Calibrating Status (NEW - was missing)
    if (score.user_calibrating !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93848-0',
          display: 'Device calibration status'
        },
        score.user_calibrating ? 1 : 0,
        '{boolean}',
        recovery.created_at || recovery.updated_at,
        deviceUid
      ));
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
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93831-6',
          display: 'Physical activity strain score'
        },
        score.strain,
        '{score}',
        cycle.start || cycle.created_at,
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
        cycle.start || cycle.created_at,
        deviceUid,
        'activity'
      ));
    }

    // Average Heart Rate during Cycle
    // Note: Heart rate observations (8867-4) must use 'vital-signs' category to comply with heartrate profile
    if (score.average_heart_rate !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate'
        },
        score.average_heart_rate,
        '/min',
        cycle.start || cycle.created_at,
        deviceUid,
        'vital-signs'
      ));
    }

    // Max Heart Rate during Cycle
    // Note: Heart rate observations (8867-4) must use 'vital-signs' category to comply with heartrate profile
    if (score.max_heart_rate !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '8867-4',
          display: 'Heart rate'
        },
        score.max_heart_rate,
        '/min',
        cycle.start || cycle.created_at,
        deviceUid,
        'vital-signs'
      ));
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
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93832-4',
          display: 'Sleep duration'
        },
        durationSeconds,
        's',
        sleep.start || sleep.end,
        deviceUid,
        'vital-signs'
      ));
    }

    // Sleep Efficiency
    if (score.sleep_efficiency_percentage !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93830-8',
          display: 'Sleep efficiency'
        },
        score.sleep_efficiency_percentage,
        '%',
        sleep.start || sleep.end,
        deviceUid,
        'vital-signs'
      ));
    }

    // Sleep Performance
    if (score.sleep_performance_percentage !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93833-2',
          display: 'Sleep quality score'
        },
        score.sleep_performance_percentage,
        '{score}',
        sleep.start || sleep.end,
        deviceUid,
        'vital-signs'
      ));
    }

    // Sleep Consistency (NEW - was missing)
    if (score.sleep_consistency_percentage !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93841-5',
          display: 'Sleep consistency percentage'
        },
        score.sleep_consistency_percentage,
        '%',
        sleep.start || sleep.end,
        deviceUid,
        'vital-signs'
      ));
    }

    // Deep Sleep (Slow Wave Sleep)
    if (stageSummary?.total_slow_wave_sleep_time_milli !== undefined) {
      const durationSeconds = Math.round(stageSummary.total_slow_wave_sleep_time_milli / 1000);
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93835-7',
          display: 'Deep sleep duration'
        },
        durationSeconds,
        's',
        sleep.start || sleep.end,
        deviceUid
      ));
    }

    // REM Sleep
    if (stageSummary?.total_rem_sleep_time_milli !== undefined) {
      const durationSeconds = Math.round(stageSummary.total_rem_sleep_time_milli / 1000);
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93836-5',
          display: 'REM sleep duration'
        },
        durationSeconds,
        's',
        sleep.start || sleep.end,
        deviceUid
      ));
    }

    // Light Sleep
    if (stageSummary?.total_light_sleep_time_milli !== undefined) {
      const durationSeconds = Math.round(stageSummary.total_light_sleep_time_milli / 1000);
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93837-3',
          display: 'Light sleep duration'
        },
        durationSeconds,
        's',
        sleep.start || sleep.end,
        deviceUid
      ));
    }

    // Awake Time
    if (stageSummary?.total_awake_time_milli !== undefined) {
      const durationSeconds = Math.round(stageSummary.total_awake_time_milli / 1000);
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93838-1',
          display: 'Awake time during sleep'
        },
        durationSeconds,
        's',
        sleep.start || sleep.end,
        deviceUid
      ));
    }

    // Respiratory Rate during Sleep
    if (score.respiratory_rate !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '9279-1',
          display: 'Respiratory rate'
        },
        score.respiratory_rate,
        '/min',
        sleep.start || sleep.end,
        deviceUid,
        'vital-signs'
      ));
    }

    // Sleep Cycles Count
    if (stageSummary?.sleep_cycle_count !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93839-9',
          display: 'Sleep cycle count'
        },
        stageSummary.sleep_cycle_count,
        '{count}',
        sleep.start || sleep.end,
        deviceUid
      ));
    }

    // Disturbance Count
    if (stageSummary?.disturbance_count !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93840-7',
          display: 'Sleep disturbance count'
        },
        stageSummary.disturbance_count,
        '{count}',
        sleep.start || sleep.end,
        deviceUid
      ));
    }

    // Total No Data Time (NEW - was missing)
    if (stageSummary?.total_no_data_time_milli !== undefined) {
      const durationSeconds = Math.round(stageSummary.total_no_data_time_milli / 1000);
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93842-3',
          display: 'Sleep data gap duration'
        },
        durationSeconds,
        's',
        sleep.start || sleep.end,
        deviceUid
      ));
    }

    // Sleep Needed Metrics (NEW - was missing)
    if (score.sleep_needed) {
      const sleepNeeded = score.sleep_needed;

      // Baseline Sleep Need
      if (sleepNeeded.baseline_milli !== undefined) {
        const durationSeconds = Math.round(sleepNeeded.baseline_milli / 1000);
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '93843-1',
            display: 'Baseline sleep need'
          },
          durationSeconds,
          's',
          sleep.start || sleep.end,
          deviceUid
        ));
      }

      // Sleep Need from Sleep Debt
      if (sleepNeeded.need_from_sleep_debt_milli !== undefined) {
        const durationSeconds = Math.round(sleepNeeded.need_from_sleep_debt_milli / 1000);
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '93844-9',
            display: 'Sleep need from sleep debt'
          },
          durationSeconds,
          's',
          sleep.start || sleep.end,
          deviceUid
        ));
      }

      // Sleep Need from Recent Strain
      if (sleepNeeded.need_from_recent_strain_milli !== undefined) {
        const durationSeconds = Math.round(sleepNeeded.need_from_recent_strain_milli / 1000);
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '93845-6',
            display: 'Sleep need from recent strain'
          },
          durationSeconds,
          's',
          sleep.start || sleep.end,
          deviceUid
        ));
      }

      // Sleep Need from Recent Nap
      if (sleepNeeded.need_from_recent_nap_milli !== undefined) {
        const durationSeconds = Math.round(sleepNeeded.need_from_recent_nap_milli / 1000);
        observations.push(createObservation(
          {
            system: 'http://loinc.org',
            code: '93846-4',
            display: 'Sleep need from recent nap'
          },
          durationSeconds,
          's',
          sleep.start || sleep.end,
          deviceUid
        ));
      }
    }

    // Nap Indicator (as a note/flag)
    if (sleep.nap !== undefined) {
      observations.push(createObservation(
        {
          system: 'http://loinc.org',
          code: '93847-2',
          display: 'Nap indicator'
        },
        sleep.nap ? 1 : 0,
        '{boolean}',
        sleep.start || sleep.end,
        deviceUid
      ));
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

      // Average Heart Rate during Workout
      if (score.average_heart_rate !== undefined) {
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
    observations: observations.length > 0 ? observations : undefined
  };

  return result;
}

