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
  "open-cart",
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
    const keys = [
      "schulazon_name",
      "schulazon_unlocked_v1",
      "schulazon_hint_used_v1",
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

  // 4) 60-min countdown (session-persisted)
  const timerTag = document.getElementById("timerTag");
  const pillTimer = document.getElementById("pillTimer");
  if (pillTimer && timerTag) {
    pillTimer.style.display = "flex";

    let startedAt = Number(safeGet(sessionStorage, FREE_TIMER_KEY) || "");
    if (!Number.isFinite(startedAt) || startedAt <= 0) {
      startedAt = Date.now();
      safeSet(sessionStorage, FREE_TIMER_KEY, String(startedAt));
    }

    const tick = () => {
      const elapsedSec = (Date.now() - startedAt) / 1000;
      const remaining = FREE_TIMER_TOTAL_SEC - elapsedSec;
      timerTag.textContent = formatMMSS(remaining);
      if (remaining <= 0) {
        timerTag.textContent = "00:00";
        document.body.classList.add("timeup");
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
    // UI soll explizit bei x/21 bleiben.
    this.TOTAL_TASKS = 21;
    this.hintUsed = {};
    this.sqliDone = false;

    // gespeicherte Freischalt‑SQL pro Aufgabe
    this.solutionSql = {};


    // Aufgaben-Definitionen (auf data-task IDs gemappt)
    this.TASKS = this.buildTasks();

    // unlocked state (persistiert)
    this.unlocked = {};
    Object.keys(this.TASKS).forEach(id => this.unlocked[id] = false);
    this.loadProgressState();

    // Shop-Klicks -> Aufgabe auswählen
    this.shop.onShopAction((actionId) => this.onShopSelect(actionId));

    // SQLi-Bonus (Login erfolgreich)
    this.shop.onSqliSuccess?.(() => this.onSqliSuccess());

    this.currentId = null;
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


      const rawSolutions = localStorage.getItem('schulazon_solution_sql_v1');
      if (rawSolutions) {
        const data = JSON.parse(rawSolutions);
        if (data && typeof data === 'object') this.solutionSql = data;
      }

      this.sqliDone = localStorage.getItem('schulazon_sqli_done_v1') === 'true';
    } catch (_) {
      // ignore
    }
  }

  persistProgressState() {
    try {
      localStorage.setItem('schulazon_unlocked_v1', JSON.stringify(this.unlocked));
      localStorage.setItem('schulazon_hint_used_v1', JSON.stringify(this.hintUsed || {}));
      localStorage.setItem('schulazon_solution_sql_v1', JSON.stringify(this.solutionSql || {}));
      localStorage.setItem('schulazon_sqli_done_v1', this.sqliDone ? 'true' : 'false');
    } catch (_) {
      // ignore
    }
  }

  onSqliSuccess() {
    if (this.sqliDone) return;
    this.sqliDone = true;
    this.persistProgressState();
    this.updateProgressUI();
    this.showHint('SQL‑Injection geschafft: +10 Score.');
  }

  buildTasks() {
    return {

      "search": {
        title: "Produkte suchen",
        difficulty: "+++",
        task:
`Aufgabe:
Ein Nutzer gibt einen Suchbegriff ein. Der Suchbegriff steht als Platzhalter :q zur Verfügung.
Zeige alle Produkte, deren Name diesen Begriff enthält.
Gib alle Produktdaten aus.`,
        starter: "SELECT * FROM produkte WHERE name LIKE '%' || :q || '%';",
        refSql: "SELECT * FROM produkte WHERE name LIKE '%' || :q || '%';",
        mode: "set"
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
        mode: "set"
      },

      "express": {
        title: "Expresslieferung",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte, die bereits am nächsten Tag geliefert werden.
Gib alle Produktdaten aus.

Tipp: liefertage = 1`,
        starter: "SELECT * FROM produkte WHERE liefertage = 1;",
        refSql: "SELECT * FROM produkte WHERE liefertage = 1;",
        mode: "set"
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
`SELECT p.id
FROM produkte p, verkäufe v
WHERE p.id = v.produkt_id
GROUP BY p.id
HAVING SUM(v.anzahl) > 300;`,
        refSql:
`SELECT p.id
FROM produkte p, verkäufe v
WHERE p.id = v.produkt_id
GROUP BY p.id
HAVING SUM(v.anzahl) > 300;`,
        mode: "set"
      },

      "available": {
        title: "Nur noch wenige auf Lager",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte, von denen nur noch wenige Stück auf Lager sind.
Ein Produkt gilt als „nur noch wenige auf Lager“, wenn der Lagerbestand zwischen 1 und 5 Stück liegt.
Gib alle Produktdaten aus.`,
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
        mode: "set"
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
        mode: "order"
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
        mode: "order"
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
        mode: "order"
      },

      "cat-electronics": {
        title: "Kategorie Elektronik",
        difficulty: "++",
        task:
`Aufgabe:
Zeige alle Produkte, die zur Kategorie „Elektronik“ gehören.
Die Kategorie soll über ihren Namen bestimmt werden, nicht über eine ID.
Gib alle Produktdaten aus.`,
        starter:
`SELECT *
FROM produkte, kategorien
WHERE produkte.kategorie_id = kategorien.id
AND kategorien.name = 'Elektronik';`,
        refSql:
`SELECT *
FROM produkte, kategorien
WHERE produkte.kategorie_id = kategorien.id
AND kategorien.name = 'Elektronik';`,
        mode: "set"
      },

      "cat-household": {
        title: "Kategorie Haushalt",
        difficulty: "++",
        task:
`Aufgabe:
Zeige alle Produkte, die zur Kategorie „Haushalt“ gehören.
Die Kategorie soll über ihren Namen bestimmt werden.
Gib alle Produktdaten aus.`,
        starter:
`SELECT *
FROM produkte, kategorien
WHERE produkte.kategorie_id = kategorien.id
AND kategorien.name = 'Haushalt';`,
        refSql:
`SELECT *
FROM produkte, kategorien
WHERE produkte.kategorie_id = kategorien.id
AND kategorien.name = 'Haushalt';`,
        mode: "set"
      },

      "cat-sport": {
        title: "Kategorie Sport",
        difficulty: "++",
        task:
`Aufgabe:
Zeige alle Produkte, die zur Kategorie „Sport“ gehören.
Die Kategorie soll über ihren Namen bestimmt werden.
Gib alle Produktdaten aus.`,
        starter:
`SELECT *
FROM produkte, kategorien
WHERE produkte.kategorie_id = kategorien.id
AND kategorien.name = 'Sport';`,
        refSql:
`SELECT *
FROM produkte, kategorien
WHERE produkte.kategorie_id = kategorien.id
AND kategorien.name = 'Sport';`,
        mode: "set"
      },

      "price-25": {
        title: "Preis unter 25 €",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte, die weniger als 25 € kosten.
Gib alle Produktdaten aus.`,
        starter: "SELECT * FROM produkte WHERE preis < 25;",
        refSql: "SELECT * FROM produkte WHERE preis < 25;",
        mode: "set"
      },

      "price-50": {
        title: "Preis 25–50 €",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte, deren Preis zwischen 25 € und 50 € liegt.
Gib alle Produktdaten aus.`,
        starter: "SELECT * FROM produkte WHERE preis >= 25 AND preis <= 50;",
        refSql: "SELECT * FROM produkte WHERE preis >= 25 AND preis <= 50;",
        mode: "set"
      },

      "price-100": {
        title: "Preis 50–100 €",
        difficulty: "+",
        task:
`Aufgabe:
Zeige alle Produkte, deren Preis zwischen 50 € und 100 € liegt.
Gib alle Produktdaten aus.`,
        starter: "SELECT * FROM produkte WHERE preis >= 50 AND preis <= 100;",
        refSql: "SELECT * FROM produkte WHERE preis >= 50 AND preis <= 100;",
        mode: "set"
      },

      "rating-5": {
        title: "Bewertung 5 Sterne",
        difficulty: "++",
        task:
`Aufgabe:
Zeige alle Produkte, die mindestens eine Bewertung mit fünf Sternen erhalten haben.
Ein Produkt kann mehrere Bewertungen haben.
Gib alle Produktdaten aus.`,
        starter:
`SELECT *
FROM produkte, bewertungen
WHERE produkte.id = bewertungen.produkt_id
AND bewertungen.sterne = 5;`,
        refSql:
`SELECT *
FROM produkte, bewertungen
WHERE produkte.id = bewertungen.produkt_id
AND bewertungen.sterne = 5;`,
        mode: "set"
      },

      "rating-4": {
        title: "Bewertung 4 Sterne",
        difficulty: "++",
        task:
`Aufgabe:
Zeige alle Produkte, die mindestens eine Bewertung mit vier oder fünf Sternen erhalten haben.
Ein Produkt kann mehrere Bewertungen haben.
Gib alle Produktdaten aus.`,
        starter:
`SELECT *
FROM produkte, bewertungen
WHERE produkte.id = bewertungen.produkt_id
AND bewertungen.sterne >= 4;`,
        refSql:
`SELECT *
FROM produkte, bewertungen
WHERE produkte.id = bewertungen.produkt_id
AND bewertungen.sterne >= 4;`,
        mode: "set"
      },

      "open-cart": {
        title: "Mein Warenkorb",
        difficulty: "++",
        task:
`Aufgabe:
Zeige alle Produkte, die sich aktuell im Warenkorb befinden.
Gib für jedes Produkt den Namen, den Preis und die Menge im Warenkorb aus.`,
        starter:
`SELECT p.name, p.preis, w.menge
FROM produkte p, warenkorb w
WHERE p.id = w.produkt_id;`,
        refSql:
`SELECT p.name, p.preis, w.menge
FROM produkte p, warenkorb w
WHERE p.id = w.produkt_id;`,
        mode: "set"
      },

      "cart-total": {
        title: "Gesamtpreis Warenkorb",
        difficulty: "+++",
        task:
`Aufgabe:
Berechne den Gesamtpreis aller Produkte im Warenkorb.
Gib nur den Gesamtpreis aus.`,
        starter:
`SELECT SUM(p.preis * w.menge)
FROM produkte p, warenkorb w
WHERE p.id = w.produkt_id;`,
        refSql:
`SELECT SUM(p.preis * w.menge)
FROM produkte p, warenkorb w
WHERE p.id = w.produkt_id;`,
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
}

renderShell() {
    this.root.innerHTML = `
      <div class="right-wrap">
        <header class="lab-header">
          <div id="scoreEl" class="score-corner" aria-label="Score">🏆 0</div>
          <div class="lab-header-top">
            <div class="lab-title">
              <h2>Freier Bereich</h2>
              <div class="lab-sub" id="labStudent">Schüler: — • Modus: Freier Bereich</div>
            </div>

            <div class="lab-progress" aria-label="Fortschritt">
              <div class="lab-progress-meta">
                <div class="progress-left">
                  <div id="progressCount">0/0 erledigt</div>
                </div>
                <div id="progressPct">0%</div>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
              </div>
            </div>
          </div>

          <div class="lab-header-actions" style="justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <div class="lab-actions-left" style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn" id="btnSchema" type="button">DB-Schema</button>
              <button class="btn" id="btnSpicker" type="button">Theorie-Spicker</button>
              <button class="btn" id="btnSolutions" type="button">Bereits gelöste Aufgaben</button>
            </div>
            <div class="lab-actions-right" style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-locked" id="btnBonus" type="button" aria-label="Hacking-Aufgabe">Hacking-Aufgabe</button>
            </div>
          </div>

          <div id="labHint" class="lab-hint" style="display:none;"></div>
        </header>


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
                    <div class="task3-difficulty" aria-label="Schwierigkeit">
                      <span class="task3-diffLabel">Schwierigkeit</span>
                      <div class="difficulty-dots" id="difficultyDots">
                        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                      </div>
                      <span class="difficulty-text" id="difficultyText"></span>
                    </div>

                   <button class="btn btn-ghost task3-iconBtn" id="hintBtn" type="button" aria-label="Tipp" title="Tipp">
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
    <path d="M9 18h6M10 22h4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M8.5 14.5c-.9-1-2.5-2.2-2.5-4.8a6 6 0 1 1 12 0c0 2.6-1.6 3.8-2.5 4.8-.6.7-.9 1.4-1 2.5h-3c-.1-1.1-.4-1.8-1-2.5Z"
          fill="none" stroke="currentColor" stroke-width="2"/>
</svg>
</button>


                    <button class="btn btn-ghost task3-closeBtn" id="taskClose" type="button" title="Schließen" aria-label="Aufgabe schließen"><span aria-hidden="true">✕</span></button>
                  </div>
                </div>

                <div class="task3-card">
                  <div class="task3-cardHead">
                    <div class="task3-cardTitle">Aufgabenstellung</div>
                  </div>
                  <div class="task3-body" id="taskBody"></div>
                </div>

                
<div class="task3-card task3-hintCard" id="hintOverlay" aria-hidden="true">
  <div class="task3-hintHead">
    <div class="task3-cardTitle" id="hintTitle">Tipp</div>
    <button class="btn btn-ghost task3-hintClose" id="hintClose" type="button" aria-label="Tipp schließen" title="Schließen">✕</button>
  </div>
  <pre class="task3-hintBody" id="hintText" style="white-space:pre-wrap; margin:0;"></pre>
  <div class="task3-hintActions">
    <button class="btn btn-primary" id="hintConfirm" type="button" style="display:none;">Tipp anzeigen (-1)</button>
    <button class="btn btn-ghost" id="hintBack" type="button">Schließen</button>
  </div>
</div>

<div class="task3-card">
                  <div class="task3-cardHead">
                    <div class="task3-cardTitle">SQL‑Editor</div>
                    <div class="task3-cardMeta">Schreibe deine Abfrage und prüfe sie.</div>
                  </div>

                  <textarea id="sqlInput" class="task3-editor" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="SELECT …"></textarea>

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
                <button class="btn btn-close" id="spickerClose" type="button" aria-label="Schließen" title="Schließen">✕</button>
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
                <button class="btn btn-close" id="schemaClose" type="button" aria-label="Schließen" title="Schließen">✕</button>
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
                <button class="btn btn-close" id="solutionsClose" type="button" aria-label="Schließen" title="Schließen">✕</button>
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
                    <h3 class="task3-title" id="sideTitle">Hacking‑Aufgabe</h3>
                    <div class="task3-cardMeta" id="sideMeta">SQL‑Injection (Sandbox)</div>
                  </div>
                  <div class="task3-headerRight">
                    <button class="btn btn-ghost task3-closeBtn" id="bonusClose" type="button" aria-label="Schließen" title="Schließen"><span aria-hidden="true">✕</span></button>
                  </div>
                </div>

                <div class="task3-surface" id="sideBody"></div>
              </div>
            
        </section>
      </div>

        <div class="overlay" id="lockedOverlay" aria-hidden="true">
          <div class="modal locked-modal" role="dialog" aria-modal="true" aria-labelledby="lockedTitle">
            <div class="overlay-top" style="margin-bottom:10px;">
              <h3 class="overlay-title" id="lockedTitle">Noch nicht verfügbar</h3>
              <button class="btn btn-ghost" id="lockedClose" type="button" aria-label="Schließen" title="Schließen" style="width:40px; height:40px; padding:0; border-radius:14px;"><span aria-hidden="true">✕</span></button>
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

    // Progress
    this.progressCountEl = this.root.querySelector('#progressCount');
    this.progressPctEl = this.root.querySelector('#progressPct');
    this.progressFillEl = this.root.querySelector('#progressFill');
    this.scoreEl = this.root.querySelector('#scoreEl');

    // Actions
    this.btnSchema = this.root.querySelector('#btnSchema');
    this.btnSpicker = this.root.querySelector('#btnSpicker');
    this.btnSolutions = this.root.querySelector('#btnSolutions');
    this.btnBonus = this.root.querySelector('#btnBonus');

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
    this.taskHintEl = this.root.querySelector('#taskHint');

    // Editor
    this.sqlEl = this.root.querySelector('#sqlInput');
    this.outEl = this.root.querySelector('#out');
    this.runBtn = this.root.querySelector('#runBtn');
    this.unlockBtn = this.root.querySelector('#unlockBtn');

    // Confirm modal
    this.confirmOverlayEl = this.root.querySelector('#confirmOverlay');
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

    // Hint overlay (Tipp‑Popup)
    this.hintOverlayEl = this.root.querySelector('#hintOverlay');
    this.hintCloseBtn = this.root.querySelector('#hintClose');
    this.hintBackBtn = this.root.querySelector('#hintBack');
        this.hintConfirmBtn = this.root.querySelector('#hintConfirm');
    this.hintTitleEl = this.root.querySelector('#hintTitle');
this.hintTextEl = this.root.querySelector('#hintText');

    // Bonus
    this.bonusCloseBtn = this.root.querySelector('#bonusClose');

    // Side view content
    this.sideTitleEl = this.root.querySelector('#sideTitle');
    this.sideMetaEl = this.root.querySelector('#sideMeta');
    this.sideBodyEl = this.root.querySelector('#sideBody');
    this.currentSideView = null;

    // Handlers
    this.runBtn.addEventListener('click', () => this.checkCurrent());
    this.unlockBtn.addEventListener('click', () => this.unlockCurrent());
    this.closeTaskBtn.addEventListener('click', () => this.closeTask());
    this.hintBtn.addEventListener('click', () => this.requestHint());


    // Bei SQL-Änderung: Freischalten wieder deaktivieren (muss erneut geprüft werden)
    this.sqlEl?.addEventListener('input', () => this.onSqlEdited());

    // Hint overlay
    this.hintCloseBtn?.addEventListener('click', () => this.closeHintOverlay());
    this.hintBackBtn?.addEventListener('click', () => this.closeHintOverlay());

        this.hintConfirmBtn?.addEventListener('click', () => this.confirmHint());
this.confirmCloseBtn.addEventListener('click', () => this.closeConfirm());
    this.confirmNoBtn.addEventListener('click', () => this.closeConfirm());
    this.confirmYesBtn.addEventListener('click', () => this.confirmHint());
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
    this.btnSpicker.addEventListener('click', () => this.openSpicker());
    this.btnSolutions.addEventListener('click', () => this.openSolutions());
    this.btnBonus.addEventListener('click', () => this.openBonus());
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
      return `
        <button class="spicker-item" type="button" data-solution="${this.escapeHtml(id)}">
          <div class="spicker-item-title">${title}</div>
          <div class="spicker-item-meta">${cat}</div>
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
    const diff = t.difficulty || '';
    const sql = (this.solutionSql && this.solutionSql[tid]) ? String(this.solutionSql[tid]) : '';

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

    const head = `
      <div class="spicker-block">
        <div class="spicker-block-title">Aufgabe</div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center;">
          <span class="badge">${this.escapeHtml(cat)}</span>
          ${diff ? `<span class="badge">${this.escapeHtml(diff)}</span>` : ``}
        </div>
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
      this.sideTitleEl.textContent = 'Hacking‑Aufgabe';
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
      return;
    }

    this.emptyEl.style.display = 'none';
    this.taskViewEl.style.display = 'block';
    this.bonusViewEl.style.display = 'none';
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
    this.setEmptyState(true);
  }

  openBonus() {
    // Bei Klick: erst prüfen, ob freigeschaltet. Wenn nicht: kleines Modal anzeigen.
    const pct = this.getProgressPct();
    const can = pct >= BONUS_MIN_PCT;

    if (!can) {
      const missing = this.getMissingForPct(BONUS_MIN_PCT);
      this.pulseLocked(this.btnBonus);

      // Kein Pop-up: gesperrte Bonus-Ansicht inline im rechten Panel anzeigen.
      this.hideHint();
      this.closeAllSideViews();

      this.currentSideView = 'sqli-locked';
      if (this.sideTitleEl) this.sideTitleEl.textContent = 'Hacking‑Aufgabe';
      if (this.sideMetaEl) this.sideMetaEl.textContent = `Gesperrt • ab ${BONUS_MIN_PCT}% Fortschritt`;

      const safePct = Math.max(0, Math.min(100, Number(pct) || 0));
      const body = `
        <div class="task3-card">
          <div class="task3-cardHead">
            <div class="task3-cardTitle">Noch nicht verfügbar</div>
            <div class="task3-cardMeta">Aktueller Fortschritt: ${safePct}% • Es fehlen ${missing} Aufgabe(n)</div>
          </div>
          <div class="task3-body">
            Diese Bonus‑Aufgabe wird ab <strong>${BONUS_MIN_PCT}%</strong> freigeschaltet.
            Löse dafür weitere Aufgaben im Shop (links), bis du die Schwelle erreicht hast.
          </div>
          <div class="progress-bar" style="height:10px; margin-top:14px;">
            <div class="progress-fill" style="width:${safePct}%;"></div>
          </div>
        </div>

        <div class="task3-card" style="display:flex; justify-content:flex-end; gap:10px;">
          <button class="btn btn-ghost" id="bonusLockedOk" type="button">Verstanden</button>
        </div>
      `;

      if (this.sideBodyEl) this.sideBodyEl.innerHTML = body;
      this.showBonusView();

      // One-shot handler (Body wird neu gerendert)
      const ok = this.root.querySelector('#bonusLockedOk');
      ok?.addEventListener('click', () => this.closeBonus(), { once: true });

      return;
    }

    // Panels konsistent: keine Überschneidung mit anderen Views
    this.hideHint();
    this.closeAllSideViews();

    this.currentSideView = 'sqli';
    if (this.sideTitleEl) this.sideTitleEl.textContent = 'Hacking‑Aufgabe';
    if (this.sideMetaEl) this.sideMetaEl.textContent = 'SQL‑Injection (Sandbox)';

    const body = `
      <div style="display:flex; flex-direction:column; gap:14px; margin-top:12px;">
        <div class="spicker-block">
          <div class="spicker-block-title">Ziel</div>
          <p style="margin:6px 0 0 0;">Du sollst verstehen, <strong>warum</strong> SQL‑Injection möglich ist – und <strong>wie</strong> man es in echten Systemen verhindert.</p>
        </div>

        <div class="spicker-block">
          <div class="spicker-block-title">Didaktischer Kontext</div>
          <p style="margin:6px 0 0 0;">Hier wird (für die Übung) eine <strong>unsichere</strong> Login‑Abfrage per String‑Verkettung gebaut. Das ist genau der Fehler, der SQL‑Injection ermöglicht.</p>
          <pre class="output" style="white-space:pre-wrap; margin-top:10px;">SELECT *
FROM users
WHERE username = '<span class="muted">EINGABE_USER</span>'
  AND password = '<span class="muted">EINGABE_PASS</span>';</pre>
          <p class="muted" style="margin:10px 0 0 0;">Wenn Eingaben ungefiltert in die Query wandern, kannst du die WHERE‑Logik manipulieren (z. B. „immer wahr“ + Kommentar).</p>
        </div>

        <div class="spicker-block">
          <div class="spicker-block-title">Aufgabe</div>
          <ol style="margin:6px 0 0 18px;">
            <li>Öffne rechts oben im Shop das <strong>Konto‑Panel</strong>.</li>
            <li>Teste Eingaben, die die WHERE‑Bedingung verändern (ohne die komplette Lösung zu verraten: denke an <strong>„immer wahr“</strong> und <strong>Kommentare</strong>).</li>
            <li>Ziel: Die Anwendung zeigt <strong>„Login erfolgreich“</strong>.</li>
          </ol>
          <div class="muted" style="margin-top:8px;">Wenn es klappt, bekommst du automatisch <strong>+10 Score</strong>.</div>
        </div>

        <div class="spicker-block">
          <div class="spicker-block-title">Reflexion: Wie verhindert man das?</div>
          <p style="margin:6px 0 0 0;">Notiere mindestens <strong>4</strong> konkrete Gegenmaßnahmen (z. B. <strong>Prepared Statements</strong>, Eingabevalidierung/Canonicalization, Least Privilege, sichere ORMs, Logging/Monitoring, WAF).</p>
          <p class="muted" style="margin:10px 0 0 0;">Hinweis: In echten Anwendungen ist SQL‑Injection ein kritischer Sicherheitsfehler – hier ist es eine Lern‑Sandbox.</p>
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
    this.taskBodyEl.textContent = this.sanitizeTaskText(t.task || '');

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
    this.outEl.textContent = isUnlocked ? 'Bereits freigeschaltet.' : '';

    this.unlockBtn.disabled = true;

    // View
    this.setEmptyState(false);
    if (this.spickerViewEl) this.spickerViewEl.style.display = 'none';

    // UX: Fokus direkt in Editor
    try { this.sqlEl?.focus(); } catch (_) {}
  }

  checkCurrent() {
    this.outEl.textContent = "";
    this.unlockBtn.disabled = true;
    this.unlockBtn.style.cursor = "not-allowed";
    this.unlockBtn.style.opacity = ".6";
    this.unlockBtn.classList.remove('btn-unlock-ready');

    if (!this.currentId) {
      this.outEl.textContent = "Keine Aufgabe ausgewählt. Klicke im Shop auf einen gesperrten Button.";
      return;
    }

    if (!this.db) {
      this.outEl.textContent = "DB ist nicht geladen.";
      return;
    }

    const sql = this.sqlEl.value || "";
    if (!this.isSelectOnly(sql)) {
      this.outEl.textContent = "Nur SELECT-Abfragen sind erlaubt.";
      return;
    }

    let studentRes, refRes;
    try {
      studentRes = this.db.exec(sql);
    } catch (e) {
      this.outEl.textContent = "SQL-Fehler: " + e.message;
      return;
    }

    const t = this.TASKS[this.currentId];
    try {
      refRes = this.db.exec(t.refSql);
    } catch (e) {
      this.outEl.textContent = "Interner Referenz-Fehler: " + e.message;
      return;
    }

    const ok = this.validate(studentRes, refRes, t.mode);

    if (ok) {
      if (this.unlocked[this.currentId]) {
        this.outEl.textContent = "✅ Korrekt (bereits freigeschaltet).";
        return;
      }
      this.outEl.textContent = "✅ Korrekt! Du kannst jetzt freischalten.";
      this.unlockBtn.disabled = false;
      this.unlockBtn.style.cursor = "pointer";
      this.unlockBtn.style.opacity = "1";
      this.unlockBtn.classList.add('btn-unlock-ready');
      return;
    }

    this.outEl.textContent = '❌ Noch nicht korrekt.';
  }


  onSqlEdited() {
    // Sobald der User den Editor ändert: Freischalten wieder sperren,
    // bis erneut „Prüfen“ erfolgreich war.
    if (!this.unlockBtn) return;
    if (this.unlocked?.[this.currentId]) return; // bereits freigeschaltet

    this.unlockBtn.disabled = true;
    this.unlockBtn.classList.remove('btn-unlock-ready');
    this.unlockBtn.setAttribute('aria-disabled', 'true');
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

    this.outEl.textContent = 'Freigeschaltet! Der Button ist jetzt im Shop aktiv.';

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

  requestHint() {
    if (!this.currentId) return;
    const id = this.currentId;

    const alreadyUsed = !!this.hintUsed?.[id];
    const isOpen = !!this.hintOverlayEl && (this.hintOverlayEl.classList.contains('show') || this.hintOverlayEl.classList.contains('open'));
    const isPending = this._pendingHintTaskId === id;

    // 1) Wenn Tipp schon genutzt: Tipp-Card togglen (ohne Pop-up).
    if (alreadyUsed) {
      if (isOpen) this.closeHintOverlay();
      else this.openHintOverlay(this.getHintText(id), { mode: 'hint' });
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
      `Wenn du fortfährst, wird dein Score um 1 reduziert und du siehst den Tipp für diese Aufgabe dauerhaft.`;
    this.openHintOverlay(msg, { mode: 'confirm' });
  }

  openConfirm() {
    if (!this.confirmOverlayEl) return;
    this.confirmOverlayEl.classList.add('show', 'open');
    this.confirmOverlayEl.setAttribute('aria-hidden', 'false');
  }

  closeConfirm() {
    this._pendingHintTaskId = null;
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
    this.closeConfirm();
    if (!id) return;

    // Abzug nur 1x pro Aufgabe
    this.hintUsed[id] = true;
    this.persistProgressState();
    this.updateProgressUI();


    this._pendingHintTaskId = null;
    this.showTaskHint(this.getHintText(id));
  }

  openHintOverlay(text, opts = {}) {
    if (!this.hintOverlayEl || !this.hintTextEl) return;

    const mode = (opts && opts.mode) ? String(opts.mode) : 'hint';
    const isConfirm = mode === 'confirm';

    if (this.hintTitleEl) this.hintTitleEl.textContent = isConfirm ? 'Tipp anzeigen?' : 'Tipp';
    if (this.hintConfirmBtn) this.hintConfirmBtn.style.display = isConfirm ? '' : 'none';
    if (this.hintBackBtn) this.hintBackBtn.textContent = isConfirm ? 'Abbrechen' : 'Schließen';

    this.hintTextEl.textContent = text || '';
    this.hintOverlayEl.classList.add('show', 'open');
    this.hintOverlayEl.setAttribute('aria-hidden', 'false');
    try { this.hintOverlayEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
  }

  closeHintOverlay() {
    if (!this.hintOverlayEl || !this.hintTextEl) return;
    this.hintOverlayEl.classList.remove('show', 'open');
    this.hintOverlayEl.setAttribute('aria-hidden', 'true');
    this.hintTextEl.textContent = '';

    if (this.hintConfirmBtn) this.hintConfirmBtn.style.display = 'none';
    if (this.hintBackBtn) this.hintBackBtn.textContent = 'Schließen';
    if (this.hintTitleEl) this.hintTitleEl.textContent = 'Tipp';

    this._pendingHintTaskId = null;
  }

  // Backwards‑compat hook (alte API), jetzt als Overlay
  showTaskHint(text) { this.openHintOverlay(text, { mode: 'hint' }); }
  hideTaskHint() { this.closeHintOverlay(); }

  getHintText(taskId) {
    const t = this.TASKS?.[taskId];
    const H = {
      "search": "Nutze LIKE mit Platzhalter :q und Wildcards (%). Achte darauf, dass du die Wildcards korrekt zusammensetzt.",
      "bestseller": "Du brauchst eine Aggregation über verkäufe: GROUP BY produkt_id und SUM(anzahl). Danach filterst du mit HAVING.",
      "available": "Das ist eine reine WHERE‑Bedingung auf lagerbestand. Formuliere den Bereich eindeutig.",
      "popularity": "Beliebtheit = SUM(anzahl) pro Produkt. Gib produkt_id und die Summe aus und sortiere danach absteigend.",
      "cat-electronics": "Du musst produkte mit kategorien verknüpfen (JOIN) und dann nach kategorien.name filtern.",
      "cat-household": "Verknüpfe produkte mit kategorien und filtere nach kategorien.name.",
      "cat-sport": "Verknüpfe produkte mit kategorien und filtere nach kategorien.name.",
      "rating-5": "Verknüpfe produkte mit bewertungen und filtere nach sterne = 5. Denk daran: Produkte können mehrere Bewertungen haben.",
      "rating-4": "Wie bei 5‑Sterne, aber mit sterne >= 4. Achte auf mögliche Duplikate.",
      "open-cart": "Verknüpfe warenkorb mit produkte über produkt_id. Gib Name/Preis/Menge aus.",
      "cart-refresh": "Du brauchst zusätzlich eine berechnete Spalte (preis * menge) mit Alias. Danach ORDER BY nach Name.",
      "cart-total": "Aggregation: SUM(preis * menge). Gib nur einen Wert zurück.",
      "orders": "Filtere auf nutzer_id = 1, sortiere nach der neuesten Bestellung (id DESC) und LIMIT 3.",
      "topProducts": "SUM(anzahl) pro Produkt, danach absteigend sortieren und LIMIT 2. Gib Name und Summe aus.",
    };

    if (H[taskId]) return H[taskId];

    // Fallback – hilft, verrät nicht die Lösung
    const lvl = this.getDifficultyLevel(t?.difficulty);
    if (lvl === 1) return "Starte mit SELECT ... FROM ... und ergänze dann genau eine passende WHERE‑Bedingung. Prüfe zuerst, ob die richtigen Zeilen kommen.";
    if (lvl === 2) return "Überlege, welche zwei Tabellen zusammengehören, und verbinde sie über passende Schlüsselspalten. Danach filterst du über WHERE.";
    return "Wenn Aggregation nötig ist: GROUP BY auf der richtigen Schlüsselspalte, SUM/COUNT für die Kennzahl und HAVING für Bedingungen auf Aggregaten.";
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
    const bonus = this.sqliDone ? 10 : 0;
    return Math.max(0, base + bonus - hints);
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

    if (this.progressCountEl) this.progressCountEl.textContent = `${done}/${total} erledigt`;
    if (this.progressPctEl) this.progressPctEl.textContent = `${pct}%`;
    if (this.progressFillEl) this.progressFillEl.style.width = `${pct}%`;

    if (this.scoreEl) this.scoreEl.textContent = `🏆 ${this.computeScore()}`;

    // Bonus availability
    const canBonus = pct >= BONUS_MIN_PCT;
    if (this.btnBonus) {
      this.btnBonus.classList.toggle('btn-locked', !canBonus);
      this.btnBonus.setAttribute('aria-disabled', canBonus ? 'false' : 'true');
      this.btnBonus.title = canBonus ? 'Hacking‑Aufgabe verfügbar' : `Ab ${BONUS_MIN_PCT}% Fortschritt verfügbar`;
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

  // ---------- Validation ----------
  validate(studentExec, refExec, mode) {
    // Full table comparison (supports text + numeric outputs)
    if (mode === 'rows_order' || mode === 'rows_set') {
      const ordered = (mode === 'rows_order');
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
    if (!execResult || execResult.length === 0) return { ok: true, rows: [] };
    const res = execResult[0];
    const values = res?.values || [];
    if (!Array.isArray(values) || values.length === 0) return { ok: true, rows: [] };

    // Normalize each cell to stable representation
    const rows = values.map(row => row.map(v => this.normalizeCell(v)));
    return { ok: true, rows };
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



