const { GoogleGenAI } = require("@google/genai");

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getAi() {
  requireEnv("GOOGLE_API_KEY");
  return new GoogleGenAI({});
}

async function generateDialogueJson({ systemPrompt }) {
  const ai = getAi();

  console.log("[gemini] sending prompt to Gemini...");
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ parts: [{ text: systemPrompt }] }],
  });

  const text =
    res?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text || "")
      .join("\n")
      .trim() || "";

  console.log("[gemini] raw response text:\n", text);

  if (!text) throw new Error("Gemini returned empty response for dialogue.");

  const json = extractJsonObject(text);
  console.log("[gemini] parsed JSON keys:", Object.keys(json || {}));

  return json;
}

function extractJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {}

  const cleaned = text
    .replace(/```json/gi, "```")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {}

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const sub = cleaned.slice(first, last + 1);
    try {
      return JSON.parse(sub);
    } catch {}
  }

  throw new Error("Failed to parse JSON from Gemini response.");
}

module.exports = { generateDialogueJson };