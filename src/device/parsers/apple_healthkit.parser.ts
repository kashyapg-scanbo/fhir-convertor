import { CanonicalModel, CanonicalObservation } from '../../shared/types/canonical.types.js';
import type { HealthKitData, HealthKitSample, HealthKitWorkout } from '../types/apple_healthkit.types.js';

/**
 * Apple HealthKit Data Parser
 *
 * Converts Apple HealthKit JSON data to Canonical Model
 */
export function parseAppleHealthKit(input: string): CanonicalModel {
  let data: HealthKitData;

  try {
    data = JSON.parse(input);
  } catch (e) {
    throw new Error('Invalid JSON input for Apple HealthKit parser');
  }

  const observations: CanonicalObservation[] = [];
  const originalDataBase64 = Buffer.from(input, 'utf8').toString('base64');

  const normalizeDeviceUid = (source?: string): string => {
    if (!source) return 'apple-health-kit';
    return `healthkit-${source.replace(/\s+/g, '-').toLowerCase()}`;
  };

  const toNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    return undefined;
  };

  const quantityTypeMap: Record<string, {
    code: { system: string; code: string; display: string };
    unit: string;
    unitCode: string;
    category: 'vital-signs' | 'activity' | 'exam' | 'laboratory';
    valueTransform?: (value: number) => number;
    forceUnit?: boolean;
  }> = {
    heartRate: {
      code: { system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' },
      unit: 'beats/min',
      unitCode: '/min',
      category: 'vital-signs',
      forceUnit: true
    },
    restingHeartRate: {
      code: { system: 'urn:hl7-org:local', code: 'resting-heart-rate', display: 'Resting heart rate' },
      unit: 'beats/min',
      unitCode: '/min',
      category: 'vital-signs',
      forceUnit: true
    },
    respiratoryRate: {
      code: { system: 'http://loinc.org', code: '9279-1', display: 'Respiratory rate' },
      unit: 'breaths/min',
      unitCode: '/min',
      category: 'vital-signs',
      forceUnit: true
    },
    oxygenSaturation: {
      code: { system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation in Arterial blood' },
      unit: '%',
      unitCode: '%',
      category: 'vital-signs',
      valueTransform: (value) => (value <= 1 ? value * 100 : value)
    },
    bodyTemperature: {
      code: { system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' },
      unit: 'Cel',
      unitCode: 'Cel',
      category: 'vital-signs'
    },
    bloodGlucose: {
      code: { system: 'http://loinc.org', code: '2339-0', display: 'Glucose [Mass/volume] in Blood' },
      unit: 'mg/dL',
      unitCode: 'mg/dL',
      category: 'laboratory'
    },
    heartRateVariabilitySDNN: {
      code: { system: 'urn:hl7-org:local', code: 'heart-rate-variability-sdnn', display: 'Heart rate variability SDNN' },
      unit: 'ms',
      unitCode: 'ms',
      category: 'vital-signs'
    },
    heartRateRecoveryOneMinute: {
      code: { system: 'urn:hl7-org:local', code: 'heart-rate-recovery-one-minute', display: 'Heart rate recovery (1 minute)' },
      unit: 'beats/min',
      unitCode: '/min',
      category: 'vital-signs',
      forceUnit: true
    }
  };

  const pushQuantityObservation = (
    code: { system: string; code: string; display: string },
    value: number,
    unit: string,
    unitCode: string,
    date?: string,
    categoryCode: 'vital-signs' | 'activity' | 'exam' | 'laboratory' = 'vital-signs',
    deviceUid?: string
  ) => {
    observations.push({
      code,
      value,
      unit,
      unitSystem: 'http://unitsofmeasure.org',
      unitCode,
      date,
      device: deviceUid ? { uid: deviceUid } : undefined,
      status: 'final',
      category: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: categoryCode,
        display: categoryCode === 'vital-signs'
          ? 'Vital Signs'
          : categoryCode === 'activity'
            ? 'Activity'
            : categoryCode === 'laboratory'
              ? 'Laboratory'
              : 'Exam'
      }]
    });
  };

  const handleMappedQuantity = (sample: HealthKitSample, categoryFallback: 'vital-signs' | 'activity' | 'exam' | 'laboratory'): boolean => {
    const mapping = quantityTypeMap[sample.type];
    if (!mapping) return false;
    const numeric = toNumber(sample.value);
    if (numeric === undefined) return false;

    const mappedValue = mapping.valueTransform ? mapping.valueTransform(numeric) : numeric;
    const unit = mapping.forceUnit ? mapping.unit : (sample.unit || mapping.unit);
    const unitCode = mapping.forceUnit ? mapping.unitCode : (sample.unit || mapping.unitCode);
    const category = mapping.category || categoryFallback;

    pushQuantityObservation(
      mapping.code,
      mappedValue,
      unit,
      unitCode,
      sample.timestamp || sample.startDate || sample.endDate,
      category,
      normalizeDeviceUid(sample.source)
    );

    return true;
  };

  const handleHeartSamples = (samples?: HealthKitSample[]) => {
    if (!samples || !Array.isArray(samples)) return;

    const bpMap = new Map<string, { timestamp?: string; source?: string; systolic?: number; diastolic?: number }>();

    for (const sample of samples) {
      if (!sample || sample.value === undefined) continue;
      const deviceUid = normalizeDeviceUid(sample.source);

      if (sample.type === 'bloodPressureSystolic' || sample.type === 'bloodPressureDiastolic') {
        const key = `${sample.timestamp || ''}|${sample.source || ''}`;
        const entry = bpMap.get(key) || { timestamp: sample.timestamp, source: sample.source };
        const bpValue = toNumber(sample.value);
        if (bpValue === undefined) continue;
        if (sample.type === 'bloodPressureSystolic') entry.systolic = bpValue;
        if (sample.type === 'bloodPressureDiastolic') entry.diastolic = bpValue;
        bpMap.set(key, entry);
        continue;
      }

      if (handleMappedQuantity(sample, 'vital-signs')) continue;

      const numeric = toNumber(sample.value);
      if (numeric === undefined) continue;
      pushQuantityObservation(
        {
          system: 'urn:hl7-org:local',
          code: `healthkit-${sample.type}`,
          display: sample.type
        },
        numeric,
        sample.unit || '{count}',
        sample.unit || '{count}',
        sample.timestamp || sample.startDate || sample.endDate,
        'vital-signs',
        deviceUid
      );
    }

    for (const entry of bpMap.values()) {
      if (entry.systolic === undefined && entry.diastolic === undefined) continue;
      observations.push({
        code: {
          system: 'http://loinc.org',
          code: '85354-9',
          display: 'Blood pressure panel with all children optional'
        },
        date: entry.timestamp,
        device: entry.source ? { uid: normalizeDeviceUid(entry.source) } : undefined,
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        components: [
          entry.systolic !== undefined ? {
            code: {
              system: 'http://loinc.org',
              code: '8480-6',
              display: 'Systolic blood pressure'
            },
            valueQuantity: {
              value: entry.systolic,
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          } : undefined,
          entry.diastolic !== undefined ? {
            code: {
              system: 'http://loinc.org',
              code: '8462-4',
              display: 'Diastolic blood pressure'
            },
            valueQuantity: {
              value: entry.diastolic,
              unit: 'mmHg',
              system: 'http://unitsofmeasure.org',
              code: 'mm[Hg]'
            }
          } : undefined
        ].filter(Boolean) as CanonicalObservation['components']
      });
    }
  };

  const handleBodySamples = (samples?: HealthKitSample[]) => {
    if (!samples || !Array.isArray(samples)) return;

    for (const sample of samples) {
      if (!sample || sample.value === undefined) continue;
      const deviceUid = normalizeDeviceUid(sample.source);

      if (handleMappedQuantity(sample, 'vital-signs')) continue;

      switch (sample.type) {
        case 'height': {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          const value = sample.unit === 'cm' ? numeric : numeric;
          const unit = sample.unit === 'cm' ? 'cm' : 'm';
          const unitCode = unit;
          pushQuantityObservation(
            {
              system: 'http://loinc.org',
              code: '8302-2',
              display: 'Body height'
            },
            value,
            unit,
            unitCode,
            sample.timestamp || sample.startDate || sample.endDate,
            'vital-signs',
            deviceUid
          );
          break;
        }
        case 'weight': {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          const valueKg = sample.unit === 'g' ? numeric / 1000 : numeric;
          pushQuantityObservation(
            {
              system: 'http://loinc.org',
              code: '29463-7',
              display: 'Body weight'
            },
            valueKg,
            'kg',
            'kg',
            sample.timestamp || sample.startDate || sample.endDate,
            'vital-signs',
            deviceUid
          );
          break;
        }
        case 'bmi': {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          pushQuantityObservation(
            {
              system: 'http://loinc.org',
              code: '39156-5',
              display: 'Body mass index (BMI) [Ratio]'
            },
            numeric,
            'kg/m2',
            'kg/m2',
            sample.timestamp || sample.startDate || sample.endDate,
            'vital-signs',
            deviceUid
          );
          break;
        }
        case 'bodyFatPercentage': {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          const value = sample.unit === '%' && numeric <= 1 ? numeric * 100 : numeric;
          pushQuantityObservation(
            {
              system: 'urn:hl7-org:local',
              code: 'body-fat-percentage',
              display: 'Body fat percentage'
            },
            value,
            '%',
            '%',
            sample.timestamp || sample.startDate || sample.endDate,
            'vital-signs',
            deviceUid
          );
          break;
        }
        case 'leanBodyMass': {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          const valueKg = sample.unit === 'g' ? numeric / 1000 : numeric;
          pushQuantityObservation(
            {
              system: 'urn:hl7-org:local',
              code: 'lean-body-mass',
              display: 'Lean body mass'
            },
            valueKg,
            'kg',
            'kg',
            sample.timestamp || sample.startDate || sample.endDate,
            'vital-signs',
            deviceUid
          );
          break;
        }
        default: {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          pushQuantityObservation(
            {
              system: 'urn:hl7-org:local',
              code: `healthkit-${sample.type}`,
              display: sample.type
            },
            numeric,
            sample.unit || '{count}',
            sample.unit || '{count}',
            sample.timestamp || sample.startDate || sample.endDate,
            'vital-signs',
            deviceUid
          );
        }
      }
    }
  };

  const handleActivitySamples = (samples?: HealthKitSample[]) => {
    if (!samples || !Array.isArray(samples)) return;

    for (const sample of samples) {
      if (!sample || sample.value === undefined) continue;
      const deviceUid = normalizeDeviceUid(sample.source);

      if (handleMappedQuantity(sample, 'activity')) continue;

      if (sample.type === 'stepCount') {
        const numeric = toNumber(sample.value);
        if (numeric === undefined) continue;
        pushQuantityObservation(
          {
            system: 'http://loinc.org',
            code: '41950-7',
            display: 'Number of steps in unspecified time'
          },
          numeric,
          'steps',
          '{steps}',
          sample.timestamp || sample.startDate || sample.endDate,
          'activity',
          deviceUid
        );
        continue;
      }

      const numeric = toNumber(sample.value);
      if (numeric === undefined) continue;
      pushQuantityObservation(
        {
          system: 'urn:hl7-org:local',
          code: `healthkit-${sample.type}`,
          display: sample.type
        },
        numeric,
        sample.unit || '{count}',
        sample.unit || '{count}',
        sample.timestamp || sample.startDate || sample.endDate,
        'activity',
        deviceUid
      );
    }
  };

  const handleSleepSamples = (samples?: HealthKitSample[]) => {
    if (!samples || !Array.isArray(samples)) return;

    const sleepStageMap: Record<string, { code: string; display: string }> = {
      inBed: { code: 'in-bed', display: 'In bed' },
      asleep: { code: 'asleep', display: 'Asleep' },
      awake: { code: 'awake', display: 'Awake' },
      asleepREM: { code: 'asleep-rem', display: 'Asleep REM' },
      asleepCore: { code: 'asleep-core', display: 'Asleep core' },
      asleepDeep: { code: 'asleep-deep', display: 'Asleep deep' },
      asleepUnspecified: { code: 'asleep-unspecified', display: 'Asleep (unspecified)' }
    };

    for (const sample of samples) {
      if (!sample) continue;

      const stage = typeof sample.value === 'string' ? sleepStageMap[sample.value] : undefined;
      const numeric = stage ? undefined : toNumber(sample.value);
      const date = sample.timestamp || sample.startDate || sample.endDate;
      const effectivePeriod = sample.startDate && sample.endDate
        ? { start: sample.startDate, end: sample.endDate }
        : undefined;

      const components: CanonicalObservation['components'] = [];

      if (stage) {
        components.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'sleep-stage',
            display: 'Sleep stage'
          },
          valueCodeableConcept: {
            system: 'urn:hl7-org:local',
            code: stage.code,
            display: stage.display
          }
        });
      }

      if (numeric !== undefined) {
        components.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'sleep-value',
            display: 'Sleep value'
          },
          valueQuantity: {
            value: numeric,
            unit: sample.unit || '{count}',
            system: 'http://unitsofmeasure.org',
            code: sample.unit || '{count}'
          }
        });
      }

      observations.push({
        code: {
          system: 'urn:hl7-org:local',
          code: 'healthkit-sleep',
          display: 'HealthKit Sleep'
        },
        date,
        effectivePeriod,
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components: components.length > 0 ? components : undefined
      });
    }
  };

  const handleWorkouts = (workouts?: HealthKitWorkout[]) => {
    if (!workouts || !Array.isArray(workouts)) return;

    for (const workout of workouts) {
      if (!workout) continue;

      const components: CanonicalObservation['components'] = [];

      if (workout.calories !== undefined) {
        components.push({
          code: {
            system: 'http://loinc.org',
            code: '41981-2',
            display: 'Calories burned'
          },
          valueQuantity: {
            value: workout.calories,
            unit: 'kcal',
            system: 'http://unitsofmeasure.org',
            code: 'kcal'
          }
        });
      }

      if (workout.distance !== undefined) {
        const distanceKm = workout.distance / 1000;
        components.push({
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

      if (workout.duration !== undefined) {
        components.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'workout-duration',
            display: 'Workout duration'
          },
          valueQuantity: {
            value: workout.duration,
            unit: 's',
            system: 'http://unitsofmeasure.org',
            code: 's'
          }
        });
      }

      if (workout.activityType !== undefined) {
        components.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'workout-activity-type',
            display: 'Workout activity type'
          },
          valueCodeableConcept: {
            system: 'urn:hl7-org:local',
            code: workout.activityType.toString(),
            display: `Activity Type ${workout.activityType}`
          }
        });
      }

      observations.push({
        code: {
          system: 'urn:hl7-org:local',
          code: 'healthkit-workout',
          display: 'HealthKit Workout Summary'
        },
        date: workout.startDate,
        effectivePeriod: workout.startDate && workout.endDate ? {
          start: workout.startDate,
          end: workout.endDate
        } : undefined,
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components: components.length > 0 ? components : undefined
      });
    }
  };

  handleHeartSamples(data.heart?.data);
  handleBodySamples(data.body?.data);
  handleActivitySamples(data.activity?.data);
  handleSleepSamples(data.sleep?.data);
  handleSleepSamples((data as { sleepAnalysis?: { data?: HealthKitSample[] } }).sleepAnalysis?.data);
  handleWorkouts(data.workouts?.data);

  return {
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
          title: 'Apple HealthKit Original Request Data',
          format: 'json'
        }
      }]
    }]
  };
}
