const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE";

// ---------- Palette (asphalt / hazard theme, consistent with RoadGuard AI) ----------
const ASPHALT = "1C1D1F";
const ASPHALT_2 = "2A2C2F";
const AMBER = "F2A900";
const AMBER_DARK = "6E4B00";
const RED = "D62839";
const RED_DARK = "6E1420";
const WHITE = "FFFFFF";
const OFFWHITE = "F7F6F3";
const MUTED = "6B6F73";
const TEXT_DARK = "1C1D1F";
const TEAL = "0F6E56";
const TEAL_LIGHT = "E1F5EE";
const AMBER_LIGHT = "FAEEDA";
const RED_LIGHT = "FCEBEB";

const FONT_HEAD = "Cambria";
const FONT_BODY = "Calibri";

// =========================================================
// SLIDE 1 — Title
// =========================================================
{
  const s = pres.addSlide();
  s.background = { color: ASPHALT };

  s.addText("RoadScan AI", {
    x: 0.8, y: 2.55, w: 11.7, h: 1.1, fontFace: FONT_HEAD, fontSize: 46, bold: true, color: WHITE, margin: 0,
  });
  s.addText("Continuous camera detection with real-time driver alerts", {
    x: 0.8, y: 3.6, w: 10.5, h: 0.6, fontFace: FONT_BODY, fontSize: 20, color: AMBER, margin: 0,
  });
  s.addText("Detects, warns the driver in the moment, geotags, and prioritizes repairs - built on a real, tested YOLOv8 model.", {
    x: 0.8, y: 4.2, w: 10.3, h: 0.5, fontFace: FONT_BODY, fontSize: 13, color: "B8BBBE", italic: true, margin: 0,
  });

  s.addText("ET AI HACKATHON 2026", { x: 0.8, y: 0.5, w: 5, h: 0.3, fontFace: FONT_BODY, fontSize: 11, bold: true, color: "9A9D9F", charSpacing: 2, margin: 0 });
  s.addText("Smart Cities  •  Public Safety", { x: 0.8, y: 0.82, w: 5, h: 0.3, fontFace: FONT_BODY, fontSize: 11, color: AMBER, margin: 0 });

  const stats = [["9,438", "pothole deaths, 2020-2024"], ["53%", "rise in 5 years"], ["\u20B96 lakh", "civic liability per death (2025 ruling)"]];
  let sx = 0.8;
  stats.forEach(([num, label]) => {
    s.addText(num, { x: sx, y: 5.55, w: 3.6, h: 0.55, fontFace: FONT_HEAD, fontSize: 26, bold: true, color: WHITE, margin: 0 });
    s.addText(label, { x: sx, y: 6.15, w: 3.6, h: 0.4, fontFace: FONT_BODY, fontSize: 12, color: "9A9D9F", margin: 0 });
    sx += 3.7;
  });
}

// =========================================================
// SLIDE 2 — The crisis
// =========================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  s.addText("THE CRISIS", { x: 0.8, y: 0.5, w: 5, h: 0.3, fontFace: FONT_BODY, fontSize: 11, bold: true, color: RED, charSpacing: 2, margin: 0 });
  s.addText("Potholes kill about 5 people a day in India", {
    x: 0.8, y: 0.82, w: 11, h: 0.7, fontFace: FONT_HEAD, fontSize: 30, bold: true, color: TEXT_DARK, margin: 0,
  });

  const cards = [
    { num: "9,438", lbl: "lives lost to pothole accidents, 2020-2024 (MoRTH, tabled in Parliament)", fill: RED_LIGHT, txt: RED_DARK },
    { num: "53%", lbl: "rise in pothole deaths over just 5 years - despite rising road spend", fill: RED_LIGHT, txt: RED_DARK },
    { num: "54%", lbl: "of all pothole deaths nationally happened in one state - Uttar Pradesh", fill: AMBER_LIGHT, txt: AMBER_DARK },
    { num: "\u20B96 lakh", lbl: "compensation per death - Bombay HC's Oct 2025 strict-liability ruling on civic bodies", fill: AMBER_LIGHT, txt: AMBER_DARK },
  ];
  let cx = 0.8;
  cards.forEach((c) => {
    s.addShape("roundRect", { x: cx, y: 1.85, w: 2.85, h: 2.7, rectRadius: 0.12, fill: { color: c.fill }, line: { type: "none" } });
    s.addText(c.num, { x: cx + 0.2, y: 2.1, w: 2.45, h: 0.8, fontFace: FONT_HEAD, fontSize: 26, bold: true, color: c.txt, margin: 0 });
    s.addText(c.lbl, { x: cx + 0.2, y: 2.9, w: 2.45, h: 1.5, fontFace: FONT_BODY, fontSize: 11.5, color: c.txt, margin: 0, lineSpacingMultiple: 1.15 });
    cx += 3.05;
  });

  s.addText("Bengaluru traffic police say deaths are under-reported and civic bodies are alerted \"almost every day\" without action.", {
    x: 0.8, y: 4.85, w: 11.5, h: 0.5, fontFace: FONT_BODY, fontSize: 13.5, italic: true, color: MUTED, margin: 0,
  });
  s.addText("Source: MoRTH data tabled in Lok Sabha, 2025; Bombay High Court ruling, October 2025; Deccan Herald reporting.", {
    x: 0.8, y: 6.9, w: 11.5, h: 0.35, fontFace: FONT_BODY, fontSize: 10, color: MUTED, margin: 0,
  });
}

