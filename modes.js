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
   Shell chrome helpers (Name, Timer, Fullscreen)
   =========================== */

const FREE_TIMER_TOTAL_SEC = 60 * 60;
const FREE_TIMER_KEY = "schulazon_free_startedAt_v1";

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

      this.sqliDone = localStorage.getItem('schulazon_sqli_done_v1') === 'true';
    } catch (_) {
      // ignore
    }
  }

  persistProgressState() {
    try {
      localStorage.setItem('schulazon_unlocked_v1', JSON.stringify(this.unlocked));
      localStorage.setItem('schulazon_hint_used_v1', JSON.stringify(this.hintUsed || {}));
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
      <div class="lab">
        <header class="lab-header">
          <div class="lab-header-top">
            <div class="lab-title">
              <h2>Freier Bereich</h2>
              <div class="lab-sub" id="labStudent">Schüler: — • Modus: Freier Bereich</div>
            </div>

            <div class="lab-progress" aria-label="Fortschritt">
              <div class="lab-progress-meta">
                <div class="progress-left">
                  <div id="progressCount">0/0 erledigt</div>
                  <div id="scoreEl" class="score-pill">Score: 0</div>
                </div>
                <div id="progressPct">0%</div>
              </div>
              <div class="progress-bar" style="height:12px;">
                <div class="progress-fill" id="progressFill"></div>
              </div>
            </div>
          </div>

          <div class="lab-header-actions" style="justify-content:space-between; gap:10px; flex-wrap:wrap;">
            <div class="lab-actions-left" style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn" id="btnSchema" type="button">DB-Schema</button>
              <button class="btn" id="btnSpicker" type="button">Theorie-Spicker</button>
              <button class="btn" id="btnSolutions" type="button">Lösungen</button>
            </div>
            <div class="lab-actions-right" style="display:flex; gap:10px; flex-wrap:wrap;">
              <button class="btn btn-locked" id="btnBonus" type="button" aria-label="Zusatzaufgabe">Zusatzaufgabe</button>
            </div>
          </div>

          <div id="labHint" class="lab-hint" style="display:none;"></div>
        </header>

        <section class="lab-card">
          <div class="lab-card-inner">
            <div id="emptyState" class="empty-state">
              Keine Aufgabe ausgewählt. Klicke im Shop auf einen gesperrten Button.
            </div>

            <div id="taskView" style="display:none; min-height:0;" class="task-view">
              <div class="task-head">
                <div>
                  <h3 class="task-title" id="taskTitle"></h3>
                  <div class="task-id" id="taskId"></div>
                </div>

                <div style="display:flex; align-items:flex-start; gap:10px;">
                  <div class="difficulty">
                    <div class="difficulty-label">Schwierigkeit</div>
                    <div class="difficulty-dots" id="difficultyDots">
                      <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                    </div>
                  </div>
                  <button class="btn btn-ghost" id="hintBtn" type="button">Tipp</button>
                  <button class="btn btn-ghost" id="taskClose" type="button">Aufgabe schließen</button>
                </div>
              </div>

              <div class="task-body" id="taskBody"></div>

              <div id="taskHint" class="task-hint" style="display:none;"></div>

              <div class="editor">
                <textarea id="sqlInput" spellcheck="false"></textarea>
                <div class="editor-actions">
                  <button class="btn btn-primary" id="runBtn" type="button">Prüfen</button>
                  <button class="btn" id="unlockBtn" type="button" disabled>Freischalten</button>
                </div>
              </div>

              <pre class="output" id="out"></pre>
            </div>

            <div id="bonusView" style="display:none; min-height:0;" class="bonus-view">
              <div class="task-head">
                <div>
                  <h3 class="task-title" id="sideTitle">Zusatzaufgabe</h3>
                  <div class="task-id" id="sideMeta">Platzhalter</div>
                </div>
                <button class="btn btn-ghost" id="bonusClose" type="button">Zurück</button>
              </div>
              <div class="task-body" id="sideBody">Platzhalter.</div>
            </div>
          </div>
        </section>

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
    this.emptyEl = this.root.querySelector('#emptyState');
    this.taskViewEl = this.root.querySelector('#taskView');
    this.bonusViewEl = this.root.querySelector('#bonusView');

    // Task UI
    this.titleEl = this.root.querySelector('#taskTitle');
    this.taskIdEl = this.root.querySelector('#taskId');
    this.taskBodyEl = this.root.querySelector('#taskBody');
    this.dotsEl = this.root.querySelector('#difficultyDots');
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
    this._pendingHintTaskId = null;

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

    this.confirmCloseBtn.addEventListener('click', () => this.closeConfirm());
    this.confirmNoBtn.addEventListener('click', () => this.closeConfirm());
    this.confirmYesBtn.addEventListener('click', () => this.confirmHint());
    this.confirmOverlayEl.addEventListener('click', (e) => {
      if (e.target === this.confirmOverlayEl) this.closeConfirm();
    });

    this.btnSchema.addEventListener('click', () => this.openSideView('schema'));
    this.btnSpicker.addEventListener('click', () => this.openSideView('spicker'));
    this.btnSolutions.addEventListener('click', () => this.openSideView('solutions'));
    this.btnBonus.addEventListener('click', () => this.openBonus());
    this.bonusCloseBtn.addEventListener('click', () => this.closeBonus());
  }

  openSideView(kind) {
    this.currentSideView = kind;

    // Inhalte
    if (kind === 'schema') {
      this.sideTitleEl.textContent = 'DB‑Schema';
      this.sideMetaEl.textContent = 'Platzhalter';
      this.sideBodyEl.innerHTML = `
        <p><strong>Platzhalter:</strong> Hier wird später das Datenbankschema angezeigt.</p>
        <p class="muted">Idee: Tabellen, Schlüssel und wichtige Spalten kurz erklären. Dazu 1–2 Beispielqueries.</p>
      `;
    } else if (kind === 'spicker') {
      this.sideTitleEl.textContent = 'Theorie‑Spicker';
      this.sideMetaEl.textContent = 'Platzhalter';
      this.sideBodyEl.innerHTML = `
        <p><strong>Platzhalter:</strong> Hier wird später ein kompakter Spicker angezeigt.</p>
        <ul>
          <li>SELECT‑Grundform</li>
          <li>WHERE, ORDER BY, LIMIT</li>
          <li>JOIN, GROUP BY, Aggregationen</li>
        </ul>
      `;
    } else if (kind === 'solutions') {
      this.sideTitleEl.textContent = 'Lösungen';
      this.sideMetaEl.textContent = 'Nur bereits freigeschaltet';

      const unlockedIds = Object.keys(this.TASKS).filter(id => !!this.unlocked[id]);
      if (!unlockedIds.length) {
        this.sideBodyEl.innerHTML = `<p>Noch keine Aufgaben freigeschaltet.</p>`;
      } else {
        const blocks = unlockedIds.map((id) => {
          const t = this.TASKS[id];
          const sql = (t && t.refSql) ? t.refSql : '';
          return `
            <div style="margin-bottom:14px; padding:12px; border:1px solid rgba(255,255,255,.08); border-radius:12px;">
              <div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start;">
                <div>
                  <div style="font-weight:700;">${this.escapeHtml(t?.title || id)}</div>
                  <div class="muted" style="margin-top:2px;">Task: ${this.escapeHtml(id)}</div>
                </div>
                <div class="muted" style="white-space:nowrap;">${this.escapeHtml(t?.difficulty || '')}</div>
              </div>
              ${sql ? `<pre class="output" style="margin-top:10px; white-space:pre-wrap;">${this.escapeHtml(sql)}</pre>` : `<div class="muted" style="margin-top:10px;">Keine Referenz‑SQL hinterlegt.</div>`}
            </div>
          `;
        }).join('');
        this.sideBodyEl.innerHTML = blocks;
      }
    } else if (kind === 'sqli') {
      this.sideTitleEl.textContent = 'SQL‑Injection';
      this.sideMetaEl.textContent = 'Zusatzaufgabe';
      this.sideBodyEl.innerHTML = `
        <p><strong>Ein‑Satz‑Einordnung:</strong> SQL‑Injection entsteht, wenn SQL‑Statements aus unvalidierten Nutzereingaben per String‑Verkettung gebaut werden und Angreifer die Query‑Logik manipulieren.</p>

        <h4 style="margin:14px 0 8px;">Aufgabe 1: „Versuche dich reinzuhacken“</h4>
        <ol>
          <li>Öffne im Shop rechts oben das <strong>Konto‑Panel</strong>.</li>
          <li>Nutze das Login‑Formular. Ziel: <strong>„Login erfolgreich“</strong> ohne echtes Passwort.</li>
          <li>Hinweis: Du manipulierst die <strong>WHERE‑Bedingung</strong> (ohne die komplette Lösung zu verraten: denke an „immer wahr“ und Kommentare).</li>
        </ol>
        <div class="muted" style="margin-top:6px;">Wenn du es schaffst, bekommst du automatisch <strong>+10 Score</strong>.</div>

        <h4 style="margin:14px 0 8px;">Aufgabe 2: Recherche (Internet)</h4>
        <p>Recherchiere online, welche Gegenmaßnahmen man in realen Anwendungen einsetzt, und notiere <strong>mindestens 4 konkrete Maßnahmen</strong> (z. B. Parametrisierung/Prepared Statements, Eingabevalidierung, Least Privilege, sichere ORM‑Nutzung).</p>

        <h4 style="margin:14px 0 8px;">Warum das hier erlaubt ist</h4>
        <p class="muted">Das ist eine Lern‑Sandbox. In echten Systemen ist das ein kritischer Security‑Bug.</p>
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

  setEmptyState(isEmpty) {
    // Hints ausblenden, wenn Nutzer aktiv wechselt
    this.hideHint();
    this.hideTaskHint();

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
    this.emptyEl.style.display = 'none';
    this.taskViewEl.style.display = 'none';
    this.bonusViewEl.style.display = 'block';
  }

  closeTask() {
    this.currentId = null;
    this.setEmptyState(true);
  }

  openBonus() {
    const pct = this.getProgressPct();
    if (pct < 80) {
      const missing = this.getMissingForPct(80);
      this.showHint(`Zusatzaufgabe ist ab 80% verfügbar. Dir fehlen noch ${missing} Aufgabe(n).`);
      this.pulseLocked(this.btnBonus);
      return;
    }

    // Immer die SQL‑Injection‑Challenge öffnen (nicht von vorherigen Side‑Views abhängen)
    this.openSideView('sqli');
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
    const t = this.TASKS[taskId];

    const isUnlocked = !!this.unlocked[taskId];

    // UI
    this.titleEl.textContent = `${t.title}`;
    this.taskIdEl.textContent = `Task: ${taskId}`;
    this.taskBodyEl.textContent = t.task || '';

    this.setDifficultyDots(this.getDifficultyLevel(t.difficulty));

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

  
async unlockCurrent() {
    const id = this.currentId;
    if (!id) return;

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

  hideHint() {
    if (!this.hintEl) return;
    this.hintEl.style.display = 'none';
    this.hintEl.textContent = '';
  }

  /* ---------- Tipp-System (mit Score-Abzug) ---------- */

  requestHint() {
    if (!this.currentId) return;
    const id = this.currentId;
    const alreadyUsed = !!this.hintUsed?.[id];

    // Wenn schon genutzt: einfach anzeigen/umschalten, ohne erneut -1.
    if (alreadyUsed) {
      const isOpen = this.taskHintEl && this.taskHintEl.style.display !== 'none';
      if (isOpen) {
        this.hideTaskHint();
      } else {
        this.showTaskHint(this.getHintText(id));
      }
      return;
    }

    this._pendingHintTaskId = id;
    this.openConfirm();
  }

  openConfirm() {
    if (!this.confirmOverlayEl) return;
    this.confirmOverlayEl.classList.add('open');
    this.confirmOverlayEl.setAttribute('aria-hidden', 'false');
  }

  closeConfirm() {
    this._pendingHintTaskId = null;
    if (!this.confirmOverlayEl) return;
    this.confirmOverlayEl.classList.remove('open');
    this.confirmOverlayEl.setAttribute('aria-hidden', 'true');
  }

  confirmHint() {
    const id = this._pendingHintTaskId;
    this.closeConfirm();
    if (!id) return;

    // Abzug nur 1x pro Aufgabe
    this.hintUsed[id] = true;
    this.persistProgressState();
    this.updateProgressUI();

    this.showTaskHint(this.getHintText(id));
  }

  showTaskHint(text) {
    if (!this.taskHintEl) return;
    this.taskHintEl.textContent = text;
    this.taskHintEl.style.display = 'block';
  }

  hideTaskHint() {
    if (!this.taskHintEl) return;
    this.taskHintEl.style.display = 'none';
    this.taskHintEl.textContent = '';
  }

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

    if (this.scoreEl) this.scoreEl.textContent = `Score: ${this.computeScore()}`;

    // Bonus availability
    const canBonus = pct >= 80;
    if (this.btnBonus) {
      this.btnBonus.classList.toggle('btn-locked', !canBonus);
      this.btnBonus.setAttribute('aria-disabled', canBonus ? 'false' : 'true');
      this.btnBonus.title = canBonus ? 'Zusatzaufgabe verfügbar' : 'Ab 80% Fortschritt verfügbar';
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



