import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

export const runtime = "nodejs";
export const maxDuration = 60;

const VOICES = {
  fi: "fi-FI-NooraNeural",
  en: "en-US-AriaNeural",
  my: "my-MM-NilarNeural",
};

function readAll(stream) {
  return new Promise((resolve, reject) => {
    const bufs = [];
    stream.on("data", (d) => bufs.push(Buffer.from(d)));
    stream.on("end", () => resolve(Buffer.concat(bufs)));
    stream.on("error", reject);
    stream.on("close", () => resolve(Buffer.concat(bufs)));
  });
}

export async function POST(req) {
  let tts;
  try {
    const { text, lang, rate } = await req.json();
    const voice = VOICES[lang];
    if (!voice) return Response.json({ error: "Unsupported language" }, { status: 400 });
    if (!text || !text.trim()) return Response.json({ error: "Empty text" }, { status: 400 });
    if (text.length > 5000) return Response.json({ error: "Text too long" }, { status: 400 });

    tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    const r = Number(rate);
    const pct = Number.isFinite(r) ? Math.round((r - 1) * 100) : 0;
    const prosody = { rate: `${pct >= 0 ? "+" : ""}${pct}%` };

    const { audioStream } = tts.toStream(text.trim(), prosody);
    const audio = await readAll(audioStream);
    if (!audio.length) throw new Error("No audio returned");

    return new Response(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: e.message || "TTS failed" }, { status: 500 });
  } finally {
    try {
      tts?.close();
    } catch {}
  }
}
