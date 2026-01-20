import crypto from 'crypto';
import observationTemplate from '../../shared/templates/observation.json' with { type: 'json' };
import type { CanonicalObservation } from '../../shared/types/canonical.types.js';
import { FullUrlRegistry } from './fullUrlRegistry.js';
import { makeNarrative, mapAbnormalFlag } from './utils.js';

interface ObservationMapperArgs {
  observations?: CanonicalObservation[];
  registry: FullUrlRegistry;
  patientFullUrl?: string;
  encounterFullUrl?: string;
}

const vitalSignLoincMap: Record<string, string> = {
  '85353-1': 'Vital signs, weight, height, head circumference, oxygen saturation and BMI panel',
  '9279-1': 'Respiratory rate',
  '8867-4': 'Heart rate',
  '2708-6': 'Oxygen saturation in Arterial blood',
  '8310-5': 'Body temperature',
  '8302-2': 'Body height',
  '9843-4': 'Head Occipital-frontal circumference',
  '29463-7': 'Body weight',
  '39156-5': 'Body mass index (BMI) [Ratio]',
  '85354-9': 'Blood pressure panel with all children optional',
  '8480-6': 'Systolic blood pressure',
  '8462-4': 'Diastolic blood pressure',
  '8478-0': 'Mean blood pressure'
};
const loincVitalSigns = new Set(Object.keys(vitalSignLoincMap));

const vitalSignAliases: Array<{ code: string; match: RegExp }> = [
  { code: '29463-7', match: /\b(body\s*weight|weight|wt)\b/i },
  { code: '8302-2', match: /\b(body\s*height|height|ht)\b/i },
  { code: '9843-4', match: /\b(head\s*circumference|occipital|frontal)\b/i },
  { code: '39156-5', match: /\b(body\s*mass\s*index|bmi)\b/i },
  { code: '8867-4', match: /\b(heart\s*rate|pulse)\b/i },
  { code: '9279-1', match: /\b(resp(iratory)?\s*rate|rr)\b/i },
  { code: '2708-6', match: /\b(oxygen\s*saturation|spo2|o2\s*sat)\b/i },
  { code: '8310-5', match: /\b(temperature|temp)\b/i },
  { code: '8480-6', match: /\b(systolic)\b/i },
  { code: '8462-4', match: /\b(diastolic)\b/i },
  { code: '8478-0', match: /\b(mean\s*blood\s*pressure|map)\b/i },
  { code: '85354-9', match: /\b(blood\s*pressure|bp)\b/i },
  { code: '85353-1', match: /\b(vital\s*signs?)\b/i }
];

const allowedInterpretationCodes = new Set(['L', 'LL', 'H', 'HH', 'A', 'AA', 'N', 'S', 'R', 'I']);
const ucumUnitMap: Record<string, string> = {
  'beats/min': '/min',
  'beat/min': '/min',
  'bpm': '/min',
  'beats per minute': '/min',
  '/min': '/min',
  'percent': '%',
  '%': '%',
  'femtoliter': 'fL',
  'fL': 'fL',
  'grams per deciliter': 'g/dL',
  'g/dl': 'g/dL',
  'g/l-1': 'g/L',
  'g.l-1': 'g/L',
  'grams per milliliter': 'g/mL',
  'g/ml': 'g/mL',
  'picograms per cell': 'pg',
  'pg/cell': 'pg',
  'cells per microliter': '/uL',
  'cells/ul': '/uL',
  'cells per ul': '/uL',
  'million per microliter': '10*6/uL',
  'millions/ul': '10*6/uL',
  'thousand per microliter': '10*3/uL',
  'thousands/ul': '10*3/uL',
  'giga.l-1': '10*9/L',
  'tera.l-1': '10*12/L'
};

const systolicCode = '8480-6';
const diastolicCode = '8462-4';
const bpPanelCode = '85354-9';

function getPrimaryCoding(obs: CanonicalObservation) {
  return Array.isArray(obs.code) ? obs.code[0] : obs.code;
}

function isLoincCode(code?: string) {
  if (!code) return false;
  return /^\d{1,7}-\d{1,2}$/.test(code);
}

