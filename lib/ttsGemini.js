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

function addWavHeader(pcmData, sampleRate = 24000) {
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);

  header.write("data", 36);
  header.writeUInt32LE(pcmData.length, 40);

  return Buffer.concat([header, pcmData]);
}

function extractAudioBase64(response) {
  return response?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
}

async function ttsSingle({ text, voiceName }) {
  const ai = getAi();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const b64 = extractAudioBase64(response);
  if (!b64) throw new Error("Single-speaker TTS returned no audio");

  const pcm = Buffer.from(b64, "base64");
  return addWavHeader(pcm, 24000);
}

async function ttsMulti2({ text, speakers }) {
  if (!Array.isArray(speakers) || speakers.length !== 2) {
    throw new Error("ttsMulti2 requires exactly 2 speakers");
  }

  const ai = getAi();

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: speakers.map((s) => ({
            speaker: s.speaker,
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: s.voiceName },
            },
          })),
        },
      },
    },
  });

  const b64 = extractAudioBase64(response);
  if (!b64) throw new Error("Multi-speaker TTS returned no audio");

  const pcm = Buffer.from(b64, "base64");
  return addWavHeader(pcm, 24000);
}

function concatWavs(wavBuffers) {
  if (!wavBuffers.length) throw new Error("No wav buffers to concatenate");
  const pcmChunks = wavBuffers.map((b) => b.subarray(44));
  const pcm = Buffer.concat(pcmChunks);
  return addWavHeader(pcm, 24000);
}

module.exports = {
  ttsSingle,
  ttsMulti2,
  concatWavs,
  addWavHeader,
};