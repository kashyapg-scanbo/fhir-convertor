
import { XMLParser } from 'fast-xml-parser';
import {
    CanonicalModel,
    CanonicalPatient,
    CanonicalEncounter,
    CanonicalPractitioner,
    CanonicalPractitionerRole,
    CanonicalOrganization,
    CanonicalObservation,
    CanonicalMedication,
    CanonicalMedicationRequest,
    CanonicalMedicationStatement,
    CanonicalMedicationAdministration,
    CanonicalMedicationDispense,
    CanonicalProcedure,
    CanonicalCondition,
    CanonicalAppointment,
    CanonicalSchedule,
    CanonicalSlot,
    CanonicalDiagnosticReport,
    CanonicalRelatedPerson,
    CanonicalLocation,
    CanonicalEpisodeOfCare,
    CanonicalSpecimen,
    CanonicalImagingStudy,
    CanonicalAllergyIntolerance,
    CanonicalImmunization,
    CanonicalCapabilityStatement,
    CanonicalOperationOutcome,
    CanonicalParameters,
    CanonicalCarePlan,
    CanonicalCareTeam,
    CanonicalGoal,
    CanonicalServiceRequest,
    CanonicalTask,
    CanonicalCommunication,
    CanonicalCommunicationRequest,
    CanonicalQuestionnaire,
    CanonicalQuestionnaireResponse,
    CanonicalCodeSystem,
    CanonicalValueSet,
    CanonicalConceptMap,
    CanonicalNamingSystem,
    CanonicalTerminologyCapabilities,
    CanonicalProvenance,
    CanonicalAuditEvent,
    CanonicalConsent
} from '../../shared/types/canonical.types.js';

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text'
});

/**
 * Parse generic HL7 v3 XML messages (PRPA, etc.) into Canonical Model
 * Note: This is a best-effort parser for generic V3 messages
 */
export function parseHL7v3(input: string): CanonicalModel {
    let xml: any;
    try {
        xml = parser.parse(input);
    } catch (e) {
        throw new Error('Invalid XML input for HL7v3 parser');
    }

    // Detect root element name (skip XML declarations / processing instructions)
    const rootKey = Object.keys(xml).find(key => !key.startsWith('?'));
    const root = rootKey ? xml[rootKey] : undefined;

    if (!root) {
        throw new Error('Empty or invalid HL7v3 message');
    }

    const model: CanonicalModel = {
        messageType: rootKey,
        patient: { name: {} }, // Default
        observations: [],
        medications: [],
        medicationRequests: [],
        medicationStatements: [],
        medicationAdministrations: [],
        medicationDispenses: [],
        procedures: [],
        conditions: [],
        appointments: [],
        schedules: [],
        slots: [],
        diagnosticReports: [],
        relatedPersons: [],
        locations: [],
        episodesOfCare: [],
        specimens: [],
        imagingStudies: [],
        allergyIntolerances: [],
        immunizations: [],
        capabilityStatements: [],
        operationOutcomes: [],
        parameters: [],
        carePlans: [],
        careTeams: [],
        goals: [],
        serviceRequests: [],
        tasks: [],
        communications: [],
        communicationRequests: [],
        questionnaires: [],
        questionnaireResponses: [],
        codeSystems: [],
        valueSets: [],
        conceptMaps: [],
        namingSystems: [],
        terminologyCapabilities: [],
        provenances: [],
        auditEvents: [],
        consents: [],
        practitioners: [],
        practitionerRoles: [],
        organizations: [],
        documentReferences: [],
        allergies: [],
        diagnoses: []
    };

    const controlAct = root.controlActProcess || root.ControlActProcess;
    if (controlAct) {
        const subject = controlAct.subject || controlAct.Subject;
        const subjects = Array.isArray(subject) ? subject : [subject];

        for (const sub of subjects) {
            if (!sub) continue;

            const registrationEvent = sub.registrationEvent || sub.RegistrationEvent;
            if (registrationEvent) {
                const ptSubject = registrationEvent.subject1 || registrationEvent.Subject1;
                const patient = ptSubject?.patient || ptSubject?.Patient;
                if (patient) {
                    model.patient = mapV3Patient(patient);
                }

                const custodian = registrationEvent.custodian || registrationEvent.Custodian;
                if (custodian) {
                    const org = mapV3Organization(custodian);
                    if (org) model.organizations?.push(org);
                }
            }

            const encounterEvent = sub.encounterEvent || sub.EncounterEvent;
            if (encounterEvent) {
                const encounter = mapV3Encounter(encounterEvent);
                if (encounter) model.encounter = encounter;
                const location = mapV3LocationFromEncounter(encounterEvent);
                if (location) model.locations?.push(location);
                const episode = mapV3EpisodeOfCareFromEncounter(encounterEvent);
                if (episode) model.episodesOfCare?.push(episode);

                const responsibleParty = encounterEvent.responsibleParty || encounterEvent.ResponsibleParty;
                if (responsibleParty) {
                    const pract = mapV3PractitionerFromResponsible(responsibleParty);
                    if (pract) model.practitioners?.push(pract);

                    const role = mapV3PractitionerRoleFromResponsible(responsibleParty);
                    if (role) model.practitionerRoles?.push(role);
                }
            }

            const observationEvent = sub.observationEvent || sub.ObservationEvent;
            if (observationEvent) {
                const obs = mapV3Observation(observationEvent);
                if (obs) model.observations?.push(obs);
            }

            const conditionEvent = sub.condition || sub.Condition;
            if (conditionEvent) {
                const condition = mapV3Condition(conditionEvent);
                if (condition) model.conditions?.push(condition);
            } else if (observationEvent && (observationEvent['@_classCode'] || observationEvent.ObservationEvent?.['@_classCode']) === 'COND') {
                const condition = mapV3Condition(observationEvent);
                if (condition) model.conditions?.push(condition);
            }

            const appointmentEvent = sub.appointment || sub.Appointment;
            if (appointmentEvent) {
                const appointment = mapV3Appointment(appointmentEvent);
                if (appointment) model.appointments?.push(appointment);
            }

            const carePlanEvent = sub.carePlan || sub.CarePlan;
            if (carePlanEvent) {
                const carePlan = mapV3CarePlan(carePlanEvent);
                if (carePlan) model.carePlans?.push(carePlan);
            }

            const careTeamEvent = sub.careTeam || sub.CareTeam;
            if (careTeamEvent) {
                const careTeam = mapV3CareTeam(careTeamEvent);
                if (careTeam) model.careTeams?.push(careTeam);
            }

            const goalEvent = sub.goal || sub.Goal;
            if (goalEvent) {
                const goal = mapV3Goal(goalEvent);
                if (goal) model.goals?.push(goal);
            }

            const serviceRequestEvent = sub.serviceRequest || sub.ServiceRequest;
            if (serviceRequestEvent) {
                const serviceRequest = mapV3ServiceRequest(serviceRequestEvent);
                if (serviceRequest) model.serviceRequests?.push(serviceRequest);
            }

            const taskEvent = sub.task || sub.Task;
            if (taskEvent) {
                const task = mapV3Task(taskEvent);
                if (task) model.tasks?.push(task);
            }

            const communicationEvent = sub.communication || sub.Communication;
            if (communicationEvent) {
                const communication = mapV3Communication(communicationEvent);
                if (communication) model.communications?.push(communication);
            }

            const communicationRequestEvent = sub.communicationRequest || sub.CommunicationRequest;
            if (communicationRequestEvent) {
                const communicationRequest = mapV3CommunicationRequest(communicationRequestEvent);
                if (communicationRequest) model.communicationRequests?.push(communicationRequest);
            }

            const questionnaireEvent = sub.questionnaire || sub.Questionnaire;
            if (questionnaireEvent) {
                const questionnaire = mapV3Questionnaire(questionnaireEvent);
                if (questionnaire) model.questionnaires?.push(questionnaire);
            }

            const questionnaireResponseEvent = sub.questionnaireResponse || sub.QuestionnaireResponse;
            if (questionnaireResponseEvent) {
                const questionnaireResponse = mapV3QuestionnaireResponse(questionnaireResponseEvent);
                if (questionnaireResponse) model.questionnaireResponses?.push(questionnaireResponse);
            }

            const codeSystemEvent = sub.codeSystem || sub.CodeSystem;
            if (codeSystemEvent) {
                const codeSystem = mapV3CodeSystem(codeSystemEvent);
                if (codeSystem) model.codeSystems?.push(codeSystem);
            }

            const valueSetEvent = sub.valueSet || sub.ValueSet;
            if (valueSetEvent) {
                const valueSet = mapV3ValueSet(valueSetEvent);
                if (valueSet) model.valueSets?.push(valueSet);
            }

            const conceptMapEvent = sub.conceptMap || sub.ConceptMap;
            if (conceptMapEvent) {
                const conceptMap = mapV3ConceptMap(conceptMapEvent);
                if (conceptMap) model.conceptMaps?.push(conceptMap);
            }

            const namingSystemEvent = sub.namingSystem || sub.NamingSystem;
            if (namingSystemEvent) {
                const namingSystem = mapV3NamingSystem(namingSystemEvent);
                if (namingSystem) model.namingSystems?.push(namingSystem);
            }

            const terminologyCapabilitiesEvent = sub.terminologyCapabilities || sub.TerminologyCapabilities;
            if (terminologyCapabilitiesEvent) {
                const terminologyCapabilities = mapV3TerminologyCapabilities(terminologyCapabilitiesEvent);
                if (terminologyCapabilities) model.terminologyCapabilities?.push(terminologyCapabilities);
            }

            const provenanceEvent = sub.provenance || sub.Provenance;
            if (provenanceEvent) {
                const provenance = mapV3Provenance(provenanceEvent);
                if (provenance) model.provenances?.push(provenance);
            }

            const auditEvent = sub.auditEvent || sub.AuditEvent;
            if (auditEvent) {
                const audit = mapV3AuditEvent(auditEvent);
                if (audit) model.auditEvents?.push(audit);
            }

            const consentEvent = sub.consent || sub.Consent;
            if (consentEvent) {
                const consent = mapV3Consent(consentEvent);
                if (consent) model.consents?.push(consent);
            }

            const scheduleEvent = sub.schedule || sub.Schedule;
            if (scheduleEvent) {
                const schedule = mapV3Schedule(scheduleEvent);
                if (schedule) model.schedules?.push(schedule);
                const slot = mapV3Slot(scheduleEvent);
                if (slot) model.slots?.push(slot);
            }

            const diagnosticReportEvent = sub.diagnosticReport || sub.DiagnosticReport;
            if (diagnosticReportEvent) {
                const report = mapV3DiagnosticReport(diagnosticReportEvent);
                if (report) model.diagnosticReports?.push(report);
            }

            const relatedPersonEvent = sub.relatedPerson || sub.RelatedPerson;
            if (relatedPersonEvent) {
                const related = mapV3RelatedPerson(relatedPersonEvent);
                if (related) model.relatedPersons?.push(related);
            }

            const substanceAdministration = sub.substanceAdministration || sub.SubstanceAdministration;
            if (substanceAdministration) {
                const { medication, medicationRequest, medicationStatement } = mapV3Medication(substanceAdministration);
                if (medication) model.medications?.push(medication);
                if (medicationRequest) model.medicationRequests?.push(medicationRequest);
                if (medicationStatement) model.medicationStatements?.push(medicationStatement);

                const immunization = mapV3Immunization(substanceAdministration);
                if (immunization) model.immunizations?.push(immunization);

                const medicationAdministration = mapV3MedicationAdministration(substanceAdministration);
                if (medicationAdministration) model.medicationAdministrations?.push(medicationAdministration);

                const medicationDispense = mapV3MedicationDispense(substanceAdministration);
                if (medicationDispense) model.medicationDispenses?.push(medicationDispense);
            }

            const procedureEvent = sub.procedure || sub.Procedure;
            if (procedureEvent) {
                const procedure = mapV3Procedure(procedureEvent);
                if (procedure) model.procedures?.push(procedure);
            }

            const specimenEvent = sub.specimen || sub.Specimen;
            if (specimenEvent) {
                const specimen = mapV3Specimen(specimenEvent);
                if (specimen) model.specimens?.push(specimen);
            }

            const imagingEvent = sub.imagingStudy || sub.ImagingStudy;
            if (imagingEvent) {
                const imagingStudy = mapV3ImagingStudy(imagingEvent);
                if (imagingStudy) model.imagingStudies?.push(imagingStudy);
            }

            const allergyEvent = sub.allergyIntolerance || sub.AllergyIntolerance;
            if (allergyEvent) {
                const allergy = mapV3AllergyIntolerance(allergyEvent);
                if (allergy) model.allergyIntolerances?.push(allergy);
            }
        }
    }

    const author = root.author || root.Author;
    if (author) {
        const authors = Array.isArray(author) ? author : [author];
        for (const auth of authors) {
            const assignedAuthor = auth.assignedAuthor || auth.AssignedAuthor;
            if (assignedAuthor) {
                const pract = mapV3Practitioner(assignedAuthor);
                if (pract) model.practitioners?.push(pract);

                const org = mapV3OrganizationFromAssigned(assignedAuthor);
                if (org) model.organizations?.push(org);

                const role = mapV3PractitionerRoleFromAssigned(assignedAuthor);
                if (role) model.practitionerRoles?.push(role);
            }
        }
    }

    const capability = mapV3CapabilityStatement(root);
    if (capability) {
        model.capabilityStatements?.push(capability);
    }

    const operationOutcome = mapV3OperationOutcome(root);
    if (operationOutcome) {
        model.operationOutcomes?.push(operationOutcome);
    }

    const parameters = mapV3Parameters(root);
    if (parameters) {
        model.parameters?.push(parameters);
    }

    return model;
}