// =========================================================
// SLIDE 3 — The gap
// =========================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  s.addText("THE GAP", { x: 0.8, y: 0.5, w: 5, h: 0.3, fontFace: FONT_BODY, fontSize: 11, bold: true, color: RED, charSpacing: 2, margin: 0 });
  s.addText("Detection is manual, inconsistent, and reactive", {
    x: 0.8, y: 0.82, w: 11, h: 0.7, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: TEXT_DARK, margin: 0,
  });

  s.addShape("roundRect", { x: 0.8, y: 1.85, w: 5.7, h: 4.6, rectRadius: 0.12, fill: { color: OFFWHITE }, line: { color: "E5E3DD", width: 1 } });
  s.addText("How it works today", { x: 1.1, y: 2.1, w: 5.1, h: 0.4, fontFace: FONT_BODY, fontSize: 14, bold: true, color: TEXT_DARK, margin: 0 });
  s.addText([
    { text: "Citizens or officers spot a pothole and report it manually, if at all.", options: { fontSize: 13, color: TEXT_DARK, bullet: true, breakLine: true } },
    { text: "Traffic police say they alert civic bodies \"almost every day\" with no consistent action.", options: { fontSize: 13, color: TEXT_DARK, bullet: true, breakLine: true } },
    { text: "A death only counts as \"pothole-related\" if the FIR explicitly says so - so the true toll is likely undercounted.", options: { fontSize: 13, color: TEXT_DARK, bullet: true, breakLine: true } },
    { text: "No systematic way to verify a repair actually happened.", options: { fontSize: 13, color: TEXT_DARK, bullet: true, breakLine: false } },
  ], { x: 1.1, y: 2.6, w: 5.1, h: 3.6, fontFace: FONT_BODY, valign: "top", margin: 0, paraSpaceAfter: 10 });

  s.addShape("roundRect", { x: 6.8, y: 1.85, w: 5.7, h: 4.6, rectRadius: 0.12, fill: { color: TEAL_LIGHT }, line: { type: "none" } });
  s.addText("What we add", { x: 7.1, y: 2.1, w: 5.1, h: 0.4, fontFace: FONT_BODY, fontSize: 14, bold: true, color: TEAL, margin: 0 });
  s.addText([
    { text: "A continuous camera signal watches the road as the vehicle drives - not a recording reviewed later.", options: { fontSize: 13, bold: true, color: "085041", bullet: true, breakLine: true } },
    { text: "The driver is warned immediately - on-screen and audibly - the moment a pothole is detected, with real reaction time to slow down.", options: { fontSize: 13, bold: true, color: "085041", bullet: true, breakLine: true } },
    { text: "The same detection is geotagged and merged into the municipal repair queue - one pass, two audiences.", options: { fontSize: 13, color: "085041", bullet: true, breakLine: true } },
    { text: "A later pass driving the same route without a detection closes the loop - repair verified automatically.", options: { fontSize: 13, color: "085041", bullet: true, breakLine: false } },
  ], { x: 7.1, y: 2.6, w: 5.1, h: 3.6, fontFace: FONT_BODY, valign: "top", margin: 0, paraSpaceAfter: 8 });
}

