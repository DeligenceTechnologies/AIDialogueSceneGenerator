const { Annotation, StateGraph } = require("@langchain/langgraph");
const { DialogueSchema } = require("./schemas");
const { generateDialogueJson } = require("../gemini");
const { ttsSingle, ttsMulti2, concatWavs } = require("../ttsGemini");

const SceneState = Annotation.Root({
  input: Annotation(),
  dialogue: Annotation(),
  audioBase64Wav: Annotation(),
  audioMimeType: Annotation(),
});

function buildSystemPrompt(input) {
  const allowedSpeakerIds = (input.speakers || []).map((s) => String(s.id).trim());

  const speakerBlock = (input.speakers || [])
    .map((s) => {
      const genderPart = s.gender ? `, likely voice gender: ${s.gender}` : "";
      return `- ${s.id}${genderPart}: Acting direction: ${s.actingPrompt || "Natural, scene-appropriate."}`;
    })
    .join("\n");

  return `
You are a screenplay dialogue writer and scene designer.

Goal:
- Write a short, vivid scene with natural conversational flow.
- Generate character names that suit the scene.
- Assign each provided speakerId to a scene character.
- Match emotion, tone, warmth, pacing, and dramatic intent per speaker.
- Output ONLY valid JSON.

Scene direction:
${input.scenePrompt}

Available speakers:
${speakerBlock}

CRITICAL RULES:
- You must use ONLY these exact speaker ids:
${allowedSpeakerIds.map((id) => `  - ${id}`).join("\n")}
- Do NOT invent new ids like Male1, Female1, Speaker1, etc.
- Every line.speaker must exactly match one of the allowed ids above.
- Every characters[].speakerId must exactly match one of the allowed ids above.

Constraints:
- Keep each line <= 25 words.
- Include at least 2 lines per speaker used.
- Total lines: 10 to 24.
- Emotional realism is important.
- The sceneMood should summarize the emotional atmosphere.
- For every line, pace must be exactly one of: "slow", "medium", "fast".
- For every line, intensity must be exactly one of: "low", "medium", "high".

Return JSON ONLY in exactly this shape:
{
  "title": "string",
  "sceneMood": "string",
  "characters": [
    {
      "speakerId": "${allowedSpeakerIds[0] || "SpeakerA"}",
      "characterName": "string",
      "role": "string",
      "shortDescription": "string"
    }
  ],
  "lines": [
    {
      "speaker": "${allowedSpeakerIds[0] || "SpeakerA"}",
      "characterName": "string",
      "text": "string",
      "emotion": "string",
      "pace": "slow|medium|fast",
      "intensity": "low|medium|high"
    }
  ]
}
`.trim();
}

function dialogueToLines(dialogue) {
  return (dialogue?.lines || []).map((l) => ({
    speaker: String(l.speaker || "").trim(),
    characterName: String(l.characterName || "").trim(),
    text: String(l.text || "").trim(),
    emotion: String(l.emotion || "").trim(),
    pace: String(l.pace || "medium").trim(),
    intensity: String(l.intensity || "medium").trim(),
  }));
}

function normalizeSimpleSpeakerKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[0-9]+/g, "")   // remove digits like Male1 -> Male
    .replace(/[^a-z]/g, "");  // keep letters only
}

function buildSpeakerIdRemap(rawJson, inputSpeakers = []) {
  const remap = {};
  const allowedIds = inputSpeakers.map((s) => String(s.id).trim());

  // Exact ids already available
  for (const id of allowedIds) {
    remap[id] = id;
  }

  // Normalize by simple key: Male1 -> Male, Female1 -> Female
  const allowedByKey = new Map();
  for (const id of allowedIds) {
    allowedByKey.set(normalizeSimpleSpeakerKey(id), id);
  }

  const generatedIds = new Set();

  for (const c of rawJson?.characters || []) {
    if (c?.speakerId) generatedIds.add(String(c.speakerId).trim());
  }
  for (const l of rawJson?.lines || []) {
    if (l?.speaker) generatedIds.add(String(l.speaker).trim());
  }

  for (const genId of generatedIds) {
    if (remap[genId]) continue;

    const key = normalizeSimpleSpeakerKey(genId);
    const matched = allowedByKey.get(key);
    if (matched) {
      remap[genId] = matched;
    }
  }

  return remap;
}
function toScriptText(lines) {
  return lines.map((l) => `${l.speaker} (${l.characterName}): ${l.text}`).join("\n");
}

