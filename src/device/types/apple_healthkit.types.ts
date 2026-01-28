/**
 * Apple HealthKit Data Types
 */

export interface HealthKitSample {
  type: string;
  value?: number | string;
  unit?: string;
  timestamp?: string;
  startDate?: string;
  endDate?: string;
  source?: string;
}

export interface HealthKitWorkout {
  type: 'workout';
  startDate: string;
  endDate: string;
  activityType?: number;
  calories?: number;
  distance?: number;
  duration?: number;
}

export interface HealthKitSection {
  available?: boolean;
  data?: HealthKitSample[];
}

export interface HealthKitData {
  heart?: HealthKitSection;
  respiratory?: HealthKitSection;
  hearing?: HealthKitSection;
  reproductive?: HealthKitSection;
  body?: HealthKitSection;
  activity?: HealthKitSection;
  sleep?: HealthKitSection;
  sleepAnalysis?: HealthKitSection;
  workouts?: {
    available?: boolean;
    data?: HealthKitWorkout[];
  };
  mindfulness?: { available?: boolean };
  symptoms?: { available?: boolean };
}
