/**
 * Device Module
 * 
 * Central export for all device-related functionality
 * 
 * This module handles conversion of wearable device data (Whoop, Dexcom, etc.)
 * to FHIR R5 format.
 */

// Export parsers
export { parseWhoop, parseDexcom, parseAppleHealthKit, parseOura, parseStrava } from './parsers/index.js';

// Export types
export type {
  WhoopData,
  WhoopProfile,
  WhoopRecovery,
  WhoopRecoveryScore,
  WhoopCycle,
  WhoopCycleScore,
  WhoopSleep,
  WhoopSleepScore,
  WhoopSleepStageSummary,
  WhoopBody
} from './types/whoop.types.js';

export type {
  DexcomData,
  DexcomEGV,
  DexcomCalibration,
  DexcomEvent,
  DexcomUserData,
  DexcomDeviceData
} from './types/dexcom.types.js';

export type {
  HealthKitData,
  HealthKitSample,
  HealthKitWorkout,
  HealthKitSection
} from './types/apple_healthkit.types.js';

export type {
  OuraData
} from './types/oura.types.js';

export type {
  StravaData,
  StravaProfile,
  StravaStats,
  StravaActivity
} from './types/strava.types.js';