function mapV3Patient(pt: any): CanonicalPatient {
    const person = pt.patientPerson || pt.PatientPerson;
    const name = person?.name || person?.Name;
    const addr = pt.addr || pt.Addr;
    const telecom = pt.telecom || pt.Telecom;

    let family = '';
    let given: string[] = [];

    if (Array.isArray(name)) {
        const primaryName = name[0];
        family = extractText(primaryName?.family || primaryName?.Family);
        const givenParts = primaryName?.given || primaryName?.Given;
        given = Array.isArray(givenParts)
            ? givenParts.map(extractText).filter(Boolean)
            : givenParts ? [extractText(givenParts)] : [];
    } else if (name) {
        family = extractText(name.family || name.Family);
        const givenParts = name.given || name.Given;
        given = Array.isArray(givenParts)
            ? givenParts.map(extractText).filter(Boolean)
            : givenParts ? [extractText(givenParts)] : [];
    }

    const ids = pt.id || pt.Id;
    const idInfo = pickV3Id(ids);
    const genderCode = person?.administrativeGenderCode?.['@_code'];

    return {
        id: idInfo.id,
        identifier: idInfo.identifier,
        name: {
            family: family,
            given: given
        },
        gender: mapGenderCode(genderCode),
        birthDate: formatV3Date(person?.birthTime?.['@_value']),
        address: addr ? mapV3Addresses(addr) : undefined,
        telecom: telecom ? mapV3Telecom(telecom) : undefined,
        active: pt.statusCode?.['@_code'] === 'active'
    };
}

function mapV3Encounter(encounterEvent: any): CanonicalEncounter | undefined {
    const ids = encounterEvent.id || encounterEvent.Id;
    const idInfo = pickV3Id(ids);

    const code = encounterEvent.code || encounterEvent.Code;
    const encounterClass = code?.['@_code'];

    const effectiveTime = encounterEvent.effectiveTime || encounterEvent.EffectiveTime;
    const startTime = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];

    const location = encounterEvent.location || encounterEvent.Location;
    const facility = location?.healthCareFacility || location?.HealthCareFacility;
    const locationDetail = facility?.location || facility?.Location;

    let locationStr = '';
    if (locationDetail) {
        const parts = [];
        if (locationDetail.pointOfCare) parts.push(extractText(locationDetail.pointOfCare));
        if (locationDetail.room) parts.push('Room ' + extractText(locationDetail.room));
        if (locationDetail.bed) parts.push('Bed ' + extractText(locationDetail.bed));
        locationStr = parts.join(', ');
    }

    const status = mapEncounterStatus(encounterEvent.statusCode?.['@_code']);
    const responsibleParty = encounterEvent.responsibleParty || encounterEvent.ResponsibleParty;
    const assignedEntity = responsibleParty?.assignedEntity || responsibleParty?.AssignedEntity;
    const assignedEntityIdInfo = assignedEntity ? pickV3Id(assignedEntity.id || assignedEntity.Id) : { id: undefined, identifier: undefined };
    const representedOrg = assignedEntity?.representedOrganization || assignedEntity?.RepresentedOrganization;
    const representedOrgIdInfo = representedOrg ? pickV3Id(representedOrg.id || representedOrg.Id) : { id: undefined, identifier: undefined };
    const participantId = assignedEntityIdInfo.identifier || assignedEntityIdInfo.id;

    return {
        id: idInfo.id,
        class: mapEncounterClass(encounterClass),
        status: status,
        start: formatV3DateTime(startTime),
        location: locationStr || undefined,
        participantPractitionerIds: participantId ? [participantId] : undefined,
        serviceProviderOrganizationId: representedOrgIdInfo.identifier || representedOrgIdInfo.id
    };
}

function mapV3EpisodeOfCareFromEncounter(encounterEvent: any): CanonicalEpisodeOfCare | undefined {
    const ids = encounterEvent.id || encounterEvent.Id;
    const idInfo = pickV3Id(ids);
    const effectiveTime = encounterEvent.effectiveTime || encounterEvent.EffectiveTime;
    const startTime = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const endTime = effectiveTime?.high?.['@_value'];
    const status = mapEpisodeOfCareStatus(encounterEvent.statusCode?.['@_code']);

    if (!idInfo.id && !idInfo.identifier && !startTime && !endTime) return undefined;

    return {
        id: idInfo.id,
        identifier: idInfo.identifier || idInfo.id,
        status: status,
        patient: encounterEvent.subject?.patient?.id?.['@_extension'],
        period: startTime || endTime ? {
            start: formatV3DateTime(startTime),
            end: formatV3DateTime(endTime)
        } : undefined
    };
}

