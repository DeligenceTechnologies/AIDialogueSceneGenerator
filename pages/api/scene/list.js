import { listScenes } from "../../../lib/sceneStore";

export default function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  return res.status(200).json({ scenes: listScenes() });
}