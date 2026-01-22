(() => {
  "use strict";

  // -------------------------
  // Configuration
  // -------------------------
  const TOTAL_SECONDS = 10 * 60; // 10:00
  const STORAGE_KEY = "schulazon_sql_test_attempt_v1";

  // Items: single choice, 4 options, exactly as specified; correctIndex refers to options[].
  const ITEMS = [
    {
      id: "q1",
      stem: "Was bestimmt SELECT?",
      options: [
        "Welche Tabellen verbunden werden",
        "Welche Spalten/Ausdrücke ausgegeben werden",
        "Welche Zeilen gelöscht werden",
        "Welche Datenbank gewählt wird",
      ],
      correctIndex: 1,
    },
    {
      id: "q2",
      stem: "Welche Klausel filtert Zeilen vor der Ausgabe?",
      options: ["GROUP BY", "ORDER BY", "WHERE", "DISTINCT"],
      correctIndex: 2,
    },
    {
      id: "q3",
      stem: "Welche Aussage zu ORDER BY price DESC ist korrekt?",
      options: [
        "Sortiert Preis aufsteigend",
        "Sortiert Preis absteigend",
        "Entfernt doppelte Preise",
        "Filtert nur hohe Preise",
      ],
      correctIndex: 1,
    },
    {
      id: "q4",
      stem: "Wofür steht LIMIT 2?",
      options: [
        "Maximal 2 Spalten",
        "Maximal 2 Zeilen im Ergebnis",
        "Preis ≤ 2",
        "Nur 2 Tabellen erlaubt",
      ],
      correctIndex: 1,
    },
    {
      id: "q5",
      stem: "Was macht SELECT DISTINCT cat_id FROM products; ?",
      options: [
        "Gibt jedes Produkt genau einmal aus",
        "Gibt jede Kategorie-ID nur einmal aus",
        "Sortiert Kategorien",
        "Zählt Kategorien",
      ],
      correctIndex: 1,
    },
    {
      id: "q6",
      stem: "Welche Bedingung wählt Produkte mit Preis unter 10 oder Lagerbestand 0?",
      options: [
        "price < 10 AND stock = 0",
        "price < 10 OR stock = 0",
        "price <= 10 NOT stock = 0",
        "price < 10 XOR stock = 0",
      ],
      correctIndex: 1,
    },
    {
      id: "q7",
      stem:
        'Gegeben: SELECT prod_name, price FROM products WHERE price < 10 ORDER BY price DESC LIMIT 2; ' +
        "Welche Ausgabe ist korrekt?",
      options: [
        '("USB-C Kabel 1m", 5.99), ("Mauspad", 9.99)',
        '("Mauspad", 9.99), ("USB-C Kabel 2m", 7.99)',
        '("USB-C Kabel 2m", 7.99), ("USB-C Kabel 1m", 5.99)',
        '("Bluetooth Speaker", 49.99), ("Laptop Stand", 29.99)',
      ],
      correctIndex: 1,
    },
    {
      id: "q8",
      stem: "Was liefert SELECT COUNT(*) FROM products; ?",
      options: [
        "Summe aller Preise",
        "Anzahl Zeilen in products",
        "Anzahl verschiedener Kategorien",
        "Höchster Preis",
      ],
      correctIndex: 1,
    },
    {
      id: "q9",
      stem: "Welche Query zählt Produkte pro Kategorie-ID?",
      options: [
        "SELECT cat_id, COUNT(*) FROM products;",
        "SELECT cat_id, COUNT(*) FROM products GROUP BY cat_id;",
        "SELECT COUNT(cat_id) FROM products ORDER BY cat_id;",
        "SELECT cat_id FROM products COUNT(*);",
      ],
      correctIndex: 1,
    },
    {
      id: "q10",
      stem: "Welche Query gibt nur Kategorien aus, die mindestens 2 Produkte haben?",
      options: [
        "SELECT cat_id, COUNT(*) c FROM products WHERE c >= 2 GROUP BY cat_id;",
        "SELECT cat_id, COUNT(*) c FROM products GROUP BY cat_id HAVING COUNT(*) >= 2;",
        "SELECT cat_id FROM products HAVING COUNT(*) >= 2;",
        "SELECT cat_id, COUNT(*) c FROM products GROUP BY cat_id WHERE COUNT(*) >= 2;",
      ],
      correctIndex: 1,
    },
    {
      id: "q11",
      stem: "Wozu dient ein JOIN typischerweise?",
      options: [
        "Tabellen löschen",
        "Spalten umbenennen",
        "Daten aus mehreren Tabellen in einem Ergebnis kombinieren",
        "Daten sortieren",
      ],
      correctIndex: 2,
    },
    {
      id: "q12",
      stem:
        "Query:\n" +
        "SELECT o.order_id, oi.qty\n" +
        "FROM orders o JOIN order_items oi ON o.order_id = oi.order_id\n" +
        "WHERE o.order_id = 100;\n" +
        "Welche Ausgabe ist korrekt?",
      options: ["(100,2), (100,1)", "(101,3)", "(100,3)", "(100,2), (101,3)"],
      correctIndex: 0,
    },
    {
      id: "q13",
      stem: "Welche Aussage ist korrekt?",
      options: [
        "Fremdschlüssel ist immer eindeutig",
        "Primärschlüssel identifiziert eine Zeile eindeutig",
        "Primärschlüssel darf NULL sein",
        "Fremdschlüssel muss immer auf dieselbe Tabelle zeigen",
      ],
      correctIndex: 1,
    },
    {
      id: "q14",
      stem: "Welche Query findet Produkte, die nicht verfügbar sind (stock = 0)?",
      options: [
        "SELECT * FROM products WHERE stock = 0;",
        "SELECT * FROM products WHERE stock IS NULL;",
        "SELECT * FROM products WHERE stock < 0;",
        "SELECT * FROM products WHERE stock != 0;",
      ],
      correctIndex: 0,
    },
  ];

  // -------------------------
  // DOM
  // -------------------------
  const setupView = document.getElementById("setupView");
  const testView = document.getElementById("testView");
  const resultView = document.getElementById("resultView");

  const studentIdEl = document.getElementById("studentId");
  const testTypeEl = document.getElementById("testType");
  const btnStart = document.getElementById("btnStart");
  const btnFullscreen = document.getElementById("btnFullscreen");
  const btnResetAttempt = document.getElementById("btnResetAttempt");

  const lblTestType = document.getElementById("lblTestType");
  const lblProgress = document.getElementById("lblProgress");
  const lblTime = document.getElementById("lblTime");
  const progressBar = document.getElementById("progressBar");

  const questionHost = document.getElementById("questionHost");
  const btnPrev = document.getElementById("btnPrev");
  const btnNext = document.getElementById("btnNext");
  const btnSubmit = document.getElementById("btnSubmit");

  const outStudentId = document.getElementById("outStudentId");
  const outTestType = document.getElementById("outTestType");
  const outCode = document.getElementById("outCode");
  const outTime = document.getElementById("outTime");
  const outScore = document.getElementById("outScore");
  const btnCopyCode = document.getElementById("btnCopyCode");
  const btnDownloadJson = document.getElementById("btnDownloadJson");

  // -------------------------
  // Utilities
  // -------------------------
  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  function cryptoRandInt(maxExclusive) {
    // unbiased for small max via rejection
    if (maxExclusive <= 0) throw new Error("maxExclusive must be > 0");
    const maxUint = 0xffffffff;
    const limit = maxUint - (maxUint % maxExclusive);
    const buf = new Uint32Array(1);
    while (true) {
      crypto.getRandomValues(buf);
      const x = buf[0];
      if (x < limit) return x % maxExclusive;
    }
  }

  function shuffle(array, rngIntFn) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rngIntFn(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function base32(bytes) {
    // Crockford Base32 without I,L,O,U for transcription safety
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    let bits = 0, value = 0, output = "";
    for (const b of bytes) {
      value = (value << 8) | b;
      bits += 8;
      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
    return output;
  }

  function makeAttemptCode(prefix) {
    // High-entropy code, human-friendly grouped, no answers embedded
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const raw = base32(bytes).slice(0, 12); // 12 chars
    const g1 = raw.slice(0, 4);
    const g2 = raw.slice(4, 8);
    const g3 = raw.slice(8, 12);
    return `${prefix}-${g1}-${g2}-${g3}`;
  }

  function safeText(s) {
    return String(s ?? "").trim();
  }

  function saveAttempt(state) {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadAttempt() {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  function clearAttempt() {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // -------------------------
  // State
  // -------------------------
  let timer = null;

  let state = {
    status: "idle", // idle | running | submitted
    testType: "pre", // pre | post
    studentId: "",
    startedAt: null,
    remainingSec: TOTAL_SECONDS,
    order: [], // array of { itemId, optionOrder: [0..3] }
    answers: {}, // itemId -> chosenOptionIndex (original index, not shuffled position)
    currentIndex: 0,
    attemptCode: null,
    submittedAt: null,
    score: null,
  };

  // -------------------------
  // Attempt creation/restoration
  // -------------------------
  function createNewAttempt(testType, studentId) {
    const itemOrder = shuffle(ITEMS.map(x => x.id), cryptoRandInt);

    const order = itemOrder.map((itemId) => {
      const optionOrder = shuffle([0, 1, 2, 3], cryptoRandInt);
      return { itemId, optionOrder };
    });

    const prefix = testType === "pre" ? "PRE" : "POST";

    return {
      status: "running",
      testType,
      studentId,
      startedAt: Date.now(),
      remainingSec: TOTAL_SECONDS,
      order,
      answers: {},
      currentIndex: 0,
      attemptCode: makeAttemptCode(prefix),
      submittedAt: null,
      score: null,
    };
  }

  function restoreOrInitFromSession() {
    const saved = loadAttempt();
    if (saved && saved.status === "running") {
      state = saved;
      // Recompute remaining time based on wall-clock (prevents pause-by-reload)
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      const newRemaining = Math.max(0, TOTAL_SECONDS - elapsed);
      state.remainingSec = newRemaining;
      if (newRemaining === 0) {
        submitAttempt(true);
        return;
      }
      showTestView();
      startTimer();
      renderQuestion();
      return;
    }
    // otherwise stay in setup
    showSetupView();
  }

  // -------------------------
  // UI view switching
  // -------------------------
  function showSetupView() {
    setupView.classList.remove("hidden");
    testView.classList.add("hidden");
    resultView.classList.add("hidden");
  }

  function showTestView() {
    setupView.classList.add("hidden");
    testView.classList.remove("hidden");
    resultView.classList.add("hidden");

    lblTestType.textContent = state.testType.toUpperCase();
    updateTopbar();
  }

  function showResultView() {
    setupView.classList.add("hidden");
    testView.classList.add("hidden");
    resultView.classList.remove("hidden");

    outStudentId.textContent = state.studentId || "(leer)";
    outTestType.textContent = state.testType.toUpperCase();
    outCode.textContent = state.attemptCode;
    outTime.textContent = fmtTime(TOTAL_SECONDS - state.remainingSec);
    outScore.textContent = `${state.score}/14`;
  }

  // -------------------------
  // Timer
  // -------------------------
  function startTimer() {
    stopTimer();
    timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      state.remainingSec = Math.max(0, TOTAL_SECONDS - elapsed);
      updateTopbar();
      saveAttempt(state);

      if (state.remainingSec <= 0) {
        submitAttempt(true);
      }
    }, 250);
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  // -------------------------
  // Rendering
  // -------------------------
  function updateTopbar() {
    lblTime.textContent = fmtTime(state.remainingSec);
    lblProgress.textContent = `${state.currentIndex + 1}/14`;
    const pct = ((state.currentIndex + 1) / 14) * 100;
    progressBar.style.width = `${pct}%`;

    btnPrev.disabled = state.currentIndex === 0;
    btnNext.disabled = state.currentIndex === 13;
  }

  function getItemById(itemId) {
    const item = ITEMS.find(x => x.id === itemId);
    if (!item) throw new Error(`Unknown itemId: ${itemId}`);
    return item;
  }

  function renderQuestion() {
    updateTopbar();

    const entry = state.order[state.currentIndex];
    const item = getItemById(entry.itemId);

    const chosenOriginalIndex = state.answers[item.id]; // original option index
    const optionOrder = entry.optionOrder; // array of original indices in displayed order

    const container = document.createElement("div");

    const title = document.createElement("div");
    title.className = "qtitle";
    title.textContent = `Frage ${state.currentIndex + 1}: ${item.stem}`;
    container.appendChild(title);

    // Preserve line breaks for the query-stem item
    if (item.stem.includes("\n")) {
      title.style.whiteSpace = "pre-wrap";
    }

    optionOrder.forEach((origIdx, displayPos) => {
      const optWrap = document.createElement("label");
      optWrap.className = "opt";

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "currentQuestion";
      radio.value = String(origIdx);
      radio.checked = chosenOriginalIndex === origIdx;

      radio.addEventListener("change", () => {
        state.answers[item.id] = origIdx;
        saveAttempt(state);
      });

      const txt = document.createElement("div");
      txt.textContent = item.options[origIdx];

      optWrap.appendChild(radio);
      optWrap.appendChild(txt);
      container.appendChild(optWrap);
    });

    // Small scientific safeguard: show unanswered state (without being corrective)
    const meta = document.createElement("div");
    meta.className = "muted";
    const answered = typeof chosenOriginalIndex === "number";
    meta.textContent = answered ? "Antwort gespeichert." : "Noch keine Antwort ausgewählt.";
    container.appendChild(meta);

    questionHost.innerHTML = "";
    questionHost.appendChild(container);
  }

  // -------------------------
  // Scoring + Submission
  // -------------------------
  function computeScore() {
    let score = 0;
    for (const { itemId } of state.order) {
      const item = getItemById(itemId);
      const ans = state.answers[item.id];
      if (typeof ans === "number" && ans === item.correctIndex) score += 1;
    }
    return score;
  }

  function submitAttempt(auto) {
    if (state.status !== "running") return;

    // Freeze state
    stopTimer();
    state.status = "submitted";
    state.submittedAt = Date.now();
    state.score = computeScore();

    // If auto-submitted at time 0, lock remaining to 0 for reporting
    if (auto) state.remainingSec = 0;

    saveAttempt(state);
    showResultView();
  }

  // -------------------------
  // Events
  // -------------------------
  btnStart.addEventListener("click", () => {
    const studentId = safeText(studentIdEl.value);
    const testType = testTypeEl.value === "post" ? "post" : "pre";

    // Minimal validity: require some ID to reduce data-matching errors on paper
    if (!studentId) {
      alert("Bitte Nutzer-ID eintragen (für die Zuordnung auf Papier).");
      studentIdEl.focus();
      return;
    }

    // New attempt always shuffles; requirement: each open random
    state = createNewAttempt(testType, studentId);
    saveAttempt(state);

    showTestView();
    startTimer();
    renderQuestion();
  });

  btnPrev.addEventListener("click", () => {
    if (state.currentIndex > 0) {
      state.currentIndex -= 1;
      saveAttempt(state);
      renderQuestion();
    }
  });

  btnNext.addEventListener("click", () => {
    if (state.currentIndex < 13) {
      state.currentIndex += 1;
      saveAttempt(state);
      renderQuestion();
    }
  });

  btnSubmit.addEventListener("click", () => {
    // Scientific choice: allow submit even if unanswered; prevents forcing guesses.
    const unanswered = state.order
      .map(o => o.itemId)
      .filter(id => typeof state.answers[id] !== "number");

    const msg =
      unanswered.length > 0
        ? `Es sind ${unanswered.length} Fragen unbeantwortet. Trotzdem abgeben?`
        : "Test jetzt abgeben?";

    if (confirm(msg)) submitAttempt(false);
  });

  btnResetAttempt.addEventListener("click", () => {
    if (confirm("Neuen Versuch starten? (Aktueller Versuch geht verloren.)")) {
      clearAttempt();
      stopTimer();
      // Hard reset to setup
      state.status = "idle";
      showSetupView();
    }
  });

  btnFullscreen.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen failure (policy restrictions on some browsers)
    }
  });

  btnCopyCode.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(state.attemptCode);
      alert("Code kopiert.");
    } catch {
      alert("Kopieren nicht möglich. Bitte manuell abschreiben.");
    }
  });

  btnDownloadJson.addEventListener("click", () => {
    // Optional; teacher can collect files or students can upload if you add a submit channel.
    const payload = {
      schema: "schulazon_sql_test_v1",
      attemptCode: state.attemptCode,
      testType: state.testType,
      studentId: state.studentId,
      startedAt: state.startedAt,
      submittedAt: state.submittedAt,
      durationSec: TOTAL_SECONDS - state.remainingSec,
      score: state.score,
      answers: state.answers, // itemId -> original option index
      order: state.order, // contains shuffling info (reconstruction possible)
    };
    const fname = `${state.testType}_${state.studentId}_${state.attemptCode}.json`
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    download(fname, JSON.stringify(payload, null, 2), "application/json");
  });

  // Prevent accidental unload during running attempt (didactically sinnvoll)
  window.addEventListener("beforeunload", (e) => {
    const saved = loadAttempt();
    if (saved && saved.status === "running") {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // -------------------------
  // Boot
  // -------------------------
  restoreOrInitFromSession();

})();
