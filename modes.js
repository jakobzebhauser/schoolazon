/* ===========================
   ShopBridge (Parent -> iframe)
   =========================== */


// ===========================
// Global message bridge (Shop iframe -> Mode)
// Compatibility layer: handles legacy messages without __SCHULAZON__
// Shop may send: { type: "SHOP_ACTION", actionId } (without __SCHULAZON__)
// ===========================
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  const msg = event?.data;
  if (!msg || typeof msg !== "object") return;

  // If this is a new-format message, ShopBridge will handle it.
  if (msg.__SCHULAZON__ === true) return;

  if (msg.type === "SHOP_ACTION") {
    const actionId = msg.actionId;
    if (!actionId) return;
    if (window.currentMode && typeof window.currentMode.onShopSelect === "function") {
      window.currentMode.onShopSelect(actionId);
    }
    return;
  }

  if (msg.type === "SQLI_SUCCESS") {
    if (window.currentMode && typeof window.currentMode.onSqliSuccess === "function") {
      window.currentMode.onSqliSuccess();
    }
  }
});

function lockShop(taskId, locked){
  const frame = document.getElementById("shopFrame");
  if (!frame || !frame.contentWindow) return;

  frame.contentWindow.postMessage(
    { __SCHULAZON__: true, type: "SET_LOCK", taskId, locked },
    window.location.origin
  );
}
const ALL_TASK_IDS = [
  "all","express","bestseller","available",
  "cat-electronics","cat-household","cat-sport",
  "price-25","price-50","price-100",
  "rating-5","rating-4",
  "priceAsc","priceDesc","popularity",
  "search",
  "orders",
  "topProducts",
  "cart-refresh",
  "cart-total"
];

/* ===========================
   Reset: Free-Mode soll bei jedem Neuaufruf frisch starten
   (Name, Timer, Freischaltungen, Hint-Status)
   =========================== */
(function resetFreeModeStateOnLoad(){
  try {
    const isFree = (document.body && document.body.dataset && document.body.dataset.mode) === "free";
    if (!isFree) return;
    const isTutorial = (document.body && document.body.dataset && document.body.dataset.tutorial) === "1";
    const skipReset = safeGet(sessionStorage, "schulazon_skip_reset_v1") === "true";
    if (skipReset) {
      // In der Einführung nicht konsumieren, damit der Rücksprung in den Free‑Modus
      // keinen Reset auslöst.
      if (!isTutorial) {
        try { sessionStorage.removeItem("schulazon_skip_reset_v1"); } catch (_) {}
      }
      return;
    }
    const keys = [
      "schulazon_name",
      "schulazon_unlocked_v1",
      "schulazon_hint_used_v1",
      "schulazon_scaffold_used_v1",
      "schulazon_sqli_done_v1",
      "schulazon_free_startedAt_v1"
    ];
    keys.forEach((k) => {
      try { localStorage.removeItem(k); } catch (_) {}
      try { sessionStorage.removeItem(k); } catch (_) {}
    });
    try { window.SCHULAZON_NAME = ""; } catch (_) {}
  } catch (_) {}
})();


const THEORY_CHAPTERS = [
  {
    id: 'einleitung',
    title: 'Einleitung',
    html: `<p><strong>SQL</strong> ist die Standardsprache, um Daten aus einer Datenbank abzufragen. Eine SQL-Abfrage besteht aus festen Bausteinen (z. B. <strong>SELECT</strong>, <strong>FROM</strong>, <strong>WHERE</strong>), die du je nach Ziel kombinierst.</p>
<table class="spicker-table"><thead><tr><th>Baustein</th><th>Zweck (kurz)</th></tr></thead><tbody>
<tr><td><strong>SELECT</strong></td><td>Welche Spalten sollen angezeigt werden</td></tr>
<tr><td><strong>FROM</strong></td><td>Aus welcher(n) Tabelle(n) kommen die Daten</td></tr>
<tr><td><strong>WHERE</strong></td><td>Welche Zeilen sollen ausgewählt werden (Bedingungen)</td></tr>
<tr><td><strong>ORDER BY</strong></td><td>Sortierung der Ergebnistabelle</td></tr>
<tr><td><strong>Aggregat</strong> / <strong>GROUP BY</strong> / <strong>HAVING</strong></td><td>Zusammenfassen und Filtern von Gruppen</td></tr>
</tbody></table>`,
    exampleSql: `SELECT *
FROM products;`
  },
  {
    id: 'schluessel',
    title: 'Schlüssel',
    html: `<p>Eine Datenbank speichert Daten in Tabellen, in denen jede Zeile ein Datensatz ist und jede Spalte ein Attribut. Ein <strong>Primärschlüssel</strong> identifiziert einen Datensatz eindeutig; ein <strong>Fremdschlüssel</strong> verweist auf den Primärschlüssel einer anderen Tabelle, um Tabellen zu verbinden.</p>`
  },
  {
    id: 'select-from',
    title: 'SELECT … FROM …',
    html: `<p><strong>*</strong> bedeutet „alle Spalten“, und <strong>DISTINCT</strong> sorgt dafür, dass gleiche Werte in der Ergebnisspalte nur einmal vorkommen.</p>
<p>Distinct veranschaulichen mit Tabelle wo doppelte werte rot rausgestrichen werden. Einfach irgendein beispiel was aber zu meiner db passt.</p>`,
    exampleSql: `SELECT DISTINCT category
FROM products;`
  },
  {
    id: 'where',
    title: 'WHERE',
    html: `<p><strong>WHERE</strong> filtert Zeilen: Nur Datensätze, die die Bedingung erfüllen, kommen ins Ergebnis. Mehrere Bedingungen kannst du mit <strong>AND</strong> und <strong>OR</strong> verknüpfen; <strong>NOT</strong> kehrt eine Bedingung um.</p>
<table class="spicker-table"><thead><tr><th>Operator</th><th>Bedeutung</th></tr></thead><tbody>
<tr><td><strong>=</strong></td><td>gleich</td></tr>
<tr><td><strong>&lt;&gt;</strong></td><td>ungleich</td></tr>
<tr><td><strong>&lt; / &lt;=</strong></td><td>kleiner / kleiner-gleich</td></tr>
<tr><td><strong>&gt; / &gt;=</strong></td><td>größer / größer-gleich</td></tr>
</tbody></table>
<table class="spicker-table"><thead><tr><th>Logik</th><th>Wirkung</th></tr></thead><tbody>
<tr><td><strong>AND</strong></td><td>beide Bedingungen müssen wahr sein</td></tr>
<tr><td><strong>OR</strong></td><td>mindestens eine Bedingung muss wahr sein</td></tr>
<tr><td><strong>NOT</strong></td><td>macht „wahr“ zu „falsch“ (und umgekehrt)</td></tr>
</tbody></table>`,
    exampleSql: `SELECT name, price
FROM products
WHERE price <= 50
  AND available = 1;`
  },
  {
    id: 'order-by',
    title: 'ORDER BY',
    html: `<p><strong>ORDER BY</strong> sortiert die Ergebnistabelle nach einer oder mehreren Spalten. Du kannst aufsteigend (<strong>ASC</strong>) oder absteigend (<strong>DESC</strong>) sortieren.</p>`,
    exampleSql: `SELECT name, price
FROM products
ORDER BY price DESC;`
  },
  {
    id: 'aggregat-as',
    title: 'Aggregat & AS',
    html: `<p><strong>Aggregatfunktionen</strong> fassen viele Zeilen zu einem Ergebniswert zusammen (z. B. Anzahl, Minimum, Durchschnitt). Mit <strong>AS</strong> gibst du Spalten im Ergebnis einen verständlichen Namen (Alias).</p>
<table class="spicker-table"><thead><tr><th>Aggregatfunktion</th><th>Zweck</th></tr></thead><tbody>
<tr><td><strong>COUNT(...)</strong></td><td>zählt Werte/Zeilen</td></tr>
<tr><td><strong>SUM(...)</strong></td><td>Summe</td></tr>
<tr><td><strong>AVG(...)</strong></td><td>Durchschnitt</td></tr>
<tr><td><strong>MIN(...)</strong></td><td>kleinster Wert</td></tr>
<tr><td><strong>MAX(...)</strong></td><td>größter Wert</td></tr>
</tbody></table>`,
    exampleSql: `SELECT COUNT(*) AS anzahl
FROM products
WHERE available = 1;`
  },
  {
    id: 'group-by-having',
    title: 'GROUP BY & HAVING',
    html: `<p><strong>GROUP BY</strong> bildet Gruppen von Zeilen mit gleichem Wert in einer Spalte, damit du pro Gruppe Aggregatwerte berechnen kannst. <strong>HAVING</strong> filtert anschließend Gruppen (nicht einzelne Zeilen).</p>`,
    exampleSql: `SELECT category, COUNT(*) AS anzahl
FROM products
GROUP BY category
HAVING COUNT(*) >= 3;`
  },
  {
    id: 'verbund-1-n',
    title: 'Verbund 1:n',
    html: `<p>Eine <strong>1:n‑Beziehung</strong> bedeutet: Ein Datensatz auf der „1‑Seite“ gehört zu vielen Datensätzen auf der „n‑Seite“. In Tabellen setzt man das um, indem man den <strong>Primärschlüssel</strong> der „1‑Seite“ als <strong>Fremdschlüssel</strong> in der Tabelle der „n‑Seite“ speichert.</p>`
  },
  {
    id: 'verbund-n-m',
    title: 'Verbund n:m',
    html: `<p>Eine <strong>n:m‑Beziehung</strong> bedeutet: Viele Datensätze aus Tabelle A passen zu vielen Datensätze aus Tabelle B. Das setzt man mit einer zusätzlichen <strong>Beziehungstabelle</strong> um, die die beiden <strong>Primärschlüssel</strong> als <strong>Fremdschlüssel</strong> speichert; oft bilden diese beiden Fremdschlüssel zusammen den Primärschlüssel der Beziehungstabelle.</p>`
  },
  {
    id: 'personenbezogene-daten',
    title: 'Personenbezogene Daten',
    html: `<p><strong>Personenbezogene Daten</strong> sind Informationen, die sich direkt oder indirekt auf eine bestimmte Person beziehen (also eine Person erkennbar machen). Sie sind besonders geschützt (u. a. durch Gesetze und die <strong>Datenschutz‑Grundverordnung (DSGVO)</strong>).</p>`
  }
];

/* ===========================
   Shell chrome helpers (Name, Timer, Fullscreen)
   =========================== */

const FREE_TIMER_TOTAL_SEC = 60 * 60;
const FREE_TIMER_KEY = "schulazon_free_startedAt_v1";
const FREE_HEADER_COLLAPSE_KEY = "schulazon_free_header_collapsed_v1";


const BONUS_MIN_PCT = 10;
function safeGet(storage, key) {
  try { return (storage && storage.getItem(key)) || ""; } catch { return ""; }
}

function safeSet(storage, key, val) {
  try { storage && storage.setItem(key, val); } catch {}
}

