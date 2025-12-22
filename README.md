# HL7 v2 → FHIR R5 Converter (Microsoft-style, Production)

Pipeline:
HL7 v2
 → Canonical JSON (LLM / Ollama)
 → Deterministic Mapping (Templates)
 → FHIR R5 Bundle
 → HAPI Compatible

Supports:
- ADT^A01
- PID, PV1, NK1, OBX, AL1, DG1, PR1, IN1/2, GT1, ROL
