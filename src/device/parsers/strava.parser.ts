import { CanonicalModel, CanonicalObservation, CanonicalPatient } from '../../shared/types/canonical.types.js';
import type { StravaActivity, StravaActivityTotals, StravaData } from '../types/strava.types.js';

/**
 * Strava Data Parser
 *
 * Converts Strava JSON data to Canonical Model
 */
export function parseStrava(input: string): CanonicalModel {
  let data: StravaData;

  try {
    data = JSON.parse(input);
  } catch (e) {
    throw new Error('Invalid JSON input for Strava parser');
  }

  const observations: CanonicalObservation[] = [];
  const originalDataBase64 = Buffer.from(input, 'utf8').toString('base64');

  const patient: CanonicalPatient = {
    name: {},
    identifier: data.profile?.id ? `strava-${data.profile.id}` : 'strava-user'
  };

  if (data.profile?.firstname) {
    patient.name.given = [data.profile.firstname];
  }
  if (data.profile?.lastname) {
    patient.name.family = data.profile.lastname;
  }

  if (data.profile?.sex) {
    const normalized = data.profile.sex.toLowerCase();
    if (normalized === 'm') patient.gender = 'male';
    if (normalized === 'f') patient.gender = 'female';
  }

  if (data.profile?.city || data.profile?.state || data.profile?.country) {
    patient.address = [{
      city: data.profile.city || undefined,
      state: data.profile.state || undefined,
      country: data.profile.country || undefined
    }];
  }

  const toDateOnly = (value?: string): string | undefined => {
    if (!value) return value;
    const tIndex = value.indexOf('T');
    return tIndex === -1 ? value : value.slice(0, tIndex);
  };

  const toNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
      return Number(value);
    }
    return undefined;
  };

  const addSeconds = (start?: string, seconds?: number): string | undefined => {
    if (!start || typeof seconds !== 'number') return undefined;
    const ms = Date.parse(start);
    if (Number.isNaN(ms)) return undefined;
    return new Date(ms + seconds * 1000).toISOString();
  };

  const metersToKm = (meters?: number): number | undefined => {
    if (typeof meters !== 'number' || Number.isNaN(meters)) return undefined;
    const km = meters / 1000;
    return Number(km.toFixed(6));
  };

  const normalizeDeviceUid = (name?: string): string => {
    if (!name) return 'strava';
    return `strava-${name.replace(/\\s+/g, '-').toLowerCase()}`;
  };

  const pushActivityObservation = (activity: StravaActivity) => {
    const components: CanonicalObservation['components'] = [];
    const deviceUid = normalizeDeviceUid(activity.device_name);

    if (activity.type) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'activity-type', display: 'Activity type' },
        valueCodeableConcept: {
          coding: [{
            system: 'urn:hl7-org:local',
            code: activity.type,
            display: activity.type
          }]
        }
      });
    }

    if (activity.sport_type) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'sport-type', display: 'Sport type' },
        valueCodeableConcept: {
          coding: [{
            system: 'urn:hl7-org:local',
            code: activity.sport_type,
            display: activity.sport_type
          }]
        }
      });
    }

    if (activity.workout_type !== undefined && activity.workout_type !== null) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'workout-type', display: 'Workout type' },
        valueInteger: Math.round(activity.workout_type)
      });
    }

    if (activity.name) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'activity-name', display: 'Activity name' },
        valueString: activity.name
      });
    }

    if (activity.device_name) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'device-name', display: 'Device name' },
        valueString: activity.device_name
      });
    }

    const distanceMeters = toNumber(activity.distance);
    const distanceKm = metersToKm(distanceMeters);
    if (distanceKm !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'distance', display: 'Distance' },
        valueQuantity: {
          value: distanceKm,
          unit: 'km',
          system: 'http://unitsofmeasure.org',
          code: 'km'
        }
      });
    }

    const movingTime = toNumber(activity.moving_time);
    if (movingTime !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'moving-time', display: 'Moving time' },
        valueQuantity: {
          value: movingTime,
          unit: 's',
          system: 'http://unitsofmeasure.org',
          code: 's'
        }
      });
    }

    const elapsedTime = toNumber(activity.elapsed_time);
    if (elapsedTime !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'elapsed-time', display: 'Elapsed time' },
        valueQuantity: {
          value: elapsedTime,
          unit: 's',
          system: 'http://unitsofmeasure.org',
          code: 's'
        }
      });
    }

    const elevationGain = toNumber(activity.total_elevation_gain);
    if (elevationGain !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'elevation-gain', display: 'Elevation gain' },
        valueQuantity: {
          value: elevationGain,
          unit: 'm',
          system: 'http://unitsofmeasure.org',
          code: 'm'
        }
      });
    }

    const avgSpeed = toNumber(activity.average_speed);
    if (avgSpeed !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'average-speed', display: 'Average speed' },
        valueQuantity: {
          value: avgSpeed,
          unit: 'm/s',
          system: 'http://unitsofmeasure.org',
          code: 'm/s'
        }
      });
    }

    const maxSpeed = toNumber(activity.max_speed);
    if (maxSpeed !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'max-speed', display: 'Max speed' },
        valueQuantity: {
          value: maxSpeed,
          unit: 'm/s',
          system: 'http://unitsofmeasure.org',
          code: 'm/s'
        }
      });
    }

    if (movingTime !== undefined && distanceKm !== undefined && distanceKm > 0) {
      const paceSecondsPerKm = movingTime / distanceKm;
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'pace', display: 'Pace' },
        valueQuantity: {
          value: paceSecondsPerKm,
          unit: 's/km',
          system: 'http://unitsofmeasure.org',
          code: 's/km'
        }
      });
    }

    const calories = toNumber(activity.calories);
    if (calories !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'calories', display: 'Calories' },
        valueQuantity: {
          value: calories,
          unit: 'kcal',
          system: 'http://unitsofmeasure.org',
          code: 'kcal'
        }
      });
    }

    const kilojoules = toNumber(activity.kilojoules);
    if (kilojoules !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'kilojoules', display: 'Kilojoules' },
        valueQuantity: {
          value: kilojoules,
          unit: 'kJ',
          system: 'http://unitsofmeasure.org',
          code: 'kJ'
        }
      });
    }

    const avgHr = toNumber(activity.average_heartrate);
    if (avgHr !== undefined) {
      components.push({
        code: { system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' },
        valueQuantity: {
          value: avgHr,
          unit: 'beats/min',
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      });
    }

    const maxHr = toNumber(activity.max_heartrate);
    if (maxHr !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'max-heart-rate', display: 'Max heart rate' },
        valueQuantity: {
          value: maxHr,
          unit: 'beats/min',
          system: 'http://unitsofmeasure.org',
          code: '/min'
        }
      });
    }

    const avgWatts = toNumber(activity.average_watts);
    if (avgWatts !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'average-power', display: 'Average power' },
        valueQuantity: {
          value: avgWatts,
          unit: 'W',
          system: 'http://unitsofmeasure.org',
          code: 'W'
        }
      });
    }

    const maxWatts = toNumber(activity.max_watts);
    if (maxWatts !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'max-power', display: 'Max power' },
        valueQuantity: {
          value: maxWatts,
          unit: 'W',
          system: 'http://unitsofmeasure.org',
          code: 'W'
        }
      });
    }

    if (activity.map?.summary_polyline) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'summary-polyline', display: 'Summary polyline' },
        valueString: activity.map.summary_polyline
      });
    } else if (activity.map?.polyline) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'polyline', display: 'Polyline' },
        valueString: activity.map.polyline
      });
    }

    if (Array.isArray(activity.start_latlng) && activity.start_latlng.length === 2) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'start-latlng', display: 'Start location' },
        valueString: `${activity.start_latlng[0]},${activity.start_latlng[1]}`
      });
    }

    if (Array.isArray(activity.end_latlng) && activity.end_latlng.length === 2) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'end-latlng', display: 'End location' },
        valueString: `${activity.end_latlng[0]},${activity.end_latlng[1]}`
      });
    }

    if (components.length === 0) return;

    const startDate = activity.start_date || activity.start_date_local;
    const endDate = addSeconds(activity.start_date || activity.start_date_local, elapsedTime);

    observations.push({
      code: { system: 'urn:hl7-org:local', code: 'strava-activity', display: 'Strava activity' },
      status: 'final',
      date: toDateOnly(startDate),
      effectivePeriod: {
        start: startDate,
        end: endDate
      },
      category: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'activity',
        display: 'Activity'
      }],
      components,
      device: { uid: deviceUid }
    });
  };

  const totalsToComponents = (label: string, totals?: StravaActivityTotals): NonNullable<CanonicalObservation['components']> => {
    const components: NonNullable<CanonicalObservation['components']> = [];
    if (!totals) return components;

    const count = toNumber(totals.count);
    if (count !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: `${label}-count`, display: `${label} count` },
        valueQuantity: {
          value: count,
          unit: 'count',
          system: 'http://unitsofmeasure.org',
          code: '{count}'
        }
      });
    }

    const distance = toNumber(totals.distance);
    const distanceKm = metersToKm(distance);
    if (distanceKm !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: `${label}-distance`, display: `${label} distance` },
        valueQuantity: {
          value: distanceKm,
          unit: 'km',
          system: 'http://unitsofmeasure.org',
          code: 'km'
        }
      });
    }

    const movingTime = toNumber(totals.moving_time);
    if (movingTime !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: `${label}-moving-time`, display: `${label} moving time` },
        valueQuantity: {
          value: movingTime,
          unit: 's',
          system: 'http://unitsofmeasure.org',
          code: 's'
        }
      });
    }

    const elapsedTime = toNumber(totals.elapsed_time);
    if (elapsedTime !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: `${label}-elapsed-time`, display: `${label} elapsed time` },
        valueQuantity: {
          value: elapsedTime,
          unit: 's',
          system: 'http://unitsofmeasure.org',
          code: 's'
        }
      });
    }

    const elevationGain = toNumber(totals.elevation_gain);
    if (elevationGain !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: `${label}-elevation-gain`, display: `${label} elevation gain` },
        valueQuantity: {
          value: elevationGain,
          unit: 'm',
          system: 'http://unitsofmeasure.org',
          code: 'm'
        }
      });
    }

    const achievements = toNumber(totals.achievement_count);
    if (achievements !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: `${label}-achievements`, display: `${label} achievements` },
        valueQuantity: {
          value: achievements,
          unit: 'count',
          system: 'http://unitsofmeasure.org',
          code: '{count}'
        }
      });
    }

    return components;
  };

  if (data.stats) {
    const components: CanonicalObservation['components'] = [];

    const biggestRide = toNumber(data.stats.biggest_ride_distance);
    const biggestRideKm = metersToKm(biggestRide);
    if (biggestRideKm !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'biggest-ride-distance', display: 'Biggest ride distance' },
        valueQuantity: {
          value: biggestRideKm,
          unit: 'km',
          system: 'http://unitsofmeasure.org',
          code: 'km'
        }
      });
    }

    const biggestClimb = toNumber(data.stats.biggest_climb_elevation_gain);
    if (biggestClimb !== undefined) {
      components.push({
        code: { system: 'urn:hl7-org:local', code: 'biggest-climb-elevation-gain', display: 'Biggest climb elevation gain' },
        valueQuantity: {
          value: biggestClimb,
          unit: 'm',
          system: 'http://unitsofmeasure.org',
          code: 'm'
        }
      });
    }

    const sections: Array<[string, StravaActivityTotals | undefined]> = [
      ['recent-ride', data.stats.recent_ride_totals],
      ['all-ride', data.stats.all_ride_totals],
      ['recent-run', data.stats.recent_run_totals],
      ['all-run', data.stats.all_run_totals],
      ['recent-swim', data.stats.recent_swim_totals],
      ['all-swim', data.stats.all_swim_totals],
      ['ytd-ride', data.stats.ytd_ride_totals],
      ['ytd-run', data.stats.ytd_run_totals],
      ['ytd-swim', data.stats.ytd_swim_totals]
    ];

    for (const [label, totals] of sections) {
      components.push(...totalsToComponents(label, totals));
    }

    if (components.length > 0) {
      observations.push({
        code: { system: 'urn:hl7-org:local', code: 'strava-activity-stats', display: 'Strava activity statistics' },
        status: 'final',
        date: toDateOnly(data.profile?.updated_at || data.profile?.created_at),
        category: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'activity',
          display: 'Activity'
        }],
        components,
        device: { uid: 'strava' }
      });
    }
  }

  if (Array.isArray(data.activities)) {
    for (const activity of data.activities) {
      pushActivityObservation(activity);
    }
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
          title: 'Strava Original Request Data',
          format: 'json'
        }
      }]
    }]
  };
}