// =========================================================
// SLIDE 4 — Solution pillars
// =========================================================
{
  const s = pres.addSlide();
  s.background = { color: ASPHALT };

  s.addText("THE SOLUTION", { x: 0.8, y: 0.55, w: 6, h: 0.3, fontFace: FONT_BODY, fontSize: 11, bold: true, color: AMBER, charSpacing: 2, margin: 0 });
  s.addText("From a continuous camera signal to a warned driver", {
    x: 0.8, y: 0.9, w: 11.5, h: 0.9, fontFace: FONT_HEAD, fontSize: 26, bold: true, color: WHITE, margin: 0,
  });

  const pillars = [
    { title: "Watch & warn", body: "A live camera feed is watched continuously. The moment a pothole is detected, the driver gets an immediate visual + audio warning - in time to react." },
    { title: "Prioritize", body: "Every detection is geotagged and ranked by severity x road type x how many times it's been re-confirmed." },
    { title: "Verify repairs", body: "Closes the loop: two independent clean passes over a known pothole location auto-marks it repaired." },
  ];
  let px = 0.8;
  pillars.forEach((p) => {
    s.addShape("roundRect", { x: px, y: 2.15, w: 3.75, h: 3.9, rectRadius: 0.12, fill: { color: ASPHALT_2 }, line: { color: "3A3D40", width: 1 } });
    s.addShape("roundRect", { x: px + 0.3, y: 2.5, w: 0.55, h: 0.55, rectRadius: 0.28, fill: { color: AMBER }, line: { type: "none" } });
    s.addText(p.title, { x: px + 0.3, y: 3.25, w: 3.15, h: 0.5, fontFace: FONT_HEAD, fontSize: 18, bold: true, color: WHITE, margin: 0 });
    s.addText(p.body, { x: px + 0.3, y: 3.8, w: 3.15, h: 2.0, fontFace: FONT_BODY, fontSize: 13, color: "C9CCCE", margin: 0, lineSpacingMultiple: 1.2 });
    px += 4.05;
  });
}

// =========================================================
// SLIDE 5 — Architecture
// =========================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  s.addText("ARCHITECTURE", { x: 0.8, y: 0.5, w: 6, h: 0.3, fontFace: FONT_BODY, fontSize: 11, bold: true, color: TEAL, charSpacing: 2, margin: 0 });
  s.addText("Continuous signal in, driver warned, repair queued", {
    x: 0.8, y: 0.82, w: 11.5, h: 0.7, fontFace: FONT_HEAD, fontSize: 27, bold: true, color: TEXT_DARK, margin: 0,
  });

  const stages = [
    { title: "Camera signal + GPS provider", sub: "Webcam, dashcam, or phone stream + live position", fill: OFFWHITE, txt: TEXT_DARK, border: "D9D6CE" },
    { title: "Live capture loop (background thread)", sub: "Samples frames, runs YOLOv8-seg detection", fill: TEAL_LIGHT, txt: "085041", border: "9FE1CB" },
    { title: "Geotag + deduplicate", sub: "Merges repeat sightings of one pothole", fill: OFFWHITE, txt: TEXT_DARK, border: "D9D6CE" },
    { title: "Alert manager", sub: "core innovation - insists the driver, with cooldown", fill: AMBER_LIGHT, txt: AMBER_DARK, border: "F0C978" },
    { title: "Driver alert (WebSocket) + Priority dashboard", sub: "Visual + audio warning, and the municipal repair queue - same detection, two audiences", fill: TEAL_LIGHT, txt: "085041", border: "9FE1CB" },
  ];

  let sy = 1.7;
  const boxH = 0.78;
  const gap = 0.14;
  stages.forEach((st, i) => {
    s.addShape("roundRect", { x: 1.6, y: sy, w: 10.1, h: boxH, rectRadius: 0.08, fill: { color: st.fill }, line: { color: st.border, width: 1 } });
    s.addText(st.title, { x: 1.85, y: sy + 0.08, w: 9.6, h: 0.34, fontFace: FONT_BODY, fontSize: 14, bold: true, color: st.txt, margin: 0 });
    s.addText(st.sub, { x: 1.85, y: sy + 0.42, w: 9.6, h: 0.32, fontFace: FONT_BODY, fontSize: 11, color: st.txt, margin: 0 });
    sy += boxH + gap;
  });
}

