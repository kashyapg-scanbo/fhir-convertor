/**
 * Canonical Model Types
 * FHIR-agnostic, deterministic structure used across all parsers
 */

export type CanonicalPatient = {
  id?: string;
  identifier?: string;
  name: {
    family?: string;
    given?: string[];
  };
  gender?: string;
  birthDate?: string;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    use?: string;
  }>;
  telecom?: Array<{
    system: 'phone' | 'email' | 'fax' | 'url' | 'other';
    value: string;
    use?: string;
  }>;
  active?: boolean; // For delete operations (set to false)
};

export type CanonicalEncounter = {
  class?: string;
  id?: string;
  start?: string;
  location?: string;
  status?: string;
  participantPractitionerIds?: string[];
  serviceProviderOrganizationId?: string;
};

export type CanonicalEncounterHistory = {
  id?: string;
  encounter?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  status?: string;
  class?: {
    system?: string;
    code?: string;
    display?: string;
  };
  type?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  serviceType?: Array<{
    concept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reference?: string;
  }>;
  subject?: string;
  subjectStatus?: {
    system?: string;
    code?: string;
    display?: string;
  };
  actualPeriod?: {
    start?: string;
    end?: string;
  };
  plannedStartDate?: string;
  plannedEndDate?: string;
  length?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  location?: Array<{
    location?: string;
    form?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
};

export type CanonicalFlag = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  status?: string;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  subject?: string;
  period?: {
    start?: string;
    end?: string;
  };
  encounter?: string;
  author?: string;
};

export type CanonicalList = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  status?: string;
  mode?: string;
  title?: string;
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  subject?: string[];
  encounter?: string;
  date?: string;
  source?: string;
  orderedBy?: {
    system?: string;
    code?: string;
    display?: string;
  };
  note?: string[];
  entry?: Array<{
    flag?: {
      system?: string;
      code?: string;
      display?: string;
    };
    deleted?: boolean;
    date?: string;
    item?: string;
  }>;
  emptyReason?: {
    system?: string;
    code?: string;
    display?: string;
  };
};

export type CanonicalGroup = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  active?: boolean;
  type?: string;
  membership?: string;
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  name?: string;
  description?: string;
  quantity?: number;
  managingEntity?: string;
  characteristic?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    valueCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    valueBoolean?: boolean;
    valueQuantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    valueRange?: {
      low?: { value?: number; unit?: string };
      high?: { value?: number; unit?: string };
    };
    valueReference?: string;
    exclude?: boolean;
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  member?: Array<{
    entity?: string;
    period?: {
      start?: string;
      end?: string;
    };
    inactive?: boolean;
  }>;
};

export type CanonicalHealthcareService = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  active?: boolean;
  providedBy?: string;
  offeredIn?: string[];
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  type?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  specialty?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  location?: string[];
  name?: string;
  comment?: string;
  extraDetails?: string;
  photo?: {
    contentType?: string;
    url?: string;
    title?: string;
    data?: string;
  };
  contact?: Array<{
    name?: string;
    telecom?: Array<{
      system?: string;
      value?: string;
      use?: string;
    }>;
  }>;
  coverageArea?: string[];
  serviceProvisionCode?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  eligibility?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    comment?: string;
  }>;
  program?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  characteristic?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  communication?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  referralMethod?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  appointmentRequired?: boolean;
  availability?: Array<{
    daysOfWeek?: string[];
    availableStartTime?: string;
    availableEndTime?: string;
    allDay?: boolean;
    available?: boolean;
  }>;
  endpoint?: string[];
};

export type CanonicalNutritionIntake = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: string[];
  partOf?: string[];
  status?: string;
  statusReason?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  subject?: string;
  encounter?: string;
  occurrenceDateTime?: string;
  occurrencePeriod?: {
    start?: string;
    end?: string;
  };
  recorded?: string;
  reportedBoolean?: boolean;
  reportedReference?: string;
  consumedItem?: Array<{
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    nutritionProductCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    nutritionProductReference?: string;
    schedule?: string;
    amount?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    rate?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    notConsumed?: boolean;
    notConsumedReason?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  ingredientLabel?: Array<{
    nutrientCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    nutrientReference?: string;
    amount?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
  }>;
  performer?: Array<{
    function?: {
      system?: string;
      code?: string;
      display?: string;
    };
    actor?: string;
  }>;
  location?: string;
  derivedFrom?: string[];
  reason?: string[];
  note?: string[];
};

export type CanonicalNutritionOrder = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  instantiates?: string[];
  basedOn?: string[];
  groupIdentifier?: {
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  };
  status?: string;
  intent?: string;
  priority?: string;
  subject?: string;
  encounter?: string;
  supportingInformation?: string[];
  dateTime?: string;
  orderer?: string;
  performer?: Array<{
    concept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reference?: string;
  }>;
  allergyIntolerance?: string[];
  foodPreferenceModifier?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  excludeFoodModifier?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  outsideFoodAllowed?: boolean;
  oralDiet?: {
    type?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    scheduleTiming?: string;
    asNeeded?: boolean;
    asNeededFor?: {
      system?: string;
      code?: string;
      display?: string;
    };
    nutrient?: Array<{
      modifier?: {
        system?: string;
        code?: string;
        display?: string;
      };
      amount?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
    }>;
    texture?: Array<{
      modifier?: {
        system?: string;
        code?: string;
        display?: string;
      };
      foodType?: {
        system?: string;
        code?: string;
        display?: string;
      };
    }>;
    fluidConsistencyType?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    instruction?: string;
  };
  supplement?: Array<{
    typeCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    typeReference?: string;
    productName?: string;
    scheduleTiming?: string;
    asNeeded?: boolean;
    asNeededFor?: {
      system?: string;
      code?: string;
      display?: string;
    };
    quantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    instruction?: string;
  }>;
  enteralFormula?: {
    baseFormulaTypeCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    baseFormulaTypeReference?: string;
    baseFormulaProductName?: string;
    deliveryDevice?: string[];
    additive?: Array<{
      typeCodeableConcept?: {
        system?: string;
        code?: string;
        display?: string;
      };
      typeReference?: string;
      productName?: string;
      quantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
    }>;
    caloricDensity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    routeOfAdministration?: {
      system?: string;
      code?: string;
      display?: string;
    };
    administration?: Array<{
      scheduleTiming?: string;
      asNeeded?: boolean;
      asNeededFor?: {
        system?: string;
        code?: string;
        display?: string;
      };
      quantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
      rateQuantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
      rateRatio?: string;
    }>;
    maxVolumeToDeliver?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    administrationInstruction?: string;
  };
  note?: string[];
};

export type CanonicalRiskAssessment = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  basedOn?: string;
  parent?: string;
  status?: string;
  method?: {
    system?: string;
    code?: string;
    display?: string;
  };
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  subject?: string;
  encounter?: string;
  occurrenceDateTime?: string;
  occurrencePeriod?: {
    start?: string;
    end?: string;
  };
  condition?: string;
  performer?: string;
  reason?: string[];
  basis?: string[];
  prediction?: Array<{
    outcome?: {
      system?: string;
      code?: string;
      display?: string;
    };
    probabilityDecimal?: number;
    probabilityRange?: {
      low?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
      high?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
    };
    qualitativeRisk?: {
      system?: string;
      code?: string;
      display?: string;
    };
    relativeRisk?: number;
    whenPeriod?: {
      start?: string;
      end?: string;
    };
    whenRange?: {
      low?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
      high?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
    };
    rationale?: string;
  }>;
  mitigation?: string;
  note?: string[];
};

export type CanonicalObservation = {
  setId?: string;
  valueType?: string;
  code: {
    system?: string;
    code?: string;
    display?: string;
  } | Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  value?: string | number | Array<string | number>;
  valueSampledData?: {
    origin: {
      value: number;
      unit: string;
    };
    period: number;
    dimensions: number;
    data: string;
  };
  unit?: string;
  unitSystem?: string;
  unitCode?: string;
  referenceRange?: string;
  abnormalFlags?: string[];
  status?: string;
  date?: string;
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  producer?: {
    organizationId?: string;
    system?: string;
  };
  observer?: Array<{
    id?: string;
    name?: string;
    qualification?: string;
  }>;
  method?: {
    code?: string;
    description?: string;
  };
  device?: {
    uid?: string;
    oid?: string;
  };
  site?: {
    code?: string;
    display?: string;
  };
  performerOrganization?: {
    name?: string;
    address?: {
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
  };
  interpretation?: string[];
  category?: Array<{
    system: string;
    code: string;
    display: string;
  }>;
  components?: Array<{
    code: {
      system: string;
      code: string;
      display: string;
    };
    valueQuantity?: {
      value: number;
      unit: string;
      system?: string;
      code?: string;
    };
    valueInteger?: number;
    valueString?: string;
    valueBoolean?: boolean;
    valueCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    valueSampledData?: {
      origin: {
        value: number;
        unit: string;
      };
      period: number;
      dimensions: number;
      data: string;
    };
  }>;
};

export type CanonicalAllergy = {
  substance?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  reaction?: Array<{
    manifestation?: Array<{
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    }>;
    severity?: string;
  }>;
};

export type CanonicalAllergyIntolerance = {
  id?: string;
  identifier?: string;
  clinicalStatus?: {
    system?: string;
    code?: string;
    display?: string;
  };
  verificationStatus?: {
    system?: string;
    code?: string;
    display?: string;
  };
  type?: {
    system?: string;
    code?: string;
    display?: string;
  };
  category?: string[];
  criticality?: string;
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  patient?: string;
  encounter?: string;
  onsetDateTime?: string;
  onsetPeriod?: {
    start?: string;
    end?: string;
  };
  onsetString?: string;
  recordedDate?: string;
  participant?: Array<{
    function?: {
      system?: string;
      code?: string;
      display?: string;
    };
    actor?: string;
  }>;
  lastOccurrence?: string;
  note?: string[];
  reaction?: Array<{
    substance?: {
      system?: string;
      code?: string;
      display?: string;
    };
    manifestation?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    description?: string;
    onset?: string;
    severity?: string;
    exposureRoute?: {
      system?: string;
      code?: string;
      display?: string;
    };
    note?: string[];
  }>;
  active?: boolean;
};

export type CanonicalDiagnosis = {
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  description?: string;
};

export type OperationType = 'create' | 'update' | 'delete';

export type CanonicalPractitioner = {
  id?: string;
  identifier?: string;
  name?: {
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
  };
  telecom?: Array<{
    system: 'phone' | 'email' | 'fax' | 'url' | 'other';
    value: string;
    use?: string;
  }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    use?: string;
  }>;
  gender?: string;
  birthDate?: string;
  qualification?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  active?: boolean;
};

