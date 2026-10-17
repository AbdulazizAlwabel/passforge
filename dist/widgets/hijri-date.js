// Nicely Done — Hijri Date widget for Scriptable (https://scriptable.app)
// https://nicelydone.qd.je/widgets/
//
// Shows today's Hijri (Umm al-Qura) and Gregorian dates and a countdown to the
// next Ramadan / Eid. Everything is calculated on your iPhone — no network.
// Widget parameter (optional): "ar" or "en" to force a language.

const LANG = String(args.widgetParameter || Device.language() || "en").toLowerCase().startsWith("ar") ? "ar" : "en";
const AR = LANG === "ar";

const C = {
  bg: Color.dynamic(new Color("#f5f3ee"), new Color("#0b0c0b")),
  text: Color.dynamic(new Color("#161613"), new Color("#ecebe6")),
  muted: Color.dynamic(new Color("#5b5a54"), new Color("#a6a59f")),
  faint: Color.dynamic(new Color("#9a988f"), new Color("#6e6d68")),
  accent: Color.dynamic(new Color("#0f8a5c"), new Color("#7ee2b0")),
  gold: Color.dynamic(new Color("#a87a22"), new Color("#e8c98a")),
};
const SERIF = (size) => new Font("Georgia", size);
const SERIF_IT = (size) => new Font("Georgia-Italic", size);

const HM_EN = ["Muharram", "Safar", "Rabiʿ al-Awwal", "Rabiʿ al-Thani", "Jumada al-Ula", "Jumada al-Akhirah", "Rajab", "Shaʿban", "Ramadan", "Shawwal", "Dhu al-Qaʿdah", "Dhu al-Hijjah"];
const HM_AR = ["محرّم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوّال", "ذو القعدة", "ذو الحجة"];
const GM_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const GM_AR = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const DOW_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const arNum = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
const num = (n) => (AR ? arNum(n) : String(n));

const FMT = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { day: "numeric", month: "numeric", year: "numeric" });
function hijri(date) {
  const p = FMT.formatToParts(date);
  const g = (t) => parseInt(p.find((x) => x.type === t).value, 10);
  return { y: g("year"), m: g("month"), d: g("day") };
}

function daysWord(n) {
  if (!AR) return n === 1 ? "1 day" : n + " days";
  if (n === 1) return "يوم واحد";
  if (n === 2) return "يومين";
  if (n <= 10) return arNum(n) + " أيام";
  return arNum(n) + " يومًا";
}

// Next occasion: Ramadan starts 1/9, Eid al-Fitr 1/10, Eid al-Adha 10/12.
function occasion(today, th) {
  if (th.m === 9) return AR ? "رمضان · اليوم " + arNum(th.d) : "Ramadan · day " + th.d;
  if (th.m === 12 && th.d >= 10 && th.d <= 13) return AR ? "عيد الأضحى مبارك" : "Eid al-Adha Mubarak";
  if (th.m === 10 && th.d <= 3) return AR ? "عيد الفطر مبارك" : "Eid al-Fitr Mubarak";
  const targets = [[9, 1, "رمضان", "Ramadan"], [10, 1, "عيد الفطر", "Eid al-Fitr"], [12, 10, "عيد الأضحى", "Eid al-Adha"]];
  const d = new Date(today);
  for (let i = 1; i <= 400; i++) {
    d.setDate(d.getDate() + 1);
    const h = hijri(d);
    const t = targets.find(([m, day]) => h.m === m && h.d === day);
    if (t) return AR ? t[2] + " بعد " + daysWord(i) : t[3] + " in " + daysWord(i);
  }
  return "";
}

const now = new Date();
const H = hijri(now);
const hMonth = AR ? HM_AR[H.m - 1] : HM_EN[H.m - 1];
const yearSuffix = AR ? " هـ" : " AH";
const gLine = AR
  ? DOW_AR[now.getDay()] + "، " + arNum(now.getDate()) + " " + GM_AR[now.getMonth()] + " " + arNum(now.getFullYear())
  : DOW_EN[now.getDay()] + ", " + now.getDate() + " " + GM_EN[now.getMonth()] + " " + now.getFullYear();
