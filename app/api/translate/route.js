export const runtime = "nodejs";
export const maxDuration = 30;

// Split long text into chunks of at most ~1500 characters on sentence boundaries
function chunkText(text, max = 1500) {
  const parts = text.match(/[^.!?\n]+[.!?]*\s*/g) || [text];
  const out = [];
  let cur = "";
  for (const p of parts) {
    if ((cur + p).length > max && cur) {
      out.push(cur);
      cur = p;
    } else cur += p;
  }
  if (cur.trim()) out.push(cur);
  return out;
}

async function googleTranslate(text, from, to) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t" +
    `&sl=${from}&tl=${to}&q=${encodeURIComponent(text)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("google " + r.status);
  const j = await r.json();
  return (j[0] || []).map((s) => s[0]).join("");
}

async function myMemory(text, from, to) {
  const url =
    "https://api.mymemory.translated.net/get?q=" +
    encodeURIComponent(text.slice(0, 480)) +
    `&langpair=${from}|${to}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("mymemory " + r.status);
  const j = await r.json();
  if (j.responseStatus && Number(j.responseStatus) !== 200)
    throw new Error(j.responseDetails || "mymemory error");
  return j.responseData.translatedText;
}

async function translate(text, from, to) {
  const out = [];
  for (const c of chunkText(text)) {
    try {
      out.push(await googleTranslate(c, from, to));
    } catch {
      out.push(await myMemory(c, from, to));
    }
  }
  return out.join(" ").trim();
}

export async function POST(req) {
  try {
    const { text } = await req.json();
    if (!text || !text.trim()) {
      return Response.json({ error: "Empty text" }, { status: 400 });
    }
    if (text.length > 5000) {
      return Response.json({ error: "Text too long (max 5000 characters)" }, { status: 400 });
    }
    const en = await translate(text.trim(), "fi", "en");
    // Pivot through English for better Myanmar quality
    const my = await translate(en, "en", "my");
    return Response.json({ en, my });
  } catch (e) {
    return Response.json({ error: e.message || "Translation failed" }, { status: 500 });
  }
}