function mapV3Specimen(specimenEvent: any): CanonicalSpecimen | undefined {
    const specimen = specimenEvent.specimenRole || specimenEvent.SpecimenRole || specimenEvent;
    const idInfo = pickV3Id(specimen.id || specimen.Id);
    const playing = specimen.specimenPlayingEntity || specimen.SpecimenPlayingEntity;
    const code = playing?.code || playing?.Code || specimen.code || specimen.Code;
    const receivedTime = specimen.receivedTime?.['@_value'] || specimen.ReceivedTime?.['@_value'];
    const collectedTime = specimen.effectiveTime?.['@_value'] || specimen.EffectiveTime?.['@_value'];

    if (!idInfo.id && !idInfo.identifier && !code?.['@_code'] && !code?.['@_displayName']) return undefined;

    return {
        id: idInfo.id,
        identifier: idInfo.identifier || idInfo.id,
        status: 'available',
        type: (code?.['@_code'] || code?.['@_displayName']) ? {
            system: code?.['@_codeSystem'],
            code: code?.['@_code'],
            display: code?.['@_displayName']
        } : undefined,
        receivedTime: formatV3DateTime(receivedTime),
        collection: collectedTime ? {
            collectedDateTime: formatV3DateTime(collectedTime)
        } : undefined
    };
}

function mapV3ImagingStudy(imagingEvent: any): CanonicalImagingStudy | undefined {
    const study = imagingEvent.imagingStudy || imagingEvent.ImagingStudy || imagingEvent;
    const idInfo = pickV3Id(study.id || study.Id);
    const code = study.code || study.Code;
    const effectiveTime = study.effectiveTime || study.EffectiveTime;
    const started = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const status = study.statusCode?.['@_code'];

    if (!idInfo.id && !idInfo.identifier && !code?.['@_code'] && !code?.['@_displayName']) return undefined;

    return {
        id: idInfo.id,
        identifier: idInfo.identifier || idInfo.id,
        status: status || 'available',
        modality: (code?.['@_code'] || code?.['@_displayName']) ? [{
            system: code?.['@_codeSystem'],
            code: code?.['@_code'],
            display: code?.['@_displayName']
        }] : undefined,
        started: formatV3DateTime(started),
        description: code?.['@_displayName']
    };
}

function mapV3AllergyIntolerance(allergyEvent: any): CanonicalAllergyIntolerance | undefined {
    const allergy = allergyEvent.observation || allergyEvent.Observation || allergyEvent;
    const idInfo = pickV3Id(allergy.id || allergy.Id);
    const code = allergy.code || allergy.Code;
    const value = allergy.value || allergy.Value;

    const codeValue = value?.['@_code'] || code?.['@_code'];
    const codeSystem = value?.['@_codeSystem'] || code?.['@_codeSystem'];
    const display = value?.['@_displayName'] || code?.['@_displayName'];

    const onset = allergy.effectiveTime?.['@_value'] || allergy.EffectiveTime?.['@_value'];

    if (!idInfo.id && !idInfo.identifier && !codeValue && !display) return undefined;

    return {
        id: idInfo.id,
        identifier: idInfo.identifier || idInfo.id,
        clinicalStatus: { code: 'active', display: 'active' },
        verificationStatus: { code: 'confirmed', display: 'confirmed' },
        code: codeValue || display ? {
            system: codeSystem,
            code: codeValue,
            display: display
        } : undefined,
        onsetDateTime: formatV3DateTime(onset)
    };
}

function mapV3LocationFromEncounter(encounterEvent: any): CanonicalLocation | undefined {
    const location = encounterEvent.location || encounterEvent.Location;
    const facility = location?.healthCareFacility || location?.HealthCareFacility;
    const locationDetail = facility?.location || facility?.Location;

    if (!locationDetail && !facility) return undefined;

    const idInfo = pickV3Id(locationDetail?.id || locationDetail?.Id || facility?.id || facility?.Id);
    const name =
        extractText(locationDetail?.name || locationDetail?.Name) ||
        extractText(facility?.name || facility?.Name) ||
        extractText(locationDetail?.code?.displayName || locationDetail?.Code?.displayName);
    const statusCode = locationDetail?.statusCode || locationDetail?.StatusCode;
    const status = statusCode?.['@_code'];
    const addressNode = locationDetail?.addr || locationDetail?.Addr || facility?.addr || facility?.Addr;
    const address = addressNode ? mapV3Addresses(addressNode)?.[0] : undefined;

    const pointOfCare = extractText(locationDetail?.pointOfCare || locationDetail?.PointOfCare);
    const room = extractText(locationDetail?.room || locationDetail?.Room);
    const bed = extractText(locationDetail?.bed || locationDetail?.Bed);
    const description = [pointOfCare, room && `Room ${room}`, bed && `Bed ${bed}`]
        .filter(Boolean)
        .join(', ');

    if (!idInfo.id && !idInfo.identifier && !name && !description && !address) return undefined;

    return {
        id: idInfo.id,
        identifier: idInfo.identifier || idInfo.id,
        status: status || undefined,
        name: name || description || undefined,
        description: description || undefined,
        address
    };
}

function mapV3Practitioner(assignedAuthor: any): CanonicalPractitioner | undefined {
    const person = assignedAuthor.assignedPerson || assignedAuthor.AssignedPerson;
    if (!person) return undefined;

    const name = person.name || person.Name;
    const ids = assignedAuthor.id || assignedAuthor.Id;
    const idInfo = pickV3Id(ids);
    const telecom = assignedAuthor.telecom || assignedAuthor.Telecom;
    const addr = assignedAuthor.addr || assignedAuthor.Addr;

    let family = '';
    let given: string[] = [];
    let prefix: string[] = [];
    let suffix: string[] = [];

    if (name) {
        family = extractText(name.family || name.Family);
        const givenParts = name.given || name.Given;
        given = Array.isArray(givenParts)
            ? givenParts.map(extractText).filter(Boolean)
            : givenParts ? [extractText(givenParts)] : [];
        const prefixParts = name.prefix || name.Prefix;
        prefix = Array.isArray(prefixParts)
            ? prefixParts.map(extractText).filter(Boolean)
            : prefixParts ? [extractText(prefixParts)] : [];
        const suffixParts = name.suffix || name.Suffix;
        suffix = Array.isArray(suffixParts)
            ? suffixParts.map(extractText).filter(Boolean)
            : suffixParts ? [extractText(suffixParts)] : [];
    }

    return {
        id: idInfo.id,
        identifier: idInfo.identifier,
        name: {
            family: family,
            given: given,
            prefix: prefix,
            suffix: suffix
        },
        telecom: telecom ? mapV3Telecom(telecom) : undefined,
        address: addr ? mapV3Addresses(addr) : undefined
    };
}

function mapV3PractitionerFromResponsible(responsibleParty: any): CanonicalPractitioner | undefined {
    const assignedEntity = responsibleParty.assignedEntity || responsibleParty.AssignedEntity;
    if (!assignedEntity) return undefined;

    const person = assignedEntity.assignedPerson || assignedEntity.AssignedPerson;
    if (!person) return undefined;

    const name = person.name || person.Name;
    const ids = assignedEntity.id || assignedEntity.Id;
    const idInfo = pickV3Id(ids);
    const telecom = assignedEntity.telecom || assignedEntity.Telecom;
    const addr = assignedEntity.addr || assignedEntity.Addr;

    let family = '';
    let given: string[] = [];
    let prefix: string[] = [];
    let suffix: string[] = [];

    if (name) {
        family = extractText(name.family || name.Family);
        const givenParts = name.given || name.Given;
        given = Array.isArray(givenParts)
            ? givenParts.map(extractText).filter(Boolean)
            : givenParts ? [extractText(givenParts)] : [];
        const prefixParts = name.prefix || name.Prefix;
        prefix = Array.isArray(prefixParts)
            ? prefixParts.map(extractText).filter(Boolean)
            : prefixParts ? [extractText(prefixParts)] : [];
        const suffixParts = name.suffix || name.Suffix;
        suffix = Array.isArray(suffixParts)
            ? suffixParts.map(extractText).filter(Boolean)
            : suffixParts ? [extractText(suffixParts)] : [];
    }

    return {
        id: idInfo.id,
        identifier: idInfo.identifier,
        name: {
            family: family,
            given: given,
            prefix: prefix,
            suffix: suffix
        },
        telecom: telecom ? mapV3Telecom(telecom) : undefined,
        address: addr ? mapV3Addresses(addr) : undefined
    };
}

function mapV3Organization(custodian: any): CanonicalOrganization | undefined {
    const assignedCustodian = custodian.assignedCustodian || custodian.AssignedCustodian;
    const org = assignedCustodian?.representedCustodianOrganization ||
        assignedCustodian?.RepresentedCustodianOrganization;

    if (!org) return undefined;
    return mapV3OrganizationNode(org);
}

function mapV3OrganizationFromAssigned(assignedAuthor: any): CanonicalOrganization | undefined {
    const org = assignedAuthor.representedOrganization || assignedAuthor.RepresentedOrganization;
    if (!org) return undefined;

    return mapV3OrganizationNode(org);
}

