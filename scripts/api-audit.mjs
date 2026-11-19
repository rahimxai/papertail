// Black-box API audit: about 108 checks over real HTTP as three demo users (auth, cross-account access, roles,
// sharing and revocation, validation, imports including malicious files, concurrent saves). Every document it
// creates is deleted at the end, so it is safe to run against a deployment that has the seeded demo accounts.
// Usage: npm run audit:api [-- https://your-app.vercel.app]   (defaults to http://localhost:3000)
import fs from "node:fs";
import JSZip from "jszip";

const BASE = process.argv[2] ?? "http://localhost:3000";
const PASSWORD = "papertrail-demo";
const results = [];
const cleanup = []; // [actor, docId]

function check(area, name, pass, detail = "") {
  results.push({ area, name, pass: !!pass, detail: pass ? "" : String(detail).slice(0, 300) });
}

class Actor {
  constructor(label) { this.label = label; this.cookie = ""; }
  async req(method, path, { json, body, headers = {}, raw = false } = {}) {
    const h = { Origin: BASE, ...headers };
    if (this.cookie) h.Cookie = this.cookie;
    if (json !== undefined) h["Content-Type"] = "application/json";
    const res = await fetch(BASE + path, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : body, redirect: "manual" });
    const setCookie = res.headers.getSetCookie?.() ?? [];
    for (const c of setCookie) {
      const [pair] = c.split(";");
      if (pair.startsWith("papertrail_session=")) this.cookie = pair.endsWith("=") ? "" : pair;
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    return { status: res.status, data, setCookie, headers: res.headers, raw: raw ? text : undefined };
  }
  async login(email) { return this.req("POST", "/api/auth/login", { json: { email, password: PASSWORD } }); }
}

const alex = new Actor("alex"), jordan = new Actor("jordan"), sam = new Actor("sam"), anon = new Actor("anon");
const doc = (...blocks) => ({ type: "doc", content: blocks });
const p = (...c) => ({ type: "paragraph", content: c });
const t = (text, marks) => ({ type: "text", text, ...(marks && { marks: marks.map((type) => ({ type })) }) });

async function upload(actor, name, bytes, type = "application/octet-stream") {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), name);
  return actor.req("POST", "/api/imports", { body: form });
}

