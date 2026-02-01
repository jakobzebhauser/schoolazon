/* Schulazon Evaluation Logger (client-side only) - v1 compatible schema */
(function () {
  "use strict";

  const STORAGE_KEY = "schulazon_eval_log_v1";
  const STUDENT_KEY = "schulazon_schueler_id_v2";
  const SESSION_KEY = "schulazon_session_id_v2";
  const LEGACY_V2_KEY = "schulazon_eval_log_v2";

  const LONG_PAUSE_MS = 3 * 60 * 1000;
  const nowMs = () => Date.now();
  const isoNow = () => new Date().toISOString();

  function safeStorage() {
    try {
      const s = window.localStorage;
      const k = "__ls_test__";
      s.setItem(k, "1");
      s.removeItem(k);
      return s;
    } catch {
      return null;
    }
  }
  const storage = safeStorage();
  const safeGet = (key) => { try { return storage ? storage.getItem(key) : null; } catch { return null; } };
  const safeSet = (key, val) => { try { storage && storage.setItem(key, val); } catch {} };
  const safeParse = (json) => { try { return JSON.parse(json); } catch { return null; } };

  function randomId(prefix) {
    try {
      if (window.crypto && crypto.randomUUID) return `${prefix}${crypto.randomUUID()}`;
    } catch {}
    const rnd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return `${prefix}${rnd.slice(0, 16)}`;
  }

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
      return p.split("/").filter(Boolean).pop() || "index.html";
    } catch {
      return "unknown";
    }
  }

  function evalStepFromPage(p) {
    const pl = (p || "").toString().toLowerCase();
    if (pl.includes("pretest")) return "pretest";
    if (pl.includes("tutorial")) return "tutorial";
    if (pl.includes("free")) return "free";
    if (pl.includes("posttest")) return "posttest";
    if (pl.includes("index")) return "start";
    return null;
  }

  function baseData() {
    return {
      version: 1,
      meta: {
        mode_path: [],
        created_at: isoNow(),
        user_agent: (navigator && navigator.userAgent) ? navigator.userAgent : "",
        session_id: "",
        student_id: "",
        student_id_source: "",
        last_seen_page: pageName(),
        last_event_time: nowMs(),
        performance_vs_time: {
          pretest_time_ms: null,
          posttest_time_ms: null,
          total_test_time_ms: null
        },
        eval_flow: {
          steps: [],
          warnings: []
        },
        eval_state: {
          pretest_started: null,
          pretest_completed: null,
          tutorial_started: null,
          tutorial_completed: null,
          free_started: null,
          free_completed: null,
          posttest_started: null,
          posttest_completed: null
        }
      },
      pretest: {},
      posttest: {},
      tutorial: {
        start_time_ms: null,
        end_time_ms: null,
        duration_ms: null,
        last_step: null,
        total_steps: null,
        jumps: 0,
        tasks: {}
      },
      free_mode: {
        tasks: {},
        attempts: [],
        score_events: [],
        pause_events: [],
        tools: {
          schema: { opens: 0, duration_ms: 0, events: [] },
          spicker: { opens: 0, duration_ms: 0, events: [] },
          help: { opens: 0, duration_ms: 0, events: [] }
        },
        bonus: { events: [] },
        summary: {
          tasks_solved: 0,
          attempts_total: 0,
          attempts_wrong: 0,
          hints_total: 0,
          scaffolds_total: 0,
          schema_opens: 0,
          schema_duration_ms: 0,
          spicker_opens: 0,
          spicker_duration_ms: 0,
          active_time_ms: 0,
          idle_time_ms: 0
        },
        active_time_ms: 0,
        idle_time_ms: 0,
        order_counter: 0,
        _last_sql_hash: {},
        started_at_ms: null,
        ended_at_ms: null,
        session_duration_ms: null,
        last_score: 0,
        last_task_id: null
      },
      events: [],
      _intern: {
        last_action_ms: nowMs(),
        hidden_started_ms: null,
        tool_open_ms: {},
        free_started_ms: null
      }
    };
  }

  function ensureArray(v) { return Array.isArray(v) ? v : []; }
  function ensureObj(v) { return (v && typeof v === "object") ? v : {}; }

  function ensureData(raw) {
    const d = ensureObj(raw);
    if (!Number.isFinite(d.version)) d.version = 1;
    d.meta = ensureObj(d.meta);
    d.meta.mode_path = ensureArray(d.meta.mode_path);
    d.meta.created_at = d.meta.created_at || isoNow();
    d.meta.user_agent = d.meta.user_agent || ((navigator && navigator.userAgent) ? navigator.userAgent : "");
    d.meta.session_id = d.meta.session_id || "";
    d.meta.student_id = d.meta.student_id || "";
    d.meta.student_id_source = d.meta.student_id_source || "";
    d.meta.last_seen_page = d.meta.last_seen_page || pageName();
    d.meta.last_event_time = Number.isFinite(d.meta.last_event_time) ? d.meta.last_event_time : nowMs();
    d.meta.performance_vs_time = ensureObj(d.meta.performance_vs_time);
    ["pretest_time_ms","posttest_time_ms","total_test_time_ms"].forEach(k => {
      if (!Number.isFinite(d.meta.performance_vs_time[k])) d.meta.performance_vs_time[k] = null;
    });
    d.meta.eval_flow = ensureObj(d.meta.eval_flow);
    d.meta.eval_flow.steps = ensureArray(d.meta.eval_flow.steps);
    d.meta.eval_flow.warnings = ensureArray(d.meta.eval_flow.warnings);
    d.meta.eval_state = ensureObj(d.meta.eval_state);
    [
      "pretest_started","pretest_completed",
      "tutorial_started","tutorial_completed",
      "free_started","free_completed",
      "posttest_started","posttest_completed"
    ].forEach((k) => {
      if (!Number.isFinite(d.meta.eval_state[k])) d.meta.eval_state[k] = null;
    });

    d.pretest = ensureObj(d.pretest);
    d.posttest = ensureObj(d.posttest);
    d.tutorial = ensureObj(d.tutorial);
    if (!Number.isFinite(d.tutorial.jumps)) d.tutorial.jumps = 0;
    d.tutorial.tasks = ensureObj(d.tutorial.tasks);

    d.free_mode = ensureObj(d.free_mode);
    d.free_mode.tasks = ensureObj(d.free_mode.tasks);
    d.free_mode.attempts = ensureArray(d.free_mode.attempts);
    d.free_mode.score_events = ensureArray(d.free_mode.score_events);
    d.free_mode.pause_events = ensureArray(d.free_mode.pause_events);
    d.free_mode.tools = ensureObj(d.free_mode.tools);
    ["schema","spicker","help"].forEach(k => {
      d.free_mode.tools[k] = ensureObj(d.free_mode.tools[k]);
      d.free_mode.tools[k].opens = Number.isFinite(d.free_mode.tools[k].opens) ? d.free_mode.tools[k].opens : 0;
      d.free_mode.tools[k].duration_ms = Number.isFinite(d.free_mode.tools[k].duration_ms) ? d.free_mode.tools[k].duration_ms : 0;
      d.free_mode.tools[k].events = ensureArray(d.free_mode.tools[k].events);
    });
    d.free_mode.bonus = ensureObj(d.free_mode.bonus);
    d.free_mode.bonus.events = ensureArray(d.free_mode.bonus.events);
    d.free_mode.summary = ensureObj(d.free_mode.summary);
    [
      "tasks_solved","attempts_total","attempts_wrong","hints_total","scaffolds_total",
      "schema_opens","schema_duration_ms","spicker_opens","spicker_duration_ms",
      "active_time_ms","idle_time_ms"
    ].forEach(k => {
      if (!Number.isFinite(d.free_mode.summary[k])) d.free_mode.summary[k] = 0;
    });
    if (!Number.isFinite(d.free_mode.active_time_ms)) d.free_mode.active_time_ms = 0;
    if (!Number.isFinite(d.free_mode.idle_time_ms)) d.free_mode.idle_time_ms = 0;
    if (!Number.isFinite(d.free_mode.order_counter)) d.free_mode.order_counter = 0;
    d.free_mode._last_sql_hash = ensureObj(d.free_mode._last_sql_hash);
    d.free_mode.last_score = Number.isFinite(d.free_mode.last_score) ? d.free_mode.last_score : 0;
    d.free_mode.last_task_id = d.free_mode.last_task_id || null;

    d.events = ensureArray(d.events);
    d._intern = ensureObj(d._intern);
    d._intern.last_action_ms = Number.isFinite(d._intern.last_action_ms) ? d._intern.last_action_ms : nowMs();
    d._intern.hidden_started_ms = Number.isFinite(d._intern.hidden_started_ms) ? d._intern.hidden_started_ms : null;
    d._intern.tool_open_ms = ensureObj(d._intern.tool_open_ms);
    d._intern.free_started_ms = Number.isFinite(d._intern.free_started_ms) ? d._intern.free_started_ms : null;
    return d;
  }

  function migrateV2ToV1(v2) {
    if (!v2 || typeof v2 !== "object") return null;
    const d = baseData();
    const sid = v2?.schueler?.schueler_id || "";
    d.meta.student_id = sid;
    d.meta.student_id_source = v2?._intern?.student_id_source || v2?._intern?.student_hash ? "name_hash" : "";
    d.meta.session_id = v2?._intern?.session_id || "";
    d.meta.created_at = v2?.aufgezeichnet_am || d.meta.created_at;

    const mapTest = (src) => {
      const t = {};
      const s = src?.startzeit ? Date.parse(src.startzeit) : null;
      const e = src?.endzeit ? Date.parse(src.endzeit) : null;
      if (Number.isFinite(s)) t.started_at_ms = s;
      if (Number.isFinite(e)) t.ended_at_ms = e;
      if (Number.isFinite(src?.dauer_ms)) t.duration_ms = src.dauer_ms;
      if (src?.score) {
        t.score_raw = src.score.richtig;
        t.max_score = src.score.gesamt;
        if (Number.isFinite(src.score.pct)) t.score_pct = src.score.pct;
      }
      t.items = [];
      return t;
    };
    d.pretest = mapTest(v2.pretest || {});
    d.posttest = mapTest(v2.posttest || {});

    const fm = v2.freier_modus || {};
    const sMs = fm.startzeit ? Date.parse(fm.startzeit) : null;
    const eMs = fm.endzeit ? Date.parse(fm.endzeit) : null;
    if (Number.isFinite(sMs)) d.free_mode.started_at_ms = sMs;
    if (Number.isFinite(eMs)) d.free_mode.ended_at_ms = eMs;
    if (Number.isFinite(fm.dauer_ms)) d.free_mode.session_duration_ms = fm.dauer_ms;

    d.free_mode.tasks = {};
    const tasks = fm.aufgaben || {};
    Object.keys(tasks).forEach((id) => {
      const t = tasks[id] || {};
      d.free_mode.tasks[id] = {
        task_id: id,
        start_time_ms: t.gestartet ? Date.parse(t.gestartet) : null,
        first_submit_time_ms: null,
        solved_time_ms: t.geloest ? Date.parse(t.geloest) : null,
        attempts_total: t.fehlversuche || 0,
        attempts_wrong: t.fehlversuche || 0,
        used_hint_count: 0,
        used_scaffold_count: 0,
        solution_viewed: t.hilfe_level_max === "musterloesung",
        difficulty: null,
        order_index: t.bearbeitungs_reihenfolge || null
      };
    });

    d.free_mode.tools.schema.opens = fm?.hilfen?.schema?.oeffnungen || 0;
    d.free_mode.tools.schema.duration_ms = fm?.hilfen?.schema?.zeit_ms || 0;
    d.free_mode.tools.spicker.opens = fm?.hilfen?.spicker?.oeffnungen || 0;
    d.free_mode.tools.spicker.duration_ms = fm?.hilfen?.spicker?.zeit_ms || 0;
    d.free_mode.tools.help.opens = fm?.hilfen?.hilfe?.oeffnungen || 0;
    d.free_mode.tools.help.duration_ms = fm?.hilfen?.hilfe?.zeit_ms || 0;
    return d;
  }

  let data = ensureData(safeParse(safeGet(STORAGE_KEY)) || {});
  if (!safeGet(STORAGE_KEY)) {
    const v2 = safeParse(safeGet(LEGACY_V2_KEY));
    const migrated = migrateV2ToV1(v2);
    if (migrated) data = ensureData(migrated);
  }

  function persist() {
    try { safeSet(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }

  function ensureSessionId() {
    const existing = safeGet(SESSION_KEY);
    if (existing) {
      data.meta.session_id = existing;
      return existing;
    }
    const sid = randomId("sess_");
    data.meta.session_id = sid;
    safeSet(SESSION_KEY, sid);
    return sid;
  }

  function getSchuelerId() {
    const fromLS = safeGet(STUDENT_KEY);
    if (fromLS) return fromLS;
    return data.meta.student_id || "";
  }

  function setSchuelerId(id, source) {
    const clean = String(id || "").trim();
    if (!clean) return;
    data.meta.student_id = clean;
    if (source) data.meta.student_id_source = source;
    safeSet(STUDENT_KEY, clean);
    persist();
  }

  function ensureSchuelerId() {
    const current = getSchuelerId();
    if (current) return current;
    const sid = randomId("S-");
    setSchuelerId(sid, "random");
    return sid;
  }

  function hasMeaningfulData() {
    try {
      if (data?.pretest?.started_at_ms || data?.posttest?.started_at_ms) return true;
      if (data?.free_mode?.started_at_ms) return true;
      if (data?.events && data.events.length) return true;
      const tasks = data?.free_mode?.tasks;
      if (tasks && typeof tasks === "object" && Object.keys(tasks).length) return true;
    } catch {}
    return false;
  }

  function resetEvaluationLog(opts = {}) {
    const o = (opts && typeof opts === "object") ? opts : {};
    const keepStudent = !!o.keepStudent;
    const keepSession = !!o.keepSession;
    const clearStorage = (o.clearStorage !== false);

    const prevStudent = getSchuelerId();
    const prevSession = data?.meta?.session_id || safeGet(SESSION_KEY) || "";

    data = ensureData(baseData());
    if (clearStorage) {
      try { storage && storage.removeItem(STORAGE_KEY); } catch {}
    }

    if (keepSession && prevSession) {
      data.meta.session_id = prevSession;
      safeSet(SESSION_KEY, prevSession);
    } else {
      data.meta.session_id = "";
      try { storage && storage.removeItem(SESSION_KEY); } catch {}
      ensureSessionId();
    }

    if (keepStudent && prevStudent) {
      data.meta.student_id = prevStudent;
      safeSet(STUDENT_KEY, prevStudent);
    } else {
      data.meta.student_id = "";
      try { storage && storage.removeItem(STUDENT_KEY); } catch {}
    }

    persist();
  }

  function startNewStudentFromName(name) {
    const n = (name || "").toString().trim();
    if (!n) return;
    resetEvaluationLog({ keepStudent: false, keepSession: false, clearStorage: true });
    ensureSchuelerIdFromName(n);
  }

  function ensureSchuelerIdFromName(name) {
    const n = (name || "").toString().trim();
    if (!n) return;
    const hash = fnv1a(n.toLowerCase());
    const desired = `S-${hash}`;
    const current = getSchuelerId();

    if (current && current !== desired) {
      resetEvaluationLog({ keepStudent: false, keepSession: false, clearStorage: true });
    } else if (!current && hasMeaningfulData()) {
      resetEvaluationLog({ keepStudent: false, keepSession: false, clearStorage: true });
    }

    if (getSchuelerId() !== desired) setSchuelerId(desired, "name_hash");
    persist();
  }

  // ---- pause / idle handling ----
  function recordPause(startMs, endMs, reason) {
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return;
    data.free_mode.pause_events.push({ start_ms: startMs, end_ms: endMs, reason });
  }

  function maybeRecordIdleGap(currentMs) {
    const last = data._intern.last_action_ms;
    if (!Number.isFinite(last) || last <= 0) {
      data._intern.last_action_ms = currentMs;
      return;
    }
    const gap = currentMs - last;
    if (gap > LONG_PAUSE_MS && isFreeMode()) {
      recordPause(last, currentMs, "idle");
    }
    data._intern.last_action_ms = currentMs;
  }

  function touch() {
    const t = nowMs();
    maybeRecordIdleGap(t);
    persist();
  }

  function isFreeMode() {
    return (document?.body?.dataset?.mode) === "free";
  }

  function isTutorialPage() {
    const p = pageName().toLowerCase();
    if (p.includes("tutorial")) return true;
    const mode = document?.body?.dataset?.mode;
    return mode === "tutorial";
  }

  function pushFlowWarning(reason, step, page) {
    try {
      data.meta.eval_flow.warnings.push({ ts: nowMs(), reason: String(reason || ""), step: step || null, page: page || null });
    } catch {}
    try { logEvent("flow_warning", { reason, step, page }); } catch {}
    touch();
  }

  function markEvalStep(step, page) {
    if (!step) return;
    const p = page || pageName();
    const flow = data.meta.eval_flow;
    const last = flow.steps[flow.steps.length - 1];
    if (!last || last.step !== step || last.page !== p) {
      flow.steps.push({ step, page: p, ts: nowMs() });
    }

    const st = data.meta.eval_state;
    const key = `${step}_started`;
    if (st && st[key] == null) st[key] = nowMs();

    // Basic flow sanity checks (expected: pretest -> [tutorial] -> free -> posttest)
    const hasPre = Number.isFinite(st.pretest_started);
    const hasFree = Number.isFinite(st.free_started);
    if (step === "tutorial" && !hasPre) pushFlowWarning("tutorial_before_pretest", step, p);
    if (step === "free" && !hasPre) pushFlowWarning("free_before_pretest", step, p);
    if (step === "posttest" && !hasPre) pushFlowWarning("posttest_before_pretest", step, p);
    if (step === "posttest" && !hasFree) pushFlowWarning("posttest_before_free", step, p);
    if (step === "tutorial" && Number.isFinite(st.posttest_started)) pushFlowWarning("tutorial_after_posttest", step, p);
    if (step === "free" && Number.isFinite(st.posttest_started)) pushFlowWarning("free_after_posttest", step, p);

    persist();
  }

  // ---- meta helpers ----
  function updateMetaOnEvent() {
    const p = pageName();
    data.meta.last_seen_page = p;
    data.meta.last_event_time = nowMs();
    if (!data.meta.mode_path.length || data.meta.mode_path[data.meta.mode_path.length - 1] !== p) {
      data.meta.mode_path.push(p);
    }
  }

  // ---- free mode helpers ----
  function ensureFreeModeStart() {
    if (!isFreeMode()) return;
    if (!data.free_mode.started_at_ms) {
      data.free_mode.started_at_ms = nowMs();
      data._intern.free_started_ms = data.free_mode.started_at_ms;
    }
    if (!Number.isFinite(data.meta.eval_state.free_started)) {
      data.meta.eval_state.free_started = nowMs();
    }
  }

  function ensureTask(taskId) {
    ensureFreeModeStart();
    if (!taskId) return null;
    const id = String(taskId).trim();
    if (!data.free_mode.tasks[id]) {
      data.free_mode.tasks[id] = {
        task_id: id,
        start_time_ms: null,
        first_submit_time_ms: null,
        solved_time_ms: null,
        attempts_total: 0,
        attempts_wrong: 0,
        used_hint_count: 0,
        used_scaffold_count: 0,
        solution_viewed: false,
        difficulty: null,
        order_index: null
      };
    }
    return data.free_mode.tasks[id];
  }

  function hashSql(sql) {
    const s = (sql || "").toString();
    return fnv1a(s);
  }

  // ---- Public logging API ----
  function logEvent(type, payload) {
    try {
      data.events.push({ ts: nowMs(), type: String(type || ""), payload: payload ?? null });
    } catch {}
    updateMetaOnEvent();
    touch();
  }

  function recordTestResult(kind, payload) {
    const k = (kind === "posttest") ? "posttest" : "pretest";
    const src = payload && typeof payload === "object" ? payload : {};
    const out = {};
    out.started_at_ms = Number.isFinite(src.started_at_ms) ? src.started_at_ms : (Number.isFinite(src.start_ms) ? src.start_ms : null);
    out.ended_at_ms = Number.isFinite(src.ended_at_ms) ? src.ended_at_ms : (Number.isFinite(src.end_ms) ? src.end_ms : null);
    out.duration_ms = Number.isFinite(src.duration_ms) ? src.duration_ms : (out.started_at_ms && out.ended_at_ms ? (out.ended_at_ms - out.started_at_ms) : null);
    out.score_raw = Number.isFinite(src.score_raw) ? src.score_raw : (Number.isFinite(src?.score?.richtig) ? src.score.richtig : null);
    out.score_pct = Number.isFinite(src.score_pct) ? src.score_pct : (Number.isFinite(src?.score?.pct) ? src.score.pct : null);
    out.max_score = Number.isFinite(src.max_score) ? src.max_score : (Number.isFinite(src?.score?.gesamt) ? src.score.gesamt : null);
    out.total_test_time_ms = Number.isFinite(src.total_test_time_ms) ? src.total_test_time_ms : out.duration_ms;
    out.items = Array.isArray(src.items) ? src.items : [];

    data[k] = out;

    if (k === "pretest") data.meta.performance_vs_time.pretest_time_ms = out.duration_ms;
    if (k === "posttest") data.meta.performance_vs_time.posttest_time_ms = out.duration_ms;
    if (k === "pretest") data.meta.eval_state.pretest_completed = nowMs();
    if (k === "posttest") data.meta.eval_state.posttest_completed = nowMs();
    if (Number.isFinite(data.meta.performance_vs_time.pretest_time_ms) && Number.isFinite(data.meta.performance_vs_time.posttest_time_ms)) {
      data.meta.performance_vs_time.total_test_time_ms = data.meta.performance_vs_time.pretest_time_ms + data.meta.performance_vs_time.posttest_time_ms;
    }
    persist();
  }

  function trackTaskOpen(taskId, difficulty) {
    if (!isFreeMode()) return;
    ensureFreeModeStart();
    const id = String(taskId || "").trim();
    if (!id) return;
    const t = ensureTask(id);
    if (!t) return;
    if (!t.order_index) {
      data.free_mode.order_counter += 1;
      t.order_index = data.free_mode.order_counter;
    }
    if (!t.start_time_ms) t.start_time_ms = nowMs();
    if (difficulty) t.difficulty = difficulty;
    data.free_mode.last_task_id = id;
    logEvent("task_open", { task_id: id, order_index: t.order_index, difficulty: t.difficulty });
  }

  function trackAttempt(opts = {}) {
    if (!isFreeMode()) return;
    ensureFreeModeStart();
    const taskId = String(opts.taskId || "").trim();
    if (!taskId) return;
    const t = ensureTask(taskId);
    if (!t) return;
    if (!t.start_time_ms) t.start_time_ms = nowMs();

    if (!t.order_index) {
      data.free_mode.order_counter += 1;
      t.order_index = data.free_mode.order_counter;
    }

    const rawRes = (opts.result || "").toString().toLowerCase();
    const result = (rawRes === "correct" || rawRes === "richtig") ? "correct" : "wrong";
    const errorType = (opts.errorType || opts.error_type || null) ? String(opts.errorType || opts.error_type) : null;

    const sql = (opts.sql || "").toString();
    const sqlLen = sql.length;
    const lastHash = data.free_mode._last_sql_hash[taskId];
    const nextHash = hashSql(sql);
    const changed = lastHash ? (lastHash !== nextHash) : false;
    data.free_mode._last_sql_hash[taskId] = nextHash;

    t.attempts_total += 1;
    if (result !== "correct") t.attempts_wrong += 1;
    if (!t.first_submit_time_ms) t.first_submit_time_ms = nowMs();

    data.free_mode.attempts.push({
      timestamp: nowMs(),
      task_id: taskId,
      sql_length: sqlLen,
      changed_since_last_submit: !!changed,
      result,
      error_type: errorType
    });

    if (result === "correct") {
      if (!t.solved_time_ms) t.solved_time_ms = nowMs();
      logEvent("task_solved", { task_id: taskId });
    }
    logEvent("task_submit", {
      timestamp: nowMs(),
      task_id: taskId,
      sql_length: sqlLen,
      changed_since_last_submit: !!changed,
      result,
      error_type: errorType
    });

    updateSummary();
    persist();
  }

  function trackSolved(taskId) {
    trackAttempt({ taskId, result: "correct", sql: "" });
  }

  function trackHint(taskId) {
    if (!isFreeMode()) return;
    const id = String(taskId || "").trim();
    if (!id) return;
    const t = ensureTask(id);
    if (!t) return;
    t.used_hint_count += 1;
    logEvent("hint_used", { task_id: id });
    updateSummary();
    persist();
  }

  function trackScaffold(taskId) {
    if (!isFreeMode()) return;
    const id = String(taskId || "").trim();
    if (!id) return;
    const t = ensureTask(id);
    if (!t) return;
    t.used_scaffold_count += 1;
    logEvent("scaffold_used", { task_id: id });
    updateSummary();
    persist();
  }

  function trackSolutionViewed(taskId) {
    if (!isFreeMode()) return;
    const id = String(taskId || "").trim();
    if (!id) return;
    const t = ensureTask(id);
    if (!t) return;
    t.solution_viewed = true;
    logEvent("solution_viewed", { task_id: id });
    updateSummary();
    persist();
  }

  function toolKey(toolName) {
    const raw = (toolName || "").toString().toLowerCase();
    if (raw === "help" || raw === "hilfe") return "help";
    if (raw === "spicker") return "spicker";
    return "schema";
  }

  function trackToolOpen(toolName) {
    if (!isFreeMode()) return;
    ensureFreeModeStart();
    const k = toolKey(toolName);
    data.free_mode.tools[k].opens += 1;
    data.free_mode.tools[k].events.push({ type: "open", ts: nowMs() });
    data._intern.tool_open_ms[k] = nowMs();
    logEvent(`${k}_open`, {});
    updateSummary();
    persist();
  }

  function trackToolClose(toolName) {
    if (!isFreeMode()) return;
    const k = toolKey(toolName);
    const started = data._intern.tool_open_ms[k];
    if (Number.isFinite(started)) {
      const delta = nowMs() - started;
      if (delta > 0) data.free_mode.tools[k].duration_ms += delta;
    }
    data._intern.tool_open_ms[k] = null;
    data.free_mode.tools[k].events.push({ type: "close", ts: nowMs() });
    logEvent(`${k}_close`, {});
    updateSummary();
    persist();
  }

  function trackScoreChange(score) {
    if (!isFreeMode()) return;
    ensureFreeModeStart();
    const newScore = Number.isFinite(score) ? score : 0;
    const delta = newScore - (Number.isFinite(data.free_mode.last_score) ? data.free_mode.last_score : 0);
    data.free_mode.last_score = newScore;
    data.free_mode.score_events.push({ timestamp: nowMs(), new_score: newScore, delta });
    logEvent("score_change", { timestamp: nowMs(), new_score: newScore, delta });
    updateSummary();
    persist();
  }

  function trackBonusStart() {
    if (!isFreeMode()) return;
    data.free_mode.bonus.events.push({ type: "start", ts: nowMs() });
    logEvent("bonus_start", {});
    persist();
  }

  function trackBonusFinish() {
    if (!isFreeMode()) return;
    data.free_mode.bonus.events.push({ type: "finish", ts: nowMs() });
    logEvent("bonus_finish", {});
    persist();
  }

  function recordShopButtonTest(taskId, erfolg) {
    if (!isFreeMode()) return;
    logEvent("shop_button_test", { task_id: String(taskId || "").trim(), erfolg: !!erfolg });
    persist();
  }

  function updateSummary() {
    const tasks = data.free_mode.tasks || {};
    const attempts = data.free_mode.attempts || [];
    const taskIds = Object.keys(tasks);
    const tasks_solved = taskIds.filter(id => tasks[id]?.solved_time_ms != null).length;
    const attempts_total = attempts.length;
    const attempts_wrong = attempts.filter(a => a && a.result !== "correct").length;
    const hints_total = taskIds.reduce((acc, id) => acc + (tasks[id]?.used_hint_count || 0), 0);
    const scaffolds_total = taskIds.reduce((acc, id) => acc + (tasks[id]?.used_scaffold_count || 0), 0);

    const schema_opens = data.free_mode.tools.schema.opens || 0;
    const schema_duration_ms = data.free_mode.tools.schema.duration_ms || 0;
    const spicker_opens = data.free_mode.tools.spicker.opens || 0;
    const spicker_duration_ms = data.free_mode.tools.spicker.duration_ms || 0;

    // session duration
    if (data.free_mode.started_at_ms && !data.free_mode.ended_at_ms) {
      data.free_mode.session_duration_ms = nowMs() - data.free_mode.started_at_ms;
    } else if (data.free_mode.started_at_ms && data.free_mode.ended_at_ms) {
      data.free_mode.session_duration_ms = data.free_mode.ended_at_ms - data.free_mode.started_at_ms;
    }

    const idle_ms = (data.free_mode.pause_events || [])
      .filter(p => p && Number.isFinite(p.start_ms) && Number.isFinite(p.end_ms))
      .map(p => Math.max(0, p.end_ms - p.start_ms))
      .reduce((a,b)=>a+b,0);
    data.free_mode.idle_time_ms = idle_ms;
    data.free_mode.active_time_ms = Math.max(0, (data.free_mode.session_duration_ms || 0) - idle_ms);

    data.free_mode.summary = {
      tasks_solved,
      attempts_total,
      attempts_wrong,
      hints_total,
      scaffolds_total,
      schema_opens,
      schema_duration_ms,
      spicker_opens,
      spicker_duration_ms,
      active_time_ms: data.free_mode.active_time_ms,
      idle_time_ms: data.free_mode.idle_time_ms
    };
    persist();
  }

  function tutorialStart(totalSteps) {
    if (!data.tutorial.start_time_ms) data.tutorial.start_time_ms = nowMs();
    if (Number.isFinite(totalSteps)) data.tutorial.total_steps = totalSteps;
    persist();
  }

  function tutorialProgress(lastStep, totalSteps) {
    if (!data.tutorial.start_time_ms) tutorialStart(totalSteps);
    if (Number.isFinite(lastStep)) data.tutorial.last_step = lastStep;
    if (Number.isFinite(totalSteps)) data.tutorial.total_steps = totalSteps;
    persist();
  }

  function tutorialJump() {
    data.tutorial.jumps = (data.tutorial.jumps || 0) + 1;
    persist();
  }

  function tutorialComplete() {
    if (!data.tutorial.start_time_ms) data.tutorial.start_time_ms = nowMs();
    if (!data.tutorial.end_time_ms) data.tutorial.end_time_ms = nowMs();
    if (Number.isFinite(data.tutorial.start_time_ms) && Number.isFinite(data.tutorial.end_time_ms)) {
      data.tutorial.duration_ms = data.tutorial.end_time_ms - data.tutorial.start_time_ms;
    }
    if (!Number.isFinite(data.meta.eval_state.tutorial_completed)) {
      data.meta.eval_state.tutorial_completed = nowMs();
    }
    persist();
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

  function finalizeOpenTools() {
    ["schema","spicker","help"].forEach((k) => {
      const started = data._intern.tool_open_ms[k];
      if (Number.isFinite(started)) {
        const delta = nowMs() - started;
        if (delta > 0) data.free_mode.tools[k].duration_ms += delta;
        data._intern.tool_open_ms[k] = null;
      }
    });
  }

  function finalizeFreeMode(reason) {
    if (!data.free_mode.started_at_ms) return;
    if (data.free_mode.ended_at_ms) return;
    finalizeOpenTools();
    data.free_mode.ended_at_ms = nowMs();
    data.free_mode.session_duration_ms = data.free_mode.ended_at_ms - data.free_mode.started_at_ms;
    if (!Number.isFinite(data.meta.eval_state.free_completed)) {
      data.meta.eval_state.free_completed = data.free_mode.ended_at_ms;
    }
    logEvent("free_mode_end", { reason: reason || "unknown" });
    updateSummary();
    persist();
  }

  const KNOWLEDGE_IDS = ["q1","q2","q3","q4","q5","q6","q7","q8"];

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatDateLocal(ts) {
    const d = ts ? new Date(ts) : new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function validTs(v) {
    return Number.isFinite(v) && v > 0;
  }

  function pickFirstNumber(...vals) {
    for (let i = 0; i < vals.length; i++) {
      if (Number.isFinite(vals[i])) return vals[i];
    }
    return null;
  }

  function numOrZero(v) {
    return Number.isFinite(v) ? v : 0;
  }

  function numOrNull(v) {
    return Number.isFinite(v) ? v : null;
  }

  function buildLikertFromItems(items) {
    const out = { r1: 0, r2: 0 };
    if (!Array.isArray(items)) return out;
    items.forEach((it) => {
      const id = it?.item_id;
      if (id !== "r1" && id !== "r2") return;
      const v = Number(it?.response);
      if (Number.isFinite(v)) out[id] = v;
    });
    return out;
  }

  function buildKnowledgeFromItems(items, fallbackScore) {
    const by_item = {};
    KNOWLEDGE_IDS.forEach((id) => { by_item[id] = false; });
    if (Array.isArray(items)) {
      items.forEach((it) => {
        const id = it?.item_id;
        if (id && Object.prototype.hasOwnProperty.call(by_item, id)) {
          by_item[id] = !!it.correct;
        }
      });
    }
    let correct_count = Object.values(by_item).filter(Boolean).length;
    if ((!Array.isArray(items) || items.length === 0) && Number.isFinite(fallbackScore)) {
      correct_count = fallbackScore;
    }
    return { correct_count, by_item };
  }

  function buildTestBlock(kind) {
    const src = ensureObj(data[kind]);
    const items = Array.isArray(src.items) ? src.items : [];
    const startedRaw = pickFirstNumber(src.started_at_ms, data?.meta?.eval_state?.[`${kind}_started`]);
    const endedRaw = pickFirstNumber(src.ended_at_ms, data?.meta?.eval_state?.[`${kind}_completed`]);
    const started_at_ms = validTs(startedRaw) ? startedRaw : 0;
    const ended_at_ms = validTs(endedRaw) ? endedRaw : 0;
    let duration_ms = Number.isFinite(src.duration_ms) ? src.duration_ms : 0;
    if ((!Number.isFinite(duration_ms) || duration_ms <= 0) && started_at_ms && ended_at_ms) {
      duration_ms = Math.max(0, ended_at_ms - started_at_ms);
    }
    return {
      started_at_ms,
      ended_at_ms,
      duration_ms: Number.isFinite(duration_ms) ? duration_ms : 0,
      likert: buildLikertFromItems(items),
      knowledge: buildKnowledgeFromItems(items, src.score_raw)
    };
  }

  function buildTutorialBlock() {
    const startedRaw = pickFirstNumber(data?.tutorial?.start_time_ms, data?.meta?.eval_state?.tutorial_started);
    const endedRaw = pickFirstNumber(data?.tutorial?.end_time_ms, data?.meta?.eval_state?.tutorial_completed);
    const used = validTs(startedRaw);
    let duration_ms = Number.isFinite(data?.tutorial?.duration_ms) ? data.tutorial.duration_ms : null;
    if (used && duration_ms == null && validTs(startedRaw) && validTs(endedRaw)) {
      duration_ms = Math.max(0, endedRaw - startedRaw);
    }
    const completed = used ? validTs(endedRaw) : null;
    const aborted = used ? !validTs(endedRaw) : null;
    return {
      used,
      started_at_ms: used ? startedRaw : null,
      ended_at_ms: used && validTs(endedRaw) ? endedRaw : null,
      duration_ms,
      completed,
      aborted
    };
  }

  function buildIndexBlock() {
    const steps = data?.meta?.eval_flow?.steps || [];
    let startTs = null;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s && (s.step === "start" || s.step === "index")) {
        startTs = s.ts;
        break;
      }
    }
    let endTs = null;
    const preStart = pickFirstNumber(data?.pretest?.started_at_ms, data?.meta?.eval_state?.pretest_started);
    if (validTs(preStart)) {
      endTs = preStart;
    } else if (startTs != null) {
      const idx = steps.findIndex((s) => s && (s.step === "start" || s.step === "index") && s.ts === startTs);
      for (let i = idx + 1; i < steps.length; i++) {
        const s = steps[i];
        if (s && Number.isFinite(s.ts)) {
          endTs = s.ts;
          break;
        }
      }
    }
    const started_at_ms = validTs(startTs) ? startTs : 0;
    const ended_at_ms = validTs(endTs) ? endTs : 0;
    const duration_ms = (started_at_ms && ended_at_ms && ended_at_ms >= started_at_ms)
      ? (ended_at_ms - started_at_ms)
      : 0;
    return { started_at_ms, ended_at_ms, duration_ms };
  }

  function buildFlowBlock() {
    const nextMode = (data?.pretest?.next_mode || "").toString().toLowerCase();
    const tutorialUsed = validTs(data?.tutorial?.start_time_ms) || validTs(data?.meta?.eval_state?.tutorial_started);
    const path = (tutorialUsed || nextMode === "tutorial") ? "tutorial_then_free" : "free_direct";
    return {
      path
    };
  }

  function buildFreeModeBlock() {
    const fm = ensureObj(data.free_mode);
    const startedRaw = pickFirstNumber(fm.started_at_ms, data?.meta?.eval_state?.free_started);
    const endedRaw = pickFirstNumber(fm.ended_at_ms, data?.meta?.eval_state?.free_completed);
    const started_at_ms = validTs(startedRaw) ? startedRaw : 0;
    const ended_at_ms = validTs(endedRaw) ? endedRaw : 0;
    let duration_ms = Number.isFinite(fm.session_duration_ms) ? fm.session_duration_ms : 0;
    if ((!Number.isFinite(duration_ms) || duration_ms <= 0) && started_at_ms && ended_at_ms) {
      duration_ms = Math.max(0, ended_at_ms - started_at_ms);
    }

    const tasks = ensureObj(fm.tasks);
    const taskIds = Object.keys(tasks);
    const orderList = taskIds.map((id) => {
      const t = tasks[id] || {};
      return {
        id,
        order: Number.isFinite(t.order_index) ? t.order_index : null,
        start: Number.isFinite(t.start_time_ms) ? t.start_time_ms : null
      };
    }).sort((a, b) => {
      if (Number.isFinite(a.order) && Number.isFinite(b.order)) return a.order - b.order;
      if (Number.isFinite(a.order)) return -1;
      if (Number.isFinite(b.order)) return 1;
      if (Number.isFinite(a.start) && Number.isFinite(b.start)) return a.start - b.start;
      if (Number.isFinite(a.start)) return -1;
      if (Number.isFinite(b.start)) return 1;
      return a.id.localeCompare(b.id);
    });
    const task_order = orderList.map((t) => t.id);

    const tasksOut = {};
    taskIds.forEach((id) => {
      const t = tasks[id] || {};
      tasksOut[id] = {
        started_at_ms: numOrNull(t.start_time_ms),
        first_submit_time_ms: numOrNull(t.first_submit_time_ms),
        solved_time_ms: numOrNull(t.solved_time_ms),
        attempts_total: numOrZero(t.attempts_total),
        attempts_wrong: numOrZero(t.attempts_wrong),
        used_hint_count: numOrZero(t.used_hint_count),
        used_scaffold_count: numOrZero(t.used_scaffold_count),
        solution_viewed: !!t.solution_viewed,
        difficulty: t.difficulty ?? null,
        order_index: Number.isFinite(t.order_index) ? t.order_index : null
      };
    });

    const tools = ensureObj(fm.tools);
    const toolHelp = ensureObj(tools.help);
    const toolSpicker = ensureObj(tools.spicker);
    const toolSchema = ensureObj(tools.schema);

    const pauseEvents = Array.isArray(fm.pause_events) ? fm.pause_events : [];
    const spans = pauseEvents
      .filter(p => p && Number.isFinite(p.start_ms) && Number.isFinite(p.end_ms))
      .map(p => ({ start_ms: p.start_ms, end_ms: p.end_ms }));
    const total_ms = Number.isFinite(fm.idle_time_ms)
      ? fm.idle_time_ms
      : spans.reduce((acc, p) => acc + Math.max(0, p.end_ms - p.start_ms), 0);

    return {
      started_at_ms,
      ended_at_ms,
      duration_ms: Number.isFinite(duration_ms) ? duration_ms : 0,
      free_score: Number.isFinite(fm.last_score) ? fm.last_score : 0,
      tasks_solved: Number.isFinite(fm?.summary?.tasks_solved) ? fm.summary.tasks_solved : 0,
      tools: {
        help: { opens: numOrZero(toolHelp.opens), duration_ms: numOrZero(toolHelp.duration_ms) },
        spicker: { opens: numOrZero(toolSpicker.opens), duration_ms: numOrZero(toolSpicker.duration_ms) },
        db_schema: { opens: numOrZero(toolSchema.opens), duration_ms: numOrZero(toolSchema.duration_ms) }
      },
      task_order,
      tasks: tasksOut,
      inactivity: {
        threshold_ms: LONG_PAUSE_MS,
        spans,
        total_ms: numOrZero(total_ms)
      }
    };
  }

  function exportJson() {
    updateSummary();
    data.meta.last_seen_page = pageName();
    data.meta.last_event_time = nowMs();
    ensureSchuelerId();
    ensureSessionId();
    finalizeOpenTools();
    if (isFreeMode()) {
      finalizeFreeMode("export");
    } else if (data?.free_mode?.started_at_ms && !data?.free_mode?.ended_at_ms) {
      const endAt = pickFirstNumber(data?.posttest?.started_at_ms, data?.meta?.eval_state?.posttest_started, nowMs());
      if (Number.isFinite(endAt)) data.free_mode.ended_at_ms = endAt;
      if (Number.isFinite(data.free_mode.started_at_ms) && Number.isFinite(data.free_mode.ended_at_ms)) {
        data.free_mode.session_duration_ms = data.free_mode.ended_at_ms - data.free_mode.started_at_ms;
      }
    }
    updateSummary();

    const exportPayload = {
      version: 1,
      date: formatDateLocal(),
      student_id: data.meta.student_id || ensureSchuelerId(),
      flow: buildFlowBlock(),
      index: buildIndexBlock(),
      pretest: buildTestBlock("pretest"),
      tutorial: buildTutorialBlock(),
      free_mode: buildFreeModeBlock(),
      posttest: buildTestBlock("posttest")
    };
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    const filename = `schulazon_${exportPayload.student_id || "S"}_${stamp}.json`;

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
    } catch {}
  }

  // ---- init ----
  ensureSessionId();
  if (!data.meta.student_id) ensureSchuelerId();
  updateMetaOnEvent();
  try { markEvalStep(evalStepFromPage(pageName()), pageName()); } catch {}
  try { logEvent("page_view", { page: pageName(), step: evalStepFromPage(pageName()) }); } catch {}
  persist();

  if (isTutorialPage()) {
    if (!data.tutorial.start_time_ms) data.tutorial.start_time_ms = nowMs();
    if (!Number.isFinite(data.meta.eval_state.tutorial_started)) data.meta.eval_state.tutorial_started = nowMs();
    persist();
  }

  window.addEventListener("beforeunload", () => {
    try {
      if (isTutorialPage()) tutorialComplete();
      if (isFreeMode()) finalizeFreeMode("page_unload");
      else finalizeOpenTools();
    } catch {}
  });

  document.addEventListener("visibilitychange", () => {
    const t = nowMs();
    if (document.visibilityState === "hidden") {
      data._intern.hidden_started_ms = t;
    } else if (document.visibilityState === "visible") {
      const hs = data._intern.hidden_started_ms;
      data._intern.hidden_started_ms = null;
      if (Number.isFinite(hs)) {
        recordPause(hs, t, "blur");
        data._intern.last_action_ms = t;
      }
      persist();
    }
  });

  ["mousedown","keydown","touchstart"].forEach((evt) => {
    document.addEventListener(evt, () => touch(), { passive: true });
  });

  window.studyLogger = {
    // data (debug)
    data,

    // IDs
    ensureSchuelerId,
    ensureSchuelerIdFromName,
    ensureStudentId: ensureSchuelerId,
    ensureStudentIdFromName: ensureSchuelerIdFromName,

    // Session hygiene
    resetEvaluationLog,
    startNewStudentFromName,

    // Tests
    recordTestResult,

    // Tutorial
    tutorialStart,
    tutorialProgress,
    tutorialJump,
    tutorialComplete,

    // Free mode
    trackTaskOpen,
    trackAttempt,
    trackSolved,
    trackHint,
    trackScaffold,
    trackSolutionViewed,
    trackToolOpen,
    trackToolClose,
    trackScoreChange,
    trackBonusStart,
    trackBonusFinish,
    recordShopButtonTest,
    updateSummary,

    // Generic
    logEvent,
    set,
    persist,
    exportJson
  };

})();
