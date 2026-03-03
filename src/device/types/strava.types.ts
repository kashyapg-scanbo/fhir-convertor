/**
 * Strava Data Types
 */

export interface StravaProfile {
  id?: number;
  username?: string;
  firstname?: string;
  lastname?: string;
  city?: string;
  state?: string;
  country?: string;
  sex?: string;
  created_at?: string;
  updated_at?: string;
  weight?: number | null;
}

export interface StravaActivityTotals {
  count?: number;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  elevation_gain?: number;
  achievement_count?: number;
}

export interface StravaStats {
  biggest_ride_distance?: number;
  biggest_climb_elevation_gain?: number;
  recent_ride_totals?: StravaActivityTotals;
  all_ride_totals?: StravaActivityTotals;
  recent_run_totals?: StravaActivityTotals;
  all_run_totals?: StravaActivityTotals;
  recent_swim_totals?: StravaActivityTotals;
  all_swim_totals?: StravaActivityTotals;
  ytd_ride_totals?: StravaActivityTotals;
  ytd_run_totals?: StravaActivityTotals;
  ytd_swim_totals?: StravaActivityTotals;
}

export interface StravaActivity {
  id?: number;
  name?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  calories?: number;
  kilojoules?: number;
  total_elevation_gain?: number;
  type?: string;
  sport_type?: string;
  workout_type?: number | null;
  device_name?: string;
  start_date?: string;
  start_date_local?: string;
  timezone?: string;
  utc_offset?: number;
  start_latlng?: number[];
  end_latlng?: number[];
  average_speed?: number;
  max_speed?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_watts?: number;
  max_watts?: number;
  map?: {
    summary_polyline?: string;
    polyline?: string;
  };
}

export interface StravaData {
  profile?: StravaProfile;
  stats?: StravaStats;
  activities?: StravaActivity[];
  latestActivityDetails?: StravaActivity;
}