function absoluteSystem(system?: string) {
  if (!system) return undefined;
  return /^(https?:\/\/|urn:)/i.test(system) ? system : undefined;
}

function normalizeSystem(system?: string) {
  if (!system) return undefined;
  if (system.startsWith('urn:oid:2.16.840.1.113883.6.1')) return 'http://loinc.org';
  if (system.startsWith('urn:oid:2.16.840.1.113883.6.96')) return 'http://snomed.info/sct';
  if (/^https?:\/\//i.test(system) || /^urn:/i.test(system)) return system;
  const upper = system.toUpperCase();
  if (upper === 'LN' || system.toLowerCase().includes('loinc')) return 'http://loinc.org';
  if (upper === 'L' || upper === 'LOCAL') return 'urn:hl7-org:local';
  return undefined;
}

function hasLoincCode(coding: any[] | undefined, code: string) {
  if (!Array.isArray(coding)) return false;
  return coding.some(c => normalizeSystem(c.system) === 'http://loinc.org' && c.code === code);
}

function inferVitalSignCode(primaryCode?: { code?: string; display?: string }) {
  const code = String(primaryCode?.code || '');
  if (loincVitalSigns.has(code)) return code;
  const text = `${primaryCode?.code || ''} ${primaryCode?.display || ''}`.trim();
  if (!text) return undefined;
  for (const alias of vitalSignAliases) {
    if (alias.match.test(text)) return alias.code;
  }
  return undefined;
}

function applyVitalSignCoding(resource: any, primaryCode?: { code?: string; display?: string }) {
  if (!resource?.code?.coding) return;
  const inferred = inferVitalSignCode(primaryCode);
  if (inferred && !hasLoincCode(resource.code.coding, inferred)) {
    resource.code.coding.unshift({
      system: 'http://loinc.org',
      code: inferred,
      display: vitalSignLoincMap[inferred]
    });
  }
  resource.code.coding = resource.code.coding.map((c: any) => {
    const system = normalizeSystem(c.system);
    if (system === 'http://loinc.org' && !c.display && vitalSignLoincMap[c.code]) {
      return { ...c, display: vitalSignLoincMap[c.code] };
    }
    return c;
  });
}

function ensureVitalSignsCategory(resource: any, primaryCoding: any) {
  if (!primaryCoding) return;
  
  const sys = String(primaryCoding.system || '').toLowerCase();
  const code = String(primaryCoding.code || '');
  const isLoinc = sys.includes('loinc') || sys.includes('urn:oid:2.16.840.1.113883.6.1');
  
  // Exclude HRV (80404-7) from vital-signs category to avoid heartrate profile validation
  // HRV uses 'ms' unit and should not use the heartrate profile which requires '/min'
  if (code === '80404-7') return;
  
  // Check if it's a vital sign using vitalSignLoincMap
  const isVitalSign = isLoinc && loincVitalSigns.has(code);
  
  // Also check by display text for non-LOINC codes (but exclude HRV-related terms)
  const displayText = String(primaryCoding.display || '');
  const matchesVitalSignPattern = /heart|pulse|temperature|respiratory|blood pressure|bp|oxygen/i.test(displayText) &&
    !/heart.*variability|hrv|r-r interval/i.test(displayText); // Exclude HRV-related terms
  
  if (isVitalSign || matchesVitalSignPattern) {
    // Check if vital-signs category already exists
    const hasVitalSignsCategory = resource.category?.some((cat: any) =>
      cat.coding?.some((c: any) => c.code === 'vital-signs' && 
        c.system === 'http://terminology.hl7.org/CodeSystem/observation-category')
    );
    
    if (!hasVitalSignsCategory) {
      if (!resource.category) resource.category = [];
      resource.category.push({
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs'
        }]
      });
    }
  }
}

function resolveUnitCode(unit?: string, unitCode?: string) {
  const key = (unitCode || unit || '').toLowerCase();
  if (!key) return undefined;
  return ucumUnitMap[key] || unitCode || unit;
}

function buildQuantity(value: string | number, unit?: string, unitCode?: string) {
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
  const code = resolveUnitCode(unit, unitCode);
  return {
    value: num,
    unit: unit || undefined,
    system: code ? 'http://unitsofmeasure.org' : undefined,
    code
  };
}