function buildDirectorPrefix(scenePrompt, sceneMood) {
  return `
# SCENE
${scenePrompt}

# MOOD
${sceneMood}

# DIRECTOR'S NOTES
- Perform with emotional realism.
- Keep pacing natural and conversational.
- Let emotion be audible.
- Match warmth, tone, and intensity to the scene.
- Avoid robotic delivery.
`.trim();
}

function mapVoiceBySpeaker(input) {
  return new Map(
    (input.speakers || []).map((s) => [
      String(s.id).trim(),
      {
        voiceName: String(s.voiceName || "").trim(),
        actingPrompt: String(s.actingPrompt || "").trim(),
        gender: String(s.gender || "").trim(),
      },
    ])
  );
}

async function nodeWriteDialogue(state) {
  console.log("[sceneGraph] nodeWriteDialogue start");
  const sys = buildSystemPrompt(state.input);

  const rawJson = await generateDialogueJson({ systemPrompt: sys });
  console.log("[sceneGraph] rawJson:", JSON.stringify(rawJson, null, 2));

  const normalizedJson = normalizeDialogueJson(rawJson, state.input?.speakers || []);
  console.log("[sceneGraph] normalizedJson:", JSON.stringify(normalizedJson, null, 2));

  const validated = DialogueSchema.parse(normalizedJson);
  console.log("[sceneGraph] dialogue validated");

  return { dialogue: validated };
}
function normalizePaceValue(value) {
  const v = String(value || "").trim().toLowerCase();

  if (!v) return "medium";
  if (v === "slow" || v === "medium" || v === "fast") return v;

  if (v.includes("slow") && v.includes("medium")) return "medium";
  if (v.includes("medium") && v.includes("fast")) return "fast";
  if (v.includes("slow")) return "slow";
  if (v.includes("fast")) return "fast";
  if (v.includes("medium")) return "medium";

  return "medium";
}

function normalizeIntensityValue(value) {
  const v = String(value || "").trim().toLowerCase();

  if (!v) return "medium";
  if (v === "low" || v === "medium" || v === "high") return v;

  if (v.includes("low")) return "low";
  if (v.includes("high")) return "high";
  return "medium";
}