export type CanonicalPractitionerRole = {
  id?: string;
  practitionerId?: string;
  organizationId?: string;
  code?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  specialty?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  period?: {
    start?: string;
    end?: string;
  };
  active?: boolean;
};

export type CanonicalOrganization = {
  id?: string;
  identifier?: string;
  name?: string;
  alias?: string[];
  type?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  telecom?: Array<{
    system: 'phone' | 'email' | 'fax' | 'url' | 'other';
    value: string;
    use?: string;
  }>;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    use?: string;
  }>;
  partOf?: string; // Reference to parent organization
  active?: boolean;
};

export type CanonicalMedicationRequest = {
  id?: string;
  identifier?: string;
  status?: string;
  intent?: string;
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  medicationReference?: string;
  subject?: string; // Patient reference
  encounter?: string; // Encounter reference
  authoredOn?: string;
  requester?: string; // Practitioner reference
  performer?: string; // Practitioner reference
  dosageInstruction?: Array<{
    text?: string;
    timing?: any;
    doseQuantity?: {
      value?: number;
      unit?: string;
    };
    route?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
  }>;
  active?: boolean;
};

export type CanonicalMedication = {
  id?: string;
  identifier?: string;
  code?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  form?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  manufacturer?: string; // Organization reference
  amount?: {
    value?: number;
    unit?: string;
  };
  status?: string;
  active?: boolean;
};

export type CanonicalMedicationStatement = {
  id?: string;
  identifier?: string;
  status?: string;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  medicationReference?: string;
  subject?: string;
  encounter?: string;
  effectiveDateTime?: string;
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  dateAsserted?: string;
  author?: string;
  informationSource?: string[];
  reason?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reference?: string;
  }>;
  note?: string[];
  relatedClinicalInformation?: string[];
  dosage?: Array<{
    text?: string;
    timing?: any;
    doseQuantity?: {
      value?: number;
      unit?: string;
    };
    route?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      text?: string;
    };
  }>;
  adherence?: {
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reason?: {
      system?: string;
      code?: string;
      display?: string;
    };
  };
  active?: boolean;
};

export type CanonicalMedicationAdministration = {
  id?: string;
  identifier?: string;
  basedOn?: string[];
  partOf?: string[];
  status?: string;
  statusReason?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  medicationReference?: string;
  subject?: string;
  encounter?: string;
  supportingInformation?: string[];
  occurrenceDateTime?: string;
  occurrencePeriod?: {
    start?: string;
    end?: string;
  };
  occurrenceTiming?: any;
  recorded?: string;
  isSubPotent?: boolean;
  subPotentReason?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  performer?: Array<{
    function?: {
      system?: string;
      code?: string;
      display?: string;
    };
    actor?: string;
  }>;
  reason?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reference?: string;
  }>;
  request?: string;
  device?: string[];
  note?: string[];
  dosage?: {
    text?: string;
    site?: {
      system?: string;
      code?: string;
      display?: string;
    };
    route?: {
      system?: string;
      code?: string;
      display?: string;
    };
    method?: {
      system?: string;
      code?: string;
      display?: string;
    };
    dose?: {
      value?: number;
      unit?: string;
    };
    rateRatio?: {
      numerator?: {
        value?: number;
        unit?: string;
      };
      denominator?: {
        value?: number;
        unit?: string;
      };
    };
    rateQuantity?: {
      value?: number;
      unit?: string;
    };
  };
  eventHistory?: string[];
  active?: boolean;
};

export type CanonicalMedicationDispense = {
  id?: string;
  identifier?: string;
  basedOn?: string[];
  partOf?: string[];
  status?: string;
  notPerformedReason?: {
    system?: string;
    code?: string;
    display?: string;
  };
  statusChanged?: string;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  medicationReference?: string;
  subject?: string;
  encounter?: string;
  supportingInformation?: string[];
  performer?: Array<{
    function?: {
      system?: string;
      code?: string;
      display?: string;
    };
    actor?: string;
  }>;
  location?: string;
  authorizingPrescription?: string[];
  type?: {
    system?: string;
    code?: string;
    display?: string;
  };
  quantity?: {
    value?: number;
    unit?: string;
  };
  daysSupply?: {
    value?: number;
    unit?: string;
  };
  recorded?: string;
  whenPrepared?: string;
  whenHandedOver?: string;
  destination?: string;
  receiver?: string[];
  note?: string[];
  renderedDosageInstruction?: string;
  dosageInstruction?: any[];
  substitution?: {
    wasSubstituted?: boolean;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reason?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    responsibleParty?: string;
  };
  eventHistory?: string[];
  active?: boolean;
};

export type CanonicalOrganizationAffiliation = {
  id?: string;
  identifier?: string;
  active?: boolean;
  period?: {
    start?: string;
    end?: string;
  };
  organization?: string;
  participatingOrganization?: string;
  network?: string[];
  code?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  specialty?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  location?: string[];
  healthcareService?: string[];
  contact?: Array<{
    name?: string;
    telecom?: Array<{
      system?: string;
      value?: string;
      use?: string;
    }>;
  }>;
  endpoint?: string[];
  activeFlag?: boolean;
};

export type CanonicalPerson = {
  id?: string;
  identifier?: string;
  active?: boolean;
  name?: {
    family?: string;
    given?: string[];
    prefix?: string[];
    suffix?: string[];
  };
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  gender?: string;
  birthDate?: string;
  deceasedBoolean?: boolean;
  deceasedDateTime?: string;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }>;
  maritalStatus?: {
    system?: string;
    code?: string;
    display?: string;
  };
  communication?: Array<{
    language?: {
      system?: string;
      code?: string;
      display?: string;
    };
    preferred?: boolean;
  }>;
  managingOrganization?: string;
  link?: Array<{
    target?: string;
    assurance?: string;
  }>;
};

export type CanonicalDeviceDispense = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  basedOn?: string[];
  partOf?: string[];
  status?: string;
  statusReason?: {
    concept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reference?: string;
  };
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  deviceCodeableConcept?: {
    system?: string;
    code?: string;
    display?: string;
  };
  deviceReference?: string;
  subject?: string;
  receiver?: string;
  encounter?: string;
  supportingInformation?: string[];
  performer?: Array<{
    function?: {
      system?: string;
      code?: string;
      display?: string;
    };
    actor?: string;
  }>;
  location?: string;
  type?: {
    system?: string;
    code?: string;
    display?: string;
  };
  quantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  preparedDate?: string;
  whenHandedOver?: string;
  destination?: string;
  note?: string[];
  usageInstruction?: string;
  eventHistory?: string[];
};

export type CanonicalDeviceRequest = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: string[];
  replaces?: string[];
  groupIdentifier?: {
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  };
  status?: string;
  intent?: string;
  priority?: string;
  doNotPerform?: boolean;
  codeCodeableConcept?: {
    system?: string;
    code?: string;
    display?: string;
  };
  codeReference?: string;
  quantity?: number;
  parameter?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    valueCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    valueQuantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    valueBoolean?: boolean;
  }>;
  subject?: string;
  encounter?: string;
  occurrenceDateTime?: string;
  occurrencePeriod?: {
    start?: string;
    end?: string;
  };
  occurrenceTiming?: string;
  authoredOn?: string;
  requester?: string;
  performer?: string;
  reason?: string[];
  asNeeded?: boolean;
  asNeededFor?: {
    system?: string;
    code?: string;
    display?: string;
  };
  insurance?: string[];
  supportingInfo?: string[];
  note?: string[];
  relevantHistory?: string[];
};

export type CanonicalDeviceUsage = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  basedOn?: string[];
  status?: string;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  patient?: string;
  derivedFrom?: string[];
  context?: string;
  timingTiming?: string;
  timingPeriod?: {
    start?: string;
    end?: string;
  };
  timingDateTime?: string;
  dateAsserted?: string;
  usageStatus?: {
    system?: string;
    code?: string;
    display?: string;
  };
  usageReason?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  adherence?: {
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reason?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  informationSource?: string;
  deviceCodeableConcept?: {
    system?: string;
    code?: string;
    display?: string;
  };
  deviceReference?: string;
  reason?: string[];
  bodySite?: string;
  note?: string[];
};

export type CanonicalCapabilityStatement = {
  id?: string;
  url?: string;
  identifier?: string[];
  version?: string;
  versionAlgorithmString?: string;
  versionAlgorithmCoding?: {
    system?: string;
    code?: string;
    display?: string;
  };
  name?: string;
  title?: string;
  status?: string;
  experimental?: boolean;
  date?: string;
  publisher?: string;
  contact?: Array<{
    name?: string;
    telecom?: Array<{
      system?: string;
      value?: string;
      use?: string;
    }>;
  }>;
  description?: string;
  useContext?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    value?: string;
  }>;
  jurisdiction?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  purpose?: string;
  copyright?: string;
  copyrightLabel?: string;
  kind?: string;
  instantiates?: string[];
  imports?: string[];
  software?: {
    name?: string;
    version?: string;
    releaseDate?: string;
  };
  implementation?: {
    description?: string;
    url?: string;
    custodian?: string;
  };
  fhirVersion?: string;
  format?: string[];
  patchFormat?: string[];
  acceptLanguage?: string[];
  implementationGuide?: string[];
  rest?: Array<{
    mode?: string;
    documentation?: string;
  }>;
  messaging?: Array<{
    endpoint?: Array<{
      protocol?: {
        system?: string;
        code?: string;
        display?: string;
      };
      address?: string;
    }>;
    documentation?: string;
  }>;
  document?: Array<{
    mode?: string;
    documentation?: string;
    profile?: string;
  }>;
  active?: boolean;
};

export type CanonicalOperationOutcome = {
  id?: string;
  issue?: Array<{
    severity?: string;
    code?: string;
    details?: {
      system?: string;
      code?: string;
      display?: string;
    };
    diagnostics?: string;
    location?: string[];
    expression?: string[];
  }>;
  active?: boolean;
};

