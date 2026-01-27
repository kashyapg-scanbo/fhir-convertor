import { CanonicalModel, CanonicalObservation, CanonicalPatient } from '../../shared/types/canonical.types.js';
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
  const patient: CanonicalPatient = {
    name: {},
    identifier: 'healthkit-user'
  };

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

  const toDateOnly = (value?: string): string | undefined => {
    if (!value) return value;
    const tIndex = value.indexOf('T');
    return tIndex === -1 ? value : value.slice(0, tIndex);
  };

  const dailyContainerCode = {
    system: 'urn:hl7-org:local',
    code: 'healthkit-daily-samples',
    display: 'HealthKit daily samples'
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

    const grouped = new Map<string, {
      code: { system: string; code: string; display: string };
      sampleCode: { system: string; code: string; display: string };
      date: string;
      category: 'vital-signs' | 'activity' | 'exam' | 'laboratory';
      deviceUid?: string;
      components: CanonicalObservation['components'];
    }>();

    const bpGrouped = new Map<string, {
      date: string;
      deviceUid?: string;
      components: CanonicalObservation['components'];
    }>();

    for (const sample of samples) {
      if (!sample || sample.value === undefined) continue;
      const deviceUid = normalizeDeviceUid(sample.source);
      const date = toDateOnly(sample.timestamp || sample.startDate || sample.endDate);
      if (!date) continue;

      if (sample.type === 'bloodPressureSystolic' || sample.type === 'bloodPressureDiastolic') {
        const bpValue = toNumber(sample.value);
        if (bpValue === undefined) continue;
        const key = `${date}|${sample.source || ''}`;
        const entry = bpGrouped.get(key) || { date, deviceUid, components: [] };
        entry.components?.push({
          code: {
            system: 'http://loinc.org',
            code: sample.type === 'bloodPressureSystolic' ? '8480-6' : '8462-4',
            display: sample.type === 'bloodPressureSystolic' ? 'Systolic blood pressure' : 'Diastolic blood pressure'
          },
          valueQuantity: {
            value: bpValue,
            unit: 'mmHg',
            system: 'http://unitsofmeasure.org',
            code: 'mm[Hg]'
          }
        });
        if (sample.timestamp || sample.startDate || sample.endDate) {
          entry.components?.push({
            code: {
              system: 'urn:hl7-org:local',
              code: 'healthkit-sample-timestamp',
              display: 'Sample timestamp'
            },
            valueString: sample.timestamp || sample.startDate || sample.endDate
          });
        }
        bpGrouped.set(key, entry);
        continue;
      }

      const numeric = toNumber(sample.value);
      if (numeric === undefined) continue;

      const mapping = quantityTypeMap[sample.type];
      const sampleCode = mapping?.code || {
        system: 'urn:hl7-org:local',
        code: `healthkit-${sample.type}`,
        display: sample.type
      };
      const code = dailyContainerCode;
      const category = mapping?.category || 'vital-signs';
      const unit = mapping?.forceUnit ? mapping.unit : (sample.unit || mapping?.unit || '{count}');
      const unitCode = mapping?.forceUnit ? mapping.unitCode : (sample.unit || mapping?.unitCode || '{count}');
      const value = mapping?.valueTransform ? mapping.valueTransform(numeric) : numeric;
      const key = `${sample.type}|${sample.source || ''}|${date}`;

      const entry = grouped.get(key) || {
        code,
        sampleCode,
        date,
        category,
        deviceUid,
        components: []
      };

      entry.components?.push({
        code: {
          system: entry.sampleCode.system,
          code: entry.sampleCode.code,
          display: entry.sampleCode.display
        },
        valueQuantity: {
          value,
          unit,
          system: 'http://unitsofmeasure.org',
          code: unitCode
        }
      });
      if (sample.timestamp || sample.startDate || sample.endDate) {
        entry.components?.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'healthkit-sample-timestamp',
            display: 'Sample timestamp'
          },
          valueString: sample.timestamp || sample.startDate || sample.endDate
        });
      }

      grouped.set(key, entry);
    }

    for (const entry of grouped.values()) {
      if (!entry.components || entry.components.length === 0) continue;
      observations.push({
        code: entry.code,
        date: entry.date,
        device: entry.deviceUid ? { uid: entry.deviceUid } : undefined,
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: entry.category,
          display: entry.category === 'vital-signs'
            ? 'Vital Signs'
            : entry.category === 'activity'
              ? 'Activity'
              : entry.category === 'laboratory'
                ? 'Laboratory'
                : 'Exam'
        }],
        components: entry.components
      });
    }

    for (const entry of bpGrouped.values()) {
      if (!entry.components || entry.components.length === 0) continue;
      observations.push({
        code: dailyContainerCode,
        date: entry.date,
        device: entry.deviceUid ? { uid: entry.deviceUid } : undefined,
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }],
        components: entry.components
      });
    }
  };

  const handleBodySamples = (samples?: HealthKitSample[]) => {
    if (!samples || !Array.isArray(samples)) return;

    const grouped = new Map<string, {
      code: { system: string; code: string; display: string };
      sampleCode: { system: string; code: string; display: string };
      date: string;
      category: 'vital-signs' | 'activity' | 'exam' | 'laboratory';
      deviceUid?: string;
      components: CanonicalObservation['components'];
    }>();

    for (const sample of samples) {
      if (!sample || sample.value === undefined) continue;
      const deviceUid = normalizeDeviceUid(sample.source);
      const date = toDateOnly(sample.timestamp || sample.startDate || sample.endDate);
      if (!date) continue;

      if (handleMappedQuantity(sample, 'vital-signs')) continue;

      switch (sample.type) {
        case 'height': {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          const value = sample.unit === 'cm' ? numeric : numeric;
          const unit = sample.unit === 'cm' ? 'cm' : 'm';
          const unitCode = unit;
          const sampleCode = {
            system: 'http://loinc.org',
            code: '8302-2',
            display: 'Body height'
          };
          const code = dailyContainerCode;
          const key = `${sample.type}|${sample.source || ''}|${date}`;
          const entry = grouped.get(key) || {
            code,
            sampleCode,
            date,
            category: 'vital-signs',
            deviceUid,
            components: []
          };
          entry.components?.push({
            code: {
              system: entry.sampleCode.system,
              code: entry.sampleCode.code,
              display: entry.sampleCode.display
            },
            valueQuantity: {
              value,
              unit,
              system: 'http://unitsofmeasure.org',
              code: unitCode
            }
          });
          if (sample.timestamp || sample.startDate || sample.endDate) {
            entry.components?.push({
              code: {
                system: 'urn:hl7-org:local',
                code: 'healthkit-sample-timestamp',
                display: 'Sample timestamp'
              },
              valueString: sample.timestamp || sample.startDate || sample.endDate
            });
          }
          grouped.set(key, entry);
          break;
        }
        case 'weight': {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          const valueKg = sample.unit === 'g' ? numeric / 1000 : numeric;
          const sampleCode = {
            system: 'http://loinc.org',
            code: '29463-7',
            display: 'Body weight'
          };
          const code = dailyContainerCode;
          const key = `${sample.type}|${sample.source || ''}|${date}`;
          const entry = grouped.get(key) || {
            code,
            sampleCode,
            date,
            category: 'vital-signs',
            deviceUid,
            components: []
          };
          entry.components?.push({
            code: {
              system: entry.sampleCode.system,
              code: entry.sampleCode.code,
              display: entry.sampleCode.display
            },
            valueQuantity: {
              value: valueKg,
              unit: 'kg',
              system: 'http://unitsofmeasure.org',
              code: 'kg'
            }
          });
          if (sample.timestamp || sample.startDate || sample.endDate) {
            entry.components?.push({
              code: {
                system: 'urn:hl7-org:local',
                code: 'healthkit-sample-timestamp',
                display: 'Sample timestamp'
              },
              valueString: sample.timestamp || sample.startDate || sample.endDate
            });
          }
          grouped.set(key, entry);
          break;
        }
        case 'bmi': {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          const sampleCode = {
            system: 'http://loinc.org',
            code: '39156-5',
            display: 'Body mass index (BMI) [Ratio]'
          };
          const code = dailyContainerCode;
          const key = `${sample.type}|${sample.source || ''}|${date}`;
          const entry = grouped.get(key) || {
            code,
            sampleCode,
            date,
            category: 'vital-signs',
            deviceUid,
            components: []
          };
          entry.components?.push({
            code: {
              system: entry.sampleCode.system,
              code: entry.sampleCode.code,
              display: entry.sampleCode.display
            },
            valueQuantity: {
              value: numeric,
              unit: 'kg/m2',
              system: 'http://unitsofmeasure.org',
              code: 'kg/m2'
            }
          });
          if (sample.timestamp || sample.startDate || sample.endDate) {
            entry.components?.push({
              code: {
                system: 'urn:hl7-org:local',
                code: 'healthkit-sample-timestamp',
                display: 'Sample timestamp'
              },
              valueString: sample.timestamp || sample.startDate || sample.endDate
            });
          }
          grouped.set(key, entry);
          break;
        }
        case 'bodyFatPercentage': {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          const value = sample.unit === '%' && numeric <= 1 ? numeric * 100 : numeric;
          const sampleCode = {
            system: 'urn:hl7-org:local',
            code: 'body-fat-percentage',
            display: 'Body fat percentage'
          };
          const code = dailyContainerCode;
          const key = `${sample.type}|${sample.source || ''}|${date}`;
          const entry = grouped.get(key) || {
            code,
            sampleCode,
            date,
            category: 'vital-signs',
            deviceUid,
            components: []
          };
          entry.components?.push({
            code: {
              system: entry.sampleCode.system,
              code: entry.sampleCode.code,
              display: entry.sampleCode.display
            },
            valueQuantity: {
              value,
              unit: '%',
              system: 'http://unitsofmeasure.org',
              code: '%'
            }
          });
          if (sample.timestamp || sample.startDate || sample.endDate) {
            entry.components?.push({
              code: {
                system: 'urn:hl7-org:local',
                code: 'healthkit-sample-timestamp',
                display: 'Sample timestamp'
              },
              valueString: sample.timestamp || sample.startDate || sample.endDate
            });
          }
          grouped.set(key, entry);
          break;
        }
        case 'leanBodyMass': {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          const valueKg = sample.unit === 'g' ? numeric / 1000 : numeric;
          const sampleCode = {
            system: 'urn:hl7-org:local',
            code: 'lean-body-mass',
            display: 'Lean body mass'
          };
          const code = dailyContainerCode;
          const key = `${sample.type}|${sample.source || ''}|${date}`;
          const entry = grouped.get(key) || {
            code,
            sampleCode,
            date,
            category: 'vital-signs',
            deviceUid,
            components: []
          };
          entry.components?.push({
            code: {
              system: entry.sampleCode.system,
              code: entry.sampleCode.code,
              display: entry.sampleCode.display
            },
            valueQuantity: {
              value: valueKg,
              unit: 'kg',
              system: 'http://unitsofmeasure.org',
              code: 'kg'
            }
          });
          if (sample.timestamp || sample.startDate || sample.endDate) {
            entry.components?.push({
              code: {
                system: 'urn:hl7-org:local',
                code: 'healthkit-sample-timestamp',
                display: 'Sample timestamp'
              },
              valueString: sample.timestamp || sample.startDate || sample.endDate
            });
          }
          grouped.set(key, entry);
          break;
        }
        default: {
          const numeric = toNumber(sample.value);
          if (numeric === undefined) break;
          const sampleCode = {
            system: 'urn:hl7-org:local',
            code: `healthkit-${sample.type}`,
            display: sample.type
          };
          const code = dailyContainerCode;
          const key = `${sample.type}|${sample.source || ''}|${date}`;
          const entry = grouped.get(key) || {
            code,
            sampleCode,
            date,
            category: 'vital-signs',
            deviceUid,
            components: []
          };
          entry.components?.push({
            code: {
              system: entry.sampleCode.system,
              code: entry.sampleCode.code,
              display: entry.sampleCode.display
            },
            valueQuantity: {
              value: numeric,
              unit: sample.unit || '{count}',
              system: 'http://unitsofmeasure.org',
              code: sample.unit || '{count}'
            }
          });
          if (sample.timestamp || sample.startDate || sample.endDate) {
            entry.components?.push({
              code: {
                system: 'urn:hl7-org:local',
                code: 'healthkit-sample-timestamp',
                display: 'Sample timestamp'
              },
              valueString: sample.timestamp || sample.startDate || sample.endDate
            });
          }
          grouped.set(key, entry);
        }
      }
    }

    for (const entry of grouped.values()) {
      if (!entry.components || entry.components.length === 0) continue;
      observations.push({
        code: entry.code,
        date: entry.date,
        device: entry.deviceUid ? { uid: entry.deviceUid } : undefined,
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: entry.category,
          display: entry.category === 'vital-signs'
            ? 'Vital Signs'
            : entry.category === 'activity'
              ? 'Activity'
              : entry.category === 'laboratory'
                ? 'Laboratory'
                : 'Exam'
        }],
        components: entry.components
      });
    }
  };

  const handleActivitySamples = (samples?: HealthKitSample[]) => {
    if (!samples || !Array.isArray(samples)) return;

    const grouped = new Map<string, {
      code: { system: string; code: string; display: string };
      sampleCode: { system: string; code: string; display: string };
      date: string;
      category: 'vital-signs' | 'activity' | 'exam' | 'laboratory';
      deviceUid?: string;
      components: CanonicalObservation['components'];
    }>();

    for (const sample of samples) {
      if (!sample || sample.value === undefined) continue;
      const deviceUid = normalizeDeviceUid(sample.source);
      const date = toDateOnly(sample.timestamp || sample.startDate || sample.endDate);
      if (!date) continue;

      if (sample.type === 'stepCount') {
        const numeric = toNumber(sample.value);
        if (numeric === undefined) continue;
        const sampleCode = {
          system: 'http://loinc.org',
          code: '41950-7',
          display: 'Number of steps in unspecified time'
        };
        const code = dailyContainerCode;
        const key = `${sample.type}|${sample.source || ''}|${date}`;
        const entry = grouped.get(key) || {
          code,
          sampleCode,
          date,
          category: 'activity',
          deviceUid,
          components: []
        };
        entry.components?.push({
          code: {
            system: entry.sampleCode.system,
            code: entry.sampleCode.code,
            display: entry.sampleCode.display
          },
          valueQuantity: {
            value: numeric,
            unit: 'steps',
            system: 'http://unitsofmeasure.org',
            code: '{steps}'
          }
        });
        if (sample.timestamp || sample.startDate || sample.endDate) {
          entry.components?.push({
            code: {
              system: 'urn:hl7-org:local',
              code: 'healthkit-sample-timestamp',
              display: 'Sample timestamp'
            },
            valueString: sample.timestamp || sample.startDate || sample.endDate
          });
        }
        grouped.set(key, entry);
        continue;
      }

      const numeric = toNumber(sample.value);
      if (numeric === undefined) continue;
      const mapping = quantityTypeMap[sample.type];
      const sampleCode = mapping?.code || {
        system: 'urn:hl7-org:local',
        code: `healthkit-${sample.type}`,
        display: sample.type
      };
      const code = dailyContainerCode;
      const category = mapping?.category || 'activity';
      const unit = mapping?.forceUnit ? mapping.unit : (sample.unit || mapping?.unit || '{count}');
      const unitCode = mapping?.forceUnit ? mapping.unitCode : (sample.unit || mapping?.unitCode || '{count}');
      const value = mapping?.valueTransform ? mapping.valueTransform(numeric) : numeric;
      const key = `${sample.type}|${sample.source || ''}|${date}`;

      const entry = grouped.get(key) || {
        code,
        sampleCode,
        date,
        category,
        deviceUid,
        components: []
      };

      entry.components?.push({
        code: {
          system: entry.sampleCode.system,
          code: entry.sampleCode.code,
          display: entry.sampleCode.display
        },
        valueQuantity: {
          value,
          unit,
          system: 'http://unitsofmeasure.org',
          code: unitCode
        }
      });
      if (sample.timestamp || sample.startDate || sample.endDate) {
        entry.components?.push({
          code: {
            system: 'urn:hl7-org:local',
            code: 'healthkit-sample-timestamp',
            display: 'Sample timestamp'
          },
          valueString: sample.timestamp || sample.startDate || sample.endDate
        });
      }

      grouped.set(key, entry);
    }

    for (const entry of grouped.values()) {
      if (!entry.components || entry.components.length === 0) continue;
      observations.push({
        code: entry.code,
        date: entry.date,
        device: entry.deviceUid ? { uid: entry.deviceUid } : undefined,
        status: 'final',
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: entry.category,
          display: entry.category === 'vital-signs'
            ? 'Vital Signs'
            : entry.category === 'activity'
              ? 'Activity'
              : entry.category === 'laboratory'
                ? 'Laboratory'
                : 'Exam'
        }],
        components: entry.components
      });
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
          title: 'Apple HealthKit Original Request Data',
          format: 'json'
        }
      }]
    }]
  };
}