// ---------------------------------------------------------------- AUTH
{
  const r = await alex.login("alex@papertrail.dev");
  const sc = r.setCookie.join(";").toLowerCase();
  check("auth", "valid login 200 + session cookie", r.status === 200 && alex.cookie, r.status);
  check("auth", "cookie HttpOnly", sc.includes("httponly"), sc);
  check("auth", "cookie SameSite=Lax", sc.includes("samesite=lax"), sc);
  check("auth", "cookie Secure in production build", sc.includes("secure"), sc);
  check("auth", "login response has no password hash", !JSON.stringify(r.data).includes("scrypt"), JSON.stringify(r.data));
  await jordan.login("jordan@papertrail.dev");
  await sam.login("sam@papertrail.dev");

  const wrong = await anon.req("POST", "/api/auth/login", { json: { email: "alex@papertrail.dev", password: "nope" } });
  const unknown = await anon.req("POST", "/api/auth/login", { json: { email: "ghost@papertrail.dev", password: "nope" } });
  check("auth", "wrong password 401", wrong.status === 401, wrong.status);
  check("auth", "unknown email 401 with identical message", unknown.status === 401 && unknown.data?.error?.message === wrong.data?.error?.message, JSON.stringify([wrong.data, unknown.data]));
  check("auth", "no cookie set on failed login", !anon.cookie, anon.cookie);
  const bad = await anon.req("POST", "/api/auth/login", { body: "{not json", headers: { "Content-Type": "application/json" } });
  check("auth", "malformed JSON 400", bad.status === 400, bad.status);
  const missing = await anon.req("POST", "/api/auth/login", { json: { email: "alex@papertrail.dev" } });
  check("auth", "missing password 400", missing.status === 400, missing.status);
  const normalized = await new Actor("x").req("POST", "/api/auth/login", { json: { email: "  ALEX@Papertrail.dev ", password: PASSWORD } });
  check("auth", "email trimmed/lowercased", normalized.status === 200, normalized.status);

  // Timing: unknown vs known email (median of 5)
  const time = async (email) => { const s = []; for (let i = 0; i < 5; i++) { const t0 = performance.now(); await anon.req("POST", "/api/auth/login", { json: { email, password: "nope" } }); s.push(performance.now() - t0); } return s.sort((a, b) => a - b)[2]; };
  const tk = await time("alex@papertrail.dev"), tu = await time("ghost@papertrail.dev");
  check("auth", `login timing similar (known ${tk.toFixed(0)}ms vs unknown ${tu.toFixed(0)}ms)`, Math.abs(tk - tu) < Math.max(30, tk * 0.5), `${tk} vs ${tu}`);

  for (const [label, path] of [["list", "/api/documents"], ["users", "/api/users"], ["doc", "/api/documents/welcome"]]) {
    const r1 = await anon.req("GET", path);
    check("auth", `unauthenticated GET ${label} → 401`, r1.status === 401, r1.status);
  }
  const forged = await new Actor("f").req("GET", "/api/documents", { headers: { Cookie: "papertrail_session=forged-token" } });
  check("auth", "forged cookie → 401", forged.status === 401, forged.status);

  const csrf = await alex.req("POST", "/api/documents", { json: {}, headers: { Origin: "https://evil.example" } });
  check("auth", "cross-origin POST blocked (403)", csrf.status === 403, csrf.status);
  if (csrf.status === 201) cleanup.push([alex, csrf.data.document.id]);

  // Logout invalidates the server-side session (old cookie replayed).
  const temp = new Actor("temp"); await temp.login("sam@papertrail.dev");
  const saved = temp.cookie;
  const out = await temp.req("POST", "/api/auth/logout");
  const replay = await new Actor("r").req("GET", "/api/documents", { headers: { Cookie: saved } });
  check("auth", "logout 200 and clears cookie", out.status === 200 && out.setCookie.join(";").includes("papertrail_session=;"), out.setCookie);
  check("auth", "old session token rejected after logout", replay.status === 401, replay.status);
}