export function mapObservations({
  observations,
  registry,
  patientFullUrl,
  encounterFullUrl
}: ObservationMapperArgs) {
  if (!observations || observations.length === 0) {
    return [];
  }

  const usedObservations = new Set<CanonicalObservation>();
  const bpGroups = new Map<string, { systolic?: CanonicalObservation; diastolic?: CanonicalObservation }>();

  observations.forEach(obs => {
    const coding = getPrimaryCoding(obs);
    const code = coding?.code;
    if (code !== systolicCode && code !== diastolicCode) return;
    const key = obs.date || 'unknown-date';
    const group = bpGroups.get(key) || {};
    if (code === systolicCode) group.systolic = obs;
    if (code === diastolicCode) group.diastolic = obs;
    bpGroups.set(key, group);
  });

  const entries: any[] = [];
  bpGroups.forEach(group => {
    if (!group.systolic || !group.diastolic) return;
    const bpResource = structuredClone(observationTemplate) as any;
    bpResource.id = crypto.randomUUID();
    bpResource.status = group.systolic.status || group.diastolic.status || 'final';
    bpResource.subject = patientFullUrl ? { reference: patientFullUrl } : undefined;
    bpResource.encounter = encounterFullUrl ? { reference: encounterFullUrl } : undefined;
    bpResource.effectiveDateTime = group.systolic.date || group.diastolic.date || new Date().toISOString();
    bpResource.category = [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/observation-category',
        code: 'vital-signs',
        display: 'Vital Signs'
      }]
    }];
    bpResource.code = {
      coding: [{
        system: 'http://loinc.org',
        code: bpPanelCode,
        display: 'Blood pressure panel with all children optional'
      }]
    };

    const systolicValue = Array.isArray(group.systolic.value)
      ? group.systolic.value[0]
      : group.systolic.value;
    const diastolicValue = Array.isArray(group.diastolic.value)
      ? group.diastolic.value[0]
      : group.diastolic.value;

    bpResource.component = [
      {
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: systolicCode,
            display: 'Systolic blood pressure'
          }]
        },
        valueQuantity: buildQuantity(systolicValue as string | number, group.systolic.unit, group.systolic.unitCode)
      },
      {
        code: {
          coding: [{
            system: 'http://loinc.org',
            code: diastolicCode,
            display: 'Diastolic blood pressure'
          }]
        },
        valueQuantity: buildQuantity(diastolicValue as string | number, group.diastolic.unit, group.diastolic.unitCode)
      }
    ];

    const bpFullUrl = `urn:uuid:${bpResource.id}`;
    registry.register(
      'Observation',
      {
        identifier: String(group.systolic.setId ?? bpResource.id),
        id: bpResource.id
      },
      bpFullUrl
    );

    bpResource.identifier = undefined;
    bpResource.instantiatesCanonical = undefined;
    bpResource.instantiatesReference = undefined;
    bpResource.basedOn = undefined;
    bpResource.triggeredBy = undefined;
    bpResource.partOf = undefined;
    bpResource.focus = undefined;
    bpResource.effectivePeriod = undefined;
    bpResource.effectiveTiming = undefined;
    bpResource.effectiveInstant = undefined;
    bpResource.issued = undefined;
    bpResource.performer = undefined;
    bpResource.valueQuantity = undefined;
    bpResource.valueCodeableConcept = undefined;
    bpResource.valueString = undefined;
    bpResource.valueBoolean = undefined;
    bpResource.valueInteger = undefined;
    bpResource.valueRange = undefined;
    bpResource.valueRatio = undefined;
    bpResource.valueSampledData = undefined;
    bpResource.valueTime = undefined;
    bpResource.valueDateTime = undefined;
    bpResource.valuePeriod = undefined;
    bpResource.valueAttachment = undefined;
    bpResource.valueReference = undefined;
    bpResource.dataAbsentReason = undefined;
    bpResource.interpretation = undefined;
    bpResource.note = undefined;
    bpResource.bodySite = undefined;
    bpResource.bodyStructure = undefined;
    bpResource.method = undefined;
    bpResource.specimen = undefined;
    bpResource.device = undefined;
    bpResource.referenceRange = undefined;
    bpResource.hasMember = undefined;
    bpResource.derivedFrom = undefined;

    entries.push({ resource: bpResource, fullUrl: bpFullUrl });
    usedObservations.add(group.systolic);
    usedObservations.add(group.diastolic);
  });

  for (let index = 0; index < observations.length; index++) {
    const obs = observations[index];
    if (usedObservations.has(obs)) {
      continue;
    }
    const resource = structuredClone(observationTemplate) as any;

    resource.id = crypto.randomUUID();
    resource.category = undefined;
    resource.component = undefined;
    if (obs.setId) {
      resource.identifier = [{ system: 'urn:hl7-org:v2', value: String(obs.setId) }];
    } else {
      resource.identifier = undefined;
    }

      resource.subject = patientFullUrl ? { reference: patientFullUrl } : undefined;
    if (encounterFullUrl) {
      resource.encounter = { reference: encounterFullUrl };
    } else {
      resource.encounter = undefined;
    }

    const primaryCode = getPrimaryCoding(obs);
    const isVitalSign = Boolean(primaryCode?.code && loincVitalSigns.has(primaryCode.code));
    const obsSummary = primaryCode?.code || primaryCode?.display || '';
    if (obsSummary) resource.text = makeNarrative('Observation', String(obsSummary));

    resource.status = obs.status || 'final';
    resource.effectiveDateTime = obs.date || new Date().toISOString();

  if (obs.code) {
      const codes = Array.isArray(obs.code) ? obs.code : [obs.code];
      resource.code = {
        coding: codes.map((coding: any) => {
          const normalizedSystem = normalizeSystem(coding.system);
          const fallbackSystem = coding.system
            ? undefined
            : (isLoincCode(coding.code) ? 'http://loinc.org' : 'urn:hl7-org:local');
          const result: any = {
            system: normalizedSystem ?? fallbackSystem,
            code: coding.code || ''
          };
          if (coding.display && (!result.system || !result.system.includes('loinc'))) {
            result.display = coding.display;
          }
          return result;
        })
      };
    } else {
      resource.code = undefined;
    }

    applyVitalSignCoding(resource, primaryCode);

    if (obs.value !== undefined) {
      // Check for invalid UCUM units that should use different value types
      const unitCode = (obs.unitCode || obs.unit || '').toLowerCase();
      const isInvalidUcum = unitCode === '{count}' || unitCode === '{score}' || unitCode === '{boolean}';
      
      if (Array.isArray(obs.value)) {
        const firstValue = obs.value.find(v => v !== undefined && v !== null);
        if (firstValue !== undefined) {
          if (isInvalidUcum) {
            // Use appropriate value type for invalid UCUM units
            if (unitCode === '{boolean}') {
              resource.valueBoolean = Boolean(Number(firstValue));
            } else {
              // For {count} and {score}, use valueInteger
              const intValue = Math.round(Number(firstValue));
              if (!isNaN(intValue)) {
                resource.valueInteger = intValue;
              } else {
                resource.valueString = String(firstValue);
              }
            }
          } else {
            const quantity = buildQuantity(firstValue, obs.unit, obs.unitCode);
            if (quantity) {
              resource.valueQuantity = quantity;
            } else if (!isVitalSign) {
              resource.valueString = String(firstValue);
            }
          }
        }
        if (obs.value.length > 1) {
          if (!resource.note) resource.note = [];
          resource.note.push({
            text: `Additional values: ${obs.value.slice(1).join(', ')}`
          });
        }
      } else if (obs.valueType === 'CWE') {
        resource.valueCodeableConcept = {
          coding: [{
            system: normalizeSystem(obs.unitSystem),
            code: String(obs.value),
            display: obs.unit
          }]
        };
      } else {
        const valueType = obs.valueType || 'NM';
        if (isInvalidUcum) {
          // Use appropriate value type for invalid UCUM units
          if (unitCode === '{boolean}') {
            resource.valueBoolean = Boolean(Number(obs.value));
          } else {
            // For {count} and {score}, use valueInteger
            const intValue = Math.round(Number(obs.value));
            if (!isNaN(intValue)) {
              resource.valueInteger = intValue;
            } else {
              resource.valueString = String(obs.value);
            }
          }
        } else if (valueType === 'NM' || valueType === 'SN' || !isNaN(Number(obs.value))) {
          const quantity = buildQuantity(obs.value as string | number, obs.unit, obs.unitCode);
          if (quantity) {
            resource.valueQuantity = quantity;
          } else if (!isVitalSign) {
            resource.valueString = String(obs.value);
          }
        } else {
          if (!isVitalSign) {
            resource.valueString = String(obs.value);
          }
        }
      }
    }

    if (resource.valueQuantity && primaryCode?.code === '8867-4') {
      resource.valueQuantity.unit = 'beats/min';
      resource.valueQuantity.code = '/min';
      resource.valueQuantity.system = 'http://unitsofmeasure.org';
    }

    if (obs.referenceRange) {
      resource.referenceRange = [{
        text: obs.referenceRange
      }];
    }

    if (!resource.interpretation) resource.interpretation = [];
    const interpretationSet = new Set<string>();

    if (obs.abnormalFlags && obs.abnormalFlags.length > 0) {
      obs.abnormalFlags.forEach((flag: string) => {
        if (!flag || interpretationSet.has(flag)) return;
        const upper = flag.toUpperCase();
        if (!allowedInterpretationCodes.has(upper)) return;
        interpretationSet.add(upper);
        resource.interpretation.push({
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: upper,
            display: mapAbnormalFlag(upper)
          }]
        });
      });
    }

    if (obs.interpretation && obs.interpretation.length > 0) {
      obs.interpretation.forEach((interp: string) => {
        if (!interp || interpretationSet.has(interp)) return;
        const upper = interp.toUpperCase();
        if (!allowedInterpretationCodes.has(upper)) return;
        interpretationSet.add(upper);
        resource.interpretation.push({
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
            code: upper,
            display: mapAbnormalFlag(upper)
          }]
        });
      });
    }

    if (obs.method) {
      resource.method = {
        coding: [{
          code: obs.method.code || '',
          display: obs.method.description || ''
        }]
      };
    }

    if (obs.observer && obs.observer.length > 0) {
      const performers = obs.observer
        .map((observer: any) => ({
          display: observer.name || (observer.id ? `ID: ${observer.id}` : undefined),
          identifier: observer.id ? {
            value: observer.id,
            system: 'urn:hl7-org:v2'
          } : undefined
        }))
        .filter((p: any) => p.display || p.identifier);
      if (performers.length > 0) {
        resource.performer = performers;
      }
    }

    if (obs.device) {
      const identifiers = [];
      if (obs.device.uid) {
        identifiers.push({
          system: 'urn:ietf:rfc:4122',
          value: obs.device.uid
        });
      }
      if (obs.device.oid) {
        identifiers.push({
          system: `urn:oid:${obs.device.oid}`,
          value: obs.device.oid
        });
      }
      if (identifiers.length > 0) {
        resource.device = { identifier: identifiers[0] };
      }
    }

    if (obs.site) {
      resource.bodySite = {
        coding: [{
          code: obs.site.code || '',
          display: obs.site.display || ''
        }]
      };
    }

    if (obs.performerOrganization) {
      if (!resource.performer) resource.performer = [];
      const orgPerformer: any = {
        display: obs.performerOrganization.name || undefined
      };
      if (obs.performerOrganization.name) {
        orgPerformer.identifier = {
          system: 'urn:hl7-org:v2',
          value: obs.performerOrganization.name
        };
      }
      if (orgPerformer.display || orgPerformer.identifier) {
        resource.performer.push(orgPerformer);
      }

      if (obs.performerOrganization.address) {
        if (!resource.note) resource.note = [];
        resource.note.push({
          text: `Organization Address: ${[
            obs.performerOrganization.address.city,
            obs.performerOrganization.address.state,
            obs.performerOrganization.address.postalCode,
            obs.performerOrganization.address.country
          ].filter(Boolean).join(', ')}`
        });
      }
    }

    if (obs.producer) {
      if (!resource.note) resource.note = [];
      resource.note.push({
        text: `Producer: ${obs.producer.organizationId || ''} (${obs.producer.system || ''})`
      });
    }

    const primaryCoding = Array.isArray(resource.code?.coding) ? resource.code.coding[0] : null;
    
    // For HRV (80404-7), preserve the 'exam' category and prevent heartrate profile
    // HRV uses 'ms' unit and must not use the heartrate profile which requires '/min'
    const isHRV = primaryCoding && primaryCoding.code === '80404-7' && primaryCoding.system?.includes('loinc');
    
    if (obs.category) {
      const categories = obs.category
        .map((cat: any) => {
          if (!cat.code) return null;
          return {
            coding: [{
              system: absoluteSystem(cat.system),
              code: cat.code,
              display: cat.display
            }]
          };
        })
        .filter(Boolean);
      if (categories.length > 0) resource.category = categories;
    }
    
    // Ensure vital-signs category is present for all vital sign observations
    // This handles heart rate (8867-4) and all other vital signs from vitalSignLoincMap
    // But skip for HRV to preserve its 'exam' category
    if (!isHRV) {
      ensureVitalSignsCategory(resource, primaryCoding);
    }
    
    // Explicitly prevent heartrate profile from being applied to HRV (80404-7)
    if (isHRV) {
      // Set meta.profile to base Observation profile to prevent auto-detection of heartrate profile
      if (!resource.meta) resource.meta = {};
      resource.meta.profile = ['http://hl7.org/fhir/StructureDefinition/Observation'];
    }

    if (obs.components) {
      resource.component = obs.components
        .map((c: any) => {
          if (!c.code?.code) return null;
          return {
            code: {
              coding: [{
                system: absoluteSystem(c.code.system),
                code: c.code.code,
                display: c.code.display
              }]
            },
            valueCodeableConcept: c.valueCodeableConcept
              ? { coding: [c.valueCodeableConcept] }
              : undefined
          };
        })
        .filter(Boolean);
    }

    const obsFullUrl = `urn:uuid:${resource.id}`;
    registry.register(
      'Observation',
      {
        identifier: String(obs.setId ?? resource.id),
        id: resource.id
      },
      obsFullUrl
    );

    resource.instantiatesCanonical = undefined;
    resource.instantiatesReference = undefined;
    resource.basedOn = undefined;
    resource.triggeredBy = undefined;
    resource.partOf = undefined;
    resource.focus = undefined;
    resource.effectivePeriod = undefined;
    resource.effectiveTiming = undefined;
    resource.effectiveInstant = undefined;
    resource.issued = undefined;
    resource.dataAbsentReason = undefined;
    resource.bodyStructure = undefined;
    resource.specimen = undefined;
    resource.hasMember = undefined;
    resource.derivedFrom = undefined;
    if (!resource.note?.length) resource.note = undefined;
    if (!resource.interpretation?.length) resource.interpretation = undefined;
    if (!resource.category?.length) resource.category = undefined;
    if (!resource.referenceRange?.length) resource.referenceRange = undefined;
    if (!resource.performer?.length) resource.performer = undefined;
    if (!resource.component?.length) resource.component = undefined;

    if (!resource.valueQuantity) resource.valueQuantity = undefined;
    if (!resource.valueCodeableConcept) resource.valueCodeableConcept = undefined;
    if (!resource.valueString) resource.valueString = undefined;
    resource.valueBoolean = undefined;
    resource.valueInteger = undefined;
    resource.valueRange = undefined;
    resource.valueRatio = undefined;
    resource.valueSampledData = undefined;
    resource.valueTime = undefined;
    resource.valueDateTime = undefined;
    resource.valuePeriod = undefined;
    resource.valueAttachment = undefined;
    resource.valueReference = undefined;

    if (!resource.component?.length
      && !resource.valueQuantity
      && !resource.valueCodeableConcept
      && !resource.valueString) {
      resource.dataAbsentReason = {
        coding: [{
          system: 'http://terminology.hl7.org/CodeSystem/data-absent-reason',
          code: 'unknown',
          display: 'Unknown'
        }]
      };
    }

    entries.push({ resource, fullUrl: obsFullUrl });
  }

  return entries;
}
