/**
 * Whoop Device Data Types
 * 
 * Type definitions based on actual Whoop API 4.0 data structure
 */

export interface WhoopProfile {
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
}

export interface WhoopRecoveryScore {
  user_calibrating?: boolean;
  recovery_score: number;
  resting_heart_rate: number;
  hrv_rmssd_milli: number;
  spo2_percentage: number;
  skin_temp_celsius: number;
}

export interface WhoopRecovery {
  cycle_id: number;
  sleep_id?: string;
  user_id: number;
  created_at: string;
  updated_at: string;
  score_state: string;
  score: WhoopRecoveryScore;
}

export interface WhoopCycleScore {
  strain: number;
  kilojoule: number;
  average_heart_rate: number;
  max_heart_rate: number;
}

export interface WhoopCycle {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string | null;
  timezone_offset: string;
  score_state: string;
  score: WhoopCycleScore;
}

export interface WhoopSleepStageSummary {
  total_in_bed_time_milli: number;
  total_awake_time_milli: number;
  total_no_data_time_milli: number;
  total_light_sleep_time_milli: number;
  total_slow_wave_sleep_time_milli: number;
  total_rem_sleep_time_milli: number;
  sleep_cycle_count: number;
  disturbance_count: number;
}

export interface WhoopSleepNeeded {
  baseline_milli: number;
  need_from_sleep_debt_milli: number;
  need_from_recent_strain_milli: number;
  need_from_recent_nap_milli: number;
}

export interface WhoopSleepScore {
  stage_summary: WhoopSleepStageSummary;
  sleep_needed?: WhoopSleepNeeded;
  respiratory_rate: number;
  sleep_performance_percentage: number;
  sleep_consistency_percentage: number;
  sleep_efficiency_percentage: number;
}

export interface WhoopSleep {
  id: string;
  cycle_id: number;
  v1_id?: string | null;
  user_id: number;
  created_at: string;
  updated_at: string;
  start: string;
  end: string;
  timezone_offset: string;
  nap: boolean;
  score_state: string;
  score: WhoopSleepScore;
}

export interface WhoopBody {
  height_meter: number;
  weight_kilogram: number;
  max_heart_rate: number;
}

export interface WhoopData {
  profile: WhoopProfile;
  recovery?: WhoopRecovery;
  cycle?: WhoopCycle;
  sleep?: WhoopSleep;
  body?: WhoopBody;
}

