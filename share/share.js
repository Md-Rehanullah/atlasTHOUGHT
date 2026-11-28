((async () => {
  const params = new URLSearchParams(window.location.search);
  const type = window.location.pathname.split("/").filter(Boolean).pop();
  const reference = document.getElementById("reference");
  const content = document.getElementById("content");
  const notice = document.getElementById("notice");
  const title = document.getElementById("page-title");
  const openInApp = document.getElementById("open-in-app");
  const installLink = document.getElementById("install-rafiq");
  const playStoreUrl = "https://play.google.com/store/apps/details?id=com.atlasThought.Rafiq";
  installLink.href = playStoreUrl;
  const showNotice = (message) => { notice.textContent = message; notice.hidden = false; };
  const value = (key) => (params.get(key) || "").trim();
  const readPayload = async () => {
    const encoded = value("payload");
    if (!encoded) return {};
    if (encoded.length > 50000 || typeof DecompressionStream === "undefined") {
      throw new Error("This browser cannot open the shared content.");
    }
    const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
    const compressed = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
    const reader = stream.getReader();
    const chunks = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 100000) { await reader.cancel(); throw new Error("Shared content is too large."); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  };
  let payload;
  let shareType = type;
  try {
    const shareId = value("s");
    if (shareId) {
      if (!/^[0-9a-f-]{36}$/i.test(shareId)) throw new Error("Invalid share link.");
      const response = await fetch(
        "https://vsimxfxcbdtygqmdmjtb.supabase.co/functions/v1/get-share-link?share_id=" + encodeURIComponent(shareId),
        { headers: { Accept: "application/json" }, cache: "no-store" }
      );
      if (!response.ok) throw new Error("Share link not found.");
      const shared = await response.json();
      if (!shared || !["quran", "hadith", "dua"].includes(shared.type) || shared.type !== type) {
        throw new Error("Share link does not match this page.");
      }
      shareType = shared.type;
      payload = shared.content;
    } else {
      payload = await readPayload();
    }
  }
  catch { showNotice("This share link could not be read. Ask the sender to create a new link from Rafiq."); return; }
  const field = (key) => typeof payload[key] === "string" && payload[key].trim() ? payload[key].trim() : value(key);
  const appParams = new URLSearchParams();
  if (shareType === "hadith" && field("reference")) appParams.set("ref", field("reference"));
  if (shareType === "quran") {
    if (field("surah")) appParams.set("surah", field("surah"));
    if (field("ayah")) appParams.set("ayah", field("ayah"));
  }
  if (shareType === "dua" && field("title")) appParams.set("title", field("title"));
  openInApp.href = "rafiq:///share/" + shareType + (appParams.size ? "?" + appParams.toString() : "");
  const addBlock = (label, text, className, direction) => {
    if (!text) return;
    const section = document.createElement("section");
    const heading = document.createElement("span");
    heading.className = "text-label"; heading.textContent = label;
    const paragraph = document.createElement("p");
    paragraph.className = ("text-block " + (className || "")).trim();
    paragraph.textContent = text;
    if (direction) { paragraph.dir = direction; paragraph.lang = direction === "rtl" ? "ar" : "en"; }
    section.append(heading, paragraph); content.append(section);
  };
  if (type === "quran") {
    const surah = Number(field("surah")), ayah = Number(field("ayah")), page = Number(field("page"));
    if (!Number.isInteger(surah) || surah < 1 || surah > 114 || !Number.isInteger(ayah) || ayah < 1 || ayah > 286) {
      showNotice("This share link is incomplete or invalid. Ask the sender to create a new link from Rafiq."); return;
    }
    title.textContent = "A Quran verse to read and reflect on";
    reference.textContent = (field("name") || ("Surah " + surah)) + " · " + surah + ":" + ayah + (Number.isInteger(page) && page >= 1 && page <= 604 ? " · Page " + page : "");
    reference.hidden = false;
    addBlock("Arabic", field("arabic"), "arabic", "rtl");
    addBlock("Translation · Sahih International", field("translation"), "translation", "ltr");
    if (!field("arabic") && !field("translation")) showNotice("This is an older link that contains the verse reference only. Ask the sender to share it again using the latest version of Rafiq.");
  } else if (type === "hadith") {
    const arabic = field("arabic"), translation = field("translation");
    if (!arabic && !translation) { showNotice("This is an older Hadith link that does not contain the text. Ask the sender to share it again using the latest version of Rafiq."); return; }
    title.textContent = "A Hadith shared from Rafiq";
    reference.textContent = [field("reference") || value("ref"), field("grade"), field("gradedBy")].filter(Boolean).join(" · "); reference.hidden = !reference.textContent;
    if (field("narrator")) addBlock("Narrated by", field("narrator"), "", "ltr");
    addBlock("Arabic", arabic, "arabic", "rtl"); addBlock("Translation", translation, "translation", "ltr");
  } else if (type === "dua") {
    const arabic = field("arabic"), translation = field("translation");
    if (!arabic && !translation) { showNotice("This is an older Dua link that does not contain the text. Ask the sender to share it again using the latest version of Rafiq."); return; }
    title.textContent = field("title") || "A Dua shared from Rafiq";
    addBlock("Arabic", arabic, "arabic", "rtl"); addBlock("Transliteration", field("transliteration"), "", "ltr"); addBlock("Translation", translation, "translation", "ltr");
    if (field("reference")) { reference.textContent = field("reference"); reference.hidden = false; }
  } else { showNotice("Open a complete Quran, Hadith, or Dua link shared from the Rafiq app."); }
})());
