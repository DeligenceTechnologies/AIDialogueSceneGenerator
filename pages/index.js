import { useEffect, useMemo, useState } from "react";

export default function Home() {
  const [voices, setVoices] = useState([]);
  const [sceneList, setSceneList] = useState([]);

  const [sceneName, setSceneName] = useState("train-station-reunion");
  const [scenePrompt, setScenePrompt] = useState(
    "A warm, hopeful reunion at a train station. Subtle emotion, natural pacing."
  );

  const [speakers, setSpeakers] = useState([
    { id: "Male1", voiceName: "", actingPrompt: "Soft-spoken, warm, slightly nervous.", gender: "" },
    { id: "Female1", voiceName: "", actingPrompt: "Relieved, affectionate, steady tone.", gender: "" },
  ]);

  const [forceRegenerate, setForceRegenerate] = useState(false);

  const [loading, setLoading] = useState(false);
  const [dialogue, setDialogue] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [lastAudioBase64Wav, setLastAudioBase64Wav] = useState("");

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/voice");
      const j = await r.json();
      setVoices(j.voices || []);
    })();
  }, []);

  async function refreshSceneList() {
    const r = await fetch("/api/scene/list");
    const j = await r.json();
    setSceneList(j.scenes || []);
  }

  useEffect(() => {
    refreshSceneList();
  }, []);

  useEffect(() => {
    if (!voices.length) return;

    setSpeakers((prev) =>
      prev.map((s, idx) => {
        const chosenVoice =
          s.voiceName && s.voiceName.trim()
            ? voices.find((v) => v.name === s.voiceName) || null
            : voices[Math.min(idx, voices.length - 1)];

        return {
          ...s,
          voiceName: chosenVoice?.name || "",
          gender: chosenVoice?.gender || s.gender || "",
        };
      })
    );
  }, [voices]);

  const canGenerate = useMemo(() => {
    return (
      sceneName.trim().length >= 2 &&
      scenePrompt.trim().length >= 5 &&
      speakers.length >= 1 &&
      speakers.every((s) => s.id.trim() && s.voiceName)
    );
  }, [sceneName, scenePrompt, speakers]);

  function updateSpeaker(i, patch) {
    setSpeakers((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeSpeaker(i) {
    setSpeakers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addSpeaker(genderPrefix) {
    const count = speakers.filter((s) => s.id.startsWith(genderPrefix)).length + 1;

    const matchedVoice =
      voices.find((v) => v.gender?.toLowerCase() === genderPrefix.toLowerCase().replace("male", "male").replace("female", "female")) ||
      voices[0] ||
      null;

    setSpeakers((prev) => [
      ...prev,
      {
        id: `${genderPrefix}${count}`,
        voiceName: matchedVoice?.name || "",
        actingPrompt: "",
        gender: matchedVoice?.gender || "",
      },
    ]);
  }

  function base64ToAudioUrl(b64) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  }

  async function loadSceneByName(nameOverride) {
    const name = (nameOverride ?? sceneName).trim();
    if (!name) return alert("Enter a scene name");

    setLoading(true);
    try {
      const r = await fetch(`/api/scene/get?name=${encodeURIComponent(name)}`);
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to load");

      const s = data.scene;
      setSceneName(s.name || name);
      setScenePrompt(s.scenePrompt || "");
      setSpeakers(s.speakers || []);
      setDialogue(s.dialogue || null);

      if (data.audioBase64Wav) {
        setLastAudioBase64Wav(data.audioBase64Wav);
        setAudioUrl(base64ToAudioUrl(data.audioBase64Wav));
      } else {
        setLastAudioBase64Wav("");
        setAudioUrl("");
      }
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function generateScene() {
    if (!canGenerate) return;

    setLoading(true);
    setDialogue(null);
    setAudioUrl("");
    setLastAudioBase64Wav("");

    try {
      const r = await fetch("/api/scene/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneName,
          scenePrompt,
          speakers,
          force: forceRegenerate,
          autoSave: true,
        }),
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Failed to generate");

      setDialogue(data.dialogue || null);

      if (data.audioBase64Wav) {
        setLastAudioBase64Wav(data.audioBase64Wav);
        setAudioUrl(base64ToAudioUrl(data.audioBase64Wav));
      } else {
        setLastAudioBase64Wav("");
        setAudioUrl("");
      }

      await refreshSceneList();
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveCurrentScene() {
    if (!sceneName.trim()) return alert("Enter a scene name to save");
    if (!dialogue) return alert("Nothing to save yet. Generate or load a scene first.");
  
    setLoading(true);
    try {
      const r = await fetch("/api/scene/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: sceneName,
          scenePrompt,
          speakers,
          dialogue,
          audioBase64Wav: lastAudioBase64Wav || undefined,
        }),
      });
  
      const contentType = r.headers.get("content-type") || "";
      let data;
  
      if (contentType.includes("application/json")) {
        data = await r.json();
      } else {
        const text = await r.text();
        throw new Error(text || `Save failed with status ${r.status}`);
      }
  
      if (!r.ok) {
        throw new Error(data.error || "Save failed");
      }
  
      await refreshSceneList();
      alert("Saved!");
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteScene() {
    const name = sceneName.trim();
    if (!name) return alert("Enter a scene name");
    if (!confirm(`Delete scene "${name}"?`)) return;

    setLoading(true);
    try {
      const r = await fetch(`/api/scene/delete?name=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Delete failed");

      await refreshSceneList();
      setDialogue(null);
      setAudioUrl("");
      setLastAudioBase64Wav("");
      alert("Deleted!");
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  function selectFromDropdown(slug) {
    setSceneName(slug);
  }

  return (
    <main style={{ maxWidth: 1100, margin: "24px auto", padding: 16, fontFamily: "ui-sans-serif" }}>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Dialogue Scene Enactor (Gemini + LangGraph)</h1>

      <section style={card}>
        <h2 style={h2}>Scene Library</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
          <div>
            <div style={label}>Scene name</div>
            <input
              value={sceneName}
              onChange={(e) => setSceneName(e.target.value)}
              placeholder="e.g., train-station-reunion"
              style={input}
            />
          </div>

          <div>
            <div style={label}>Pick from saved scenes</div>
            <select
              value=""
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return;
                selectFromDropdown(v);
              }}
              style={input}
            >
              <option value="">— Select a saved scene —</option>
              {sceneList.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name} {s.updatedAt ? `(${new Date(s.updatedAt).toLocaleString()})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
          <button style={btn} onClick={() => loadSceneByName()} disabled={loading}>
            Load
          </button>
          <button style={btn} onClick={saveCurrentScene} disabled={loading}>
            Save
          </button>
          <button style={{ ...btn, borderColor: "#d66" }} onClick={deleteScene} disabled={loading}>
            Delete
          </button>
          <button style={btn} onClick={refreshSceneList} disabled={loading}>
            Refresh List
          </button>

          <label style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
            <input
              type="checkbox"
              checked={forceRegenerate}
              onChange={(e) => setForceRegenerate(e.target.checked)}
            />
            <span style={{ fontWeight: 700 }}>Force regenerate</span>
          </label>
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>Scene Prompt</h2>
        <textarea
          value={scenePrompt}
          onChange={(e) => setScenePrompt(e.target.value)}
          rows={4}
          style={textarea}
        />
      </section>

      <section style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={h2}>Speakers</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btn} onClick={() => addSpeaker("Male")} disabled={loading}>
              + Male
            </button>
            <button style={btn} onClick={() => addSpeaker("Female")} disabled={loading}>
              + Female
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          {speakers.map((s, i) => (
            <div key={`${s.id}-${i}`} style={{ padding: 12, border: "1px solid #eee", borderRadius: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 140px 44px", gap: 10 }}>
                <input
                  value={s.id}
                  onChange={(e) => updateSpeaker(i, { id: e.target.value })}
                  style={input}
                  placeholder="Male1 / Female1"
                />

                <select
                  value={s.voiceName}
                  onChange={(e) => {
                    const voice = voices.find((v) => v.name === e.target.value);
                    updateSpeaker(i, {
                      voiceName: e.target.value,
                      gender: voice?.gender || "",
                    });
                  }}
                  style={input}
                >
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} — {v.styleHint} — {v.gender}
                    </option>
                  ))}
                </select>

                <input
                  value={s.gender || ""}
                  readOnly
                  style={{ ...input, background: "#f7f7f7" }}
                  placeholder="Voice gender"
                />

                <button style={{ ...btn, padding: "8px 10px" }} onClick={() => removeSpeaker(i)} disabled={loading}>
                  ✕
                </button>
              </div>

              <textarea
                rows={3}
                value={s.actingPrompt}
                onChange={(e) => updateSpeaker(i, { actingPrompt: e.target.value })}
                placeholder="Per-speaker acting prompt"
                style={{ ...textarea, marginTop: 10 }}
              />
            </div>
          ))}
        </div>

        <button
          style={{ ...btn, marginTop: 12, opacity: !canGenerate || loading ? 0.6 : 1 }}
          disabled={!canGenerate || loading}
          onClick={generateScene}
        >
          {loading ? "Working..." : "Generate (or Reuse if Saved)"}
        </button>
      </section>

      {audioUrl && (
        <section style={card}>
          <h2 style={h2}>Audio</h2>
          <audio controls src={audioUrl} style={{ width: "100%", marginTop: 8 }} />
        </section>
      )}

      {dialogue && (
        <>
          <section style={card}>
            <h2 style={h2}>Scene Summary</h2>
            <div style={{ fontWeight: 900, marginTop: 8 }}>{dialogue.title}</div>
            <div style={{ marginTop: 8, color: "#444" }}>
              <strong>Scene mood:</strong> {dialogue.sceneMood}
            </div>
          </section>

          {!!dialogue.characters?.length && (
            <section style={card}>
              <h2 style={h2}>Characters</h2>
              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                {dialogue.characters.map((c, idx) => (
                  <div key={idx} style={lineBox}>
                    <strong>{c.characterName}</strong> ({c.role}) — speaker: {c.speakerId}
                    <div style={{ marginTop: 4, color: "#555" }}>{c.shortDescription}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section style={card}>
            <h2 style={h2}>Script</h2>
            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
              {dialogue.lines?.map((l, idx) => (
                <div key={idx} style={lineBox}>
                  <div>
                    <span style={{ fontWeight: 900 }}>{l.characterName}</span>
                    <span style={{ color: "#666" }}> ({l.speaker})</span>
                  </div>
                  <div style={{ marginTop: 6 }}>{l.text}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "#666" }}>
                    Emotion: <strong>{l.emotion}</strong> | Pace: <strong>{l.pace}</strong> | Intensity: <strong>{l.intensity}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

const card = { marginTop: 16, padding: 12, border: "1px solid #ddd", borderRadius: 12 };
const h2 = { fontSize: 16, fontWeight: 900 };
const label = { fontSize: 13, fontWeight: 800, color: "#333", marginBottom: 6 };
const btn = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #ccc",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
};
const input = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc" };
const textarea = { width: "100%", marginTop: 8, padding: 10, borderRadius: 10, border: "1px solid #ccc" };
const lineBox = { padding: 10, background: "#fafafa", border: "1px solid #eee", borderRadius: 10 };