function formatMMSS(totalSec) {
  const sec = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${pad2(m)}:${pad2(s)}`;
}

function persistStudentName(name) {
  const n = (name || "").toString().trim();
  if (!n) return "";
  safeSet(sessionStorage, "schulazon_name", n);
  safeSet(localStorage, "schulazon_name", n);
  try { window.SCHULAZON_NAME = n; } catch {}
  return n;
}

function getStudentName() {
  const fromGlobal = (window.SCHULAZON_NAME || "").toString().trim();
  const fromSession = safeGet(sessionStorage, "schulazon_name").toString().trim();
  const fromLocal = safeGet(localStorage, "schulazon_name").toString().trim();

  let fromQuery = "";
  try {
    const qp = new URLSearchParams(window.location.search);
    fromQuery = (qp.get("name") || "").toString().trim();
  } catch {}

  // best-effort: read from shop iframe if present
  let fromShop = "";
  try {
    const frame = document.getElementById("shopFrame");
    const doc = frame?.contentDocument;
    const el = doc?.getElementById("studentName");
    fromShop = (el?.textContent || "").toString().trim();
  } catch {}

  return (fromGlobal || fromSession || fromLocal || fromQuery || fromShop).trim();
}

function initTopbarChrome() {
  // 1) Persist name if provided in query
  try {
    const qp = new URLSearchParams(window.location.search);
    const qn = (qp.get("name") || "").toString().trim();
    if (qn) persistStudentName(qn);
  } catch {}

  // 2) Name pill
  const name = getStudentName();
  const pillName = document.getElementById("pillName");
  const nameTag = document.getElementById("nameTag");
  if (pillName && nameTag) {
    if (name) {
      pillName.style.display = "flex";
      nameTag.textContent = name;
    } else {
      pillName.style.display = "none";
    }
  }

  // 2b) best-effort: Shop-Name nicht übernehmen (Reset pro Reload)
  try {
    const frame = document.getElementById("shopFrame");
    frame?.addEventListener("load", () => {
      try {
        const doc = frame.contentDocument;
        const el = doc?.getElementById("studentName");
        if (el) el.textContent = "";
      } catch (_) {}
    }, { once: true });
  } catch (_) {}

  // 3) Fullscreen
  const fsBtn = document.getElementById("fsBtn");
  const homeBtn = document.getElementById("homeBtn");
  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  }
  if (fsBtn) {
    fsBtn.addEventListener("click", toggleFullscreen);
    document.addEventListener("fullscreenchange", () => {
      fsBtn.textContent = document.fullscreenElement ? "Vollbild aus" : "Vollbild";
    });
  }
  if (homeBtn) {
    homeBtn.addEventListener("click", () => {
      const ok = window.confirm("Willst du wirklich zur Startseite? Alle aktuellen Spielstände gehen verloren.");
      if (!ok) return;
      try { window.location.assign("index.html"); } catch (_) { window.location.href = "index.html"; }
    });
  }

  // 3b) Exit -> Posttest (name bleibt erhalten)
  const exitBtn = document.getElementById("exitBtn");
  const helpBtn = document.getElementById("helpBtn");
  const isTutorial = (document.body && document.body.dataset && document.body.dataset.tutorial) === "1";
  const goPosttest = () => {
    const name = getStudentName();
    if (name) persistStudentName(name);
    const url = "posttest.html" + (name ? `?name=${encodeURIComponent(name)}` : "");
    try { window.location.assign(url); } catch (_) { window.location.href = url; }
  };
  if (exitBtn && !isTutorial) exitBtn.addEventListener("click", goPosttest);

  const helpOverlay = document.getElementById("helpOverlay");
  const helpCloseBtn = document.getElementById("helpClose");
  const helpOkBtn = document.getElementById("helpOk");
  const openHelp = () => {
    if (!helpOverlay) return;
    helpOverlay.classList.add("show", "open");
    helpOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("help-open");
    try { helpOkBtn?.focus(); } catch (_) {}
  };
  const closeHelp = () => {
    if (!helpOverlay) return;
    helpOverlay.classList.remove("show", "open");
    helpOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("help-open");
    try { helpBtn?.focus(); } catch (_) {}
  };
  if (helpBtn && !isTutorial) helpBtn.addEventListener("click", openHelp);
  if (helpCloseBtn) helpCloseBtn.addEventListener("click", closeHelp);
  if (helpOkBtn) helpOkBtn.addEventListener("click", closeHelp);
  if (helpOverlay) {
    helpOverlay.addEventListener("click", (e) => {
      if (e.target === helpOverlay) closeHelp();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && helpOverlay?.classList?.contains("show")) closeHelp();
  });
  if (helpBtn && isTutorial) {
    helpBtn.setAttribute("aria-disabled", "true");
    helpBtn.setAttribute("title", "Du bist bereits in der Einführung");
  }

  const menu = document.getElementById("labMenu");
  if (menu) {
    document.addEventListener("click", (e) => {
      if (!menu.contains(e.target)) menu.removeAttribute("open");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") menu.removeAttribute("open");
    });
    menu.addEventListener("click", (e) => {
      if (e.target && e.target.closest("button")) menu.removeAttribute("open");
    });
  }

  // 4) 60-min countdown (session-persisted)
  const timerTag = document.getElementById("timerTag");
  const pillTimer = document.getElementById("pillTimer");
  if (!timerTag && !pillTimer) {
    try { sessionStorage.removeItem(FREE_TIMER_KEY); } catch (_) {}
    return;
  }

  let startedAt = Number(safeGet(sessionStorage, FREE_TIMER_KEY) || "");
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    startedAt = Date.now();
    safeSet(sessionStorage, FREE_TIMER_KEY, String(startedAt));
  }

  const tick = () => {
    const elapsedSec = (Date.now() - startedAt) / 1000;
    const remaining = FREE_TIMER_TOTAL_SEC - elapsedSec;
    if (timerTag) timerTag.textContent = formatMMSS(remaining);
    if (remaining <= 0) {
      if (timerTag) timerTag.textContent = "00:00";
      document.body.classList.add("timeup");
      if (!window.__SCHULAZON_TIMEUP__) {
        window.__SCHULAZON_TIMEUP__ = true;
        window.setTimeout(goPosttest, 300);
      }
      return false;
    }
    return true;
  };

  tick();
  const iv = window.setInterval(() => {
    const keep = tick();
    if (!keep) window.clearInterval(iv);
  }, 250);
}





   class ShopBridge {

  
  constructor(frameId = "shopFrame") {
    this.frame = document.getElementById(frameId);
    this.isReady = false;


    // ready, damit Nachrichten sicher ankommen
    this.ready = new Promise((resolve) => {
  this._resolveReady = resolve;
});


    this.handlers = [];
    this.sqliHandlers = [];
    window.addEventListener("message", (e) => {
      if (e.origin !== window.location.origin) return;
      const msg = e.data;
      if (!msg || msg.__SCHULAZON__ !== true) return;
if (msg.type === "SHOP_READY") {
  if (!this.isReady) {
    this.isReady = true;
    this._resolveReady?.();
  }
  return;
}


      if (msg.type === "SHOP_ACTION") {
        this.handlers.forEach(fn => fn(msg.actionId));
      }

      if (msg.type === "SQLI_SUCCESS") {
        this.sqliHandlers.forEach(fn => fn());
      }
    });
  }

  frameComplete() {
    // beste-effort: nach load ist sicher, sonst egal
    return true;
  }

  send(type, payload = {}) {
    this.frame?.contentWindow?.postMessage(
      { __SCHULAZON__: true, type, ...payload },
      window.location.origin
    );
  }

  async lock(taskId, locked) {
    await this.ready;
    this.send("SET_LOCK", { taskId, locked });
  }

  onShopAction(fn) {
    this.handlers.push(fn);
  }

  onSqliSuccess(fn) {
    this.sqliHandlers.push(fn);
  }
}

/* ===========================
   FreeMode (v1) - Bugfrei
   =========================== */
class FreeMode {
  constructor(root) {
    window.currentMode = this; // active mode for iframe messages
    this.root = root;
    this.shop = new ShopBridge("shopFrame");
    this.db = null;

    // Progress/Score (Gamification)
    // UI soll explizit bei x/N bleiben (N = Anzahl Aufgaben).
    this.TOTAL_TASKS = 0;
    this.hintUsed = {};
    this.scaffoldUsed = {};
    this.sqliDone = false;

    // gespeicherte Freischalt‑SQL pro Aufgabe
    this.solutionSql = {};


    // Aufgaben-Definitionen (auf data-task IDs gemappt)
    this.TASKS = this.buildTasks();
    this.TOTAL_TASKS = Object.keys(this.TASKS).length;

    // unlocked state (persistiert)
    this.unlocked = {};
    Object.keys(this.TASKS).forEach(id => this.unlocked[id] = false);
    this.loadProgressState();

    // Shop-Klicks -> Aufgabe auswählen
    this.shop.onShopAction((actionId) => this.onShopSelect(actionId));

    // SQLi-Bonus (Login erfolgreich)
    this.shop.onSqliSuccess?.(() => this.onSqliSuccess());

    this.currentId = null;
    this.headerCollapsed = false;
    this.headerEditMode = false;
    this._pendingScaffoldTaskId = null;
  }

  loadProgressState() {
    // Defensive: nichts kaputt machen, wenn localStorage nicht verfügbar ist.
    try {
      const rawUnlocked = localStorage.getItem('schulazon_unlocked_v1');
      if (rawUnlocked) {
        const data = JSON.parse(rawUnlocked);
        if (data && typeof data === 'object') {
          Object.keys(this.unlocked).forEach((k) => {
            this.unlocked[k] = !!data[k];
          });
        }
      }

      const rawHints = localStorage.getItem('schulazon_hint_used_v1');
      if (rawHints) {
        const data = JSON.parse(rawHints);
        if (data && typeof data === 'object') this.hintUsed = data;
      }

      const rawScaffolds = localStorage.getItem('schulazon_scaffold_used_v1');
      if (rawScaffolds) {
        const data = JSON.parse(rawScaffolds);
        if (data && typeof data === 'object') this.scaffoldUsed = data;
      }


      const rawSolutions = localStorage.getItem('schulazon_solution_sql_v1');
      if (rawSolutions) {
        const data = JSON.parse(rawSolutions);
        if (data && typeof data === 'object') this.solutionSql = data;
      }

      this.sqliDone = localStorage.getItem('schulazon_sqli_done_v1') === 'true';
      this.spickerUsed = localStorage.getItem('schulazon_spicker_used_v1') === 'true';
    } catch (_) {
      // ignore
    }
  }

  persistProgressState() {
    try {
      localStorage.setItem('schulazon_unlocked_v1', JSON.stringify(this.unlocked));
      localStorage.setItem('schulazon_hint_used_v1', JSON.stringify(this.hintUsed || {}));
      localStorage.setItem('schulazon_scaffold_used_v1', JSON.stringify(this.scaffoldUsed || {}));
      localStorage.setItem('schulazon_solution_sql_v1', JSON.stringify(this.solutionSql || {}));
      localStorage.setItem('schulazon_sqli_done_v1', this.sqliDone ? 'true' : 'false');
      localStorage.setItem('schulazon_spicker_used_v1', this.spickerUsed ? 'true' : 'false');
    } catch (_) {
      // ignore
    }
  }

  onSqliSuccess() {
    if (this.sqliDone) return;
    this.sqliDone = true;
    this.persistProgressState();
    this.updateProgressUI();
    if (this.currentSideView === 'sqli') this.openBonus();
  }

  buildTasks() {
    return {

      "search": {
        title: "Produkte suchen",
        difficulty: "+++",
        task:
`Aufgabe:
Ein Nutzer gibt einen Suchbegriff ein. Der Suchbegriff steht als Platzhalter :q zur Verfügung.
Zeige alle Produkte, deren Name den Begriff enthält (LIKE mit Wildcards).
Gib alle Spalten der Tabelle produkte aus.`,
        starter: "SELECT * FROM produkte WHERE name LIKE '%' || :q || '%';",
        refSql: "SELECT * FROM produkte WHERE name LIKE '%' || :q || '%';",
        sqlRules: {
          require: ["like", ":q", "%", "tablecol:produkte:name"],
          message: "Nutze LIKE mit :q und Wildcards (%) auf dem Produktnamen."
        },
        mode: "rows_set"
      },

      "all": {
        title: "Alle Produkte",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle vorhandenen Produkte.
Gib alle Produktdaten aus.`,
        starter: "SELECT * FROM produkte;",
        refSql: "SELECT * FROM produkte;",
        mode: "rows_set"
      },

      "express": {
        title: "Expresslieferung",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte, die bereits am nächsten Tag geliefert werden.
Gib alle Produktdaten aus.

Tipp: liefertage = 1 (genau).`,
        starter: "SELECT * FROM produkte WHERE liefertage = 1;",
        refSql: "SELECT * FROM produkte WHERE liefertage = 1;",
        sqlRules: {
          require: ["cmp:liefertage:=:1", "tablecol:produkte:liefertage"],
          message: "Filtere exakt mit liefertage = 1."
        },
        mode: "rows_set"
      },

      "bestseller": {
        title: "Bestseller",
        difficulty: "+++",
        task:
`Aufgabe:
Zeige alle Produkte, die insgesamt öfter als 300-mal verkauft wurden.
Ein Produkt kann mehrfach verkauft worden sein; alle diese Verkäufe sollen zusammengezählt werden.
Gib alle Produktdaten aus.`,
        starter:
`SELECT p.*
FROM produkte p
WHERE p.id IN (
  SELECT v.produkt_id
  FROM verkäufe v
  GROUP BY v.produkt_id
  HAVING SUM(v.anzahl) > 300
);`,
        refSql:
`SELECT p.*
FROM produkte p
WHERE p.id IN (
  SELECT v.produkt_id
  FROM verkäufe v
  GROUP BY v.produkt_id
  HAVING SUM(v.anzahl) > 300
);`,
        sqlRules: {
          require: ["sum(", "having"],
          message: "Für diese Aufgabe brauchst du eine Aggregation mit SUM(...) und eine HAVING-Bedingung."
        },
        mode: "rows_set"
      },

      "available": {
        title: "Nur noch wenige auf Lager",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte, von denen nur noch wenige Stück auf Lager sind.
Ein Produkt gilt als „nur noch wenige auf Lager“, wenn der Lagerbestand zwischen 1 und 5 Stück liegt.
Gib alle Produktdaten aus (1 und 5 sind inklusive).`,
        starter:
`SELECT *
FROM produkte
WHERE lagerbestand >= 1
AND lagerbestand <= 5;`,
        refSql:
`SELECT *
FROM produkte
WHERE lagerbestand >= 1
AND lagerbestand <= 5;`,
        sqlRules: {
          require: ["range:lagerbestand:1:5", "tablecol:produkte:lagerbestand"],
          message: "Nutze den Bereich 1 bis 5 (inklusive)."
        },
        mode: "rows_set"
      },

      "priceAsc": {
        title: "Preis aufsteigend",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte und sortiere sie vom günstigsten zum teuersten.
Gib alle Produktdaten aus.`,
        starter: "SELECT * FROM produkte ORDER BY preis ASC;",
        refSql: "SELECT * FROM produkte ORDER BY preis ASC;",
        mode: "rows_order"
      },

      "priceDesc": {
        title: "Preis absteigend",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte und sortiere sie vom teuersten zum günstigsten.
Gib alle Produktdaten aus.`,
        starter: "SELECT * FROM produkte ORDER BY preis DESC;",
        refSql: "SELECT * FROM produkte ORDER BY preis DESC;",
        mode: "rows_order"
      },

      "popularity": {
        title: "Beliebtheit",
        difficulty: "+++",
        task:
`Aufgabe:
Sortiere Produkte nach ihrer Beliebtheit.
Beliebtheit bedeutet, wie oft ein Produkt verkauft wurde.
Mehrere Verkäufe desselben Produkts sollen zusammengezählt werden.
Gib Produkt-ID und Verkaufszahl aus.`,
        starter:
`SELECT produkt_id, SUM(anzahl) AS verkäufe
FROM verkäufe
GROUP BY produkt_id
ORDER BY verkäufe DESC;`,
        refSql:
`SELECT produkt_id, SUM(anzahl) AS verkäufe
FROM verkäufe
GROUP BY produkt_id
ORDER BY verkäufe DESC;`,
        sqlRules: {
          require: ["sum(", "group by", "order by"],
          message: "Für diese Aufgabe brauchst du SUM(...) mit GROUP BY und eine Sortierung per ORDER BY."
        },
        mode: "rows_order"
      },

      "cat-electronics": {
        title: "Kategorie Elektronik",
        difficulty: "++",
        task:
`Aufgabe:
Zeige alle Produkte, die zur Kategorie „Elektronik“ gehören.
Bestimme die Kategorie über den Namen: kategorien.name = 'Elektronik'.
Gib alle Produktdaten aus (SELECT p.*).`,
        starter:
`SELECT p.*
FROM produkte p, kategorien k
WHERE p.kategorie_id = k.id
AND k.name = 'Elektronik';`,
        refSql:
`SELECT p.*
FROM produkte p, kategorien k
WHERE p.kategorie_id = k.id
AND k.name = 'Elektronik';`,
        sqlRules: {
          require: ["tablecol:kategorien:name", "'elektronik'", "eq:kategorie_id:id"],
          message: "Verknüpfe produkte.kategorie_id mit kategorien.id und filtere kategorien.name = 'Elektronik'."
        },
        mode: "rows_set"
      },

      "cat-household": {
        title: "Kategorie Haushalt",
        difficulty: "++",
        task:
`Aufgabe:
Zeige alle Produkte, die zur Kategorie „Haushalt“ gehören.
Bestimme die Kategorie über den Namen: kategorien.name = 'Haushalt'.
Gib alle Produktdaten aus (SELECT p.*).`,
        starter:
`SELECT p.*
FROM produkte p, kategorien k
WHERE p.kategorie_id = k.id
AND k.name = 'Haushalt';`,
        refSql:
`SELECT p.*
FROM produkte p, kategorien k
WHERE p.kategorie_id = k.id
AND k.name = 'Haushalt';`,
        sqlRules: {
          require: ["tablecol:kategorien:name", "'haushalt'", "eq:kategorie_id:id"],
          message: "Verknüpfe produkte.kategorie_id mit kategorien.id und filtere kategorien.name = 'Haushalt'."
        },
        mode: "rows_set"
      },

      "cat-sport": {
        title: "Kategorie Sport",
        difficulty: "++",
        task:
`Aufgabe:
Zeige alle Produkte, die zur Kategorie „Sport“ gehören.
Bestimme die Kategorie über den Namen: kategorien.name = 'Sport'.
Gib alle Produktdaten aus (SELECT p.*).`,
        starter:
`SELECT p.*
FROM produkte p, kategorien k
WHERE p.kategorie_id = k.id
AND k.name = 'Sport';`,
        refSql:
`SELECT p.*
FROM produkte p, kategorien k
WHERE p.kategorie_id = k.id
AND k.name = 'Sport';`,
        sqlRules: {
          require: ["tablecol:kategorien:name", "'sport'", "eq:kategorie_id:id"],
          message: "Verknüpfe produkte.kategorie_id mit kategorien.id und filtere kategorien.name = 'Sport'."
        },
        mode: "rows_set"
      },

      "price-25": {
        title: "Preis unter 25 €",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte mit preis < 25.
Gib alle Produktdaten aus.`,
        starter: "SELECT * FROM produkte WHERE preis < 25;",
        refSql: "SELECT * FROM produkte WHERE preis < 25;",
        sqlRules: {
          require: ["cmp:preis:<:25", "tablecol:produkte:preis"],
          message: "Filtere genau mit preis < 25."
        },
        mode: "rows_set"
      },

      "price-50": {
        title: "Preis 25–50 €",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte mit preis >= 25 und preis <= 50.
Gib alle Produktdaten aus.`,
        starter: "SELECT * FROM produkte WHERE preis >= 25 AND preis <= 50;",
        refSql: "SELECT * FROM produkte WHERE preis >= 25 AND preis <= 50;",
        sqlRules: {
          require: ["range:preis:25:50", "tablecol:produkte:preis"],
          message: "Nutze den Bereich 25 bis 50 (inklusive)."
        },
        mode: "rows_set"
      },

      "price-100": {
        title: "Preis 50–100 €",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte mit preis >= 50 und preis <= 100.
Gib alle Produktdaten aus.`,
        starter: "SELECT * FROM produkte WHERE preis >= 50 AND preis <= 100;",
        refSql: "SELECT * FROM produkte WHERE preis >= 50 AND preis <= 100;",
        sqlRules: {
          require: ["range:preis:50:100", "tablecol:produkte:preis"],
          message: "Nutze den Bereich 50 bis 100 (inklusive)."
        },
        mode: "rows_set"
      },

      "rating-5": {
        title: "Bewertung 5 Sterne",
        difficulty: "++",
        task:
`Aufgabe:
Zeige alle Produkte, die mindestens eine Bewertung mit fünf Sternen erhalten haben.
Ein Produkt kann mehrere Bewertungen haben. Zeige jedes Produkt nur einmal.
Filtere über die Spalte bewertungen.sterne.
Gib alle Produktdaten aus.`,
        starter:
`SELECT DISTINCT p.*
FROM produkte p, bewertungen b
WHERE p.id = b.produkt_id
AND b.sterne = 5;`,
        refSql:
`SELECT DISTINCT p.*
FROM produkte p, bewertungen b
WHERE p.id = b.produkt_id
AND b.sterne = 5;`,
        sqlRules: {
          require: ["tablecol:bewertungen:sterne", "eq:produkt_id:id", "dedup"],
          any: [["cmp:sterne:=:5"], ["invals:sterne:5"], ["range:sterne:5:5"]],
          message: "Verknüpfe produkte.id mit bewertungen.produkt_id, filtere sterne = 5 und entferne Duplikate (DISTINCT/GROUP BY)."
        },
        mode: "rows_set"
      },

      "rating-4": {
        title: "Bewertung 4 Sterne",
        difficulty: "++",
        task:
`Aufgabe:
Zeige alle Produkte, die mindestens eine Bewertung mit vier oder fünf Sternen erhalten haben.
Ein Produkt kann mehrere Bewertungen haben. Zeige jedes Produkt nur einmal.
Filtere über die Spalte bewertungen.sterne.
Gib alle Produktdaten aus.`,
        starter:
`SELECT DISTINCT p.*
FROM produkte p, bewertungen b
WHERE p.id = b.produkt_id
AND b.sterne >= 4;`,
        refSql:
`SELECT DISTINCT p.*
FROM produkte p, bewertungen b
WHERE p.id = b.produkt_id
AND b.sterne >= 4;`,
        sqlRules: {
          require: ["tablecol:bewertungen:sterne", "eq:produkt_id:id", "dedup"],
          any: [["cmp:sterne:>=:4"], ["invals:sterne:4,5"], ["orcmp:sterne:4:5"], ["range:sterne:4:5"]],
          message: "Verknüpfe produkte.id mit bewertungen.produkt_id, filtere sterne >= 4 und entferne Duplikate (DISTINCT/GROUP BY)."
        },
        mode: "rows_set"
      },

      "cart-refresh": {
        title: "Warenkorb aktualisieren",
        difficulty: "++",
        task:
`Aufgabe:
Aktualisiere die Warenkorb-Ansicht.
Gib Produktname, Preis, Menge und die Zeilensumme (preis * menge) aus.
Sortiere nach Produktname (A–Z).`,
        starter:
`SELECT p.name, p.preis, w.menge, p.preis * w.menge AS zeilensumme
FROM produkte p, warenkorb w
WHERE p.id = w.produkt_id
ORDER BY p.name ASC;`,
        refSql:
`SELECT p.name, p.preis, w.menge, p.preis * w.menge AS zeilensumme
FROM produkte p, warenkorb w
WHERE p.id = w.produkt_id
ORDER BY p.name ASC;`,
        sqlRules: {
          require: ["order by", "mul:preis:menge", "eq:produkt_id:id"],
          message: "Die Abfrage braucht eine Zeilensumme (preis * menge) und eine Sortierung per ORDER BY."
        },
        mode: "rows_order"
      },

      "cart-total": {
        title: "Gesamtpreis Warenkorb",
        difficulty: "+++",
        task:
`Aufgabe:
Berechne den Gesamtpreis aller Produkte im Warenkorb.
Gesamtpreis = SUM(preis * menge).
Gib nur den Gesamtpreis aus.`,
        starter:
`SELECT SUM(p.preis * w.menge)
FROM produkte p, warenkorb w
WHERE p.id = w.produkt_id;`,
        refSql:
`SELECT SUM(p.preis * w.menge)
FROM produkte p, warenkorb w
WHERE p.id = w.produkt_id;`,
        sqlRules: {
          require: ["sum(", "mul:preis:menge", "eq:produkt_id:id"],
          message: "Für diese Aufgabe brauchst du SUM(preis * menge)."
        },
        mode: "scalar"
      },

      "orders": {
        title: "Meine Bestellungen",
        difficulty: "+++",
        task:
`Aufgabe:
Zeige die letzten drei Bestellungen des aktuell eingeloggten Nutzers an.
Der eingeloggte Nutzer hat die ID 1.
Gib Produktnamen, Menge und Gesamtpreis aus.`,
        starter:
`SELECT p.name, v.anzahl, p.preis * v.anzahl AS summe
FROM produkte p, verkäufe v
WHERE p.id = v.produkt_id
AND v.nutzer_id = 1
ORDER BY v.id DESC
LIMIT 3;`,
        refSql:
`SELECT p.name, v.anzahl, p.preis * v.anzahl AS summe
FROM produkte p, verkäufe v
WHERE p.id = v.produkt_id
AND v.nutzer_id = 1
ORDER BY v.id DESC
LIMIT 3;`,
        sqlRules: {
          require: ["nutzer_id=1", "order by", "desc", "limit 3", "mul:preis:anzahl"],
          message: "Nutze nutzer_id = 1, ORDER BY ... DESC, LIMIT 3 und berechne den Gesamtpreis (preis * anzahl)."
        },
        mode: "rows_order"
      },

      "topProducts": {
        title: "Top-Produkte",
        difficulty: "+++",
        task:
`Aufgabe:
Zeige die zwei Produkte, die insgesamt am häufigsten verkauft wurden.
Gib Produktnamen und Verkaufszahl aus.`,
        starter:
`SELECT p.name, SUM(v.anzahl) AS gesamt_verkaeufe
FROM produkte p, verkäufe v
WHERE p.id = v.produkt_id
GROUP BY p.id
ORDER BY gesamt_verkaeufe DESC
LIMIT 2;`,
        refSql:
`SELECT p.name, SUM(v.anzahl) AS gesamt_verkaeufe
FROM produkte p, verkäufe v
WHERE p.id = v.produkt_id
GROUP BY p.id
ORDER BY gesamt_verkaeufe DESC
LIMIT 2;`,
        sqlRules: {
          require: ["sum(", "group by", "order by"],
          message: "Für diese Aufgabe brauchst du SUM(...) mit GROUP BY und eine Sortierung per ORDER BY."
        },
        mode: "rows_order"
      }
    };
  }

  async mount() {
  this.renderShell();

  // 1) Shop initialisieren + Buttons sperren
  await this.shop.ready;
  await this.lockAllShopTasks(true);

  // Persistierte Freischaltungen wieder anwenden (Bugfix: Reload darf nichts „verlieren“)
  await this.applyUnlockedToShop();

  // 2) DB laden (für Validierung)
  await this.loadDb();

  // 3) Initialer Zustand (keine Aufgabe ausgewählt)
  this.setEmptyState(true);
  this.updateProgressUI();

  // Best-effort: Name aktualisieren
  this.syncStudentName();

  // Resume task after help/tutorial (optional)
  this.resumeTaskIfAny();
}

renderShell() {
    this.root.innerHTML = `
      <div class="right-wrap">
        <div id="labHint" class="lab-hint" style="display:none;"></div>

<section class="page-shell" id="taskShell">
          <div id="emptyState" class="empty-state">
              Keine Aufgabe ausgewählt. Klicke im Shop auf einen gesperrten Button.
            </div>

          <div id="taskView" style="display:none; min-height:0;" class="task-view task-v3">
              
              <div class="task3-surface">
                <div class="task3-header">
                  <div class="task3-headerLeft">
                    <div class="task3-kicker">Button</div>
                    <h3 class="task3-title" id="taskTitle"></h3>
                    <div class="task-id" id="taskId" style="display:none;"></div>
                  </div>

                  <div class="task3-headerRight">
                    <div class="task3-difficulty-lite" aria-label="Schwierigkeit" title="Schwierigkeit (Punkte)">
                      <div class="difficulty-dots" id="difficultyDots">
                        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                      </div>
                    </div>

                   <button class="btn btn-ghost task3-iconBtn" id="hintBtn" type="button" aria-label="Tipp" title="Tipp anzeigen">
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M9 18h6M10 22h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M8.5 14.5c-.9-1-2.5-2.2-2.5-4.8a6 6 0 1 1 12 0c0 2.6-1.6 3.8-2.5 4.8-.6.7-.9 1.4-1 2.5h-3c-.1-1.1-.4-1.8-1-2.5Z"
          fill="none" stroke="currentColor" stroke-width="2"/>
</svg>
</button>

                   <button class="btn btn-ghost task3-iconBtn" id="scaffoldBtn" type="button" aria-label="Codeger\u00fcst" title="Codeger\u00fcst anzeigen (-3)">
  <span style="font-family:var(--mono); font-weight:900;">&lt;/&gt;</span>
</button>


                    <button class="btn btn-ghost task3-closeBtn" id="taskClose" type="button" title="Aufgabe schließen" aria-label="Aufgabe schließen"><span aria-hidden="true">✕</span></button>
                  </div>
                </div>

                <div class="task3-card">
                  <div class="task3-cardHead">
                    <div class="task3-cardTitle">Aufgabenstellung</div>
                  </div>
                  <div class="task3-body" id="taskBody"></div>
                </div>

                
<div class="task3-card task3-hintCard" id="hintCard" aria-hidden="true">
  <div class="task3-hintHead">
    <div class="task3-cardTitle" id="hintTitle">Tipp</div>
  </div>
  <pre class="task3-hintBody" id="hintText" style="white-space:pre-wrap; margin:0;"></pre>
  <div class="task3-hintActions">
    <button class="btn btn-primary" id="hintConfirm" type="button" style="display:none;">Tipp anzeigen (-1)</button>
  </div>
</div>

<div class="task3-card task3-hintCard" id="scaffoldCard" aria-hidden="true">
  <div class="task3-hintHead">
    <div class="task3-cardTitle" id="scaffoldTitle">Codeger\u00fcst</div>
  </div>
  <pre class="task3-hintBody" id="scaffoldText" style="white-space:pre-wrap; margin:0;"></pre>
  <div class="task3-hintActions">
    <button class="btn btn-primary" id="scaffoldConfirm" type="button" style="display:none;">Codeger\u00fcst anzeigen (-3)</button>
  </div>
</div>

<div class="task3-card">
                  <div class="task3-cardHead">
                    <div class="task3-cardTitle">SQL‑Editor</div>
                    <div class="task3-cardMeta">Schreibe deine Abfrage und prüfe sie.</div>
                  </div>

                                    <textarea id="sqlInput" class="task3-editor" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="SELECT ?"></textarea>

                  <div class="task3-actions">
                    <button class="btn btn-primary" id="runBtn" type="button">Prüfen</button>
                    <button class="btn" id="unlockBtn" type="button" disabled aria-disabled="true">Freischalten</button>
                  </div>
                </div>

                <div class="task3-card">
                  <div class="task3-cardHead">
                    <div class="task3-cardTitle">Ausgabe</div>
                    <div class="task3-cardMeta">Ergebnis / Fehlermeldung</div>
                  </div>
                  <pre class="output task3-output" id="out"></pre>
                </div>

                <!-- Legacy hook (nicht sichtbar) – Logik bleibt kompatibel -->
                <div id="taskHint" style="display:none;"></div>
              </div>

            </div>
        </section>

        <section id="auxShell" class="page-shell aux-shell" style="display:none; min-height:0;">
            <div id="spickerView" style="display:none; min-height:0;" class="spicker-view">
              <div class="spicker-head">
                <div>
                  <h3 class="spicker-title">Theorie‑Spicker</h3>
                  <div class="spicker-sub">Kapitel auswählen</div>
                </div>
                <button class="btn btn-close" id="spickerClose" type="button" aria-label="Schließen" title="Aufgabe schließen">✕</button>
              </div>

              <div id="spickerList" class="spicker-list" aria-label="Kapitelübersicht"></div>

              <div id="spickerChapter" class="spicker-chapter" style="display:none;">
                <div class="spicker-chapter-top">
                  <button class="btn btn-ghost" id="spickerBack" type="button">← Übersicht</button>
                  <div class="spicker-chapter-title" id="spickerChapterTitle"></div>
                </div>
                <div id="spickerContent" class="spicker-content"></div>
              </div>
            </div>

            <div id="schemaView" style="display:none; min-height:0;" class="spicker-view schema-view">
              <div class="spicker-head">
                <div>
                  <h3 class="spicker-title">DB‑Schema</h3>
                  <div class="spicker-sub">Tabelle auswählen</div>
                </div>
                <button class="btn btn-close" id="schemaClose" type="button" aria-label="Schließen" title="Aufgabe schließen">✕</button>
              </div>

              <div id="schemaList" class="spicker-list" aria-label="Tabellenübersicht"></div>

              <div id="schemaTable" class="spicker-chapter" style="display:none;">
                <div class="spicker-chapter-top">
                  <button class="btn btn-ghost" id="schemaBack" type="button">← Übersicht</button>
                  <div class="spicker-chapter-title" id="schemaTableTitle"></div>
                </div>
                <div id="schemaContent" class="spicker-content"></div>
              </div>
            </div>


            <div id="solutionsView" style="display:none; min-height:0;" class="spicker-view solutions-view">
              <div class="spicker-head">
                <div>
                  <h3 class="spicker-title">Bereits gelöste Aufgaben</h3>
                  <div class="spicker-sub">Aufgabe auswählen</div>
                </div>
                <button class="btn btn-close" id="solutionsClose" type="button" aria-label="Schließen" title="Aufgabe schließen">✕</button>
              </div>

              <div id="solutionsList" class="spicker-list" aria-label="Aufgabenübersicht"></div>

              <div id="solutionsTask" class="spicker-chapter" style="display:none;">
                <div class="spicker-chapter-top">
                  <button class="btn btn-ghost" id="solutionsBack" type="button">← Übersicht</button>
                  <div class="spicker-chapter-title" id="solutionsTaskTitle"></div>
                </div>
                <div id="solutionsContent" class="spicker-content"></div>
              </div>
            </div>
<div id="bonusView" style="display:none; min-height:0;" class="task-view task-v3 bonus-view">
              <div class="task3-surface">
                <div class="task3-header">
                  <div class="task3-headerLeft">
                    <div class="task3-kicker">Bonus</div>
                    <h3 class="task3-title" id="sideTitle">Zusatzaufgabe: Hacking</h3>
                    <div class="task3-cardMeta" id="sideMeta">SQL‑Injection (Sandbox)</div>
                  </div>
                  <div class="task3-headerRight">
                    <button class="btn btn-ghost task3-closeBtn" id="bonusClose" type="button" aria-label="Schließen" title="Aufgabe schließen"><span aria-hidden="true">✕</span></button>
                  </div>
                </div>

                <div class="task3-card" id="sideBody"></div>
              </div>
            
        </section>
      </div>

        <div class="overlay" id="lockedOverlay" aria-hidden="true">
          <div class="modal locked-modal" role="dialog" aria-modal="true" aria-labelledby="lockedTitle">
            <div class="overlay-top" style="margin-bottom:10px;">
              <h3 class="overlay-title" id="lockedTitle">Noch nicht verfügbar</h3>
              <button class="btn btn-ghost" id="lockedClose" type="button" aria-label="Schließen" title="Aufgabe schließen" style="width:40px; height:40px; padding:0; border-radius:14px;"><span aria-hidden="true">✕</span></button>
            </div>
            <p id="lockedMsg" style="margin:0 0 12px 0;"></p>
            <div class="row">
              <button class="btn btn-primary" id="lockedOk" type="button">OK</button>
            </div>
          </div>
        </div>

        <div class="overlay" id="confirmOverlay" aria-hidden="true">
          <div class="overlay-panel">
            <div class="overlay-panel-inner">
              <div class="overlay-top">
                <h3 class="overlay-title" id="confirmTitle">Tipp anzeigen?</h3>
                <button class="btn btn-ghost" id="confirmClose" type="button">✕</button>
              </div>
              <div class="task-body" id="confirmText">Wenn du den Tipp öffnest, verlierst du 1 Score‑Punkt. Trotzdem anzeigen?</div>
              <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn btn-ghost" id="confirmNo" type="button">Abbrechen</button>
                <button class="btn btn-primary" id="confirmYes" type="button">Tipp anzeigen (-1)</button>
              </div>
            </div>
          </div>
        </div>
    `;

    // Header
    this.studentEl = this.root.querySelector('#labStudent');
    this.hintEl = this.root.querySelector('#labHint');
    this.headerEl = this.root.querySelector('.lab-header');
    this.headerCollapsibleEl = this.root.querySelector('#labHeaderCollapsible');
    this.headerToggleBtn = document.getElementById('labHeaderToggle');
    this.headerToggleTextEl = document.getElementById('labHeaderToggleText');
    this.initHeaderCollapse();

    // Progress
    this.progressCountEl = document.getElementById('progressCount');
    this.progressPctEl = document.getElementById('progressPct');
    this.progressFillEl = document.getElementById('progressFill');
    this.scoreEl = document.getElementById('scoreEl');

    // Actions
    this.btnSchema = document.getElementById('btnSchema');
    this.btnSpicker = document.getElementById('btnSpicker');
    this.btnSolutions = document.getElementById('btnSolutions');
    this.btnBonus = document.getElementById('btnBonus');
    this.btnExport = document.getElementById('btnExport');

    // Views
    this.taskShellEl = this.root.querySelector('#taskShell');
    this.auxShellEl = this.root.querySelector('#auxShell');
    this.emptyEl = this.root.querySelector('#emptyState');
    this.taskViewEl = this.root.querySelector('#taskView');
    this.bonusViewEl = this.root.querySelector('#bonusView');
    this.spickerViewEl = this.root.querySelector('#spickerView');
    this.spickerListEl = this.root.querySelector('#spickerList');
    this.spickerChapterEl = this.root.querySelector('#spickerChapter');
    this.spickerContentEl = this.root.querySelector('#spickerContent');
    this.spickerChapterTitleEl = this.root.querySelector('#spickerChapterTitle');
    this.spickerBackBtn = this.root.querySelector('#spickerBack');
    this.spickerCloseBtn = this.root.querySelector('#spickerClose');
    // DB-Schema view
    this.schemaViewEl = this.root.querySelector('#schemaView');
    this.schemaListEl = this.root.querySelector('#schemaList');
    this.schemaTableEl = this.root.querySelector('#schemaTable');
    this.schemaContentEl = this.root.querySelector('#schemaContent');
    this.schemaTableTitleEl = this.root.querySelector('#schemaTableTitle');
    this.schemaBackBtn = this.root.querySelector('#schemaBack');
    this.schemaCloseBtn = this.root.querySelector('#schemaClose');

    // Solutions view
    this.solutionsViewEl = this.root.querySelector('#solutionsView');
    this.solutionsListEl = this.root.querySelector('#solutionsList');
    this.solutionsTaskEl = this.root.querySelector('#solutionsTask');
    this.solutionsContentEl = this.root.querySelector('#solutionsContent');
    this.solutionsTaskTitleEl = this.root.querySelector('#solutionsTaskTitle');
    this.solutionsBackBtn = this.root.querySelector('#solutionsBack');
    this.solutionsCloseBtn = this.root.querySelector('#solutionsClose');

    this.categoryEl = this.root.querySelector('#taskCategory');

    // Task UI
    this.titleEl = this.root.querySelector('#taskTitle');
    this.taskIdEl = this.root.querySelector('#taskId');
    this.taskBodyEl = this.root.querySelector('#taskBody');
    this.dotsEl = this.root.querySelector('#difficultyDots');
    this.difficultyTextEl = this.root.querySelector('#difficultyText');
    this.closeTaskBtn = this.root.querySelector('#taskClose');
    this.hintBtn = this.root.querySelector('#hintBtn');
    this.scaffoldBtn = this.root.querySelector('#scaffoldBtn');
    this.taskHintEl = this.root.querySelector('#taskHint');

    // Editor
    this.sqlEl = this.root.querySelector('#sqlInput');
        this.outEl = this.root.querySelector('#out');
    this.runBtn = this.root.querySelector('#runBtn');
    this.unlockBtn = this.root.querySelector('#unlockBtn');

    // Confirm modal
    this.confirmOverlayEl = this.root.querySelector('#confirmOverlay');
    this.confirmTitleEl = this.root.querySelector('#confirmTitle');
    this.confirmTextEl = this.root.querySelector('#confirmText');
    this.confirmCloseBtn = this.root.querySelector('#confirmClose');
    this.confirmNoBtn = this.root.querySelector('#confirmNo');
    this.confirmYesBtn = this.root.querySelector('#confirmYes');

    // Locked modal (für Bonus-Sperre)
    this.lockedOverlayEl = this.root.querySelector('#lockedOverlay');
    this.lockedCloseBtn = this.root.querySelector('#lockedClose');
    this.lockedOkBtn = this.root.querySelector('#lockedOk');
    this.lockedTitleEl = this.root.querySelector('#lockedTitle');
    this.lockedMsgEl = this.root.querySelector('#lockedMsg');

    this._pendingHintTaskId = null;
    this._confirmAction = null;
    this.spickerUsed = false;

    // Hint / Codeger\u00fcst cards
    this.hintCardEl = this.root.querySelector('#hintCard');
    this.hintTitleEl = this.root.querySelector('#hintTitle');
    this.hintTextEl = this.root.querySelector('#hintText');
    this.hintConfirmBtn = this.root.querySelector('#hintConfirm');
    this.scaffoldCardEl = this.root.querySelector('#scaffoldCard');
    this.scaffoldTitleEl = this.root.querySelector('#scaffoldTitle');
    this.scaffoldTextEl = this.root.querySelector('#scaffoldText');
    this.scaffoldConfirmBtn = this.root.querySelector('#scaffoldConfirm');

    // Bonus
    this.bonusCloseBtn = this.root.querySelector('#bonusClose');

    // Side view content
    this.sideTitleEl = this.root.querySelector('#sideTitle');
    this.sideMetaEl = this.root.querySelector('#sideMeta');
    this.sideBodyEl = this.root.querySelector('#sideBody');
    this.currentSideView = null;

    // Handlers
    this.headerToggleBtn?.addEventListener('click', () => this.toggleHeaderCollapse());
    this.runBtn.addEventListener('click', () => this.checkCurrent());
    this.unlockBtn.addEventListener('click', () => this.unlockCurrent());
    this.closeTaskBtn.addEventListener('click', () => this.closeTask());
    this.hintBtn.addEventListener('click', () => this.requestHint());
    this.scaffoldBtn?.addEventListener('click', () => this.requestScaffold());


    // Bei SQL-Änderung: Freischalten wieder deaktivieren (muss erneut geprüft werden)
    this.sqlEl?.addEventListener('input', () => this.onSqlEdited());
            
    // Hint / Codeger\u00fcst cards
    this.hintConfirmBtn?.addEventListener('click', () => this.confirmHint());
    this.scaffoldConfirmBtn?.addEventListener('click', () => this.confirmScaffold());
this.confirmCloseBtn.addEventListener('click', () => this.closeConfirm());
    this.confirmNoBtn.addEventListener('click', () => this.closeConfirm());
    this.confirmYesBtn.addEventListener('click', () => {
      const fn = this._confirmAction;
      this.closeConfirm();
      if (typeof fn === 'function') fn();
    });
    this.confirmOverlayEl.addEventListener('click', (e) => {
      if (e.target === this.confirmOverlayEl) this.closeConfirm();
    });

    // Locked modal events
    if (this.lockedCloseBtn) this.lockedCloseBtn.addEventListener('click', () => this.hideLockedModal());
    if (this.lockedOkBtn) this.lockedOkBtn.addEventListener('click', () => this.hideLockedModal());
    if (this.lockedOverlayEl) {
      this.lockedOverlayEl.addEventListener('click', (e) => {
        if (e.target === this.lockedOverlayEl) this.hideLockedModal();
      });
    }


    this.btnSchema.addEventListener('click', () => { this.openSchema(); });
    this.btnSpicker.addEventListener('click', () => this.requestSpicker());
    this.btnSolutions.addEventListener('click', () => this.openSolutions());
    this.btnBonus.addEventListener('click', () => this.openBonus());
    this.btnExport?.addEventListener('click', () => this.exportProgress());
    this.bonusCloseBtn.addEventListener('click', () => this.closeBonus());
    this.spickerBackBtn?.addEventListener('click', () => this.openSpickerIndex());
    this.spickerCloseBtn?.addEventListener('click', () => this.closeSpicker());
    this.spickerListEl?.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-chapter]');
      if (!btn) return;
      const id = btn.getAttribute('data-chapter');
      this.openSpickerChapter(id);
    });
    this.schemaBackBtn?.addEventListener('click', () => this.openSchemaIndex());
    this.schemaCloseBtn?.addEventListener('click', () => this.closeSchema());
    this.schemaListEl?.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-table]');
      if (!btn) return;
      const name = btn.getAttribute('data-table');
      this.openSchemaTable(name);
    });

    this.solutionsBackBtn?.addEventListener('click', () => this.openSolutionsIndex());
    this.solutionsCloseBtn?.addEventListener('click', () => this.closeSolutions());
    this.solutionsListEl?.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-solution]');
      if (!btn) return;
      const id = btn.getAttribute('data-solution');
      this.openSolutionTask(id);
    });
  }

  /* ===========================
     Theorie‑Spicker (aus Tutorial.docx)
     =========================== */

  openSpicker() {
    this.showAuxShell();
    // Immer mit Übersicht starten
    this.openSpickerIndex();
    // Side-View: Task-Shell unverändert lassen
    this.hideHint();
    this.hideTaskHint();

    // Views umschalten
    if (this.taskViewEl) this.taskViewEl.style.display = 'none';
    if (this.bonusViewEl) this.bonusViewEl.style.display = 'none';
    if (this.emptyEl) this.emptyEl.style.display = 'none';
    if (this.schemaViewEl) this.schemaViewEl.style.display = 'none';
    if (this.solutionsViewEl) this.solutionsViewEl.style.display = 'none';
    if (this.spickerViewEl) this.spickerViewEl.style.display = '';
  }

  closeSpicker() {
    this.showTaskShell();
    if (this.spickerViewEl) this.spickerViewEl.style.display = 'none';
    if (this.schemaViewEl) this.schemaViewEl.style.display = 'none';

    // zurück zur vorherigen Ansicht
    if (this.currentId) {
      if (this.taskViewEl) this.taskViewEl.style.display = '';
      if (this.emptyEl) this.emptyEl.style.display = 'none';
    } else {
      if (this.taskViewEl) this.taskViewEl.style.display = 'none';
      if (this.emptyEl) this.emptyEl.style.display = '';
    }
    this.setHeaderEditMode(!!this.currentId);
  }

  openSpickerIndex() {
    if (!this.spickerListEl) return;

    const items = THEORY_CHAPTERS.map((c) => {
      const title = this.escapeHtml(c.title);
      const id = this.escapeHtml(c.id);
      return `
        <button class="spicker-item" type="button" data-chapter="${id}">
          <div class="spicker-item-title">${title}</div>
          <div class="spicker-item-meta">Öffnen</div>
        </button>
      `;
    }).join('');

    this.spickerListEl.innerHTML = items;
    this.spickerListEl.style.display = '';
    if (this.spickerChapterEl) this.spickerChapterEl.style.display = 'none';
  }

  openSpickerChapter(id) {
    const ch = THEORY_CHAPTERS.find(c => c.id === id);
    if (!ch) return;

    if (this.spickerChapterTitleEl) this.spickerChapterTitleEl.textContent = ch.title;
    if (this.spickerContentEl) {
      const ex = (ch && ch.exampleSql) ? String(ch.exampleSql) : '';
      const exBlock = ex ? `
        <div class="spicker-block" style="margin-top:14px;">
          <div class="spicker-block-title">Beispielabfrage</div>
          <pre class="output" style="white-space:pre-wrap; margin:0;">${this.escapeHtml(ex)}</pre>
        </div>
      ` : '';
      this.spickerContentEl.innerHTML = `${ch.html}${exBlock}`;
    }

    if (this.spickerListEl) this.spickerListEl.style.display = 'none';
    if (this.spickerChapterEl) this.spickerChapterEl.style.display = '';
  }

  /* ===========================
     DB‑Schema (SQLite introspection)
     =========================== */

  async openSchema() {
    this.showAuxShell();
    // Reset: nichts „Placeholder-artiges“ stehen lassen
    if (this.schemaListEl) this.schemaListEl.innerHTML = '';
    if (this.schemaContentEl) this.schemaContentEl.innerHTML = '';
    if (this.schemaTableEl) this.schemaTableEl.style.display = 'none';
    if (this.schemaListEl) this.schemaListEl.style.display = '';
    // Side-View: Task-Shell unverändert lassen
    this.hideHint();
    this.hideTaskHint();

    // Views umschalten
    if (this.taskViewEl) this.taskViewEl.style.display = 'none';
    if (this.bonusViewEl) this.bonusViewEl.style.display = 'none';
    if (this.emptyEl) this.emptyEl.style.display = 'none';
    if (this.spickerViewEl) this.spickerViewEl.style.display = 'none';
    if (this.schemaViewEl) this.schemaViewEl.style.display = '';
    if (this.solutionsViewEl) this.solutionsViewEl.style.display = 'none';

    const ok = await this.ensureDbForSchema();
    if (!ok) {
      // DB-Fehler wird bereits via Hint angezeigt; hier absichtlich minimal.
      if (this.schemaListEl) {
        this.schemaListEl.innerHTML = `<div class="empty-state">DB ist nicht geladen.</div>`;
      }
      return;
    }

    this.openSchemaIndex();
  }

  closeSchema() {
    this.showTaskShell();
    if (this.schemaViewEl) this.schemaViewEl.style.display = 'none';

    // zurück zur vorherigen Ansicht
    if (this.currentId) {
      if (this.taskViewEl) this.taskViewEl.style.display = '';
      if (this.emptyEl) this.emptyEl.style.display = 'none';
    } else {
      if (this.taskViewEl) this.taskViewEl.style.display = 'none';
      if (this.emptyEl) this.emptyEl.style.display = '';
    }
    this.setHeaderEditMode(!!this.currentId);
  }

  async ensureDbForSchema() {
    if (this.db) return true;
    await this.loadDb();
    return !!this.db;
  }

  quoteIdent(name) {
    return `"${String(name || '').replace(/"/g, '""')}"`;
  }

  listSchemaTables() {
    if (!this.db) return [];
    const res = this.db.exec(`
      SELECT name
      FROM sqlite_master
      WHERE type='table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name;
    `);
    const values = res?.[0]?.values || [];
    return values.map((row) => row[0]).filter(Boolean);
  }

  openSchemaIndex() {
    if (!this.schemaListEl) return;

    const tables = this.listSchemaTables();
    if (!tables.length) {
      this.schemaListEl.innerHTML = `<div class="empty-state">Keine Tabellen gefunden.</div>`;
      return;
    }

    const items = tables.map((name) => {
      const safe = this.escapeHtml(name);
      let meta = '';
      try {
        const q = this.quoteIdent(name);
        const ti = this.db.exec(`PRAGMA table_info(${q});`);
        const cols = ti?.[0]?.values || [];
        const pkCols = cols.filter(r => (r?.[5] || 0) > 0).map(r => r?.[1]).filter(Boolean);
        meta = `Spalten: ${cols.length}${pkCols.length ? ` • PK: ${pkCols.join(', ')}` : ''}`;
      } catch (_) {}

      return `
        <button class="spicker-item" type="button" data-table="${safe}">
          <div>
            <div class="spicker-item-title">${safe}</div>
            ${meta ? `<div class="spicker-sub" style="margin-top:4px;">${this.escapeHtml(meta)}</div>` : ``}
          </div>
          <div class="spicker-item-meta">Öffnen</div>
        </button>
      `;
    }).join('');

    this.schemaListEl.innerHTML = items;
    this.schemaListEl.style.display = '';
    if (this.schemaTableEl) this.schemaTableEl.style.display = 'none';
  }

  openSchemaTable(name) {
    if (!this.db) return;
    const table = String(name || '').trim();
    if (!table) return;

    const q = this.quoteIdent(table);

    const ti = this.db.exec(`PRAGMA table_info(${q});`);
    const cols = ti?.[0]?.values || [];

    const fkRes = this.db.exec(`PRAGMA foreign_key_list(${q});`);
    const fkCols = fkRes?.[0]?.columns || [];
    const fkVals = fkRes?.[0]?.values || [];

    const idxFrom = fkCols.indexOf('from');
    const idxTable = fkCols.indexOf('table');
    const idxTo = fkCols.indexOf('to');
    const idxUpd = fkCols.indexOf('on_update');
    const idxDel = fkCols.indexOf('on_delete');

    const fkByFrom = new Map();
    for (const r of fkVals) {
      const from = r?.[idxFrom];
      if (!from) continue;
      const entry = {
        table: r?.[idxTable] || '',
        to: r?.[idxTo] || '',
        onUpdate: r?.[idxUpd] || '',
        onDelete: r?.[idxDel] || ''
      };
      const arr = fkByFrom.get(from) || [];
      arr.push(entry);
      fkByFrom.set(from, arr);
    }

    const head = `
      <p class="muted" style="margin:0 0 10px 0;">
        Markierung: <span class="schema-badge" title="Primärschlüssel">PK</span>
        <span class="schema-badge schema-badge-fk" title="Fremdschlüssel">FK</span>
      </p>
    `;

    
const rows = cols.map((r) => {
  const colName = r?.[1] ?? '';
  const pk = (r?.[5] ?? 0) > 0;
  const fks = fkByFrom.get(colName) || [];

  const badges = [
    pk ? `<span class="schema-badge" title="Primärschlüssel">PK</span>` : '',
    fks.length ? `<span class="schema-badge schema-badge-fk" title="Fremdschlüssel">FK</span>` : ''
  ].filter(Boolean).join(' ');

  const ref = fks.map(f => `${f.table}.${f.to}`).join(', ');

  return `
    <tr>
      <td>${this.escapeHtml(colName)}</td>
      <td>${badges || '<span class="muted">—</span>'}</td>
      <td>${ref ? this.escapeHtml(ref) : '<span class="muted">—</span>'}</td>
    </tr>
  `;
}).join('');

const tableHtml = `
  <table class="spicker-table" aria-label="Tabellenschema">
    <thead>
      <tr>
        <th>Spalte</th>
        <th>Key</th>
        <th>Referenz</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
`;

if (this.schemaTableTitleEl) this.schemaTableTitleEl.textContent = table;
    if (this.schemaContentEl) this.schemaContentEl.innerHTML = `${head}${tableHtml}`;

    if (this.schemaListEl) this.schemaListEl.style.display = 'none';
    if (this.schemaTableEl) this.schemaTableEl.style.display = '';
  }


  /* ===========================
     Bereits gelöste Aufgaben (Freischalt‑SQL)
     =========================== */

  openSolutions() {
    this.showAuxShell();
    // Reset: keine Platzhalterreste
    if (this.solutionsListEl) this.solutionsListEl.innerHTML = '';
    if (this.solutionsContentEl) this.solutionsContentEl.innerHTML = '';
    if (this.solutionsTaskEl) this.solutionsTaskEl.style.display = 'none';
    if (this.solutionsListEl) this.solutionsListEl.style.display = '';
    // Side-View: Task-Shell unverändert lassen
    this.hideHint();
    this.hideTaskHint();

    // Views umschalten
    if (this.taskViewEl) this.taskViewEl.style.display = 'none';
    if (this.bonusViewEl) this.bonusViewEl.style.display = 'none';
    if (this.emptyEl) this.emptyEl.style.display = 'none';
    if (this.spickerViewEl) this.spickerViewEl.style.display = 'none';
    if (this.schemaViewEl) this.schemaViewEl.style.display = 'none';
    if (this.solutionsViewEl) this.solutionsViewEl.style.display = '';

    this.openSolutionsIndex();
  }

  closeSolutions() {
    this.showTaskShell();
    if (this.solutionsViewEl) this.solutionsViewEl.style.display = 'none';

    // zurück zur vorherigen Ansicht
    if (this.currentId) {
      if (this.taskViewEl) this.taskViewEl.style.display = '';
      if (this.emptyEl) this.emptyEl.style.display = 'none';
    } else {
      if (this.taskViewEl) this.taskViewEl.style.display = 'none';
      if (this.emptyEl) this.emptyEl.style.display = '';
    }
    this.setHeaderEditMode(!!this.currentId);
  }

  openSolutionsIndex() {
    if (!this.solutionsListEl) return;

    const solvedIds = Object.keys(this.TASKS).filter(id => !!this.unlocked?.[id]);

    if (!solvedIds.length) {
      this.solutionsListEl.innerHTML = `<div class="empty-state">Noch keine Aufgaben freigeschaltet.</div>`;
      this.solutionsListEl.style.display = '';
      if (this.solutionsTaskEl) this.solutionsTaskEl.style.display = 'none';
      return;
    }

    const items = solvedIds.map((id) => {
      const t = this.TASKS[id] || {};
      const title = this.escapeHtml(t.title || id);
      const cat = this.escapeHtml(this.getCategoryLabel(id));
      const tags = [];
      if (this.hintUsed?.[id]) tags.push('<span class="spicker-tag hint">Tipp</span>');
      if (this.scaffoldUsed?.[id]) tags.push('<span class="spicker-tag scaffold">Codeger\u00fcst</span>');
      const tagsHtml = tags.length ? `<div class="spicker-tags">${tags.join('')}</div>` : '';
      return `
        <button class="spicker-item" type="button" data-solution="${this.escapeHtml(id)}">
          <div class="spicker-item-title">${title}</div>
          <div class="spicker-item-right">
            <div class="spicker-item-meta">${cat}</div>
            ${tagsHtml}
          </div>
        </button>
      `;
    }).join('');

    this.solutionsListEl.innerHTML = items;
    this.solutionsListEl.style.display = '';
    if (this.solutionsTaskEl) this.solutionsTaskEl.style.display = 'none';
  }

  openSolutionTask(id) {
    const tid = String(id || '');
    const t = this.TASKS?.[tid];
    if (!t) return;

    const title = t.title || tid;
    const cat = this.getCategoryLabel(tid);
    const sql = (this.solutionSql && this.solutionSql[tid]) ? String(this.solutionSql[tid]) : '';
    const taskText = this.sanitizeTaskText(t.task || '').replace(/^aufgabe:\s*/i, '').trim();

    let sqlBlock = '';
    if (sql && sql.trim()) {
      sqlBlock = `
        <div class="spicker-block">
          <div class="spicker-block-title">Freischalt‑SQL</div>
          <pre class="output" style="white-space:pre-wrap;">${this.escapeHtml(sql.trim())}</pre>
        </div>
      `;
    } else {
      // Rückwärtskompatibel: ältere Freischaltungen hatten noch keine Speicherung
      sqlBlock = `
        <div class="spicker-block">
          <div class="spicker-block-title">Freischalt‑SQL</div>
          <div class="muted">Keine gespeicherte Freischalt‑SQL verfügbar (wurde beim Freischalten nicht mitgespeichert).</div>
        </div>
      `;
    }

    const showCat = (cat && cat !== 'Aufgabe');
    const head = `
      <div class="spicker-block">
        <div class="spicker-block-title">Aufgabe</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:8px;">
          ${showCat ? `<span class="badge">${this.escapeHtml(cat)}</span>` : ``}
        </div>
        <div class="muted" style="white-space:pre-wrap;">${this.escapeHtml(taskText)}</div>
      </div>
    `;

    if (this.solutionsTaskTitleEl) this.solutionsTaskTitleEl.textContent = title;
    if (this.solutionsContentEl) this.solutionsContentEl.innerHTML = `${head}${sqlBlock}`;

    if (this.solutionsListEl) this.solutionsListEl.style.display = 'none';
    if (this.solutionsTaskEl) this.solutionsTaskEl.style.display = '';
  }

  
  closeAllSideViews() {
    // Schließt alle Side-Panels, damit nie Aufgabe + Panel gleichzeitig offen sind
    if (this.spickerViewEl) this.spickerViewEl.style.display = 'none';
    if (this.schemaViewEl) this.schemaViewEl.style.display = 'none';
    if (this.solutionsViewEl) this.solutionsViewEl.style.display = 'none';
    if (this.bonusViewEl) this.bonusViewEl.style.display = 'none';
  }