export type CanonicalParameters = {
  id?: string;
  parameter?: Array<{
    name: string;
    valueString?: string;
    valueCode?: string;
    valueBoolean?: boolean;
    valueDateTime?: string;
    valueDate?: string;
    valueInteger?: number;
    valueDecimal?: number;
    valueUri?: string;
    valueReference?: string;
  }>;
  active?: boolean;
};

export type CanonicalCarePlan = {
  id?: string;
  identifier?: string;
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: string[];
  replaces?: string[];
  partOf?: string[];
  status?: string;
  intent?: string;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  title?: string;
  description?: string;
  subject?: string;
  encounter?: string;
  period?: {
    start?: string;
    end?: string;
  };
  created?: string;
  custodian?: string;
  contributor?: string[];
  careTeam?: string[];
  addresses?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reference?: string;
  }>;
  supportingInfo?: string[];
  goal?: string[];
  activity?: Array<{
    performedActivity?: Array<{
      code?: {
        system?: string;
        code?: string;
        display?: string;
      };
      reference?: string;
    }>;
    progress?: string[];
    plannedActivityReference?: string;
  }>;
  note?: string[];
  active?: boolean;
};

export type CanonicalCareTeam = {
  id?: string;
  identifier?: string;
  status?: string;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  name?: string;
  subject?: string;
  period?: {
    start?: string;
    end?: string;
  };
  participant?: Array<{
    role?: {
      system?: string;
      code?: string;
      display?: string;
    };
    member?: string;
    onBehalfOf?: string;
    coveragePeriod?: {
      start?: string;
      end?: string;
    };
  }>;
  reason?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reference?: string;
  }>;
  managingOrganization?: string[];
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  note?: string[];
  active?: boolean;
};

export type CanonicalGoal = {
  id?: string;
  identifier?: string;
  lifecycleStatus?: string;
  achievementStatus?: {
    system?: string;
    code?: string;
    display?: string;
  };
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  continuous?: boolean;
  priority?: {
    system?: string;
    code?: string;
    display?: string;
  };
  description?: {
    system?: string;
    code?: string;
    display?: string;
    text?: string;
  };
  subject?: string;
  startDate?: string;
  startCodeableConcept?: {
    system?: string;
    code?: string;
    display?: string;
  };
  target?: Array<{
    measure?: {
      system?: string;
      code?: string;
      display?: string;
    };
    detailString?: string;
    detailBoolean?: boolean;
    detailInteger?: number;
    dueDate?: string;
  }>;
  statusDate?: string;
  statusReason?: string;
  source?: string;
  addresses?: string[];
  note?: string[];
  outcome?: string[];
  active?: boolean;
};

export type CanonicalServiceRequest = {
  id?: string;
  identifier?: string;
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: string[];
  replaces?: string[];
  requisition?: string;
  status?: string;
  intent?: string;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  priority?: string;
  doNotPerform?: boolean;
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  quantityString?: string;
  subject?: string;
  encounter?: string;
  occurrenceDateTime?: string;
  occurrencePeriod?: {
    start?: string;
    end?: string;
  };
  asNeededBoolean?: boolean;
  authoredOn?: string;
  requester?: string;
  performerType?: {
    system?: string;
    code?: string;
    display?: string;
  };
  performer?: string[];
  location?: string[];
  reason?: string[];
  supportingInfo?: string[];
  specimen?: string[];
  bodySite?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  note?: string[];
  patientInstruction?: string[];
  active?: boolean;
};

