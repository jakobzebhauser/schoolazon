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
   Free-Mode-Start: normal frisch starten, Import/Tutorial-Übergang behalten.
   =========================== */
function isTopLevelFreeModePage() {
  try {
    const isFree = (document.body && document.body.dataset && document.body.dataset.mode) === "free";
    if (!isFree) return false;
    return window.self === window.top;
  } catch (_) {
    return false;
  }
}

function clearFreeModeStartState() {
  const keys = [
    "schulazon_name",
    "schulazon_unlocked_v1",
    "schulazon_unlocked_source_v1",
    "schulazon_hint_used_v1",
    "schulazon_scaffold_used_v1",
    "schulazon_solution_sql_v1",
    "schulazon_sqli_done_v1",
    "schulazon_spicker_used_v1",
    "schulazon_free_resume_v1",
    "schulazon_free_header_collapsed_v1"
  ];

  try { delete window.SCHULAZON_NAME; } catch (_) {}

  for (const storage of [localStorage, sessionStorage]) {
    try {
      for (const key of keys) storage.removeItem(key);
    } catch (_) {}
  }
}

(function initFreeModeStateOnLoad(){
  try {
    if (!isTopLevelFreeModePage()) return;
    const preserveExistingState = sessionStorage.getItem("schulazon_skip_reset_v1") === "true";
    sessionStorage.removeItem("schulazon_skip_reset_v1");
    if (!preserveExistingState) clearFreeModeStartState();
  } catch (_) {}
})();


const THEORY_CHAPTERS = [
  {
    id: 'grundmuster',
    title: 'SQL-Grundmuster',
    goal: 'Ich will eine einfache Abfrage richtig aufbauen.',
    tags: ['SELECT', 'FROM'],
    html: `<div class="spicker-recipe">
<p><code>SELECT</code> nennt die Spalten. <code>FROM</code> nennt die Tabelle.</p>
</div>`,
    templateSql: `SELECT spalte
FROM tabelle;`,
    exampleSql: `SELECT name, preis
FROM produkte;`
  },
  {
    id: 'spalten-auswaehlen',
    title: 'Spalten auswählen',
    goal: 'Ich will nicht alle Spalten sehen, sondern nur bestimmte.',
    tags: ['SELECT'],
    html: `<div class="spicker-recipe">
<p>Mehrere Spalten werden mit Komma getrennt. <code>*</code> zeigt alle Spalten. <code>AS</code> benennt eine Ergebnisspalte.</p>
</div>`,
    templateSql: `SELECT spalte1 AS neuer_name,
       spalte2
FROM tabelle;`,
    exampleSql: `SELECT name AS produktname,
       preis,
       lagerbestand
FROM produkte;`
  },
  {
    id: 'filtern',
    title: 'Zeilen filtern',
    goal: 'Ich will nur Zeilen anzeigen, die eine Bedingung erfüllen.',
    tags: ['WHERE', '<', '>'],
    html: `<div class="spicker-recipe">
<p><code>WHERE</code> steht nach <code>FROM</code>. Wichtige Vergleiche: <code>=</code>, <code>&lt;&gt;</code>, <code>&lt;</code>, <code>&lt;=</code>, <code>&gt;</code>, <code>&gt;=</code>.</p>
</div>`,
    templateSql: `SELECT spalte
FROM tabelle
WHERE spalte > wert;`,
    exampleSql: `SELECT name, preis
FROM produkte
WHERE lagerbestand > 0;`
  },
  {
    id: 'bedingungen-verknuepfen',
    title: 'Bedingungen verbinden',
    goal: 'Ich will mehrere Bedingungen gleichzeitig prüfen.',
    tags: ['AND', 'OR'],
    html: `<div class="spicker-recipe">
<p><code>AND</code>: alles muss passen. <code>OR</code>: mindestens eine Bedingung muss passen.</p>
</div>`,
    templateSql: `SELECT spalte
FROM tabelle
WHERE bedingung1
  AND bedingung2;`,
    exampleSql: `SELECT name, preis
FROM produkte
WHERE lagerbestand > 0
  AND preis <= 80;`
  },
  {
    id: 'textwerte',
    title: 'Nach Text suchen',
    goal: 'Ich will Textwerte oder Textteile finden.',
    tags: ['Text', 'LIKE', '%'],
    html: `<div class="spicker-recipe">
<p>Text steht in <code>'...'</code> oder <code>"..."</code>. <code>=</code> sucht exakt, <code>LIKE</code> sucht Muster, <code>%</code> steht für beliebig viele Zeichen.</p>
</div>`,
    templateSql: `SELECT spalte
FROM tabelle
WHERE textspalte LIKE '%text%';`,
    exampleSql: `SELECT name
FROM produkte
WHERE name LIKE '%ball%';`
  },
  {
    id: 'sortieren',
    title: 'Sortieren',
    goal: 'Ich will die Reihenfolge der Zeilen festlegen.',
    tags: ['ORDER BY', 'ASC', 'DESC'],
    html: `<div class="spicker-recipe">
<p><code>ORDER BY</code> sortiert. <code>ASC</code> ist aufsteigend, <code>DESC</code> absteigend.</p>
</div>`,
    templateSql: `SELECT spalte
FROM tabelle
ORDER BY spalte ASC;`,
    exampleSql: `SELECT name, preis
FROM produkte
ORDER BY name ASC;`
  },
  {
    id: 'begrenzen',
    title: 'Ergebnis begrenzen',
    goal: 'Ich will nur die ersten Zeilen anzeigen.',
    tags: ['LIMIT'],
    html: `<div class="spicker-recipe">
<p><code>LIMIT</code> steht am Ende und begrenzt die Anzahl der Ergebniszeilen.</p>
</div>`,
    templateSql: `SELECT spalte
FROM tabelle
LIMIT anzahl;`,
    exampleSql: `SELECT name
FROM produkte
ORDER BY name ASC
LIMIT 4;`
  },
  {
    id: 'distinct',
    title: 'Doppelte Werte vermeiden',
    goal: 'Ich will jeden Wert nur einmal sehen.',
    tags: ['DISTINCT'],
    html: `<div class="spicker-recipe">
<p><code>DISTINCT</code> entfernt doppelte Ergebniszeilen. Es steht direkt nach <code>SELECT</code>.</p>
</div>`,
    templateSql: `SELECT DISTINCT spalte
FROM tabelle;`,
    exampleSql: `SELECT DISTINCT liefertage
FROM produkte
ORDER BY liefertage ASC;`
  },
  {
    id: 'tabellen-verbinden',
    title: 'Tabellen verbinden',
    goal: 'Ich will Informationen aus mehreren Tabellen nutzen.',
    tags: ['WHERE', 'JOIN', 'FK'],
    html: `<div class="spicker-recipe">
<p><strong>PK</strong> erkennt eine Zeile eindeutig. <strong>FK</strong> verweist darauf. Verbinde FK und PK mit <code>WHERE</code> oder <code>JOIN ... ON</code>.</p>
</div>`,
    templateSql: `-- WHERE-Verknüpfung
SELECT ...
FROM tabelle1 a, tabelle2 b
WHERE a.fremdschluessel = b.primaerschluessel;

-- JOIN-Verknüpfung
SELECT ...
FROM tabelle1 a
JOIN tabelle2 b ON a.fremdschluessel = b.primaerschluessel;`,
    exampleSql: `-- Variante mit WHERE-Verknüpfung
SELECT p.name, k.name AS kategorie
FROM produkte p, kategorien k
WHERE p.kategorie_id = k.id
  AND p.lagerbestand > 0;

-- Gleiche Verbindung mit JOIN
SELECT p.name, k.name AS kategorie
FROM produkte p
JOIN kategorien k ON p.kategorie_id = k.id
WHERE p.lagerbestand > 0;`
  },
  {
    id: 'rechnen',
    title: 'Mit Spalten rechnen',
    goal: 'Ich will aus vorhandenen Werten neue Werte berechnen.',
    tags: ['Rechnen', 'AS'],
    html: `<div class="spicker-recipe">
<p>Du kannst Spalten in Rechnungen verwenden. Gib dem Ergebnis mit <code>AS</code> einen Namen.</p>
</div>`,
    templateSql: `SELECT spalte1,
       spalte1 * zahl AS neuer_wert
FROM tabelle;`,
    exampleSql: `SELECT name,
       preis,
       preis * 0.9 AS aktionspreis
FROM produkte;`
  },
  {
    id: 'aggregieren',
    title: 'Kennwerte berechnen',
    goal: 'Ich will aus vielen Zeilen einen Wert berechnen.',
    tags: ['COUNT', 'SUM', 'AVG'],
    html: `<div class="spicker-recipe">
<table class="spicker-table spicker-table-compact"><thead><tr><th>Funktion</th><th>Zweck</th></tr></thead><tbody>
<tr><td><code>COUNT(*)</code></td><td>Zeilen zählen</td></tr>
<tr><td><code>SUM(...)</code></td><td>Summe bilden</td></tr>
<tr><td><code>AVG(...)</code></td><td>Durchschnitt</td></tr>
</tbody></table>
</div>`,
    templateSql: `SELECT COUNT(*) AS anzahl,
       AVG(spalte) AS durchschnitt
FROM tabelle;`,
    exampleSql: `SELECT COUNT(*) AS produkte,
       AVG(preis) AS durchschnitt
FROM produkte;`
  },
  {
    id: 'gruppieren',
    title: 'Gruppen bilden',
    goal: 'Ich will pro Gruppe einen Kennwert berechnen.',
    tags: ['GROUP BY'],
    html: `<div class="spicker-recipe">
<p><code>GROUP BY</code> fasst Zeilen mit gleichem Wert zusammen.</p>
</div>`,
    templateSql: `SELECT gruppenspalte,
       COUNT(*) AS anzahl
FROM tabelle
GROUP BY gruppenspalte;`,
    exampleSql: `SELECT produkt_id,
       COUNT(*) AS anzahl_bewertungen
FROM bewertungen
GROUP BY produkt_id;`
  },
  {
    id: 'gruppen-filtern',
    title: 'Gruppen filtern',
    goal: 'Ich will nur bestimmte Gruppen anzeigen.',
    tags: ['HAVING'],
    html: `<div class="spicker-recipe">
<p><code>HAVING</code> filtert nach dem Gruppieren.</p>
</div>`,
    templateSql: `SELECT gruppenspalte,
       COUNT(*) AS anzahl
FROM tabelle
GROUP BY gruppenspalte
HAVING COUNT(*) >= wert;`,
    exampleSql: `SELECT produkt_id,
       COUNT(*) AS anzahl_bewertungen
FROM bewertungen
GROUP BY produkt_id
HAVING COUNT(*) >= 2;`
  },
  {
    id: 'unterabfragen',
    title: 'Unterabfragen nutzen',
    goal: 'Ich will erst eine Liste berechnen und damit weiterfiltern.',
    tags: ['IN', 'Unterabfrage'],
    html: `<div class="spicker-recipe">
<p>Eine Unterabfrage steht in Klammern. Mit <code>IN</code> prüfst du, ob ein Wert in dieser berechneten Liste vorkommt.</p>
</div>`,
    templateSql: `SELECT spalte
FROM tabelle
WHERE spalte IN (
  SELECT andere_spalte
  FROM andere_tabelle
);`,
    exampleSql: `SELECT name
FROM kategorien
WHERE id IN (
  SELECT kategorie_id
  FROM produkte
  WHERE liefertage <= 2
);`
  }
];

