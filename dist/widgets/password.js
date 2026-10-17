// Nicely Done — Password widget for Scriptable (https://scriptable.app)
// https://nicelydone.qd.je/widgets/
//
// Tap the widget: a strong password is generated on your iPhone and copied to the
// clipboard. The widget itself never shows a password.
// Widget parameter (optional): a length from 12 to 64 (default 20), e.g. "24".
//
// Randomness: iOS UUIDs (UUID.string()) come from the system's cryptographic random
// generator. We keep only their 120 fully random bits each and pick characters with
// rejection sampling, so every character is equally likely.

const AR = String(Device.language() || "").toLowerCase().startsWith("ar");
const C = {
  bg: Color.dynamic(new Color("#f5f3ee"), new Color("#0b0c0b")),
  text: Color.dynamic(new Color("#161613"), new Color("#ecebe6")),
  muted: Color.dynamic(new Color("#5b5a54"), new Color("#a6a59f")),
  accent: Color.dynamic(new Color("#0f8a5c"), new Color("#7ee2b0")),
  chip: Color.dynamic(new Color("#e3efe8"), new Color("#15271f")),
};
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*-_=+?";

function randomBytes(n) {
  const out = [];
  while (out.length < n) {
    const hex = UUID.string().replace(/-/g, "").toLowerCase();
    // drop the version nibble (index 12) and the variant nibble (index 16)
    const nib = hex.split("").filter((_, i) => i !== 12 && i !== 16).map((c) => parseInt(c, 16));
    for (let i = 0; i + 1 < nib.length; i += 2) out.push(nib[i] * 16 + nib[i + 1]);
  }
  return out.slice(0, n);
}
function randInt(max) {
  const limit = Math.floor(256 / max) * max;
  for (;;) { const b = randomBytes(1)[0]; if (b < limit) return b % max; }
}
function password(len) {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*-_=+?"];
  const chars = sets.map((s) => s[randInt(s.length)]);           // at least one of each
  while (chars.length < len) chars.push(CHARSET[randInt(CHARSET.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

const len = Math.min(64, Math.max(12, parseInt(args.widgetParameter || args.queryParameters.length || "20", 10) || 20));

if (config.runsInWidget) {
  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(14, 16, 14, 16);
  w.url = "scriptable:///run/" + encodeURIComponent(Script.name()) + "?length=" + len;
  const fam = config.widgetFamily;
  if (fam && fam.startsWith("accessory")) {
    w.addAccessoryWidgetBackground = true;
    const img = w.addImage(SFSymbol.named("key.fill").image); img.imageSize = new Size(18, 18); img.centerAlignImage();
    if (fam !== "accessoryCircular") { const t = w.addText(AR ? "كلمة مرور جديدة" : "New password"); t.font = Font.semiboldSystemFont(12); t.centerAlignText(); }
  } else {
    const top = w.addStack(); top.layoutHorizontally(); top.centerAlignContent();
    const badge = top.addStack(); badge.backgroundColor = C.chip; badge.cornerRadius = 9; badge.setPadding(6, 6, 6, 6);
    const img = badge.addImage(SFSymbol.named("key.fill").image); img.imageSize = new Size(16, 16); img.tintColor = C.accent;
    w.addSpacer();
    const t = w.addText(AR ? "كلمة مرور جديدة" : "New password"); t.font = new Font("Georgia", 20); t.textColor = C.text; t.minimumScaleFactor = 0.7;
    w.addSpacer(2);
    const s = w.addText(AR ? "اضغط لنسخ كلمة قوية (" + len + " حرفًا)" : "Tap to copy a strong one · " + len + " chars");
    s.font = Font.systemFont(11); s.textColor = C.muted;
    if (AR) { t.rightAlignText(); s.rightAlignText(); }
  }
  Script.setWidget(w);
} else {
  const pw = password(len);
  Pasteboard.copyString(pw);
  const a = new Alert();
  a.title = AR ? "تم نسخ كلمة المرور" : "Password copied";
  a.message = pw + "\n\n" + (AR ? "الصقها في مدير كلمات المرور." : "Paste it into your password manager.");
  a.addAction(AR ? "تم" : "Done");
  await a.presentAlert();
}
Script.complete();
