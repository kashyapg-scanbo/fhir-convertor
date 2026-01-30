/**
 * Android Health Connect Data Types
 */

export type AndroidHealthConnectQuantity = {
  type?: string;
  value?: number;
};

export type AndroidHealthConnectMetadata = {
  id?: string;
  clientRecordId?: string;
  clientRecordVersion?: number;
  dataOrigin?: {
    packageName?: string;
  };
  lastModifiedTime?: unknown;
  recordingMethod?: number;
};

export interface AndroidHealthConnectActivityIntensity {
  activityIntensityType?: number;
  startTime?: unknown;
  endTime?: unknown;
  startZoneOffset?: unknown;
  endZoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectDistance {
  distance?: AndroidHealthConnectQuantity;
  startTime?: unknown;
  endTime?: unknown;
  startZoneOffset?: unknown;
  endZoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectExercise {
  exerciseType?: number;
  title?: string;
  notes?: string;
  startTime?: unknown;
  endTime?: unknown;
  startZoneOffset?: unknown;
  endZoneOffset?: unknown;
  exerciseRouteResult?: unknown;
  laps?: unknown[];
  segments?: unknown[];
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectSpeedSample {
  speed?: AndroidHealthConnectQuantity;
  time?: unknown;
}

export interface AndroidHealthConnectSpeed {
  samples?: AndroidHealthConnectSpeedSample[];
  startTime?: unknown;
  endTime?: unknown;
  startZoneOffset?: unknown;
  endZoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectSteps {
  count?: number;
  startTime?: unknown;
  endTime?: unknown;
  startZoneOffset?: unknown;
  endZoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectTotalCaloriesBurned {
  energy?: AndroidHealthConnectQuantity;
  startTime?: unknown;
  endTime?: unknown;
  startZoneOffset?: unknown;
  endZoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectBasalMetabolicRate {
  basalMetabolicRate?: AndroidHealthConnectQuantity;
  time?: unknown;
  zoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectBodyFat {
  percentage?: {
    value?: number;
  };
  time?: unknown;
  zoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectHeight {
  height?: AndroidHealthConnectQuantity;
  time?: unknown;
  zoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectWeight {
  weight?: AndroidHealthConnectQuantity;
  time?: unknown;
  zoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectHydration {
  volume?: AndroidHealthConnectQuantity;
  startTime?: unknown;
  endTime?: unknown;
  startZoneOffset?: unknown;
  endZoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectNutrition {
  name?: string;
  mealType?: number;
  energy?: AndroidHealthConnectQuantity;
  cholesterol?: AndroidHealthConnectQuantity;
  dietaryFiber?: AndroidHealthConnectQuantity;
  protein?: AndroidHealthConnectQuantity;
  sodium?: AndroidHealthConnectQuantity;
  sugar?: AndroidHealthConnectQuantity;
  totalCarbohydrate?: AndroidHealthConnectQuantity;
  totalFat?: AndroidHealthConnectQuantity;
  transFat?: AndroidHealthConnectQuantity;
  saturatedFat?: AndroidHealthConnectQuantity;
  unsaturatedFat?: AndroidHealthConnectQuantity;
  monounsaturatedFat?: AndroidHealthConnectQuantity;
  polyunsaturatedFat?: AndroidHealthConnectQuantity;
  potassium?: AndroidHealthConnectQuantity;
  startTime?: unknown;
  endTime?: unknown;
  startZoneOffset?: unknown;
  endZoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectSleepSession {
  stages?: unknown[];
  startTime?: unknown;
  endTime?: unknown;
  startZoneOffset?: unknown;
  endZoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectBloodGlucose {
  level?: AndroidHealthConnectQuantity;
  mealType?: number;
  relationToMeal?: number;
  specimenSource?: number;
  time?: unknown;
  zoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectBodyTemperature {
  temperature?: AndroidHealthConnectQuantity;
  measurementLocation?: number;
  time?: unknown;
  zoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectHeartRateSample {
  beatsPerMinute?: number;
  time?: unknown;
}

export interface AndroidHealthConnectHeartRate {
  samples?: AndroidHealthConnectHeartRateSample[];
  startTime?: unknown;
  endTime?: unknown;
  startZoneOffset?: unknown;
  endZoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectOxygenSaturation {
  percentage?: {
    value?: number;
  };
  time?: unknown;
  zoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectRespiratoryRate {
  rate?: number;
  time?: unknown;
  zoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectRestingHeartRate {
  beatsPerMinute?: number;
  time?: unknown;
  zoneOffset?: unknown;
  metadata?: AndroidHealthConnectMetadata;
}

export interface AndroidHealthConnectData {
  'Activity Intensity'?: AndroidHealthConnectActivityIntensity;
  'Distance'?: AndroidHealthConnectDistance;
  'Exercise'?: AndroidHealthConnectExercise;
  'Speed'?: AndroidHealthConnectSpeed;
  'Steps'?: AndroidHealthConnectSteps;
  'Total Calories Burned'?: AndroidHealthConnectTotalCaloriesBurned;
  'Basal Metabolic Rate'?: AndroidHealthConnectBasalMetabolicRate;
  'Body Fat'?: AndroidHealthConnectBodyFat;
  'Height'?: AndroidHealthConnectHeight;
  'Weight'?: AndroidHealthConnectWeight;
  'Hydration'?: AndroidHealthConnectHydration;
  'Nutrition'?: AndroidHealthConnectNutrition;
  'Sleep Session'?: AndroidHealthConnectSleepSession;
  'Blood Glucose'?: AndroidHealthConnectBloodGlucose;
  'Body Temperature'?: AndroidHealthConnectBodyTemperature;
  'Heart Rate'?: AndroidHealthConnectHeartRate;
  'Oxygen Saturation'?: AndroidHealthConnectOxygenSaturation;
  'Respiratory Rate'?: AndroidHealthConnectRespiratoryRate;
  'Resting Heart Rate'?: AndroidHealthConnectRestingHeartRate;
  [key: string]: unknown;
}
