# WHOOP Device Integration Documentation

## Overview

The WHOOP device integration converts WHOOP API 4.0 JSON data into FHIR R5 compliant observations. This document explains the data structure, observation grouping strategy, and why certain observations are kept separate.

## Data Structure

WHOOP API provides the following data sections:

1. **Profile**: User identification and demographics
2. **Recovery**: Daily recovery metrics (HRV, resting heart rate, SpO2, temperature, recovery score)
3. **Cycle**: 24-hour strain/workout data (strain score, calories, heart rate metrics)
4. **Sleep**: Sleep analysis with detailed stage breakdown
5. **Body**: Physical measurements (height, weight, BMI, max heart rate)
6. **Workout**: Individual workout sessions (optional, can be array)

## Observation Grouping Strategy

### Grouped Observations (Using Components)

#### 1. Recovery Observation
**Why grouped?** All recovery metrics are measured at the same time (typically upon waking) and represent a single "recovery assessment" event.

**Structure:**
- Single Observation with code `whoop-recovery-summary`
- Components include:
  - Recovery Score (integer)
  - Resting Heart Rate (quantity)
  - HRV RMSSD (quantity)
  - SpO2 (quantity)
  - Body Temperature (quantity)
  - Device Calibration Status (boolean)

**Benefits:**
- Represents a single clinical event (recovery assessment)
- Easier to query all recovery metrics together
- Reduces number of observation resources
- Maintains temporal relationship between metrics

#### 2. Sleep Observation
**Why grouped?** All sleep metrics are measured during a single sleep period and represent a complete sleep analysis.

**Structure:**
- Single Observation with code `93832-4` (Sleep duration)
- Uses `effectivePeriod` with start and end times (not just a single timestamp)
- Components include:
  - Total Sleep Time
  - Sleep Efficiency, Performance, Consistency
  - Sleep Stages (Deep, REM, Light, Awake)
  - Respiratory Rate
  - Sleep Cycles, Disturbances, Data Gaps
  - Sleep Need metrics (Baseline, Debt, Strain, Nap)
  - Nap Indicator

**Benefits:**
- Represents a single sleep episode
- `effectivePeriod` accurately captures sleep duration
- All sleep-related metrics are logically grouped
- Easier to analyze complete sleep patterns

### Separate Observations

#### 1. Heart Rate Observations (Multiple Separate Observations)

**Why separate?** Heart rate is measured in different contexts with different meanings:

- **Resting Heart Rate** (in Recovery): Baseline heart rate during rest
- **Average Heart Rate** (in Cycle): Average during the 24-hour cycle
- **Max Heart Rate** (in Cycle): Peak heart rate during the cycle
- **Max Heart Rate** (in Body): User's theoretical maximum heart rate (age-based)

**Each has:**
- Different temporal context (different times/dates)
- Different clinical meaning
- Different LOINC code usage (all use `8867-4` but with different contexts)

**FHIR Best Practice:** When the same measurement type (heart rate) occurs at different times or in different contexts, they should be separate observations. This allows:
- Independent querying by time period
- Different effectiveDateTime values
- Clear distinction between contexts (resting vs. active vs. theoretical max)

#### 2. Cycle Metrics (Strain, Calories, Heart Rates)

**Why separate?** These represent different types of measurements:

- **Strain Score**: A calculated score (not a direct measurement)
- **Calories**: Energy expenditure measurement
- **Average Heart Rate**: Vital sign measurement
- **Max Heart Rate**: Vital sign measurement

**Each has:**
- Different units and value types
- Different categories (activity vs. vital-signs)
- Different clinical interpretations

#### 3. Body Measurements

**Why separate?** Physical measurements are typically recorded independently:

- **Height**: Static measurement (rarely changes)
- **Weight**: Can change over time
- **BMI**: Calculated from height and weight
- **Max Heart Rate**: Theoretical value (age-based)

**Each has:**
- Different update frequencies
- Different clinical purposes
- Different LOINC codes
- May be recorded at different times

