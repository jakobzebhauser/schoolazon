/* Schulazon Evaluation Logger (client-side only) */
(function () {
  "use strict";

  const STORAGE_KEY = "schulazon_eval_log_v1";
  const STUDENT_KEY = "schulazon_student_id_v1";
  const SESSION_KEY = "schulazon_session_id_v1";
  const LAST_SEEN_KEY = "schulazon_last_seen_v1";
  const IDLE_THRESHOLD_MS = 10 * 1000;

  const now = () => Date.now();

  function safeParse(json) {
    try { return JSON.parse(json); } catch { return null; }
  }

  function safeGet(storage, key) {
    try { return storage && storage.getItem(key); } catch { return ""; }
  }

  function safeSet(storage, key, val) {
    try { storage && storage.setItem(key, val); } catch {}
  }

  function randomId(prefix) {
    try {
      if (window.crypto && crypto.randomUUID) return `${prefix}${crypto.randomUUID()}`;
    } catch {}
    const rnd = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return `${prefix}${rnd.slice(0, 16)}`;
  }

  // FNV-1a 32-bit hash (short, stable, non-PII)
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

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function formatStampLocal(d) {
    const yyyy = d.getFullYear();
    const mm = pad2(d.getMonth() + 1);
    const dd = pad2(d.getDate());
    const hh = pad2(d.getHours());
    const min = pad2(d.getMinutes());
    return `${yyyy}-${mm}-${dd}_${hh}${min}`;
  }

  function ensureBaseData(raw) {
    const data = raw && typeof raw === "object" ? raw : {};
    data.version = data.version || 1;
    data.meta = data.meta && typeof data.meta === "object" ? data.meta : {};
    data.meta.mode_path = Array.isArray(data.meta.mode_path) ? data.meta.mode_path : [];
    data.meta.created_at = data.meta.created_at || new Date().toISOString();
    data.meta.user_agent = data.meta.user_agent || navigator.userAgent;

    data.pretest = data.pretest && typeof data.pretest === "object" ? data.pretest : {};
    data.posttest = data.posttest && typeof data.posttest === "object" ? data.posttest : {};

    data.free_mode = data.free_mode && typeof data.free_mode === "object" ? data.free_mode : {};
    data.free_mode.tasks = data.free_mode.tasks && typeof data.free_mode.tasks === "object" ? data.free_mode.tasks : {};
    data.free_mode.attempts = Array.isArray(data.free_mode.attempts) ? data.free_mode.attempts : [];
    data.free_mode.score_events = Array.isArray(data.free_mode.score_events) ? data.free_mode.score_events : [];
    data.free_mode.pause_events = Array.isArray(data.free_mode.pause_events) ? data.free_mode.pause_events : [];
    data.free_mode.tools = data.free_mode.tools && typeof data.free_mode.tools === "object" ? data.free_mode.tools : {};

    const toolDefaults = (t) => ({
      opens: t && Number.isFinite(t.opens) ? t.opens : 0,
      duration_ms: t && Number.isFinite(t.duration_ms) ? t.duration_ms : 0,
      events: Array.isArray(t?.events) ? t.events : []
    });
    data.free_mode.tools.schema = toolDefaults(data.free_mode.tools.schema);
    data.free_mode.tools.spicker = toolDefaults(data.free_mode.tools.spicker);
    data.free_mode.tools.help = toolDefaults(data.free_mode.tools.help);

    data.free_mode.bonus = data.free_mode.bonus && typeof data.free_mode.bonus === "object" ? data.free_mode.bonus : {};
    data.free_mode.bonus.events = Array.isArray(data.free_mode.bonus.events) ? data.free_mode.bonus.events : [];

    data.free_mode.summary = data.free_mode.summary && typeof data.free_mode.summary === "object" ? data.free_mode.summary : {};
    data.free_mode.active_time_ms = Number.isFinite(data.free_mode.active_time_ms) ? data.free_mode.active_time_ms : 0;
    data.free_mode.idle_time_ms = Number.isFinite(data.free_mode.idle_time_ms) ? data.free_mode.idle_time_ms : 0;
    data.free_mode.order_counter = Number.isFinite(data.free_mode.order_counter) ? data.free_mode.order_counter : 0;
    data.free_mode._last_sql_hash = data.free_mode._last_sql_hash && typeof data.free_mode._last_sql_hash === "object"
      ? data.free_mode._last_sql_hash : {};

    data.events = Array.isArray(data.events) ? data.events : [];
    return data;
  }

  const stored = safeParse(safeGet(localStorage, STORAGE_KEY));
  const data = ensureBaseData(stored);

  function persist() {
    try { safeSet(localStorage, STORAGE_KEY, JSON.stringify(data)); } catch {}
  }

  function setPath(obj, path, value) {
    if (!path) return;
    const parts = String(path).split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function getStudentId() {
    const existing = safeGet(localStorage, STUDENT_KEY);
    if (existing) return existing;
    if (data.meta.student_id) return data.meta.student_id;
    return "";
  }

  function setStudentId(id, source) {
    const clean = String(id || "").trim();
    if (!clean) return;
    data.meta.student_id = clean;
    data.meta.student_id_source = source || data.meta.student_id_source || "random";
    safeSet(localStorage, STUDENT_KEY, clean);
    persist();
  }

  function ensureStudentIdFromName(name) {
    const n = (name || "").toString().trim();
    if (!n) return;
    const current = getStudentId();
    if (current && data.meta.student_id_source && data.meta.student_id_source !== "random") return;
    const hash = fnv1a(n.toLowerCase());
    setStudentId(`S-${hash}`, "name_hash");
  }

  function ensureStudentId() {
    const current = getStudentId();
    if (current) return current;
    const generated = `S-${randomId("").slice(0, 8)}`;
    setStudentId(generated, "random");
    return generated;
  }

  function ensureSessionId() {
    let sid = safeGet(sessionStorage, SESSION_KEY);
    if (!sid) {
      sid = randomId("sess_");
      safeSet(sessionStorage, SESSION_KEY, sid);
    }
    data.meta.session_id = sid;
    return sid;
  }

  function addModePath() {
    const p = pageName();
    const arr = data.meta.mode_path || [];
    if (arr[arr.length - 1] !== p) arr.push(p);
    data.meta.mode_path = arr;
  }

  function logEvent(type, payload) {
    const evt = {
      ts: now(),
      type: String(type || "event"),
      payload: payload && typeof payload === "object" ? payload : {}
    };
    data.events.push(evt);
    data.meta.last_event_time = evt.ts;
    persist();
  }

  function set(path, value) {
    setPath(data, path, value);
    data.meta.last_event_time = now();
    persist();
  }

  function ensureFreeModeStart() {
    if (!data.free_mode.started_at_ms) {
      data.free_mode.started_at_ms = now();
    }
  }

  function ensureTask(taskId, difficulty) {
    const id = String(taskId || "").trim();
    if (!id) return null;
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
    const t = data.free_mode.tasks[id];
    if (difficulty && !t.difficulty) t.difficulty = difficulty;
    if (t.order_index == null) {
      data.free_mode.order_counter += 1;
      t.order_index = data.free_mode.order_counter;
    }
    if (!t.start_time_ms) t.start_time_ms = now();
    data.free_mode.last_task_id = id;
    return t;
  }

  function trackTaskOpen(taskId, difficulty) {
    ensureFreeModeStart();
    const t = ensureTask(taskId, difficulty);
    if (!t) return;
    logEvent("task_open", { task_id: t.task_id, order_index: t.order_index, difficulty: t.difficulty });
  }

  function trackAttempt(opts = {}) {
    ensureFreeModeStart();
    const taskId = String(opts.taskId || "").trim();
    if (!taskId) return;
    const t = ensureTask(taskId, opts.difficulty);
    if (!t) return;

    const sql = (opts.sql || "").toString();
    const sqlLength = sql.length;
    const hash = fnv1a(sql);
    const lastHash = data.free_mode._last_sql_hash[taskId] || "";
    const changed = lastHash ? (hash !== lastHash) : false;
    data.free_mode._last_sql_hash[taskId] = hash;

    t.attempts_total += 1;
    if (!t.first_submit_time_ms) t.first_submit_time_ms = now();
    if (opts.result !== "correct") t.attempts_wrong += 1;

    const attempt = {
      timestamp: now(),
      task_id: taskId,
      sql_length: sqlLength,
      changed_since_last_submit: changed,
      result: opts.result || "error",
      error_type: opts.errorType || null
    };
    data.free_mode.attempts.push(attempt);
    logEvent("task_submit", attempt);
    persist();
  }

  function trackSolved(taskId) {
    ensureFreeModeStart();
    const t = ensureTask(taskId);
    if (!t) return;
    if (!t.solved_time_ms) t.solved_time_ms = now();
    logEvent("task_solved", { task_id: t.task_id });
    persist();
  }

  function trackHint(taskId) {
    ensureFreeModeStart();
    const t = ensureTask(taskId);
    if (!t) return;
    t.used_hint_count += 1;
    logEvent("hint_used", { task_id: t.task_id });
    persist();
  }

  function trackScaffold(taskId) {
    ensureFreeModeStart();
    const t = ensureTask(taskId);
    if (!t) return;
    t.used_scaffold_count += 1;
    logEvent("scaffold_used", { task_id: t.task_id });
    persist();
  }

  function trackSolutionViewed(taskId) {
    ensureFreeModeStart();
    const t = ensureTask(taskId);
    if (!t) return;
    t.solution_viewed = true;
    logEvent("solution_viewed", { task_id: t.task_id });
    persist();
  }

  function trackBonusStart() {
    ensureFreeModeStart();
    data.free_mode.bonus.started = true;
    const evt = { type: "bonus_start", ts: now() };
    data.free_mode.bonus.events.push(evt);
    logEvent("bonus_start", {});
    persist();
  }

  function trackBonusFinish() {
    ensureFreeModeStart();
    data.free_mode.bonus.finished = true;
    const evt = { type: "bonus_finish", ts: now() };
    data.free_mode.bonus.events.push(evt);
    logEvent("bonus_finish", {});
    persist();
  }

  function trackScoreChange(newScore) {
    ensureFreeModeStart();
    const prev = Number.isFinite(data.free_mode.last_score) ? data.free_mode.last_score : null;
    if (prev != null && prev === newScore) return;
    const delta = prev == null ? newScore : (newScore - prev);
    data.free_mode.last_score = newScore;
    const evt = { timestamp: now(), new_score: newScore, delta };
    data.free_mode.score_events.push(evt);
    logEvent("score_change", evt);
    persist();
  }

  function trackToolOpen(kind) {
    ensureFreeModeStart();
    const k = String(kind || "");
    const bucket = data.free_mode.tools[k];
    if (!bucket) return;
    const ts = now();
    bucket.opens += 1;
    bucket._open_at = ts;
    bucket.events.push({ type: "open", ts });
    logEvent(`${k}_open`, {});
    persist();
  }

  function trackToolClose(kind) {
    const k = String(kind || "");
    const bucket = data.free_mode.tools[k];
    if (!bucket) return;
    const ts = now();
    const start = Number(bucket._open_at) || null;
    if (!start) return;
    const dur = Math.max(0, ts - start);
    bucket.duration_ms += dur;
    bucket._open_at = null;
    bucket.events.push({ type: "close", ts });
    logEvent(`${k}_close`, {});
    persist();
  }

  function updateSummary() {
    const tasks = data.free_mode.tasks || {};
    const ids = Object.keys(tasks);
    const tasksSolved = ids.filter(id => !!tasks[id].solved_time_ms).length;
    const attemptsTotal = ids.reduce((acc, id) => acc + (tasks[id].attempts_total || 0), 0);
    const attemptsWrong = ids.reduce((acc, id) => acc + (tasks[id].attempts_wrong || 0), 0);
    const hintsTotal = ids.reduce((acc, id) => acc + (tasks[id].used_hint_count || 0), 0);
    const scaffoldsTotal = ids.reduce((acc, id) => acc + (tasks[id].used_scaffold_count || 0), 0);
    data.free_mode.summary = {
      tasks_solved: tasksSolved,
      attempts_total: attemptsTotal,
      attempts_wrong: attemptsWrong,
      hints_total: hintsTotal,
      scaffolds_total: scaffoldsTotal,
      schema_opens: data.free_mode.tools.schema.opens || 0,
      schema_duration_ms: data.free_mode.tools.schema.duration_ms || 0,
      spicker_opens: data.free_mode.tools.spicker.opens || 0,
      spicker_duration_ms: data.free_mode.tools.spicker.duration_ms || 0,
      active_time_ms: data.free_mode.active_time_ms || 0,
      idle_time_ms: data.free_mode.idle_time_ms || 0
    };
  }

  function recordTestResult(kind, payload) {
    const k = kind === "posttest" ? "posttest" : "pretest";
    const base = payload && typeof payload === "object" ? payload : {};
    data[k] = base;
    if (data.pretest && data.posttest && Number.isFinite(data.pretest.score_raw) && Number.isFinite(data.posttest.score_raw)) {
      const pre = data.pretest.score_raw;
      const post = data.posttest.score_raw;
      const max = data.posttest.max_score || data.pretest.max_score || null;
      data.posttest.delta_score_raw = post - pre;
      if (max && (max - pre) > 0) data.posttest.normalized_gain = (post - pre) / (max - pre);
      else data.posttest.normalized_gain = null;
    }
    if (Number.isFinite(data.pretest?.duration_ms) && Number.isFinite(data.posttest?.duration_ms)) {
      data.meta.performance_vs_time = {
        pretest_time_ms: data.pretest.duration_ms,
        posttest_time_ms: data.posttest.duration_ms,
        total_test_time_ms: data.pretest.duration_ms + data.posttest.duration_ms
      };
    }
    persist();
  }

  function exportJson() {
    updateSummary();
    if (data.free_mode.started_at_ms) {
      data.free_mode.session_duration_ms = now() - data.free_mode.started_at_ms;
      data.free_mode.ended_at_ms = now();
    }
    if (data.pretest?.started_at_ms && data.pretest?.ended_at_ms) {
      data.pretest.duration_ms = data.pretest.ended_at_ms - data.pretest.started_at_ms;
    }
    if (data.posttest?.started_at_ms && data.posttest?.ended_at_ms) {
      data.posttest.duration_ms = data.posttest.ended_at_ms - data.posttest.started_at_ms;
    }
    const sid = ensureStudentId();
    const stamp = formatStampLocal(new Date());
    const filename = `schulazon_${sid}_${stamp}.json`;
    try {
      const payload = JSON.stringify(data, null, 2);
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

  // ---- Idle / focus tracking (free mode only) ----
  function startIdleTracking() {
    const isFree = (document.body && document.body.dataset && document.body.dataset.mode) === "free";
    if (!isFree) return;

    ensureFreeModeStart();
    let pauseReason = null;
    let pauseStart = null;
    let activeStart = now();
    let idleTimer = null;

    const beginPause = (reason) => {
      if (pauseReason) return;
      pauseReason = reason;
      pauseStart = now();
      const activeDelta = pauseStart - activeStart;
      if (activeDelta > 0) data.free_mode.active_time_ms += activeDelta;
      data.free_mode.pause_events.push({ start_ms: pauseStart, end_ms: null, reason });
      persist();
    };

    const endPause = () => {
      if (!pauseReason) return;
      const end = now();
      const last = data.free_mode.pause_events[data.free_mode.pause_events.length - 1];
      if (last && !last.end_ms) last.end_ms = end;
      const delta = end - pauseStart;
      if (delta > 0) data.free_mode.idle_time_ms += delta;
      pauseReason = null;
      pauseStart = null;
      activeStart = end;
      persist();
    };

    const resetIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (!document.hasFocus()) return;
      idleTimer = setTimeout(() => beginPause("idle"), IDLE_THRESHOLD_MS);
    };

    const onInteraction = () => {
      if (pauseReason === "idle") endPause();
      resetIdleTimer();
    };

    window.addEventListener("blur", () => {
      if (pauseReason === "idle") endPause();
      beginPause("blur");
    });
    window.addEventListener("focus", () => {
      if (pauseReason === "blur") endPause();
      resetIdleTimer();
    });

    ["mousedown", "keydown", "touchstart", "mousemove"].forEach((evt) => {
      document.addEventListener(evt, onInteraction, { passive: true });
    });

    resetIdleTimer();
  }

  function showIdBadgeIfNeeded() {
    const hasNameInput = !!document.querySelector("#nameInput, [name='name']");
    const hasName = !!(safeGet(sessionStorage, "schulazon_name") || safeGet(localStorage, "schulazon_name"));
    const fromQuery = (() => {
      try {
        const qp = new URLSearchParams(location.search);
        return (qp.get("name") || "").trim();
      } catch {
        return "";
      }
    })();
    if (hasNameInput || hasName || fromQuery) return;

    const id = ensureStudentId();
    const badge = document.createElement("div");
    badge.textContent = `ID: ${id}`;
    badge.setAttribute("aria-label", `Student ID ${id}`);
    badge.style.position = "fixed";
    badge.style.bottom = "12px";
    badge.style.right = "12px";
    badge.style.padding = "8px 10px";
    badge.style.background = "rgba(0,0,0,0.72)";
    badge.style.color = "#fff";
    badge.style.borderRadius = "999px";
    badge.style.fontSize = "12px";
    badge.style.fontFamily = "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    badge.style.zIndex = "9999";
    badge.style.pointerEvents = "none";
    document.body.appendChild(badge);
  }

  function onUnload() {
    const p = pageName();
    const stamp = now();
    data.meta.last_seen_page = p;
    data.meta.last_event_time = stamp;
    safeSet(localStorage, LAST_SEEN_KEY, JSON.stringify({ page: p, ts: stamp }));
    persist();
  }

  // Init
  ensureSessionId();
  ensureStudentId();
  addModePath();
  data.meta.last_seen_page = pageName();
  persist();
  showIdBadgeIfNeeded();
  startIdleTracking();
  window.addEventListener("beforeunload", onUnload);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onUnload();
  });

  window.studyLogger = {
    data,
    logEvent,
    set,
    persist,
    ensureStudentIdFromName,
    trackTaskOpen,
    trackAttempt,
    trackSolved,
    trackHint,
    trackScaffold,
    trackSolutionViewed,
    trackToolOpen,
    trackToolClose,
    trackBonusStart,
    trackBonusFinish,
    trackScoreChange,
    updateSummary,
    recordTestResult,
    exportJson
  };
})();
