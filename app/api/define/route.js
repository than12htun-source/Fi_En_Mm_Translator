export const runtime = "nodejs";
export const maxDuration = 30;

async function gtx(text, from, to, extra = "") {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t" +
    extra +
    `&sl=${from}&tl=${to}&q=${encodeURIComponent(text)}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error("translate " + r.status);
  return r.json();
}

async function tr(text, from, to) {
  try {
    const j = await gtx(text, from, to);
    return (j[0] || []).map((s) => s[0]).join("").trim();
  } catch {
    return "";
  }
}

function clean(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function wiktionary(word) {
  try {
    const r = await fetch(
      "https://en.wiktionary.org/api/rest_v1/page/definition/" + encodeURIComponent(word),
      { headers: { "User-Agent": "fi-translator-app/1.0 (learning tool)" }, cache: "no-store" }
    );
    if (!r.ok) return [];
    const j = await r.json();
    const entries = j.fi || [];
    return entries.slice(0, 4).map((e) => ({
      pos: e.partOfSpeech,
      definitions: (e.definitions || [])
        .map((d) => ({
          text: clean(d.definition),
          example: d.examples && d.examples[0] ? clean(d.examples[0]) : "",
        }))
        .filter((d) => d.text)
        .slice(0, 3),
    }));
  } catch {
    return [];
  }
}

export async function GET(req) {
  try {
    const word = (new URL(req.url).searchParams.get("word") || "").trim();
    if (!word || word.length > 60 || /\s{2,}/.test(word)) {
      return Response.json({ error: "Invalid word" }, { status: 400 });
    }

    const [main, defs] = await Promise.all([
      gtx(word, "fi", "en", "&dt=bd").catch(() => null),
      wiktionary(word),
    ]);

    const en = main ? (main[0] || []).map((s) => s[0]).join("").trim() : "";
    const alt = [];
    if (main && Array.isArray(main[1])) {
      for (const g of main[1]) {
        alt.push({ pos: g[0], words: (g[1] || []).slice(0, 5) });
      }
    }

    // Myanmar: main word + first few alternatives + first definition of each part of speech
    const myMain = en ? await tr(en, "en", "my") : "";
    const altWords = [...new Set(alt.flatMap((a) => a.words))].slice(0, 6);
    const altMy = await Promise.all(altWords.map((w) => tr(w, "en", "my")));
    const myMap = {};
    altWords.forEach((w, i) => (myMap[w] = altMy[i]));

    const defsMy = await Promise.all(
      defs.map((d) => (d.definitions[0] ? tr(d.definitions[0].text, "en", "my") : ""))
    );
    const meanings = defs.map((d, i) => ({ ...d, firstMy: defsMy[i] }));

    if (!en && !meanings.length) {
      return Response.json({ error: "Word not found" }, { status: 404 });
    }

    return Response.json({
      word,
      en,
      my: myMain,
      alternatives: alt.map((a) => ({
        pos: a.pos,
        words: a.words.map((w) => ({ en: w, my: myMap[w] || "" })),
      })),
      meanings,
    });
  } catch (e) {
    return Response.json({ error: e.message || "Lookup failed" }, { status: 500 });
  }
}
