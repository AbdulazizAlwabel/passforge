// Nicely Done — Site status widget for Scriptable (https://scriptable.app)
// Owner-only widget — download from https://nicelydone.qd.je/widgets/ while signed in as admin.
//
// Checks that https://nicelydone.qd.je is up and how fast it answers.
// Widget parameter (optional): another URL whose /api/health returns {"ok":true}.

const BASE = String(args.widgetParameter || "https://nicelydone.qd.je").replace(/\/$/, "");
const AR = String(Device.language() || "").toLowerCase().startsWith("ar");
const C = {
  bg: Color.dynamic(new Color("#f5f3ee"), new Color("#0b0c0b")),
  text: Color.dynamic(new Color("#161613"), new Color("#ecebe6")),
  muted: Color.dynamic(new Color("#5b5a54"), new Color("#a6a59f")),
  ok: Color.dynamic(new Color("#0f8a5c"), new Color("#7ee2b0")),
  bad: Color.dynamic(new Color("#c8412f"), new Color("#ff7a6b")),
};

async function check() {
  const t0 = Date.now();
  try {
    const r = new Request(BASE + "/api/health");
    r.timeoutInterval = 10;
    const j = await r.loadJSON();
    return { up: !!(j && j.ok), ms: Date.now() - t0 };
  } catch (e) {
    return { up: false, ms: null };
  }
}

const res = await check();
const host = BASE.replace(/^https?:\/\//, "");
const w = new ListWidget();
w.url = BASE + "/";
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
const fam = config.widgetFamily || "small";
const statusText = res.up ? (AR ? "يعمل" : "Up") : (AR ? "متوقف" : "Down");

if (fam.startsWith("accessory")) {
  w.addAccessoryWidgetBackground = true;
  const t = w.addText((res.up ? "● " : "○ ") + statusText + (res.ms ? " · " + res.ms + " ms" : ""));
  t.font = Font.semiboldSystemFont(12);
  if (fam !== "accessoryInline") { const h = w.addText(host); h.font = Font.systemFont(10); }
} else {
  w.backgroundColor = C.bg;
  w.setPadding(14, 16, 14, 16);
  const head = w.addText(host); head.font = Font.mediumSystemFont(11); head.textColor = C.muted; head.lineLimit = 1; head.minimumScaleFactor = 0.7;
  w.addSpacer();
  const row = w.addStack(); row.layoutHorizontally(); row.centerAlignContent();
  const dot = row.addText("●"); dot.font = Font.systemFont(16); dot.textColor = res.up ? C.ok : C.bad;
  row.addSpacer(6);
  const st = row.addText(statusText); st.font = new Font("Georgia", 30); st.textColor = C.text;
  w.addSpacer(2);
  const sub = w.addText(res.ms ? (AR ? "زمن الاستجابة " + res.ms + " ملّي ثانية" : res.ms + " ms response") : (AR ? "لا يستجيب" : "Not responding"));
  sub.font = Font.systemFont(11); sub.textColor = C.muted;
  const time = new DateFormatter(); time.useShortTimeStyle();
  const chk = w.addText((AR ? "آخر فحص " : "Checked ") + time.string(new Date())); chk.font = Font.systemFont(10); chk.textColor = C.muted;
  if (AR) [head, st, sub, chk].forEach((t) => t.rightAlignText());
}

if (config.runsInWidget) Script.setWidget(w); else await w.presentSmall();
Script.complete();
