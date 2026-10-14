import { z } from "zod";
import { buildSceneGraph } from "../../../lib/graph/sceneGraph";
import { loadSceneByName, saveSceneByName } from "../../../lib/sceneStore";

const ReqSchema = z.object({
  sceneName: z.string().min(2),
  scenePrompt: z.string().min(5),
  speakers: z.array(
    z.object({
      id: z.string().min(1),
      voiceName: z.string().min(1),
      actingPrompt: z.string().optional().default(""),
      gender: z.string().optional().default(""),
    })
  ).min(1),
  force: z.boolean().optional().default(false),
  autoSave: z.boolean().optional().default(true),
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const input = ReqSchema.parse(req.body);

    console.log("[scene/generate] request body:", JSON.stringify(input, null, 2));

    if (!input.force) {
      const cached = loadSceneByName(input.sceneName);
      if (cached) {
        let audioBase64Wav = null;
        if (cached.hasAudio && cached.audioFilePath) {
          const fs = require("fs");
          audioBase64Wav = fs.readFileSync(cached.audioFilePath).toString("base64");
        }

        console.log("[scene/generate] returning cached scene:", input.sceneName);

        return res.status(200).json({
          cached: true,
          sceneName: cached.name,
          dialogue: cached.dialogue,
          audioBase64Wav,
          audioMimeType: cached.hasAudio ? "audio/wav" : null,
        });
      }
    }

    console.log("[scene/generate] building graph...");
    const graph = buildSceneGraph();

    console.log("[scene/generate] invoking graph...");
    const out = await graph.invoke({
      input: {
        scenePrompt: input.scenePrompt,
        speakers: input.speakers,
      },
      dialogue: null,
      audioBase64Wav: null,
      audioMimeType: null,
    });

    console.log("[scene/generate] graph output keys:", Object.keys(out || {}));
    console.log("[scene/generate] dialogue title:", out?.dialogue?.title);
    console.log("[scene/generate] lines count:", out?.dialogue?.lines?.length || 0);
    console.log("[scene/generate] has audio:", !!out?.audioBase64Wav);

    if (input.autoSave) {
      saveSceneByName({
        name: input.sceneName,
        scenePrompt: input.scenePrompt,
        speakers: input.speakers,
        dialogue: out.dialogue,
        audioBase64Wav: out.audioBase64Wav,
      });
      console.log("[scene/generate] scene saved:", input.sceneName);
    }

    return res.status(200).json({
      cached: false,
      sceneName: input.sceneName,
      dialogue: out.dialogue,
      audioBase64Wav: out.audioBase64Wav,
      audioMimeType: out.audioMimeType,
    });
  } catch (e) {
    console.error("[scene/generate] ERROR:", e);
    console.error("[scene/generate] ERROR message:", e?.message);
    console.error("[scene/generate] ERROR stack:", e?.stack);

    if (e?.issues) {
      console.error("[scene/generate] Zod issues:", JSON.stringify(e.issues, null, 2));
    }

    return res.status(400).json({
      error: e?.message || "Unknown error",
      details: e?.issues || null,
    });
  }
}