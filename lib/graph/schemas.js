const { z } = require("zod");

const CharacterSchema = z.object({
  speakerId: z.string().min(1),
  characterName: z.string().min(1),
  role: z.string().min(1),
  shortDescription: z.string().min(1),
});

const DialogueLineSchema = z.object({
  speaker: z.string().min(1),
  characterName: z.string().min(1),
  text: z.string().min(1),
  emotion: z.string().min(1),
  pace: z.enum(["slow", "medium", "fast"]),
  intensity: z.enum(["low", "medium", "high"]),
});

const DialogueSchema = z.object({
  title: z.string().min(1),
  sceneMood: z.string().min(1),
  characters: z.array(CharacterSchema).min(1),
  lines: z.array(DialogueLineSchema).min(2),
});

module.exports = { DialogueSchema };