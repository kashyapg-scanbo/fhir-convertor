/**
 * Dexcom Device Data Types
 * 
 * Type definitions for Dexcom device API data structures
 */

export interface DexcomEGV {
  value?: number; // mg/dL
  timestamp?: string; // ISO timestamp
  systemTime?: string;
  displayTime?: string;
  trend?: string; // "rising", "falling", "flat", "risingQuickly", "fallingQuickly"
  status?: string; // "ok", "low", "high", "urgentLow", "urgentHigh"
  display_time?: string;
  realtimeValue?: number;
  smoothedValue?: number | null;
  realtime_value?: number;
  smoothed_value?: number;
  trendRate?: number;
  unit?: string;
}

export interface DexcomCalibration {
  value?: number;
  timestamp?: string;
  systemTime?: string;
  displayTime?: string;
  unit?: string;
}

export interface DexcomEvent {
  event_type?: string; // "calibration", "alarm", "alert"
  timestamp?: string;
  message?: string;
  severity?: string;
  systemTime?: string;
  displayTime?: string;
  eventType?: string; // "carbs", "insulin", "exercise", "health"
  eventSubType?: string | null;
  value?: number | null;
  unit?: string | null;
  eventId?: string;
  eventStatus?: string;
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
  transmitterGeneration?: string;
  displayDevice?: string;
  lastUploadDate?: string;
}

export interface DexcomData {
  user?: DexcomUserData;
  egvs?: DexcomEGV[];
  calibrations?: DexcomCalibration[];
  events?: DexcomEvent[];
  device?: DexcomDeviceData;
  devices?: DexcomDeviceData[];
  recordType?: string;
  recordVersion?: string;
  userId?: string;
  records?: unknown[];
}
