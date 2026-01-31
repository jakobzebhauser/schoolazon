/* Schulazon Evaluation Logger (client-side only) - v2 schema (de) */
(function () {
  "use strict";

  // Storage keys (v2)
  const STORAGE_KEY = "schulazon_eval_log_v2";
  const STUDENT_KEY = "schulazon_schueler_id_v2";
  const SESSION_KEY = "schulazon_session_id_v2";

  const LONG_PAUSE_MS = 3 * 60 * 1000; // >3 minutes
  const nowMs = () => Date.now();
  const isoNow = () => new Date().toISOString();

  function safeParse(json) { try { return JSON.parse(json); } catch { return null; } }
  function safeGet(storage, key) { try { return storage && storage.getItem(key); } catch { return ""; } }
  function safeSet(storage, key, val) { try { storage && storage.setItem(key, val); } catch {} }

  function randomId(prefix) {
    try {
      if (window.crypto && crypto.randomUUID) return `${prefix}${crypto.randomUUID()}`;
    } catch {}
    const rnd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return `${prefix}${rnd.slice(0, 16)}`;
  }

  // FNV-1a 32-bit hash (short, stable)
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = (h + (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)) >>> 0;
    }
    return ("0000000" + h.toString(16)).slice(-8);
  }

  function pageName() {
    try {
      const p = (window.location && window.location.pathname) ? window.location.pathname : "";
      const file = p.split("/").filter(Boolean).pop() || "index.html";
      return file;
    } catch {
      return "unknown";
    }
  }

  function isTutorialPage() {
    const p = pageName().toLowerCase();
    if (p.includes("tutorial")) return true;
    const mode = document?.body?.dataset?.mode;
    return mode === "tutorial";
  }

  function isFreeMode() {
    return (document?.body?.dataset?.mode) === "free";
  }

  function ensureBaseData(raw) {
    const d = raw && typeof raw === "object" ? raw : {};
    d.version = Number.isFinite(d.version) ? d.version : 1;
    d.aufgezeichnet_am = d.aufgezeichnet_am || null;

    d.schueler = d.schueler && typeof d.schueler === "object" ? d.schueler : {};
    d.schueler.schueler_id = d.schueler.schueler_id || "";

    // Tests
    d.pretest = d.pretest && typeof d.pretest === "object" ? d.pretest : {};
    d.posttest = d.posttest && typeof d.posttest === "object" ? d.posttest : {};

    // Tutorial
    d.tutorial = d.tutorial && typeof d.tutorial === "object" ? d.tutorial : {};
    d.tutorial.gemacht = !!d.tutorial.gemacht;
    d.tutorial.abgeschlossen = !!d.tutorial.abgeschlossen;
    d.tutorial.startzeit = d.tutorial.startzeit || null;
    d.tutorial.endzeit = d.tutorial.endzeit || null;
    d.tutorial.dauer_ms = Number.isFinite(d.tutorial.dauer_ms) ? d.tutorial.dauer_ms : null;
    d.tutorial.letzte_seite = Number.isFinite(d.tutorial.letzte_seite) ? d.tutorial.letzte_seite : null;
    d.tutorial.seiten_gesamt = Number.isFinite(d.tutorial.seiten_gesamt) ? d.tutorial.seiten_gesamt : null;
    d.tutorial.spruenge = Number.isFinite(d.tutorial.spruenge) ? d.tutorial.spruenge : 0;
    d.tutorial.aufgaben_im_tutorial = d.tutorial.aufgaben_im_tutorial && typeof d.tutorial.aufgaben_im_tutorial === "object"
      ? d.tutorial.aufgaben_im_tutorial : {};

    // Free mode
    d.freier_modus = d.freier_modus && typeof d.freier_modus === "object" ? d.freier_modus : {};
    d.freier_modus.startzeit = d.freier_modus.startzeit || null;
    d.freier_modus.endzeit = d.freier_modus.endzeit || null;
    d.freier_modus.dauer_ms = Number.isFinite(d.freier_modus.dauer_ms) ? d.freier_modus.dauer_ms : null;

    d.freier_modus.aufgaben_reihenfolge = Array.isArray(d.freier_modus.aufgaben_reihenfolge) ? d.freier_modus.aufgaben_reihenfolge : [];
    d.freier_modus.aufgaben = d.freier_modus.aufgaben && typeof d.freier_modus.aufgaben === "object" ? d.freier_modus.aufgaben : {};
    d.freier_modus.hilfen = d.freier_modus.hilfen && typeof d.freier_modus.hilfen === "object" ? d.freier_modus.hilfen : {};
    d.freier_modus.hilfen.spicker = d.freier_modus.hilfen.spicker && typeof d.freier_modus.hilfen.spicker === "object" ? d.freier_modus.hilfen.spicker : {};
    d.freier_modus.hilfen.hilfe = d.freier_modus.hilfen.hilfe && typeof d.freier_modus.hilfen.hilfe === "object" ? d.freier_modus.hilfen.hilfe : {};
    d.freier_modus.hilfen.schema = d.freier_modus.hilfen.schema && typeof d.freier_modus.hilfen.schema === "object" ? d.freier_modus.hilfen.schema : {};

    ["spicker","hilfe","schema"].forEach(k => {
      d.freier_modus.hilfen[k].oeffnungen = Number.isFinite(d.freier_modus.hilfen[k].oeffnungen) ? d.freier_modus.hilfen[k].oeffnungen : 0;
      d.freier_modus.hilfen[k].zeit_ms = Number.isFinite(d.freier_modus.hilfen[k].zeit_ms) ? d.freier_modus.hilfen[k].zeit_ms : 0;
    });
    d.freier_modus.hilfen.erste_hilfe_nach_ms = Number.isFinite(d.freier_modus.hilfen.erste_hilfe_nach_ms) ? d.freier_modus.hilfen.erste_hilfe_nach_ms : null;

    d.freier_modus.pausen_lang = Array.isArray(d.freier_modus.pausen_lang) ? d.freier_modus.pausen_lang : [];

    d.freier_modus.shop = d.freier_modus.shop && typeof d.freier_modus.shop === "object" ? d.freier_modus.shop : {};
    d.freier_modus.shop.button_tests = Array.isArray(d.freier_modus.shop.button_tests) ? d.freier_modus.shop.button_tests : [];

    // Internal state (not exported)
    d._intern = d._intern && typeof d._intern === "object" ? d._intern : {};
    d._intern.session_id = d._intern.session_id || "";
    d._intern.order_counter = Number.isFinite(d._intern.order_counter) ? d._intern.order_counter : 0;
    d._intern.last_action_ms = Number.isFinite(d._intern.last_action_ms) ? d._intern.last_action_ms : nowMs();
    d._intern.tool_open_ms = d._intern.tool_open_ms && typeof d._intern.tool_open_ms === "object" ? d._intern.tool_open_ms : {};
    d._intern.hidden_started_ms = Number.isFinite(d._intern.hidden_started_ms) ? d._intern.hidden_started_ms : null;
    d._intern.free_started_ms = Number.isFinite(d._intern.free_started_ms) ? d._intern.free_started_ms : null;
    d._intern.tutorial_started_ms = Number.isFinite(d._intern.tutorial_started_ms) ? d._intern.tutorial_started_ms : null;

    d.events = Array.isArray(d.events) ? d.events : []; // optional audit trail
    return d;
  }

  // Migration from v1 (best-effort)
  function migrateV1ToV2(v1) {
    if (!v1 || typeof v1 !== "object") return null;
    const v2 = {};
    v2.version = 1;
    v2.aufgezeichnet_am = null;
    v2.schueler = { schueler_id: v1?.meta?.student_id || "" };

    // Pre/Post: keep payload if already rich, else map common keys
    const mapTest = (src) => {
      const t = {};
      const started = src?.started_at_ms ? new Date(src.started_at_ms).toISOString() : src?.startzeit || null;
      const ended = src?.ended_at_ms ? new Date(src.ended_at_ms).toISOString() : src?.endzeit || null;
      t.startzeit = started;
      t.endzeit = ended;
      t.dauer_ms = Number.isFinite(src?.duration_ms) ? src.duration_ms : (src?.started_at_ms && src?.ended_at_ms ? (src.ended_at_ms - src.started_at_ms) : null);
      // answers
      t.antworten = src?.antworten || src?.answers || {};
      // score
      const richtig = Number.isFinite(src?.score?.richtig) ? src.score.richtig : (Number.isFinite(src?.score_raw) ? src.score_raw : null);
      const gesamt = Number.isFinite(src?.score?.gesamt) ? src.score.gesamt : (Number.isFinite(src?.max_score) ? src.max_score : null);
      if (Number.isFinite(richtig) || Number.isFinite(gesamt)) t.score = { richtig: richtig ?? 0, gesamt: gesamt ?? 0 };
      // likert
      t.likert = src?.likert || {};
      if (Number.isFinite(src?.likert_motivation)) t.likert.motivation = src.likert_motivation;
      if (Number.isFinite(src?.likert_selfefficacy)) t.likert.selbstvertrauen_sql = src.likert_selfefficacy;
      if (Number.isFinite(src?.confidence)) t.sicherheit = src.confidence;
      return t;
    };
    v2.pretest = mapTest(v1.pretest || {});
    v2.posttest = mapTest(v1.posttest || {});

    // Tutorial: unknown in v1
    v2.tutorial = {
      gemacht: false, abgeschlossen: false,
      startzeit: null, endzeit: null, dauer_ms: null,
      letzte_seite: null, seiten_gesamt: null, spruenge: 0,
      aufgaben_im_tutorial: {}
    };

    // Free mode: map tasks+tools+pauses
    const fm = v1.free_mode || {};
    const startzeit = Number.isFinite(fm.started_at_ms) ? new Date(fm.started_at_ms).toISOString() : null;
    const endzeit = Number.isFinite(fm.ended_at_ms) ? new Date(fm.ended_at_ms).toISOString() : null;
    const dauer_ms = Number.isFinite(fm.session_duration_ms) ? fm.session_duration_ms
      : (Number.isFinite(fm.started_at_ms) && Number.isFinite(fm.ended_at_ms) ? (fm.ended_at_ms - fm.started_at_ms) : null);

    const hilfen = { spicker:{oeffnungen:0,zeit_ms:0}, hilfe:{oeffnungen:0,zeit_ms:0}, schema:{oeffnungen:0,zeit_ms:0}, erste_hilfe_nach_ms:null };
    const tools = fm.tools || {};
    if (tools.spicker) { hilfen.spicker.oeffnungen = tools.spicker.opens||0; hilfen.spicker.zeit_ms = tools.spicker.duration_ms||0; }
    if (tools.help) { hilfen.hilfe.oeffnungen = tools.help.opens||0; hilfen.hilfe.zeit_ms = tools.help.duration_ms||0; }
    if (tools.schema) { hilfen.schema.oeffnungen = tools.schema.opens||0; hilfen.schema.zeit_ms = tools.schema.duration_ms||0; }

    const aufgaben = {};
    const aufgaben_reihenfolge = [];
    const tasks = fm.tasks || {};
    Object.keys(tasks).forEach((taskId) => {
      const t = tasks[taskId] || {};
      aufgaben[taskId] = {
        bearbeitungs_reihenfolge: t.order_index || null,
        gestartet: t.start_time_ms ? new Date(t.start_time_ms).toISOString() : null,
        geloest: t.solved_time_ms ? new Date(t.solved_time_ms).toISOString() : null,
        dauer_ms: (t.start_time_ms && t.solved_time_ms) ? (t.solved_time_ms - t.start_time_ms) : null,
        geloest_ok: !!t.solved_time_ms,
        fehlversuche: t.attempts_wrong || 0,
        hilfe_level_max: (t.solution_viewed ? "musterloesung" : (t.used_hint_count ? "tipp_1" : "keine")),
        feedback_verlauf: [],
        fehler_kategorien: {}
      };
      if (Number.isFinite(t.order_index)) aufgaben_reihenfolge.push(taskId);
    });

    // Pauses: keep long blurs/idle if present
    const pausen_lang = [];
    (fm.pause_events || []).forEach((pe) => {
      if (!pe || !pe.start_ms || !pe.end_ms) return;
      const delta = pe.end_ms - pe.start_ms;
      if (delta > LONG_PAUSE_MS) {
        pausen_lang.push({
          startzeit: new Date(pe.start_ms).toISOString(),
          endzeit: new Date(pe.end_ms).toISOString(),
          dauer_ms: delta,
          grund: pe.reason === "blur" ? "tab_inaktiv" : "keine_aktion"
        });
      }
    });

    v2.freier_modus = {
      startzeit, endzeit, dauer_ms,
      aufgaben_reihenfolge,
      aufgaben,
      hilfen,
      pausen_lang,
      shop: { button_tests: [] }
    };

    v2._intern = {};
    v2.events = Array.isArray(v1.events) ? v1.events : [];
    return v2;
  }

  // Load stored data
  const storedV2 = safeParse(safeGet(localStorage, STORAGE_KEY));
  let data = ensureBaseData(storedV2);

  // If no v2 but v1 exists, migrate
  if (!storedV2) {
    const v1 = safeParse(safeGet(localStorage, "schulazon_eval_log_v1"));
    const migrated = migrateV1ToV2(v1);
    if (migrated) {
      data = ensureBaseData(migrated);
      persist();
    }
  }

  function persist() {
    try { safeSet(localStorage, STORAGE_KEY, JSON.stringify(data)); } catch {}
  }

  function ensureSessionId() {
    const existing = safeGet(localStorage, SESSION_KEY);
    if (existing) {
      data._intern.session_id = existing;
      return existing;
    }
    const sid = randomId("sess_");
    data._intern.session_id = sid;
    safeSet(localStorage, SESSION_KEY, sid);
    return sid;
  }

  function getSchuelerId() {
    const fromLS = safeGet(localStorage, STUDENT_KEY);
    if (fromLS) return fromLS;
    return data.schueler.schueler_id || "";
  }

  function setSchuelerId(id) {
    const clean = String(id || "").trim();
    if (!clean) return;
    data.schueler.schueler_id = clean;
    safeSet(localStorage, STUDENT_KEY, clean);
    persist();
  }

  function ensureSchuelerId() {
    const current = getSchuelerId();
    if (current) return current;
    const sid = randomId("S-");
    setSchuelerId(sid);
    return sid;
  }

  function ensureSchuelerIdFromName(name) {
    const n = (name || "").toString().trim();
    if (!n) return;
    // do not overwrite existing stable id
    if (getSchuelerId()) return;
    const hash = fnv1a(n.toLowerCase());
    setSchuelerId(`S-${hash}`);
  }

  // ---- Long pause detection ----
  function maybeRecordGapPause(currentMs, reason) {
    const last = data._intern.last_action_ms;
    if (!Number.isFinite(last) || last <= 0) {
      data._intern.last_action_ms = currentMs;
      return;
    }
    const gap = currentMs - last;
    if (gap > LONG_PAUSE_MS && isFreeMode()) {
      data.freier_modus.pausen_lang.push({
        startzeit: new Date(last).toISOString(),
        endzeit: new Date(currentMs).toISOString(),
        dauer_ms: gap,
        grund: reason || "keine_aktion"
      });
    }
    data._intern.last_action_ms = currentMs;
  }

  function touch(reason) {
    const t = nowMs();
    maybeRecordGapPause(t, reason);
    // mark first help time (in free mode)
    if (isFreeMode() && data.freier_modus.startzeit) {
      const startMs = Date.parse(data.freier_modus.startzeit);
      if (Number.isFinite(startMs) && data.freier_modus.hilfen.erste_hilfe_nach_ms == null) {
        // only set when help is opened (touch() is also used elsewhere)
      }
    }
    persist();
  }

  // ---- Tutorial helpers ----
  function tutorialStart(seitenGesamt) {
    data.tutorial.gemacht = true;
    if (!data.tutorial.startzeit) {
      data.tutorial.startzeit = isoNow();
      data._intern.tutorial_started_ms = nowMs();
    }
    if (Number.isFinite(seitenGesamt)) data.tutorial.seiten_gesamt = seitenGesamt;
    persist();
  }

  function tutorialProgress(letzteSeite, seitenGesamt) {
    data.tutorial.gemacht = true;
    if (!data.tutorial.startzeit) tutorialStart(seitenGesamt);
    if (Number.isFinite(letzteSeite)) data.tutorial.letzte_seite = letzteSeite;
    if (Number.isFinite(seitenGesamt)) data.tutorial.seiten_gesamt = seitenGesamt;
    persist();
  }

  function tutorialJump() {
    data.tutorial.gemacht = true;
    data.tutorial.spruenge = (data.tutorial.spruenge || 0) + 1;
    persist();
  }

  function tutorialComplete() {
    data.tutorial.gemacht = true;
    data.tutorial.abgeschlossen = true;
    if (!data.tutorial.startzeit) tutorialStart(data.tutorial.seiten_gesamt);
    data.tutorial.endzeit = isoNow();
    const startMs = data._intern.tutorial_started_ms || (data.tutorial.startzeit ? Date.parse(data.tutorial.startzeit) : null);
    const endMs = data.tutorial.endzeit ? Date.parse(data.tutorial.endzeit) : null;
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) data.tutorial.dauer_ms = endMs - startMs;
    persist();
  }

  // ---- Free mode helpers ----
  function ensureFreeModeStart() {
    if (!isFreeMode()) return;
    if (!data.freier_modus.startzeit) {
      data.freier_modus.startzeit = isoNow();
      data._intern.free_started_ms = nowMs();
    }
  }

  function ensureTask(taskId) {
    ensureFreeModeStart();
    if (!taskId) return null;
    const tasks = data.freier_modus.aufgaben;
    if (!tasks[taskId]) {
      tasks[taskId] = {
        bearbeitungs_reihenfolge: null,
        gestartet: null,
        geloest: null,
        dauer_ms: null,
        geloest_ok: false,
        fehlversuche: 0,
        hilfe_level_max: "keine",
        feedback_verlauf: [],
        fehler_kategorien: {}
      };
    }
    return tasks[taskId];
  }

  const HELP_RANK = { "keine": 0, "tipp_1": 1, "tipp_2": 2, "musterloesung": 3 };
  function maxHelp(a, b) {
    const ra = HELP_RANK[a] ?? 0;
    const rb = HELP_RANK[b] ?? 0;
    return (rb > ra) ? b : a;
  }

  // ---- Public logging API ----
  function logEvent(typ, payload) {
    // optional audit trail
    try {
      data.events.push({ zeit: isoNow(), typ: String(typ || ""), daten: payload ?? null });
    } catch {}
    touch();
  }

  function recordTestResult(kind, payload) {
    const k = (kind === "posttest") ? "posttest" : "pretest";
    const src = payload && typeof payload === "object" ? payload : {};
    const out = {};

    // Accept either german fields or common legacy fields
    out.startzeit = src.startzeit || (Number.isFinite(src.started_at_ms) ? new Date(src.started_at_ms).toISOString() : null);
    out.endzeit = src.endzeit || (Number.isFinite(src.ended_at_ms) ? new Date(src.ended_at_ms).toISOString() : null);
    out.dauer_ms = Number.isFinite(src.dauer_ms) ? src.dauer_ms : (Number.isFinite(src.duration_ms) ? src.duration_ms : null);
    if (!Number.isFinite(out.dauer_ms) && out.startzeit && out.endzeit) {
      const a = Date.parse(out.startzeit), b = Date.parse(out.endzeit);
      if (Number.isFinite(a) && Number.isFinite(b)) out.dauer_ms = b - a;
    }

    out.antworten = src.antworten || src.answers || {};
    const richtig = Number.isFinite(src?.score?.richtig) ? src.score.richtig : (Number.isFinite(src.score_raw) ? src.score_raw : null);
    const gesamt = Number.isFinite(src?.score?.gesamt) ? src.score.gesamt : (Number.isFinite(src.max_score) ? src.max_score : null);
    out.score = {
      richtig: Number.isFinite(richtig) ? richtig : 0,
      gesamt: Number.isFinite(gesamt) ? gesamt : (Array.isArray(Object.keys(out.antworten)) ? Object.keys(out.antworten).length : 0)
    };

    out.likert = src.likert && typeof src.likert === "object" ? src.likert : {};
    if (Number.isFinite(src.likert_motivation)) out.likert.motivation = src.likert_motivation;
    if (Number.isFinite(src.likert_selfefficacy)) out.likert.selbstvertrauen_sql = src.likert_selfefficacy;

    if (Number.isFinite(src.sicherheit)) out.sicherheit = src.sicherheit;
    if (Number.isFinite(src.confidence)) out.sicherheit = src.confidence;

    data[k] = out;
    persist();
  }

  function trackTaskOpen(taskId) {
    if (!isFreeMode()) return;
    ensureFreeModeStart();
    const id = String(taskId || "").trim();
    if (!id) return;

    const t = ensureTask(id);
    if (!t) return;

    if (!t.bearbeitungs_reihenfolge) {
      data._intern.order_counter += 1;
      t.bearbeitungs_reihenfolge = data._intern.order_counter;
      data.freier_modus.aufgaben_reihenfolge.push(id);
    }
    if (!t.gestartet) t.gestartet = isoNow();
    logEvent("aufgabe_geoeffnet", { task_id: id });
    touch();
  }

  function trackAttempt(opts = {}) {
    if (!isFreeMode()) return;
    ensureFreeModeStart();
    const taskId = String(opts.taskId || "").trim();
    if (!taskId) return;
    const t = ensureTask(taskId);
    if (!t) return;

    // Ensure started
    if (!t.gestartet) t.gestartet = isoNow();
    if (!t.bearbeitungs_reihenfolge) {
      data._intern.order_counter += 1;
      t.bearbeitungs_reihenfolge = data._intern.order_counter;
      data.freier_modus.aufgaben_reihenfolge.push(taskId);
    }

    // Normalize result
    const rawRes = (opts.result || "").toString().toLowerCase();
    const ergebnis = (rawRes === "correct" || rawRes === "richtig") ? "richtig" : "falsch";

    const helpLevel = (opts.helpLevel || opts.hilfeLevel || "keine").toString().trim().toLowerCase();
    const hl = (helpLevel === "musterloesung" || helpLevel === "solution") ? "musterloesung"
      : (helpLevel === "tipp_2" || helpLevel === "hint2") ? "tipp_2"
      : (helpLevel === "tipp_1" || helpLevel === "hint1" || helpLevel === "hint") ? "tipp_1"
      : "keine";

    const feedbackText = (opts.feedbackText || opts.feedback || opts.message || "").toString();

    // Fehlversuche zählen
    if (ergebnis === "falsch") t.fehlversuche += 1;

    // help max
    t.hilfe_level_max = maxHelp(t.hilfe_level_max || "keine", hl);

    // optional error category
    const cat = (opts.errorCategory || opts.fehlerKategorie || "").toString().trim();
    if (cat) {
      t.fehler_kategorien[cat] = (t.fehler_kategorien[cat] || 0) + 1;
    }

    t.feedback_verlauf.push({
      zeit: isoNow(),
      ergebnis,
      feedback_text: feedbackText,
      hilfe_level: hl
    });

    if (ergebnis === "richtig") {
      t.geloest_ok = true;
      if (!t.geloest) t.geloest = isoNow();
      // compute duration
      const a = t.gestartet ? Date.parse(t.gestartet) : null;
      const b = t.geloest ? Date.parse(t.geloest) : null;
      if (Number.isFinite(a) && Number.isFinite(b)) t.dauer_ms = b - a;
      logEvent("aufgabe_geloest", { task_id: taskId });
    } else {
      logEvent("aufgabe_pruefen_falsch", { task_id: taskId, hilfe_level: hl });
    }

    touch();
    persist();
  }

  function trackSolved(taskId) {
    // Backwards compatibility: treat as correct attempt without extra info
    trackAttempt({ taskId, result: "correct", feedbackText: "OK", helpLevel: "keine" });
  }

  function trackHint(taskId, level) {
    // record help level usage without attempt (optional)
    if (!isFreeMode()) return;
    const id = String(taskId || "").trim();
    if (!id) return;
    const t = ensureTask(id);
    if (!t) return;
    const hl = (level === 2) ? "tipp_2" : "tipp_1";
    t.hilfe_level_max = maxHelp(t.hilfe_level_max || "keine", hl);
    logEvent("tipp_genutzt", { task_id: id, level: hl });
    touch();
  }

  function trackSolutionViewed(taskId) {
    if (!isFreeMode()) return;
    const id = String(taskId || "").trim();
    if (!id) return;
    const t = ensureTask(id);
    if (!t) return;
    t.hilfe_level_max = maxHelp(t.hilfe_level_max || "keine", "musterloesung");
    logEvent("musterloesung_angezeigt", { task_id: id });
    touch();
  }

  function trackToolOpen(toolName) {
    if (!isFreeMode()) return;
    ensureFreeModeStart();
    const raw = (toolName || "").toString().toLowerCase();
    const k = (raw === "help" || raw === "hilfe") ? "hilfe" : (raw === "spicker") ? "spicker" : "schema";
    data.freier_modus.hilfen[k].oeffnungen += 1;
    data._intern.tool_open_ms[k] = nowMs();

    // first help time
    if (data.freier_modus.hilfen.erste_hilfe_nach_ms == null && data.freier_modus.startzeit) {
      const startMs = Date.parse(data.freier_modus.startzeit);
      const delta = nowMs() - startMs;
      if (Number.isFinite(delta) && delta >= 0) data.freier_modus.hilfen.erste_hilfe_nach_ms = delta;
    }

    logEvent("hilfe_geoeffnet", { tool: k });
    touch();
  }

  function trackToolClose(toolName) {
    if (!isFreeMode()) return;
    const raw = (toolName || "").toString().toLowerCase();
    const k = (raw === "help" || raw === "hilfe") ? "hilfe" : (raw === "spicker") ? "spicker" : "schema";
    const started = data._intern.tool_open_ms[k];
    if (Number.isFinite(started)) {
      const delta = nowMs() - started;
      if (delta > 0) data.freier_modus.hilfen[k].zeit_ms += delta;
    }
    data._intern.tool_open_ms[k] = null;
    logEvent("hilfe_geschlossen", { tool: k });
    touch();
  }

  function recordShopButtonTest(taskId, erfolg) {
    if (!isFreeMode()) return;
    ensureFreeModeStart();
    data.freier_modus.shop.button_tests.push({
      zeit: isoNow(),
      task_id: String(taskId || "").trim(),
      erfolg: !!erfolg
    });
    logEvent("shop_button_test", { task_id: String(taskId || "").trim(), erfolg: !!erfolg });
    touch();
  }

  function updateDurations() {
    // Tutorial duration if on tutorial page
    if (data.tutorial.startzeit && !data.tutorial.endzeit && isTutorialPage()) {
      // still running; don't set end
    }
    // Free mode duration
    if (data.freier_modus.startzeit && isFreeMode()) {
      // keep running; duration computed on export
    }
  }

  function set(path, value) {
    if (!path) return;
    const parts = String(path).split(".");
    let cur = data;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
    persist();
  }

  function exportJson() {
    // finalize times
    data.aufgezeichnet_am = isoNow();

    if (data.tutorial.startzeit && !data.tutorial.endzeit && data.tutorial.abgeschlossen) {
      data.tutorial.endzeit = isoNow();
    }
    if (data.tutorial.startzeit && data.tutorial.endzeit && !Number.isFinite(data.tutorial.dauer_ms)) {
      const a = Date.parse(data.tutorial.startzeit), b = Date.parse(data.tutorial.endzeit);
      if (Number.isFinite(a) && Number.isFinite(b)) data.tutorial.dauer_ms = b - a;
    }

    if (data.freier_modus.startzeit) {
      data.freier_modus.endzeit = isoNow();
      const a = Date.parse(data.freier_modus.startzeit), b = Date.parse(data.freier_modus.endzeit);
      if (Number.isFinite(a) && Number.isFinite(b)) data.freier_modus.dauer_ms = b - a;
    }

    // ensure test durations
    ["pretest", "posttest"].forEach((k) => {
      const t = data[k];
      if (t && t.startzeit && t.endzeit && !Number.isFinite(t.dauer_ms)) {
        const a = Date.parse(t.startzeit), b = Date.parse(t.endzeit);
        if (Number.isFinite(a) && Number.isFinite(b)) t.dauer_ms = b - a;
      }
    });

    const sid = ensureSchuelerId();
    const filename = `schulazon_${sid}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`;

    // Export a copy without internal state
    const exportPayload = JSON.parse(JSON.stringify(data));
    delete exportPayload._intern;

    try {
      const payload = JSON.stringify(exportPayload, null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (_) {}
  }

  // ---- Init ----
  ensureSessionId();
  ensureSchuelerId();
  persist();

  // Auto-mark tutorial start if on tutorial page
  if (isTutorialPage()) {
    data.tutorial.gemacht = true;
    if (!data.tutorial.startzeit) {
      data.tutorial.startzeit = isoNow();
      data._intern.tutorial_started_ms = nowMs();
    }
    persist();
  }

  // Long pause detection: visibility (tab inactive)
  document.addEventListener("visibilitychange", () => {
    const t = nowMs();
    if (document.visibilityState === "hidden") {
      data._intern.hidden_started_ms = t;
    } else if (document.visibilityState === "visible") {
      const hs = data._intern.hidden_started_ms;
      data._intern.hidden_started_ms = null;
      if (Number.isFinite(hs)) {
        const delta = t - hs;
        if (delta > LONG_PAUSE_MS && isFreeMode()) {
          data.freier_modus.pausen_lang.push({
            startzeit: new Date(hs).toISOString(),
            endzeit: new Date(t).toISOString(),
            dauer_ms: delta,
            grund: "tab_inaktiv"
          });
          persist();
        }
        // also update last action to avoid double-counting
        data._intern.last_action_ms = t;
      }
    }
  });

  // Touch on basic interactions to detect long gaps
  ["mousedown","keydown","touchstart"].forEach((evt) => {
    document.addEventListener(evt, () => touch("keine_aktion"), { passive: true });
  });

  
  window.studyLogger = {
    // data (debug only)
    data,

    // ID helpers (neu + kompatibel)
    ensureSchuelerId,
    ensureSchuelerIdFromName,
    ensureStudentId: ensureSchuelerId,
    ensureStudentIdFromName: ensureSchuelerIdFromName,

    // Tests
    recordTestResult,

    // Tutorial helpers
    tutorialStart,
    tutorialProgress,
    tutorialJump,
    tutorialComplete,

    // Free mode
    trackTaskOpen,
    trackAttempt,
    trackSolved,
    trackHint,
    trackScaffold: (taskId) => trackHint(taskId, 1),
    trackSolutionViewed,
    trackToolOpen,
    trackToolClose,
    recordShopButtonTest,

    // Generic / compatibility
    logEvent,
    set,
    persist,
    updateSummary: () => {},
    trackBonusStart: () => {},
    trackBonusFinish: () => {},
    trackScoreChange: () => {},
    exportJson
  };

})();