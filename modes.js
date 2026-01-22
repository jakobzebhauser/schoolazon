/* ===========================
   ShopBridge (Parent -> iframe)
   =========================== */


// ===========================
// Global message bridge (Shop iframe -> Mode)
// Shop sends: { type: "SHOP_ACTION", actionId }
// ===========================
window.addEventListener("message", (event) => {
  const msg = event?.data;
  if (!msg || msg.type !== "SHOP_ACTION") return;

  const actionId = msg.actionId;
  if (!actionId) return;

  // Route to the active mode (Free/Guided/Test)
  if (window.currentMode && typeof window.currentMode.onShopSelect === "function") {
    window.currentMode.onShopSelect(actionId);
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

    // 1) Shop: ALLES locken
    await this.shop.ready;
    await this.lockAllShopTasks(true);

    // Name vom Shop übernehmen (best effort)
    this.syncStudentName();

    // 2) DB laden (für Validierung)
    await this.loadDb();

    // 3) Initialer Zustand (keine Aufgabe ausgewählt)
    this.setEmptyState(true);
    this.updateProgressUI();
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
    let name = '';
    try {
      const frame = document.getElementById('shopFrame');
      const doc = frame?.contentDocument;
      const el = doc?.getElementById('studentName');
      name = (el?.textContent || '').trim();
    } catch (_) {
      // ignore
    }

    if (!name) name = 'Anna Müller';
    if (this.studentEl) this.studentEl.textContent = `Schüler: ${name} • Modus: Freier Bereich`;
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


/* ===========================
   Guided/Test Platzhalter
   =========================== */

/* ===========================
   GuidedMode (v1) - Linear Flow
   =========================== */
class GuidedMode {
  constructor(root) {
    window.currentMode = this; // active mode for iframe messages
    this.root = root;
    this.shop = new ShopBridge("shopFrame");

    this.steps = this.buildSteps();
    this.stepIndex = 0;

    // Per-step transient state
    this.stepState = {};   // stepId -> state object

    // Shop interaction tracking
    this.clickedGlobal = new Set();  // all clicks across session
  }

  buildSteps() {
    // IDs available from the shop (see ALL_TASK_IDS above)
    const TASK_LABELS = {
      // Shop bar
      "all": "Alle Produkte",
      "express": "Express-Lieferung",
      "bestseller": "Bestseller",
      "available": "Verfügbar",

      // Kategorien
      "cat-electronics": "Kategorie: Elektronik",
      "cat-household": "Kategorie: Haushalt",
      "cat-sport": "Kategorie: Sport",

      // Preis
      "price-25": "Preis ≤ 25€",
      "price-50": "Preis ≤ 50€",
      "price-100": "Preis ≤ 100€",

      // Rating
      "rating-5": "Rating: 5★",
      "rating-4": "Rating: 4★+",

      // Sort
      "priceAsc": "Sort: Preis ↑",
      "priceDesc": "Sort: Preis ↓",
      "popularity": "Sort: Beliebtheit",

      // Suche
      "search": "Suche",

      // Panels / Account
      "open-cart": "Warenkorb",
      "orders": "Bestellungen",
      "topProducts": "Top-Produkte",

      // Warenkorb-Aktionen
      "cart-refresh": "Warenkorb: Aktualisieren",
      "cart-total": "Warenkorb: Gesamt"
    };

    const sqlBlocksPairs = [
      { left: "SELECT", right: "Welche Spalten sollen angezeigt werden" },
      { left: "FROM", right: "Aus welcher(n) Tabelle(n) kommen die Daten" },
      { left: "WHERE", right: "Welche Zeilen werden ausgewählt (Bedingungen)" },
      { left: "ORDER BY", right: "Sortierung der Ergebnistabelle" },
      { left: "AGGREGAT / GROUP BY / HAVING", right: "Zusammenfassen und Filtern von Gruppen" }
    ];

    return [
      {
        id: "intro",
        type: "match",
        title: "Einleitung: Bausteine einer SQL-Abfrage",
        lead: "SQL-Abfragen bestehen aus festen Bausteinen. Ordne die Bausteine dem richtigen Zweck zu.",
        pairs: sqlBlocksPairs
      },
      {
        id: "keys",
        type: "info",
        title: "Schlüssel: Primärschlüssel und Fremdschlüssel",
        lead: "Tabellen speichern Datensätze (Zeilen) mit Attributen (Spalten). Schlüssel verbinden Tabellen eindeutig.",
        body: this.renderKeysBody()
      },
      {
        id: "select",
        type: "interactive",
        title: "SELECT … FROM …: * und DISTINCT",
        lead: "Mit SELECT legst du Spalten fest, mit FROM die Tabelle. * = alle Spalten, DISTINCT entfernt Duplikate.",
        widget: "distinctDemo"
      },
      {
        id: "allButtons",
        type: "shopChecklist",
        title: "Aufgabe: Alle Buttons einmal anklicken",
        lead: "Klicke im Shop jede Funktion mindestens einmal an. Hinweis: „Bestellungen“ und „Top‑Produkte“ findest du im Konto-Bereich.",
        required: ALL_TASK_IDS.filter(id => !["open-cart","cart-refresh","cart-total"].includes(id)),
        labels: TASK_LABELS,
        unlockWhenDone: ALL_TASK_IDS.filter(id => !["open-cart","cart-refresh","cart-total"].includes(id))
      },
      {
        id: "where",
        type: "shopTask",
        title: "WHERE: Filtern",
        lead: "WHERE filtert Zeilen. Teste typische Filter im Shop (entspricht Bedingungen in WHERE).",
        tables: [
          {
            title: "Operatoren",
            rows: [
              ["=", "gleich"],
              ["<>", "ungleich"],
              ["< / <=", "kleiner / kleiner-gleich"],
              ["> / >=", "größer / größer-gleich"]
            ]
          },
          {
            title: "Logik",
            rows: [
              ["AND", "beide Bedingungen müssen wahr sein"],
              ["OR", "mindestens eine Bedingung muss wahr sein"],
              ["NOT", "kehrt eine Bedingung um"]
            ]
          }
        ],
        required: ["available", "express", "price-50"],
        labels: TASK_LABELS,
        sqlPlaceholder: {
          title: "SQL-Mission (Platzhalter)",
          text: "Hier kommt später eine echte SQL-Aufgabe, die genau diese Filter per WHERE implementiert."
        }
      },
      {
        id: "orderby",
        type: "shopTask",
        title: "ORDER BY: Sortieren",
        lead: "ORDER BY sortiert nach Spalten – aufsteigend (ASC) oder absteigend (DESC).",
        required: ["priceAsc", "priceDesc"],
        labels: TASK_LABELS,
        sqlPlaceholder: {
          title: "SQL-Mission (Platzhalter)",
          text: "Hier kommt später eine SQL-Aufgabe, die die Sortierung über ORDER BY korrekt umsetzt."
        }
      },
      {
        id: "agg",
        type: "fill",
        title: "Aggregat & AS: Zusammenfassen und Alias",
        lead: "Aggregatfunktionen fassen viele Zeilen zusammen. AS gibt Ergebnisspalten einen verständlichen Alias.",
        aggregatesTable: [
          ["COUNT(...)", "zählt Werte/Zeilen"],
          ["SUM(...)", "Summe"],
          ["AVG(...)", "Durchschnitt"],
          ["MIN(...)", "kleinster Wert"],
          ["MAX(...)", "größter Wert"]
        ],
        exercises: this.buildAggregateExercises()
      },
      {
        id: "groupby",
        type: "fill",
        title: "GROUP BY & HAVING: Gruppen bilden und filtern",
        lead: "GROUP BY bildet Gruppen, damit du pro Gruppe Aggregatwerte berechnen kannst. HAVING filtert Gruppen.",
        exercises: this.buildGroupByExercises()
      },
      {
        id: "rel1n",
        type: "diagram",
        title: "Verbund 1:n",
        lead: "Eine 1:n-Beziehung: ein Datensatz auf der 1‑Seite gehört zu vielen auf der n‑Seite.",
        diagram: {
          left: { title: "kategorien", note: "1" },
          right: { title: "produkte", note: "n", foot: "produkte.kategorie_id → kategorien.id" }
        }
      },
      {
        id: "relnm",
        type: "diagram",
        title: "Verbund n:m",
        lead: "Eine n:m-Beziehung wird über eine zusätzliche Beziehungstabelle umgesetzt.",
        diagram: {
          left: { title: "bestellungen", note: "n" },
          mid: { title: "bestellpositionen", note: "Beziehung", foot: "(bestellung_id, produkt_id)" },
          right: { title: "produkte", note: "m" }
        }
      },
      {
        id: "privacy",
        type: "confirm",
        title: "Personenbezogene Daten",
        lead: "Personenbezogene Daten beziehen sich direkt oder indirekt auf eine identifizierbare Person und sind besonders geschützt.",
        confirmLabel: "Verstanden"
      },
      {
        id: "end",
        type: "info",
        title: "Ende",
        lead: "Du bist durch das Tutorial durch. Links sind nun alle Funktionen freigeschaltet – probiere sie aus.",
        body: `
          <div class="tut-callout">
            <div class="tut-callout-title">Nächster Schritt</div>
            <div class="tut-callout-body">
              Schalte jetzt so viele Features frei, wie du schaffst – später über echte SQL-Missionen (Platzhalter sind vorbereitet).
            </div>
          </div>
        `
      }
    ];
  }

  renderKeysBody() {
    // Based on the DB schema comment in script.js (Schulazon Shop).
    return `
      <div class="tut-grid-2">
        <div class="tut-panel">
          <div class="tut-panel-title">Begriffe</div>
          <ul class="tut-list">
            <li><strong>Primärschlüssel (PK)</strong>: identifiziert einen Datensatz eindeutig (z. B. <code>produkte.id</code>).</li>
            <li><strong>Fremdschlüssel (FK)</strong>: verweist auf den PK einer anderen Tabelle (z. B. <code>produkte.kategorie_id</code> → <code>kategorien.id</code>).</li>
          </ul>
        </div>

        <div class="tut-panel">
          <div class="tut-panel-title">Schulazon – stark vereinfacht</div>
          <div class="tut-schema">
            <div class="tut-table">
              <div class="tut-table-head">kategorien</div>
              <div class="tut-table-row"><span class="pill pk">PK</span> id</div>
              <div class="tut-table-row">name</div>
            </div>

            <div class="tut-arrow" aria-hidden="true">→</div>

            <div class="tut-table">
              <div class="tut-table-head">produkte</div>
              <div class="tut-table-row"><span class="pill pk">PK</span> id</div>
              <div class="tut-table-row">name</div>
              <div class="tut-table-row">preis</div>
              <div class="tut-table-row"><span class="pill fk">FK</span> kategorie_id</div>
              <div class="tut-table-row">lagerbestand</div>
              <div class="tut-table-row">liefertage</div>
            </div>
          </div>

          <div class="tut-hint">
            Merke: FK-Felder sind das technische Bindeglied für JOINs.
          </div>
        </div>
      </div>
    `;
  }

  buildAggregateExercises() {
    return [
      {
        id: "agg1",
        prompt: "Wie viele Produkte gibt es?",
        template: `SELECT <select data-blank="fn">
          <option value="">…</option>
          <option value="COUNT">COUNT</option>
          <option value="SUM">SUM</option>
          <option value="AVG">AVG</option>
          <option value="MIN">MIN</option>
          <option value="MAX">MAX</option>
        </select>(*) AS <select data-blank="alias">
          <option value="">…</option>
          <option value="anzahl">anzahl</option>
          <option value="summe">summe</option>
          <option value="durchschnitt">durchschnitt</option>
        </select>
        FROM produkte;`,
        solution: { fn: "COUNT", alias: "anzahl" }
      },
      {
        id: "agg2",
        prompt: "Was ist der Durchschnittspreis?",
        template: `SELECT <select data-blank="fn">
          <option value="">…</option>
          <option value="COUNT">COUNT</option>
          <option value="SUM">SUM</option>
          <option value="AVG">AVG</option>
          <option value="MIN">MIN</option>
          <option value="MAX">MAX</option>
        </select>(preis) AS <select data-blank="alias">
          <option value="">…</option>
          <option value="durchschnittspreis">durchschnittspreis</option>
          <option value="minpreis">minpreis</option>
          <option value="maxpreis">maxpreis</option>
        </select>
        FROM produkte;`,
        solution: { fn: "AVG", alias: "durchschnittspreis" }
      }
    ];
  }

  buildGroupByExercises() {
    return [
      {
        id: "gb1",
        prompt: "Wie viele Produkte gibt es pro Kategorie (nur Kategorien mit ≥ 2 Produkten)?",
        template: `SELECT kategorie_id, COUNT(*) AS anzahl
        FROM produkte
        <select data-blank="groupby">
          <option value="">…</option>
          <option value="GROUP BY">GROUP BY</option>
          <option value="ORDER BY">ORDER BY</option>
          <option value="WHERE">WHERE</option>
        </select> kategorie_id
        <select data-blank="having">
          <option value="">…</option>
          <option value="HAVING">HAVING</option>
          <option value="WHERE">WHERE</option>
          <option value="LIMIT">LIMIT</option>
        </select> COUNT(*) >= 2;`,
        solution: { groupby: "GROUP BY", having: "HAVING" }
      }
    ];
  }

  async mount() {
    // Ensure the bottom progress dock stays visible: disable outer scroll, use inner scroll.
    const pane = document.querySelector(".mode-right");
    if (pane) {
      pane.style.overflow = "hidden";
      pane.style.padding = "16px";
    }

    this.renderShell();
    await this.shop.ready;

    // Guided: start locked to keep focus; unlocks happen via tutorial.
    await this.lockAllShopTasks(true);

    this.renderStep();
    this.setStatus("Bereit.");
  }

  async lockAllShopTasks(locked) {
    const ids = typeof ALL_TASK_IDS !== "undefined" ? ALL_TASK_IDS : [];
    for (const id of ids) await this.shop.lock(id, locked);
  }

  /* ---------- Shop click routing ---------- */

  onShopSelect(actionId) {
    if (!actionId) return;

    this.clickedGlobal.add(actionId);

    const step = this.steps[this.stepIndex];
    if (!step) return;

    if (step.type === "shopChecklist" || step.type === "shopTask") {
      const st = this.getStepState(step.id, () => ({
        clicked: new Set(),
        done: false,
        unlocked: false
      }));

      st.clicked.add(actionId);
      this.updateShopTaskUI(step, st);
    }
  }

  /* ---------- UI Shell ---------- */

  renderShell() {
    this.root.innerHTML = `
      <style>
        /* Guided tutorial – isolated style scope (tut-*) */

        .tut-shell{
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 0;
        }

        .tut-header{
          position: relative;
          border-radius: 18px;
          padding: 14px 14px 12px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.05);
          backdrop-filter: blur(10px);
          overflow: hidden;
        }

        .tut-header::before{
          content:"";
          position:absolute;
          inset:-45% -25%;
          background:
            radial-gradient(circle at 20% 15%, rgba(34,197,94,.18), transparent 45%),
            radial-gradient(circle at 80% 85%, rgba(251,191,36,.14), transparent 55%);
          filter: blur(18px);
          pointer-events:none;
        }

        .tut-header-inner{ position:relative; z-index:1; display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .tut-title{ margin:0; font-size:16px; font-weight:900; letter-spacing:.01em; }
        .tut-sub{ margin-top:2px; font-size:12px; color: rgba(232,238,252,.72); }

        .tut-status{
          font-size:12px;
          color: rgba(232,238,252,.78);
          display:flex;
          align-items:center;
          gap:10px;
          justify-content:flex-end;
          text-align:right;
          min-width: 140px;
        }

        .tut-scroll{
          flex: 1;
          min-height: 0;
          overflow: auto;
          padding-right: 4px;
        }

        .tut-scroll::-webkit-scrollbar{ width: 10px; }
        .tut-scroll::-webkit-scrollbar-thumb{
          background: rgba(255,255,255,.10);
          border-radius: 999px;
          border: 2px solid rgba(0,0,0,0);
          background-clip: padding-box;
        }

        .tut-card{
          position: relative;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.05);
          box-shadow: 0 18px 60px rgba(0,0,0,.35);
          overflow: hidden;
        }

        .tut-card::before{
          content:"";
          position:absolute;
          inset:-55% -35%;
          background:
            radial-gradient(circle at 30% 20%, rgba(59,130,246,.12), transparent 45%),
            radial-gradient(circle at 70% 70%, rgba(34,197,94,.10), transparent 55%);
          filter: blur(18px);
          pointer-events:none;
        }

        .tut-card-inner{
          position: relative;
          z-index: 1;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .tut-step-title{ margin:0; font-size:16px; font-weight:900; letter-spacing:.01em; }
        .tut-lead{ margin:0; font-size:13px; color: rgba(232,238,252,.88); line-height: 1.55; }

        .tut-divider{ height:1px; background: rgba(255,255,255,.08); margin: 2px 0; }

        .tut-callout{
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(2,6,23,.45);
          padding: 12px;
        }
        .tut-callout-title{ font-size:12px; font-weight:900; letter-spacing:.06em; text-transform: uppercase; color: rgba(232,238,252,.72); }
        .tut-callout-body{ margin-top:6px; font-size:13px; color: rgba(232,238,252,.90); line-height: 1.55; }

        .tut-panel{
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(2,6,23,.40);
          padding: 12px;
        }
        .tut-panel-title{ font-size:12px; font-weight:900; color: rgba(232,238,252,.80); margin-bottom: 8px; }
        .tut-hint{
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(34,197,94,.18);
          background: rgba(34,197,94,.08);
          color: rgba(187,247,208,.92);
          font-size: 13px;
        }

        .tut-list{ margin:0; padding-left: 18px; color: rgba(232,238,252,.92); font-size: 13px; line-height: 1.55; }
        .tut-list li{ margin: 6px 0; }

        .tut-grid-2{
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 980px){
          .tut-grid-2{ grid-template-columns: 1fr; }
        }

        /* Schema mini-visual */
        .tut-schema{
          display:flex;
          align-items: stretch;
          gap: 12px;
          flex-wrap: wrap;
        }
        .tut-table{
          min-width: 220px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.06);
          overflow: hidden;
        }
        .tut-table-head{
          padding: 10px 12px;
          font-size: 12px;
          font-weight: 900;
          color: rgba(232,238,252,.92);
          border-bottom: 1px solid rgba(255,255,255,.08);
          background: rgba(255,255,255,.04);
        }
        .tut-table-row{
          padding: 8px 12px;
          display:flex;
          gap: 10px;
          align-items:center;
          border-bottom: 1px solid rgba(255,255,255,.06);
          font-size: 13px;
          color: rgba(232,238,252,.90);
        }
        .tut-table-row:last-child{ border-bottom:none; }

        .pill{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-width: 34px;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: .04em;
        }
        .pill.pk{ background: rgba(59,130,246,.18); border: 1px solid rgba(59,130,246,.30); color: rgba(191,219,254,.95); }
        .pill.fk{ background: rgba(251,191,36,.14); border: 1px solid rgba(251,191,36,.30); color: rgba(254,243,199,.95); }

        .tut-arrow{
          display:flex;
          align-items:center;
          justify-content:center;
          font-size: 18px;
          font-weight: 900;
          opacity: .75;
          padding: 0 4px;
        }

        /* Match (Zuordnung) */
        .tut-match{
          display:grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 980px){
          .tut-match{ grid-template-columns: 1fr; }
        }

        .tut-match-col{
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(2,6,23,.35);
          padding: 12px;
        }
        .tut-match-head{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
          margin-bottom: 10px;
        }
        .tut-match-title{
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: rgba(232,238,252,.70);
        }
        .tut-chip-grid{
          display:grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }

        .tut-chip{
          width: 100%;
          text-align: left;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.06);
          color: rgba(232,238,252,.95);
          border-radius: 14px;
          padding: 10px 12px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 800;
          transition: transform .12s ease, background .12s ease, box-shadow .12s ease, border-color .12s ease;
        }
        .tut-chip:hover{ transform: translateY(-1px); background: rgba(255,255,255,.09); box-shadow: 0 14px 40px rgba(0,0,0,.22); }
        .tut-chip:disabled{ opacity:.55; cursor:not-allowed; transform:none; box-shadow:none; }

        .tut-chip.selected{
          border-color: rgba(251,191,36,.45);
          box-shadow: 0 0 0 3px rgba(251,191,36,.12);
        }

        .tut-chip.matched{
          border-color: rgba(34,197,94,.45);
          background: rgba(34,197,94,.10);
        }

        .tut-chip.wrong{
          animation: tutshake .22s ease-in-out;
          border-color: rgba(248,113,113,.55);
          box-shadow: 0 0 0 3px rgba(248,113,113,.10);
        }

        @keyframes tutshake{
          0%{ transform: translateX(0); }
          25%{ transform: translateX(-4px); }
          50%{ transform: translateX(4px); }
          75%{ transform: translateX(-3px); }
          100%{ transform: translateX(0); }
        }

        .tut-inline-actions{
          display:flex;
          gap: 10px;
          justify-content:flex-end;
          flex-wrap:wrap;
        }

        .tut-btn{
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.06);
          color: #e8eefc;
          border-radius: 12px;
          padding: 10px 12px;
          cursor: pointer;
          font-weight: 900;
          font-size: 13px;
          transition: transform .12s ease, background .12s ease, opacity .12s ease;
        }
        .tut-btn:hover{ transform: translateY(-1px); background: rgba(255,255,255,.10); }
        .tut-btn:disabled{ opacity:.45; cursor:not-allowed; transform:none; }

        .tut-btn.primary{
          border: none;
          background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(74,222,128,.95));
          color: #052e16;
        }

        .tut-btn.warning{
          border: none;
          background: linear-gradient(90deg, rgba(240,136,4,.92), rgba(251,191,36,.92));
          color: #1f2937;
        }

        .tut-code{
          margin: 0;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(2,6,23,.55);
          color: rgba(232,238,252,.92);
          font-size: 12px;
          overflow: auto;
          white-space: pre;
        }

        .tut-table-mini{
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
          color: rgba(232,238,252,.92);
          border-radius: 14px;
          overflow: hidden;
        }
        .tut-table-mini th,
        .tut-table-mini td{
          padding: 10px 10px;
          border-top: 1px solid rgba(255,255,255,.08);
          vertical-align: top;
        }
        .tut-table-mini th{
          text-align: left;
          font-weight: 900;
          color: rgba(232,238,252,.75);
          background: rgba(255,255,255,.04);
          border-top: none;
        }

        /* Shop checklist chips */
        .tut-chiplist{
          display:flex;
          flex-wrap:wrap;
          gap: 8px;
        }
        .tut-taskchip{
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.06);
          color: rgba(232,238,252,.92);
          padding: 8px 10px;
          font-size: 12px;
          font-weight: 800;
          display:inline-flex;
          align-items:center;
          gap: 8px;
          transition: background .12s ease, border-color .12s ease;
          user-select: none;
        }
        .tut-taskchip .dot{
          width: 10px; height:10px; border-radius: 50%;
          background: rgba(255,255,255,.22);
        }
        .tut-taskchip.done{
          border-color: rgba(34,197,94,.40);
          background: rgba(34,197,94,.10);
        }
        .tut-taskchip.done .dot{
          background: rgba(34,197,94,.85);
        }

        .tut-group{ display:flex; flex-direction:column; gap: 10px; }
        .tut-group-title{
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: rgba(232,238,252,.70);
        }

        /* Fill-in exercises */
        .tut-ex{
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(2,6,23,.40);
          padding: 12px;
          display:flex;
          flex-direction:column;
          gap: 10px;
        }
        .tut-ex-prompt{ font-size: 13px; color: rgba(232,238,252,.90); font-weight: 800; }
        .tut-ex select{
          background: rgba(255,255,255,.06);
          color: rgba(232,238,252,.95);
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 10px;
          padding: 6px 8px;
          font-weight: 900;
          margin: 0 4px;
          outline: none;
        }
        .tut-ex select:focus{ box-shadow: 0 0 0 3px rgba(59,130,246,.12); border-color: rgba(59,130,246,.35); }

        .tut-ok{
          padding: 10px 12px;
          border-radius: 14px;
          border: 1px solid rgba(34,197,94,.18);
          background: rgba(34,197,94,.08);
          color: rgba(187,247,208,.92);
          font-size: 13px;
          display:none;
        }
        .tut-ok.show{ display:block; }

        /* Diagram */
        .tut-diagram{
          display:flex;
          align-items:center;
          justify-content:center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .tut-node{
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.06);
          padding: 12px 14px;
          min-width: 220px;
          box-shadow: 0 14px 40px rgba(0,0,0,.22);
        }
        .tut-node-title{
          display:flex;
          align-items:baseline;
          justify-content:space-between;
          gap: 10px;
          font-weight: 900;
        }
        .tut-node-title span{ font-size: 13px; }
        .tut-node-title em{
          font-style: normal;
          font-size: 12px;
          opacity: .75;
          font-weight: 900;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
        .tut-node-foot{ margin-top:8px; font-size:12px; opacity:.85; }

        /* Bottom dock */
        .tut-dock{
          flex-shrink: 0;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.05);
          backdrop-filter: blur(10px);
          padding: 12px;
        }
        .tut-dock-top{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap: 12px;
          margin-bottom: 10px;
        }
        .tut-dock-meta{
          min-width: 0;
        }
        .tut-dock-step{
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .06em;
          text-transform: uppercase;
          color: rgba(232,238,252,.70);
        }
        .tut-dock-name{
          margin-top: 3px;
          font-size: 13px;
          font-weight: 900;
          color: rgba(232,238,252,.95);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 520px;
        }
        .tut-dock-pct{
          font-size: 12px;
          font-weight: 900;
          color: rgba(232,238,252,.85);
          white-space: nowrap;
        }

        .tut-progress{
          height: 10px;
          border-radius: 999px;
          background: rgba(255,255,255,.08);
          overflow: hidden;
          margin-bottom: 10px;
        }
        .tut-progress-fill{
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, rgba(34,197,94,.95), rgba(74,222,128,.95));
          transition: width .35s ease;
        }

        .tut-dock-actions{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 10px;
        }

        .tut-nav{
          display:flex;
          gap: 10px;
        }

        .tut-muted{ opacity:.8; font-size: 12px; }

        /* DISTINCT demo */
        .tut-distinct{
          display:flex;
          flex-direction:column;
          gap: 10px;
        }
        .tut-toggle{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 12px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(2,6,23,.40);
        }
        .tut-toggle strong{ font-size: 13px; }
        .tut-switch{
          width: 48px;
          height: 28px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.08);
          position: relative;
          cursor: pointer;
        }
        .tut-switch::after{
          content:"";
          width: 22px; height: 22px;
          border-radius: 50%;
          position: absolute;
          top: 2px; left: 2px;
          background: rgba(232,238,252,.92);
          transition: transform .18s ease;
        }
        .tut-switch.on{
          background: rgba(34,197,94,.18);
          border-color: rgba(34,197,94,.30);
        }
        .tut-switch.on::after{ transform: translateX(20px); background: rgba(187,247,208,.95); }

        .strike{
          text-decoration: line-through;
          color: rgba(248,113,113,.95);
        }
      </style>

      <div class="tut-shell">
        <div class="tut-header">
          <div class="tut-header-inner">
            <div>
              <div class="tut-title">Angeleiteter Modus</div>
              <div class="tut-sub" id="tutSub">Tutorial</div>
            </div>
            <div class="tut-status">
              <span id="tutStatus">Initialisiere…</span>
            </div>
          </div>
        </div>

        <div class="tut-scroll" id="tutScroll">
          <div class="tut-card">
            <div class="tut-card-inner" id="tutCard"></div>
          </div>
        </div>

        <div class="tut-dock">
          <div class="tut-dock-top">
            <div class="tut-dock-meta">
              <div class="tut-dock-step" id="tutStepMeta">Kapitel 1/1</div>
              <div class="tut-dock-name" id="tutStepName">…</div>
            </div>
            <div class="tut-dock-pct" id="tutPct">0%</div>
          </div>

          <div class="tut-progress"><div class="tut-progress-fill" id="tutProgressFill"></div></div>

          <div class="tut-dock-actions">
            <div class="tut-muted" id="tutGateHint"></div>
            <div class="tut-nav">
              <button class="tut-btn" id="tutPrev">Zurück</button>
              <button class="tut-btn primary" id="tutNext">Weiter</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.cardEl = this.root.querySelector("#tutCard");
    this.statusEl = this.root.querySelector("#tutStatus");
    this.subEl = this.root.querySelector("#tutSub");
    this.prevBtn = this.root.querySelector("#tutPrev");
    this.nextBtn = this.root.querySelector("#tutNext");
    this.stepMetaEl = this.root.querySelector("#tutStepMeta");
    this.stepNameEl = this.root.querySelector("#tutStepName");
    this.pctEl = this.root.querySelector("#tutPct");
    this.progressFillEl = this.root.querySelector("#tutProgressFill");
    this.gateHintEl = this.root.querySelector("#tutGateHint");

    this.prevBtn.addEventListener("click", () => this.go(-1));
    this.nextBtn.addEventListener("click", () => this.go(1));
  }

  setStatus(text) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
  }

  /* ---------- Render steps ---------- */

  renderStep() {
    const step = this.steps[this.stepIndex];
    if (!step) return;

    this.subEl.textContent = step.title;

    if (step.type === "match") this.renderMatchStep(step);
    else if (step.type === "info") this.renderInfoStep(step);
    else if (step.type === "interactive") this.renderInteractiveStep(step);
    else if (step.type === "shopChecklist") this.renderShopChecklistStep(step);
    else if (step.type === "shopTask") this.renderShopTaskStep(step);
    else if (step.type === "fill") this.renderFillStep(step);
    else if (step.type === "diagram") this.renderDiagramStep(step);
    else if (step.type === "confirm") this.renderConfirmStep(step);
    else this.renderInfoStep(step);

    this.updateProgressUI();
    this.updateGate();

    this.prevBtn.disabled = this.stepIndex <= 0;

    const sc = this.root.querySelector("#tutScroll");
    if (sc) sc.scrollTop = 0;
  }

  updateProgressUI() {
    const total = this.steps.length;
    const idx = this.stepIndex + 1;
    const pct = total > 0 ? Math.round((idx / total) * 100) : 0;

    this.stepMetaEl.textContent = `Kapitel ${idx}/${total}`;
    this.stepNameEl.textContent = this.steps[this.stepIndex]?.title || "";
    this.pctEl.textContent = `${pct}%`;
    this.progressFillEl.style.width = `${pct}%`;
    this.nextBtn.textContent = (idx === total) ? "Fertig" : "Weiter";
  }

  updateGate() {
    const step = this.steps[this.stepIndex];
    const enabled = this.isStepComplete(step);
    this.nextBtn.disabled = !enabled;

    if (enabled) {
      this.gateHintEl.textContent = "";
      return;
    }

    if (step?.type === "match") this.gateHintEl.textContent = "Zuordnung abschließen, um fortzufahren.";
    else if (step?.type === "shopChecklist") this.gateHintEl.textContent = "Alle Chips durch Anklicken im Shop abhaken.";
    else if (step?.type === "shopTask") this.gateHintEl.textContent = "Geforderte Shop-Buttons anklicken.";
    else if (step?.type === "fill") this.gateHintEl.textContent = "Lücken korrekt ausfüllen.";
    else if (step?.type === "confirm") this.gateHintEl.textContent = "„Verstanden“ anklicken.";
    else this.gateHintEl.textContent = "";
  }

  isStepComplete(step) {
    if (!step) return true;
    if (step.type === "info" || step.type === "diagram") return true;

    const st = this.stepState[step.id];
    if (step.type === "interactive") return true; // informational; no gate

    return !!st?.done;
  }

  go(delta) {
    const next = this.stepIndex + delta;
    if (next < 0 || next >= this.steps.length) return;
    this.stepIndex = next;
    this.renderStep();
  }

  /* ---------- Step renderers ---------- */

  renderBase(step, innerHtml) {
    this.cardEl.innerHTML = `
      <h3 class="tut-step-title">${this.escape(step.title)}</h3>
      <p class="tut-lead">${this.escape(step.lead || "")}</p>
      <div class="tut-divider"></div>
      ${innerHtml || ""}
    `;
  }

  renderInfoStep(step) {
    this.renderBase(step, step.body || "");
  }

  renderDiagramStep(step) {
    const d = step.diagram || {};
    this.renderBase(step, `
      <div class="tut-diagram">
        <div class="tut-node">
          <div class="tut-node-title"><span>${this.escape(d.left?.title || "")}</span><em>${this.escape(d.left?.note || "")}</em></div>
          ${d.left?.foot ? `<div class="tut-node-foot">${this.escape(d.left.foot)}</div>` : ""}
        </div>

        <div class="tut-arrow">→</div>

        ${d.mid ? `
          <div class="tut-node">
            <div class="tut-node-title"><span>${this.escape(d.mid.title)}</span><em>${this.escape(d.mid.note || "")}</em></div>
            ${d.mid.foot ? `<div class="tut-node-foot">${this.escape(d.mid.foot)}</div>` : ""}
          </div>
          <div class="tut-arrow">→</div>
        ` : ""}

        <div class="tut-node">
          <div class="tut-node-title"><span>${this.escape(d.right?.title || "")}</span><em>${this.escape(d.right?.note || "")}</em></div>
          ${d.right?.foot ? `<div class="tut-node-foot">${this.escape(d.right.foot)}</div>` : ""}
        </div>
      </div>
    `);
  }

  renderConfirmStep(step) {
    const st = this.getStepState(step.id, () => ({ done: false }));
    this.renderBase(step, `
      <div class="tut-callout">
        <div class="tut-callout-title">Hinweis</div>
        <div class="tut-callout-body">
          Wenn du personenbezogene Daten speicherst oder verarbeitest, musst du besonders sorgfältig sein (Zugriff, Zweckbindung, Minimierung).
        </div>
      </div>

      <div class="tut-inline-actions">
        <button class="tut-btn warning" id="tutConfirmBtn">${this.escape(step.confirmLabel || "Verstanden")}</button>
      </div>
    `);

    const btn = this.root.querySelector("#tutConfirmBtn");
    btn.addEventListener("click", () => {
      st.done = true;
      btn.disabled = true;
      btn.textContent = "✓ Bestätigt";
      this.updateGate();
    });
  }

  renderInteractiveStep(step) {
    if (step.widget === "distinctDemo") return this.renderDistinctDemoStep(step);
    this.renderInfoStep(step);
  }

  renderDistinctDemoStep(step) {
    // informational; no gating
    this.renderBase(step, `
      <div class="tut-distinct">
        <div class="tut-toggle">
          <div>
            <strong>DISTINCT anwenden</strong>
            <div class="tut-muted" style="margin-top:4px;">Duplikate werden entfernt (oder in der Liste ignoriert).</div>
          </div>
          <div class="tut-switch" id="tutDistinctSwitch" role="switch" aria-checked="false" tabindex="0"></div>
        </div>

        <div class="tut-panel">
          <div class="tut-panel-title">Beispiel (vereinfachte Ergebnisspalte: kategorie_id)</div>
          <pre class="tut-code" id="tutDistinctSql"></pre>
          <table class="tut-table-mini" id="tutDistinctTable"></table>
        </div>

        <div class="tut-callout">
          <div class="tut-callout-title">Merksatz</div>
          <div class="tut-callout-body">
            <code>SELECT DISTINCT spalte</code> liefert jede Ausprägung nur einmal.
          </div>
        </div>
      </div>
    `);

    const st = this.getStepState(step.id, () => ({ distinct: false }));
    const sw = this.root.querySelector("#tutDistinctSwitch");
    const sqlEl = this.root.querySelector("#tutDistinctSql");
    const tableEl = this.root.querySelector("#tutDistinctTable");

    const raw = [
      { kategorie_id: 1 },
      { kategorie_id: 1 },
      { kategorie_id: 2 },
      { kategorie_id: 3 },
      { kategorie_id: 3 }
    ];

    const render = () => {
      const isOn = !!st.distinct;
      sw.classList.toggle("on", isOn);
      sw.setAttribute("aria-checked", isOn ? "true" : "false");

      sqlEl.textContent = isOn
        ? "SELECT DISTINCT kategorie_id FROM produkte;"
        : "SELECT kategorie_id FROM produkte;";

      const rows = isOn
        ? Array.from(new Set(raw.map(r => r.kategorie_id))).map(v => ({ kategorie_id: v }))
        : raw;

      const seen = new Set();
      const bodyRows = rows.map((r) => {
        const dup = !isOn && seen.has(r.kategorie_id);
        seen.add(r.kategorie_id);
        return `<tr><td class="${dup ? "strike" : ""}">${this.escape(String(r.kategorie_id))}</td></tr>`;
      }).join("");

      tableEl.innerHTML = `
        <thead><tr><th>kategorie_id</th></tr></thead>
        <tbody>${bodyRows}</tbody>
      `;
    };

    const toggle = () => { st.distinct = !st.distinct; render(); };
    sw.addEventListener("click", toggle);
    sw.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); }
    });

    render();
  }

  renderMatchStep(step) {
    const st = this.getStepState(step.id, () => ({
      done: false,
      activeLeft: null,
      activeRight: null,
      matchedLeft: new Set(),
      matchedRight: new Set()
    }));

    if (!st.rightOrder) st.rightOrder = step.pairs.map(p => p.right).slice().sort(() => Math.random() - 0.5);

    const leftHtml = step.pairs.map((p) => {
      const isMatched = st.matchedLeft.has(p.left);
      return `<button class="tut-chip ${isMatched ? "matched" : ""}" data-left="${this.escapeAttr(p.left)}" ${isMatched ? "disabled" : ""}>${this.escape(p.left)}</button>`;
    }).join("");

    const rightHtml = st.rightOrder.map((r) => {
      const isMatched = st.matchedRight.has(r);
      return `<button class="tut-chip ${isMatched ? "matched" : ""}" data-right="${this.escapeAttr(r)}" ${isMatched ? "disabled" : ""}>${this.escape(r)}</button>`;
    }).join("");

    this.renderBase(step, `
      <div class="tut-match">
        <div class="tut-match-col">
          <div class="tut-match-head">
            <div class="tut-match-title">Baustein</div>
            <div class="tut-muted">${st.matchedLeft.size}/${step.pairs.length}</div>
          </div>
          <div class="tut-chip-grid" id="tutLeftCol">${leftHtml}</div>
        </div>

        <div class="tut-match-col">
          <div class="tut-match-head">
            <div class="tut-match-title">Zweck</div>
            <div class="tut-inline-actions">
              <button class="tut-btn" id="tutResetMatch">Reset</button>
            </div>
          </div>
          <div class="tut-chip-grid" id="tutRightCol">${rightHtml}</div>
        </div>
      </div>

      <div class="tut-ok" id="tutMatchOk">✓ Zuordnung korrekt. Du kannst weiter.</div>
    `);

    const leftCol = this.root.querySelector("#tutLeftCol");
    const rightCol = this.root.querySelector("#tutRightCol");
    const okEl = this.root.querySelector("#tutMatchOk");
    const resetBtn = this.root.querySelector("#tutResetMatch");

    const clearSelection = () => {
      st.activeLeft = null;
      st.activeRight = null;
      this.root.querySelectorAll(".tut-chip.selected").forEach(el => el.classList.remove("selected"));
    };

    const markSelected = () => {
      this.root.querySelectorAll(".tut-chip").forEach(el => el.classList.remove("selected"));
      if (st.activeLeft) this.root.querySelector(`[data-left="${this.escapeAttr(st.activeLeft)}"]`)?.classList.add("selected");
      if (st.activeRight) this.root.querySelector(`[data-right="${this.escapeAttr(st.activeRight)}"]`)?.classList.add("selected");
    };

    const checkPair = (left, right) => {
      const expected = (step.pairs.find(p => p.left === left) || {}).right;
      return expected === right;
    };

    const tryResolve = () => {
      if (!st.activeLeft || !st.activeRight) return;

      const left = st.activeLeft;
      const right = st.activeRight;

      if (checkPair(left, right)) {
        st.matchedLeft.add(left);
        st.matchedRight.add(right);

        const lEl = this.root.querySelector(`[data-left="${this.escapeAttr(left)}"]`);
        const rEl = this.root.querySelector(`[data-right="${this.escapeAttr(right)}"]`);
        lEl?.classList.add("matched"); rEl?.classList.add("matched");
        if (lEl) lEl.disabled = true;
        if (rEl) rEl.disabled = true;

        clearSelection();

        if (st.matchedLeft.size === step.pairs.length) {
          st.done = true;
          okEl.classList.add("show");
          this.updateGate();
        }
        return;
      }

      const rEl = this.root.querySelector(`[data-right="${this.escapeAttr(right)}"]`);
      rEl?.classList.add("wrong");
      setTimeout(() => rEl?.classList.remove("wrong"), 260);
      clearSelection();
    };

    leftCol.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-left]");
      if (!btn || btn.disabled) return;
      st.activeLeft = btn.getAttribute("data-left");
      markSelected();
      tryResolve();
    });

    rightCol.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-right]");
      if (!btn || btn.disabled) return;
      st.activeRight = btn.getAttribute("data-right");
      markSelected();
      tryResolve();
    });

    resetBtn.addEventListener("click", () => {
      this.stepState[step.id] = null;
      delete this.stepState[step.id];
      this.renderStep();
    });

    // restore completion state if user navigates back
    if (st.done) okEl.classList.add("show");
  }

  renderShopChecklistStep(step) {
    const st = this.getStepState(step.id, () => ({ clicked: new Set(), done: false, unlocked: false }));

    const groups = [
      { title: "Shop-Bar", ids: ["all","express","bestseller","available"] },
      { title: "Kategorien", ids: ["cat-electronics","cat-household","cat-sport"] },
      { title: "Preisfilter", ids: ["price-25","price-50","price-100"] },
      { title: "Rating", ids: ["rating-5","rating-4"] },
      { title: "Sortierung", ids: ["priceAsc","priceDesc","popularity"] },
      { title: "Suche", ids: ["search"] },
      { title: "Panels", ids: ["orders","topProducts"] },
          ];

    const renderGroup = (g) => {
      const chips = g.ids.map((id) => {
        const done = st.clicked.has(id);
        const label = (step.labels && step.labels[id]) ? step.labels[id] : id;
        return `<span class="tut-taskchip ${done ? "done" : ""}" data-taskchip="${this.escapeAttr(id)}"><span class="dot"></span>${this.escape(label)}</span>`;
      }).join("");
      return `
        <div class="tut-group">
          <div class="tut-group-title">${this.escape(g.title)}</div>
          <div class="tut-chiplist">${chips}</div>
        </div>
      `;
    };

    const totalRequired = (step.required || []).length;
    const doneCount = (step.required || []).filter(id => st.clicked.has(id)).length;

    this.renderBase(step, `
      <div class="tut-callout">
        <div class="tut-callout-title">Ziel</div>
        <div class="tut-callout-body">
          Einmal überall klicken, um die Funktionen zu sehen. Fortschritt: <strong id="tutChecklistProgress">${doneCount}/${totalRequired}</strong>
        </div>
      </div>

      ${groups.map(renderGroup).join("")}

      <div class="tut-ok" id="tutShopOk">✓ Fertig. Du kannst weiter.</div>
    `);

    this.updateShopTaskUI(step, st);
  }

  renderShopTaskStep(step) {
    const st = this.getStepState(step.id, () => ({ clicked: new Set(), done: false, unlocked: false }));

    const req = (step.required || []).map((id) => {
      const label = (step.labels && step.labels[id]) ? step.labels[id] : id;
      const done = st.clicked.has(id);
      return `<span class="tut-taskchip ${done ? "done" : ""}" data-taskchip="${this.escapeAttr(id)}"><span class="dot"></span>${this.escape(label)}</span>`;
    }).join("");

    const tables = (step.tables || []).map((t) => {
      const rows = (t.rows || []).map(r => `<tr><td>${this.escape(r[0])}</td><td>${this.escape(r[1])}</td></tr>`).join("");
      return `
        <div class="tut-panel" style="margin-top:10px;">
          <div class="tut-panel-title">${this.escape(t.title)}</div>
          <table class="tut-table-mini">
            <thead><tr><th>Symbol</th><th>Bedeutung</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join("");

    const placeholder = step.sqlPlaceholder ? `
      <div class="tut-callout">
        <div class="tut-callout-title">${this.escape(step.sqlPlaceholder.title)}</div>
        <div class="tut-callout-body">${this.escape(step.sqlPlaceholder.text)}</div>
      </div>
    ` : "";

    this.renderBase(step, `
      <div class="tut-grid-2">
        <div class="tut-panel">
          <div class="tut-panel-title">Aufgabe</div>
          <div class="tut-muted" style="margin-bottom:10px;">Klicke diese Shop-Buttons:</div>
          <div class="tut-chiplist">${req}</div>
          <div class="tut-hint">Tipp: Filter ≈ WHERE, Sortierung ≈ ORDER BY.</div>
          <div class="tut-ok" id="tutShopOk">✓ Fertig. Du kannst weiter.</div>
        </div>

        <div class="tut-panel">
          <div class="tut-panel-title">Kurzreferenz</div>
          ${tables || `<div class="tut-muted">—</div>`}
        </div>
      </div>

      ${placeholder}
    `);

    this.updateShopTaskUI(step, st);
  }

  updateShopTaskUI(step, st) {
    const required = step.required || [];

    // Update chips
    required.forEach((id) => {
      const chip = this.root.querySelector(`[data-taskchip="${this.escapeAttr(id)}"]`);
      if (chip) chip.classList.toggle("done", st.clicked.has(id));
    });

    // Checklist progress number (if present)
    const progressEl = this.root.querySelector("#tutChecklistProgress");
    if (progressEl) {
      const total = required.length;
      const done = required.filter(id => st.clicked.has(id)).length;
      progressEl.textContent = `${done}/${total}`;
    }

    // Completion
    const done = required.length > 0 && required.every(id => st.clicked.has(id));
    st.done = done;

    const okEl = this.root.querySelector("#tutShopOk");
    if (okEl) okEl.classList.toggle("show", done);

    // Unlock once, if configured
    if (done && step.unlockWhenDone && Array.isArray(step.unlockWhenDone) && !st.unlocked) {
      st.unlocked = true;
      this.unlockTasks(step.unlockWhenDone).catch(() => {});
    }

    this.updateGate();
  }

  async unlockTasks(ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    for (const id of ids) {
      try { await this.shop.lock(id, false); } catch (_) {}
    }
  }

  renderFillStep(step) {
    const st = this.getStepState(step.id, () => ({ done: false, answers: {} }));

    const aggTable = step.aggregatesTable ? `
      <div class="tut-panel">
        <div class="tut-panel-title">Aggregatfunktionen</div>
        <table class="tut-table-mini">
          <thead><tr><th>Funktion</th><th>Zweck</th></tr></thead>
          <tbody>${step.aggregatesTable.map(r => `<tr><td>${this.escape(r[0])}</td><td>${this.escape(r[1])}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    ` : "";

    const exHtml = (step.exercises || []).map((ex) => `
      <div class="tut-ex" data-ex="${this.escapeAttr(ex.id)}">
        <div class="tut-ex-prompt">${this.escape(ex.prompt)}</div>
        <pre class="tut-code">${ex.template}</pre>
      </div>
    `).join("");

    this.renderBase(step, `
      ${aggTable}
      ${exHtml}
      <div class="tut-ok" id="tutFillOk">✓ Korrekt. Du kannst weiter.</div>
    `);

    const okEl = this.root.querySelector("#tutFillOk");

    // Hook selects inside code blocks
    this.root.querySelectorAll(".tut-ex").forEach((exEl) => {
      const exId = exEl.getAttribute("data-ex");
      const ex = (step.exercises || []).find(e => e.id === exId);
      if (!ex) return;

      exEl.querySelectorAll("select[data-blank]").forEach((sel) => {
        sel.addEventListener("change", () => {
          const blank = sel.getAttribute("data-blank");
          st.answers[`${exId}.${blank}`] = sel.value;
          this.checkFillStep(step, st, okEl);
        });
      });

      // Restore previous selections on back navigation
      exEl.querySelectorAll("select[data-blank]").forEach((sel) => {
        const blank = sel.getAttribute("data-blank");
        const key = `${exId}.${blank}`;
        if (st.answers[key]) sel.value = st.answers[key];
      });
    });

    this.checkFillStep(step, st, okEl);
  }

  checkFillStep(step, st, okEl) {
    const exercises = step.exercises || [];
    let allOk = true;

    for (const ex of exercises) {
      const sol = ex.solution || {};
      for (const [blank, val] of Object.entries(sol)) {
        const key = `${ex.id}.${blank}`;
        const got = st.answers[key] || "";
        if (got !== val) allOk = false;
      }
    }

    st.done = allOk;
    if (okEl) okEl.classList.toggle("show", allOk);
    this.updateGate();
  }

  /* ---------- Helpers ---------- */

  getStepState(stepId, initFn) {
    if (!this.stepState[stepId]) this.stepState[stepId] = initFn ? initFn() : {};
    return this.stepState[stepId];
  }

  escape(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[m]));
  }

  escapeAttr(s) {
    return this.escape(s).replace(/"/g, "&quot;");
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
  const mode = document.body.dataset.mode;
  const root = document.getElementById("modeRoot");
  if (!root) return;

  let m;
  if (mode === "free") m = new FreeMode(root);
  else if (mode === "guided") m = new GuidedMode(root);
  else if (mode === "test") m = new TestMode(root);
  else m = new FreeMode(root);

  // FreeMode mount ist async -> await ist ok
  const r = m.mount();
  if (r && typeof r.then === "function") await r;
});