function mapV3Observation(obsEvent: any): CanonicalObservation | undefined {
    const obs = obsEvent.observation || obsEvent.Observation;
    if (!obs) return undefined;

    const code = obs.code || obs.Code;
    const value = obs.value || obs.Value;
    const effectiveTime = obs.effectiveTime || obs.EffectiveTime;
    const performer = obs.performer || obs.Performer;
    const method = obs.methodCode || obs.MethodCode;
    const targetSite = obs.targetSiteCode || obs.TargetSiteCode;

    return {
        code: {
            system: code?.['@_codeSystem'],
            code: code?.['@_code'],
            display: code?.['@_displayName']
        },
        value: readV3Value(value),
        unit: value?.['@_unit'],
        status: 'final',
        date: formatV3DateTime(effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value']),
        method: method ? {
            code: method?.['@_code'],
            description: method?.['@_displayName']
        } : undefined,
        site: targetSite ? {
            code: targetSite?.['@_code'],
            display: targetSite?.['@_displayName']
        } : undefined,
        observer: mapV3Observers(performer)
    };
}

function mapV3Medication(substanceAdmin: any): { medication?: CanonicalMedication, medicationRequest?: CanonicalMedicationRequest, medicationStatement?: CanonicalMedicationStatement } {
    const consumable = substanceAdmin.consumable || substanceAdmin.Consumable;
    const manufacturedProduct = consumable?.manufacturedProduct || consumable?.ManufacturedProduct;
    const manufacturedMaterial = manufacturedProduct?.manufacturedMaterial || manufacturedProduct?.ManufacturedMaterial;
    const code = manufacturedMaterial?.code || manufacturedMaterial?.Code;

    const medCode = code?.['@_code'];
    const medDisplay = code?.['@_displayName'];

    if (!medCode) return {};

    const medication: CanonicalMedication = {
        id: medCode,
        identifier: medCode,
        code: {
            coding: [{
                system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
                code: medCode,
                display: medDisplay
            }],
            text: medDisplay
        }
    };

    const medicationRequest: CanonicalMedicationRequest = {
        id: `MEDREQ-${medCode}`,
        status: 'active',
        intent: 'order',
        medicationReference: medCode
    };

    const medicationStatement: CanonicalMedicationStatement = {
        id: `MEDSTAT-${medCode}`,
        identifier: medCode,
        status: 'recorded',
        medicationReference: medCode,
        effectiveDateTime: formatV3DateTime(substanceAdmin.effectiveTime?.['@_value'] || substanceAdmin.EffectiveTime?.['@_value'])
    };

    const dose = substanceAdmin.doseQuantity || substanceAdmin.DoseQuantity;
    const route = substanceAdmin.routeCode || substanceAdmin.RouteCode;
    const timing = substanceAdmin.effectiveTime || substanceAdmin.EffectiveTime;
    if (dose || route || timing) {
        const doseQuantity = dose ? {
            value: dose?.['@_value'] ? Number(dose['@_value']) : undefined,
            unit: dose?.['@_unit']
        } : undefined;
        medicationRequest.dosageInstruction = [{
            text: buildV3DoseText(dose, route),
            timing: timing ? { event: [formatV3DateTime(timing?.['@_value'] || timing?.low?.['@_value'])].filter(Boolean) } : undefined,
            doseQuantity: doseQuantity,
            route: route ? {
                coding: [{
                    code: route?.['@_code'],
                    display: route?.['@_displayName']
                }]
            } : undefined
        }];

        medicationStatement.dosage = [{
            text: buildV3DoseText(dose, route),
            timing: timing ? { event: [formatV3DateTime(timing?.['@_value'] || timing?.low?.['@_value'])].filter(Boolean) } : undefined,
            doseQuantity: doseQuantity,
            route: route ? {
                coding: [{
                    code: route?.['@_code'],
                    display: route?.['@_displayName']
                }]
            } : undefined
        }];
    }

    return { medication, medicationRequest, medicationStatement };
}

function mapV3MedicationAdministration(substanceAdmin: any): CanonicalMedicationAdministration | undefined {
    const consumable = substanceAdmin.consumable || substanceAdmin.Consumable;
    const manufacturedProduct = consumable?.manufacturedProduct || consumable?.ManufacturedProduct;
    const manufacturedMaterial = manufacturedProduct?.manufacturedMaterial || manufacturedProduct?.ManufacturedMaterial;
    const code = manufacturedMaterial?.code || manufacturedMaterial?.Code;

    const medCode = code?.['@_code'];
    const medDisplay = code?.['@_displayName'];
    const medSystem = code?.['@_codeSystem'];

    if (!medCode && !medDisplay) return undefined;

    const status = substanceAdmin.statusCode?.['@_code'] || 'completed';
    const occurrence = formatV3DateTime(
        substanceAdmin.effectiveTime?.['@_value'] ||
        substanceAdmin.EffectiveTime?.['@_value'] ||
        substanceAdmin.effectiveTime?.low?.['@_value']
    );

    const dose = substanceAdmin.doseQuantity || substanceAdmin.DoseQuantity;
    const route = substanceAdmin.routeCode || substanceAdmin.RouteCode;

    return {
        id: `MEDADMIN-${medCode || Date.now()}`,
        identifier: medCode,
        status,
        medicationCodeableConcept: medCode || medDisplay ? {
            coding: medCode ? [{
                system: medSystem,
                code: medCode,
                display: medDisplay
            }] : undefined,
            text: medDisplay
        } : undefined,
        occurrenceDateTime: occurrence,
        dosage: (dose || route) ? {
            text: buildV3DoseText(dose, route),
            route: route ? {
                system: route?.['@_codeSystem'],
                code: route?.['@_code'],
                display: route?.['@_displayName']
            } : undefined,
            dose: dose?.['@_value'] ? {
                value: Number(dose['@_value']),
                unit: dose?.['@_unit']
            } : undefined
        } : undefined
    };
}

function mapV3MedicationDispense(substanceAdmin: any): CanonicalMedicationDispense | undefined {
    const consumable = substanceAdmin.consumable || substanceAdmin.Consumable;
    const manufacturedProduct = consumable?.manufacturedProduct || consumable?.ManufacturedProduct;
    const manufacturedMaterial = manufacturedProduct?.manufacturedMaterial || manufacturedProduct?.ManufacturedMaterial;
    const code = manufacturedMaterial?.code || manufacturedMaterial?.Code;

    const medCode = code?.['@_code'];
    const medDisplay = code?.['@_displayName'];
    const medSystem = code?.['@_codeSystem'];

    if (!medCode && !medDisplay) return undefined;

    const status = substanceAdmin.statusCode?.['@_code'] || 'completed';
    const whenHandedOver = formatV3DateTime(
        substanceAdmin.effectiveTime?.['@_value'] ||
        substanceAdmin.EffectiveTime?.['@_value'] ||
        substanceAdmin.effectiveTime?.low?.['@_value']
    );

    const dose = substanceAdmin.doseQuantity || substanceAdmin.DoseQuantity;

    return {
        id: `MEDDISP-${medCode || Date.now()}`,
        identifier: medCode,
        status,
        medicationCodeableConcept: medCode || medDisplay ? {
            coding: medCode ? [{
                system: medSystem,
                code: medCode,
                display: medDisplay
            }] : undefined,
            text: medDisplay
        } : undefined,
        whenHandedOver,
        quantity: dose?.['@_value'] ? {
            value: Number(dose['@_value']),
            unit: dose?.['@_unit']
        } : undefined
    };
}

function mapV3CapabilityStatement(root: any): CanonicalCapabilityStatement | undefined {
    const id = root?.id?.['@_extension'] || root?.id?.['@_root'];
    const interactionId = root?.interactionId?.['@_extension'];
    const creationTime = root?.creationTime?.['@_value'];

    if (!interactionId && !id) return undefined;

    return {
        id: id || interactionId,
        url: interactionId ? `urn:hl7v3:${interactionId}` : undefined,
        name: interactionId || undefined,
        title: interactionId || undefined,
        status: 'active',
        date: formatV3DateTime(creationTime),
        kind: 'instance',
        fhirVersion: '5.0.0',
        format: ['xml']
    };
}

function mapV3OperationOutcome(root: any): CanonicalOperationOutcome | undefined {
    const acknowledgement = root.acknowledgement || root.Acknowledgement;
    const details = acknowledgement?.acknowledgementDetail || acknowledgement?.AcknowledgementDetail;
    const detailList = Array.isArray(details) ? details : details ? [details] : [];

    if (!detailList.length) return undefined;

    const issues = detailList.map((detail: any) => {
        const typeCode = detail.typeCode || detail.TypeCode;
        const code = detail.code || detail.Code;
        const text = detail.text || detail.Text;
        return {
            severity: typeCode === 'E' || typeCode === 'AE' ? 'error' : 'information',
            code: code?.['@_code'] || 'processing',
            diagnostics: typeof text === 'string' ? text : text?.['#text']
        };
    }).filter((issue: any) => issue.code || issue.diagnostics);

    if (!issues.length) return undefined;

    return {
        id: `OO-${Date.now()}`,
        issue: issues
    };
}

function mapV3Parameters(root: any): CanonicalParameters | undefined {
    const interactionId = root?.interactionId?.['@_extension'];
    const creationTime = root?.creationTime?.['@_value'];

    if (!interactionId && !creationTime) return undefined;

    const params: Array<{ name: string; valueString?: string }> = [];
    if (interactionId) {
        params.push({ name: 'interactionId', valueString: interactionId });
    }
    if (creationTime) {
        params.push({ name: 'creationTime', valueString: creationTime });
    }

    return params.length
        ? { id: `PARAMS-${Date.now()}`, parameter: params }
        : undefined;
}

function mapV3CarePlan(planEvent: any): CanonicalCarePlan | undefined {
    if (!planEvent) return undefined;
    const id = planEvent.id || planEvent['cda:id'];
    const code = planEvent.code || planEvent['cda:code'];
    const statusCode = planEvent.statusCode || planEvent['cda:statusCode'];
    const effectiveTime = planEvent.effectiveTime || planEvent['cda:effectiveTime'];
    const text = planEvent.text || planEvent['cda:text'];

    const planId = id?.['@_extension'] || id?.['@_root'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const status = statusCode?.['@_code'];
    const periodStart = effectiveTime?.low?.['@_value'] || effectiveTime?.['@_value'];
    const periodEnd = effectiveTime?.high?.['@_value'];
    const description = typeof text === 'string' ? text : text?.['#text'];

    if (!planId && !displayName && !description) return undefined;

    return {
        id: planId || `CAREPLAN-${Date.now()}`,
        identifier: planId,
        status: status || 'active',
        intent: 'plan',
        title: displayName,
        description: description,
        period: periodStart || periodEnd ? { start: periodStart, end: periodEnd } : undefined
    };
}

function mapV3CareTeam(teamEvent: any): CanonicalCareTeam | undefined {
    if (!teamEvent) return undefined;
    const id = teamEvent.id || teamEvent['cda:id'];
    const code = teamEvent.code || teamEvent['cda:code'];
    const statusCode = teamEvent.statusCode || teamEvent['cda:statusCode'];
    const effectiveTime = teamEvent.effectiveTime || teamEvent['cda:effectiveTime'];
    const name = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const status = statusCode?.['@_code'];
    const periodStart = effectiveTime?.low?.['@_value'] || effectiveTime?.['@_value'];
    const periodEnd = effectiveTime?.high?.['@_value'];

    const teamId = id?.['@_extension'] || id?.['@_root'];
    if (!teamId && !name) return undefined;

    const participantsRaw = teamEvent.participant || teamEvent.Participant;
    const participants = Array.isArray(participantsRaw) ? participantsRaw : participantsRaw ? [participantsRaw] : [];
    const participant = participants.map(part => {
        const roleCode = part.code || part['cda:code'];
        const member = part.member || part['cda:member'] || part.participantRole || part['cda:participantRole'];
        const memberId = member?.id?.['@_extension'] || member?.id?.['@_root'];
        return {
            role: roleCode?.['@_code'] || roleCode?.['@_displayName'] ? {
                code: roleCode?.['@_code'],
                display: roleCode?.['@_displayName']
            } : undefined,
            member: memberId
        };
    }).filter(p => p.member);

    return {
        id: teamId || `CARETEAM-${Date.now()}`,
        identifier: teamId,
        status: status || 'active',
        name: name,
        period: periodStart || periodEnd ? { start: periodStart, end: periodEnd } : undefined,
        participant: participant.length ? participant : undefined
    };
}

function mapV3Goal(goalEvent: any): CanonicalGoal | undefined {
    if (!goalEvent) return undefined;
    const id = goalEvent.id || goalEvent['cda:id'];
    const code = goalEvent.code || goalEvent['cda:code'];
    const statusCode = goalEvent.statusCode || goalEvent['cda:statusCode'];
    const effectiveTime = goalEvent.effectiveTime || goalEvent['cda:effectiveTime'];
    const text = goalEvent.text || goalEvent['cda:text'];

    const goalId = id?.['@_extension'] || id?.['@_root'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const status = statusCode?.['@_code'];
    const startDate = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const descriptionText = typeof text === 'string' ? text : text?.['#text'];

    if (!goalId && !displayName && !descriptionText) return undefined;

    return {
        id: goalId || `GOAL-${Date.now()}`,
        identifier: goalId,
        lifecycleStatus: status || 'active',
        description: { text: displayName || descriptionText },
        startDate: startDate
    };
}

function mapV3ServiceRequest(requestEvent: any): CanonicalServiceRequest | undefined {
    if (!requestEvent) return undefined;
    const id = requestEvent.id || requestEvent['cda:id'];
    const code = requestEvent.code || requestEvent['cda:code'];
    const statusCode = requestEvent.statusCode || requestEvent['cda:statusCode'];
    const effectiveTime = requestEvent.effectiveTime || requestEvent['cda:effectiveTime'];

    const requestId = id?.['@_extension'] || id?.['@_root'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const status = statusCode?.['@_code'];
    const start = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];

    if (!requestId && !displayName) return undefined;

    return {
        id: requestId || `SR-${Date.now()}`,
        identifier: requestId,
        status: status || 'active',
        intent: 'order',
        code: displayName ? { display: displayName } : undefined,
        authoredOn: start
    };
}

function mapV3Task(taskEvent: any): CanonicalTask | undefined {
    if (!taskEvent) return undefined;
    const id = taskEvent.id || taskEvent['cda:id'];
    const code = taskEvent.code || taskEvent['cda:code'];
    const statusCode = taskEvent.statusCode || taskEvent['cda:statusCode'];
    const effectiveTime = taskEvent.effectiveTime || taskEvent['cda:effectiveTime'];
    const text = taskEvent.text || taskEvent['cda:text'];

    const taskId = id?.['@_extension'] || id?.['@_root'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const status = statusCode?.['@_code'];
    const start = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const descriptionText = typeof text === 'string' ? text : text?.['#text'];

    if (!taskId && !displayName && !descriptionText) return undefined;

    return {
        id: taskId || `TASK-${Date.now()}`,
        identifier: taskId,
        status: status || 'requested',
        intent: 'order',
        code: displayName ? { display: displayName } : undefined,
        description: descriptionText || displayName,
        authoredOn: start
    };
}

function mapV3Communication(commEvent: any): CanonicalCommunication | undefined {
    if (!commEvent) return undefined;
    const id = commEvent.id || commEvent['cda:id'];
    const code = commEvent.code || commEvent['cda:code'];
    const statusCode = commEvent.statusCode || commEvent['cda:statusCode'];
    const effectiveTime = commEvent.effectiveTime || commEvent['cda:effectiveTime'];
    const text = commEvent.text || commEvent['cda:text'];

    const commId = id?.['@_extension'] || id?.['@_root'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const status = statusCode?.['@_code'];
    const sent = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const noteText = typeof text === 'string' ? text : text?.['#text'];

    if (!commId && !displayName && !noteText) return undefined;

    return {
        id: commId || `COMM-${Date.now()}`,
        identifier: commId,
        status: status || 'completed',
        topic: displayName ? { display: displayName } : undefined,
        sent: sent,
        note: noteText ? [noteText] : undefined
    };
}

function mapV3CommunicationRequest(commEvent: any): CanonicalCommunicationRequest | undefined {
    if (!commEvent) return undefined;
    const id = commEvent.id || commEvent['cda:id'];
    const code = commEvent.code || commEvent['cda:code'];
    const statusCode = commEvent.statusCode || commEvent['cda:statusCode'];
    const effectiveTime = commEvent.effectiveTime || commEvent['cda:effectiveTime'];
    const text = commEvent.text || commEvent['cda:text'];

    const reqId = id?.['@_extension'] || id?.['@_root'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const status = statusCode?.['@_code'];
    const occurrence = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const noteText = typeof text === 'string' ? text : text?.['#text'];

    if (!reqId && !displayName && !noteText) return undefined;

    return {
        id: reqId || `COMMREQ-${Date.now()}`,
        identifier: reqId,
        status: status || 'active',
        intent: 'order',
        category: displayName ? [{ display: displayName }] : undefined,
        occurrenceDateTime: occurrence,
        note: noteText ? [noteText] : undefined
    };
}

function mapV3Questionnaire(qnrEvent: any): CanonicalQuestionnaire | undefined {
    if (!qnrEvent) return undefined;
    const id = qnrEvent.id || qnrEvent['cda:id'];
    const code = qnrEvent.code || qnrEvent['cda:code'];
    const statusCode = qnrEvent.statusCode || qnrEvent['cda:statusCode'];
    const effectiveTime = qnrEvent.effectiveTime || qnrEvent['cda:effectiveTime'];
    const text = qnrEvent.text || qnrEvent['cda:text'];

    const qnrId = id?.['@_extension'] || id?.['@_root'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const status = statusCode?.['@_code'];
    const date = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const description = typeof text === 'string' ? text : text?.['#text'];

    if (!qnrId && !displayName && !description) return undefined;

    return {
        id: qnrId || `QNR-${Date.now()}`,
        identifier: qnrId,
        status: status || 'active',
        title: displayName,
        description: description,
        date: date
    };
}

function mapV3QuestionnaireResponse(respEvent: any): CanonicalQuestionnaireResponse | undefined {
    if (!respEvent) return undefined;
    const id = respEvent.id || respEvent['cda:id'];
    const statusCode = respEvent.statusCode || respEvent['cda:statusCode'];
    const effectiveTime = respEvent.effectiveTime || respEvent['cda:effectiveTime'];
    const text = respEvent.text || respEvent['cda:text'];
    const qnrRef = respEvent.questionnaire || respEvent.Questionnaire;
    const qnrId = qnrRef?.id?.['@_extension'] || qnrRef?.id?.['@_root'];

    const respId = id?.['@_extension'] || id?.['@_root'];
    const status = statusCode?.['@_code'];
    const authored = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const answerText = typeof text === 'string' ? text : text?.['#text'];

    if (!respId && !answerText) return undefined;

    return {
        id: respId || `QNRRESP-${Date.now()}`,
        identifier: respId,
        status: status || 'completed',
        questionnaire: qnrId,
        authored: authored,
        item: answerText ? [{ linkId: 'q1', text: 'Response', answer: [answerText] }] : undefined
    };
}

function mapV3CodeSystem(codeSystemEvent: any): CanonicalCodeSystem | undefined {
    if (!codeSystemEvent) return undefined;
    const id = codeSystemEvent.id || codeSystemEvent['cda:id'];
    const name = codeSystemEvent.name || codeSystemEvent['cda:name'];
    const title = codeSystemEvent.title || codeSystemEvent['cda:title'];
    const statusCode = codeSystemEvent.statusCode || codeSystemEvent['cda:statusCode'];
    const effectiveTime = codeSystemEvent.effectiveTime || codeSystemEvent['cda:effectiveTime'];
    const code = codeSystemEvent.code || codeSystemEvent['cda:code'];
    const text = codeSystemEvent.text || codeSystemEvent['cda:text'];

    const csId = id?.['@_extension'] || id?.['@_root'];
    const status = statusCode?.['@_code'];
    const date = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const codeValue = code?.['@_code'];
    const definition = typeof text === 'string' ? text : text?.['#text'];
    const nameText = typeof name === 'string' ? name : name?.['#text'];
    const titleText = typeof title === 'string' ? title : title?.['#text'];

    if (!csId && !displayName && !nameText && !titleText) return undefined;

    return {
        id: csId || `CODESYS-${Date.now()}`,
        identifier: csId,
        status: status || 'active',
        name: nameText,
        title: titleText,
        date: date,
        description: definition,
        concept: codeValue || displayName ? [{
            code: codeValue,
            display: displayName,
            definition: definition
        }] : undefined
    };
}

function mapV3ValueSet(valueSetEvent: any): CanonicalValueSet | undefined {
    if (!valueSetEvent) return undefined;
    const id = valueSetEvent.id || valueSetEvent['cda:id'];
    const name = valueSetEvent.name || valueSetEvent['cda:name'];
    const title = valueSetEvent.title || valueSetEvent['cda:title'];
    const statusCode = valueSetEvent.statusCode || valueSetEvent['cda:statusCode'];
    const effectiveTime = valueSetEvent.effectiveTime || valueSetEvent['cda:effectiveTime'];
    const code = valueSetEvent.code || valueSetEvent['cda:code'];
    const text = valueSetEvent.text || valueSetEvent['cda:text'];

    const vsId = id?.['@_extension'] || id?.['@_root'];
    const status = statusCode?.['@_code'];
    const date = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const codeValue = code?.['@_code'];
    const system = code?.['@_codeSystem'];
    const definition = typeof text === 'string' ? text : text?.['#text'];
    const nameText = typeof name === 'string' ? name : name?.['#text'];
    const titleText = typeof title === 'string' ? title : title?.['#text'];

    if (!vsId && !displayName && !nameText && !titleText) return undefined;

    return {
        id: vsId || `VALSET-${Date.now()}`,
        identifier: vsId,
        status: status || 'active',
        name: nameText,
        title: titleText,
        date: date,
        description: definition,
        compose: system || codeValue || displayName ? {
            include: [{
                system: system,
                concept: codeValue || displayName ? [{
                    code: codeValue,
                    display: displayName
                }] : undefined
            }]
        } : undefined
    };
}

function mapV3ConceptMap(conceptMapEvent: any): CanonicalConceptMap | undefined {
    if (!conceptMapEvent) return undefined;
    const id = conceptMapEvent.id || conceptMapEvent['cda:id'];
    const name = conceptMapEvent.name || conceptMapEvent['cda:name'];
    const title = conceptMapEvent.title || conceptMapEvent['cda:title'];
    const statusCode = conceptMapEvent.statusCode || conceptMapEvent['cda:statusCode'];
    const effectiveTime = conceptMapEvent.effectiveTime || conceptMapEvent['cda:effectiveTime'];
    const code = conceptMapEvent.code || conceptMapEvent['cda:code'];
    const text = conceptMapEvent.text || conceptMapEvent['cda:text'];

    const mapId = id?.['@_extension'] || id?.['@_root'];
    const status = statusCode?.['@_code'];
    const date = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const codeValue = code?.['@_code'];
    const system = code?.['@_codeSystem'];
    const definition = typeof text === 'string' ? text : text?.['#text'];
    const nameText = typeof name === 'string' ? name : name?.['#text'];
    const titleText = typeof title === 'string' ? title : title?.['#text'];

    if (!mapId && !displayName && !nameText && !titleText) return undefined;

    return {
        id: mapId || `CONMAP-${Date.now()}`,
        identifier: mapId,
        status: status || 'active',
        name: nameText,
        title: titleText,
        date: date,
        description: definition,
        group: system || codeValue || displayName ? [{
            source: system,
            element: [{
                code: codeValue,
                display: displayName,
                target: displayName ? [{
                    code: codeValue,
                    display: displayName,
                    relationship: 'equivalent'
                }] : undefined
            }]
        }] : undefined
    };
}

function mapV3NamingSystem(namingSystemEvent: any): CanonicalNamingSystem | undefined {
    if (!namingSystemEvent) return undefined;
    const id = namingSystemEvent.id || namingSystemEvent['cda:id'];
    const name = namingSystemEvent.name || namingSystemEvent['cda:name'];
    const title = namingSystemEvent.title || namingSystemEvent['cda:title'];
    const statusCode = namingSystemEvent.statusCode || namingSystemEvent['cda:statusCode'];
    const effectiveTime = namingSystemEvent.effectiveTime || namingSystemEvent['cda:effectiveTime'];
    const code = namingSystemEvent.code || namingSystemEvent['cda:code'];
    const text = namingSystemEvent.text || namingSystemEvent['cda:text'];

    const nsId = id?.['@_extension'] || id?.['@_root'];
    const status = statusCode?.['@_code'];
    const date = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const kind = code?.['@_codeSystem'] || code?.['@_codeSystemName'];
    const definition = typeof text === 'string' ? text : text?.['#text'];
    const nameText = typeof name === 'string' ? name : name?.['#text'];
    const titleText = typeof title === 'string' ? title : title?.['#text'];

    if (!nsId && !displayName && !nameText && !titleText) return undefined;

    return {
        id: nsId || `NAMESYS-${Date.now()}`,
        identifier: nsId,
        status: status || 'active',
        name: nameText,
        title: titleText,
        date: date,
        kind: kind,
        description: definition,
        uniqueId: displayName ? [{
            type: 'uri',
            value: displayName,
            preferred: true
        }] : undefined
    };
}

function mapV3TerminologyCapabilities(terminologyCapabilitiesEvent: any): CanonicalTerminologyCapabilities | undefined {
    if (!terminologyCapabilitiesEvent) return undefined;
    const id = terminologyCapabilitiesEvent.id || terminologyCapabilitiesEvent['cda:id'];
    const name = terminologyCapabilitiesEvent.name || terminologyCapabilitiesEvent['cda:name'];
    const title = terminologyCapabilitiesEvent.title || terminologyCapabilitiesEvent['cda:title'];
    const statusCode = terminologyCapabilitiesEvent.statusCode || terminologyCapabilitiesEvent['cda:statusCode'];
    const effectiveTime = terminologyCapabilitiesEvent.effectiveTime || terminologyCapabilitiesEvent['cda:effectiveTime'];
    const code = terminologyCapabilitiesEvent.code || terminologyCapabilitiesEvent['cda:code'];
    const text = terminologyCapabilitiesEvent.text || terminologyCapabilitiesEvent['cda:text'];

    const tcId = id?.['@_extension'] || id?.['@_root'];
    const status = statusCode?.['@_code'];
    const date = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const kind = code?.['@_codeSystem'] || code?.['@_codeSystemName'];
    const description = typeof text === 'string' ? text : text?.['#text'];
    const nameText = typeof name === 'string' ? name : name?.['#text'];
    const titleText = typeof title === 'string' ? title : title?.['#text'];

    if (!tcId && !displayName && !nameText && !titleText) return undefined;

    return {
        id: tcId || `TERMCAP-${Date.now()}`,
        identifier: tcId,
        status: status || 'active',
        name: nameText,
        title: titleText,
        date: date,
        kind: kind,
        description: description
    };
}

function mapV3Provenance(provenanceEvent: any): CanonicalProvenance | undefined {
    if (!provenanceEvent) return undefined;
    const id = provenanceEvent.id || provenanceEvent['cda:id'];
    const statusCode = provenanceEvent.statusCode || provenanceEvent['cda:statusCode'];
    const effectiveTime = provenanceEvent.effectiveTime || provenanceEvent['cda:effectiveTime'];
    const code = provenanceEvent.code || provenanceEvent['cda:code'];
    const text = provenanceEvent.text || provenanceEvent['cda:text'];

    const provId = id?.['@_extension'] || id?.['@_root'];
    const recorded = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const activity = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const description = typeof text === 'string' ? text : text?.['#text'];
    const status = statusCode?.['@_code'];

    if (!provId && !activity && !description) return undefined;

    return {
        id: provId || `PROV-${Date.now()}`,
        recorded: recorded,
        activity: activity || description,
        agent: [{
            who: status,
            role: 'source'
        }]
    };
}

function mapV3AuditEvent(auditEvent: any): CanonicalAuditEvent | undefined {
    if (!auditEvent) return undefined;
    const id = auditEvent.id || auditEvent['cda:id'];
    const statusCode = auditEvent.statusCode || auditEvent['cda:statusCode'];
    const effectiveTime = auditEvent.effectiveTime || auditEvent['cda:effectiveTime'];
    const code = auditEvent.code || auditEvent['cda:code'];
    const text = auditEvent.text || auditEvent['cda:text'];

    const auditId = id?.['@_extension'] || id?.['@_root'];
    const recorded = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const codeValue = code?.['@_code'];
    const action = statusCode?.['@_code'];
    const description = typeof text === 'string' ? text : text?.['#text'];

    if (!auditId && !displayName && !codeValue && !description) return undefined;

    return {
        id: auditId || `AUDIT-${Date.now()}`,
        recorded: recorded,
        code: displayName,
        action: action,
        severity: codeValue,
        agent: action ? [{ who: action, role: 'actor' }] : undefined
    };
}

function mapV3Consent(consentEvent: any): CanonicalConsent | undefined {
    if (!consentEvent) return undefined;
    const id = consentEvent.id || consentEvent['cda:id'];
    const statusCode = consentEvent.statusCode || consentEvent['cda:statusCode'];
    const effectiveTime = consentEvent.effectiveTime || consentEvent['cda:effectiveTime'];
    const code = consentEvent.code || consentEvent['cda:code'];
    const text = consentEvent.text || consentEvent['cda:text'];

    const consentId = id?.['@_extension'] || id?.['@_root'];
    const status = statusCode?.['@_code'];
    const date = effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'];
    const displayName = code?.['@_displayName'] || code?.displayName?.['#text'] || code?.['#text'];
    const decision = code?.['@_code'];
    const description = typeof text === 'string' ? text : text?.['#text'];

    if (!consentId && !displayName && !description) return undefined;

    return {
        id: consentId || `CONSENT-${Date.now()}`,
        status: status || 'active',
        category: displayName,
        date: date,
        decision: decision || undefined
    };
}

function mapV3Immunization(substanceAdmin: any): CanonicalImmunization | undefined {
    const consumable = substanceAdmin.consumable || substanceAdmin.Consumable;
    const manufacturedProduct = consumable?.manufacturedProduct || consumable?.ManufacturedProduct;
    const manufacturedMaterial = manufacturedProduct?.manufacturedMaterial || manufacturedProduct?.ManufacturedMaterial;
    const code = manufacturedMaterial?.code || manufacturedMaterial?.Code;

    const vaccineCode = code?.['@_code'];
    const vaccineDisplay = code?.['@_displayName'];
    const vaccineSystem = code?.['@_codeSystem'];

    if (!vaccineCode && !vaccineDisplay) return undefined;

    const status = substanceAdmin.statusCode?.['@_code'] || 'completed';
    const occurrence = formatV3DateTime(
        substanceAdmin.effectiveTime?.['@_value'] ||
        substanceAdmin.EffectiveTime?.['@_value'] ||
        substanceAdmin.effectiveTime?.low?.['@_value']
    );
    const dose = substanceAdmin.doseQuantity || substanceAdmin.DoseQuantity;
    const lotNode = manufacturedProduct?.lotNumberText || manufacturedProduct?.LotNumberText;
    const lotNumber = typeof lotNode === 'string' ? lotNode : lotNode?.['#text'];

    return {
        id: `IMM-${vaccineCode || Date.now()}`,
        identifier: vaccineCode,
        status,
        vaccineCode: vaccineCode || vaccineDisplay ? {
            system: vaccineSystem,
            code: vaccineCode,
            display: vaccineDisplay
        } : undefined,
        lotNumber: lotNumber,
        occurrenceDateTime: occurrence,
        doseQuantity: dose?.['@_value'] ? {
            value: Number(dose['@_value']),
            unit: dose?.['@_unit']
        } : undefined
    };
}

function mapV3Procedure(procEvent: any): CanonicalProcedure | undefined {
    const procedure = procEvent.procedure || procEvent.Procedure || procEvent;
    if (!procedure) return undefined;
    const code = procedure.code || procedure.Code;
    const effectiveTime = procedure.effectiveTime || procedure.EffectiveTime;

    const codeValue = code?.['@_code'];
    const displayName = code?.['@_displayName'];
    const codeSystem = code?.['@_codeSystem'];

    if (!codeValue && !displayName) return undefined;

    return {
        id: codeValue,
        identifier: codeValue,
        status: procedure.statusCode?.['@_code'] || 'completed',
        code: {
            coding: codeValue ? [{
                system: codeSystem,
                code: codeValue,
                display: displayName
            }] : undefined,
            text: displayName
        },
        occurrenceDateTime: formatV3DateTime(effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'])
    };
}

function mapV3Condition(condEvent: any): CanonicalCondition | undefined {
    const condition = condEvent.condition || condEvent.Condition || condEvent.observation || condEvent.Observation || condEvent;
    if (!condition) return undefined;
    const code = condition.code || condition.Code;
    const value = condition.value || condition.Value;
    const effectiveTime = condition.effectiveTime || condition.EffectiveTime;

    const codeValue = code?.['@_code'] || value?.['@_code'];
    const displayName = code?.['@_displayName'] || value?.['@_displayName'];
    const codeSystem = code?.['@_codeSystem'] || value?.['@_codeSystem'];

    if (!codeValue && !displayName) return undefined;

    return {
        id: codeValue,
        identifier: codeValue,
        code: {
            coding: codeValue ? [{
                system: codeSystem,
                code: codeValue,
                display: displayName
            }] : undefined,
            text: displayName
        },
        onsetDateTime: formatV3DateTime(effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'])
    };
}

function mapV3Appointment(apptEvent: any): CanonicalAppointment | undefined {
    const appointment = apptEvent.appointment || apptEvent.Appointment || apptEvent;
    if (!appointment) return undefined;
    const id = appointment.id || appointment.Id;
    const idValue = id?.['@_extension'] || id?.['@_root'];
    const status = appointment.statusCode?.['@_code'] || appointment.StatusCode?.['@_code'];
    const code = appointment.code || appointment.Code;
    const displayName = code?.['@_displayName'];
    const effectiveTime = appointment.effectiveTime || appointment.EffectiveTime;

    const start = formatV3DateTime(effectiveTime?.low?.['@_value'] || effectiveTime?.['@_value']);
    const end = formatV3DateTime(effectiveTime?.high?.['@_value']);

    if (!idValue && !start && !end && !displayName) return undefined;

    return {
        id: idValue,
        identifier: idValue,
        status: status || 'proposed',
        description: displayName,
        start: start,
        end: end
    };
}

function mapV3Schedule(schedEvent: any): CanonicalSchedule | undefined {
    const schedule = schedEvent.schedule || schedEvent.Schedule || schedEvent;
    if (!schedule) return undefined;
    const id = schedule.id || schedule.Id;
    const idValue = id?.['@_extension'] || id?.['@_root'];
    const name = schedule.name || schedule.Name || schedule.code?.['@_displayName'];
    const effectiveTime = schedule.planningHorizon || schedule.PlanningHorizon || schedule.effectiveTime || schedule.EffectiveTime;

    const start = formatV3DateTime(effectiveTime?.low?.['@_value'] || effectiveTime?.['@_value']);
    const end = formatV3DateTime(effectiveTime?.high?.['@_value']);

    if (!idValue && !name && !start && !end) return undefined;

    return {
        id: idValue,
        identifier: idValue,
        active: true,
        name: typeof name === 'string' ? name : undefined,
        planningHorizon: start || end ? { start, end } : undefined
    };
}

function mapV3Slot(schedEvent: any): CanonicalSlot | undefined {
    const schedule = schedEvent.schedule || schedEvent.Schedule || schedEvent;
    if (!schedule) return undefined;
    const id = schedule.id || schedule.Id;
    const idValue = id?.['@_extension'] || id?.['@_root'];
    const effectiveTime = schedule.planningHorizon || schedule.PlanningHorizon || schedule.effectiveTime || schedule.EffectiveTime;
    const start = formatV3DateTime(effectiveTime?.low?.['@_value'] || effectiveTime?.['@_value']);
    const end = formatV3DateTime(effectiveTime?.high?.['@_value']);

    if (!idValue && !start && !end) return undefined;

    return {
        id: idValue ? `SLOT-${idValue}` : undefined,
        identifier: idValue,
        schedule: idValue,
        status: 'free',
        start: start,
        end: end
    };
}

function mapV3DiagnosticReport(reportEvent: any): CanonicalDiagnosticReport | undefined {
    const report = reportEvent.diagnosticReport || reportEvent.DiagnosticReport || reportEvent;
    if (!report) return undefined;
    const id = report.id || report.Id;
    const idValue = id?.['@_extension'] || id?.['@_root'];
    const code = report.code || report.Code;
    const codeValue = code?.['@_code'];
    const displayName = code?.['@_displayName'];
    const codeSystem = code?.['@_codeSystem'];
    const status = report.statusCode?.['@_code'] || report.StatusCode?.['@_code'];
    const effectiveTime = report.effectiveTime || report.EffectiveTime;

    if (!idValue && !codeValue && !displayName) return undefined;

    return {
        id: idValue || codeValue,
        identifier: idValue || codeValue,
        status: status || 'final',
        code: {
            coding: codeValue ? [{
                system: codeSystem,
                code: codeValue,
                display: displayName
            }] : undefined,
            text: displayName
        },
        effectiveDateTime: formatV3DateTime(effectiveTime?.['@_value'] || effectiveTime?.low?.['@_value'])
    };
}

function mapV3RelatedPerson(rpEvent: any): CanonicalRelatedPerson | undefined {
    const related = rpEvent.relatedPerson || rpEvent.RelatedPerson || rpEvent;
    const patientRole = related.patientRole || related.PatientRole;
    const patientId = patientRole?.id?.['@_extension'] || patientRole?.id?.['@_root'];
    const person = related.relatedPerson || related.RelatedPerson || related.associatedPerson || related.AssociatedPerson;
    if (!person) return undefined;
    const name = person.name || person.Name;
    const nameObj = Array.isArray(name) ? name[0] : name;
    const family = extractText(nameObj?.family || nameObj?.Family);
    const given = extractTextArray(nameObj?.given || nameObj?.Given);

    return {
        id: related.id?.['@_extension'] || related.id?.['@_root'],
        identifier: related.id?.['@_extension'] || related.id?.['@_root'],
        patient: patientId,
        name: (family || (given && given.length)) ? [{
            family,
            given
        }] : undefined
    };
}

function mapV3Address(addr: any): any {
    const addrObj = Array.isArray(addr) ? addr[0] : addr;
    return {
        line: extractTextArray(addrObj.streetAddressLine || addrObj.StreetAddressLine),
        city: extractText(addrObj.city || addrObj.City),
        state: extractText(addrObj.state || addrObj.State),
        postalCode: extractText(addrObj.postalCode || addrObj.PostalCode),
        country: extractText(addrObj.country || addrObj.Country),
        use: addrObj['@_use']
    };
}

function mapV3Telecom(telecom: any): any[] {
    const telecoms = Array.isArray(telecom) ? telecom : [telecom];
    return telecoms.map(t => ({
        system: inferTelecomSystem(t['@_value']),
        value: cleanTelecomValue(t['@_value']),
        use: t['@_use']
    })).filter(t => t.value);
}

function mapV3Addresses(addr: any): any[] {
    const addrs = Array.isArray(addr) ? addr : [addr];
    return addrs.map(mapV3Address).filter(a => a.line?.length || a.city || a.state || a.postalCode || a.country);
}

function mapV3OrganizationNode(org: any): CanonicalOrganization | undefined {
    if (!org) return undefined;
    const ids = org.id || org.Id;
    const idInfo = pickV3Id(ids);
    const name = extractText(org.name || org.Name);
    const telecom = org.telecom || org.Telecom;
    const addr = org.addr || org.Addr;
    const code = org.code || org.Code;

    return {
        id: idInfo.id || name,
        identifier: idInfo.identifier,
        name: name,
        telecom: telecom ? mapV3Telecom(telecom) : undefined,
        address: addr ? mapV3Addresses(addr) : undefined,
        type: code ? [{
            system: code?.['@_codeSystem'],
            code: code?.['@_code'],
            display: code?.['@_displayName']
        }] : undefined
    };
}

function mapV3PractitionerRoleFromAssigned(assignedAuthor: any): CanonicalPractitionerRole | undefined {
    const assignedPerson = assignedAuthor.assignedPerson || assignedAuthor.AssignedPerson;
    if (!assignedPerson) return undefined;
    const ids = assignedAuthor.id || assignedAuthor.Id;
    const idInfo = pickV3Id(ids);
    const org = assignedAuthor.representedOrganization || assignedAuthor.RepresentedOrganization;
    const orgIdInfo = org ? pickV3Id(org.id || org.Id) : { id: undefined, identifier: undefined };
    const code = assignedAuthor.code || assignedAuthor.Code;

    if (!idInfo.id && !idInfo.identifier) return undefined;
    return {
        id: idInfo.identifier || idInfo.id,
        practitionerId: idInfo.identifier || idInfo.id,
        organizationId: orgIdInfo.identifier || orgIdInfo.id,
        code: code ? [{
            system: code?.['@_codeSystem'],
            code: code?.['@_code'],
            display: code?.['@_displayName']
        }] : undefined
    };
}

function mapV3PractitionerRoleFromResponsible(responsibleParty: any): CanonicalPractitionerRole | undefined {
    const assignedEntity = responsibleParty.assignedEntity || responsibleParty.AssignedEntity;
    if (!assignedEntity) return undefined;
    const ids = assignedEntity.id || assignedEntity.Id;
    const idInfo = pickV3Id(ids);
    const org = assignedEntity.representedOrganization || assignedEntity.RepresentedOrganization;
    const orgIdInfo = org ? pickV3Id(org.id || org.Id) : { id: undefined, identifier: undefined };
    const code = assignedEntity.code || assignedEntity.Code;

    if (!idInfo.id && !idInfo.identifier) return undefined;
    return {
        id: idInfo.identifier || idInfo.id,
        practitionerId: idInfo.identifier || idInfo.id,
        organizationId: orgIdInfo.identifier || orgIdInfo.id,
        code: code ? [{
            system: code?.['@_codeSystem'],
            code: code?.['@_code'],
            display: code?.['@_displayName']
        }] : undefined
    };
}

// Helper functions (extractText, formatV3Date, etc.)
function extractText(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    if (value['#text']) return String(value['#text']);
    return '';
}

function extractTextArray(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(extractText).filter(Boolean);
    return [extractText(value)].filter(Boolean);
}

function readV3Value(value: any): string | number | Array<string | number> | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) {
        return value.map(readV3Value).filter(v => v !== undefined) as Array<string | number>;
    }
    if (value['@_value'] !== undefined) return value['@_value'];
    if (value['@_code'] !== undefined) return value['@_code'];
    return extractText(value);
}

function mapV3Observers(performer: any): Array<{ id?: string; name?: string; qualification?: string; }> | undefined {
    if (!performer) return undefined;
    const performers = Array.isArray(performer) ? performer : [performer];
    const observers = performers.map(p => {
        const assignedEntity = p.assignedEntity || p.AssignedEntity;
        const assignedPerson = assignedEntity?.assignedPerson || assignedEntity?.AssignedPerson;
        const ids = assignedEntity?.id || assignedEntity?.Id;
        const idInfo = pickV3Id(ids);
        const nameNode = assignedPerson?.name || assignedPerson?.Name;
        const family = extractText(nameNode?.family || nameNode?.Family);
        const givenParts = nameNode?.given || nameNode?.Given;
        const given = Array.isArray(givenParts)
            ? givenParts.map(extractText).filter(Boolean).join(' ')
            : extractText(givenParts);
        const displayName = [given, family].filter(Boolean).join(' ').trim();
        return {
            id: idInfo.identifier || idInfo.id,
            name: displayName || undefined
        };
    }).filter(o => o.id || o.name);
    return observers.length > 0 ? observers : undefined;
}

function inferTelecomSystem(value: string): 'phone' | 'email' | 'fax' | 'url' | 'other' {
    if (!value) return 'other';
    if (value.startsWith('tel:')) return 'phone';
    if (value.startsWith('mailto:')) return 'email';
    if (value.startsWith('fax:')) return 'fax';
    if (value.startsWith('http')) return 'url';
    if (value.includes('@')) return 'email';
    return 'phone';
}

function cleanTelecomValue(value: string): string {
    if (!value) return '';
    return value.replace(/^(tel:|mailto:|fax:)/, '');
}

function formatV3Date(value?: string): string | undefined {
    if (value && value.length >= 8) {
        return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
    }
    return undefined;
}

function formatV3DateTime(value?: string): string | undefined {
    if (value && value.length >= 8) {
        let date = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
        if (value.length >= 14) {
            date += `T${value.slice(8, 10)}:${value.slice(10, 12)}:${value.slice(12, 14)}Z`;
        } else {
            date += `T00:00:00Z`;
        }
        return date;
    }
    return undefined;
}

function mapGenderCode(code?: string): string {
    if (!code) return 'unknown';
    const c = code.toUpperCase();
    if (c === 'M' || c === 'MALE') return 'male';
    if (c === 'F' || c === 'FEMALE') return 'female';
    return 'unknown';
}

function pickV3Id(ids: any): { id?: string; identifier?: string } {
    if (!ids) return {};
    const first = Array.isArray(ids) ? ids[0] : ids;
    const extension = first?.['@_extension'];
    const root = first?.['@_root'];
    const idValue = extension || root;
    return {
        id: idValue,
        identifier: idValue
    };
}

function buildV3DoseText(dose: any, route: any): string | undefined {
    const doseValue = dose?.['@_value'];
    const doseUnit = dose?.['@_unit'];
    const routeDisplay = route?.['@_displayName'] || route?.['@_code'];
    const parts = [];
    if (doseValue) parts.push(`${doseValue}${doseUnit ? ' ' + doseUnit : ''}`);
    if (routeDisplay) parts.push(`via ${routeDisplay}`);
    return parts.length > 0 ? parts.join(' ') : undefined;
}

function mapEncounterStatus(status?: string): string {
    if (!status) return 'unknown';
    const s = status.toLowerCase();

    // FHIR R5 Status validation
    if (s === 'active') return 'in-progress';
    if (s === 'completed' || s === 'finished') return 'completed';
    if (s === 'aborted' || s === 'cancelled') return 'cancelled';
    if (s === 'planned' || s === 'new') return 'planned';

    return 'unknown';
}

function mapEpisodeOfCareStatus(status?: string): string {
    if (!status) return 'active';
    const normalized = status.toLowerCase();
    if (normalized === 'active' || normalized === 'in-progress') return 'active';
    if (normalized === 'completed' || normalized === 'finished') return 'finished';
    if (normalized === 'aborted' || normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
    if (normalized === 'planned' || normalized === 'new') return 'planned';
    if (normalized === 'onhold' || normalized === 'on-hold') return 'onhold';
    if (normalized === 'waitlist') return 'waitlist';
    if (normalized === 'entered-in-error' || normalized === 'entered_in_error') return 'entered-in-error';
    return 'active';
}

function mapEncounterClass(code?: string): string {
    if (!code) return 'AMB';
    const codeUpper = code.toUpperCase();

    if (codeUpper === 'IMP' || codeUpper === 'INPATIENT') return 'IMP';
    if (codeUpper === 'AMB' || codeUpper === 'AMBULATORY') return 'AMB';
    if (codeUpper === 'EMER' || codeUpper === 'EMERGENCY') return 'EMER';
    if (codeUpper === 'VR' || codeUpper === 'VIRTUAL') return 'VR';

    return 'AMB';
}