// ---------------------------------------------------------------- DOCUMENTS
let docId, version;
{
  const c = await alex.req("POST", "/api/documents", { json: { title: "QA doc" } });
  check("documents", "create 201", c.status === 201, c.status);
  docId = c.data.document.id; version = c.data.document.version; cleanup.push([alex, docId]);
  const list = await alex.req("GET", "/api/documents");
  check("documents", "new doc listed for owner with role OWNER", list.data.documents.some((d) => d.id === docId && d.role === "OWNER"), "");

  const rich = doc(
    { type: "heading", attrs: { level: 1 }, content: [t("Heading one")] },
    p(t("bold", ["bold"]), t(" italic", ["italic"]), t(" under", ["underline"])),
    { type: "bulletList", content: [{ type: "listItem", content: [p(t("a"))] }, { type: "listItem", content: [p(t("b"))] }] },
    { type: "orderedList", attrs: { start: 1 }, content: [{ type: "listItem", content: [p(t("one"))] }] },
  );
  const u = await alex.req("PATCH", `/api/documents/${docId}`, { json: { baseVersion: version, title: "QA renamed", content: rich } });
  check("documents", "save rich content + rename 200, version+1", u.status === 200 && u.data.document.version === version + 1, JSON.stringify(u.data));
  version = u.data.document.version;
  const g = await alex.req("GET", `/api/documents/${docId}`);
  const body = JSON.stringify(g.data.document.content);
  check("documents", "reopen: title persisted", g.data.document.title === "QA renamed", g.data.document.title);
  check("documents", "reopen: marks/heading/lists persisted", ["\"bold\"", "\"italic\"", "\"underline\"", "\"heading\"", "bulletList", "orderedList"].every((k) => body.includes(k)), body);

  const stale = await alex.req("PATCH", `/api/documents/${docId}`, { json: { baseVersion: version - 1, title: "stale" } });
  check("documents", "stale baseVersion → 409 with current doc", stale.status === 409 && stale.data.error.details?.document?.version === version, JSON.stringify(stale.data).slice(0, 200));
  const noVer = await alex.req("PATCH", `/api/documents/${docId}`, { json: { title: "x" } });
  check("documents", "missing baseVersion → 400", noVer.status === 400, noVer.status);
  const empty = await alex.req("PATCH", `/api/documents/${docId}`, { json: { baseVersion: version } });
  check("documents", "no fields → 400", empty.status === 400, empty.status);

  for (const [label, title] of [["blank title", "   "], ["121-char title", "x".repeat(121)], ["numeric title", 42]]) {
    const r = await alex.req("PATCH", `/api/documents/${docId}`, { json: { baseVersion: version, title } });
    check("validation", `${label} → 400`, r.status === 400, `${r.status} ${JSON.stringify(r.data)}`);
  }
  const badContent = [
    ["unknown node", doc({ type: "script", content: [t("x")] })],
    ["disabled mark (link w/ javascript:)", doc(p({ type: "text", text: "x", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }))],
    ["not a doc", { type: "paragraph" }],
    ["string content", "<p>hi</p>"],
    ["invalid nesting", doc({ type: "listItem", content: [p(t("x"))] })],
    ["empty text node", doc(p({ type: "text", text: "" }))],
  ];
  for (const [label, content] of badContent) {
    const r = await alex.req("PATCH", `/api/documents/${docId}`, { json: { baseVersion: version, content } });
    check("validation", `content: ${label} → 400`, r.status === 400, `${r.status} ${JSON.stringify(r.data)}`);
    if (r.status === 200) version = r.data.document.version;
  }
  const huge = await alex.req("PATCH", `/api/documents/${docId}`, { json: { baseVersion: version, content: doc(p(t("a".repeat(100_001)))) } });
  check("validation", "content > 100k chars → 413", huge.status === 413, huge.status);

  // Heading level outside 1–3 and junk attrs: what gets stored?
  const lvl = await alex.req("PATCH", `/api/documents/${docId}`, { json: { baseVersion: version, content: doc({ type: "heading", attrs: { level: 99, onclick: "alert(1)" }, content: [t("H")] }) } });
  if (lvl.status === 200) version = lvl.data.document.version;
  const lvlBody = JSON.stringify(lvl.data?.document?.content ?? lvl.data);
  check("validation", "heading level 99 rejected or normalized", lvl.status === 400 || !lvlBody.includes("99"), `${lvl.status} ${lvlBody}`);
  check("validation", "unknown attrs (onclick) dropped", !lvlBody.includes("onclick"), lvlBody);

  // HTML in text is stored as text, not markup.
  const xss = await alex.req("PATCH", `/api/documents/${docId}`, { json: { baseVersion: version, title: "<img src=x onerror=alert(1)>", content: doc(p(t("<script>alert(1)</script><img src=x onerror=alert(2)>"))) } });
  check("security", "HTML-looking text accepted as plain text", xss.status === 200, xss.status);
  if (xss.status === 200) version = xss.data.document.version;

  const ids = ["' OR '1'='1", "welcome' --", "x".repeat(500), "%00", "../../etc/passwd", "WELCOME"];
  for (const id of ids) {
    const r = await alex.req("GET", `/api/documents/${encodeURIComponent(id)}`);
    check("security", `odd id ${JSON.stringify(id.slice(0, 20))} → 404`, r.status === 404, r.status);
  }
  const wrongType = await alex.req("PATCH", `/api/documents/${docId}`, { body: "title=x", headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  check("validation", "non-JSON body → 400", wrongType.status === 400, wrongType.status);

  // Concurrent saves with the same base version: exactly one wins.
  const [a, b] = await Promise.all([
    alex.req("PATCH", `/api/documents/${docId}`, { json: { baseVersion: version, title: "race A" } }),
    alex.req("PATCH", `/api/documents/${docId}`, { json: { baseVersion: version, title: "race B" } }),
  ]);
  check("concurrency", "parallel saves on same version: one 200, one 409", [a.status, b.status].sort().join() === "200,409", `${a.status},${b.status}`);
  version = (await alex.req("GET", `/api/documents/${docId}`)).data.document.version;
}

// ---------------------------------------------------------------- AUTHORIZATION / SHARING
{
  const id = docId;
  // Third parties: every verb on someone else's document.
  for (const [actor, who] of [[jordan, "jordan(no share)"], [sam, "sam(no share)"]]) {
    const r = [
      await actor.req("GET", `/api/documents/${id}`),
      await actor.req("PATCH", `/api/documents/${id}`, { json: { baseVersion: version, title: "pwned" } }),
      await actor.req("DELETE", `/api/documents/${id}`),
      await actor.req("GET", `/api/documents/${id}/shares`),
      await actor.req("POST", `/api/documents/${id}/shares`, { json: { email: `${actor.label}@papertrail.dev`, role: "EDITOR" } }),
    ];
    check("authz", `${who}: GET/PATCH/DELETE/list-shares/self-share all 404`, r.every((x) => x.status === 404), r.map((x) => x.status).join());
    const list = await actor.req("GET", "/api/documents");
    check("authz", `${who}: doc absent from their list`, !list.data.documents.some((d) => d.id === id), "");
  }
  const priv = await alex.req("GET", "/api/documents/research-notes");
  check("authz", "Alex → Sam's private seed doc 404", priv.status === 404, priv.status);
  const missing404 = await alex.req("GET", "/api/documents/does-not-exist");
  check("authz", "nonexistent and forbidden docs give identical 404 body", JSON.stringify(missing404.data) === JSON.stringify(priv.data), "");

  // Share as viewer.
  const s = await alex.req("POST", `/api/documents/${id}/shares`, { json: { email: " Jordan@Papertrail.dev ", role: "VIEWER" } });
  check("sharing", "owner shares (email normalized) → 201", s.status === 201 && s.data.created, `${s.status} ${JSON.stringify(s.data)}`);
  const jlist = await jordan.req("GET", "/api/documents");
  check("sharing", "viewer sees doc in list with role VIEWER", jlist.data.documents.some((d) => d.id === id && d.role === "VIEWER"), "");
  const jget = await jordan.req("GET", `/api/documents/${id}`);
  check("sharing", "viewer can read", jget.status === 200 && jget.data.document.role === "VIEWER", jget.status);
  const vr = [
    await jordan.req("PATCH", `/api/documents/${id}`, { json: { baseVersion: version, title: "viewer edit" } }),
    await jordan.req("PATCH", `/api/documents/${id}`, { json: { baseVersion: version, content: doc(p(t("viewer"))) } }),
    await jordan.req("DELETE", `/api/documents/${id}`),
    await jordan.req("POST", `/api/documents/${id}/shares`, { json: { email: "sam@papertrail.dev", role: "EDITOR" } }),
    await jordan.req("PATCH", `/api/documents/${id}/shares/${jget.data.document.id}`, { json: { role: "EDITOR" } }),
  ];
  check("authz", "viewer: rename/edit/delete/share/escalate all 403", vr.every((x) => x.status === 403), vr.map((x) => x.status).join());
  // Self-escalation by addressing own share row
  const meJordan = (await alex.req("GET", `/api/documents/${id}/shares`)).data.shares.find((x) => x.email === "jordan@papertrail.dev");
  const selfEsc = await jordan.req("PATCH", `/api/documents/${id}/shares/${meJordan.id}`, { json: { role: "EDITOR" } });
  check("authz", "viewer cannot promote self via share API (403)", selfEsc.status === 403, selfEsc.status);
  const jshares = await jordan.req("GET", `/api/documents/${id}/shares`);
  check("sharing", "viewer may list collaborators but canManage=false", jshares.status === 200 && jshares.data.canManage === false, JSON.stringify(jshares.data));
  const after = await alex.req("GET", `/api/documents/${id}`);
  check("authz", "document unchanged after viewer attempts", after.data.document.version === version, `${after.data.document.version} vs ${version}`);

  // Promote to editor.
  const pr = await alex.req("PATCH", `/api/documents/${id}/shares/${meJordan.id}`, { json: { role: "EDITOR" } });
  check("sharing", "owner promotes to EDITOR", pr.status === 200, pr.status);
  const je = await jordan.req("PATCH", `/api/documents/${id}`, { json: { baseVersion: version, content: doc(p(t("edited by jordan"))) } });
  check("sharing", "editor can save immediately after promotion", je.status === 200 && je.data.document.updatedByName === "Jordan Lee", `${je.status}`);
  if (je.status === 200) version = je.data.document.version;
  const er = [
    await jordan.req("DELETE", `/api/documents/${id}`),
    await jordan.req("POST", `/api/documents/${id}/shares`, { json: { email: "sam@papertrail.dev", role: "VIEWER" } }),
    await jordan.req("DELETE", `/api/documents/${id}/shares/${meJordan.id}`),
  ];
  check("authz", "editor: delete/share/revoke all 403", er.every((x) => x.status === 403), er.map((x) => x.status).join());
  const samStill = await sam.req("GET", `/api/documents/${id}`);
  check("authz", "third party still 404 while doc is shared with someone else", samStill.status === 404, samStill.status);

  // Validation on share endpoints.
  const sv = [
    ["unknown email", await alex.req("POST", `/api/documents/${id}/shares`, { json: { email: "nobody@papertrail.dev", role: "VIEWER" } }), 404],
    ["share with self", await alex.req("POST", `/api/documents/${id}/shares`, { json: { email: "alex@papertrail.dev", role: "VIEWER" } }), 400],
    ["role OWNER", await alex.req("POST", `/api/documents/${id}/shares`, { json: { email: "sam@papertrail.dev", role: "OWNER" } }), 400],
    ["bad email", await alex.req("POST", `/api/documents/${id}/shares`, { json: { email: "not-an-email", role: "VIEWER" } }), 400],
    ["PATCH non-collaborator", await alex.req("PATCH", `/api/documents/${id}/shares/not-a-user`, { json: { role: "VIEWER" } }), 404],
    ["DELETE non-collaborator", await alex.req("DELETE", `/api/documents/${id}/shares/not-a-user`), 404],
  ];
  for (const [label, r, expected] of sv) check("validation", `share: ${label} → ${expected}`, r.status === expected, `${r.status} ${JSON.stringify(r.data)}`);
  const reshare = await alex.req("POST", `/api/documents/${id}/shares`, { json: { email: "jordan@papertrail.dev", role: "VIEWER" } });
  check("sharing", "re-sharing existing collaborator updates role (200, created=false)", reshare.status === 200 && reshare.data.created === false, reshare.status);

  // Revoke.
  const rv = await alex.req("DELETE", `/api/documents/${id}/shares/${meJordan.id}`);
  check("sharing", "owner revokes → 204", rv.status === 204, rv.status);
  const jg2 = await jordan.req("GET", `/api/documents/${id}`);
  const jp2 = await jordan.req("PATCH", `/api/documents/${id}`, { json: { baseVersion: version, title: "after revoke" } });
  const jl2 = await jordan.req("GET", "/api/documents");
  check("sharing", "revoked user: GET 404, PATCH 404, gone from list (next request)", jg2.status === 404 && jp2.status === 404 && !jl2.data.documents.some((d) => d.id === id), `${jg2.status},${jp2.status}`);

  // Users endpoint exposure.
  const users = await sam.req("GET", "/api/users");
  check("info", `/api/users returns ${users.data.users.length} accounts with emails to any signed-in user (by design)`, true);
  check("security", "/api/users never returns password hashes", !JSON.stringify(users.data).includes("scrypt"), "");
}

// ---------------------------------------------------------------- IMPORTS
{
  const samples = new URL("../samples/", import.meta.url);
  for (const name of ["ideas.txt", "meeting-notes.md", "q4-launch-brief.docx"]) {
    const r = await upload(sam, name, fs.readFileSync(new URL(name, samples)));
    check("imports", `${name} → 201`, r.status === 201, `${r.status} ${JSON.stringify(r.data)}`);
    if (r.status === 201) {
      cleanup.push([sam, r.data.document.id]);
      const g = await sam.req("GET", `/api/documents/${r.data.document.id}`);
      const body = JSON.stringify(g.data.document.content);
      check("imports", `${name}: reopens with content`, g.status === 200 && body.length > 50, body.slice(0, 120));
      if (name.endsWith(".docx")) check("imports", "docx keeps headings + lists", body.includes("heading") && /bulletList|orderedList/.test(body), body.slice(0, 200));
      if (name.endsWith(".md")) check("imports", "md keeps headings + marks", body.includes("heading") && body.includes("bold"), body.slice(0, 200));
      const e = await sam.req("PATCH", `/api/documents/${r.data.document.id}`, { json: { baseVersion: g.data.document.version, content: doc(p(t("edited after import"))) } });
      check("imports", `${name}: imported doc is editable/saveable`, e.status === 200, e.status);
    }
  }
  const dup1 = await upload(sam, "dup.txt", new TextEncoder().encode("one"));
  const dup2 = await upload(sam, "dup.txt", new TextEncoder().encode("two"));
  check("imports", "duplicate filename creates two separate docs", dup1.status === 201 && dup2.status === 201 && dup1.data.document.id !== dup2.data.document.id, `${dup1.status},${dup2.status}`);
  for (const r of [dup1, dup2]) if (r.status === 201) cleanup.push([sam, r.data.document.id]);

  const zip = new JSZip(); zip.file("hello.txt", "not a docx");
  const notDocx = await zip.generateAsync({ type: "uint8array" });
  const neg = [
    ["pdf", "x.pdf", new TextEncoder().encode("%PDF-1.4"), 415],
    ["legacy .doc", "x.doc", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]), 400],
    ["empty .txt", "empty.txt", new Uint8Array(), 400],
    ["no extension", "README", new TextEncoder().encode("hi"), 415],
    ["oversized 4MB+1", "big.txt", new Uint8Array(4 * 1024 * 1024 + 1).fill(97), 413],
    ["corrupt docx (random bytes)", "bad.docx", new Uint8Array(2048).map(() => Math.random() * 256), 400],
    ["zip that isn't a docx", "zip.docx", notDocx, 400],
    ["non-UTF-8 txt", "latin1.txt", new Uint8Array([0x63, 0x61, 0x66, 0xe9, 0x20, 0xff]), 400],
    ["binary disguised as .md", "bin.md", new Uint8Array([0x41, 0x00, 0x42]), 400],
    ["exe renamed .txt (MZ header + nulls)", "evil.txt", new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03]), 400],
  ];
  for (const [label, name, bytes, expected] of neg) {
    const r = await upload(sam, name, bytes);
    check("imports", `${label} → ${expected}`, r.status === expected, `${r.status} ${JSON.stringify(r.data)}`);
    if (r.status === 201) cleanup.push([sam, r.data.document.id]);
  }
  const noField = await sam.req("POST", "/api/imports", { body: new FormData() });
  check("imports", "multipart without file field → 400", noField.status === 400, noField.status);
  const notMultipart = await sam.req("POST", "/api/imports", { json: { file: "x" } });
  check("imports", "JSON body instead of multipart → 400", notMultipart.status === 400, notMultipart.status);
  const anonUpload = await upload(anon, "a.txt", new TextEncoder().encode("hi"));
  check("authz", "unauthenticated import → 401", anonUpload.status === 401, anonUpload.status);

  // Markdown XSS payloads must not survive as markup or dangerous marks.
  const md = [
    "# Title",
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(2)>",
    '<u onclick="alert(3)">under</u>',
    "[click](javascript:alert(4))",
    "<iframe src=//evil></iframe>",
    "![img](x onerror=alert(5))",
    "**bold** and <u>kept</u>",
  ].join("\n\n");
  const x = await upload(sam, "<img src=x onerror=alert(9)>.md", new TextEncoder().encode(md));
  check("security", "XSS markdown import accepted (sanitized)", x.status === 201, `${x.status} ${JSON.stringify(x.data)}`);
  if (x.status === 201) {
    cleanup.push([sam, x.data.document.id]);
    // Scan structure only (node types, marks, attrs): literal text like "onerror=" in a text node is inert.
    const json = JSON.stringify(x.data.document.content, (key, value) => (key === "text" ? undefined : value));
    const withText = JSON.stringify(x.data.document.content);
    check("security", "no script/iframe/onerror/javascript: in imported node structure", !/script|iframe|onerror|onclick|javascript:/i.test(json), json);
    check("security", "underline kept, link mark not present", withText.includes("underline") && !withText.includes('"link"'), withText);
    check("security", "HTML-ish filename stored as plain text title", x.data.document.title === "<img src=x onerror=alert(9)>", x.data.document.title);
  }

  // DOCX with script-like text and external relationships.
  const d = new JSZip();
  d.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  d.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  d.file("word/_rels/document.xml.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId9" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="javascript:alert(1)" TargetMode="External"/></Relationships>');
  d.file("word/document.xml", '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body><w:p><w:r><w:t>&lt;script&gt;alert(1)&lt;/script&gt;</w:t></w:r></w:p><w:p><w:hyperlink r:id="rId9"><w:r><w:t>evil link</w:t></w:r></w:hyperlink></w:p></w:body></w:document>');
  const dx = await upload(sam, "xss.docx", await d.generateAsync({ type: "uint8array" }));
  if (dx.status === 201) cleanup.push([sam, dx.data.document.id]);
  const dj = JSON.stringify(dx.data?.document?.content ?? dx.data);
  check("security", "docx with javascript: hyperlink → link dropped, text kept as text", dx.status === 201 && !dj.includes("javascript:") && dj.includes("evil link"), `${dx.status} ${dj}`);
}

