"use client";

import { useRef, useState } from "react";

const LANG_NAME = { fi: "finnish", en: "english", my: "myanmar" };

export default function Home() {
  const [fi, setFi] = useState("");
  const [en, setEn] = useState("");
  const [my, setMy] = useState("");
  const [rate, setRate] = useState(0.9);
  const [status, setStatus] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [audioBusy, setAudioBusy] = useState("");
  const audioRef = useRef(null);

  const [query, setQuery] = useState("");
  const [dict, setDict] = useState(null);
  const [dictBusy, setDictBusy] = useState(false);
  const [dictErr, setDictErr] = useState("");

  const texts = { fi, en, my };

  const words = Array.from(
    new Set(
      (fi.match(/[\p{L}\p{M}'-]+/gu) || [])
        .map((w) => w.replace(/^['-]+|['-]+$/g, ""))
        .filter((w) => w.length > 1)
        .map((w) => w.toLowerCase())
    )
  ).slice(0, 60);

  async function lookup(w) {
    const word = (w || query).trim().toLowerCase();
    if (!word) return;
    setQuery(word);
    setDictBusy(true);
    setDictErr("");
    setDict(null);
    try {
      const r = await fetch("/api/define?word=" + encodeURIComponent(word));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Lookup failed");
      setDict(j);
    } catch (e) {
      setDictErr(e.message === "Word not found" ? "စာလုံး ရှာမတွေ့ပါ — စာလုံးပုံစံ (ဥပမာ - talo) နဲ့ ပြန်စမ်းပါ" : e.message);
    } finally {
      setDictBusy(false);
    }
  }

  async function playWord(text, lang) {
    try {
      const r = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang, rate }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Audio failed");
      const url = URL.createObjectURL(await r.blob());
      if (audioRef.current) audioRef.current.pause();
      const a = new Audio(url);
      audioRef.current = a;
      await a.play();
    } catch (e) {
      setDictErr(e.message);
    }
  }

  function say(msg, err = false) {
    setStatus(msg);
    setIsError(err);
  }

  async function translate() {
    if (!fi.trim()) return;
    setBusy(true);
    setEn("");
    setMy("");
    say("Translating…");
    try {
      const r = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: fi }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Translation failed");
      setEn(j.en);
      setMy(j.my);
      say("Done ✓");
    } catch (e) {
      say("Error: " + e.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function fetchMp3(lang) {
    const r = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: texts[lang], lang, rate }),
    });
    if (!r.ok) {
      let msg = "Audio failed";
      try {
        msg = (await r.json()).error || msg;
      } catch {}
      throw new Error(msg);
    }
    return await r.blob();
  }

  async function play(lang) {
    if (!texts[lang].trim()) return;
    setAudioBusy(lang + "-play");
    say("Generating audio…");
    try {
      const blob = await fetchMp3(lang);
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const a = new Audio(url);
      audioRef.current = a;
      await a.play();
      say("");
    } catch (e) {
      say("Error: " + e.message, true);
    } finally {
      setAudioBusy("");
    }
  }

  async function download(lang) {
    if (!texts[lang].trim()) return;
    setAudioBusy(lang + "-dl");
    say("Creating MP3…");
    try {
      const blob = await fetchMp3(lang);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${LANG_NAME[lang]}.mp3`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      say("MP3 downloaded ✓");
    } catch (e) {
      say("Error: " + e.message, true);
    } finally {
      setAudioBusy("");
    }
  }

  async function downloadAll() {
    for (const l of ["fi", "en", "my"]) {
      if (texts[l].trim()) await download(l);
    }
  }

  function Buttons({ lang }) {
    const has = !!texts[lang].trim();
    return (
      <div className="actions">
        <button className="small" disabled={!has || !!audioBusy} onClick={() => play(lang)}>
          {audioBusy === lang + "-play" ? "…" : "🔊 Listen"}
        </button>
        <button className="small" disabled={!has || !!audioBusy} onClick={() => download(lang)}>
          {audioBusy === lang + "-dl" ? "…" : "⬇ MP3"}
        </button>
      </div>
    );
  }

  return (
    <main>
      <h1>🇫🇮 Finnish → English / မြန်မာ</h1>
      <p className="sub">ဖင်လန်စာ ရိုက်ထည့်ပါ၊ ဘာသာပြန်ပြီး ဘာသာစကား ၃ မျိုးလုံးကို MP3 အဖြစ် download လုပ်နိုင်ပါတယ်။</p>

      <div className="card">
        <h2>
          Finnish <Buttons lang="fi" />
        </h2>
        <textarea
          value={fi}
          onChange={(e) => setFi(e.target.value)}
          placeholder="Kirjoita tähän suomeksi… (ဥပမာ - Hyvää huomenta!)"
        />
        <div className="row">
          <button className="primary" onClick={translate} disabled={busy || !fi.trim()}>
            {busy ? "Translating…" : "Translate"}
          </button>
          <button
            onClick={() => {
              setFi("");
              setEn("");
              setMy("");
              say("");
            }}
          >
            Clear
          </button>
          <button onClick={downloadAll} disabled={!!audioBusy || !fi.trim()}>
            ⬇ All 3 MP3
          </button>
          <label>
            Speed
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={rate}
              onChange={(e) => setRate(parseFloat(e.target.value))}
            />
            {rate.toFixed(1)}x
          </label>
        </div>
        <div className={"status" + (isError ? " err" : "")}>{status}</div>
      </div>

      <div className="card">
        <h2>📖 Dictionary · အဘိဓာန်</h2>
        <form
          className="row"
          style={{ marginTop: 0 }}
          onSubmit={(e) => {
            e.preventDefault();
            lookup();
          }}
        >
          <input
            className="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Finnish စာလုံးတစ်လုံး ရိုက်ပါ (ဥပမာ - talo)"
          />
          <button className="primary" type="submit" disabled={dictBusy || !query.trim()}>
            {dictBusy ? "…" : "Search"}
          </button>
        </form>

        {words.length > 0 && (
          <div className="chips">
            {words.map((w) => (
              <button key={w} className="chip" onClick={() => lookup(w)}>
                {w}
              </button>
            ))}
          </div>
        )}

        {dictErr && <div className="status err">{dictErr}</div>}

        {dict && (
          <div className="dict">
            <div className="dict-head">
              <strong>{dict.word}</strong>
              <button className="small" onClick={() => playWord(dict.word, "fi")}>
                🔊
              </button>
            </div>
            <div>
              <span className="tag">EN</span> {dict.en || "—"}
              <button className="small linkish" onClick={() => dict.en && playWord(dict.en, "en")}>
                🔊
              </button>
            </div>
            <div>
              <span className="tag">မြန်မာ</span> {dict.my || "—"}
              <button className="small linkish" onClick={() => dict.my && playWord(dict.my, "my")}>
                🔊
              </button>
            </div>

            {dict.alternatives.length > 0 && (
              <div className="dict-sec">
                <div className="dict-label">အခြားအဓိပ္ပာယ်များ</div>
                {dict.alternatives.map((a, i) => (
                  <div key={i} className="alt">
                    <em>{a.pos}</em>:{" "}
                    {a.words.map((w, j) => (
                      <span key={j}>
                        {w.en}
                        {w.my ? ` (${w.my})` : ""}
                        {j < a.words.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {dict.meanings.length > 0 && (
              <div className="dict-sec">
                <div className="dict-label">ရှင်းလင်းချက် (Wiktionary)</div>
                {dict.meanings.map((m, i) => (
                  <div key={i} className="meaning">
                    <em>{m.pos}</em>
                    <ol>
                      {m.definitions.map((d, j) => (
                        <li key={j}>
                          {d.text}
                          {d.example && <div className="ex">“{d.example}”</div>}
                        </li>
                      ))}
                    </ol>
                    {m.firstMy && <div className="myd">မြန်မာ: {m.firstMy}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card">
        <h2>
          English <Buttons lang="en" />
        </h2>
        <div className="out">{en}</div>
      </div>

      <div className="card">
        <h2>
          မြန်မာ <Buttons lang="my" />
        </h2>
        <div className="out">{my}</div>
      </div>
    </main>
  );
}
