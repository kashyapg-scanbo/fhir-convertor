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
  procedures?: CanonicalProcedure[]; // Procedure
  conditions?: CanonicalCondition[]; // Condition
  practitioners?: CanonicalPractitioner[];
  practitionerRoles?: CanonicalPractitionerRole[];
  organizations?: CanonicalOrganization[];
  documentReferences?: CanonicalDocumentReference[];
};