const occ = occasion(now, H);

function text(parent, str, font, color, align) {
  const t = parent.addText(str);
  t.font = font; t.textColor = color; t.lineLimit = 1; t.minimumScaleFactor = 0.6;
  if (align === "right") t.rightAlignText(); else if (align === "center") t.centerAlignText(); else t.leftAlignText();
  return t;
}

function build(family) {
  const w = new ListWidget();
  w.url = "https://nicelydone.qd.je/" + (AR ? "ar/" : "") + "date-converter/";
  const midnight = new Date(now); midnight.setHours(24, 0, 5, 0);
  w.refreshAfterDate = midnight;
  const align = AR ? "right" : "left";

  if (family === "accessoryInline") {
    text(w, num(H.d) + " " + hMonth + " " + num(H.y) + yearSuffix, Font.systemFont(12), C.text);
    return w;
  }
  if (family === "accessoryCircular") {
    w.addAccessoryWidgetBackground = true;
    text(w, num(H.d), Font.boldSystemFont(20), C.text, "center");
    text(w, hMonth.split(" ")[0], Font.systemFont(9), C.text, "center");
    return w;
  }
  if (family === "accessoryRectangular") {
    text(w, num(H.d) + " " + hMonth + " " + num(H.y), Font.semiboldSystemFont(14), C.text, align);
    text(w, gLine, Font.systemFont(11), C.text, align);
    if (occ) text(w, occ, Font.systemFont(11), C.text, align);
    return w;
  }

  w.backgroundColor = C.bg;
  w.setPadding(14, 16, 14, 16);
  const big = family === "large" ? 64 : family === "medium" ? 46 : 44;
  text(w, AR ? "هجري · أم القرى" : "HIJRI · UMM AL-QURA", Font.mediumSystemFont(10), C.accent, align);
  w.addSpacer(family === "small" ? 4 : 6);

  if (family === "small") {
    text(w, num(H.d), SERIF(big), C.text, align);
    text(w, hMonth, AR ? Font.semiboldSystemFont(15) : SERIF_IT(17), C.accent, align);
    text(w, num(H.y) + yearSuffix, Font.systemFont(12), C.muted, align);
    w.addSpacer();
    text(w, gLine, Font.systemFont(10), C.faint, align);
    return w;
  }

  // medium / large: big day number beside month + year, in reading order
  const row = w.addStack();
  row.layoutHorizontally(); row.centerAlignContent();
  const addDay = () => { const t = row.addText(num(H.d)); t.font = SERIF(big); t.textColor = C.text; };
  const addSide = () => {
    const side = row.addStack(); side.layoutVertically();
    const mT = side.addText(hMonth); mT.font = AR ? Font.semiboldSystemFont(19) : SERIF_IT(22); mT.textColor = C.accent; mT.lineLimit = 1; mT.minimumScaleFactor = 0.6;
    if (AR) mT.rightAlignText();
    const yT = side.addText(num(H.y) + yearSuffix); yT.font = Font.systemFont(13); yT.textColor = C.muted;
    if (AR) yT.rightAlignText();
  };
  if (AR) { row.addSpacer(); addSide(); row.addSpacer(12); addDay(); }
  else { addDay(); row.addSpacer(12); addSide(); row.addSpacer(); }
  w.addSpacer();
  text(w, gLine, Font.mediumSystemFont(12), C.muted, align);
  if (occ) { w.addSpacer(3); text(w, "✦ " + occ, Font.systemFont(11), C.gold, align); }
  return w;
}

const family = config.widgetFamily || "medium";
const widget = build(family);
if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  await widget.presentMedium();
}
Script.complete();
