const { VOICE_OPTIONS } = require("../../lib/voices");

module.exports = function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(200).json({ voices: VOICE_OPTIONS });
};