// =========================================================
// SLIDE 6 — Proof it works (real test run)
// =========================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  s.addText("PROOF, NOT A MOCKUP", { x: 0.8, y: 0.5, w: 6, h: 0.3, fontFace: FONT_BODY, fontSize: 11, bold: true, color: AMBER_DARK, charSpacing: 2, margin: 0 });
  s.addText("Tested end-to-end with a real photo, not a placeholder", {
    x: 0.8, y: 0.82, w: 11.5, h: 0.8, fontFace: FONT_HEAD, fontSize: 26, bold: true, color: TEXT_DARK, margin: 0,
  });

  const rows = [
    [{ text: "Test", options: { bold: true, fill: { color: ASPHALT }, color: WHITE } },
     { text: "What was run", options: { bold: true, fill: { color: ASPHALT }, color: WHITE } },
     { text: "Result", options: { bold: true, fill: { color: ASPHALT }, color: WHITE } }],
    [{ text: "Real detection" }, { text: "Real pothole photo through the live capture code path" }, { text: "81% confidence, classified \"severe\", correctly geotagged", options: { color: TEAL, bold: true } }],
    [{ text: "Immediate alert" }, { text: "First-ever sighting of that pothole" }, { text: "Driver alert fired instantly - \"SEVERE POTHOLE AHEAD\"", options: { color: TEAL, bold: true } }],
    [{ text: "Dedup on re-sighting" }, { text: "Same photo processed again at the same location" }, { text: "Merged into the same record (sighting_count: 2), not duplicated", options: { color: TEAL, bold: true } }],
    [{ text: "Alert cooldown" }, { text: "Immediate re-detection of the same pothole" }, { text: "Correctly suppressed - no repeat alert spam", options: { color: TEAL, bold: true } }],
  ];
  s.addTable(rows, {
    x: 0.8, y: 1.8, w: 11.7, h: 2.7, fontFace: FONT_BODY, fontSize: 12,
    border: { type: "solid", color: "E5E3DD", pt: 0.75 }, autoPage: false,
    colW: [1.9, 4.9, 4.9],
    valign: "middle",
  });

  s.addShape("roundRect", { x: 0.8, y: 4.75, w: 11.7, h: 1.75, rectRadius: 0.1, fill: { color: OFFWHITE }, line: { color: "E5E3DD", width: 1 } });
  s.addText([
    { text: "Why this matters: ", options: { bold: true, color: TEXT_DARK, breakLine: false } },
    { text: "the detection model isn't a stub, and the live capture, alert, and deduplication logic were run directly against real code paths with a real pothole photo - not mocked.", options: { color: TEXT_DARK, breakLine: true } },
  ], { x: 1.1, y: 4.92, w: 11.1, h: 0.7, fontFace: FONT_BODY, fontSize: 12.5, margin: 0, lineSpacingMultiple: 1.2 });
  s.addText([
    { text: "Honesty check: ", options: { bold: true, color: RED_DARK, breakLine: false } },
    { text: "CPU-only segmentation inference took ~1 second per frame in testing - workable for slow driving, tight for highway speed. Full multi-threaded live-webcam operation over extended real time wasn't run in this sandbox; the underlying processing logic was verified directly instead. A GPU or edge device closes this gap for production.", options: { color: TEXT_DARK, breakLine: true } },
  ], { x: 1.1, y: 5.5, w: 11.1, h: 0.9, fontFace: FONT_BODY, fontSize: 11.5, margin: 0, lineSpacingMultiple: 1.2 });
}

