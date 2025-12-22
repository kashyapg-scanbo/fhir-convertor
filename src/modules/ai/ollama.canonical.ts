import fetch from 'node-fetch';

function extractJSON(text: string): any {
  // Remove ```json ... ``` or ``` ... ```
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(
      'LLM output is not valid JSON after cleanup:\n' + cleaned
    );
  }
}


export async function canonicalizeWithLLM(parsed: any) {
  const prompt = `
  You are a healthcare data parser.
  
  IMPORTANT RULES:
  - Output ONLY valid JSON
  - Do NOT use markdown
  - Do NOT wrap output in \`\`\`
  - Do NOT explain anything
  
  Use ONLY this schema:
  {
    patient: { id, name, birthDate, gender, address, telecom },
    encounter: { class, location, start },
    observations: [{ code, value, unit, date }],
    allergies: [{ substance, reaction }],
    diagnoses: [{ code, description }]
  }
  
  HL7:
  ${JSON.stringify(parsed, null, 2)}
  
  Return ONLY JSON.
  `;  

  const res = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen2.5:1.5b-instruct',
      prompt,
      stream: false
    })
  });

  const data:any = await res.json();
  return extractJSON(data.response);
}