// ---------------------------------------------------------------- DELETE + CASCADE
{
  const share = await alex.req("POST", `/api/documents/${docId}/shares`, { json: { email: "sam@papertrail.dev", role: "EDITOR" } });
  const del = await alex.req("DELETE", `/api/documents/${docId}`);
  check("documents", "owner delete → 204", del.status === 204 && share.status === 201, `${del.status}`);
  const again = await alex.req("DELETE", `/api/documents/${docId}`);
  const g = await alex.req("GET", `/api/documents/${docId}`);
  const sg = await sam.req("GET", `/api/documents/${docId}`);
  const sl = await sam.req("GET", "/api/documents");
  check("documents", "deleted doc: GET 404, second DELETE 404, gone for collaborator too", again.status === 404 && g.status === 404 && sg.status === 404 && !sl.data.documents.some((d) => d.id === docId), `${again.status},${g.status},${sg.status}`);
  cleanup.splice(cleanup.findIndex(([, id]) => id === docId), 1);
}

// ---------------------------------------------------------------- CLEANUP + REPORT
for (const [actor, id] of cleanup) await actor.req("DELETE", `/api/documents/${id}`);

const failed = results.filter((r) => !r.pass);
console.log(JSON.stringify({ target: BASE, total: results.length, passed: results.length - failed.length, failed }, null, 1));
console.log("\nALL CHECKS:");
for (const r of results) console.log(`${r.pass ? "PASS" : "FAIL"}  [${r.area}] ${r.name}`);
process.exitCode = failed.length ? 1 : 0;