// =========================================================
// SLIDE 7 — Prioritization & impact
// =========================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  s.addText("IMPACT", { x: 0.8, y: 0.5, w: 6, h: 0.3, fontFace: FONT_BODY, fontSize: 11, bold: true, color: TEAL, charSpacing: 2, margin: 0 });
  s.addText("Not every pothole gets fixed with the same urgency", {
    x: 0.8, y: 0.82, w: 11.5, h: 0.7, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: TEXT_DARK, margin: 0,
  });

  s.addText("Priority = severity x road-type traffic weight x how many independent passes confirmed it - so a severe pothole on a busy highway always outranks a minor one on a quiet lane.", {
    x: 0.8, y: 1.6, w: 11.3, h: 0.7, fontFace: FONT_BODY, fontSize: 14, color: MUTED, margin: 0, lineSpacingMultiple: 1.2,
  });

  const rows = [
    [{ text: "Severity", options: { bold: true, fill: { color: ASPHALT }, color: WHITE } },
     { text: "Road type", options: { bold: true, fill: { color: ASPHALT }, color: WHITE } },
     { text: "Est. repair cost", options: { bold: true, fill: { color: ASPHALT }, color: WHITE } },
     { text: "Priority score", options: { bold: true, fill: { color: ASPHALT }, color: WHITE } }],
    [{ text: "Severe" }, { text: "Arterial road" }, { text: "\u20B91,20,000" }, { text: "9.0", options: { bold: true, color: RED_DARK } }],
    [{ text: "Moderate" }, { text: "National highway" }, { text: "\u20B925,000" }, { text: "7.5", options: { bold: true, color: AMBER_DARK } }],
    [{ text: "Minor" }, { text: "Residential road" }, { text: "\u20B93,000" }, { text: "1.0" }],
  ];
  s.addTable(rows, {
    x: 0.8, y: 2.5, w: 11.7, h: 1.9, fontFace: FONT_BODY, fontSize: 13,
    border: { type: "solid", color: "E5E3DD", pt: 0.75 }, autoPage: false,
    colW: [2.6, 3.3, 3.0, 2.8],
  });

  s.addText("These are illustrative rows using our test run's real severity output - the cost tiers and road-type weights are planning-level assumptions (see README), not verified municipal costings.", {
    x: 0.8, y: 4.6, w: 11.5, h: 0.5, fontFace: FONT_BODY, fontSize: 11, italic: true, color: MUTED, margin: 0,
  });

  s.addShape("roundRect", { x: 0.8, y: 5.3, w: 11.7, h: 1.2, rectRadius: 0.1, fill: { color: TEAL_LIGHT }, line: { type: "none" } });
  s.addText("With the Bombay HC's \u20B96 lakh per-death liability now in effect, every pothole a municipal fleet drives past unnoticed is a quantifiable financial risk - not just a safety one.", {
    x: 1.1, y: 5.5, w: 11.1, h: 0.9, fontFace: FONT_BODY, fontSize: 13.5, color: "085041", margin: 0, lineSpacingMultiple: 1.25,
  });
}

// =========================================================
// SLIDE 8 — Tech stack
// =========================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  s.addText("TECH STACK", { x: 0.8, y: 0.5, w: 6, h: 0.3, fontFace: FONT_BODY, fontSize: 11, bold: true, color: TEAL, charSpacing: 2, margin: 0 });
  s.addText("A real, licensed model - not a black box", {
    x: 0.8, y: 0.82, w: 11.5, h: 0.7, fontFace: FONT_HEAD, fontSize: 28, bold: true, color: TEXT_DARK, margin: 0,
  });

  const groups = [
    { title: "Detection", items: ["YOLOv8-segmentation (MIT licensed)", "OpenCV frame extraction", "Pixel-mask severity scoring"] },
    { title: "Live capture", items: ["Background-thread continuous loop", "gps_provider (phone / serial / demo)", "MJPEG live feed + WebSocket alerts"] },
    { title: "Geospatial", items: ["Haversine-based deduplication", "Flexible GPS CSV parsing (batch mode)", "Leaflet.js map dashboard"] },
    { title: "Backend", items: ["FastAPI + WebSocket", "Pandas", "Incremental in-memory pothole store"] },
  ];
  let gx = 0.8;
  groups.forEach((g) => {
    s.addShape("roundRect", { x: gx, y: 1.85, w: 2.75, h: 4.3, rectRadius: 0.1, fill: { color: OFFWHITE }, line: { color: "E5E3DD", width: 1 } });
    s.addText(g.title, { x: gx + 0.2, y: 2.1, w: 2.35, h: 0.5, fontFace: FONT_BODY, fontSize: 14, bold: true, color: TEAL, margin: 0 });
    const bulletItems = g.items.map((it, idx) => ({ text: it, options: { fontSize: 12, color: TEXT_DARK, bullet: true, breakLine: idx < g.items.length - 1 } }));
    s.addText(bulletItems, { x: gx + 0.2, y: 2.7, w: 2.35, h: 3.2, fontFace: FONT_BODY, valign: "top", margin: 0, paraSpaceAfter: 8 });
    gx += 2.95;
  });
}