export type CanonicalTask = {
  id?: string;
  identifier?: string;
  instantiatesCanonical?: string;
  instantiatesUri?: string;
  basedOn?: string[];
  groupIdentifier?: string;
  partOf?: string[];
  status?: string;
  statusReason?: string;
  businessStatus?: string;
  intent?: string;
  priority?: string;
  doNotPerform?: boolean;
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  description?: string;
  focus?: string;
  for?: string;
  encounter?: string;
  requestedPeriod?: {
    start?: string;
    end?: string;
  };
  executionPeriod?: {
    start?: string;
    end?: string;
  };
  authoredOn?: string;
  lastModified?: string;
  requester?: string;
  requestedPerformer?: string[];
  owner?: string;
  performer?: Array<{
    actor?: string;
    function?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  location?: string;
  reason?: string[];
  insurance?: string[];
  note?: string[];
  relevantHistory?: string[];
  active?: boolean;
};

export type CanonicalCommunication = {
  id?: string;
  identifier?: string;
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: string[];
  partOf?: string[];
  inResponseTo?: string[];
  status?: string;
  statusReason?: {
    system?: string;
    code?: string;
    display?: string;
  };
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  priority?: string;
  medium?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  subject?: string;
  topic?: {
    system?: string;
    code?: string;
    display?: string;
  };
  about?: string[];
  encounter?: string;
  sent?: string;
  received?: string;
  recipient?: string[];
  sender?: string;
  reason?: string[];
  payload?: string[];
  note?: string[];
  active?: boolean;
};

export type CanonicalCommunicationRequest = {
  id?: string;
  identifier?: string;
  basedOn?: string[];
  replaces?: string[];
  groupIdentifier?: string;
  status?: string;
  statusReason?: {
    system?: string;
    code?: string;
    display?: string;
  };
  intent?: string;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  priority?: string;
  doNotPerform?: boolean;
  medium?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  subject?: string;
  about?: string[];
  encounter?: string;
  payload?: string[];
  occurrenceDateTime?: string;
  occurrencePeriod?: {
    start?: string;
    end?: string;
  };
  authoredOn?: string;
  requester?: string;
  recipient?: string[];
  informationProvider?: string[];
  reason?: string[];
  note?: string[];
  active?: boolean;
};

export type CanonicalQuestionnaire = {
  id?: string;
  url?: string;
  identifier?: string;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  date?: string;
  publisher?: string;
  description?: string;
  subjectType?: string[];
  item?: Array<{
    linkId?: string;
    text?: string;
    type?: string;
  }>;
  active?: boolean;
};

export type CanonicalQuestionnaireResponse = {
  id?: string;
  identifier?: string;
  basedOn?: string[];
  partOf?: string[];
  questionnaire?: string;
  status?: string;
  subject?: string;
  encounter?: string;
  authored?: string;
  author?: string;
  source?: string;
  item?: Array<{
    linkId?: string;
    text?: string;
    answer?: string[];
  }>;
  active?: boolean;
};

export type CanonicalCodeSystem = {
  id?: string;
  url?: string;
  identifier?: string;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  date?: string;
  publisher?: string;
  description?: string;
  content?: string;
  caseSensitive?: boolean;
  concept?: Array<{
    code?: string;
    display?: string;
    definition?: string;
  }>;
  active?: boolean;
};

export type CanonicalValueSet = {
  id?: string;
  url?: string;
  identifier?: string;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  date?: string;
  publisher?: string;
  description?: string;
  compose?: {
    include?: Array<{
      system?: string;
      concept?: Array<{
        code?: string;
        display?: string;
      }>;
    }>;
  };
  expansion?: {
    contains?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  active?: boolean;
};

export type CanonicalConceptMap = {
  id?: string;
  url?: string;
  identifier?: string;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  date?: string;
  publisher?: string;
  description?: string;
  sourceScope?: string;
  targetScope?: string;
  group?: Array<{
    source?: string;
    target?: string;
    element?: Array<{
      code?: string;
      display?: string;
      target?: Array<{
        code?: string;
        display?: string;
        relationship?: string;
      }>;
    }>;
  }>;
  active?: boolean;
};

export type CanonicalNamingSystem = {
  id?: string;
  url?: string;
  identifier?: string;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  kind?: string;
  date?: string;
  publisher?: string;
  responsible?: string;
  description?: string;
  usage?: string;
  uniqueId?: Array<{
    type?: string;
    value?: string;
    preferred?: boolean;
  }>;
  active?: boolean;
};

export type CanonicalTerminologyCapabilities = {
  id?: string;
  url?: string;
  identifier?: string;
  version?: string;
  name?: string;
  title?: string;
  status?: string;
  date?: string;
  publisher?: string;
  description?: string;
  kind?: string;
  codeSearch?: string;
  active?: boolean;
};

export type CanonicalProvenance = {
  id?: string;
  target?: string[];
  recorded?: string;
  activity?: string;
  agent?: Array<{
    who?: string;
    role?: string;
  }>;
  active?: boolean;
};

export type CanonicalAuditEvent = {
  id?: string;
  category?: string;
  code?: string;
  action?: string;
  severity?: string;
  recorded?: string;
  agent?: Array<{
    who?: string;
    role?: string;
    requestor?: boolean;
  }>;
  active?: boolean;
};

export type CanonicalConsent = {
  id?: string;
  status?: string;
  category?: string;
  subject?: string;
  date?: string;
  decision?: string;
  grantor?: string[];
  grantee?: string[];
  active?: boolean;
};

export type CanonicalProcedure = {
  id?: string;
  identifier?: string;
  status?: string;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  code?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: string;
  encounter?: string;
  occurrenceDateTime?: string;
  occurrencePeriod?: {
    start?: string;
    end?: string;
  };
  recorded?: string;
  performer?: Array<{
    actor?: string;
    onBehalfOf?: string;
    function?: {
      system?: string;
      code?: string;
      display?: string;
    };
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  reason?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reference?: string;
  }>;
  bodySite?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  note?: string[];
  location?: string;
  active?: boolean;
};

export type CanonicalCondition = {
  id?: string;
  identifier?: string;
  clinicalStatus?: {
    system?: string;
    code?: string;
    display?: string;
  };
  verificationStatus?: {
    system?: string;
    code?: string;
    display?: string;
  };
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  severity?: {
    system?: string;
    code?: string;
    display?: string;
  };
  code?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  bodySite?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  subject?: string;
  encounter?: string;
  onsetDateTime?: string;
  onsetPeriod?: {
    start?: string;
    end?: string;
  };
  onsetString?: string;
  abatementDateTime?: string;
  abatementPeriod?: {
    start?: string;
    end?: string;
  };
  abatementString?: string;
  recordedDate?: string;
  participant?: Array<{
    actor?: string;
    function?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  stage?: Array<{
    summary?: {
      system?: string;
      code?: string;
      display?: string;
    };
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    assessment?: string[];
  }>;
  evidence?: Array<{
    reference?: string;
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  note?: string[];
  active?: boolean;
};

export type CanonicalAppointment = {
  id?: string;
  identifier?: string;
  status?: string;
  extension?: Array<{
    url: string;
    valueString?: string;
    valueBoolean?: boolean;
    valueDateTime?: string;
    valueUri?: string;
    valueCode?: string;
    valueId?: string;
  }>;
  cancellationReason?: {
    system?: string;
    code?: string;
    display?: string;
  };
  serviceCategory?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  serviceType?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  specialty?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  appointmentType?: {
    system?: string;
    code?: string;
    display?: string;
  };
  reason?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reference?: string;
  }>;
  priority?: {
    system?: string;
    code?: string;
    display?: string;
  };
  description?: string;
  start?: string;
  end?: string;
  minutesDuration?: number;
  created?: string;
  cancellationDate?: string;
  note?: string[];
  subject?: string;
  participant?: Array<{
    actor?: string;
    status?: string;
    required?: boolean;
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  active?: boolean;
};

export type CanonicalAppointmentResponse = {
  id?: string;
  identifier?: string;
  appointment?: string;
  proposedNewTime?: boolean;
  start?: string;
  end?: string;
  participantType?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  actor?: string;
  participantStatus?: string;
  comment?: string;
  recurring?: boolean;
  occurrenceDate?: string;
  recurrenceId?: number;
};

export type CanonicalClaim = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  traceNumber?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  status?: string;
  type?: {
    system?: string;
    code?: string;
    display?: string;
  };
  subType?: {
    system?: string;
    code?: string;
    display?: string;
  };
  use?: string;
  patient?: string;
  billablePeriod?: {
    start?: string;
    end?: string;
  };
  created?: string;
  enterer?: string;
  insurer?: string;
  provider?: string;
  priority?: {
    system?: string;
    code?: string;
    display?: string;
  };
  fundsReserve?: {
    system?: string;
    code?: string;
    display?: string;
  };
  related?: Array<{
    claim?: string;
    relationship?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reference?: {
      system?: string;
      value?: string;
    };
  }>;
  prescription?: string;
  originalPrescription?: string;
  payee?: {
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    party?: string;
  };
  referral?: string;
  encounter?: string[];
  facility?: string;
  diagnosisRelatedGroup?: {
    system?: string;
    code?: string;
    display?: string;
  };
  event?: Array<{
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    whenDateTime?: string;
    whenPeriod?: {
      start?: string;
      end?: string;
    };
  }>;
  careTeam?: Array<{
    sequence?: number;
    provider?: string;
    responsible?: boolean;
    role?: {
      system?: string;
      code?: string;
      display?: string;
    };
    specialty?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  supportingInfo?: Array<{
    sequence?: number;
    category?: {
      system?: string;
      code?: string;
      display?: string;
    };
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    timingDate?: string;
    timingPeriod?: {
      start?: string;
      end?: string;
    };
    valueBoolean?: boolean;
    valueString?: string;
    valueQuantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    valueAttachment?: {
      contentType?: string;
      url?: string;
      title?: string;
      data?: string;
    };
    valueReference?: string;
    valueIdentifier?: {
      system?: string;
      value?: string;
    };
    reason?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  diagnosis?: Array<{
    sequence?: number;
    diagnosisCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    diagnosisReference?: string;
    type?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    onAdmission?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  procedure?: Array<{
    sequence?: number;
    type?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    date?: string;
    procedureCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    procedureReference?: string;
    udi?: string[];
  }>;
  insurance?: Array<{
    sequence?: number;
    focal?: boolean;
    identifier?: {
      system?: string;
      value?: string;
    };
    coverage?: string;
    businessArrangement?: string;
    preAuthRef?: string[];
    claimResponse?: string;
  }>;
  accident?: {
    date?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    locationAddress?: {
      line?: string[];
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    locationReference?: string;
  };
  patientPaid?: {
    value?: number;
    currency?: string;
  };
  item?: Array<{
    sequence?: number;
    traceNumber?: Array<{
      system?: string;
      value?: string;
    }>;
    careTeamSequence?: number[];
    diagnosisSequence?: number[];
    procedureSequence?: number[];
    informationSequence?: number[];
    revenue?: {
      system?: string;
      code?: string;
      display?: string;
    };
    category?: {
      system?: string;
      code?: string;
      display?: string;
    };
    productOrService?: {
      system?: string;
      code?: string;
      display?: string;
    };
    productOrServiceEnd?: {
      system?: string;
      code?: string;
      display?: string;
    };
    request?: string[];
    modifier?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    programCode?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    servicedDate?: string;
    servicedPeriod?: {
      start?: string;
      end?: string;
    };
    locationCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    locationAddress?: {
      line?: string[];
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    locationReference?: string;
    patientPaid?: {
      value?: number;
      currency?: string;
    };
    quantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    unitPrice?: {
      value?: number;
      currency?: string;
    };
    factor?: number;
    tax?: {
      value?: number;
      currency?: string;
    };
    net?: {
      value?: number;
      currency?: string;
    };
    udi?: string[];
    bodySite?: Array<{
      site?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      subSite?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    }>;
    encounter?: string[];
    detail?: Array<{
      sequence?: number;
      traceNumber?: Array<{
        system?: string;
        value?: string;
      }>;
      revenue?: {
        system?: string;
        code?: string;
        display?: string;
      };
      category?: {
        system?: string;
        code?: string;
        display?: string;
      };
      productOrService?: {
        system?: string;
        code?: string;
        display?: string;
      };
      productOrServiceEnd?: {
        system?: string;
        code?: string;
        display?: string;
      };
      modifier?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      programCode?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      patientPaid?: {
        value?: number;
        currency?: string;
      };
      quantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
      unitPrice?: {
        value?: number;
        currency?: string;
      };
      factor?: number;
      tax?: {
        value?: number;
        currency?: string;
      };
      net?: {
        value?: number;
        currency?: string;
      };
      udi?: string[];
      subDetail?: Array<{
        sequence?: number;
        traceNumber?: Array<{
          system?: string;
          value?: string;
        }>;
        revenue?: {
          system?: string;
          code?: string;
          display?: string;
        };
        category?: {
          system?: string;
          code?: string;
          display?: string;
        };
        productOrService?: {
          system?: string;
          code?: string;
          display?: string;
        };
        productOrServiceEnd?: {
          system?: string;
          code?: string;
          display?: string;
        };
        modifier?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        programCode?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        patientPaid?: {
          value?: number;
          currency?: string;
        };
        quantity?: {
          value?: number;
          unit?: string;
          system?: string;
          code?: string;
        };
        unitPrice?: {
          value?: number;
          currency?: string;
        };
        factor?: number;
        tax?: {
          value?: number;
          currency?: string;
        };
        net?: {
          value?: number;
          currency?: string;
        };
        udi?: string[];
      }>;
    }>;
  }>;
  total?: {
    value?: number;
    currency?: string;
  };
};

export type CanonicalClaimResponse = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  traceNumber?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  status?: string;
  type?: {
    system?: string;
    code?: string;
    display?: string;
  };
  subType?: {
    system?: string;
    code?: string;
    display?: string;
  };
  use?: string;
  patient?: string;
  created?: string;
  insurer?: string;
  requestor?: string;
  request?: string;
  outcome?: string;
  decision?: {
    system?: string;
    code?: string;
    display?: string;
  };
  disposition?: string;
  preAuthRef?: string;
  preAuthPeriod?: {
    start?: string;
    end?: string;
  };
  event?: Array<{
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    whenDateTime?: string;
    whenPeriod?: {
      start?: string;
      end?: string;
    };
  }>;
  payeeType?: {
    system?: string;
    code?: string;
    display?: string;
  };
  encounter?: string[];
  diagnosisRelatedGroup?: {
    system?: string;
    code?: string;
    display?: string;
  };
  item?: Array<{
    itemSequence?: number;
    traceNumber?: Array<{
      system?: string;
      value?: string;
    }>;
    noteNumber?: number[];
    reviewOutcome?: {
      decision?: {
        system?: string;
        code?: string;
        display?: string;
      };
      reason?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      preAuthRef?: string;
      preAuthPeriod?: {
        start?: string;
        end?: string;
      };
    };
    adjudication?: Array<{
      category?: {
        system?: string;
        code?: string;
        display?: string;
      };
      reason?: {
        system?: string;
        code?: string;
        display?: string;
      };
      amount?: {
        value?: number;
        currency?: string;
      };
      quantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
    }>;
    detail?: Array<{
      detailSequence?: number;
      traceNumber?: Array<{
        system?: string;
        value?: string;
      }>;
      noteNumber?: number[];
      reviewOutcome?: {
        decision?: {
          system?: string;
          code?: string;
          display?: string;
        };
        reason?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        preAuthRef?: string;
        preAuthPeriod?: {
          start?: string;
          end?: string;
        };
      };
      adjudication?: Array<{
        category?: {
          system?: string;
          code?: string;
          display?: string;
        };
        reason?: {
          system?: string;
          code?: string;
          display?: string;
        };
        amount?: {
          value?: number;
          currency?: string;
        };
        quantity?: {
          value?: number;
          unit?: string;
          system?: string;
          code?: string;
        };
      }>;
      subDetail?: Array<{
        subDetailSequence?: number;
        traceNumber?: Array<{
          system?: string;
          value?: string;
        }>;
        noteNumber?: number[];
        reviewOutcome?: {
          decision?: {
            system?: string;
            code?: string;
            display?: string;
          };
          reason?: Array<{
            system?: string;
            code?: string;
            display?: string;
          }>;
          preAuthRef?: string;
          preAuthPeriod?: {
            start?: string;
            end?: string;
          };
        };
        adjudication?: Array<{
          category?: {
            system?: string;
            code?: string;
            display?: string;
          };
          reason?: {
            system?: string;
            code?: string;
            display?: string;
          };
          amount?: {
            value?: number;
            currency?: string;
          };
          quantity?: {
            value?: number;
            unit?: string;
            system?: string;
            code?: string;
          };
        }>;
      }>;
    }>;
  }>;
  addItem?: Array<{
    itemSequence?: number[];
    detailSequence?: number[];
    subdetailSequence?: number[];
    traceNumber?: Array<{
      system?: string;
      value?: string;
    }>;
    provider?: string[];
    revenue?: {
      system?: string;
      code?: string;
      display?: string;
    };
    productOrService?: {
      system?: string;
      code?: string;
      display?: string;
    };
    productOrServiceEnd?: {
      system?: string;
      code?: string;
      display?: string;
    };
    request?: string[];
    modifier?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    programCode?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    servicedDate?: string;
    servicedPeriod?: {
      start?: string;
      end?: string;
    };
    locationCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    locationAddress?: {
      line?: string[];
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    locationReference?: string;
    quantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    unitPrice?: {
      value?: number;
      currency?: string;
    };
    factor?: number;
    tax?: {
      value?: number;
      currency?: string;
    };
    net?: {
      value?: number;
      currency?: string;
    };
    bodySite?: Array<{
      site?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      subSite?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    }>;
    noteNumber?: number[];
    reviewOutcome?: {
      decision?: {
        system?: string;
        code?: string;
        display?: string;
      };
      reason?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      preAuthRef?: string;
      preAuthPeriod?: {
        start?: string;
        end?: string;
      };
    };
    adjudication?: Array<{
      category?: {
        system?: string;
        code?: string;
        display?: string;
      };
      reason?: {
        system?: string;
        code?: string;
        display?: string;
      };
      amount?: {
        value?: number;
        currency?: string;
      };
      quantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
    }>;
    detail?: Array<{
      traceNumber?: Array<{
        system?: string;
        value?: string;
      }>;
      revenue?: {
        system?: string;
        code?: string;
        display?: string;
      };
      productOrService?: {
        system?: string;
        code?: string;
        display?: string;
      };
      productOrServiceEnd?: {
        system?: string;
        code?: string;
        display?: string;
      };
      modifier?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      quantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
      unitPrice?: {
        value?: number;
        currency?: string;
      };
      factor?: number;
      tax?: {
        value?: number;
        currency?: string;
      };
      net?: {
        value?: number;
        currency?: string;
      };
      noteNumber?: number[];
      reviewOutcome?: {
        decision?: {
          system?: string;
          code?: string;
          display?: string;
        };
        reason?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        preAuthRef?: string;
        preAuthPeriod?: {
          start?: string;
          end?: string;
        };
      };
      adjudication?: Array<{
        category?: {
          system?: string;
          code?: string;
          display?: string;
        };
        reason?: {
          system?: string;
          code?: string;
          display?: string;
        };
        amount?: {
          value?: number;
          currency?: string;
        };
        quantity?: {
          value?: number;
          unit?: string;
          system?: string;
          code?: string;
        };
      }>;
      subDetail?: Array<{
        traceNumber?: Array<{
          system?: string;
          value?: string;
        }>;
        revenue?: {
          system?: string;
          code?: string;
          display?: string;
        };
        productOrService?: {
          system?: string;
          code?: string;
          display?: string;
        };
        productOrServiceEnd?: {
          system?: string;
          code?: string;
          display?: string;
        };
        modifier?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        quantity?: {
          value?: number;
          unit?: string;
          system?: string;
          code?: string;
        };
        unitPrice?: {
          value?: number;
          currency?: string;
        };
        factor?: number;
        tax?: {
          value?: number;
          currency?: string;
        };
        net?: {
          value?: number;
          currency?: string;
        };
        noteNumber?: number[];
        reviewOutcome?: {
          decision?: {
            system?: string;
            code?: string;
            display?: string;
          };
          reason?: Array<{
            system?: string;
            code?: string;
            display?: string;
          }>;
          preAuthRef?: string;
          preAuthPeriod?: {
            start?: string;
            end?: string;
          };
        };
        adjudication?: Array<{
          category?: {
            system?: string;
            code?: string;
            display?: string;
          };
          reason?: {
            system?: string;
            code?: string;
            display?: string;
          };
          amount?: {
            value?: number;
            currency?: string;
          };
          quantity?: {
            value?: number;
            unit?: string;
            system?: string;
            code?: string;
          };
        }>;
      }>;
    }>;
  }>;
  adjudication?: Array<{
    category?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reason?: {
      system?: string;
      code?: string;
      display?: string;
    };
    amount?: {
      value?: number;
      currency?: string;
    };
    quantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
  }>;
  total?: Array<{
    category?: {
      system?: string;
      code?: string;
      display?: string;
    };
    amount?: {
      value?: number;
      currency?: string;
    };
  }>;
  payment?: {
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    adjustment?: {
      value?: number;
      currency?: string;
    };
    adjustmentReason?: {
      system?: string;
      code?: string;
      display?: string;
    };
    date?: string;
    amount?: {
      value?: number;
      currency?: string;
    };
    identifier?: {
      system?: string;
      value?: string;
    };
  };
  fundsReserve?: {
    system?: string;
    code?: string;
    display?: string;
  };
  formCode?: {
    system?: string;
    code?: string;
    display?: string;
  };
  form?: {
    contentType?: string;
    url?: string;
    title?: string;
    data?: string;
  };
  processNote?: Array<{
    number?: number;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    text?: string;
    language?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  communicationRequest?: string[];
  insurance?: Array<{
    sequence?: number;
    focal?: boolean;
    coverage?: string;
    businessArrangement?: string;
    claimResponse?: string;
  }>;
  error?: Array<{
    itemSequence?: number;
    detailSequence?: number;
    subDetailSequence?: number;
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    expression?: string[];
  }>;
};

export type CanonicalExplanationOfBenefit = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  traceNumber?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  status?: string;
  type?: {
    system?: string;
    code?: string;
    display?: string;
  };
  subType?: {
    system?: string;
    code?: string;
    display?: string;
  };
  use?: string;
  patient?: string;
  billablePeriod?: {
    start?: string;
    end?: string;
  };
  created?: string;
  enterer?: string;
  insurer?: string;
  provider?: string;
  priority?: {
    system?: string;
    code?: string;
    display?: string;
  };
  fundsReserveRequested?: {
    system?: string;
    code?: string;
    display?: string;
  };
  fundsReserve?: {
    system?: string;
    code?: string;
    display?: string;
  };
  related?: Array<{
    claim?: string;
    relationship?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reference?: {
      system?: string;
      value?: string;
    };
  }>;
  prescription?: string;
  originalPrescription?: string;
  event?: Array<{
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    whenDateTime?: string;
    whenPeriod?: {
      start?: string;
      end?: string;
    };
  }>;
  payee?: {
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    party?: string;
  };
  referral?: string;
  encounter?: string[];
  facility?: string;
  claim?: string;
  claimResponse?: string;
  outcome?: string;
  decision?: {
    system?: string;
    code?: string;
    display?: string;
  };
  disposition?: string;
  preAuthRef?: string[];
  preAuthRefPeriod?: Array<{
    start?: string;
    end?: string;
  }>;
  diagnosisRelatedGroup?: {
    system?: string;
    code?: string;
    display?: string;
  };
  careTeam?: Array<{
    sequence?: number;
    provider?: string;
    responsible?: boolean;
    role?: {
      system?: string;
      code?: string;
      display?: string;
    };
    specialty?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  supportingInfo?: Array<{
    sequence?: number;
    category?: {
      system?: string;
      code?: string;
      display?: string;
    };
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    timingDate?: string;
    timingPeriod?: {
      start?: string;
      end?: string;
    };
    valueBoolean?: boolean;
    valueString?: string;
    valueQuantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    valueAttachment?: {
      contentType?: string;
      url?: string;
      title?: string;
      data?: string;
    };
    valueReference?: string;
    valueIdentifier?: {
      system?: string;
      value?: string;
    };
    reason?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  diagnosis?: Array<{
    sequence?: number;
    diagnosisCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    diagnosisReference?: string;
    type?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    onAdmission?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  procedure?: Array<{
    sequence?: number;
    type?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    date?: string;
    procedureCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    procedureReference?: string;
    udi?: string[];
  }>;
  precedence?: number;
  insurance?: Array<{
    focal?: boolean;
    coverage?: string;
    preAuthRef?: string[];
  }>;
  accident?: {
    date?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    locationAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    locationReference?: string;
  };
  patientPaid?: {
    value?: number;
    currency?: string;
  };
  item?: Array<{
    sequence?: number;
    careTeamSequence?: number[];
    diagnosisSequence?: number[];
    procedureSequence?: number[];
    informationSequence?: number[];
    traceNumber?: Array<{
      system?: string;
      value?: string;
    }>;
    revenue?: {
      system?: string;
      code?: string;
      display?: string;
    };
    category?: {
      system?: string;
      code?: string;
      display?: string;
    };
    productOrService?: {
      system?: string;
      code?: string;
      display?: string;
    };
    productOrServiceEnd?: {
      system?: string;
      code?: string;
      display?: string;
    };
    request?: string[];
    modifier?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    programCode?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    servicedDate?: string;
    servicedPeriod?: {
      start?: string;
      end?: string;
    };
    locationCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    locationAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    locationReference?: string;
    patientPaid?: {
      value?: number;
      currency?: string;
    };
    quantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    unitPrice?: {
      value?: number;
      currency?: string;
    };
    factor?: number;
    tax?: {
      value?: number;
      currency?: string;
    };
    net?: {
      value?: number;
      currency?: string;
    };
    udi?: string[];
    bodySite?: Array<{
      site?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      subSite?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    }>;
    encounter?: string[];
    noteNumber?: number[];
    reviewOutcome?: {
      decision?: {
        system?: string;
        code?: string;
        display?: string;
      };
      reason?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      preAuthRef?: string;
      preAuthPeriod?: {
        start?: string;
        end?: string;
      };
    };
    adjudication?: Array<{
      category?: {
        system?: string;
        code?: string;
        display?: string;
      };
      reason?: {
        system?: string;
        code?: string;
        display?: string;
      };
      amount?: {
        value?: number;
        currency?: string;
      };
      quantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
    }>;
    detail?: Array<{
      sequence?: number;
      traceNumber?: Array<{
        system?: string;
        value?: string;
      }>;
      revenue?: {
        system?: string;
        code?: string;
        display?: string;
      };
      category?: {
        system?: string;
        code?: string;
        display?: string;
      };
      productOrService?: {
        system?: string;
        code?: string;
        display?: string;
      };
      productOrServiceEnd?: {
        system?: string;
        code?: string;
        display?: string;
      };
      modifier?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      programCode?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      patientPaid?: {
        value?: number;
        currency?: string;
      };
      quantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
      unitPrice?: {
        value?: number;
        currency?: string;
      };
      factor?: number;
      tax?: {
        value?: number;
        currency?: string;
      };
      net?: {
        value?: number;
        currency?: string;
      };
      udi?: string[];
      noteNumber?: number[];
      reviewOutcome?: {
        decision?: {
          system?: string;
          code?: string;
          display?: string;
        };
        reason?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        preAuthRef?: string;
        preAuthPeriod?: {
          start?: string;
          end?: string;
        };
      };
      adjudication?: Array<{
        category?: {
          system?: string;
          code?: string;
          display?: string;
        };
        reason?: {
          system?: string;
          code?: string;
          display?: string;
        };
        amount?: {
          value?: number;
          currency?: string;
        };
        quantity?: {
          value?: number;
          unit?: string;
          system?: string;
          code?: string;
        };
      }>;
      subDetail?: Array<{
        sequence?: number;
        traceNumber?: Array<{
          system?: string;
          value?: string;
        }>;
        revenue?: {
          system?: string;
          code?: string;
          display?: string;
        };
        category?: {
          system?: string;
          code?: string;
          display?: string;
        };
        productOrService?: {
          system?: string;
          code?: string;
          display?: string;
        };
        productOrServiceEnd?: {
          system?: string;
          code?: string;
          display?: string;
        };
        modifier?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        programCode?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        patientPaid?: {
          value?: number;
          currency?: string;
        };
        quantity?: {
          value?: number;
          unit?: string;
          system?: string;
          code?: string;
        };
        unitPrice?: {
          value?: number;
          currency?: string;
        };
        factor?: number;
        tax?: {
          value?: number;
          currency?: string;
        };
        net?: {
          value?: number;
          currency?: string;
        };
        udi?: string[];
        noteNumber?: number[];
        reviewOutcome?: {
          decision?: {
            system?: string;
            code?: string;
            display?: string;
          };
          reason?: Array<{
            system?: string;
            code?: string;
            display?: string;
          }>;
          preAuthRef?: string;
          preAuthPeriod?: {
            start?: string;
            end?: string;
          };
        };
        adjudication?: Array<{
          category?: {
            system?: string;
            code?: string;
            display?: string;
          };
          reason?: {
            system?: string;
            code?: string;
            display?: string;
          };
          amount?: {
            value?: number;
            currency?: string;
          };
          quantity?: {
            value?: number;
            unit?: string;
            system?: string;
            code?: string;
          };
        }>;
      }>;
    }>;
  }>;
  addItem?: Array<{
    itemSequence?: number[];
    detailSequence?: number[];
    subdetailSequence?: number[];
    traceNumber?: Array<{
      system?: string;
      value?: string;
    }>;
    provider?: string[];
    revenue?: {
      system?: string;
      code?: string;
      display?: string;
    };
    productOrService?: {
      system?: string;
      code?: string;
      display?: string;
    };
    productOrServiceEnd?: {
      system?: string;
      code?: string;
      display?: string;
    };
    request?: string[];
    modifier?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    programCode?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    servicedDate?: string;
    servicedPeriod?: {
      start?: string;
      end?: string;
    };
    locationCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    locationAddress?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
    };
    locationReference?: string;
    patientPaid?: {
      value?: number;
      currency?: string;
    };
    quantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    unitPrice?: {
      value?: number;
      currency?: string;
    };
    factor?: number;
    tax?: {
      value?: number;
      currency?: string;
    };
    net?: {
      value?: number;
      currency?: string;
    };
    bodySite?: Array<{
      site?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      subSite?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    }>;
    noteNumber?: number[];
    reviewOutcome?: {
      decision?: {
        system?: string;
        code?: string;
        display?: string;
      };
      reason?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      preAuthRef?: string;
      preAuthPeriod?: {
        start?: string;
        end?: string;
      };
    };
    adjudication?: Array<{
      category?: {
        system?: string;
        code?: string;
        display?: string;
      };
      reason?: {
        system?: string;
        code?: string;
        display?: string;
      };
      amount?: {
        value?: number;
        currency?: string;
      };
      quantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
    }>;
    detail?: Array<{
      traceNumber?: Array<{
        system?: string;
        value?: string;
      }>;
      revenue?: {
        system?: string;
        code?: string;
        display?: string;
      };
      productOrService?: {
        system?: string;
        code?: string;
        display?: string;
      };
      productOrServiceEnd?: {
        system?: string;
        code?: string;
        display?: string;
      };
      modifier?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
      patientPaid?: {
        value?: number;
        currency?: string;
      };
      quantity?: {
        value?: number;
        unit?: string;
        system?: string;
        code?: string;
      };
      unitPrice?: {
        value?: number;
        currency?: string;
      };
      factor?: number;
      tax?: {
        value?: number;
        currency?: string;
      };
      net?: {
        value?: number;
        currency?: string;
      };
      noteNumber?: number[];
      reviewOutcome?: {
        decision?: {
          system?: string;
          code?: string;
          display?: string;
        };
        reason?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        preAuthRef?: string;
        preAuthPeriod?: {
          start?: string;
          end?: string;
        };
      };
      adjudication?: Array<{
        category?: {
          system?: string;
          code?: string;
          display?: string;
        };
        reason?: {
          system?: string;
          code?: string;
          display?: string;
        };
        amount?: {
          value?: number;
          currency?: string;
        };
        quantity?: {
          value?: number;
          unit?: string;
          system?: string;
          code?: string;
        };
      }>;
      subDetail?: Array<{
        traceNumber?: Array<{
          system?: string;
          value?: string;
        }>;
        revenue?: {
          system?: string;
          code?: string;
          display?: string;
        };
        productOrService?: {
          system?: string;
          code?: string;
          display?: string;
        };
        productOrServiceEnd?: {
          system?: string;
          code?: string;
          display?: string;
        };
        modifier?: Array<{
          system?: string;
          code?: string;
          display?: string;
        }>;
        patientPaid?: {
          value?: number;
          currency?: string;
        };
        quantity?: {
          value?: number;
          unit?: string;
          system?: string;
          code?: string;
        };
        unitPrice?: {
          value?: number;
          currency?: string;
        };
        factor?: number;
        tax?: {
          value?: number;
          currency?: string;
        };
        net?: {
          value?: number;
          currency?: string;
        };
        noteNumber?: number[];
        reviewOutcome?: {
          decision?: {
            system?: string;
            code?: string;
            display?: string;
          };
          reason?: Array<{
            system?: string;
            code?: string;
            display?: string;
          }>;
          preAuthRef?: string;
          preAuthPeriod?: {
            start?: string;
            end?: string;
          };
        };
        adjudication?: Array<{
          category?: {
            system?: string;
            code?: string;
            display?: string;
          };
          reason?: {
            system?: string;
            code?: string;
            display?: string;
          };
          amount?: {
            value?: number;
            currency?: string;
          };
          quantity?: {
            value?: number;
            unit?: string;
            system?: string;
            code?: string;
          };
        }>;
      }>;
    }>;
  }>;
  adjudication?: Array<{
    category?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reason?: {
      system?: string;
      code?: string;
      display?: string;
    };
    amount?: {
      value?: number;
      currency?: string;
    };
    quantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
  }>;
  total?: Array<{
    category?: {
      system?: string;
      code?: string;
      display?: string;
    };
    amount?: {
      value?: number;
      currency?: string;
    };
  }>;
  payment?: {
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    adjustment?: {
      value?: number;
      currency?: string;
    };
    adjustmentReason?: {
      system?: string;
      code?: string;
      display?: string;
    };
    date?: string;
    amount?: {
      value?: number;
      currency?: string;
    };
    identifier?: {
      system?: string;
      value?: string;
    };
  };
  formCode?: {
    system?: string;
    code?: string;
    display?: string;
  };
  form?: {
    contentType?: string;
    url?: string;
    title?: string;
    data?: string;
  };
  processNote?: Array<{
    number?: number;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    text?: string;
    language?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  benefitPeriod?: {
    start?: string;
    end?: string;
  };
  benefitBalance?: Array<{
    category?: {
      system?: string;
      code?: string;
      display?: string;
    };
    excluded?: boolean;
    name?: string;
    description?: string;
    network?: {
      system?: string;
      code?: string;
      display?: string;
    };
    unit?: {
      system?: string;
      code?: string;
      display?: string;
    };
    term?: {
      system?: string;
      code?: string;
      display?: string;
    };
    financial?: Array<{
      type?: {
        system?: string;
        code?: string;
        display?: string;
      };
      allowedUnsignedInt?: number;
      allowedString?: string;
      allowedMoney?: {
        value?: number;
        currency?: string;
      };
      usedUnsignedInt?: number;
      usedMoney?: {
        value?: number;
        currency?: string;
      };
    }>;
  }>;
};

export type CanonicalComposition = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  url?: string;
  version?: string;
  status?: string;
  type?: {
    system?: string;
    code?: string;
    display?: string;
  };
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  subject?: string[];
  encounter?: string;
  date?: string;
  useContext?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    valueCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    valueReference?: string;
  }>;
  author?: string[];
  name?: string;
  title?: string;
  note?: Array<{
    text?: string;
    author?: string;
    time?: string;
  }>;
  attester?: Array<{
    mode?: {
      system?: string;
      code?: string;
      display?: string;
    };
    time?: string;
    party?: string;
  }>;
  custodian?: string;
  relatesTo?: Array<{
    type?: string;
    resource?: string;
    identifier?: {
      system?: string;
      value?: string;
    };
  }>;
  event?: Array<{
    period?: {
      start?: string;
      end?: string;
    };
    detail?: string[];
  }>;
  section?: Array<{
    title?: string;
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    author?: string[];
    focus?: string;
    text?: string;
    orderedBy?: {
      system?: string;
      code?: string;
      display?: string;
    };
    entry?: string[];
    emptyReason?: {
      system?: string;
      code?: string;
      display?: string;
    };
    section?: CanonicalComposition['section'];
  }>;
};

export type CanonicalCoverage = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  status?: string;
  kind?: string;
  paymentBy?: Array<{
    party?: string;
    responsibility?: string;
  }>;
  type?: {
    system?: string;
    code?: string;
    display?: string;
  };
  policyHolder?: string;
  subscriber?: string;
  subscriberId?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  beneficiary?: string;
  dependent?: string;
  relationship?: {
    system?: string;
    code?: string;
    display?: string;
  };
  period?: {
    start?: string;
    end?: string;
  };
  insurer?: string;
  class?: Array<{
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    value?: {
      system?: string;
      value?: string;
    };
    name?: string;
  }>;
  order?: number;
  network?: string;
  costToBeneficiary?: Array<{
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    category?: {
      system?: string;
      code?: string;
      display?: string;
    };
    network?: {
      system?: string;
      code?: string;
      display?: string;
    };
    unit?: {
      system?: string;
      code?: string;
      display?: string;
    };
    term?: {
      system?: string;
      code?: string;
      display?: string;
    };
    valueQuantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    valueMoney?: {
      value?: number;
      currency?: string;
    };
    exception?: Array<{
      type?: {
        system?: string;
        code?: string;
        display?: string;
      };
      period?: {
        start?: string;
        end?: string;
      };
    }>;
  }>;
  subrogation?: boolean;
  contract?: string[];
  insurancePlan?: string;
};

export type CanonicalAccount = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  status?: string;
  billingStatus?: {
    system?: string;
    code?: string;
    display?: string;
  };
  type?: {
    system?: string;
    code?: string;
    display?: string;
  };
  name?: string;
  subject?: string[];
  servicePeriod?: {
    start?: string;
    end?: string;
  };
  coverage?: Array<{
    coverage?: string;
    priority?: number;
  }>;
  owner?: string;
  description?: string;
  guarantor?: Array<{
    party?: string;
    onHold?: boolean;
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  diagnosis?: Array<{
    sequence?: number;
    condition?: {
      reference?: string;
      code?: {
        system?: string;
        code?: string;
        display?: string;
      };
    };
    dateOfDiagnosis?: string;
    type?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    onAdmission?: boolean;
    packageCode?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  procedure?: Array<{
    sequence?: number;
    code?: {
      reference?: string;
      code?: {
        system?: string;
        code?: string;
        display?: string;
      };
    };
    dateOfService?: string;
    type?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    packageCode?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    device?: string[];
  }>;
  relatedAccount?: Array<{
    relationship?: {
      system?: string;
      code?: string;
      display?: string;
    };
    account?: string;
  }>;
  currency?: {
    system?: string;
    code?: string;
    display?: string;
  };
  balance?: Array<{
    aggregate?: {
      system?: string;
      code?: string;
      display?: string;
    };
    term?: {
      system?: string;
      code?: string;
      display?: string;
    };
    estimate?: boolean;
    amount?: {
      value?: number;
      currency?: string;
    };
  }>;
  calculatedAt?: string;
};

export type CanonicalChargeItem = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  definitionUri?: string[];
  definitionCanonical?: string[];
  status?: string;
  partOf?: string[];
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  subject?: string;
  encounter?: string;
  occurrenceDateTime?: string;
  occurrencePeriod?: {
    start?: string;
    end?: string;
  };
  occurrenceTiming?: string;
  performer?: Array<{
    function?: {
      system?: string;
      code?: string;
      display?: string;
    };
    actor?: string;
  }>;
  performingOrganization?: string;
  requestingOrganization?: string;
  costCenter?: string;
  quantity?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  bodysite?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  unitPriceComponent?: {
    amount?: {
      value?: number;
      currency?: string;
    };
  };
  totalPriceComponent?: {
    amount?: {
      value?: number;
      currency?: string;
    };
  };
  overrideReason?: {
    system?: string;
    code?: string;
    display?: string;
  };
  enterer?: string;
  enteredDate?: string;
  reason?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  service?: Array<{
    reference?: string;
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  product?: Array<{
    reference?: string;
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  account?: string[];
  note?: string[];
  supportingInformation?: string[];
};

export type CanonicalChargeItemDefinition = {
  id?: string;
  url?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  version?: string;
  versionAlgorithmString?: string;
  versionAlgorithmCoding?: {
    system?: string;
    code?: string;
    display?: string;
  };
  name?: string;
  title?: string;
  derivedFromUri?: string[];
  partOf?: string[];
  replaces?: string[];
  status?: string;
  experimental?: boolean;
  date?: string;
  publisher?: string;
  contact?: Array<{
    name?: string;
    telecom?: Array<{
      system?: string;
      value?: string;
      use?: string;
    }>;
  }>;
  description?: string;
  useContext?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
    value?: {
      code?: {
        system?: string;
        code?: string;
        display?: string;
      };
      reference?: string;
    };
  }>;
  jurisdiction?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  purpose?: string;
  copyright?: string;
  copyrightLabel?: string;
  approvalDate?: string;
  lastReviewDate?: string;
  code?: {
    system?: string;
    code?: string;
    display?: string;
  };
  instance?: string[];
  applicability?: Array<{
    condition?: string;
    effectivePeriod?: {
      start?: string;
      end?: string;
    };
    relatedArtifact?: {
      type?: string;
      url?: string;
      display?: string;
    };
  }>;
  propertyGroup?: Array<{
    applicability?: CanonicalChargeItemDefinition['applicability'];
    priceComponent?: Array<{
      type?: string;
      code?: {
        system?: string;
        code?: string;
        display?: string;
      };
      factor?: number;
      amount?: {
        value?: number;
        currency?: string;
      };
    }>;
  }>;
};

export type CanonicalDevice = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  displayName?: string;
  definition?: {
    reference?: string;
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
  };
  udiCarrier?: Array<{
    deviceIdentifier?: string;
    issuer?: string;
    jurisdiction?: string;
    carrierAIDC?: string;
    carrierHRF?: string;
    entryType?: string;
  }>;
  status?: string;
  availabilityStatus?: {
    system?: string;
    code?: string;
    display?: string;
  };
  manufacturer?: string;
  manufactureDate?: string;
  expirationDate?: string;
  lotNumber?: string;
  serialNumber?: string;
  name?: Array<{
    value?: string;
    type?: string;
    display?: boolean;
  }>;
  modelNumber?: string;
  partNumber?: string;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  type?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  version?: Array<{
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    component?: {
      system?: string;
      value?: string;
    };
    installDate?: string;
    value?: string;
  }>;
  conformsTo?: Array<{
    category?: {
      system?: string;
      code?: string;
      display?: string;
    };
    specification?: {
      system?: string;
      code?: string;
      display?: string;
    };
    version?: string;
  }>;
  property?: Array<{
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    valueQuantity?: {
      value?: number;
      unit?: string;
      system?: string;
      code?: string;
    };
    valueCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    valueString?: string;
    valueBoolean?: boolean;
    valueInteger?: number;
    valueRange?: {
      low?: { value?: number; unit?: string };
      high?: { value?: number; unit?: string };
    };
    valueAttachment?: {
      contentType?: string;
      url?: string;
      title?: string;
    };
  }>;
  mode?: {
    system?: string;
    code?: string;
    display?: string;
  };
  cycle?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  duration?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  owner?: string;
  contact?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  location?: string;
  url?: string;
  endpoint?: string[];
  gateway?: Array<{
    reference?: string;
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  note?: string[];
  safety?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  parent?: string;
};

export type CanonicalDeviceMetric = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  type?: {
    system?: string;
    code?: string;
    display?: string;
  };
  unit?: {
    system?: string;
    code?: string;
    display?: string;
  };
  device?: string;
  operationalStatus?: string;
  color?: string;
  category?: string;
  measurementFrequency?: {
    value?: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  calibration?: Array<{
    type?: string;
    state?: string;
    time?: string;
  }>;
};

export type CanonicalEndpoint = {
  id?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  status?: string;
  connectionType?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  name?: string;
  description?: string;
  environmentType?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  managingOrganization?: string;
  contact?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
  period?: {
    start?: string;
    end?: string;
  };
  payload?: Array<{
    type?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    mimeType?: string[];
  }>;
  address?: string;
  header?: string[];
};

export type CanonicalSchedule = {
  id?: string;
  identifier?: string;
  active?: boolean;
  serviceCategory?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  serviceType?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  specialty?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  name?: string;
  actor?: string[];
  planningHorizon?: {
    start?: string;
    end?: string;
  };
  comment?: string;
};

export type CanonicalSlot = {
  id?: string;
  identifier?: string;
  serviceCategory?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  serviceType?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  specialty?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  appointmentType?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  schedule?: string;
  status?: string;
  start?: string;
  end?: string;
  overbooked?: boolean;
  comment?: string;
  active?: boolean;
};

export type CanonicalDiagnosticReport = {
  id?: string;
  identifier?: string;
  status?: string;
  category?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  code?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: string;
  encounter?: string;
  effectiveDateTime?: string;
  effectivePeriod?: {
    start?: string;
    end?: string;
  };
  issued?: string;
  performer?: string[];
  resultsInterpreter?: string[];
  specimen?: string[];
  result?: string[];
  note?: string[];
  conclusion?: string;
  conclusionCode?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  active?: boolean;
};

export type CanonicalLocation = {
  id?: string;
  identifier?: string;
  status?: string;
  name?: string;
  alias?: string[];
  description?: string;
  mode?: string;
  type?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  address?: {
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  managingOrganization?: string;
  partOf?: string;
  position?: {
    longitude?: number;
    latitude?: number;
    altitude?: number;
  };
  active?: boolean;
};

export type CanonicalRelatedPerson = {
  id?: string;
  identifier?: string;
  active?: boolean;
  patient?: string;
  relationship?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  name?: Array<{
    family?: string;
    given?: string[];
  }>;
  telecom?: Array<{
    system: 'phone' | 'email' | 'fax' | 'url' | 'other';
    value: string;
    use?: string;
  }>;
  gender?: string;
  birthDate?: string;
  address?: Array<{
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    use?: string;
  }>;
  period?: {
    start?: string;
    end?: string;
  };
};

export type CanonicalEpisodeOfCare = {
  id?: string;
  identifier?: string;
  status?: string;
  statusHistory?: Array<{
    status?: string;
    period?: {
      start?: string;
      end?: string;
    };
  }>;
  type?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  reason?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  diagnosis?: Array<{
    condition?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  patient?: string;
  managingOrganization?: string;
  period?: {
    start?: string;
    end?: string;
  };
  referralRequest?: string[];
  careManager?: string;
  careTeam?: string[];
  account?: string[];
  active?: boolean;
};

export type CanonicalSpecimen = {
  id?: string;
  identifier?: string;
  accessionIdentifier?: string;
  status?: string;
  type?: {
    system?: string;
    code?: string;
    display?: string;
  };
  subject?: string;
  receivedTime?: string;
  parent?: string[];
  request?: string[];
  combined?: string;
  role?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  feature?: Array<{
    type?: {
      system?: string;
      code?: string;
      display?: string;
    };
    description?: string;
  }>;
  collection?: {
    collector?: string;
    collectedDateTime?: string;
    collectedPeriod?: {
      start?: string;
      end?: string;
    };
    duration?: {
      value?: number;
      unit?: string;
    };
    quantity?: {
      value?: number;
      unit?: string;
    };
    method?: {
      system?: string;
      code?: string;
      display?: string;
    };
    device?: string;
    procedure?: string;
    bodySite?: {
      system?: string;
      code?: string;
      display?: string;
    };
    fastingStatusCodeableConcept?: {
      system?: string;
      code?: string;
      display?: string;
    };
    fastingStatusDuration?: {
      value?: number;
      unit?: string;
    };
  };
  processing?: Array<{
    description?: string;
    method?: {
      system?: string;
      code?: string;
      display?: string;
    };
    additive?: string[];
    timeDateTime?: string;
    timePeriod?: {
      start?: string;
      end?: string;
    };
  }>;
  container?: Array<{
    device?: string;
    location?: string;
    specimenQuantity?: {
      value?: number;
      unit?: string;
    };
  }>;
  condition?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  note?: string[];
  active?: boolean;
};

export type CanonicalImagingStudy = {
  id?: string;
  identifier?: string;
  status?: string;
  modality?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  subject?: string;
  encounter?: string;
  started?: string;
  basedOn?: string[];
  partOf?: string[];
  referrer?: string;
  endpoint?: string[];
  numberOfSeries?: number;
  numberOfInstances?: number;
  procedure?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  location?: string;
  reason?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  note?: string[];
  description?: string;
  series?: Array<{
    uid?: string;
    number?: number;
    modality?: {
      system?: string;
      code?: string;
      display?: string;
    };
    description?: string;
    numberOfInstances?: number;
    endpoint?: string[];
    bodySite?: {
      system?: string;
      code?: string;
      display?: string;
    };
    laterality?: {
      system?: string;
      code?: string;
      display?: string;
    };
    specimen?: string[];
    started?: string;
    performer?: Array<{
      function?: {
        system?: string;
        code?: string;
        display?: string;
      };
      actor?: string;
    }>;
    instance?: Array<{
      uid?: string;
      sopClass?: {
        system?: string;
        code?: string;
        display?: string;
      };
      number?: number;
      title?: string;
    }>;
  }>;
  active?: boolean;
};

export type CanonicalImmunization = {
  id?: string;
  identifier?: string;
  basedOn?: string[];
  status?: string;
  statusReason?: {
    system?: string;
    code?: string;
    display?: string;
  };
  vaccineCode?: {
    system?: string;
    code?: string;
    display?: string;
  };
  administeredProduct?: string;
  manufacturer?: string;
  lotNumber?: string;
  expirationDate?: string;
  patient?: string;
  encounter?: string;
  supportingInformation?: string[];
  occurrenceDateTime?: string;
  occurrenceString?: string;
  primarySource?: boolean;
  informationSource?: string;
  location?: string;
  site?: {
    system?: string;
    code?: string;
    display?: string;
  };
  route?: {
    system?: string;
    code?: string;
    display?: string;
  };
  doseQuantity?: {
    value?: number;
    unit?: string;
  };
  performer?: Array<{
    function?: {
      system?: string;
      code?: string;
      display?: string;
    };
    actor?: string;
  }>;
  note?: string[];
  reason?: Array<{
    code?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  isSubpotent?: boolean;
  subpotentReason?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  programEligibility?: Array<{
    program?: {
      system?: string;
      code?: string;
      display?: string;
    };
    programStatus?: {
      system?: string;
      code?: string;
      display?: string;
    };
  }>;
  fundingSource?: {
    system?: string;
    code?: string;
    display?: string;
  };
  reaction?: Array<{
    date?: string;
    manifestation?: {
      system?: string;
      code?: string;
      display?: string;
    };
    reported?: boolean;
  }>;
  protocolApplied?: Array<{
    series?: string;
    authority?: string;
    targetDisease?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    doseNumber?: string;
    seriesDoses?: string;
  }>;
  active?: boolean;
};

export type CanonicalDocumentReference = {
  id?: string;
  identifier?: string;
  status?: string;
  type?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  category?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  subject?: string; // Patient reference
  date?: string;
  author?: Array<string>; // Practitioner/Organization references
  custodian?: string; // Organization reference
  content?: Array<{
    attachment?: {
      contentType?: string;
      url?: string;
      title?: string;
      data?: string;
      format?: string; // Legacy format hint (e.g., 'pdf', 'dicom', 'jpeg')
    };
  }>;
  description?: string;
  context?: {
    encounter?: Array<string>;
    period?: {
      start?: string;
      end?: string;
    };
  };
  active?: boolean;
};

export type CanonicalBinary = {
  id?: string;
  contentType?: string;
  securityContext?: string;
  data?: string;
};

export type CanonicalModel = {
  operation?: OperationType; // 'create' (ADT^A01), 'update' (ADT^A08), 'delete' (ADT^A08 with active: false)
  messageType?: string; // e.g., 'ADT^A01', 'ADT^A08'
  patient?: CanonicalPatient;
  encounter?: CanonicalEncounter;
  observations?: CanonicalObservation[];
  allergies?: CanonicalAllergy[];
  diagnoses?: CanonicalDiagnosis[];
  medications?: CanonicalMedication[]; // Medication resource (drug definition)
  medicationRequests?: CanonicalMedicationRequest[]; // MedicationRequest (prescription)
  medicationStatements?: CanonicalMedicationStatement[]; // MedicationStatement (usage)
  medicationAdministrations?: CanonicalMedicationAdministration[]; // MedicationAdministration
  medicationDispenses?: CanonicalMedicationDispense[]; // MedicationDispense
  organizationAffiliations?: CanonicalOrganizationAffiliation[]; // OrganizationAffiliation
  deviceDispenses?: CanonicalDeviceDispense[]; // DeviceDispense
  deviceRequests?: CanonicalDeviceRequest[]; // DeviceRequest
  deviceUsages?: CanonicalDeviceUsage[]; // DeviceUsage
  encounterHistories?: CanonicalEncounterHistory[]; // EncounterHistory
  flags?: CanonicalFlag[]; // Flag
  lists?: CanonicalList[]; // List
  groups?: CanonicalGroup[]; // Group
  healthcareServices?: CanonicalHealthcareService[]; // HealthcareService
  nutritionIntakes?: CanonicalNutritionIntake[]; // NutritionIntake
  nutritionOrders?: CanonicalNutritionOrder[]; // NutritionOrder
  riskAssessments?: CanonicalRiskAssessment[]; // RiskAssessment
  capabilityStatements?: CanonicalCapabilityStatement[]; // CapabilityStatement
  operationOutcomes?: CanonicalOperationOutcome[]; // OperationOutcome
  parameters?: CanonicalParameters[]; // Parameters
  carePlans?: CanonicalCarePlan[]; // CarePlan
  careTeams?: CanonicalCareTeam[]; // CareTeam
  goals?: CanonicalGoal[]; // Goal
  serviceRequests?: CanonicalServiceRequest[]; // ServiceRequest
  tasks?: CanonicalTask[]; // Task
  communications?: CanonicalCommunication[]; // Communication
  communicationRequests?: CanonicalCommunicationRequest[]; // CommunicationRequest
  questionnaires?: CanonicalQuestionnaire[]; // Questionnaire
  questionnaireResponses?: CanonicalQuestionnaireResponse[]; // QuestionnaireResponse
  codeSystems?: CanonicalCodeSystem[]; // CodeSystem
  valueSets?: CanonicalValueSet[]; // ValueSet
  conceptMaps?: CanonicalConceptMap[]; // ConceptMap
  namingSystems?: CanonicalNamingSystem[]; // NamingSystem
  terminologyCapabilities?: CanonicalTerminologyCapabilities[]; // TerminologyCapabilities
  provenances?: CanonicalProvenance[]; // Provenance
  auditEvents?: CanonicalAuditEvent[]; // AuditEvent
  consents?: CanonicalConsent[]; // Consent
  procedures?: CanonicalProcedure[]; // Procedure
  conditions?: CanonicalCondition[]; // Condition
  appointments?: CanonicalAppointment[]; // Appointment
  appointmentResponses?: CanonicalAppointmentResponse[]; // AppointmentResponse
  claims?: CanonicalClaim[]; // Claim
  claimResponses?: CanonicalClaimResponse[]; // ClaimResponse
  explanationOfBenefits?: CanonicalExplanationOfBenefit[]; // ExplanationOfBenefit
  compositions?: CanonicalComposition[]; // Composition
  coverages?: CanonicalCoverage[]; // Coverage
  accounts?: CanonicalAccount[]; // Account
  chargeItems?: CanonicalChargeItem[]; // ChargeItem
  chargeItemDefinitions?: CanonicalChargeItemDefinition[]; // ChargeItemDefinition
  devices?: CanonicalDevice[]; // Device
  deviceMetrics?: CanonicalDeviceMetric[]; // DeviceMetric
  endpoints?: CanonicalEndpoint[]; // Endpoint
  schedules?: CanonicalSchedule[]; // Schedule
  slots?: CanonicalSlot[]; // Slot
  diagnosticReports?: CanonicalDiagnosticReport[]; // DiagnosticReport
  relatedPersons?: CanonicalRelatedPerson[]; // RelatedPerson
  persons?: CanonicalPerson[]; // Person
  locations?: CanonicalLocation[]; // Location
  episodesOfCare?: CanonicalEpisodeOfCare[]; // EpisodeOfCare
  specimens?: CanonicalSpecimen[]; // Specimen
  imagingStudies?: CanonicalImagingStudy[]; // ImagingStudy
  allergyIntolerances?: CanonicalAllergyIntolerance[]; // AllergyIntolerance
  immunizations?: CanonicalImmunization[]; // Immunization
  practitioners?: CanonicalPractitioner[];
  practitionerRoles?: CanonicalPractitionerRole[];
  organizations?: CanonicalOrganization[];
  documentReferences?: CanonicalDocumentReference[];
  binaries?: CanonicalBinary[];
  sourcePayloads?: Record<string, unknown>;
};
