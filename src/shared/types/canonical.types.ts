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
  unit?: string;
  unitSystem?: string;
  unitCode?: string;
  referenceRange?: string;
  abnormalFlags?: string[];
  status?: string;
  date?: string;
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
    valueCodeableConcept?: any;
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
  procedures?: CanonicalProcedure[]; // Procedure
  conditions?: CanonicalCondition[]; // Condition
  appointments?: CanonicalAppointment[]; // Appointment
  schedules?: CanonicalSchedule[]; // Schedule
  slots?: CanonicalSlot[]; // Slot
  diagnosticReports?: CanonicalDiagnosticReport[]; // DiagnosticReport
  relatedPersons?: CanonicalRelatedPerson[]; // RelatedPerson
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
};
