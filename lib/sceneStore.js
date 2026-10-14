const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data", "scenes");
const INDEX_FILE = path.join(DATA_DIR, "index.json");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(INDEX_FILE)) {
    fs.writeFileSync(INDEX_FILE, JSON.stringify({ scenes: {} }, null, 2), "utf8");
  }
}

function slugify(name) {
  return (name || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

function readIndex() {
  ensureDirs();
  const raw = fs.readFileSync(INDEX_FILE, "utf8");
  return JSON.parse(raw);
}

function writeIndex(indexObj) {
  ensureDirs();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(indexObj, null, 2), "utf8");
}

function getSceneFolder(sceneSlug) {
  return path.join(DATA_DIR, sceneSlug);
}

function saveSceneByName({ name, scenePrompt, speakers, dialogue, audioBase64Wav }) {
  ensureDirs();
  const sceneSlug = slugify(name);
  if (!sceneSlug) throw new Error("Invalid scene name");

  const folder = getSceneFolder(sceneSlug);
  if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });

  const sceneJsonPath = path.join(folder, "scene.json");
  const audioPath = path.join(folder, "audio.wav");

  // Save scene.json
  const sceneObj = {
    name,
    slug: sceneSlug,
    scenePrompt,
    speakers,
    dialogue,
    createdAt: new Date().toISOString(),
  };

  // If updating existing, preserve original createdAt
  if (fs.existsSync(sceneJsonPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(sceneJsonPath, "utf8"));
      if (prev?.createdAt) sceneObj.createdAt = prev.createdAt;
    } catch {}
  }

  sceneObj.updatedAt = new Date().toISOString();
  fs.writeFileSync(sceneJsonPath, JSON.stringify(sceneObj, null, 2), "utf8");

  // Save audio.wav (optional)
  let audioSaved = false;
  if (audioBase64Wav) {
    const buf = Buffer.from(audioBase64Wav, "base64");
    fs.writeFileSync(audioPath, buf);
    audioSaved = true;
  }

  // Update index.json
  const indexObj = readIndex();
  indexObj.scenes[sceneSlug] = {
    name: sceneSlug,
    path: `${sceneSlug}/scene.json`,
    audioPath: audioSaved ? `${sceneSlug}/audio.wav` : null,
    createdAt: sceneObj.createdAt,
    updatedAt: sceneObj.updatedAt,
  };
  writeIndex(indexObj);

  return { sceneSlug, sceneJsonPath, audioSaved };
}

function loadSceneByName(name) {
  ensureDirs();
  const sceneSlug = slugify(name);
  const folder = getSceneFolder(sceneSlug);
  const sceneJsonPath = path.join(folder, "scene.json");

  if (!fs.existsSync(sceneJsonPath)) return null;

  const sceneObj = JSON.parse(fs.readFileSync(sceneJsonPath, "utf8"));
  const audioPath = path.join(folder, "audio.wav");
  const hasAudio = fs.existsSync(audioPath);

  return {
    ...sceneObj,
    hasAudio,
    audioFilePath: hasAudio ? audioPath : null,
  };
}

function listScenes() {
  const indexObj = readIndex();
  return Object.keys(indexObj.scenes || {}).map((slug) => indexObj.scenes[slug]);
}

function deleteSceneByName(name) {
  ensureDirs();
  const sceneSlug = slugify(name);
  const folder = getSceneFolder(sceneSlug);

  if (!fs.existsSync(folder)) return { deleted: false };

  // Remove folder contents
  for (const f of fs.readdirSync(folder)) {
    fs.unlinkSync(path.join(folder, f));
  }
  fs.rmdirSync(folder);

  const indexObj = readIndex();
  delete indexObj.scenes[sceneSlug];
  writeIndex(indexObj);

  return { deleted: true, sceneSlug };
}

module.exports = {
  slugify,
  saveSceneByName,
  loadSceneByName,
  listScenes,
  deleteSceneByName,
  DATA_DIR,
};