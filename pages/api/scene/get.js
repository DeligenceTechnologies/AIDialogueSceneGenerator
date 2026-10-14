import fs from "fs";
import { loadSceneByName } from "../../../lib/sceneStore";
import { VOICE_OPTIONS } from "../../../lib/voices";

function normalizeSpeakers(speakers = []) {
  return speakers.map((s) => {
    const matchedVoice = VOICE_OPTIONS.find((v) => v.name === s.voiceName);

    return {
      id: s.id || "",
      voiceName: s.voiceName || "",
      actingPrompt: s.actingPrompt || "",
      gender: s.gender || matchedVoice?.gender || "",
      styleHint: matchedVoice?.styleHint || "",
      vibe: matchedVoice?.vibe || "",
    };
  });
}

export default function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const name = req.query.name;
  if (!name) {
    return res.status(400).json({ error: "Missing name" });
  }

  const scene = loadSceneByName(name);
  if (!scene) {
    return res.status(404).json({ error: "Scene not found" });
  }

  let audioBase64Wav = null;
  if (scene.hasAudio && scene.audioFilePath && fs.existsSync(scene.audioFilePath)) {
    const buf = fs.readFileSync(scene.audioFilePath);
    audioBase64Wav = buf.toString("base64");
  }

  const normalizedSpeakers = normalizeSpeakers(scene.speakers || []);

  return res.status(200).json({
    scene: {
      name: scene.name,
      slug: scene.slug,
      scenePrompt: scene.scenePrompt,
      speakers: normalizedSpeakers,
      dialogue: scene.dialogue,
      createdAt: scene.createdAt,
      updatedAt: scene.updatedAt,
      hasAudio: scene.hasAudio,
    },
    audioBase64Wav,
    audioMimeType: scene.hasAudio ? "audio/wav" : null,
  });
}