// =========================================================
// SLIDE 9 — Roadmap
// =========================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  s.addText("ROADMAP", { x: 0.8, y: 0.5, w: 6, h: 0.3, fontFace: FONT_BODY, fontSize: 11, bold: true, color: TEAL, charSpacing: 2, margin: 0 });
  s.addText("What we'd build next", { x: 0.8, y: 0.82, w: 11.5, h: 0.7, fontFace: FONT_HEAD, fontSize: 30, bold: true, color: TEXT_DARK, margin: 0 });

  const phases = [
    { n: "1", title: "Real municipal fleet pilot", body: "Deploy on a small municipal fleet (garbage trucks, buses) to gather real coverage data at city scale." },
    { n: "2", title: "Real cost & traffic data", body: "Replace placeholder repair costs and road-type weights with real PWD costings and measured traffic volume." },
    { n: "3", title: "Depth estimation", body: "Add monocular depth or stereo camera input so severity reflects true pothole depth, not just frame-area." },
    { n: "4", title: "Citizen crowdsourcing app", body: "Let any driver's phone contribute passes, dramatically increasing street coverage beyond fleet vehicles alone." },
  ];
  let py = 1.85;
  phases.forEach((p) => {
    s.addShape("ellipse", { x: 0.8, y: py, w: 0.55, h: 0.55, fill: { color: AMBER }, line: { type: "none" } });
    s.addText(p.n, { x: 0.8, y: py, w: 0.55, h: 0.55, fontFace: FONT_HEAD, fontSize: 18, bold: true, color: ASPHALT, align: "center", valign: "middle", margin: 0 });
    s.addText(p.title, { x: 1.6, y: py - 0.05, w: 3.0, h: 0.6, fontFace: FONT_BODY, fontSize: 15, bold: true, color: TEXT_DARK, margin: 0 });
    s.addText(p.body, { x: 4.75, y: py - 0.05, w: 7.7, h: 0.9, fontFace: FONT_BODY, fontSize: 12.5, color: MUTED, margin: 0, lineSpacingMultiple: 1.2 });
    py += 1.15;
  });
}

// =========================================================
// SLIDE 10 — Judging criteria alignment
// =========================================================
{
  const s = pres.addSlide();
  s.background = { color: WHITE };

  s.addText("SCORECARD", { x: 0.8, y: 0.5, w: 6, h: 0.3, fontFace: FONT_BODY, fontSize: 11, bold: true, color: TEAL, charSpacing: 2, margin: 0 });
  s.addText("Mapped to the judging criteria", { x: 0.8, y: 0.82, w: 11.5, h: 0.7, fontFace: FONT_HEAD, fontSize: 30, bold: true, color: TEXT_DARK, margin: 0 });

  const rows = [
    [{ text: "Criteria", options: { bold: true, fill: { color: ASPHALT }, color: WHITE } },
     { text: "Weight", options: { bold: true, fill: { color: ASPHALT }, color: WHITE } },
     { text: "What RoadScan AI delivers", options: { bold: true, fill: { color: ASPHALT }, color: WHITE } }],
    [{ text: "Innovation" }, { text: "25%" }, { text: "Real-time driver alerts from a continuous camera signal, not just after-the-fact detection - plus closed-loop repair verification." }],
    [{ text: "Business impact" }, { text: "25%" }, { text: "Directly reduces civic liability exposure under the Bombay HC's 2025 strict-liability ruling, and warns drivers before damage/accidents occur." }],
    [{ text: "Technical excellence" }, { text: "20%" }, { text: "Real, licensed, tested segmentation model with a working live-capture loop, alert cooldown, and dedup logic - verified against real code paths." }],
    [{ text: "Scalability" }, { text: "15%" }, { text: "Works with any dashcam + GPS log; scales from one municipal fleet to citywide crowdsourcing." }],
    [{ text: "User experience" }, { text: "15%" }, { text: "Simple upload workflow, live map, one-click repair confirmation for non-technical municipal staff." }],
  ];
  s.addTable(rows, {
    x: 0.8, y: 1.75, w: 11.7, h: 4.9, fontFace: FONT_BODY, fontSize: 12.5,
    border: { type: "solid", color: "E5E3DD", pt: 0.75 }, autoPage: false,
    colW: [2.6, 1.1, 8.0],
    valign: "middle",
  });
}

// =========================================================
// SLIDE 11 — Thank you
// =========================================================
{
  const s = pres.addSlide();
  s.background = { color: ASPHALT };

  s.addText("Find it. Fix it. Prove it.", {
    x: 0.8, y: 2.6, w: 11.5, h: 1.0, fontFace: FONT_HEAD, fontSize: 40, bold: true, color: WHITE, margin: 0,
  });
  s.addText("RoadScan AI - real detection, real prioritization, real repair verification.", {
    x: 0.8, y: 3.6, w: 10.5, h: 0.7, fontFace: FONT_BODY, fontSize: 16, color: AMBER, margin: 0,
  });
  s.addText("Thank you.", { x: 0.8, y: 4.6, w: 5, h: 0.5, fontFace: FONT_BODY, fontSize: 14, color: "9A9D9F", margin: 0 });
}

pres.writeFile({ fileName: "/home/claude/roadscan-ai/docs/roadscan_ai_deck.pptx" }).then(() => {
  console.log("Full deck (11 slides) written.");
});
