/**
 * Dexcom Device Data Types
 * 
 * Type definitions for Dexcom device API data structures
 */

export interface DexcomEGV {
  value?: number; // mg/dL
  timestamp?: string; // ISO timestamp
  trend?: string; // "rising", "falling", "flat", "risingQuickly", "fallingQuickly"
  status?: string; // "ok", "low", "high", "urgentLow", "urgentHigh"
  display_time?: string;
  realtime_value?: number;
  smoothed_value?: number;
}

export interface DexcomCalibration {
  value?: number;
  timestamp?: string;
  unit?: string;
}

export interface DexcomEvent {
  event_type?: string; // "calibration", "alarm", "alert"
  timestamp?: string;
  message?: string;
  severity?: string;
}

export interface DexcomUserData {
  id?: string;
  name?: string;
  email?: string;
  date_of_birth?: string;
  gender?: string;
}

export interface DexcomDeviceData {
  transmitter_id?: string;
  model?: string; // "G6", "G7"
  serial_number?: string;
  firmware_version?: string;
}

export interface DexcomData {
  user?: DexcomUserData;
  egvs?: DexcomEGV[];
  calibrations?: DexcomCalibration[];
  events?: DexcomEvent[];
  device?: DexcomDeviceData;
}

