/**
 * Android Health Connect (Oura-style) Data Types
 */

export interface AndroidHealthConnectDailyActivity {
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

export interface AndroidHealthConnectSpo2 {
  id?: string;
  day?: string;
  breathing_disturbance_index?: number;
  spo2_percentage?: { average?: number };
}

export interface AndroidHealthConnectSleep {
  id?: string;
  day?: string;
  score?: number;
  timestamp?: string;
  contributors?: Record<string, number | null>;
}

export interface AndroidHealthConnectSleepDetailed {
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

export interface AndroidHealthConnectVo2 {
  id?: string;
  day?: string;
  timestamp?: string;
  vo2_max?: number;
}

export interface AndroidHealthConnectWorkout {
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

export interface AndroidHealthConnectHeartRate {
  timestamp?: string;
  bpm?: number;
  source?: string;
}

export interface AndroidHealthConnectPersonalInfo {
  id?: string;
  age?: number;
  weight?: number;
  height?: number;
  biological_sex?: string;
  email?: string;
}

export interface AndroidHealthConnectData {
  'Daily Activity'?: AndroidHealthConnectDailyActivity | AndroidHealthConnectDailyActivity[];
  'Cardiovascular age'?: { day?: string; vascular_age?: number };
  'Readiness'?: { day?: string; score?: number; timestamp?: string; temperature_deviation?: number; temperature_trend_deviation?: number; contributors?: Record<string, number | null> };
  'Resilience'?: { day?: string; level?: string; contributors?: Record<string, number | null> };
  'Sleep'?: AndroidHealthConnectSleep | AndroidHealthConnectSleep[];
  'Sleep Detailed'?: AndroidHealthConnectSleepDetailed | AndroidHealthConnectSleepDetailed[];
  'Spo2'?: AndroidHealthConnectSpo2 | AndroidHealthConnectSpo2[];
  'Stress'?: { day?: string; day_summary?: string; stress_high?: number; recovery_high?: number };
  'Enhanced Tag'?: { start_time?: string; end_time?: string; comment?: string; tag_type_code?: string };
  'Tag'?: { day?: string; text?: string; timestamp?: string; tags?: string[] };
  'Rest Mode Period'?: { start_time?: string; end_time?: string; episodes?: Array<{ timestamp?: string; tags?: string[] }> };
  'Sleep Time'?: { day?: string; recommendation?: string; status?: string };
  'Vo2'?: AndroidHealthConnectVo2 | AndroidHealthConnectVo2[];
  'Workout'?: AndroidHealthConnectWorkout | AndroidHealthConnectWorkout[];
  'Heart Rate'?: AndroidHealthConnectHeartRate | AndroidHealthConnectHeartRate[];
  'Personal Info'?: AndroidHealthConnectPersonalInfo;
}