/* ===========================
   Shell chrome helpers (Name, Fullscreen)
   =========================== */

const FREE_HEADER_COLLAPSE_KEY = "schulazon_free_header_collapsed_v1";


const BONUS_MIN_PCT = 70;
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

  const helpBtn = document.getElementById("helpBtn");
  const isTutorial = (document.body && document.body.dataset && document.body.dataset.tutorial) === "1";

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
    if (e.key !== "Escape") return;
    if (helpOverlay?.classList?.contains("show")) closeHelp();
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

  async setTaskMeta(tasks) {
    await this.ready;
    this.send("SET_TASK_META", { tasks });
  }

  async pulse(taskId) {
    await this.ready;
    this.send("PULSE_ACTION", { taskId });
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
    this.unlockedSource = {};

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
    this._shopPulseTimer = null;
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

      const rawUnlockedSource = localStorage.getItem('schulazon_unlocked_source_v1');
      if (rawUnlockedSource) {
        const data = JSON.parse(rawUnlockedSource);
        if (data && typeof data === 'object') this.unlockedSource = data;
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, deren Name einen Suchbegriff aus der Suchleiste enthält. Verwende dafür LIKE zur Mustererkennung. Der Parameter :q enthält den Suchbegriff aus der Suchleiste. Verbinde ihn mit % über den Konkatenationsoperator ||, damit der Begriff an beliebiger Stelle im Namen gefunden wird.`,
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte aus der Tabelle produkte zurückgibt.`,
          starter: "SELECT * FROM produkte;",
          refSql: "SELECT * FROM produkte;",
          mode: "rows_set"
        },

        "express": {
          title: "Expresslieferung",
          difficulty: "+",
          task:
  `Aufgabe:
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, deren Lieferzeit genau einen Tag beträgt.`,
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, deren gesamte Verkaufsmenge über 300 liegt. Ein Produkt kann mehrfach verkauft worden sein; alle Verkäufe sollen aufsummiert werden.`,
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, deren Lagerbestand zwischen 1 und 5 liegt (einschlie\u00dflich der Grenzen).`,
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte aus der Tabelle produkte zurückgibt und die Ergebnisse nach dem Preis aufsteigend sortiert.`,
        starter: "SELECT * FROM produkte ORDER BY preis ASC;",
        refSql: "SELECT * FROM produkte ORDER BY preis ASC;",
        mode: "rows_order"
      },

      "priceDesc": {
        title: "Preis absteigend",
        difficulty: "+",
        task:
`Aufgabe:
  Erstelle eine Abfrage, die alle Spalten aller Produkte aus der Tabelle produkte zurückgibt und die Ergebnisse nach dem Preis absteigend sortiert.`,
        starter: "SELECT * FROM produkte ORDER BY preis DESC;",
        refSql: "SELECT * FROM produkte ORDER BY preis DESC;",
        mode: "rows_order"
      },

      "popularity": {
        title: "Beliebtheit",
        difficulty: "+++",
        task:
`Aufgabe:
  Berechne für jedes Produkt die gesamte Anzahl aller Verkäufe. Addiere dazu alle Verkaufszahlen (anzahl) mit derselben produkt_id. Gib pro Produkt genau eine Zeile mit der Produkt-ID und der berechneten Gesamtanzahl aus. Sortiere die Ergebnisse anschließend so, dass Produkte mit höheren Verkaufszahlen zuerst erscheinen.`,
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, die zur Kategorie „Elektronik“ gehören. Nutze dafür die Beziehung zwischen Produkten und Kategorien.`,
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, die zur Kategorie „Haushalt“ gehören. Nutze dafür die Beziehung zwischen Produkten und Kategorien.`,
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, die zur Kategorie „Sport“ gehören. Nutze dafür die Beziehung zwischen Produkten und Kategorien.`,
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, deren Preis kleiner als 25 € ist.`,
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, deren Preis mindestens 25 € und höchstens 50 € beträgt.`,
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, deren Preis mindestens 50 € und höchstens 100 € beträgt.`,
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
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, die mindestens eine Bewertung mit genau 5 Sternen haben. Jedes Produkt darf nur einmal erscheinen.`,
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
        mode: "rows_set"
      },

        "rating-4": {
          title: "Bewertung ab 4 Sterne",
          difficulty: "++",
          task:
  `Aufgabe:
  Erstelle eine Abfrage, die alle Spalten aller Produkte zurückgibt, die mindestens eine Bewertung mit 4 oder mehr Sternen haben. Jedes Produkt darf nur einmal erscheinen.`,
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
        mode: "rows_set"
      },

      "cart-refresh": {
        title: "Warenkorb aktualisieren",
        difficulty: "++",
        task:
`Aufgabe:
  Erstelle eine Abfrage, die alle Einträge des Warenkorbs anzeigt. Gib für jedes enthaltene Produkt den Produktnamen, den Einzelpreis, die gewählte Menge sowie die berechnete Zeilensumme (preis · menge) aus. Sortiere die Ergebnisse alphabetisch aufsteigend nach dem Produktnamen.`,
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
  Erstelle eine Abfrage, die den Gesamtpreis des gesamten Warenkorbs berechnet. Multipliziere dafür für jeden Eintrag den Produktpreis mit der jeweiligen Menge und summiere anschließend alle berechneten Werte zu einer einzigen Gesamtsumme.`,
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
  Erstelle eine Abfrage, die für den Nutzer mit der ID 1 die drei zuletzt erfassten Verkäufe anzeigt. Gib für jeden Verkauf den Produktnamen, die gekaufte Anzahl sowie den Gesamtpreis aus. Sortiere die Ergebnisse absteigend nach der Verkaufs-ID, sodass die neuesten Verkäufe zuerst erscheinen.`,
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
  Erstelle eine Abfrage, die die zwei meistverkauften Produkte ermittelt. Summiere dazu für jedes Produkt alle Verkaufszahlen (anzahl), gib den Produktnamen sowie die berechnete Gesamtsumme aus und sortiere die Ergebnisse absteigend nach dieser Summe, sodass die höchsten Verkaufszahlen zuerst erscheinen.`,
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
  await this.syncTaskMetaToShop();
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

                   <button class="btn btn-ghost task3-iconBtn task3-codeScaffoldBtn" id="scaffoldBtn" type="button" aria-label="Codeger\u00fcst" title="Codeger\u00fcst anzeigen (-1)">
  <span class="task3-codeScaffoldIcon" aria-hidden="true">&lt;/&gt;</span>
  <span class="task3-codeScaffoldText">Codeger&uuml;st</span>
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

<div class="task3-card task3-hintCard" id="scaffoldCard" aria-hidden="true">
  <div class="task3-hintHead">
    <div class="task3-cardTitle" id="scaffoldTitle">Codeger\u00fcst</div>
  </div>
  <pre class="task3-hintBody" id="scaffoldText" style="white-space:pre-wrap; margin:0;"></pre>
  <div class="task3-hintActions">
    <button class="btn btn-primary" id="scaffoldConfirm" type="button" style="display:none;">Codeger\u00fcst anzeigen (-1)</button>
  </div>
</div>

<div class="task3-card task3-editorCard">
                  <div class="task3-cardHead">
                    <div class="task3-cardTitle">SQL‑Editor</div>
                    <div class="task3-cardMeta">Schreibe deine Abfrage und prüfe sie.</div>
                  </div>

                  <div class="task3-editorShell" id="sqlEditorShell">
                    <div class="task3-editorToolbar" aria-hidden="true">
                      <span class="label">SQL Editor</span>
                      <span class="meta">SQLite</span>
                    </div>
                    <div class="task3-editorBody">
                      <div class="task3-editorGutter" id="sqlGutter" aria-hidden="true">1</div>
                      <div class="task3-editorInputWrap" id="sqlEditorInputWrap">
                        <textarea id="sqlInput" class="task3-editorValue" aria-hidden="true" tabindex="-1"></textarea>
                        <div id="sqlEditor" class="task3-editor" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="false" autocapitalize="off" data-placeholder=""></div>
                      </div>
                    </div>
                  </div>
                  <div class="task3-editorDiagnostics" id="sqlDiagnostics" aria-live="polite"></div>

                  <div class="task3-actions">
                    <button class="btn btn-primary" id="runBtn" type="button">Prüfen</button>
                    <button class="btn" id="resultTableBtn" type="button" disabled aria-disabled="true">Ergebnistabelle anzeigen</button>
                    <button class="btn" id="unlockBtn" type="button" disabled aria-disabled="true">Freischalten</button>
                  </div>
                </div>

                <div class="task3-card">
                    <div class="task3-cardHead">
                      <div class="task3-cardTitle">Ausgabe</div>
                    <div class="task3-cardMeta">Ausgabe deiner Prüfung</div>
                  </div>
                  <pre class="output task3-output" id="out"></pre>
                </div>

                <div class="task3-card task3-resultTableCard" id="resultTableCard" style="display:none;" aria-hidden="true">
                  <div class="task3-cardHead">
                    <div class="task3-cardTitle">Ergebnistabelle</div>
                    <div class="task3-cardMeta">Ausgabe deiner Abfrage</div>
                  </div>
                  <div class="task3-resultTableShell" id="resultTableContent"></div>
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
                  <h3 class="spicker-title">SQL‑Nachschlagewerk</h3>
                  <div class="spicker-sub">Lernschritt auswählen</div>
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
                <h3 class="overlay-title" id="confirmTitle">Bestätigen</h3>
                <button class="btn btn-ghost" id="confirmClose" type="button">✕</button>
              </div>
              <div class="task-body" id="confirmText">Aktion bestätigen.</div>
              <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn btn-ghost" id="confirmNo" type="button">Abbrechen</button>
                <button class="btn btn-primary" id="confirmYes" type="button">OK</button>
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
    this.sqlEditorEl = this.root.querySelector('#sqlEditor');
    this.sqlDiagnosticsEl = this.root.querySelector('#sqlDiagnostics');
    this.sqlGutterEl = this.root.querySelector('#sqlGutter');
    this.editorShellEl = this.root.querySelector('#sqlEditorShell');
    this.outEl = this.root.querySelector('#out');
    this.runBtn = this.root.querySelector('#runBtn');
    this.unlockBtn = this.root.querySelector('#unlockBtn');
    this.resultTableBtn = this.root.querySelector('#resultTableBtn');
    this.resultTableCardEl = this.root.querySelector('#resultTableCard');
    this.resultTableContentEl = this.root.querySelector('#resultTableContent');

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
    this.lastExecutableResult = null;
    this.sqlAutocompleteSuggestion = null;

    // Codeger\u00fcst card
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
    this.resultTableBtn?.addEventListener('click', () => this.toggleResultTable());
    this.closeTaskBtn.addEventListener('click', () => this.closeTask());
    this.hintBtn?.addEventListener('click', () => this.requestHint());
    this.scaffoldBtn?.addEventListener('click', () => this.requestScaffold());


    // Bei SQL-Änderung: Freischalten wieder deaktivieren (muss erneut geprüft werden)
    this.sqlEditorEl?.addEventListener('input', () => {
      this.syncSqlEditorValue();
      this.onSqlEdited();
      this.resetResultTable();
      this.updateSqlGutter();
      this.updateSqlEditorAssist();
    });
    this.sqlEditorEl?.addEventListener('scroll', () => {
      this.syncGutterScroll();
    });
    this.sqlEditorEl?.addEventListener('beforeinput', (e) => this.handleSqlEditorBeforeInput(e));
    this.sqlEditorEl?.addEventListener('keydown', (e) => this.handleSqlEditorKeydown(e));
    this.sqlEditorEl?.addEventListener('click', () => this.updateSqlAutocomplete());
    this.sqlEditorEl?.addEventListener('keyup', () => this.updateSqlAutocomplete());
    this.sqlEditorEl?.addEventListener('paste', (e) => this.handleSqlEditorPaste(e));
            
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
     SQL-Nachschlagewerk
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
      const goal = c.goal ? `<div class="spicker-item-goal">${this.escapeHtml(c.goal)}</div>` : '';
      const tags = Array.isArray(c.tags) ? c.tags : [];
      const tagsHtml = tags.length ? `<div class="spicker-tags">${tags.map((tag) => `<span class="spicker-tag">${this.escapeHtml(tag)}</span>`).join('')}</div>` : '';
      return `
        <button class="spicker-item" type="button" data-chapter="${id}">
          <div>
            <div class="spicker-item-title">${title}</div>
            ${goal}
            ${tagsHtml}
          </div>
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
      const template = (ch && ch.templateSql) ? String(ch.templateSql) : '';
      const tags = Array.isArray(ch.tags) ? ch.tags : [];
      const intro = `
        ${ch.goal ? `<p class="spicker-goal">${this.escapeHtml(ch.goal)}</p>` : ''}
        ${tags.length ? `<div class="spicker-tags spicker-tags-detail">${tags.map((tag) => `<span class="spicker-tag">${this.escapeHtml(tag)}</span>`).join('')}</div>` : ''}
      `;
      const templateBlock = template ? `
        <div class="spicker-block spicker-template-block" style="margin-top:14px;">
          <div class="spicker-block-title">Minimalvorlage</div>
          <pre class="spicker-code spicker-template-code">${this.escapeHtml(template)}</pre>
        </div>
      ` : '';
      const exBlock = ex ? `
        <div class="spicker-block" style="margin-top:14px;">
          <div class="spicker-block-title">Beispielabfrage aus dem Shop-Schema</div>
          <pre class="spicker-code">${this.escapeHtml(ex)}</pre>
        </div>
      ` : '';
      this.spickerContentEl.innerHTML = `${intro}${ch.html}${templateBlock}${exBlock}`;
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
      if (this.unlockedSource?.[id] === "tutorial") tags.push('<span class="spicker-tag tutorial">Einarbeitung</span>');
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
            <div class="task3-cardTitle">Login‑Abfrage</div>
          </div>
          <div class="task3-body">
            <p style="margin:6px 0 0 0;">Die Anmeldung läuft über die Tabelle <strong>users</strong>. Schema:</p>
            <div style="overflow:auto; -webkit-overflow-scrolling: touch;">
              <table class="spicker-table spicker-table-compact" aria-label="Schema users">
                <thead>
                  <tr><th>Spalte</th><th>Typ</th><th>Hinweis</th></tr>
                </thead>
                <tbody>
                  <tr><td>id</td><td>INTEGER</td><td>Primary Key</td></tr>
                  <tr><td>username</td><td>TEXT</td><td>eindeutig</td></tr>
                  <tr><td>password</td><td>TEXT</td><td>Passwort</td></tr>
                  <tr><td>role</td><td>TEXT</td><td>z. B. admin/user</td></tr>
                  <tr><td>status</td><td>TEXT</td><td>active/locked</td></tr>
                </tbody>
              </table>
            </div>
            <p class="muted" style="margin:4px 0 8px 0;">Hierfür wird die folgende Abfrage genutzt:</p>
            <pre class="task3-output" style="white-space:pre-wrap; margin:0; min-height:0;">SELECT id, username, role
FROM users
WHERE username = '<span class="muted">EINGABE_USER</span>'
  AND password = '<span class="muted">EINGABE_PASS</span>'
LIMIT 1;</pre>
          </div>
        </div>

        <div class="task3-card">
          <div class="task3-cardHead">
            <div class="task3-cardTitle">Aufgabe</div>
          </div>
          <div class="task3-body">
            <ol style="margin:6px 0 0 18px;">
              <li>Öffne rechts oben im Shop das <strong>Konto‑Panel</strong>.</li>
              <li>Teste Eingaben, die die WHERE‑Bedingung verändern.</li>
              <li>Ziel: Die Anwendung zeigt <strong>„Login erfolgreich“</strong>.</li>
            </ol>
            <div class="muted" style="margin-top:10px;">Wenn es klappt, bekommst du automatisch <strong>+10 Score</strong>.</div>
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
        'Diese Zusatzaufgabe wird ab 70% Fortschritt freigeschaltet.'
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
          <div class="spicker-block-title">Login‑Abfrage</div>
          <p style="margin:6px 0 0 0;">Die Anmeldung läuft über die Tabelle <strong>users</strong>. Schema:</p>
          <div style="overflow:auto; -webkit-overflow-scrolling: touch;">
            <table class="spicker-table spicker-table-compact" aria-label="Schema users">
              <thead>
                <tr><th>Spalte</th><th>Typ</th><th>Hinweis</th></tr>
              </thead>
              <tbody>
                <tr><td>id</td><td>INTEGER</td><td>Primary Key</td></tr>
                <tr><td>username</td><td>TEXT</td><td>eindeutig</td></tr>
                <tr><td>password</td><td>TEXT</td><td>Passwort</td></tr>
                <tr><td>role</td><td>TEXT</td><td>z. B. admin/user</td></tr>
                <tr><td>status</td><td>TEXT</td><td>active/locked</td></tr>
                <tr><td>created_at</td><td>DATETIME</td><td>Erstellung</td></tr>
                <tr><td>last_login</td><td>DATETIME</td><td>letzter Login</td></tr>
              </tbody>
            </table>
          </div>
          <p class="muted" style="margin:4px 0 8px 0;">Hierfür wird die folgende Abfrage genutzt:</p>
          <pre class="output" style="white-space:pre-wrap; margin-top:0;">SELECT id, username, role
FROM users
WHERE username = '<span class="muted">EINGABE_USER</span>'
  AND password = '<span class="muted">EINGABE_PASS</span>'
LIMIT 1;</pre>
        </div>

        <div class="spicker-block">
          <div class="spicker-block-title">Aufgabenstellung</div>
          <ol type="a" style="margin:6px 0 0 18px;">
            <li>Versuche dich <strong>in den Login einzuloggen, ohne das Passwort zu kennen</strong>. Öffne dafür rechts oben im Shop das <strong>Konto‑Panel</strong> und teste Eingaben, die die WHERE‑Bedingung verändern.</li>
            <li>Recherchiere im Internet, <strong>wie man sich vor SQL‑Injection schützt</strong>, und schreibe deine Gedanken stichpunktartig auf.</li>
          </ol>
          <div class="muted" style="margin-top:8px;">Ziel: Die Anwendung zeigt <strong>„Login erfolgreich“</strong>. Wenn es klappt, bekommst du automatisch <strong>+10 Score</strong>.</div>
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
    try {
      this.sqlEditorEl?.focus();
      this.setSqlEditorCaretOffset(this.sqlEl?.value?.length || 0);
    } catch (_) {}
  }

async lockAllShopTasks(locked) {
  const ids = ALL_TASK_IDS;
  for (const id of ids) {
    await this.shop.lock(id, locked);
  }
}

async syncTaskMetaToShop() {
  const tasks = {};
  Object.entries(this.TASKS || {}).forEach(([id, task]) => {
    const level = this.getDifficultyLevel(task?.difficulty);
    tasks[id] = {
      difficulty: String(task?.difficulty || "+"),
      difficultyLevel: level
    };
  });
  await this.shop.setTaskMeta(tasks);
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
    this.sqlEditorEl?.setAttribute('contenteditable', isUnlocked ? 'false' : 'true');
    this.sqlEditorEl?.setAttribute('aria-readonly', isUnlocked ? 'true' : 'false');
    this.runBtn.disabled = isUnlocked;
    this.runBtn.style.cursor = isUnlocked ? 'not-allowed' : 'pointer';
    this.runBtn.style.opacity = isUnlocked ? '.6' : '1';

    this.setSqlEditorValue('');
    this.updateSqlGutter();
    this.syncGutterScroll();
    this.updateSqlEditorAssist();
        this.setOutput(isUnlocked ? 'Bereits freigeschaltet.' : '');
    this.resetResultTable();

    this.resetUnlockButton();

    // View
    this.setEmptyState(false);
    // Auto-collapse header when a task opens (can be expanded manually)
    this.setHeaderCollapsed(true, { persist: true });
    this.refreshHintCards();
    if (this.spickerViewEl) this.spickerViewEl.style.display = 'none';

    // UX: Fokus direkt in Editor
    try {
      this.sqlEditorEl?.focus();
      this.setSqlEditorCaretOffset(this.sqlEl?.value?.length || 0);
    } catch (_) {}
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

  resetResultTable() {
    this.lastExecutableResult = null;
    if (this.resultTableBtn) {
      this.resultTableBtn.disabled = true;
      this.resultTableBtn.setAttribute('aria-disabled', 'true');
      this.resultTableBtn.textContent = 'Ergebnistabelle anzeigen';
    }
    if (this.resultTableCardEl) {
      this.resultTableCardEl.style.display = 'none';
      this.resultTableCardEl.setAttribute('aria-hidden', 'true');
    }
    if (this.resultTableContentEl) this.resultTableContentEl.innerHTML = '';
  }

  setResultTableAvailable(result) {
    this.lastExecutableResult = Array.isArray(result) ? result : [];
    if (this.resultTableBtn) {
      this.resultTableBtn.disabled = false;
      this.resultTableBtn.setAttribute('aria-disabled', 'false');
    }
    if (this.isResultTableVisible()) {
      this.renderResultTable();
    }
  }

  isResultTableVisible() {
    return !!this.resultTableCardEl && this.resultTableCardEl.style.display !== 'none';
  }

  toggleResultTable() {
    if (!this.resultTableBtn || this.resultTableBtn.disabled || !this.resultTableCardEl) return;
    const show = !this.isResultTableVisible();
    this.resultTableCardEl.style.display = show ? '' : 'none';
    this.resultTableCardEl.setAttribute('aria-hidden', show ? 'false' : 'true');
    this.resultTableBtn.textContent = show ? 'Ergebnistabelle ausblenden' : 'Ergebnistabelle anzeigen';
    if (show) {
      this.renderResultTable();
      try { this.resultTableCardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
    }
  }

  renderResultTable() {
    if (!this.resultTableContentEl) return;
    const resultSets = Array.isArray(this.lastExecutableResult) ? this.lastExecutableResult : [];
    if (!resultSets.length) {
      this.resultTableContentEl.innerHTML = '<div class="task3-resultEmpty">Die Abfrage wurde ausgeführt, liefert aber keine Ergebnistabelle.</div>';
      return;
    }

    const html = resultSets.map((res, idx) => {
      const columns = Array.isArray(res?.columns) ? res.columns : [];
      const values = Array.isArray(res?.values) ? res.values : [];
      if (!columns.length) {
        return '<div class="task3-resultEmpty">Keine Spalten in diesem Ergebnis.</div>';
      }
      const head = columns.map((c) => `<th scope="col">${this.escapeHtml(c)}</th>`).join('');
      const body = values.length
        ? values.map((row) => {
            const cells = columns.map((_, i) => `<td>${this.formatResultCell(row?.[i])}</td>`).join('');
            return `<tr>${cells}</tr>`;
          }).join('')
        : `<tr><td colspan="${columns.length}"><span class="muted">Keine Zeilen.</span></td></tr>`;
      const label = resultSets.length > 1 ? `<div class="task3-resultSetLabel">Ergebnis ${idx + 1}</div>` : '';
      return `
        ${label}
        <div class="task3-resultScroller">
          <table class="task3-resultTable">
            <thead><tr>${head}</tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      `;
    }).join('');

    this.resultTableContentEl.innerHTML = html;
  }

  formatResultCell(value) {
    if (value === null || value === undefined) return '<span class="task3-null">NULL</span>';
    if (typeof value === 'number') return this.escapeHtml(Number.isFinite(value) ? String(value) : String(value));
    return this.escapeHtml(String(value));
  }

  scrollToOutput() {
    if (!this.outEl) return;
    try {
      this.outEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (_) {}
  }

  getFeedbackMessage(type, detail) {
    switch (type) {
      case "empty":
        return "Keine Abfrage eingegeben.";
      case "not-select":
        return "Nur SELECT-Abfragen sind erlaubt.";
      case "syntax":
        return `Syntaxfehler:\n${detail || ""}`;
      case "structure":
        return "Strukturfehler:\nDie Ergebnisstruktur passt noch nicht.";
      case "logic":
        return "Logikfehler:\nDie Abfrage liefert noch nicht das erwartete Ergebnis.";
      case "correct":
        return "Richtig. Du kannst freischalten.";
      default:
        return "Logikfehler:\nDie Abfrage liefert noch nicht das erwartete Ergebnis.";
    }
  }

  hasResultStructureMismatch(studentExec, refExec, mode) {
    if (!(mode === 'rows_order' || mode === 'rows_set' || mode === 'order' || mode === 'set')) {
      return false;
    }

    const studentRows = this.extractRows(studentExec);
    const refRows = this.extractRows(refExec);
    if (!studentRows.ok || !refRows.ok) return false;
    return studentRows.colCount !== refRows.colCount;
  }


  checkCurrent() {
    this.syncSqlEditorValue();
    const resultTableWasVisible = this.isResultTableVisible();
    this.setOutput("");
    this.resetUnlockButton();
    this.resetResultTable();

    const finish = (msg) => {
      this.setOutput(msg);
      this.scrollToOutput();
    };

    const taskId = this.currentId;
    if (!taskId) {
      finish(this.getFeedbackMessage("logic"));
      return;
    }

    const sql = (this.sqlEl.value || "").trim();
    const t = this.TASKS[taskId];

    let result = "error";
    let errorType = null;

    if (!this.db) {
      finish(this.getFeedbackMessage("logic"));
      errorType = "runtime";
      return;
    }

    if (!sql) {
      finish(this.getFeedbackMessage("empty"));
      result = "wrong";
      errorType = "logic";
      return;
    }

    if (!this.isSelectOnly(sql)) {
      finish(this.getFeedbackMessage("not-select"));
      result = "wrong";
      errorType = "logic";
      return;
    }

    let studentRes, refRes;
    try {
      studentRes = this.db.exec(sql);
    } catch (e) {
      finish(this.getFeedbackMessage("syntax", e.message));
      errorType = "syntax";
      return;
    }
    this.setResultTableAvailable(studentRes);
    if (resultTableWasVisible && this.resultTableCardEl) {
      this.resultTableCardEl.style.display = '';
      this.resultTableCardEl.setAttribute('aria-hidden', 'false');
      if (this.resultTableBtn) this.resultTableBtn.textContent = 'Ergebnistabelle ausblenden';
      this.renderResultTable();
    }

    try {
      refRes = this.db.exec(t.refSql);
    } catch (e) {
      finish(this.getFeedbackMessage("logic"));
      errorType = "runtime";
      return;
    }

    const sqlCheck = this.validateSqlStructure(sql, t);
    const ok = !!(sqlCheck.ok && this.validate(studentRes, refRes, t.mode));

    if (ok) {
      result = "correct";
      if (this.unlocked[taskId]) {
        finish(this.getFeedbackMessage("correct"));
        return;
      }
      finish(this.getFeedbackMessage("correct"));
      this.setUnlockState(true);
      return;
    }

    if (sqlCheck.ok && this.hasResultStructureMismatch(studentRes, refRes, t.mode)) {
      finish(this.getFeedbackMessage("structure"));
    } else {
      finish(this.getFeedbackMessage("logic"));
    }
    result = "wrong";
    errorType = "logic";
  }


  onSqlEdited() {
        // Sobald der User den Editor ändert: Freischalten wieder sperren,
    // bis erneut „Prüfen“ erfolgreich war.
    if (!this.unlockBtn) return;
    if (this.unlocked?.[this.currentId]) return; // bereits freigeschaltet

    this.resetUnlockButton();

    const finish = (msg) => {
      this.setOutput(msg);
      this.scrollToOutput();
    };
  }

  updateSqlGutter() {
    if (!this.sqlGutterEl || !this.sqlEl) return;
    const logicalLines = Math.max(1, this.sqlEl.value.split("\n").length);
    let visualLines = logicalLines;
    if (this.sqlEditorEl) {
      const cs = window.getComputedStyle(this.sqlEditorEl);
      const lineHeight = Number.parseFloat(cs.lineHeight) || 1;
      const paddingTop = Number.parseFloat(cs.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(cs.paddingBottom) || 0;
      const contentHeight = Math.max(0, this.sqlEditorEl.scrollHeight - paddingTop - paddingBottom);
      visualLines = Math.max(logicalLines, Math.ceil(contentHeight / lineHeight));
    }
    const lines = Math.max(1, visualLines);
    let out = "";
    for (let i = 1; i <= lines; i++) out += i + (i === lines ? "" : "\n");
    this.sqlGutterEl.textContent = out;
  }

  syncGutterScroll() {
    if (!this.sqlGutterEl || !this.sqlEditorEl) return;
    this.sqlGutterEl.scrollTop = this.sqlEditorEl.scrollTop;
  }

  updateSqlEditorAssist() {
    this.updateSqlAutocomplete();
    this.renderSqlDiagnostics();
    this.renderSqlEditor();
  }

  getSqlEditorText() {
    if (!this.sqlEditorEl) return this.sqlEl?.value || '';
    const clone = this.sqlEditorEl.cloneNode(true);
    clone.querySelectorAll('[data-ghost="true"]').forEach((n) => n.remove());
    clone.querySelectorAll('[data-editor-tail="true"]').forEach((n) => n.remove());
    return (clone.textContent || '').replace(/\u00a0/g, ' ');
  }

  syncSqlEditorValue() {
    if (!this.sqlEl) return;
    this.sqlEl.value = this.getSqlEditorText();
  }

  applySqlEditorValue(value, caretOffset, { suggest = true } = {}) {
    if (!this.sqlEl) return;
    this.sqlEl.value = String(value ?? '');
    this.onSqlEdited();
    this.resetResultTable();
    this.updateSqlGutter();
    this.hideSqlAutocomplete();
    this.renderSqlDiagnostics();
    this.renderSqlEditor({ force: true });
    this.setSqlEditorCaretOffset(caretOffset);
    if (suggest) {
      this.updateSqlAutocomplete();
      this.renderSqlEditor({ force: true });
      this.setSqlEditorCaretOffset(caretOffset);
    }
  }

  setSqlEditorValue(value) {
    const text = String(value ?? '');
    if (this.sqlEl) this.sqlEl.value = text;
    if (this.sqlEditorEl) {
      this.sqlEditorEl.textContent = text;
      this.renderSqlEditor({ force: true });
    }
  }

  getSqlEditorCaretOffset() {
    if (!this.sqlEditorEl) return 0;
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0) return this.getSqlEditorText().length;
    const range = sel.getRangeAt(0);
    if (!this.sqlEditorEl.contains(range.startContainer)) return this.getSqlEditorText().length;

    let offset = 0;
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.parentElement?.closest?.('[data-ghost="true"],[data-editor-tail="true"]')) return true;
        if (node === range.startContainer) {
          offset += Math.min(range.startOffset, node.nodeValue.length);
          return false;
        }
        offset += node.nodeValue.length;
        return true;
      }
      if (node === range.startContainer) {
        const children = Array.from(node.childNodes).slice(0, range.startOffset);
        for (const child of children) {
          if (!walk(child)) return false;
        }
        return false;
      }
      for (const child of Array.from(node.childNodes || [])) {
        if (!walk(child)) return false;
      }
      return true;
    };
    walk(this.sqlEditorEl);
    return offset;
  }

  getSqlEditorSelectionOffsets() {
    if (!this.sqlEditorEl) return null;
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    if (!this.sqlEditorEl.contains(range.startContainer) || !this.sqlEditorEl.contains(range.endContainer)) return null;
    const start = this.getSqlEditorOffsetForPoint(range.startContainer, range.startOffset);
    const end = this.getSqlEditorOffsetForPoint(range.endContainer, range.endOffset);
    return { start: Math.min(start, end), end: Math.max(start, end) };
  }

  getSqlEditorOffsetForPoint(targetNode, targetOffset) {
    if (!this.sqlEditorEl) return 0;
    let offset = 0;
    let found = false;
    const walk = (node) => {
      if (found) return false;
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.parentElement?.closest?.('[data-ghost="true"],[data-editor-tail="true"]')) return true;
        if (node === targetNode) {
          offset += Math.min(targetOffset, node.nodeValue.length);
          found = true;
          return false;
        }
        offset += node.nodeValue.length;
        return true;
      }
      if (node === targetNode) {
        const children = Array.from(node.childNodes).slice(0, targetOffset);
        for (const child of children) this.addSqlEditorNodeTextLength(child, (n) => { offset += n; });
        found = true;
        return false;
      }
      for (const child of Array.from(node.childNodes || [])) {
        if (!walk(child)) return false;
      }
      return true;
    };
    walk(this.sqlEditorEl);
    return offset;
  }

  addSqlEditorNodeTextLength(node, add) {
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.parentElement?.closest?.('[data-ghost="true"],[data-editor-tail="true"]')) {
        add(node.nodeValue.length);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.closest?.('[data-ghost="true"],[data-editor-tail="true"]')) return;
    for (const child of Array.from(node.childNodes || [])) this.addSqlEditorNodeTextLength(child, add);
  }

  setSqlEditorCaretOffset(offset) {
    if (!this.sqlEditorEl) return;
    const target = Math.max(0, Number(offset) || 0);
    const range = document.createRange();
    const sel = window.getSelection?.();
    let remaining = target;
    let placed = false;

    const walker = document.createTreeWalker(this.sqlEditorEl, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => node.parentElement?.closest?.('[data-ghost="true"]')
        || node.parentElement?.closest?.('[data-editor-tail="true"]')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
    });

    let node;
    let last = null;
    while ((node = walker.nextNode())) {
      last = node;
      const len = node.nodeValue.length;
      if (remaining <= len) {
        range.setStart(node, remaining);
        placed = true;
        break;
      }
      remaining -= len;
    }

    if (!placed) {
      if (last) range.setStart(last, last.nodeValue.length);
      else range.setStart(this.sqlEditorEl, 0);
    }
    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  getSqlSchemaInfo() {
    const fallback = {
      produkte: ['id', 'name', 'preis', 'kategorie_id', 'lagerbestand', 'liefertage'],
      kategorien: ['id', 'name'],
      bewertungen: ['id', 'produkt_id', 'sterne'],
      'verkäufe': ['id', 'produkt_id', 'nutzer_id', 'anzahl'],
      warenkorb: ['produkt_id', 'menge', 'nutzer_id']
    };
    const schema = {};
    if (this.db) {
      try {
        const tables = this.listSchemaTables?.() || [];
        for (const table of tables) {
          const q = this.quoteIdent(table);
          const res = this.db.exec(`PRAGMA table_info(${q});`);
          const cols = res?.[0]?.values?.map((r) => String(r?.[1] || '').toLowerCase()).filter(Boolean) || [];
          if (cols.length) schema[String(table).toLowerCase()] = cols;
        }
      } catch (_) {}
    }
    return Object.keys(schema).length ? schema : fallback;
  }

  analyzeSqlForEditor(sql) {
    const text = String(sql || '');
    const schema = this.getSqlSchemaInfo();
    const tables = new Set(Object.keys(schema));
    const allColumns = new Set(Object.values(schema).flat());
    const keywords = new Set([
      'select','from','where','and','or','not','order','by','group','having','limit','asc','desc',
      'distinct','as','join','inner','left','right','on','in','between','like','is','null',
      'sum','avg','min','max','count'
    ]);
    const diagnostics = [];
    const badRanges = [];
    const aliases = new Map();

    const cleaned = this.stripSqlLiterals(this.stripSqlComments(text)).toLowerCase();
    const fromJoinRe = /\b(?:from|join)\s+([a-z_äöüß][\wäöüß]*)(?:\s+(?:as\s+)?([a-z_äöüß][\wäöüß]*))?/gi;
    let m;
    while ((m = fromJoinRe.exec(cleaned)) !== null) {
      const table = String(m[1] || '').toLowerCase();
      const alias = String(m[2] || '').toLowerCase();
      if (tables.has(table)) {
        aliases.set(table, table);
        if (alias && !keywords.has(alias) && alias !== 'where' && alias !== 'join' && alias !== 'on') aliases.set(alias, table);
      }
    }

    const markFirst = (needle, message) => {
      if (!needle) return;
      const re = new RegExp(`\\b${this.escapeRegExp(needle)}\\b`, 'i');
      const match = text.match(re);
      if (match && typeof match.index === 'number') {
        badRanges.push({ start: match.index, end: match.index + match[0].length });
      }
      diagnostics.push(message);
    };

    const tableRefRe = /\b(?:from|join)\s+([a-z_äöüß][\wäöüß]*)/gi;
    while ((m = tableRefRe.exec(cleaned)) !== null) {
      const table = String(m[1] || '').toLowerCase();
      if (table && !tables.has(table)) markFirst(table, `Unbekannte Tabelle: ${table}`);
    }

    const qualifiedRe = /\b([a-z_äöüß][\wäöüß]*)\.([a-z_äöüß][\wäöüß]*)\b/gi;
    while ((m = qualifiedRe.exec(cleaned)) !== null) {
      const prefix = String(m[1] || '').toLowerCase();
      const col = String(m[2] || '').toLowerCase();
      const table = aliases.get(prefix) || (tables.has(prefix) ? prefix : '');
      if (!table) {
        continue;
      } else if (!schema[table]?.includes(col)) {
        markFirst(col, `Unbekannte Spalte für ${prefix}: ${col}`);
      }
    }

    const knownFunctions = new Set(['sum','avg','min','max','count']);
    const selectMatch = cleaned.match(/\bselect\s+([\s\S]*?)\bfrom\b/i);
    if (selectMatch) {
      const selectPart = selectMatch[1] || '';
      const items = selectPart.split(',');
      for (const itemRaw of items) {
        const item = itemRaw.replace(/\bas\s+[a-z_äöüß][\wäöüß]*\b/gi, ' ').trim();
        if (!item || item === '*' || item.includes('.')) continue;
        const fnMatch = item.match(/\b(?:sum|avg|min|max|count)\s*\(\s*([a-z_äöüß][\wäöüß]*)\s*\)/i);
        const bareMatch = item.match(/^([a-z_äöüß][\wäöüß]*)(?:\s+[a-z_äöüß][\wäöüß]*)?$/i);
        const token = (fnMatch?.[1] || bareMatch?.[1] || '').toLowerCase();
        if (!token || keywords.has(token) || knownFunctions.has(token)) continue;
        if (tables.has(token) || aliases.has(token)) continue;
        if (!allColumns.has(token)) markFirst(token, `Möglicherweise unbekannte Spalte: ${token}`);
      }
    }

    return { badRanges, diagnostics: [...new Set(diagnostics)].slice(0, 3), schema, keywords };
  }

  renderSqlEditor({ force = false } = {}) {
    if (!this.sqlEditorEl || !this.sqlEl) return;
    const hadFocus = document.activeElement === this.sqlEditorEl;
    if (!force && hadFocus && this.hasSqlEditorSelection()) return;
    const caret = hadFocus ? this.getSqlEditorCaretOffset() : 0;
    const text = this.sqlEl.value || '';
    const analysis = this.analyzeSqlForEditor(text);
    const ranges = analysis.badRanges || [];
    const inlineSuggestion = this.sqlAutocompleteSuggestion;
    const tokenRe = /(--.*$|\/\*[\s\S]*?\*\/|'(?:[^']|'')*'|"(?:[^"]|"")*"|\b\d+(?:\.\d+)?\b|\b[a-z_äöüß][\wäöüß]*\b|[^\wäöüß]+)/gim;
    let html = '';
    let pos = 0;
    const classFor = (value, start, end) => {
      const lower = value.toLowerCase();
      const classes = [];
      if (/^--|^\/\*/.test(value)) classes.push('tok-comment');
      else if (/^'/.test(value)) classes.push('tok-string');
      else if (/^\d/.test(value)) classes.push('tok-number');
      else if (analysis.keywords?.has(lower)) classes.push('tok-keyword');
      if (ranges.some((r) => start < r.end && end > r.start)) classes.push('tok-error');
      return classes.join(' ');
    };

    let m;
    while ((m = tokenRe.exec(text)) !== null) {
      const value = m[0];
      const start = m.index;
      const end = start + value.length;
      if (start > pos) html += this.escapeHtml(text.slice(pos, start));
      const cls = classFor(value, start, end);
      html += cls ? `<span class="${cls}">${this.escapeHtml(value)}</span>` : this.escapeHtml(value);
      if (inlineSuggestion && end === inlineSuggestion.end && inlineSuggestion.value.toLowerCase().startsWith(value.toLowerCase())) {
        const suffix = inlineSuggestion.value.slice(value.length);
        if (suffix) html += `<span class="tok-ghost" data-ghost="true" contenteditable="false">${this.escapeHtml(suffix)}</span>`;
      }
      pos = end;
    }
    if (pos < text.length) html += this.escapeHtml(text.slice(pos));
    if (text.endsWith('\n')) html += '<span data-editor-tail="true" contenteditable="false">\u200b</span>';
    this.sqlEditorEl.innerHTML = html || '';
    this.sqlEditorEl.toggleAttribute('data-empty', !text);
    if (hadFocus) this.setSqlEditorCaretOffset(caret);
    this.updateSqlGutter();
  }

  hasSqlEditorSelection() {
    if (!this.sqlEditorEl) return false;
    const sel = window.getSelection?.();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    return this.sqlEditorEl.contains(range.startContainer) && this.sqlEditorEl.contains(range.endContainer);
  }

  renderSqlDiagnostics() {
    if (!this.sqlDiagnosticsEl || !this.sqlEl) return;
    const diagnostics = this.analyzeSqlForEditor(this.sqlEl.value || '').diagnostics || [];
    this.sqlDiagnosticsEl.innerHTML = diagnostics.length
      ? diagnostics.map((d) => `<span>${this.escapeHtml(d)}</span>`).join('')
      : '';
  }

  getCurrentSqlWord() {
    if (!this.sqlEditorEl || !this.sqlEl) return null;
    const pos = this.getSqlEditorCaretOffset();
    const text = this.sqlEl.value || '';
    const left = text.slice(0, pos);
    const match = left.match(/([a-zA-Z_äöüÄÖÜß][\wäöüÄÖÜß]*)$/);
    if (!match) return null;
    const word = match[1];
    return { word, start: pos - word.length, end: pos };
  }

  updateSqlAutocomplete() {
    if (!this.sqlEditorEl || document.activeElement !== this.sqlEditorEl) {
      this.hideSqlAutocomplete();
      return;
    }
    const current = this.getCurrentSqlWord();
    if (!current || current.word.length < 3) {
      this.hideSqlAutocomplete();
      return;
    }
    const schema = this.getSqlSchemaInfo();
    const options = [...Object.keys(schema), ...new Set(Object.values(schema).flat())]
      .filter((v) => v.toLowerCase().startsWith(current.word.toLowerCase()) && v.toLowerCase() !== current.word.toLowerCase())
      .sort((a, b) => a.length - b.length || a.localeCompare(b));
    const suggestion = options[0];
    if (!suggestion) {
      this.hideSqlAutocomplete();
      return;
    }
    this.sqlAutocompleteSuggestion = { ...current, value: suggestion };
  }

  hideSqlAutocomplete() {
    this.sqlAutocompleteSuggestion = null;
  }

  deleteSqlEditorSelection(selection) {
    if (!selection || selection.end <= selection.start) return false;
    this.syncSqlEditorValue();
    const text = this.sqlEl?.value || '';
    this.applySqlEditorValue(text.slice(0, selection.start) + text.slice(selection.end), selection.start, { suggest: false });
    return true;
  }

  handleSqlEditorKeydown(e) {
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.sqlEditorEl) {
      const selection = this.getSqlEditorSelectionOffsets();
      if (this.deleteSqlEditorSelection(selection)) {
        e.preventDefault();
        return;
      }
    }
    if (e.key === 'Enter' && this.sqlEditorEl) {
      e.preventDefault();
      this.insertSqlEditorText('\n', { suggest: false });
      return;
    }
    if (e.key !== 'Tab' || !this.sqlAutocompleteSuggestion || !this.sqlEl) return;
    const s = this.sqlAutocompleteSuggestion;
    const current = this.getCurrentSqlWord();
    if (!current || current.start !== s.start || current.end !== s.end) return;
    e.preventDefault();
    const text = this.sqlEl.value || '';
    const caret = s.start + s.value.length;
    this.applySqlEditorValue(text.slice(0, s.start) + s.value + text.slice(s.end), caret, { suggest: false });
  }

  handleSqlEditorBeforeInput(e) {
    if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') {
      e.preventDefault();
      this.insertSqlEditorText('\n', { suggest: false });
      return;
    }

    if (e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') {
      const selection = this.getSqlEditorSelectionOffsets();
      if (!selection || selection.end <= selection.start) return;
      e.preventDefault();
      this.deleteSqlEditorSelection(selection);
    }
  }

  insertSqlEditorText(insertText, { suggest = false } = {}) {
    const selection = this.getSqlEditorSelectionOffsets();
    const start = selection ? selection.start : this.getSqlEditorCaretOffset();
    const end = selection ? selection.end : start;
    const insert = String(insertText || '');
    this.syncSqlEditorValue();
    const current = this.sqlEl?.value || '';
    this.applySqlEditorValue(current.slice(0, start) + insert + current.slice(end), start + insert.length, { suggest });
  }

  handleSqlEditorPaste(e) {
    if (!this.sqlEditorEl) return;
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    this.insertSqlEditorText(text, { suggest: false });
  }

  pulseShopAction(taskId) {
    const id = (taskId || "").toString().trim();
    if (!id) return;
    this.shop?.pulse?.(id);
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
        this.setSqlEditorValue(data.sql);
        this.onSqlEdited();
        this.updateSqlGutter();
        this.syncGutterScroll();
        this.updateSqlEditorAssist();
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
    this.pulseShopAction(id);

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

  /* ---------- Codegerüst-System ---------- */

  requestSpicker() {
    this.openSpicker();
  }

  requestHint() {
    this.closeHintOverlay();
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
      `Wenn du dir das Codeger\u00fcst anzeigen lässt, verlierst du 1 Score-Punkt.
 Aktueller Score: ${score}.

 Wenn du fortf\u00e4hrst, wird dein Score um 1 reduziert und du siehst das Ger\u00fcst f\u00fcr diese Aufgabe dauerhaft.`;
    this.openScaffoldCard(msg, { mode: 'confirm', title: 'Codeger\u00fcst anzeigen?', confirmLabel: 'Codeger\u00fcst anzeigen (-1)' });
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
    this._pendingHintTaskId = null;
    this.closeHintOverlay();
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
    this.closeHintOverlay();
  }

  closeHintOverlay() {
    this._pendingHintTaskId = null;
    if (!this.hintCardEl || !this.hintTextEl) return;
    this.hintCardEl.classList.remove('show', 'open');
    this.hintTextEl.textContent = '';

    if (this.hintConfirmBtn) this.hintConfirmBtn.style.display = 'none';
    if (this.hintTitleEl) this.hintTitleEl.textContent = 'Hinweis';
  }

  openScaffoldCard(text, opts = {}) {
    if (!this.scaffoldCardEl || !this.scaffoldTextEl) return;

    const mode = (opts && opts.mode) ? String(opts.mode) : 'hint';
    const isConfirm = mode === 'confirm';
    const title = (opts && opts.title) ? String(opts.title) : (isConfirm ? 'Codeger\u00fcst anzeigen?' : 'Codeger\u00fcst');
    const confirmLabel = (opts && opts.confirmLabel) ? String(opts.confirmLabel) : 'Codeger\u00fcst anzeigen (-1)';

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

  // Backwards-compat hook (alte API), im freien Modus ohne sichtbare Ausgabe.
  showTaskHint(text) { this.closeHintOverlay(); }
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

    this.closeHintOverlay();

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
        "all": "Es wird nur eine Tabelle ben\u00f6tigt. W\u00e4hle alle Spalten ohne Filterbedingungen aus.",
        "express": "Arbeite nur mit der Tabelle produkte und filtere über eine Gleichheitsbedingung auf das Attribut liefertage.",
        "bestseller": "Beachte die 1:n-Beziehung zwischen produkte und verk\u00e4ufe. Verkn\u00fcpfe beide Tabellen \u00fcber die Produkt-ID, gruppiere die Ergebnisse mit GROUP BY pro Produkt, berechne die Summe der Verkaufsanzahl und filtere die aggregierten Werte anschlie\u00dfend mit HAVING.",
        "available": "Arbeite nur mit der Tabelle produkte und filtere \u00fcber zwei Vergleichsbedingungen auf das Attribut lagerbestand, um einen Wertebereich einzugrenzen.",
        "priceAsc": "W\u00e4hle alle Spalten aus und nutze ORDER BY auf dem Attribut preis. Verwende eine aufsteigende Sortierung.",
        "priceDesc": "W\u00e4hle alle Spalten aus und nutze ORDER BY auf dem Attribut preis. Verwende eine absteigende Sortierung (DESC).",
        "popularity": "Arbeite nur mit verk\u00e4ufe. Addiere die Werte mit SUM(). Damit die Summe pro Produkt berechnet wird, musst du nach produkt_id gruppieren (GROUP BY). Speichere die berechnete Summe in einem Alias und sortiere danach mit ORDER BY. Ohne GROUP BY erh\u00e4ltst du nur eine Gesamtsumme statt eine pro Produkt.",
      "cat-electronics": "Verbinde produkte und kategorien \u00fcber die Kategorie-ID, filtere nach dem Kategorienamen und gib nur die Spalten aus produkte zur\u00fcck (produkte.*).",
      "cat-household": "Verbinde produkte und kategorien \u00fcber die Kategorie-ID, filtere nach dem Kategorienamen und gib nur die Spalten aus produkte zur\u00fcck (produkte.*).",
      "cat-sport": "Verbinde produkte und kategorien \u00fcber die Kategorie-ID, filtere nach dem Kategorienamen und gib nur die Spalten aus produkte zur\u00fcck (produkte.*).",
        "price-25": "Arbeite nur mit der Tabelle produkte, filtere über eine Bedingung auf preis und gib alle Spalten mit * aus.",
        "price-50": "Arbeite nur mit der Tabelle produkte, filtere über eine Bedingung auf preis und gib alle Spalten mit * aus.",
        "price-100": "Arbeite nur mit der Tabelle produkte, filtere über eine Bedingung auf preis und gib alle Spalten mit * aus.",
        "rating-5": "Beachte die 1:n-Beziehung: Ein Produkt kann mehrere Bewertungen besitzen. Verkn\u00fcpfe produkte mit bewertungen \u00fcber die Produkt-ID, filtere auf sterne = 5 und verwende DISTINCT, damit jedes Produkt nur einmal erscheint.",
        "rating-4": "Beachte die 1:n-Beziehung: Ein Produkt kann mehrere Bewertungen besitzen. Verkn\u00fcpfe produkte mit bewertungen \u00fcber die Produkt-ID, filtere auf sterne >= 4 und verwende DISTINCT, damit jedes Produkt nur einmal erscheint.",
        "cart-refresh": "Der Warenkorb enthält nur Produkt-IDs und Mengen, die Produktdaten stehen in produkte. Verkn\u00fcpfe daher beide Tabellen \u00fcber produkte.id = warenkorb.produkt_id. W\u00e4hle name, preis und menge explizit aus, berechne zus\u00e4tzlich preis * menge als neue Spalte und sortiere das Ergebnis mit ORDER BY name ASC. Ein SELECT * ist hier nicht geeignet, da nur bestimmte Spalten ben\u00f6tigt werden.",
        "cart-total": "Die Preise stehen in produkte, die Mengen im warenkorb. Verkn\u00fcpfe beide Tabellen \u00fcber die Produkt-ID (1:n-Beziehung), berechne f\u00fcr jede Zeile preis * menge und fasse alle Werte mit der Aggregatfunktion SUM zu genau einem Ergebnis zusammen. Es soll nur eine einzelne Zahl zur\u00fcckgegeben werden, keine einzelnen Produkte.",
        "orders": "Verkn\u00fcpfe produkte und verk\u00e4ufe \u00fcber die Produkt-ID (1:n-Beziehung). Filtere anschlie\u00dfend nach nutzer_id = 1. Berechne den Gesamtpreis durch Multiplikation von preis und anzahl, sortiere mit ORDER BY absteigend nach der Verkaufs-ID und begrenze die Ausgabe mit LIMIT auf drei Zeilen.",
        "topProducts": "Verkn\u00fcpfe produkte und verk\u00e4ufe \u00fcber die Produkt-ID (1:n-Beziehung). Addiere die Verkaufszahlen mit SUM(anzahl), gruppiere pro Produkt mit GROUP BY, speichere die Summe in einem Alias und sortiere anschlie\u00dfend absteigend nach diesem Wert. Begrenze die Ausgabe mit LIMIT auf zwei Zeilen.",
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
    FROM ____
    WHERE ____ LIKE ____;`,
      "all":
    `SELECT ____
    FROM ____;`,
      "express":
    `SELECT ____
    FROM ____
    WHERE ____ = ____;`,
      "bestseller":
  `SELECT produkte.____
  FROM produkte, verk\u00e4ufe
  WHERE ____ = ____
  GROUP BY ____
  HAVING SUM(____) > ____;`,
      "available":
    `SELECT ____
    FROM ____
    WHERE ____ >= ____
    AND ____ <= ____;`,
      "priceAsc":
    `SELECT ____
    FROM ____
    ORDER BY ____ ____;`,
      "priceDesc":
    `SELECT ____
    FROM ____
    ORDER BY ____ ____;`,
      "popularity":
    `SELECT ____, SUM(____) AS ____
    FROM ____
    GROUP BY ____
    ORDER BY ____ ____;`,
      "cat-electronics":
  `SELECT produkte.*
      FROM ____, ____
      WHERE ____ = ____
      AND ____ = ____;`,
      "cat-household":
  `SELECT produkte.*
      FROM ____, ____
      WHERE ____ = ____
      AND ____ = ____;`,
      "cat-sport":
  `SELECT produkte.*
      FROM ____, ____
      WHERE ____ = ____
      AND ____ = ____;`,
      "price-25":
  `SELECT *
      FROM ____
      WHERE ____ < ____;`,
      "price-50":
  `SELECT *
      FROM ____
      WHERE ____ >= ____ AND ____ <= ____;`,
      "price-100":
  `SELECT *
      FROM ____
      WHERE ____ >= ____ AND ____ <= ____;`,
      "rating-5":
  `SELECT DISTINCT produkte.*
    FROM ____, ____
    WHERE ____ = ____
    AND ____ = ____;`,
      "rating-4":
  `SELECT DISTINCT produkte.*
    FROM ____, ____
    WHERE ____ = ____
    AND ____ >= ____;`,
          "cart-refresh":
      `SELECT ______, ______, ______, ______ * ______
  FROM ______ , ______
  WHERE ______ = ______
      ORDER BY ______ ___`,
      "cart-total":
      `SELECT SUM(______ * ______)
      FROM ______ , ______
      WHERE ______ = ______;`,
      "orders":
    `SELECT ____, ____, ____ * ____
    FROM ____ p, ____ v
    WHERE ____ = ____
    AND ____ = ____
    ORDER BY ____ ____
    LIMIT ____;`,
      "topProducts":
      `SELECT ______, SUM(______) AS ______
      FROM ______ , ______
      WHERE ______ = ______
      GROUP BY ______
      ORDER BY ______ ____
      LIMIT ______;`
    };

    if (S[taskId]) return S[taskId];

        return `SELECT ____
    FROM ____
    WHERE ____;`;
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
    const scaffolds = Object.keys(this.scaffoldUsed || {}).filter(k => !!this.scaffoldUsed[k]).length;
    const bonus = this.sqliDone ? 10 : 0;
    const scaffoldPenalty = scaffolds * 1;
    return Math.max(0, base + bonus - scaffoldPenalty);
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

    const score = this.computeScore();
    if (this.scoreEl) this.scoreEl.textContent = `Score ${score}`;
    // Bonus availability
    const canBonus = pct >= BONUS_MIN_PCT;
    if (this.btnBonus) {
      this.btnBonus.classList.toggle('btn-locked', !canBonus);
      this.btnBonus.setAttribute('aria-disabled', canBonus ? 'false' : 'true');
      this.btnBonus.title = canBonus ? 'Zusatzaufgabe: Hacking verfügbar' : `Ab ${BONUS_MIN_PCT}% Fortschritt verfügbar`;
    }
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
    const s = this.stripSqlLiterals(this.stripSqlComments(sql)).trim().toLowerCase();
    if (!/^select\b/.test(s)) return false;
    const forbidden = ["insert", "update", "delete", "drop", "alter", "create", "pragma", "attach", "detach"];
    return !new RegExp(`\\b(?:${forbidden.join("|")})\\b`).test(s);
  }

  stripSqlComments(sql) {
    const s = String(sql || "");
    const noBlock = s.replace(/\/\*[\s\S]*?\*\//g, "");
    return noBlock.replace(/--.*$/gm, "");
  }

  stripSqlLiterals(sql) {
    return String(sql || "")
      .replace(/'([^']|'')*'/g, "''")
      .replace(/"([^"]|"")*"/g, '""')
      .replace(/`([^`]|``)*`/g, "``");
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
    if (/^(['"]).*\1$/.test(p)) {
      const value = this.escapeRegExp(p.slice(1, -1));
      const quotedValueRe = new RegExp(`(?:'${value}'|"${value}")`);
      return quotedValueRe.test(norm.flat);
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