function normalizeDialogueJson(rawJson, inputSpeakers = []) {
  const speakerRemap = buildSpeakerIdRemap(rawJson, inputSpeakers);

  const clone = {
    ...rawJson,
    sceneMood: rawJson?.sceneMood || "emotionally layered",
    characters: Array.isArray(rawJson?.characters)
      ? rawJson.characters.map((c) => ({
          ...c,
          speakerId: speakerRemap[c?.speakerId] || c?.speakerId || "",
          characterName: c?.characterName || "Unknown",
          role: c?.role || "Unknown role",
          shortDescription: c?.shortDescription || "No description provided.",
        }))
      : [],
    lines: Array.isArray(rawJson?.lines)
      ? rawJson.lines.map((line) => ({
          ...line,
          speaker: speakerRemap[line?.speaker] || line?.speaker || "",
          characterName: line?.characterName || line?.speaker || "Unknown",
          emotion: line?.emotion || "neutral",
          pace: normalizePaceValue(line?.pace),
          intensity: normalizeIntensityValue(line?.intensity),
        }))
      : [],
  };

  return clone;
}
async function nodeTts(state) {
  console.log("[sceneGraph] nodeTts start");
  if (!state.dialogue) throw new Error("Dialogue missing");

  const input = state.input || {};
  const dialogue = state.dialogue;
  const lines = dialogueToLines(dialogue);

  if (!lines.length) throw new Error("No dialogue lines found");

  const voiceBySpeaker = mapVoiceBySpeaker(input);
  const uniqueSpeakers = Array.from(new Set(lines.map((l) => l.speaker))).filter(Boolean);

  for (const sp of uniqueSpeakers) {
    const obj = voiceBySpeaker.get(sp);
    if (!obj?.voiceName) {
      throw new Error(`Missing voiceName for speaker: ${sp}`);
    }
  }

  const directorPrefix = buildDirectorPrefix(
    input.scenePrompt || "",
    dialogue.sceneMood || "Emotionally layered, natural dramatic scene"
  );

  if (uniqueSpeakers.length === 1) {
    const sp = uniqueSpeakers[0];
    const voiceInfo = voiceBySpeaker.get(sp);

    const prompt = `
${directorPrefix}

# AUDIO PROFILE
Speaker ID: ${sp}
Voice gender hint: ${voiceInfo.gender || "unspecified"}
Base direction: ${voiceInfo.actingPrompt || "Natural, scene-appropriate performance."}

# TRANSCRIPT
${lines
  .map(
    (l) => `${l.characterName}: ${l.text}
Emotion: ${l.emotion}
Pace: ${l.pace}
Intensity: ${l.intensity}`
  )
  .join("\n\n")}
`.trim();

    const wav = await ttsSingle({ text: prompt, voiceName: voiceInfo.voiceName });
    return {
      audioBase64Wav: wav.toString("base64"),
      audioMimeType: "audio/wav",
    };
  }

  if (uniqueSpeakers.length === 2) {
    const [a, b] = uniqueSpeakers;
    const va = voiceBySpeaker.get(a);
    const vb = voiceBySpeaker.get(b);

    const prompt = `
${directorPrefix}

# AUDIO PROFILE
- ${a}: gender hint ${va.gender || "unspecified"}; ${va.actingPrompt || "Natural, scene-appropriate."}
- ${b}: gender hint ${vb.gender || "unspecified"}; ${vb.actingPrompt || "Natural, scene-appropriate."}

# TRANSCRIPT
${lines
  .map(
    (l) => `${l.speaker}: ${l.text} [character=${l.characterName}; emotion=${l.emotion}; pace=${l.pace}; intensity=${l.intensity}]`
  )
  .join("\n")}
`.trim();

    const wav = await ttsMulti2({
      text: prompt,
      speakers: [
        { speaker: a, voiceName: va.voiceName },
        { speaker: b, voiceName: vb.voiceName },
      ],
    });

    return {
      audioBase64Wav: wav.toString("base64"),
      audioMimeType: "audio/wav",
    };
  }

  const wavs = [];

  for (const l of lines) {
    const voiceInfo = voiceBySpeaker.get(l.speaker);

    const linePrompt = `
${directorPrefix}

# AUDIO PROFILE
Speaker ID: ${l.speaker}
Character: ${l.characterName}
Voice gender hint: ${voiceInfo.gender || "unspecified"}
Base direction: ${voiceInfo.actingPrompt || "Natural, scene-appropriate performance."}

# PERFORMANCE NOTES
Emotion: ${l.emotion}
Pace: ${l.pace}
Intensity: ${l.intensity}

# LINE
${l.characterName}: ${l.text}
`.trim();

    const wav = await ttsSingle({
      text: linePrompt,
      voiceName: voiceInfo.voiceName,
    });

    wavs.push(wav);
  }

  const merged = concatWavs(wavs);
  return {
    audioBase64Wav: merged.toString("base64"),
    audioMimeType: "audio/wav",
  };
}

function buildSceneGraph() {
  const g = new StateGraph(SceneState)
    .addNode("write_dialogue", nodeWriteDialogue)
    .addNode("tts", nodeTts)
    .addEdge("__start__", "write_dialogue")
    .addEdge("write_dialogue", "tts")
    .addEdge("tts", "__end__");

  return g.compile();
}

module.exports = { buildSceneGraph };