/* ===========================
     Task display helpers
     =========================== */

  getCategoryLabel(taskId) {
    const id = String(taskId || '');
    if (id.startsWith('rating-')) return 'Bewertung';
    if (id.startsWith('cat-')) return 'Kategorie';
    if (id.startsWith('where-')) return 'Filter';
    if (id.startsWith('order-')) return 'Sortierung';
    if (id.startsWith('agg-')) return 'Aggregat';
    if (id.startsWith('group-')) return 'Gruppierung';
    if (id.startsWith('join-')) return 'Verbund';
    if (id.startsWith('privacy-')) return 'Datenschutz';
    return 'Aufgabe';
  }

  sanitizeTaskText(s) {
    return String(s || '').replace(/\s*->\s*Task:\s*[\w-]+/gi, '').trim();
  }

  formatTaskHtml(s) {
    let text = this.sanitizeTaskText(s || '');
    text = text.replace(/^aufgabe:\s*/i, '').trim();
    let html = this.escapeHtml(text);
    return html.replace(/\n/g, '<br>');
  }

  openSideView(kind) {
    this.currentSideView = kind;
    this.closeAllSideViews();


    // Inhalte
    if (kind === 'spicker') {
      this.openSpicker();
      return;
    } else if (kind === 'solutions') {
      this.openSolutions();
      return;
    } else if (kind === 'sqli') {
      this.sideTitleEl.textContent = 'Zusatzaufgabe: Hacking';
      this.sideMetaEl.textContent = 'SQL‑Injection (Sandbox)';

      this.sideBodyEl.innerHTML = `
        <div class="task3-card">
          <div class="task3-cardHead">
            <div class="task3-cardTitle">Ziel</div>
          </div>
          <div class="task3-body">
            Melde dich im <strong>Konto‑Panel</strong> an, ohne das echte Passwort zu kennen. Du sollst verstehen, <em>warum</em> das bei uns (absichtlich) möglich ist – und wie man es in echten Systemen verhindert.
          </div>
        </div>

        <div class="task3-card">
          <div class="task3-cardHead">
            <div class="task3-cardTitle">Didaktischer Kontext</div>
          </div>
          <div class="task3-body">
            Hier wird (für die Übung) eine <strong>unsichere</strong> Login‑Abfrage per String‑Verkettung gebaut. Das ist genau der Fehler, der SQL‑Injection ermöglicht.
            <pre class="task3-output" style="white-space:pre-wrap; margin:12px 0 0 0; min-height:0;">SELECT *
FROM users
WHERE username = '<span class="muted">EINGABE_USER</span>'
  AND password = '<span class="muted">EINGABE_PASS</span>';</pre>
            <div class="muted" style="margin-top:10px;">Wenn Eingaben ungefiltert in die Query wandern, kannst du die WHERE‑Logik manipulieren (z. B. „immer wahr“ + Kommentar).</div>
          </div>
        </div>

        <div class="task3-card">
          <div class="task3-cardHead">
            <div class="task3-cardTitle">Aufgabe</div>
          </div>
          <div class="task3-body">
            <ol style="margin:6px 0 0 18px;">
              <li>Öffne rechts oben im Shop das <strong>Konto‑Panel</strong>.</li>
              <li>Teste Eingaben, die die WHERE‑Bedingung verändern (ohne die komplette Lösung zu verraten: denke an <strong>„immer wahr“</strong> und <strong>Kommentare</strong>).</li>
              <li>Ziel: Die Anwendung zeigt <strong>„Login erfolgreich“</strong>.</li>
            </ol>
            <div class="muted" style="margin-top:10px;">Wenn es klappt, bekommst du automatisch <strong>+10 Score</strong>.</div>
          </div>
        </div>

        <div class="task3-card">
          <div class="task3-cardHead">
            <div class="task3-cardTitle">Reflexion: Wie verhindert man das?</div>
          </div>
          <div class="task3-body">
            Notiere mindestens <strong>4</strong> konkrete Gegenmaßnahmen (z. B. <strong>Prepared Statements</strong>, Eingabevalidierung/Canonicalization, Least Privilege, sichere ORMs, Logging/Monitoring, WAF).
            <div class="muted" style="margin-top:10px;">Hinweis: In echten Anwendungen ist SQL‑Injection ein kritischer Sicherheitsfehler – hier ist es eine Lern‑Sandbox.</div>
          </div>
        </div>
`;
    }

    this.showBonusView();
  }

  escapeHtml(s) {
    return (s ?? '').toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  
  showTaskShell() {
    if (this.taskShellEl) this.taskShellEl.style.display = '';
    if (this.auxShellEl) this.auxShellEl.style.display = 'none';
  }

  showAuxShell() {
    if (this.taskShellEl) this.taskShellEl.style.display = 'none';
    if (this.auxShellEl) this.auxShellEl.style.display = '';
    this.setHeaderEditMode(false);
  }

  initHeaderCollapse() {
    if (!this.headerEl || !this.headerToggleBtn) return;
    this.setHeaderCollapsed(false, { persist: false });
    this.setHeaderEditMode(false);
  }

  toggleHeaderCollapse() {
    this.setHeaderCollapsed(!this.headerCollapsed, { persist: true });
  }

  setHeaderCollapsed(collapsed, opts = {}) {
    const { persist = true } = opts;
    this.headerCollapsed = !!collapsed;
    if (this.headerEl) this.headerEl.classList.toggle('is-collapsed', this.headerCollapsed);
    if (this.headerToggleBtn) {
      this.headerToggleBtn.setAttribute('aria-expanded', this.headerCollapsed ? 'false' : 'true');
      this.headerToggleBtn.setAttribute('title', this.headerCollapsed ? 'Bereich ausklappen' : 'Bereich einklappen');
      this.headerToggleBtn.classList.toggle('is-collapsed', this.headerCollapsed);
    }
    if (this.headerToggleTextEl) {
      this.headerToggleTextEl.textContent = this.headerCollapsed ? 'Ausklappen' : 'Einklappen';
    }
    if (persist) safeSet(sessionStorage, FREE_HEADER_COLLAPSE_KEY, this.headerCollapsed ? '1' : '0');
  }

  setHeaderEditMode(isEditing) {
    const active = !!isEditing;
    this.headerEditMode = active;
    if (!this.headerEl || !this.headerToggleBtn) return;

    this.headerEl.classList.toggle('has-toggle', active);
    this.headerToggleBtn.classList.toggle('is-hidden', !active);

    if (!active) {
      this.setHeaderCollapsed(false, { persist: false });
      return;
    }

    const saved = safeGet(sessionStorage, FREE_HEADER_COLLAPSE_KEY) === '1';
    this.setHeaderCollapsed(saved, { persist: false });
  }

setEmptyState(isEmpty) {
    // Hints ausblenden, wenn Nutzer aktiv wechselt
    this.hideHint();
    this.hideTaskHint();

    this.showTaskShell();

    if (isEmpty) {
      this.emptyEl.style.display = 'block';
      this.taskViewEl.style.display = 'none';
      this.bonusViewEl.style.display = 'none';
      this.setHeaderEditMode(false);
      return;
    }

    this.emptyEl.style.display = 'none';
    this.taskViewEl.style.display = 'block';
    this.bonusViewEl.style.display = 'none';
    this.setHeaderEditMode(true);
  }

  showBonusView() {
    this.hideHint();
    this.showAuxShell();
    if (this.emptyEl) this.emptyEl.style.display = 'none';
    if (this.taskViewEl) this.taskViewEl.style.display = 'none';
    if (this.spickerViewEl) this.spickerViewEl.style.display = 'none';
    if (this.schemaViewEl) this.schemaViewEl.style.display = 'none';
    if (this.solutionsViewEl) this.solutionsViewEl.style.display = 'none';
    if (this.bonusViewEl) this.bonusViewEl.style.display = 'block';
  }

  closeTask() {
    this.currentId = null;
    this.resetUnlockButton();
    this.setEmptyState(true);
  }

  openBonus() {
    // Bei Klick: erst prüfen, ob freigeschaltet. Wenn nicht: kleines Modal anzeigen.
    const pct = this.getProgressPct();
    const can = pct >= BONUS_MIN_PCT;

    if (!can) {
      this.pulseLocked(this.btnBonus);
      this.showLockedModal(
        'Noch nicht verfuegbar',
        'Diese Zusatzaufgabe wird ab 10% Fortschritt freigeschaltet.'
      );
      return;
    }

    // Panels konsistent: keine Überschneidung mit anderen Views
    this.hideHint();
    this.closeAllSideViews();

    this.currentSideView = 'sqli';
    if (this.sideTitleEl) this.sideTitleEl.textContent = 'Zusatzaufgabe: Hacking';
    if (this.sideMetaEl) this.sideMetaEl.textContent = 'SQL‑Injection (Sandbox)';

    const statusHtml = this.sqliDone
      ? `<div class=\"task3-status is-success\">
           <span class=\"status-pill\">Erledigt</span>
           <span class=\"status-text\">Aufgabe erfolgreich bearbeitet.</span>
         </div>`
      : `<div class=\"task3-status\">
           <span class=\"status-pill is-muted\">Offen</span>
           <span class=\"status-text\">Bearbeite die Aufgabe, um den Status zu erhalten.</span>
         </div>`;

    const body = `
      <div style="display:flex; flex-direction:column; gap:14px; margin-top:12px;">
        ${statusHtml}
        <div class="spicker-block">
          <div class="spicker-block-title">Ziel</div>
          <p style="margin:6px 0 0 0;">Du sollst verstehen, <strong>warum</strong> SQL-Injection moeglich ist und <strong>wie</strong> man es in echten Systemen verhindert.</p>
        </div>

        <div class="spicker-block">
          <div class="spicker-block-title">Unsichere Login-Abfrage (Beispiel)</div>
          <p style="margin:6px 0 0 0;">Diese Query wird absichtlich per String-Verkettung gebaut (Lern-Sandbox):</p>
          <pre class="output" style="white-space:pre-wrap; margin-top:10px;">SELECT id
FROM users
WHERE username = '<span class="muted">EINGABE_USER</span>'
  AND password = '<span class="muted">EINGABE_PASS</span>'
LIMIT 1;</pre>
          <p class="muted" style="margin:10px 0 0 0;">Wenn Eingaben ungefiltert in die Query wandern, kann man die WHERE-Logik manipulieren (z. B. "immer wahr" + Kommentar).</p>
        </div>

        <div class="spicker-block">
          <div class="spicker-block-title">Aufgabenstellung</div>
          <ol type="a" style="margin:6px 0 0 18px;">
            <li>Versuche dich <strong>in den Login einzuloggen, ohne das Passwort zu kennen</strong>. Oeffne dafuer rechts oben im Shop das <strong>Konto-Panel</strong> und teste Eingaben, die die WHERE-Bedingung veraendern.</li>
            <li>Recherchiere im Internet, <strong>wie man sich vor SQL-Injection schuetzt</strong>, und schreibe deine Gedanken stichpunktartig auf.</li>
          </ol>
          <div class="muted" style="margin-top:8px;">Ziel: Die Anwendung zeigt <strong>"Login erfolgreich"</strong>. Wenn es klappt, bekommst du automatisch <strong>+10 Score</strong>.</div>
        </div>

        <div class="spicker-block">
          <div class="spicker-block-title">Hinweis</div>
          <p style="margin:6px 0 0 0;">Diese Aufgabe ist eine Lern-Sandbox. In echten Anwendungen ist SQL-Injection ein kritischer Sicherheitsfehler.</p>
        </div>
      </div>
    `;

    if (this.sideBodyEl) this.sideBodyEl.innerHTML = body;
    this.showBonusView();
  }


  closeBonus() {
    if (this.currentId) {
      this.setEmptyState(false);
    } else {
      this.setEmptyState(true);
    }
  }

  onShopSelect(actionId) {
    // Nur Task-Buttons interessieren den Modus
    if (!this.TASKS[actionId]) return;

    // Wenn bereits freigeschaltet: Editor nicht erneut öffnen
    if (this.unlocked && this.unlocked[actionId]) {
      return;
    }

    // Aufgabe auswählen + Editor öffnen
    this.closeAllSideViews();

    this.selectTask(actionId);

    // UX: Fokus direkt in Editor
    try { this.sqlEl?.focus(); } catch (_) {}
  }

async lockAllShopTasks(locked) {
  const ids = ALL_TASK_IDS;
  for (const id of ids) {
    await this.shop.lock(id, locked);
  }
}

async applyUnlockedToShop() {
  const ids = Object.keys(this.unlocked || {}).filter((id) => !!this.unlocked[id]);
  for (const id of ids) {
    await this.shop.lock(id, false);
  }
}

  async loadDb() {
    try {
      const SQL = await initSqlJs({
        locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`
      });

      const res = await fetch('produkte.sqlite');
      if (!res.ok) {
        throw new Error('produkte.sqlite nicht gefunden oder nicht erreichbar. Tipp: Seite über einen lokalen Webserver (z.B. VSCode Live Server) öffnen und Datei im gleichen Ordner bereitstellen.');
      }

      this.db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));
      // bewusst kein "DB bereit"-Text in der UI
      this.hideHint();
    } catch (e) {
      this.db = null;
      this.showHint('DB-Fehler: ' + e.message);
    }
  }

  selectTask(taskId) {
    this.hideTaskHint();
    this.currentId = taskId;
    this.closeAllSideViews();
    const t = this.TASKS[taskId];

    const isUnlocked = !!this.unlocked[taskId];

    // UI
    this.titleEl.textContent = this.sanitizeTaskText(`${t.title}`);
    if (this.taskIdEl) { this.taskIdEl.textContent = ""; this.taskIdEl.style.display = "none"; }
    this.taskBodyEl.innerHTML = this.formatTaskHtml(t.task || '');

    if (this.categoryEl) this.categoryEl.textContent = this.getCategoryLabel(this.currentId);

    const __lvl = this.getDifficultyLevel(t.difficulty);
    this.setDifficultyDots(__lvl);
    if (this.difficultyTextEl) this.difficultyTextEl.textContent = `${__lvl}/3`;

    // Editor state
    this.sqlEl.readOnly = isUnlocked;
    this.runBtn.disabled = isUnlocked;
    this.runBtn.style.cursor = isUnlocked ? 'not-allowed' : 'pointer';
    this.runBtn.style.opacity = isUnlocked ? '.6' : '1';

    this.sqlEl.value = t.starter || '';
        this.setOutput(isUnlocked ? 'Bereits freigeschaltet.' : '');

    this.resetUnlockButton();

    // View
    this.setEmptyState(false);
    // Auto-collapse header when a task opens (can be expanded manually)
    this.setHeaderCollapsed(true, { persist: true });
    this.refreshHintCards();
    if (this.spickerViewEl) this.spickerViewEl.style.display = 'none';

    // UX: Fokus direkt in Editor
    try { this.sqlEl?.focus(); } catch (_) {}
  }

  setOutput(text) {
    if (!this.outEl) return;
    const msg = (text ?? "").toString();
    this.outEl.classList.remove('out-flash');
    this.outEl.textContent = "";
    // Force reflow so the flash animation can replay on repeated checks.
    void this.outEl.offsetWidth;
    this.outEl.textContent = msg;
    if (msg) this.outEl.classList.add('out-flash');
  }


  checkCurrent() {
    this.setOutput("");
    this.resetUnlockButton();

    if (!this.currentId) {
      this.setOutput("Keine Aufgabe ausgewählt. Klicke im Shop auf einen gesperrten Button.");
      return;
    }

    if (!this.db) {
      this.setOutput("DB ist nicht geladen.");
      return;
    }

    const sql = this.sqlEl.value || "";
    if (!this.isSelectOnly(sql)) {
      this.setOutput("Nur SELECT-Abfragen sind erlaubt.");
      return;
    }

    const t = this.TASKS[this.currentId];
    const sqlCheck = this.validateSqlStructure(sql, t);
    if (!sqlCheck.ok) {
      this.setOutput(sqlCheck.message || "Die Abfrage passt nicht zur Aufgabe.");
      return;
    }

    let studentRes, refRes;
    try {
      studentRes = this.db.exec(sql);
    } catch (e) {
      this.setOutput("SQL-Fehler: " + e.message);
      return;
    }

    try {
      refRes = this.db.exec(t.refSql);
    } catch (e) {
      this.setOutput("Interner Referenz-Fehler: " + e.message);
      return;
    }

    const ok = this.validate(studentRes, refRes, t.mode);

    if (ok) {
      if (this.unlocked[this.currentId]) {
        this.setOutput("✅ Korrekt (bereits freigeschaltet).");
        return;
      }
      this.setOutput("✅ Korrekt! Du kannst jetzt freischalten.");
      this.setUnlockState(true);
      return;
    }

    this.setOutput("\u274c Noch nicht korrekt.");
  }


  onSqlEdited() {
        // Sobald der User den Editor ändert: Freischalten wieder sperren,
    // bis erneut „Prüfen“ erfolgreich war.
    if (!this.unlockBtn) return;
    if (this.unlocked?.[this.currentId]) return; // bereits freigeschaltet

    this.resetUnlockButton();
  }

  resetUnlockButton() {
    if (!this.unlockBtn) return;
    this.unlockBtn.disabled = true;
    this.unlockBtn.classList.remove('btn-unlock-ready');
    this.unlockBtn.setAttribute('aria-disabled', 'true');
    this.unlockBtn.style.cursor = 'not-allowed';
    this.unlockBtn.style.opacity = '.6';
  }

  setUnlockState(canUnlock) {
    if (!this.unlockBtn) return;
    const can = !!canUnlock;
    if (!can) {
      this.resetUnlockButton();
      return;
    }
    this.unlockBtn.disabled = false;
    this.unlockBtn.classList.add('btn-unlock-ready');
    this.unlockBtn.setAttribute('aria-disabled', 'false');
    this.unlockBtn.style.cursor = 'pointer';
    this.unlockBtn.style.opacity = '1';
  }

  resumeTaskIfAny() {
    try {
      const raw = sessionStorage.getItem("schulazon_free_resume_v1");
      if (!raw) return;
      sessionStorage.removeItem("schulazon_free_resume_v1");
      const data = JSON.parse(raw);
      const id = data && data.taskId ? String(data.taskId) : "";
      if (!id || !this.TASKS?.[id]) return;
      this.selectTask(id);
      if (typeof data.sql === "string") {
        this.sqlEl.value = data.sql;
        this.onSqlEdited();
      }
    } catch (_) {}
  }


  
async unlockCurrent() {
    const id = this.currentId;
    if (!id) return;

    // Freischalt‑SQL speichern (die Query, mit der die Aufgabe freigeschaltet wurde)
    try {
      const usedSql = (this.sqlEl?.value || '').toString().trim();
      if (usedSql) {
        this.solutionSql = this.solutionSql || {};
        this.solutionSql[id] = usedSql;
      }
    } catch (_) {}

    this.unlocked[id] = true;
    this.persistProgressState();
    await this.shop.lock(id, false);

    // UI aktualisieren
    this.selectTask(id);

    this.setOutput('Freigeschaltet! Der Button ist jetzt im Shop aktiv.');

    this.updateProgressUI();

    // Editor schließen
    this.currentId = null;
    this.setEmptyState(true);
  }



  /* ---------- UI helpers ---------- */
  syncStudentName() {
    const name = getStudentName();
    const label = name ? name : "—";
    if (this.studentEl) this.studentEl.textContent = `Schüler: ${label} • Modus: Freier Bereich`;
  }

  showHint(text) {
    if (!this.hintEl) return;
    this.hintEl.textContent = text;
    this.hintEl.style.display = 'block';
  }


  showHintCard(title, message) {
    if (!this.hintEl) return;
    const t = this.escapeHtml(String(title || '').trim());
    const m = this.escapeHtml(String(message || '').trim());
    this.hintEl.innerHTML = `
      <div class="spicker-block" style="margin:0 0 12px 0; padding:10px 12px;">
        <div class="spicker-block-title">${t}</div>
        <div class="muted">${m}</div>
      </div>
    `;
    this.hintEl.style.display = 'block';
  }
  hideHint() {
    if (!this.hintEl) return;
    this.hintEl.style.display = 'none';
    this.hintEl.textContent = '';
    this.hintEl.innerHTML = '';
  }

  /* ---------- Tipp-System (mit Score-Abzug) ---------- */

  requestSpicker() {
    this.openSpicker();
  }

  requestHint() {
    if (!this.currentId) return;
    const id = this.currentId;

    const alreadyUsed = !!this.hintUsed?.[id];
    const isOpen = !!this.hintCardEl && (this.hintCardEl.classList.contains('show') || this.hintCardEl.classList.contains('open'));
    const isPending = this._pendingHintTaskId === id;

    // 1) Wenn Tipp schon genutzt: Tipp-Card togglen (ohne Pop-up).
    if (alreadyUsed) {
      this.openHintOverlay(this.getHintText(id), { mode: 'hint', title: 'Tipp' });
      return;
    }

    // 2) Wenn Confirm-Card bereits offen: erneut klicken schließt sie.
    if (isOpen && isPending) {
      this.closeHintOverlay();
      return;
    }

    // 3) Erstes Öffnen kostet 1 Score → inline bestätigen (kein Pop-up).
    this._pendingHintTaskId = id;
    const score = this.computeScore();
    const msg =
      `Dieser Tipp kostet 1 Score.
` +
      `Aktueller Score: ${score}.

` +
      `Wenn du fortf\u00e4hrst, wird dein Score um 1 reduziert und du siehst den Tipp f\u00fcr diese Aufgabe dauerhaft.`;
    this.openHintOverlay(msg, { mode: 'confirm', title: 'Tipp anzeigen?', confirmLabel: 'Tipp anzeigen (-1)' });
  }

  requestScaffold() {
    if (!this.currentId) return;
    const id = this.currentId;

    const alreadyUsed = !!this.scaffoldUsed?.[id];
    const isOpen = !!this.scaffoldCardEl && (this.scaffoldCardEl.classList.contains('show') || this.scaffoldCardEl.classList.contains('open'));
    const isPending = this._pendingScaffoldTaskId === id;

    // Wenn bereits genutzt: Codeger\u00fcst togglen
    if (alreadyUsed) {
      this.openScaffoldCard(this.getScaffoldText(id), { mode: 'hint', title: 'Codeger\u00fcst' });
      return;
    }

    if (isOpen && isPending) return;

    this._pendingScaffoldTaskId = id;
    const score = this.computeScore();
    const msg =
      `Wenn du dir das Codeger\u00fcst anzeigen lässt, verlierst du 3 Score-Punkte.
Aktueller Score: ${score}.

Wenn du fortf\u00e4hrst, wird dein Score um 3 reduziert und du siehst das Ger\u00fcst f\u00fcr diese Aufgabe dauerhaft.`;
    this.openScaffoldCard(msg, { mode: 'confirm', title: 'Codeger\u00fcst anzeigen?', confirmLabel: 'Codeger\u00fcst anzeigen (-3)' });
  }

  openConfirmOverlay(opts = {}) {
    if (!this.confirmOverlayEl) return;
    const title = String(opts.title || 'Best\u00e4tigen');
    const text = String(opts.text || '');
    const yesLabel = String(opts.yesLabel || 'OK');

    if (this.confirmTitleEl) this.confirmTitleEl.textContent = title;
    if (this.confirmTextEl) this.confirmTextEl.textContent = text;
    if (this.confirmYesBtn) this.confirmYesBtn.textContent = yesLabel;

    this._confirmAction = (typeof opts.onConfirm === 'function') ? opts.onConfirm : null;
    this.confirmOverlayEl.classList.add('show', 'open');
    this.confirmOverlayEl.setAttribute('aria-hidden', 'false');
  }

  openConfirm() {
    this.openConfirmOverlay({});
  }

  closeConfirm() {
    this._confirmAction = null;
    if (!this.confirmOverlayEl) return;
    this.confirmOverlayEl.classList.remove('show', 'open');
    this.confirmOverlayEl.setAttribute('aria-hidden', 'true');
  }


  showLockedModal(title, msg) {
    // Ensure DOM refs exist even if template changes
    if (!this.lockedOverlayEl) {
      this.lockedOverlayEl = document.getElementById('lockedOverlay');
      this.lockedCloseBtn = document.getElementById('lockedClose');
      this.lockedOkBtn = document.getElementById('lockedOk');
      this.lockedTitleEl = document.getElementById('lockedTitle');
      this.lockedMsgEl = document.getElementById('lockedMsg');
    }
    if (!this.lockedOverlayEl) return;

    if (this.lockedTitleEl) this.lockedTitleEl.textContent = String(title || 'Hinweis');
    if (this.lockedMsgEl) this.lockedMsgEl.textContent = String(msg || '');

    this.lockedOverlayEl.classList.add('show', 'open');
    this.lockedOverlayEl.setAttribute('aria-hidden', 'false');
  }

  hideLockedModal() {
    if (!this.lockedOverlayEl) {
      this.lockedOverlayEl = document.getElementById('lockedOverlay');
    }
    if (!this.lockedOverlayEl) return;
    this.lockedOverlayEl.classList.remove('show', 'open');
    this.lockedOverlayEl.setAttribute('aria-hidden', 'true');
  }


  confirmHint() {
    const id = this._pendingHintTaskId;
    if (!id) return;

    // Abzug nur 1x pro Aufgabe
    this.hintUsed[id] = true;
    this.persistProgressState();
    this.updateProgressUI();

    this._pendingHintTaskId = null;
    this.openHintOverlay(this.getHintText(id), { mode: 'hint', title: 'Tipp' });
  }

  confirmScaffold() {
    const id = this._pendingScaffoldTaskId;
    if (!id) return;

    this.scaffoldUsed[id] = true;
    this.persistProgressState();
    this.updateProgressUI();

    this._pendingScaffoldTaskId = null;
    this.openScaffoldCard(this.getScaffoldText(id), { mode: 'hint', title: 'Codeger\u00fcst' });
  }

  openHintOverlay(text, opts = {}) {
    if (!this.hintCardEl || !this.hintTextEl) return;

    const mode = (opts && opts.mode) ? String(opts.mode) : 'hint';
    const isConfirm = mode === 'confirm';
    const title = (opts && opts.title) ? String(opts.title) : (isConfirm ? 'Tipp anzeigen?' : 'Tipp');
    const confirmLabel = (opts && opts.confirmLabel) ? String(opts.confirmLabel) : 'Tipp anzeigen (-1)';

    if (this.hintTitleEl) this.hintTitleEl.textContent = title;
    if (this.hintConfirmBtn) this.hintConfirmBtn.style.display = isConfirm ? '' : 'none';
    if (this.hintConfirmBtn && isConfirm) this.hintConfirmBtn.textContent = confirmLabel;

    this.hintTextEl.textContent = text || '';
    this.hintCardEl.classList.add('show', 'open');
    try { this.hintCardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
  }

  closeHintOverlay() {
    if (!this.hintCardEl || !this.hintTextEl) return;
    this.hintCardEl.classList.remove('show', 'open');
    this.hintTextEl.textContent = '';

    if (this.hintConfirmBtn) this.hintConfirmBtn.style.display = 'none';
    if (this.hintTitleEl) this.hintTitleEl.textContent = 'Tipp';

    this._pendingHintTaskId = null;
  }

  openScaffoldCard(text, opts = {}) {
    if (!this.scaffoldCardEl || !this.scaffoldTextEl) return;

    const mode = (opts && opts.mode) ? String(opts.mode) : 'hint';
    const isConfirm = mode === 'confirm';
    const title = (opts && opts.title) ? String(opts.title) : (isConfirm ? 'Codeger\u00fcst anzeigen?' : 'Codeger\u00fcst');
    const confirmLabel = (opts && opts.confirmLabel) ? String(opts.confirmLabel) : 'Codeger\u00fcst anzeigen (-3)';

    if (this.scaffoldTitleEl) this.scaffoldTitleEl.textContent = title;
    if (this.scaffoldConfirmBtn) this.scaffoldConfirmBtn.style.display = isConfirm ? '' : 'none';
    if (this.scaffoldConfirmBtn && isConfirm) this.scaffoldConfirmBtn.textContent = confirmLabel;

    this.scaffoldTextEl.textContent = text || '';
    this.scaffoldCardEl.classList.add('show', 'open');
    try { this.scaffoldCardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
  }

  closeScaffoldCard() {
    if (!this.scaffoldCardEl || !this.scaffoldTextEl) return;
    this.scaffoldCardEl.classList.remove('show', 'open');
    this.scaffoldTextEl.textContent = '';
    if (this.scaffoldConfirmBtn) this.scaffoldConfirmBtn.style.display = 'none';
    if (this.scaffoldTitleEl) this.scaffoldTitleEl.textContent = 'Codeger\u00fcst';
    this._pendingScaffoldTaskId = null;
  }

  // Backwards‑compat hook (alte API), jetzt als Card
  showTaskHint(text) { this.openHintOverlay(text, { mode: 'hint', title: 'Tipp' }); }
  hideTaskHint() {
    this.closeHintOverlay();
    this.closeScaffoldCard();
  }

  refreshHintCards() {
    const id = this.currentId;
    if (!id) {
      this.hideTaskHint();
      return;
    }

    if (this.hintUsed?.[id]) {
      this.openHintOverlay(this.getHintText(id), { mode: 'hint', title: 'Tipp' });
    } else {
      this.closeHintOverlay();
    }

    if (this.scaffoldUsed?.[id]) {
      this.openScaffoldCard(this.getScaffoldText(id), { mode: 'hint', title: 'Codeger\u00fcst' });
    } else {
      this.closeScaffoldCard();
    }
  }

  getHintText(taskId) {
    const t = this.TASKS?.[taskId];
    const H = {
      "search": "Nutze LIKE auf produkte.name. Baue den Suchbegriff :q mit Wildcards (%) zusammen.",
      "all": "Hier wird nichts gefiltert. Verwende eine einfache SELECT-Abfrage auf die Tabelle produkte.",
      "express": "Filtere in produkte nach liefertage. Gesucht ist der Wert 1 (exakt).",
      "bestseller": "Aggregiere verk\u00e4ufe pro produkt_id und filtere die Summe > 300 (HAVING). Danach gib die passenden Produkte aus.",
      "available": "Nutze eine WHERE-Bedingung auf lagerbestand im Bereich 1 bis 5 (inklusive).",
      "priceAsc": "Sortiere die Produkte nach preis aufsteigend (ASC).",
      "priceDesc": "Sortiere die Produkte nach preis absteigend (DESC).",
      "popularity": "Summiere verk\u00e4ufe pro produkt_id und sortiere die Summe absteigend. Gib produkt_id und die Summe aus.",
      "cat-electronics": "Verbinde produkte mit kategorien \u00fcber kategorie_id = id und filtere kategorien.name = 'Elektronik'.",
      "cat-household": "Verbinde produkte mit kategorien \u00fcber kategorie_id = id und filtere kategorien.name = 'Haushalt'.",
      "cat-sport": "Verbinde produkte mit kategorien \u00fcber kategorie_id = id und filtere kategorien.name = 'Sport'.",
      "price-25": "Filtere auf preis < 25.",
      "price-50": "Filtere auf preis zwischen 25 und 50 (inklusive).",
      "price-100": "Filtere auf preis zwischen 50 und 100 (inklusive).",
      "rating-5": "Verbinde produkte und bewertungen \u00fcber produkt_id. Filtere sterne = 5 und entferne Duplikate (DISTINCT oder GROUP BY).",
      "rating-4": "Verbinde produkte und bewertungen \u00fcber produkt_id. Filtere sterne >= 4 und entferne Duplikate (DISTINCT oder GROUP BY).",
      "cart-refresh": "Wie Warenkorb anzeigen, plus Zeilensumme (preis * menge) und ORDER BY nach Name.",
      "cart-total": "Gesamtpreis = SUM(preis * menge). Gib nur einen Wert zur\u00fcck.",
      "orders": "Filtere verk\u00e4ufe auf nutzer_id = 1, sortiere nach neuestem (id DESC) und begrenze auf 3. Berechne die Zeilensumme.",
      "topProducts": "Aggregiere verk\u00e4ufe pro Produkt (SUM). Sortiere absteigend und nimm die Top 2.",
    };
if (H[taskId]) return H[taskId];

    // Fallback – hilft, verrät nicht die Lösung
    const lvl = this.getDifficultyLevel(t?.difficulty);
    if (lvl === 1) return "Starte mit SELECT ... FROM ... und erg\u00e4nze dann genau eine passende WHERE-Bedingung. Pr\u00fcfe zuerst, ob die richtigen Zeilen kommen.";
    if (lvl === 2) return "\u00dcberlege, welche zwei Tabellen zusammengeh\u00f6ren, und verbinde sie \u00fcber passende Schl\u00fcsselspalten. Danach filterst du \u00fcber WHERE.";
    return "Wenn Aggregation n\u00f6tig ist: GROUP BY auf der richtigen Schl\u00fcsselspalte, SUM/COUNT f\u00fcr die Kennzahl und HAVING f\u00fcr Bedingungen auf Aggregaten.";
  }

  getScaffoldText(taskId) {
    const S = {
      "search":
`SELECT *
FROM ...
WHERE ... LIKE ...;`,
      "all":
`SELECT *
FROM ...;`,
      "express":
`SELECT *
FROM ...
WHERE ... = ...;`,
      "bestseller":
`SELECT p.*
FROM ...
WHERE ... IN (
  SELECT ...
  FROM ...
  GROUP BY ...
  HAVING SUM(...) > ...
);`,
      "available":
`SELECT *
FROM ...
WHERE ... BETWEEN ... AND ...;`,
      "priceAsc":
`SELECT *
FROM ...
ORDER BY ... ASC;`,
      "priceDesc":
`SELECT *
FROM ...
ORDER BY ... DESC;`,
      "popularity":
`SELECT produkt_id, SUM(anzahl) AS verkaeufe
FROM ...
GROUP BY ...
ORDER BY ... DESC;`,
      "cat-electronics":
`SELECT p.*
FROM ..., ...
WHERE ... = ...
AND ... = ...;`,
      "cat-household":
`SELECT p.*
FROM ..., ...
WHERE ... = ...
AND ... = ...;`,
      "cat-sport":
`SELECT p.*
FROM ..., ...
WHERE ... = ...
AND ... = ...;`,
      "price-25":
`SELECT *
FROM ...
WHERE ... < ...;`,
      "price-50":
`SELECT *
FROM ...
WHERE ... BETWEEN ... AND ...;`,
      "price-100":
`SELECT *
FROM ...
WHERE ... BETWEEN ... AND ...;`,
      "rating-5":
`SELECT DISTINCT p.*
FROM ..., ...
WHERE ... = ...
AND ... = ...;`,
      "rating-4":
`SELECT DISTINCT p.*
FROM ..., ...
WHERE ... = ...
AND ... >= ...;`,
      "cart-refresh":
`SELECT p.name, p.preis, w.menge, p.preis * w.menge AS zeilensumme
FROM ..., ...
WHERE ... = ...
ORDER BY ... ASC;`,
      "cart-total":
`SELECT SUM(p.preis * w.menge)
FROM ..., ...
WHERE ... = ...;`,
      "orders":
`SELECT p.name, v.anzahl, p.preis * v.anzahl AS summe
FROM ..., ...
WHERE ... = ...
AND ... = ...
ORDER BY ... DESC
LIMIT ...;`,
      "topProducts":
`SELECT p.name, SUM(v.anzahl) AS gesamt_verkaeufe
FROM ..., ...
WHERE ... = ...
GROUP BY ...
ORDER BY ... DESC
LIMIT ...;`
    };

    if (S[taskId]) return S[taskId];

    return `SELECT ...
FROM ...
WHERE ...;`;
  }

  /* ---------- Score ---------- */

  getTaskPoints(taskId) {
    const t = this.TASKS?.[taskId];
    const lvl = this.getDifficultyLevel(t?.difficulty);
    if (lvl === 1) return 1;
    if (lvl === 2) return 2;
    return 4;
  }

  computeScore() {
    const ids = Object.keys(this.TASKS || {});
    const base = ids.reduce((acc, id) => acc + (this.unlocked?.[id] ? this.getTaskPoints(id) : 0), 0);
    const hints = Object.keys(this.hintUsed || {}).filter(k => !!this.hintUsed[k]).length;
    const scaffolds = Object.keys(this.scaffoldUsed || {}).filter(k => !!this.scaffoldUsed[k]).length;
    const bonus = this.sqliDone ? 10 : 0;
    const scaffoldPenalty = scaffolds * 3;
    return Math.max(0, base + bonus - hints - scaffoldPenalty);
  }

  pulseLocked(el) {
    if (!el) return;
    el.classList.remove('shake');
    // reflow
    void el.offsetWidth;
    el.classList.add('shake');
  }

  getDifficultyLevel(difficulty) {
    const s = String(difficulty || '').trim();
    const n = (s.match(/\+/g) || []).length;
    return Math.max(1, Math.min(3, n || 1));
  }

  setDifficultyDots(level) {
    const dots = Array.from(this.dotsEl?.querySelectorAll('.dot') || []);
    dots.forEach((d, i) => d.classList.toggle('active', i < level));
  }

  getProgressPct() {
    const ids = Object.keys(this.TASKS || {});
    const total = Math.max(1, this.TOTAL_TASKS || ids.length || 1);
    const done = ids.filter(id => !!this.unlocked[id]).length;
    return Math.min(100, Math.round((done / total) * 100));
  }

  getMissingForPct(targetPct) {
    const ids = Object.keys(this.TASKS || {});
    const total = Math.max(1, this.TOTAL_TASKS || ids.length || 1);
    const done = ids.filter(id => !!this.unlocked[id]).length;
    const needed = Math.ceil((targetPct / 100) * total);
    return Math.max(0, needed - done);
  }

  updateProgressUI() {
    const ids = Object.keys(this.TASKS || {});
    const total = Math.max(1, this.TOTAL_TASKS || ids.length || 1);
    const done = ids.filter(id => !!this.unlocked[id]).length;
    const pct = Math.min(100, Math.round((done / total) * 100));

    if (this.progressCountEl) this.progressCountEl.textContent = `${done}/${total}`;
    if (this.progressPctEl) this.progressPctEl.textContent = `${pct}%`;
    if (this.progressFillEl) this.progressFillEl.style.width = `${pct}%`;

    if (this.scoreEl) this.scoreEl.textContent = `Score ${this.computeScore()}`;

    // Bonus availability
    const canBonus = pct >= BONUS_MIN_PCT;
    if (this.btnBonus) {
      this.btnBonus.classList.toggle('btn-locked', !canBonus);
      this.btnBonus.setAttribute('aria-disabled', canBonus ? 'false' : 'true');
      this.btnBonus.title = canBonus ? 'Zusatzaufgabe: Hacking verfügbar' : `Ab ${BONUS_MIN_PCT}% Fortschritt verfügbar`;
    }
  }

  downloadPdf(url, filename) {
    // best-effort: einfacher Download im selben Ordner
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  downloadJson(filename, data) {
    try {
      const payload = JSON.stringify(data, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'schulazon-spielstand.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 800);
    } catch (_) {}
  }

  exportProgress() {
    const safeObj = (v) => (v && typeof v === 'object') ? v : {};
    const stamp = new Date().toISOString().replace(/:/g, '-').replace('T', '_').slice(0, 19);
    const payload = {
      version: 1,
      mode: 'free',
      exportedAt: new Date().toISOString(),
      name: getStudentName(),
      totalTasks: this.TOTAL_TASKS || 0,
      unlocked: safeObj(this.unlocked),
      hintUsed: safeObj(this.hintUsed),
      scaffoldUsed: safeObj(this.scaffoldUsed),
      solutionSql: safeObj(this.solutionSql),
      sqliDone: !!this.sqliDone,
      spickerUsed: !!this.spickerUsed
    };
    this.downloadJson(`schulazon-spielstand-${stamp}.json`, payload);
  }

  // ---------- Validation ----------
  validate(studentExec, refExec, mode) {
    // Full table comparison (supports text + numeric outputs)
    if (mode === 'rows_order' || mode === 'rows_set' || mode === 'order' || mode === 'set') {
      const ordered = (mode === 'rows_order' || mode === 'order');
      return this.validateRows(studentExec, refExec, ordered);
    }

    const stu = this.extractIds(studentExec);
    const ref = this.extractIds(refExec);

    if (!stu.ok || !ref.ok) return false;

    if (mode === 'scalar') {
      const stuVal = this.extractScalar(studentExec);
      const refVal = this.extractScalar(refExec);
      if (!Number.isFinite(stuVal) || !Number.isFinite(refVal)) return false;
      return Math.abs(stuVal - refVal) < 1e-9;
    }

    if (mode === 'order') {
      if (stu.ids.length !== ref.ids.length) return false;
      for (let i = 0; i < stu.ids.length; i++) if (stu.ids[i] !== ref.ids[i]) return false;
      return true;
    }

    // default: set
    const A = new Set(stu.ids);
    const B = new Set(ref.ids);
    if (A.size !== B.size) return false;
    for (const x of A) if (!B.has(x)) return false;
    return true;
  }

  validateRows(studentExec, refExec, ordered) {
    const a = this.extractRows(studentExec);
    const b = this.extractRows(refExec);

    if (!a.ok || !b.ok) return false;
    if (a.colCount !== b.colCount) return false;

    if (ordered) {
      if (a.rows.length !== b.rows.length) return false;
      for (let i = 0; i < a.rows.length; i++) {
        if (!this.rowsEqual(a.rows[i], b.rows[i])) return false;
      }
      return true;
    }

    // unordered: compare as multisets of serialized rows
    const count = (rows) => {
      const m = new Map();
      for (const r of rows) {
        const k = JSON.stringify(r);
        m.set(k, (m.get(k) || 0) + 1);
      }
      return m;
    };

    const ca = count(a.rows);
    const cb = count(b.rows);
    if (ca.size !== cb.size) return false;
    for (const [k, v] of ca.entries()) {
      if (cb.get(k) !== v) return false;
    }
    return true;
  }

  extractRows(execResult) {
    // Leeres Result ist gültig
    if (!execResult || execResult.length === 0) return { ok: true, rows: [], colCount: 0 };
    const res = execResult[0];
    const values = res?.values || [];
    const columns = Array.isArray(res?.columns) ? res.columns : [];
    const colCount = columns.length;
    if (!Array.isArray(values) || values.length === 0) return { ok: true, rows: [], colCount };

    // Normalize each cell to stable representation
    const rows = values.map(row => row.map(v => this.normalizeCell(v)));
    return { ok: true, rows, colCount };
  }

  normalizeCell(v) {
    if (v === null || v === undefined) return null;

    // numbers: stabilize float formatting
    const n = (typeof v === 'number') ? v : (typeof v === 'string' ? Number(v) : NaN);
    if (Number.isFinite(n) && String(v).trim() !== '') {
      // round to 1e-9 to avoid minor float diffs
      const r = Math.round(n * 1e9) / 1e9;
      return r;
    }

    return String(v).trim();
  }

  rowsEqual(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      const x = a[i];
      const y = b[i];
      if (typeof x === 'number' && typeof y === 'number') {
        if (Math.abs(x - y) > 1e-9) return false;
      } else {
        if (x !== y) return false;
      }
    }
    return true;
  }

  extractScalar(execResult) {
    try {
      if (!execResult || !execResult.length) return NaN;
      const row = execResult[0]?.values?.[0];
      if (!row || row.length < 1) return NaN;
      return Number(row[0]);
    } catch (_) {
      return NaN;
    }
  }

 extractIds(execResult) {
  // Kein Result-Objekt → trotzdem gültig, aber leer
  if (!execResult || execResult.length === 0) {
    return { ok: true, ids: [] };
  }

  const res = execResult[0];

  // Keine Werte → gültig, aber leer
  if (!res.values || res.values.length === 0) {
    return { ok: true, ids: [] };
  }

  const columns = res.columns || [];
  const lowerCols = columns.map(c => String(c).toLowerCase());

  let idx = lowerCols.findIndex(c =>
    c === "id" ||
    c === "produkt_id" ||
    c.endsWith(".id") ||
    c.endsWith("_id")
  );

  if (idx === -1 && lowerCols.length === 1) {
    idx = 0;
  }

  if (idx === -1) {
    return { ok: false, ids: [] };
  }

  const ids = res.values
    .map(row => row[idx])
    .filter(v => v !== null && v !== undefined)
    .map(Number)
    .filter(v => !Number.isNaN(v));

  return { ok: true, ids };
}



  isSelectOnly(sql) {
    const s = String(sql || "").trim().toLowerCase();
    if (!s.startsWith("select")) return false;
    const forbidden = ["insert", "update", "delete", "drop", "alter", "create", "pragma", "attach", "detach"];
    return !forbidden.some(k => s.includes(k));
  }

  stripSqlComments(sql) {
    const s = String(sql || "");
    const noBlock = s.replace(/\/\*[\s\S]*?\*\//g, "");
    return noBlock.replace(/--.*$/gm, "");
  }

  normalizeSqlForCheck(sql) {
    const raw = this.stripSqlComments(sql).toLowerCase();
    const flat = raw.replace(/\s+/g, " ").trim();
    const nospace = flat.replace(/\s+/g, "");
    const noparen = nospace.replace(/[()]/g, "");
    return { flat, nospace, noparen };
  }

  containsSqlPattern(norm, pattern, aliasMap) {
    const p = String(pattern || "").toLowerCase().trim();
    if (!p) return true;
    if (p === "dedup") {
      return /\bdistinct\b|\bgroup\s+by\b/.test(norm.flat);
    }
    if (p.startsWith("invals:")) {
      const parts = p.slice(7).split(":").map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const col = this.escapeRegExp(parts[0]);
        const vals = parts.slice(1).join(":").split(",").map(v => v.trim()).filter(Boolean);
        const colRef = `(?:\\b[^\\s\\.]+\\.)?${col}`;
        const re = new RegExp(`${colRef}\\s*in\\s*\\(([^\\)]*)\\)`);
        const m = norm.flat.match(re);
        if (!m) return false;
        const list = m[1] || "";
        return vals.every(v => new RegExp(`\\b${this.escapeRegExp(v)}\\b`).test(list));
      }
    }
    if (p.startsWith("inselect:")) {
      const parts = p.slice(9).split(":").map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const col = this.escapeRegExp(parts[0]);
        const sub = this.escapeRegExp(parts[1]);
        const colRef = `(?:\\b[^\\s\\.]+\\.)?${col}`;
        const re = new RegExp(`${colRef}\\s*in\\s*\\(\\s*select\\s+(?:distinct\\s+)?(?:\\b[^\\s\\.]+\\.)?${sub}\\b`);
        return re.test(norm.flat);
      }
    }
    if (p.startsWith("orcmp:")) {
      const parts = p.slice(6).split(":").map(s => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        const col = this.escapeRegExp(parts[0]);
        const v1 = this.escapeRegExp(parts[1]);
        const v2 = this.escapeRegExp(parts[2]);
        const colRef = `(?:\\b[^\\s\\.]+\\.)?${col}`;
        const a = `${colRef}\\s*={1,2}\\s*${v1}\\s*(?:or|\\bor\\b)\\s*${colRef}\\s*={1,2}\\s*${v2}`;
        const b = `${colRef}\\s*={1,2}\\s*${v2}\\s*(?:or|\\bor\\b)\\s*${colRef}\\s*={1,2}\\s*${v1}`;
        const reA = new RegExp(a);
        const reB = new RegExp(b);
        return reA.test(norm.flat) || reB.test(norm.flat);
      }
    }
    if (p.startsWith("range:")) {
      const parts = p.slice(6).split(":").map(s => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        const col = this.escapeRegExp(parts[0]);
        const min = this.escapeRegExp(parts[1]);
        const max = this.escapeRegExp(parts[2]);
        const colRef = `(?:\\b[^\\s\\.]+\\.)?${col}`;
        const betweenRe = new RegExp(`${colRef}\\s*between\\s*${min}\\s*and\\s*${max}`);
        const geLeRe = new RegExp(`${colRef}\\s*>=\\s*${min}\\s*(?:and|\\band\\b)\\s*${colRef}\\s*<=\\s*${max}`);
        const leGeRe = new RegExp(`${colRef}\\s*<=\\s*${max}\\s*(?:and|\\band\\b)\\s*${colRef}\\s*>=\\s*${min}`);
        const minFirstRe = new RegExp(`${min}\\s*<=\\s*${colRef}\\s*(?:and|\\band\\b)\\s*${colRef}\\s*<=\\s*${max}`);
        const notOutRe = new RegExp(`not\\s*\\(\\s*${colRef}\\s*<\\s*${min}\\s*(?:or|\\bor\\b)\\s*${colRef}\\s*>\\s*${max}\\s*\\)`);
        return betweenRe.test(norm.flat) || geLeRe.test(norm.flat) || leGeRe.test(norm.flat) || minFirstRe.test(norm.flat) || notOutRe.test(norm.flat);
      }
    }
    if (p.startsWith("cmp:")) {
      const parts = p.slice(4).split(":").map(s => s.trim()).filter(Boolean);
      if (parts.length >= 3) {
        const col = this.escapeRegExp(parts[0]);
        const op = this.escapeRegExp(parts[1]);
        const val = this.escapeRegExp(parts[2]);
        const colRef = `(?:\\b[^\\s\\.]+\\.)?${col}`;
        const opRe = (parts[1] === "=") ? "={1,2}" : op;
        const re = new RegExp(`${colRef}\\s*${opRe}\\s*${val}`);
        const flipOps = { "<": ">", ">": "<", "<=": ">=", ">=": "<=" };
        const flip = flipOps[parts[1]];
        if (flip) {
          const reRev = new RegExp(`${val}\\s*${this.escapeRegExp(flip)}\\s*${colRef}`);
          return re.test(norm.flat) || reRev.test(norm.flat);
        }
        if (parts[1] === "=") {
          const reRev = new RegExp(`${val}\\s*={1,2}\\s*${colRef}`);
          return re.test(norm.flat) || reRev.test(norm.flat);
        }
        return re.test(norm.flat);
      }
    }
    if (p.startsWith("tablecol:")) {
      const parts = p.slice(9).split(":").map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const table = parts[0];
        const col = parts[1];
        const aliases = aliasMap?.get(table) || new Set([table]);
        for (const a of aliases) {
          if (norm.nospace.includes(`${a}.${col}`) || norm.flat.includes(`${a}.${col}`)) return true;
        }
        if (aliasMap && aliasMap.size === 1 && aliasMap.has(table)) {
          if (norm.nospace.includes(col) || norm.flat.includes(col)) return true;
        }
        return false;
      }
    }
    if (p.startsWith("mul:")) {
      const parts = p.slice(4).split(":").map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const a = this.escapeRegExp(parts[0]);
        const b = this.escapeRegExp(parts[1]);
        const re = new RegExp(`(?:\\b[^\\s\\.]+\\.)?${a}\\s*\\*\\s*(?:\\b[^\\s\\.]+\\.)?${b}`);
        const reRev = new RegExp(`(?:\\b[^\\s\\.]+\\.)?${b}\\s*\\*\\s*(?:\\b[^\\s\\.]+\\.)?${a}`);
        return re.test(norm.flat) || reRev.test(norm.flat);
      }
    }
    if (p.startsWith("eq:")) {
      const parts = p.slice(3).split(":").map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        const a = this.escapeRegExp(parts[0]);
        const b = this.escapeRegExp(parts[1]);
        const re = new RegExp(`(?:\\b[^\\s\\.]+\\.)?${a}\\s*={1,2}\\s*(?:\\b[^\\s\\.]+\\.)?${b}`);
        const reRev = new RegExp(`(?:\\b[^\\s\\.]+\\.)?${b}\\s*={1,2}\\s*(?:\\b[^\\s\\.]+\\.)?${a}`);
        return re.test(norm.flat) || reRev.test(norm.flat);
      }
    }
    if (/\s/.test(p)) return norm.flat.includes(p);
    return norm.nospace.includes(p) || norm.noparen.includes(p) || norm.flat.includes(p);
  }

  escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  validateSqlStructure(sql, task) {
    const rules = task?.sqlRules;
    if (!rules) return { ok: true };

    const norm = this.normalizeSqlForCheck(sql);
    const aliasMap = this.extractTableAliases(norm.flat);
    const require = Array.isArray(rules.require) ? rules.require : [];
    for (const p of require) {
      if (!this.containsSqlPattern(norm, p, aliasMap)) {
        return { ok: false, message: rules.message || "Die Abfrage passt nicht zur Aufgabe." };
      }
    }
    const anyGroups = Array.isArray(rules.any) ? rules.any : [];
    if (anyGroups.length > 0) {
      const anyOk = anyGroups.some((group) => {
        const parts = Array.isArray(group) ? group : [group];
        return parts.every((p) => this.containsSqlPattern(norm, p, aliasMap));
      });
      if (!anyOk) {
        return { ok: false, message: rules.message || "Die Abfrage passt nicht zur Aufgabe." };
      }
    }
    return { ok: true };
  }

  extractTableAliases(sqlFlat) {
    const map = new Map();
    const add = (table, alias) => {
      if (!table || !/^[a-z_][\w]*$/.test(table)) return;
      if (!map.has(table)) map.set(table, new Set([table]));
      if (alias && /^[a-z_][\w]*$/.test(alias)) map.get(table).add(alias);
    };

    const fromRe = /\bfrom\s+([\s\S]*?)(?=\bwhere\b|\bgroup\b|\border\b|\bhaving\b|\blimit\b|\bunion\b|\bintersect\b|\bexcept\b|$)/g;
    let m;
    while ((m = fromRe.exec(sqlFlat)) !== null) {
      const chunk = m[1];
      const parts = chunk.split(",");
      for (const raw of parts) {
        const part = raw.trim();
        if (!part || part.startsWith("(")) continue;

        const tokens = part.split(/\s+/);
        const table = tokens[0];
        let alias = tokens[1];
        if (alias === "as") alias = tokens[2];
        if (alias === "join" || alias === "on") alias = null;
        add(table, alias);

        const joinRe = /\bjoin\s+([a-z_][\w]*)(?:\s+(?:as\s+)?([a-z_][\w]*))?/g;
        let jm;
        while ((jm = joinRe.exec(part)) !== null) {
          add(jm[1], jm[2]);
        }
      }
    }
    return map;
  }

  escape(s) {
    return String(s).replace(/[&<>"']/g, m => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }
}


class TestMode {
  constructor(root){ this.root = root; }
  mount(){ this.root.innerHTML = `<h2>Test-Modus</h2><p>Platzhalter.</p>`; }
}

/* ===========================
   Boot: Modus wählen
   =========================== */
window.addEventListener("DOMContentLoaded", async () => {
  initTopbarChrome();

  const mode = document.body?.dataset?.mode || "free";
  const root = document.getElementById("modeRoot");
  if (!root) return;

  let m;
  if (mode === "test") m = new TestMode(root);
  else m = new FreeMode(root);

  // FreeMode mount ist async -> await ist ok
  const r = m.mount();
  if (r && typeof r.then === "function") await r;
});



