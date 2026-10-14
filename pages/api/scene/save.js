import { z } from "zod";
import { saveSceneByName } from "../../../lib/sceneStore";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

const ReqSchema = z.object({
  name: z.string().min(2),
  scenePrompt: z.string().min(5),
  speakers: z.array(
    z.object({
      id: z.string().min(1),
      voiceName: z.string().min(1),
      actingPrompt: z.string().optional().default(""),
      gender: z.string().optional().default(""),
    })
  ).min(1),
  dialogue: z.any(),
  audioBase64Wav: z.string().optional(),
});

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = ReqSchema.parse(req.body);
    const out = saveSceneByName(body);

    return res.status(200).json({
      ok: true,
      sceneSlug: out.sceneSlug,
      audioSaved: out.audioSaved,
    });
  } catch (e) {
    console.error("[scene/save] ERROR:", e);
    return res.status(400).json({
      error: e?.message || "Unknown error",
      details: e?.issues || null,
    });
  }
}