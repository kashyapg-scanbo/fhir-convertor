import { CanonicalModel, CanonicalObservation, CanonicalPatient } from '../../shared/types/canonical.types.js';
import type {
  AndroidHealthConnectData,
  AndroidHealthConnectQuantity,
  AndroidHealthConnectSpeedSample,
  AndroidHealthConnectHeartRateSample
} from '../types/android_health_connect.types.js';

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

  const toNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    return undefined;
  };

  const pickTime = (value: unknown): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value !== 'object') return undefined;
    const obj = value as Record<string, unknown>;
    const candidates = ['time', 'dateTime', 'instant', 'startTime', 'endTime'];
    for (const key of candidates) {
      const candidate = obj[key];
      if (typeof candidate === 'string' && candidate) return candidate;
    }
    return undefined;
  };

  const normalizeQuantity = (quantity?: AndroidHealthConnectQuantity, options?: { forceUnit?: string }): { value?: number; unit?: string; code?: string } => {
    if (!quantity) return {};
    const rawValue = toNumber(quantity.value);
    if (rawValue === undefined) return {};
    const type = quantity.type || '';
    let value = Number(rawValue.toFixed(6));

    const forcedUnit = options?.forceUnit;

    if (forcedUnit) {
      if (forcedUnit === 'cm' && type === 'METERS') {
        value = Number((rawValue * 100).toFixed(3));
      }
      return { value, unit: forcedUnit, code: forcedUnit };
    }

    switch (type) {
      case 'METERS':
        return { value, unit: 'm', code: 'm' };
      case 'METERS_PER_SECOND':
        return { value, unit: 'm/s', code: 'm/s' };
      case 'CALORIES':
        return { value, unit: 'kcal', code: 'kcal' };
      case 'WATTS':
        return { value, unit: 'W', code: 'W' };
      case 'GRAMS':
        return { value, unit: 'g', code: 'g' };
      case 'LITERS':
        return { value, unit: 'L', code: 'L' };
      case 'CELSIUS':
        return { value, unit: 'Cel', code: 'Cel' };
      case 'MILLIMOLES_PER_LITER':
        return { value, unit: 'mmol/L', code: 'mmol/L' };
      default:
        return { value };
    }
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

  const addSimpleObservation = (
    code: { system: string; code: string; display: string },
    value: number,
    unit?: string,
    unitCode?: string,
    date?: string,
    category: 'vital-signs' | 'activity' | 'exam' | 'laboratory' = 'activity',
    effectivePeriod?: { start?: string; end?: string }
  ) => {
    const observation: CanonicalObservation = {
      code,
      value,
      date,
      status: 'final',
      category: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: category,
        display: categoryDisplay(category)
      }]
    };

    if (unit && unitCode) {
      observation.unit = unit;
      observation.unitCode = unitCode;
      observation.unitSystem = 'http://unitsofmeasure.org';
    }

    if (effectivePeriod?.start || effectivePeriod?.end) {
      observation.effectivePeriod = {
        start: effectivePeriod.start,
        end: effectivePeriod.end
      };
    }

    pushObservation(observation);
  };

  const addQuantityObservation = (
    code: { system: string; code: string; display: string },
    quantity?: AndroidHealthConnectQuantity,
    date?: string,
    category: 'vital-signs' | 'activity' | 'exam' | 'laboratory' = 'activity',
    effectivePeriod?: { start?: string; end?: string },
    options?: { forceUnit?: string }
  ) => {
    const normalized = normalizeQuantity(quantity, options);
    if (normalized.value === undefined) return;
    addSimpleObservation(code, normalized.value, normalized.unit, normalized.code, date, category, effectivePeriod);
  };

  const addPercentObservation = (
    code: { system: string; code: string; display: string },
    value?: number,
    date?: string,
    category: 'vital-signs' | 'activity' | 'exam' | 'laboratory' = 'exam'
  ) => {
    const numeric = toNumber(value);
    if (numeric === undefined) return;
    addSimpleObservation(code, numeric, '%', '%', date, category);
  };

  const activityIntensity = data['Activity Intensity'];
  if (activityIntensity?.activityIntensityType !== undefined) {
    const start = pickTime(activityIntensity.startTime);
    const end = pickTime(activityIntensity.endTime);
    addSimpleObservation(
      { system: 'urn:hl7-org:local', code: 'activity-intensity', display: 'Activity intensity' },
      activityIntensity.activityIntensityType,
      undefined,
      undefined,
      start,
      'activity',
      { start, end }
    );
  }

  const distance = data['Distance'];
  if (distance?.distance) {
    const start = pickTime(distance.startTime);
    const end = pickTime(distance.endTime);
    addQuantityObservation(
      { system: 'urn:hl7-org:local', code: 'distance', display: 'Distance' },
      distance.distance,
      start,
      'activity',
      { start, end }
    );
  }

  const exercise = data['Exercise'];
  if (exercise) {
    const start = pickTime(exercise.startTime);
    const end = pickTime(exercise.endTime);
    const components: CanonicalObservation['components'] = [];
    if (exercise.exerciseType !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'exercise-type', display: 'Exercise type' },
        valueInteger: exercise.exerciseType
      });
    }
    if (exercise.title) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'exercise-title', display: 'Exercise title' },
        valueString: exercise.title
      });
    }
    if (exercise.notes) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'exercise-notes', display: 'Exercise notes' },
        valueString: exercise.notes
      });
    }

    if (components.length > 0 || start || end) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'exercise', display: 'Exercise session' },
        status: 'final',
        date: start,
        effectivePeriod: start || end ? { start, end } : undefined,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components
      });
    }
  }

  const speed = data['Speed'];
  if (speed?.samples?.length) {
    for (const sample of speed.samples as AndroidHealthConnectSpeedSample[]) {
      const sampleTime = pickTime(sample.time) || pickTime(speed.startTime);
      addQuantityObservation(
        { system: 'urn:hl7-org:local', code: 'speed', display: 'Speed' },
        sample.speed,
        sampleTime,
        'activity'
      );
    }
  }

  const steps = data['Steps'];
  if (steps?.count !== undefined) {
    const start = pickTime(steps.startTime);
    const end = pickTime(steps.endTime);
    addSimpleObservation(
      { system: 'http://loinc.org', code: '41950-7', display: 'Number of steps in 24 Hours, Measured' },
      steps.count,
      'count',
      '{count}',
      start,
      'activity',
      { start, end }
    );
  }

  const calories = data['Total Calories Burned'];
  if (calories?.energy) {
    const start = pickTime(calories.startTime);
    const end = pickTime(calories.endTime);
    addQuantityObservation(
      { system: 'http://loinc.org', code: '41981-2', display: 'Calories burned' },
      calories.energy,
      start,
      'activity',
      { start, end },
      { forceUnit: 'kcal' }
    );
  }

  const bmr = data['Basal Metabolic Rate'];
  if (bmr?.basalMetabolicRate) {
    const time = pickTime(bmr.time);
    addQuantityObservation(
      { system: 'urn:hl7-org:local', code: 'basal-metabolic-rate', display: 'Basal metabolic rate' },
      bmr.basalMetabolicRate,
      time,
      'exam'
    );
  }

  const bodyFat = data['Body Fat'];
  if (bodyFat?.percentage?.value !== undefined) {
    const time = pickTime(bodyFat.time);
    addPercentObservation(
      { system: 'http://loinc.org', code: '41982-0', display: 'Percentage of body fat Measured' },
      bodyFat.percentage.value,
      time,
      'exam'
    );
  }

  const height = data['Height'];
  if (height?.height) {
    const time = pickTime(height.time);
    addQuantityObservation(
      { system: 'http://loinc.org', code: '8302-2', display: 'Body height' },
      height.height,
      time,
      'exam',
      undefined,
      { forceUnit: 'cm' }
    );
  }

  const weight = data['Weight'];
  if (weight?.weight) {
    const time = pickTime(weight.time);
    const normalized = normalizeQuantity(weight.weight);
    if (normalized.value !== undefined) {
      const kgValue = normalized.unit === 'g' ? normalized.value / 1000 : normalized.value;
      addSimpleObservation(
        { system: 'http://loinc.org', code: '29463-7', display: 'Body weight' },
        kgValue,
        'kg',
        'kg',
        time,
        'exam'
      );
    }
  }

  const hydration = data['Hydration'];
  if (hydration?.volume) {
    const start = pickTime(hydration.startTime);
    const end = pickTime(hydration.endTime);
    addQuantityObservation(
      { system: 'urn:hl7-org:local', code: 'hydration-volume', display: 'Hydration volume' },
      hydration.volume,
      start,
      'activity',
      { start, end }
    );
  }

  const nutrition = data['Nutrition'];
  if (nutrition) {
    const start = pickTime(nutrition.startTime);
    const end = pickTime(nutrition.endTime);
    const components: CanonicalObservation['components'] = [];
    const addNutritionQuantity = (code: string, display: string, quantity?: AndroidHealthConnectQuantity) => {
      const normalized = normalizeQuantity(quantity);
      if (normalized.value === undefined || !normalized.unit) return;
      components.push({
        code: { system: 'urn:hl7-org:local', code, display },
        valueQuantity: {
          value: normalized.value,
          unit: normalized.unit,
          system: 'http://unitsofmeasure.org',
          code: normalized.code || normalized.unit
        }
      });
    };

    if (nutrition.mealType !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'meal-type', display: 'Meal type' },
        valueInteger: nutrition.mealType
      });
    }

    if (nutrition.name) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'meal-name', display: 'Meal name' },
        valueString: nutrition.name
      });
    }

    addNutritionQuantity('energy', 'Energy', nutrition.energy);
    addNutritionQuantity('cholesterol', 'Cholesterol', nutrition.cholesterol);
    addNutritionQuantity('dietary-fiber', 'Dietary fiber', nutrition.dietaryFiber);
    addNutritionQuantity('protein', 'Protein', nutrition.protein);
    addNutritionQuantity('sodium', 'Sodium', nutrition.sodium);
    addNutritionQuantity('sugar', 'Sugar', nutrition.sugar);
    addNutritionQuantity('total-carbohydrate', 'Total carbohydrate', nutrition.totalCarbohydrate);
    addNutritionQuantity('total-fat', 'Total fat', nutrition.totalFat);
    addNutritionQuantity('trans-fat', 'Trans fat', nutrition.transFat);
    addNutritionQuantity('saturated-fat', 'Saturated fat', nutrition.saturatedFat);
    addNutritionQuantity('unsaturated-fat', 'Unsaturated fat', nutrition.unsaturatedFat);
    addNutritionQuantity('monounsaturated-fat', 'Monounsaturated fat', nutrition.monounsaturatedFat);
    addNutritionQuantity('polyunsaturated-fat', 'Polyunsaturated fat', nutrition.polyunsaturatedFat);
    addNutritionQuantity('potassium', 'Potassium', nutrition.potassium);

    if (components.length > 0) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'nutrition', display: 'Nutrition intake' },
        status: 'final',
        date: start,
        effectivePeriod: start || end ? { start, end } : undefined,
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components
      });
    }
  }

  const sleep = data['Sleep Session'];
  if (sleep) {
    const start = pickTime(sleep.startTime);
    const end = pickTime(sleep.endTime);
    if (start || end) {
      pushObservation({
        code: { system: 'urn:hl7-org:local', code: 'sleep-session', display: 'Sleep session' },
        status: 'final',
        date: start,
        effectivePeriod: { start, end },
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }]
      });
    }
  }

  const bloodGlucose = data['Blood Glucose'];
  if (bloodGlucose?.level) {
    const time = pickTime(bloodGlucose.time);
    addQuantityObservation(
      { system: 'http://loinc.org', code: '15074-8', display: 'Glucose [Moles/volume] in Blood' },
      bloodGlucose.level,
      time,
      'laboratory'
    );
  }

  const bodyTemperature = data['Body Temperature'];
  if (bodyTemperature?.temperature) {
    const time = pickTime(bodyTemperature.time);
    addQuantityObservation(
      { system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' },
      bodyTemperature.temperature,
      time,
      'vital-signs'
    );
  }

  const heartRate = data['Heart Rate'];
  if (heartRate?.samples?.length) {
    for (const sample of heartRate.samples as AndroidHealthConnectHeartRateSample[]) {
      const sampleTime = pickTime(sample.time) || pickTime(heartRate.startTime);
      const bpm = toNumber(sample.beatsPerMinute);
      if (bpm === undefined) continue;
      addSimpleObservation(
        { system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' },
        bpm,
        'beats/min',
        '/min',
        sampleTime,
        'vital-signs'
      );
    }
  }

  const oxygen = data['Oxygen Saturation'];
  if (oxygen?.percentage?.value !== undefined) {
    const time = pickTime(oxygen.time);
    addPercentObservation(
      { system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation in Arterial blood' },
      oxygen.percentage.value,
      time,
      'vital-signs'
    );
  }

  const respRate = data['Respiratory Rate'];
  if (respRate?.rate !== undefined) {
    const time = pickTime(respRate.time);
    addSimpleObservation(
      { system: 'http://loinc.org', code: '9279-1', display: 'Respiratory rate' },
      respRate.rate,
      'breaths/min',
      '/min',
      time,
      'vital-signs'
    );
  }

  const restingHr = data['Resting Heart Rate'];
  if (restingHr?.beatsPerMinute !== undefined) {
    const time = pickTime(restingHr.time);
    addSimpleObservation(
      { system: 'http://loinc.org', code: '40443-4', display: 'Heart rate - resting' },
      restingHr.beatsPerMinute,
      'beats/min',
      '/min',
      time,
      'vital-signs'
    );
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
