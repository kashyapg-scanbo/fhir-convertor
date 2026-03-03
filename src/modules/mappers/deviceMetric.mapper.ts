import crypto from 'crypto';
import deviceMetricTemplate from '../../shared/templates/deviceMetric.json' with { type: 'json' };
import type { CanonicalDeviceMetric, OperationType } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative } from './utils.js';

interface DeviceMetricMapperArgs {
  deviceMetrics?: CanonicalDeviceMetric[];
  operation?: OperationType;
  registry: FullUrlRegistry;
  resolveRef: (resourceType: string, idOrIdentifier?: string) => string | undefined;
}

export function mapDeviceMetrics({
  deviceMetrics,
  operation,
  registry,
  resolveRef
}: DeviceMetricMapperArgs) {
  if (!deviceMetrics || deviceMetrics.length === 0) {
    return [];
  }

  const entries: any[] = [];
  for (let index = 0; index < deviceMetrics.length; index++) {
    const source = deviceMetrics[index];
    const metric = structuredClone(deviceMetricTemplate) as any;
    const identifierSystem = 'urn:hl7-org:v2';
    const identifierValue = source.id || source.identifier?.[0]?.value;

    metric.id = crypto.randomUUID();
    const fullUrl = `urn:uuid:${metric.id}`;

    metric.identifier = source.identifier?.length
      ? source.identifier.map(mapIdentifier).filter(Boolean)
      : (identifierValue ? [{ system: identifierSystem, value: identifierValue }] : undefined);

    registry.register(
      'DeviceMetric',
      {
        identifier: source.id || source.identifier?.[0]?.value || metric.id,
        id: metric.id
      },
      fullUrl
    );

    metric.type = mapCodeableConcept(source.type);
    metric.unit = mapCodeableConcept(source.unit);
    metric.device = source.device
      ? { reference: resolveRef('Device', source.device) || `Device/${source.device}` }
      : undefined;
    metric.operationalStatus = source.operationalStatus || undefined;
    metric.color = source.color || undefined;
    metric.category = source.category || undefined;
    metric.measurementFrequency = mapQuantity(source.measurementFrequency);
    metric.calibration = source.calibration?.length
      ? source.calibration.map(entry => ({
        type: entry.type || undefined,
        state: entry.state || undefined,
        time: entry.time || undefined
      }))
      : undefined;

    const summary = metric.type?.display || metric.type?.code || metric.identifier?.[0]?.value || metric.id;
    if (summary) metric.text = makeNarrative('DeviceMetric', summary);

    if (operation === 'delete') {
      metric.operationalStatus = 'entered-in-error';
    }

    const entry: any = {
      resource: metric,
      fullUrl
    };

    if (operation === 'create') {
      entry.request = {
        method: 'PUT',
        url: `DeviceMetric?identifier=${identifierSystem}|${identifierValue || metric.id}`
      };
    } else if (operation === 'update' || operation === 'delete') {
      entry.request = {
        method: 'PUT',
        url: `DeviceMetric/${metric.id}`
      };
    }

    entries.push(entry);
  }

  return entries;
}

function mapCodeableConcept(source?: { system?: string; code?: string; display?: string }) {
  if (!source) return undefined;
  return {
    coding: (source.system || source.code || source.display) ? [{
      system: source.system,
      code: source.code,
      display: source.display
    }] : undefined,
    text: source.display || source.code
  };
}

function mapIdentifier(source?: { system?: string; value?: string; type?: { system?: string; code?: string; display?: string } }) {
  if (!source || (!source.system && !source.value && !source.type)) return undefined;
  return {
    system: source.system,
    value: source.value,
    type: source.type ? mapCodeableConcept(source.type) : undefined
  };
}

function mapQuantity(source?: { value?: number; unit?: string; system?: string; code?: string }) {
  if (!source || (source.value === undefined && !source.unit && !source.system && !source.code)) return undefined;
  return {
    value: source.value,
    unit: source.unit,
    system: source.system,
    code: source.code
  };
}
