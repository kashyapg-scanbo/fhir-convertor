/**
 * Oura Device Data Types
 */

export interface OuraDailyActivity {
  id?: string;
  day?: string;
  timestamp?: string;
  steps?: number;
  total_calories?: number;
  active_calories?: number;
  target_calories?: number;
  equivalent_walking_distance?: number;
  score?: number;
}

export interface OuraSpo2 {
  id?: string;
  day?: string;
  breathing_disturbance_index?: number;
  spo2_percentage?: { average?: number };
}

export interface OuraSleep {
  id?: string;
  day?: string;
  score?: number;
  timestamp?: string;
  contributors?: Record<string, number | null>;
}

export interface OuraSleepDetailed {
  id?: string;
  day?: string;
  bedtime_start?: string;
  bedtime_end?: string;
  average_breath?: number;
  average_heart_rate?: number;
  average_hrv?: number;
  awake_time?: number;
  deep_sleep_duration?: number;
  light_sleep_duration?: number;
  rem_sleep_duration?: number;
  total_sleep_duration?: number;
  time_in_bed?: number;
  latency?: number;
  lowest_heart_rate?: number;
  efficiency?: number;
  type?: string;
}

export interface OuraVo2 {
  id?: string;
  day?: string;
  timestamp?: string;
  vo2_max?: number;
}

export interface OuraWorkout {
  id?: string;
  day?: string;
  activity?: string;
  calories?: number;
  distance?: number;
  start_datetime?: string;
  end_datetime?: string;
  intensity?: string;
  label?: string;
  source?: string;
}

export interface OuraHeartRate {
  timestamp?: string;
  bpm?: number;
  source?: string;
}

export interface OuraPersonalInfo {
  id?: string;
  age?: number;
  weight?: number;
  height?: number;
  biological_sex?: string;
  email?: string;
}

export interface OuraData {
  'Daily Activity'?: OuraDailyActivity | OuraDailyActivity[];
  'Cardiovascular age'?: { day?: string; vascular_age?: number };
  'Readiness'?: { day?: string; score?: number; timestamp?: string; temperature_deviation?: number; temperature_trend_deviation?: number; contributors?: Record<string, number | null> };
  'Resilience'?: { day?: string; level?: string; contributors?: Record<string, number | null> };
  'Sleep'?: OuraSleep | OuraSleep[];
  'Sleep Detailed'?: OuraSleepDetailed | OuraSleepDetailed[];
  'Spo2'?: OuraSpo2 | OuraSpo2[];
  'Stress'?: { day?: string; day_summary?: string; stress_high?: number; recovery_high?: number };
  'Enhanced Tag'?: { start_time?: string; end_time?: string; comment?: string; tag_type_code?: string };
  'Tag'?: { day?: string; text?: string; timestamp?: string; tags?: string[] };
  'Rest Mode Period'?: { start_time?: string; end_time?: string; episodes?: Array<{ timestamp?: string; tags?: string[] }> };
  'Sleep Time'?: { day?: string; recommendation?: string; status?: string };
  'Vo2'?: OuraVo2 | OuraVo2[];
  'Workout'?: OuraWorkout | OuraWorkout[];
  'Heart Rate'?: OuraHeartRate | OuraHeartRate[];
  'Personal Info'?: OuraPersonalInfo;
}
