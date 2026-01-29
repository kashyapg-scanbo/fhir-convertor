import { CanonicalModel, CanonicalObservation, CanonicalPatient } from '../../shared/types/canonical.types.js';
import type { AndroidHealthConnectData } from '../types/android_health_connect.types.js';

/**
 * Android Health Connect Data Parser
 *
 * Converts Android Health Connect JSON data to Canonical Model
 */
export function parseAndroidHealthConnect(input: string): CanonicalModel {
  let data: AndroidHealthConnectData;

  try {
    data = JSON.parse(input);
  } catch (e) {
    throw new Error('Invalid JSON input for Android Health Connect parser');
  }

  const observations: CanonicalObservation[] = [];
  const originalDataBase64 = Buffer.from(input, 'utf8').toString('base64');
  const patient: CanonicalPatient = {
    name: {},
    identifier: 'android-health-connect-user'
  };
  const defaultDeviceUid = 'android-health-connect';

  const toArray = <T>(value?: T | T[]): T[] => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  };

  const toNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    return undefined;
  };

  const toDateOnly = (value?: string): string | undefined => {
    if (!value) return value;
    const tIndex = value.indexOf('T');
    return tIndex === -1 ? value : value.slice(0, tIndex);
  };

  const normalizeUnitCode = (unit?: string, unitCode?: string): { unit: string; code: string } => {
    const resolvedUnit = unit || unitCode || 'count';
    const resolvedCode = unitCode || unit || resolvedUnit;
    const normalized = resolvedCode.toLowerCase();
    if (normalized === 'dbaspl') {
      return { unit: 'dB', code: 'dB' };
    }
    if (resolvedCode === 'count') {
      return { unit: 'count', code: '{count}' };
    }
    if (normalized === 'met') {
      return { unit: 'MET', code: '1' };
    }
    return { unit: resolvedUnit, code: resolvedCode };
  };

  const categoryDisplay = (code: 'vital-signs' | 'activity' | 'exam' | 'laboratory'): string => {
    if (code === 'vital-signs') return 'Vital Signs';
    if (code === 'activity') return 'Activity';
    if (code === 'laboratory') return 'Laboratory';
    return 'Exam';
  };

  const pushObservation = (observation: CanonicalObservation) => {
    if (!observation.device || !observation.device.uid) {
      observation.device = { uid: defaultDeviceUid };
    }
    observations.push(observation);
  };

  const pushValueObservation = (
    code: { system: string; code: string; display: string },
    value: number,
    unit: string,
    unitCode: string,
    date?: string,
    category: 'vital-signs' | 'activity' | 'exam' | 'laboratory' = 'activity'
  ) => {
    pushObservation({
      code,
      value,
      unit,
      unitSystem: 'http://unitsofmeasure.org',
      unitCode,
      date,
      status: 'final',
      category: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: category,
        display: categoryDisplay(category)
      }]
    });
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

  const dailyActivity = toArray(data['Daily Activity']);
  for (const entry of dailyActivity) {
    const day = toDateOnly(entry.day || entry.timestamp);
    const components: CanonicalObservation['components'] = [];

    const steps = toNumber((entry as any).steps);
    if (steps !== undefined) {
      components.push({
        code: { system: 'http://loinc.org', code: '41950-7', display: 'Number of steps in 24 Hours, Measured' },
        valueQuantity: {
          value: steps,
          unit: 'count',
          system: 'http://unitsofmeasure.org',
          code: '{count}'
        }
      });
    }

    const totalCalories = toNumber((entry as any).total_calories);
    if (totalCalories !== undefined) {
      components.push({
        code: { system: 'http://loinc.org', code: '41981-2', display: 'Calories burned' },
        valueQuantity: {
          value: totalCalories,
          unit: 'kcal',
          system: 'http://unitsofmeasure.org',
          code: 'kcal'
        }
      });
    }

    const activeCalories = toNumber((entry as any).active_calories);
    if (activeCalories !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'active-calories', display: 'Active calories' },
        valueQuantity: {
          value: activeCalories,
          unit: 'kcal',
          system: 'http://unitsofmeasure.org',
          code: 'kcal'
        }
      });
    }

    const targetCalories = toNumber((entry as any).target_calories);
    if (targetCalories !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'target-calories', display: 'Target calories' },
        valueQuantity: {
          value: targetCalories,
          unit: 'kcal',
          system: 'http://unitsofmeasure.org',
          code: 'kcal'
        }
      });
    }

    const distance = toNumber((entry as any).equivalent_walking_distance);
    if (distance !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'equivalent-walking-distance', display: 'Equivalent walking distance' },
        valueQuantity: {
          value: distance,
          unit: 'm',
          system: 'http://unitsofmeasure.org',
          code: 'm'
        }
      });
    }

    const score = toNumber((entry as any).score);
    if (score !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'activity-score', display: 'Activity score' },
        valueInteger: Math.round(score)
      });
    }

    const minutesKeys = [
      'average_met_minutes',
      'high_activity_met_minutes',
      'low_activity_met_minutes',
      'medium_activity_met_minutes',
      'sedentary_met_minutes'
    ];

    for (const key of minutesKeys) {
      const value = toNumber((entry as any)[key]);
      if (value === undefined) continue;
      components.push({
        code: { system: 'urn:hl7-org:local', code: key, display: key.replace(/_/g, ' ') },
        valueQuantity: {
          value,
          unit: 'min',
          system: 'http://unitsofmeasure.org',
          code: 'min'
        }
      });
    }

    const timeKeys = ['low_activity_time', 'medium_activity_time', 'high_activity_time', 'sedentary_time', 'resting_time', 'non_wear_time'];
    for (const key of timeKeys) {
      const value = toNumber((entry as any)[key]);
      if (value === undefined) continue;
      components.push({
        code: { system: 'urn:hl7-org:local', code: key, display: key.replace(/_/g, ' ') },
        valueQuantity: {
          value,
          unit: 'min',
          system: 'http://unitsofmeasure.org',
          code: 'min'
        }
      });
    }

    const contributors = (entry as any).contributors as Record<string, number | null> | undefined;
    if (contributors) {
      for (const [key, value] of Object.entries(contributors)) {
        const numeric = toNumber(value);
        if (numeric === undefined) continue;
        components.push({
          code: { system: 'urn:hl7-org:local', code: `contributor-${key}`, display: key.replace(/_/g, ' ') },
          valueInteger: Math.round(numeric)
        });
      }
    }

    const metSeries = (entry as any).met;
    if (metSeries?.items?.length && typeof metSeries.interval === 'number') {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'met-samples', display: 'MET samples' },
        valueSampledData: {
          origin: {
            value: 0,
            unit: '1'
          },
          period: metSeries.interval,
          dimensions: 1,
          data: metSeries.items.join(' ')
        }
      });
      addSampleTimestampComponent(components, metSeries.timestamp);
    }

    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-daily-activity', display: 'Daily activity summary' },
        date: day,
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components
      });
    }
  }

  const cardiovascularAge = toArray(data['Cardiovascular age']);
  for (const entry of cardiovascularAge) {
    const ageValue = toNumber((entry as any).vascular_age);
    if (ageValue === undefined) continue;
    pushObservation({
      code: { system: 'urn:hl7-org:local', code: 'cardiovascular-age', display: 'Cardiovascular age' },
      value: Math.round(ageValue),
      date: toDateOnly((entry as any).day),
      status: 'final',
      category: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'exam',
        display: 'Exam'
      }]
    });
  }

  const readiness = toArray(data['Readiness']);
  for (const entry of readiness) {
    const components: CanonicalObservation['components'] = [];
    const score = toNumber((entry as any).score);
    if (score !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'readiness-score', display: 'Readiness score' },
        valueInteger: Math.round(score)
      });
    }

    const tempDeviation = toNumber((entry as any).temperature_deviation);
    if (tempDeviation !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'temperature-deviation', display: 'Temperature deviation' },
        valueQuantity: {
          value: tempDeviation,
          unit: 'Cel',
          system: 'http://unitsofmeasure.org',
          code: 'Cel'
        }
      });
    }

    const tempTrend = toNumber((entry as any).temperature_trend_deviation);
    if (tempTrend !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'temperature-trend-deviation', display: 'Temperature trend deviation' },
        valueQuantity: {
          value: tempTrend,
          unit: 'Cel',
          system: 'http://unitsofmeasure.org',
          code: 'Cel'
        }
      });
    }

    const contributors = (entry as any).contributors as Record<string, number | null> | undefined;
    if (contributors) {
      for (const [key, value] of Object.entries(contributors)) {
        const numeric = toNumber(value);
        if (numeric === undefined) continue;
        components.push({
          code: { system: 'urn:hl7-org:local', code: `contributor-${key}`, display: key.replace(/_/g, ' ') },
          valueInteger: Math.round(numeric)
        });
      }
    }

    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-readiness', display: 'Readiness summary' },
        date: toDateOnly((entry as any).day || (entry as any).timestamp),
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components
      });
    }
  }

  const resilience = toArray(data['Resilience']);
  for (const entry of resilience) {
    const components: CanonicalObservation['components'] = [];
    if ((entry as any).level) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'resilience-level', display: 'Resilience level' },
        valueString: String((entry as any).level)
      });
    }

    const contributors = (entry as any).contributors as Record<string, number | null> | undefined;
    if (contributors) {
      for (const [key, value] of Object.entries(contributors)) {
        const numeric = toNumber(value);
        if (numeric === undefined) continue;
        components.push({
          code: { system: 'urn:hl7-org:local', code: `contributor-${key}`, display: key.replace(/_/g, ' ') },
          valueInteger: Math.round(numeric)
        });
      }
    }

    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-resilience', display: 'Resilience summary' },
        date: toDateOnly((entry as any).day),
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components
      });
    }
  }

  const sleepDaily = toArray(data['Sleep']);
  for (const entry of sleepDaily) {
    const components: CanonicalObservation['components'] = [];
    const score = toNumber((entry as any).score);
    if (score !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'sleep-score', display: 'Sleep score' },
        valueInteger: Math.round(score)
      });
    }

    const contributors = (entry as any).contributors as Record<string, number | null> | undefined;
    if (contributors) {
      for (const [key, value] of Object.entries(contributors)) {
        const numeric = toNumber(value);
        if (numeric === undefined) continue;
        components.push({
          code: { system: 'urn:hl7-org:local', code: `contributor-${key}`, display: key.replace(/_/g, ' ') },
          valueInteger: Math.round(numeric)
        });
      }
    }

    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-sleep', display: 'Sleep summary' },
        date: toDateOnly((entry as any).day || (entry as any).timestamp),
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components
      });
    }
  }

  const sleepDetailed = toArray(data['Sleep Detailed']);
  for (const entry of sleepDetailed) {
    const components: CanonicalObservation['components'] = [];

    const averageBreath = toNumber((entry as any).average_breath);
    if (averageBreath !== undefined) {
      components.push({
        code: { system: 'http://loinc.org', code: '9279-1', display: 'Respiratory rate' },
        valueQuantity: {
          value: averageBreath,
          unit: 'breaths/min',
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      });
    }

    const averageHeartRate = toNumber((entry as any).average_heart_rate);
    if (averageHeartRate !== undefined) {
      components.push({
        code: { system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' },
        valueQuantity: {
          value: averageHeartRate,
          unit: 'beats/min',
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      });
    }

    const averageHrv = toNumber((entry as any).average_hrv);
    if (averageHrv !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'average-hrv', display: 'Average HRV' },
        valueQuantity: {
          value: averageHrv,
          unit: 'ms',
          system: 'http://unitsofmeasure.org',
          code: 'ms'
        }
      });
    }

    const durationFields = [
      'awake_time',
      'deep_sleep_duration',
      'light_sleep_duration',
      'rem_sleep_duration',
      'total_sleep_duration',
      'time_in_bed',
      'latency'
    ];
    for (const key of durationFields) {
      const value = toNumber((entry as any)[key]);
      if (value === undefined) continue;
      components.push({
        code: { system: 'urn:hl7-org:local', code: key, display: key.replace(/_/g, ' ') },
        valueQuantity: {
          value,
          unit: 's',
          system: 'http://unitsofmeasure.org',
          code: 's'
        }
      });
    }

    const lowestHeartRate = toNumber((entry as any).lowest_heart_rate);
    if (lowestHeartRate !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'lowest-heart-rate', display: 'Lowest heart rate' },
        valueQuantity: {
          value: lowestHeartRate,
          unit: 'beats/min',
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      });
    }

    const efficiency = toNumber((entry as any).efficiency);
    if (efficiency !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'sleep-efficiency', display: 'Sleep efficiency' },
        valueInteger: Math.round(efficiency)
      });
    }

    if ((entry as any).type) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'sleep-type', display: 'Sleep type' },
        valueString: String((entry as any).type)
      });
    }

    const heartRateSeries = (entry as any).heart_rate;
    if (heartRateSeries?.items?.length && typeof heartRateSeries.interval === 'number') {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'sleep-heart-rate-samples', display: 'Sleep heart rate samples' },
        valueSampledData: {
          origin: {
            value: 0,
            unit: '/min'
          },
          period: heartRateSeries.interval,
          dimensions: 1,
          data: heartRateSeries.items.join(' ')
        }
      });
      addSampleTimestampComponent(components, heartRateSeries.timestamp);
    }

    const hrvSeries = (entry as any).hrv;
    if (hrvSeries?.items?.length && typeof hrvSeries.interval === 'number') {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'sleep-hrv-samples', display: 'Sleep HRV samples' },
        valueSampledData: {
          origin: {
            value: 0,
            unit: 'ms'
          },
          period: hrvSeries.interval,
          dimensions: 1,
          data: hrvSeries.items.join(' ')
        }
      });
      addSampleTimestampComponent(components, hrvSeries.timestamp);
    }

    const readiness = (entry as any).readiness;
    if (readiness) {
      const readinessScore = toNumber(readiness.score);
      if (readinessScore !== undefined) {
        components.push({
          code: { system: 'urn:hl7-org:local', code: 'readiness-score', display: 'Readiness score' },
          valueInteger: Math.round(readinessScore)
        });
      }
      const readinessContributors = readiness.contributors as Record<string, number | null> | undefined;
      if (readinessContributors) {
        for (const [key, value] of Object.entries(readinessContributors)) {
          const numeric = toNumber(value);
          if (numeric === undefined) continue;
          components.push({
            code: { system: 'urn:hl7-org:local', code: `readiness-contributor-${key}`, display: key.replace(/_/g, ' ') },
            valueInteger: Math.round(numeric)
          });
        }
      }
    }

    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-sleep-detailed', display: 'Sleep detailed summary' },
        date: toDateOnly((entry as any).day),
        effectivePeriod: {
          start: (entry as any).bedtime_start,
          end: (entry as any).bedtime_end
        },
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components
      });
    }
  }

  const spo2 = toArray(data['Spo2']);
  for (const entry of spo2) {
    const avg = toNumber((entry as any).spo2_percentage?.average);
    if (avg === undefined) continue;
    pushValueObservation(
      { system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation in Arterial blood' },
      avg,
      '%',
      '%',
      toDateOnly((entry as any).day),
      'vital-signs'
    );
  }

  const stress = toArray(data['Stress']);
  for (const entry of stress) {
    const components: CanonicalObservation['components'] = [];
    const stressHigh = toNumber((entry as any).stress_high);
    if (stressHigh !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'stress-high', display: 'High stress time' },
        valueInteger: Math.round(stressHigh)
      });
    }
    const recoveryHigh = toNumber((entry as any).recovery_high);
    if (recoveryHigh !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'recovery-high', display: 'High recovery time' },
        valueInteger: Math.round(recoveryHigh)
      });
    }
    if ((entry as any).day_summary) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'stress-summary', display: 'Stress day summary' },
        valueString: String((entry as any).day_summary)
      });
    }
    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-stress', display: 'Stress summary' },
        date: toDateOnly((entry as any).day),
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components
      });
    }
  }

  const vo2 = toArray(data['Vo2']);
  for (const entry of vo2) {
    const value = toNumber((entry as any).vo2_max);
    if (value === undefined) continue;
    pushValueObservation(
      { system: 'urn:hl7-org:local', code: 'vo2-max', display: 'VO2 max' },
      value,
      'mL/kg/min',
      'mL/kg/min',
      toDateOnly((entry as any).day || (entry as any).timestamp),
      'vital-signs'
    );
  }

  const workouts = toArray(data['Workout']);
  for (const entry of workouts) {
    const components: CanonicalObservation['components'] = [];

    const calories = toNumber((entry as any).calories);
    if (calories !== undefined) {
      components.push({
        code: { system: 'http://loinc.org', code: '41981-2', display: 'Calories burned' },
        valueQuantity: {
          value: calories,
          unit: 'kcal',
          system: 'http://unitsofmeasure.org',
          code: 'kcal'
        }
      });
    }

    const distance = toNumber((entry as any).distance);
    if (distance !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'workout-distance', display: 'Workout distance' },
        valueQuantity: {
          value: distance,
          unit: 'm',
          system: 'http://unitsofmeasure.org',
          code: 'm'
        }
      });
    }

    if ((entry as any).activity) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'workout-activity', display: 'Workout activity' },
        valueCodeableConcept: {
          coding: [{
            system: 'urn:hl7-org:local',
            code: String((entry as any).activity),
            display: String((entry as any).activity)
          }]
        }
      });
    }

    if ((entry as any).intensity) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'workout-intensity', display: 'Workout intensity' },
        valueString: String((entry as any).intensity)
      });
    }

    if ((entry as any).label) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'workout-label', display: 'Workout label' },
        valueString: String((entry as any).label)
      });
    }

    if ((entry as any).source) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'workout-source', display: 'Workout source' },
        valueString: String((entry as any).source)
      });
    }

    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-workout', display: 'Workout summary' },
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        effectivePeriod: {
          start: (entry as any).start_datetime,
          end: (entry as any).end_datetime
        },
        date: toDateOnly((entry as any).day || (entry as any).start_datetime),
        components
      });
    }
  }

  const heartRates = toArray(data['Heart Rate']);
  if (heartRates.length > 0) {
    const grouped = new Map<string, CanonicalObservation['components']>();

    for (const sample of heartRates) {
      const timestamp = (sample as any).timestamp as string | undefined;
      const date = toDateOnly(timestamp);
      const value = toNumber((sample as any).bpm);
      if (!date || value === undefined) continue;

      const components = grouped.get(date) || [];
      components.push({
        code: { system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' },
        valueQuantity: {
          value,
          unit: 'beats/min',
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      });
      addSampleTimestampComponent(components, timestamp);
      grouped.set(date, components);
    }

    for (const [date, components] of grouped.entries()) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-daily-heart-rate', display: 'Daily heart rate samples' },
        date,
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        components
      });
    }
  }

  const session = toArray((data as any).Session);
  for (const entry of session) {
    const components: CanonicalObservation['components'] = [];

    const heartRateSeries = (entry as any).heart_rate;
    if (heartRateSeries?.items?.length && typeof heartRateSeries.interval === 'number') {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'session-heart-rate-samples', display: 'Session heart rate samples' },
        valueSampledData: {
          origin: {
            value: 0,
            unit: '/min'
          },
          period: heartRateSeries.interval,
          dimensions: 1,
          data: heartRateSeries.items.join(' ')
        }
      });
      addSampleTimestampComponent(components, heartRateSeries.timestamp);
    }

    const hrvSeries = (entry as any).heart_rate_variability;
    if (hrvSeries?.items?.length && typeof hrvSeries.interval === 'number') {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'session-hrv-samples', display: 'Session HRV samples' },
        valueSampledData: {
          origin: {
            value: 0,
            unit: 'ms'
          },
          period: hrvSeries.interval,
          dimensions: 1,
          data: hrvSeries.items.join(' ')
        }
      });
      addSampleTimestampComponent(components, hrvSeries.timestamp);
    }

    const motionSeries = (entry as any).motion_count;
    if (motionSeries?.items?.length && typeof motionSeries.interval === 'number') {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'session-motion-count', display: 'Session motion count' },
        valueSampledData: {
          origin: {
            value: 0,
            unit: '{count}'
          },
          period: motionSeries.interval,
          dimensions: 1,
          data: motionSeries.items.join(' ')
        }
      });
      addSampleTimestampComponent(components, motionSeries.timestamp);
    }

    if ((entry as any).mood) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'session-mood', display: 'Session mood' },
        valueString: String((entry as any).mood)
      });
    }

    if ((entry as any).type) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'session-type', display: 'Session type' },
        valueString: String((entry as any).type)
      });
    }

    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-session', display: 'Session summary' },
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        date: toDateOnly((entry as any).day || (entry as any).start_datetime),
        effectivePeriod: {
          start: (entry as any).start_datetime,
          end: (entry as any).end_datetime
        },
        components
      });
    }
  }

  const sleepTime = toArray((data as any)['Sleep Time']);
  for (const entry of sleepTime) {
    const components: CanonicalObservation['components'] = [];
    if ((entry as any).recommendation) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'sleep-time-recommendation', display: 'Sleep time recommendation' },
        valueString: String((entry as any).recommendation)
      });
    }
    if ((entry as any).status) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'sleep-time-status', display: 'Sleep time status' },
        valueString: String((entry as any).status)
      });
    }
    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-sleep-time', display: 'Sleep time recommendation' },
        status: 'final',
        date: toDateOnly((entry as any).day),
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components
      });
    }
  }

  const tag = toArray((data as any).Tag);
  for (const entry of tag) {
    const components: CanonicalObservation['components'] = [];
    if ((entry as any).text) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'tag-text', display: 'Tag text' },
        valueString: String((entry as any).text)
      });
    }
    if (Array.isArray((entry as any).tags)) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'tag-values', display: 'Tag values' },
        valueString: (entry as any).tags.join(', ')
      });
    }
    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-tag', display: 'Tag' },
        status: 'final',
        date: toDateOnly((entry as any).day || (entry as any).timestamp),
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'exam',
          display: 'Exam'
        }],
        components
      });
    }
  }

  const enhancedTag = toArray((data as any)['Enhanced Tag']);
  for (const entry of enhancedTag) {
    const components: CanonicalObservation['components'] = [];
    if ((entry as any).tag_type_code) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'enhanced-tag-type', display: 'Enhanced tag type' },
        valueString: String((entry as any).tag_type_code)
      });
    }
    if ((entry as any).comment) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'enhanced-tag-comment', display: 'Enhanced tag comment' },
        valueString: String((entry as any).comment)
      });
    }
    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-enhanced-tag', display: 'Enhanced tag' },
        status: 'final',
        effectivePeriod: {
          start: (entry as any).start_time,
          end: (entry as any).end_time
        },
        date: toDateOnly((entry as any).start_day || (entry as any).start_time),
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'exam',
          display: 'Exam'
        }],
        components
      });
    }
  }

  const restMode = toArray((data as any)['Rest Mode Period']);
  for (const entry of restMode) {
    const components: CanonicalObservation['components'] = [];
    if (Array.isArray((entry as any).episodes)) {
      const episodeStrings = (entry as any).episodes.map((episode: any) => {
        const tags = Array.isArray(episode.tags) ? episode.tags.join('|') : '';
        return `${episode.timestamp || ''}:${tags}`;
      });
      if (episodeStrings.length > 0) {
        components.push({
          code: { system: 'urn:hl7-org:local', code: 'rest-mode-episodes', display: 'Rest mode episodes' },
          valueString: episodeStrings.join('; ')
        });
      }
    }
    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'android-health-connect-rest-mode', display: 'Rest mode period' },
        status: 'final',
        effectivePeriod: {
          start: (entry as any).start_time,
          end: (entry as any).end_time
        },
        date: toDateOnly((entry as any).start_day || (entry as any).start_time),
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'exam',
          display: 'Exam'
        }],
        components
      });
    }
  }

  const personalInfo = (data as any)['Personal Info'];
  if (personalInfo) {
    if (personalInfo.email) {
      patient.telecom = patient.telecom || [];
      patient.telecom.push({
        system: 'email',
        value: String(personalInfo.email)
      });
    }

    if (personalInfo.biological_sex) {
      const normalized = String(personalInfo.biological_sex).toLowerCase();
      if (normalized === 'male' || normalized === 'female' || normalized === 'other' || normalized === 'unknown') {
        patient.gender = normalized;
      }
    }

    const weight = toNumber(personalInfo.weight);
    if (weight !== undefined && weight > 0) {
      pushValueObservation(
        { system: 'http://loinc.org', code: '29463-7', display: 'Body weight' },
        weight,
        'kg',
        'kg',
        undefined,
        'vital-signs'
      );
    }

    const height = toNumber(personalInfo.height);
    if (height !== undefined && height > 0) {
      pushValueObservation(
        { system: 'http://loinc.org', code: '8302-2', display: 'Body height' },
        height,
        'm',
        'm',
        undefined,
        'vital-signs'
      );
    }
  }

  return {
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
          title: 'Android Health Connect Original Request Data',
          format: 'json'
        }
      }]
    }]
  };
}