## Code System Usage

### LOINC Codes (Standard Medical Codes)
Used for standard medical measurements:
- `8867-4`: Heart rate
- `80404-7`: HRV (R-R interval standard deviation)
- `2708-6`: Oxygen saturation
- `8310-5`: Body temperature
- `9279-1`: Respiratory rate
- `93832-4`: Sleep duration
- `8302-2`: Body height
- `29463-7`: Body weight
- `39156-5`: BMI
- `41981-2`: Calories burned
- `93831-6`: Physical activity strain score

### Local Codes (`urn:hl7-org:local`)
Used for device-specific metrics without standard LOINC codes:
- `whoop-recovery-summary`: Recovery summary observation
- `whoop-recovery-score`: Recovery score component
- `whoop-device-calibrating`: Device calibration status
- `whoop-sleep-efficiency`: Sleep efficiency
- `whoop-sleep-performance`: Sleep performance
- `whoop-sleep-consistency`: Sleep consistency
- `whoop-slow-wave-sleep`: Deep sleep duration
- `whoop-rem-sleep`: REM sleep duration
- `whoop-light-sleep`: Light sleep duration
- `whoop-awake-time`: Awake time during sleep
- `whoop-sleep-cycle-count`: Number of sleep cycles
- `whoop-sleep-disturbance-count`: Number of disturbances
- `whoop-sleep-data-gap`: Data gap duration
- `whoop-baseline-sleep-need`: Baseline sleep need
- `whoop-sleep-need-debt`: Sleep need from debt
- `whoop-sleep-need-strain`: Sleep need from strain
- `whoop-sleep-need-nap`: Sleep need from nap
- `whoop-nap-indicator`: Whether sleep was a nap

## Time-Series Data Support

For real-time heart rate data (when available), the integration supports `valueSampledData`:

```json
{
  "valueSampledData": {
    "origin": { "value": 72, "unit": "beats/min" },
    "period": 1,
    "dimensions": 1,
    "data": "72 73 74 75 76 74 73 72"
  }
}
```

This allows efficient storage of high-frequency measurements (e.g., heart rate every second) without creating one observation per measurement.

## Example Output Structure

```
Bundle
├── Patient (1)
├── Observation: Recovery Summary (1, with 6 components)
├── Observation: Strain Score (1)
├── Observation: Calories (1)
├── Observation: Average Heart Rate (1)
├── Observation: Max Heart Rate (1)
├── Observation: Sleep Summary (1, with 16 components, effectivePeriod)
├── Observation: Height (1)
├── Observation: Weight (1)
├── Observation: BMI (1)
├── Observation: Max Heart Rate - Body (1)
└── DocumentReference: Original Data (1)
```

**Total: 12 resources** (vs. 25+ if all metrics were separate observations)

## Benefits of This Approach

1. **Semantic Correctness**: Grouped observations represent single clinical events
2. **Query Efficiency**: Easier to retrieve related metrics together
3. **Temporal Accuracy**: `effectivePeriod` for sleep captures duration correctly
4. **FHIR Compliance**: Follows FHIR best practices for observation grouping
5. **Reduced Resource Count**: Fewer resources to manage and store
6. **Context Preservation**: Related metrics maintain their relationship

## When to Use Components vs. Separate Observations

**Use Components when:**
- Metrics are measured at the same time
- Metrics represent a single clinical event
- Metrics are logically related (e.g., all recovery metrics)
- You want to query them together

**Use Separate Observations when:**
- Metrics are measured at different times
- Metrics have different temporal contexts
- Metrics have different clinical meanings
- You need to query them independently by time

## References

- [FHIR R5 Observation Resource](http://hl7.org/fhir/R5/observation.html)
- [FHIR Observation Components](http://hl7.org/fhir/R5/observation-definitions.html#Observation.component)
- [FHIR effectivePeriod](http://hl7.org/fhir/R5/observation-definitions.html#Observation.effectivePeriod)
- [LOINC Code System](https://loinc.org/)

