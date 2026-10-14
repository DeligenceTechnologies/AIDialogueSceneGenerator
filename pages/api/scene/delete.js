import { deleteSceneByName } from "../../../lib/sceneStore";

export default function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).json({ error: "Method not allowed" });

  const name = req.query.name;
  if (!name) return res.status(400).json({ error: "Missing name" });

  const out = deleteSceneByName(name);
  if (!out.deleted) return res.status(404).json({ error: "Scene not found" });

  return res.status(200).json({ ok: true, sceneSlug: out.sceneSlug });
}