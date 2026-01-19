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

    // Aufgaben-Definitionen (auf data-task IDs gemappt)
    this.TASKS = this.buildTasks();

    // unlocked state (nur RAM, v1)
    this.unlocked = {};
    Object.keys(this.TASKS).forEach(id => this.unlocked[id] = false);

    // Shop-Klicks -> Aufgabe auswählen
    this.shop.onShopAction((actionId) => this.onShopSelect(actionId));

    this.currentId = null;
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

      "cart-refresh": {
        title: "Warenkorb aktualisieren",
        difficulty: "++",
        task:
`Aufgabe:
Aktualisiere die Anzeige des Warenkorbs.
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
        mode: "value"
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
        // returns text + numbers -> validate full rows (order matters)
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
        // returns text + numbers -> validate full rows (order matters)
        mode: "rows_order"
      }
    };
  }

  async mount() {
    this.renderShell();

    // 1) Shop: ALLES locken
    await this.shop.ready;
    await this.lockAllShopTasks(true);

    // 2) DB laden (für Validierung)
    await this.loadDb();

    // 3) Initialer Zustand (keine Aufgabe ausgewählt)
    this.setEmptyState(true);
  }

  renderShell() {
    const total = Object.keys(this.TASKS).length;

    this.root.innerHTML = `
      <div class="lab">
        <div class="lab-header">
          <div class="lab-header-top">
            <div class="lab-title">
              <h2>Programmierung</h2>
              <div class="lab-sub">Klicke links im Shop auf ein gesperrtes Feature, um die Aufgabe zu öffnen.</div>
            </div>

            <div class="lab-progress">
              <div class="lab-progress-meta">
                <span id="progressText">0 / ${total}</span>
                <span id="progressPct">0%</span>
              </div>
              <div class="progress-bar"><div id="progressFill" class="progress-fill"></div></div>
            </div>
          </div>

          <div class="lab-header-actions">
            <button class="btn" id="extraBtn" disabled>Zusatzaufgabe</button>
          </div>

          <div id="freeStatus" class="lab-sub" style="margin-top:10px;">DB wird geladen…</div>
        </div>

        <div class="lab-card">
          <div class="lab-card-inner">
            <div id="emptyState" class="empty-state">
              Keine Aufgabe ausgewählt.
            </div>

            <div id="editor" style="display:none; min-height:0; flex:1; flex-direction:column; gap:12px;">
              <div class="task-head">
                <div>
                  <div class="task-title" id="taskTitle"></div>
                  <div class="task-id" id="taskId"></div>
                </div>

                <div class="difficulty">
                  <div class="difficulty-label">Schwierigkeit</div>
                  <div class="difficulty-dots" id="diffDots">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                  </div>
                </div>
              </div>

              <div class="task-body" id="taskGoal"></div>

              <div class="editor">
                <textarea id="sqlInput" spellcheck="false"></textarea>
                <div class="editor-actions">
                  <button id="runBtn" class="btn">Prüfen</button>
                  <button id="unlockBtn" class="btn btn-primary" disabled>Freischalten</button>
                </div>
              </div>

              <pre id="out" class="output"></pre>
            </div>
          </div>
        </div>

        <div id="extraOverlay" class="overlay" role="dialog" aria-modal="true">
          <div class="overlay-panel">
            <div class="overlay-panel-inner">
              <div class="overlay-top">
                <h3 class="overlay-title">Zusatzaufgabe</h3>
                <button class="btn" id="extraClose">Schließen</button>
              </div>
              <div class="task-body">
                Platzhalter: Hier kommt später eine Zusatzaufgabe hin.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.statusEl = this.root.querySelector('#freeStatus');
    this.emptyEl = this.root.querySelector('#emptyState');
    this.editorEl = this.root.querySelector('#editor');

    this.titleEl = this.root.querySelector('#taskTitle');
    this.taskIdEl = this.root.querySelector('#taskId');
    this.goalEl = this.root.querySelector('#taskGoal');
    this.sqlEl = this.root.querySelector('#sqlInput');
    this.outEl = this.root.querySelector('#out');
    this.runBtn = this.root.querySelector('#runBtn');
    this.unlockBtn = this.root.querySelector('#unlockBtn');

    this.progressTextEl = this.root.querySelector('#progressText');
    this.progressPctEl = this.root.querySelector('#progressPct');
    this.progressFillEl = this.root.querySelector('#progressFill');
    this.extraBtn = this.root.querySelector('#extraBtn');

    this.diffDotsEl = this.root.querySelector('#diffDots');

    this.extraOverlayEl = this.root.querySelector('#extraOverlay');
    this.extraCloseEl = this.root.querySelector('#extraClose');

    this.runBtn.className = 'btn';

    this.runBtn.addEventListener('click', () => this.checkCurrent());
    this.unlockBtn.addEventListener('click', () => this.unlockCurrent());

    this.extraBtn.addEventListener('click', () => this.openExtraTask());
    this.extraCloseEl.addEventListener('click', () => this.closeExtraTask());
    this.extraOverlayEl.addEventListener('click', (e) => {
      if (e.target === this.extraOverlayEl) this.closeExtraTask();
    });

    this.totalTasks = total;
    this.updateProgressUI();
  }

  getUnlockedCount() {
    return Object.values(this.unlocked || {}).filter(Boolean).length;
  }

  getProgressRatio() {
    const total = this.totalTasks || Object.keys(this.TASKS || {}).length || 1;
    return this.getUnlockedCount() / total;
  }

  updateProgressUI() {
    const total = this.totalTasks || Object.keys(this.TASKS || {}).length || 1;
    const done = this.getUnlockedCount();
    const ratio = total ? (done / total) : 0;
    const pct = Math.round(ratio * 100);

    if (this.progressTextEl) this.progressTextEl.textContent = `${done} / ${total}`;
    if (this.progressPctEl) this.progressPctEl.textContent = `${pct}%`;
    if (this.progressFillEl) this.progressFillEl.style.width = `${Math.min(100, Math.max(0, pct))}%`;

    const allowExtra = ratio >= 0.8;
    if (this.extraBtn) {
      this.extraBtn.disabled = !allowExtra;
      this.extraBtn.title = allowExtra ? '' : 'Verfügbar ab 80% Fortschritt';
    }
  }

  openExtraTask() {
    const ratio = this.getProgressRatio();
    if (ratio < 0.8) return;
    if (this.extraOverlayEl) this.extraOverlayEl.classList.add('open');
  }

  closeExtraTask() {
    if (this.extraOverlayEl) this.extraOverlayEl.classList.remove('open');
  }

  setEmptyState(isEmpty) {
    if (isEmpty) {
      this.emptyEl.style.display = "block";
      this.editorEl.style.display = "none";
    } else {
      this.emptyEl.style.display = "none";
      this.editorEl.style.display = "flex";
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
    this.setEmptyState(false);

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
      this.statusEl.textContent = "DB wird geladen…";

      const SQL = await initSqlJs({
        locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`
      });

      const res = await fetch("produkte.sqlite");
      if (!res.ok) {
        throw new Error("produkte.sqlite nicht gefunden oder nicht erreichbar. Tipp: Seite ueber einen lokalen Webserver (z.B. VSCode Live Server) oeffnen und Datei im gleichen Ordner bereitstellen.");
      }

      this.db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));
      this.statusEl.textContent = "DB bereit.";
    } catch (e) {
      this.statusEl.textContent = "DB-Fehler: " + e.message;
      this.db = null;
    }
  }

  selectTask(taskId) {
    this.currentId = taskId;
    const t = this.TASKS[taskId];

    const isUnlocked = !!this.unlocked[taskId];

    // Editor state
    this.sqlEl.readOnly = isUnlocked;
    this.runBtn.disabled = isUnlocked;
    this.runBtn.style.cursor = isUnlocked ? "not-allowed" : "pointer";
    this.runBtn.style.opacity = isUnlocked ? ".6" : "1";

    this.titleEl.textContent = t.title;
    this.taskIdEl.textContent = `ID: ${taskId}`;
    this.goalEl.textContent = t.task || "";

    // Difficulty dots: +, ++, +++ -> 1..3
    const plusCount = Math.max(1, Math.min(3, (String(t.difficulty || "+").match(/\+/g) || []).length));
    const dots = Array.from(this.diffDotsEl?.querySelectorAll('.dot') || []);
    dots.forEach((el, idx) => {
      el.classList.toggle('active', idx < plusCount);
    });

    this.sqlEl.value = t.starter || "";

    this.outEl.textContent = isUnlocked
      ? "Bereits freigeschaltet."
      : "";

    this.unlockBtn.disabled = true;
    this.unlockBtn.style.cursor = "not-allowed";
    this.unlockBtn.style.opacity = ".6";
  }

  checkCurrent() {
    this.outEl.textContent = "";
    this.unlockBtn.disabled = true;
    this.unlockBtn.style.cursor = "not-allowed";
    this.unlockBtn.style.opacity = ".6";

    if (!this.currentId) {
      this.outEl.textContent = "Keine Aufgabe ausgewählt.";
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
        this.outEl.textContent = "Korrekt (bereits freigeschaltet).";
        return;
      }
      this.outEl.textContent = "Korrekt. Du kannst jetzt freischalten.";
      this.unlockBtn.disabled = false;
      this.unlockBtn.style.cursor = "pointer";
      this.unlockBtn.style.opacity = "1";
      return;
    }

    this.outEl.textContent =
      "Noch nicht korrekt. Prüfe Filterbedingungen, Spaltenauswahl und ggf. Sortierung.";
  }

  async unlockCurrent() {
    const id = this.currentId;
    if (!id) return;

    this.unlocked[id] = true;
    await this.shop.lock(id, false);

    // UI aktualisieren
    this.updateProgressUI();

    this.outEl.textContent = "Freigeschaltet. Der Button ist jetzt im Shop aktiv.";

    // Nach Freischaltung Editor schließen
    this.currentId = null;
    this.setEmptyState(true);
  }

  // ---------- Validation ----------
  validate(studentExec, refExec, mode) {
    // Full table comparison (supports text + numeric outputs)
    if (mode === "rows_order" || mode === "rows_set") {
      const ordered = (mode === "rows_order");
      return this.validateRows(studentExec, refExec, ordered);
    }

    const stu = this.extractIds(studentExec);
    const ref = this.extractIds(refExec);

    if (!stu.ok) return false;
    if (!ref.ok) return false;

    if (mode === "scalar") {
      const stuVal = this.extractScalar(studentExec);
      const refVal = this.extractScalar(refExec);
      if (!Number.isFinite(stuVal) || !Number.isFinite(refVal)) return false;
      return Math.abs(stuVal - refVal) < 1e-9;
    }

    if (mode === "order") {
      if (stu.ids.length != ref.ids.length) return false;
      for (let i = 0; i < stu.ids.length; i++) {
        if (stu.ids[i] !== ref.ids[i]) return false;
      }
      return true;
    }

    const a = new Set(stu.ids);
    const b = new Set(ref.ids);
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }

  validateRows(studentExec, refExec, ordered) {
    const s = this.extractRows(studentExec);
    const r = this.extractRows(refExec);
    if (!s.ok || !r.ok) return false;

    // same shape
    if (s.rows.length !== r.rows.length) return false;
    if (s.rows.length === 0) return true;
    if ((s.rows[0]?.length ?? 0) !== (r.rows[0]?.length ?? 0)) return false;

    const normCell = (v) => {
      if (v === null || v === undefined) return null;
      // sql.js returns numbers for numeric columns and strings for text; accept numeric-like strings too
      const n = Number(v);
      if (typeof v === "number" || (typeof v === "string" && v.trim() !== "" && Number.isFinite(n))) {
        return n;
      }
      return String(v);
    };

    const cellEq = (a, b) => {
      const A = normCell(a);
      const B = normCell(b);
      if (typeof A === "number" && typeof B === "number") {
        return Math.abs(A - B) < 1e-9;
      }
      return String(A) === String(B);
    };

    const rowKey = (row) => row.map(normCell).map(v => (typeof v === "number" ? `n:${v}` : `s:${v}`)).join("|");

    if (ordered) {
      for (let i = 0; i < s.rows.length; i++) {
        const sr = s.rows[i];
        const rr = r.rows[i];
        if (sr.length !== rr.length) return false;
        for (let c = 0; c < sr.length; c++) {
          if (!cellEq(sr[c], rr[c])) return false;
        }
      }
      return true;
    }

    // order-insensitive (multiset)
    const sa = s.rows.map(rowKey).sort();
    const rb = r.rows.map(rowKey).sort();
    if (sa.length !== rb.length) return false;
    for (let i = 0; i < sa.length; i++) if (sa[i] !== rb[i]) return false;
    return true;
  }

  extractRows(execResult) {
    // Valid even when empty
    if (!execResult || execResult.length === 0) return { ok: true, rows: [] };
    const res = execResult[0];
    if (!res.values || res.values.length === 0) return { ok: true, rows: [] };
    return { ok: true, rows: res.values };
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
    this.root = root;
    this.shop = new ShopBridge("shopFrame");
    this.db = null;

    // linear steps: theory blocks + occasional gated SQL tasks
    this.steps = this.buildSteps();
    this.stepIndex = 0;

    // unlock state (RAM v1)
    this.unlocked = {};

    // IMPORTANT: Guided mode ignores shop clicks (no free selection).
    this._ignoreShop = true;
  }

  buildSteps() {
    // v1 demo flow: 4 theory blocks -> 1 task (unlock search) -> 1 theory recap
    return [
      {
        type: "theory",
        title: "Willkommen im Guided Mode",
        body: `
          <p>Du arbeitest dich hier Schritt für Schritt durch kurze Theorie‑Blöcke und kleine Missionen.</p>
          <ul>
            <li>Links ist der Shop: <strong>alles ist zunächst gesperrt</strong>.</li>
            <li>Rechts bekommst du Theorie und genau definierte Aufgaben.</li>
            <li>Nur wenn du eine Mission löst, wird ein Feature im Shop freigeschaltet.</li>
          </ul>
        `
      },
      {
        type: "theory",
        title: "SQL‑Grundform",
        body: `
          <p>Wir starten mit <code>SELECT</code>‑Abfragen. In Schulazon gilt: Gib primär <strong>Produkt‑IDs</strong> aus.</p>
          <div style="margin-top:10px; padding:10px 12px; border-radius:12px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.10);">
            <div style="font-size:12px; letter-spacing:.05em; text-transform:uppercase; color:#cbd5e1;">Merksatz</div>
            <div style="margin-top:6px; font-size:13px; color:#e8eefc;">
              <code>SELECT ... FROM ... WHERE ...</code> filtert Daten, <code>ORDER BY</code> sortiert, <code>LIMIT</code> begrenzt.
            </div>
          </div>
        `
      },
      {
        type: "theory",
        title: "Filtern mit WHERE",
        body: `
          <p>Mit <code>WHERE</code> begrenzt du die Ergebnismenge. Typisch: <code>=</code>, <code>BETWEEN</code>, <code>LIKE</code>.</p>
          <p style="opacity:.9; font-size:13px;">In Schulazon hängt z. B. die Suche an einem Query, der zu einem Suchbegriff passende Produkte findet.</p>
        `
      },
      {
        type: "theory",
        title: "Mini‑Mission steht an",
        body: `
          <p>Als Nächstes schaltest du die <strong>Suchleiste</strong> frei.</p>
          <p style="opacity:.9; font-size:13px;">Ziel: Du gibst IDs + Namen aus, damit die Suche im Shop aktiv wird.</p>
        `
      },
      {
        type: "task",
        taskId: "search",
        title: "Mission: Suche freischalten",
        goal: "Gib Produkt-IDs und Namen aus (2 Spalten), damit die Suchleiste freigeschaltet wird.",
        starter: "SELECT id, name FROM produkte;",
        refSql: "SELECT id, name FROM produkte;",
        mode: "set",
        unlockLabel: "Suchleiste freischalten"
      },
      {
        type: "theory",
        title: "Freigeschaltet",
        body: `
          <p>Du hast ein Feature im Shop freigeschaltet. In Guided Mode kommt als Nächstes wieder Theorie und später weitere Missionen.</p>
          <p style="opacity:.9; font-size:13px;">Nächster Ausbau: weitere Theorie‑Kapitel + Missionen (JOIN/GROUP BY) für Bestellungen, Top‑Produkte, Warenkorb‑Buttons.</p>
        `
      }
    ];
  }

  async mount() {
    this.renderShell();

    // lock everything in the shop for guided mode
    await this.shop.ready;
    await this.lockAllShopTasks(true);

    // load db for tasks
    await this.loadDb();

    // render first step
    this.renderStep();
  }

  async lockAllShopTasks(locked) {
    const ids = typeof ALL_TASK_IDS !== "undefined" ? ALL_TASK_IDS : [];
    for (const id of ids) await this.shop.lock(id, locked);
  }

  async loadDb() {
    try {
      this.setStatus("DB wird geladen…");

      await this.ensureSqlJsLoaded();

      const SQL = await initSqlJs({
        locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`
      });

      const res = await fetch("produkte.sqlite");
      if (!res.ok) throw new Error("produkte.sqlite nicht gefunden (liegt die Datei im Projektordner?)");

      this.db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));
      this.setStatus("Bereit.");
    } catch (e) {
      this.db = null;
      this.setStatus("DB-Fehler: " + e.message, true);
    }
  }


  async ensureSqlJsLoaded() {
    if (typeof window.initSqlJs === "function") return;

    // Load sql.js from CDN (same version as FreeMode)
    await this.loadScriptOnce("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js", "__sqljs_wasm_loaded__");

    if (typeof window.initSqlJs !== "function") {
      throw new Error("sql.js konnte nicht geladen werden (initSqlJs fehlt). Prüfe Internetzugang oder Content-Security-Policy.");
    }
  }

  loadScriptOnce(src, flagName) {
    return new Promise((resolve, reject) => {
      if (window[flagName]) return resolve();

      const existing = Array.from(document.scripts).some(s => s.src === src);
      if (existing) {
        window[flagName] = true;
        return resolve();
      }

      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = () => { window[flagName] = true; resolve(); };
      s.onerror = () => reject(new Error("Script konnte nicht geladen werden: " + src));
      document.head.appendChild(s);
    });
  }

  /* ---------- UI ---------- */

  renderShell() {
    this.root.innerHTML = `
      <style>
        .g-shell{ display:flex; flex-direction:column; gap:14px; min-height:0; height:100%; }
        .g-head{ display:flex; flex-direction:column; gap:10px; }
        .g-title{ margin:0; font-size:22px; font-weight:900; letter-spacing:.01em; }
        .g-status{ font-size:12px; opacity:.85; }
        .g-card{
          position: relative;
          border-radius: 18px;
          padding: 16px;
          background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.10);
          box-shadow: 0 18px 60px rgba(0,0,0,0.35);
          backdrop-filter: blur(10px);
          overflow:hidden;
        }
        .g-card::before{
          content:"";
          position:absolute;
          inset:-40% -30%;
          background: radial-gradient(circle at 30% 20%, rgba(34,197,94,.20), transparent 45%),
                      radial-gradient(circle at 70% 70%, rgba(240,136,4,.18), transparent 55%);
          filter: blur(18px);
          pointer-events:none;
        }
        .g-card-inner{ position:relative; z-index:1; }
        .g-step-title{ margin:0 0 10px 0; font-size:18px; font-weight:800; }
        .g-body{ font-size:14px; line-height:1.55; color:#e8eefc; }
        .g-body p{ margin:0 0 10px 0; }
        .g-body ul{ margin:8px 0 0 18px; }
        .g-body li{ margin:6px 0; opacity:.95; }
        .g-nav{
          margin-top:auto;
          display:flex;
          flex-direction:column;
          gap:10px;
          padding-top: 6px;
        }
        .g-progress-row{ display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:12px; color:#cbd5e1; }
        .g-progress-bar{ height:10px; border-radius:999px; background:#1e293b; overflow:hidden; }
        .g-progress-fill{ height:100%; width:0%; background: linear-gradient(90deg,#22c55e,#4ade80); transition: width .35s ease; }
        .g-buttons{ display:flex; gap:10px; justify-content:space-between; }
        .g-btn{
          border:none;
          border-radius: 14px;
          padding: 12px 14px;
          font-weight:800;
          cursor:pointer;
          transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
          background: rgba(255,255,255,.10);
          color:#e8eefc;
        }
        .g-btn:hover{ transform: translateY(-1px); box-shadow: 0 16px 40px rgba(0,0,0,.25); }
        .g-btn.primary{
          background: linear-gradient(90deg, rgba(34,197,94,0.95), rgba(74,222,128,0.95));
          color:#052e16;
        }
        .g-btn[disabled]{ opacity:.45; cursor:not-allowed; transform:none; box-shadow:none; }
        .g-fade{ animation: gfade .22s ease both; }
        @keyframes gfade { from{ opacity:0; transform: translateY(10px);} to{ opacity:1; transform:none;} }

        /* Task editor */
        .g-editor{ margin-top:12px; border-radius: 16px; overflow:hidden; border:1px solid rgba(255,255,255,.10); background: rgba(2,6,23,.70); }
        .g-editor-top{ display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; background: rgba(255,255,255,.06); border-bottom:1px solid rgba(255,255,255,.08); }
        .g-pill{ font-size:12px; padding:6px 10px; border-radius:999px; background: rgba(240,136,4,.14); color:#fde68a; font-weight:800; }
        .g-textarea{
          width:100%;
          min-height:160px;
          resize:vertical;
          border:none;
          outline:none;
          padding:14px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
          font-size:13px;
          line-height:1.5;
          color:#e8eefc;
          background: transparent;
        }
        .g-actions{ display:flex; justify-content:flex-end; gap:10px; padding:10px 12px; background: rgba(255,255,255,.04); border-top:1px solid rgba(255,255,255,.08); }
        .g-run{
          border:none;
          border-radius: 12px;
          padding: 10px 14px;
          cursor:pointer;
          font-weight:900;
          background: linear-gradient(90deg, rgba(34,197,94,0.95), rgba(74,222,128,0.95));
          color:#052e16;
          transition: transform .15s ease, box-shadow .15s ease, opacity .15s ease;
        }
        .g-run:hover{ transform: translateY(-1px); box-shadow: 0 16px 40px rgba(34,197,94,.22); }
        .g-unlock{
          border:none;
          border-radius: 12px;
          padding: 10px 14px;
          cursor:not-allowed;
          font-weight:900;
          background: rgba(255,255,255,.10);
          color:#e8eefc;
          opacity:.55;
          transition: opacity .15s ease, transform .15s ease, box-shadow .15s ease;
        }
        .g-unlock.enabled{
          cursor:pointer;
          opacity:1;
          background: linear-gradient(90deg, rgba(240,136,4,0.92), rgba(251,191,36,0.92));
          color:#1f2937;
        }
        .g-unlock.enabled:hover{ transform: translateY(-1px); box-shadow: 0 18px 46px rgba(240,136,4,.22); }
        .g-out{
          margin:0;
          padding:12px;
          border-top:1px solid rgba(255,255,255,.08);
          font-size:12px;
          white-space:pre-wrap;
          color:#e8eefc;
          min-height:70px;
        }
      </style>

      <div class="g-shell">
        <div class="g-head">
          <h2 class="g-title">Angeleiteter Modus</h2>
          <div class="g-status" id="gStatus">Initialisiere…</div>
        </div>

        <div class="g-card">
          <div class="g-card-inner g-fade" id="gStep"></div>
        </div>

        <div class="g-nav">
          <div class="g-progress-row">
            <div id="gProgressLabel">Kapitel 1/1</div>
            <div id="gProgressPct">0%</div>
          </div>
          <div class="g-progress-bar"><div class="g-progress-fill" id="gProgressFill"></div></div>
          <div class="g-buttons">
            <button class="g-btn" id="gPrev">Zurück</button>
            <button class="g-btn primary" id="gNext">Weiter</button>
          </div>
        </div>
      </div>
    `;

    this.statusEl = this.root.querySelector("#gStatus");
    this.stepEl = this.root.querySelector("#gStep");
    this.prevBtn = this.root.querySelector("#gPrev");
    this.nextBtn = this.root.querySelector("#gNext");
    this.progressLabelEl = this.root.querySelector("#gProgressLabel");
    this.progressPctEl = this.root.querySelector("#gProgressPct");
    this.progressFillEl = this.root.querySelector("#gProgressFill");

    this.prevBtn.addEventListener("click", () => this.go(-1));
    this.nextBtn.addEventListener("click", () => this.go(1));

    this.setStatus("Bereit.");
  }

  setStatus(text, isError = false) {
    if (!this.statusEl) return;
    this.statusEl.textContent = text;
    this.statusEl.style.color = isError ? "#fca5a5" : "";
  }

  updateProgress() {
    const total = this.steps.length;
    const idx = this.stepIndex + 1;
    const pct = total > 0 ? Math.round((idx / total) * 100) : 0;

    this.progressLabelEl.textContent = `Kapitel ${idx}/${total}`;
    this.progressPctEl.textContent = `${pct}%`;
    this.progressFillEl.style.width = `${pct}%`;

    this.prevBtn.disabled = this.stepIndex <= 0;
  }

  renderStep() {
    const step = this.steps[this.stepIndex];
    this.updateProgress();

    // Default: next enabled, but tasks may gate it
    this.nextBtn.disabled = false;

    if (step.type === "theory") {
      this.stepEl.innerHTML = `
        <div class="g-fade">
          <h3 class="g-step-title">${this.escape(step.title)}</h3>
          <div class="g-body">${step.body}</div>
        </div>
      `;
      this.nextBtn.textContent = (this.stepIndex === this.steps.length - 1) ? "Fertig" : "Weiter";
      return;
    }

    if (step.type === "task") {
      this.nextBtn.textContent = "Weiter";
      // gate progression until task unlocked
      this.nextBtn.disabled = true;

      this.stepEl.innerHTML = `
        <div class="g-fade">
          <h3 class="g-step-title">${this.escape(step.title)}</h3>
          <div class="g-body">
            <p style="opacity:.9">${this.escape(step.goal)}</p>
          </div>

          <div class="g-editor" style="margin-top:14px;">
            <div class="g-editor-top">
              <div class="g-pill">MISSION</div>
              <div style="font-size:12px; opacity:.85;">Ziel: korrekt prüfen → freischalten</div>
            </div>

            <textarea class="g-textarea" id="gSql">${this.escape(step.starter || "")}</textarea>

            <div class="g-actions">
              <button class="g-run" id="gRun">Prüfen</button>
              <button class="g-unlock" id="gUnlock" disabled>${this.escape(step.unlockLabel || "Freischalten")}</button>
            </div>

            <pre class="g-out" id="gOut"></pre>
          </div>
        </div>
      `;

      this.sqlEl = this.root.querySelector("#gSql");
      this.outEl = this.root.querySelector("#gOut");
      this.runEl = this.root.querySelector("#gRun");
      this.unlockEl = this.root.querySelector("#gUnlock");

      this.runEl.addEventListener("click", () => this.checkTask());
      this.unlockEl.addEventListener("click", () => this.unlockTask());

      // UX
      try { this.sqlEl?.focus(); } catch (_) {}
      return;
    }
  }

  go(delta) {
    const next = this.stepIndex + delta;
    if (next < 0 || next >= this.steps.length) return;
    this.stepIndex = next;
    this.renderStep();
  }

  /* ---------- Task logic ---------- */

  checkTask() {
    const step = this.steps[this.stepIndex];
    if (!step || step.type !== "task") return;

    this.outEl.textContent = "";
    this.unlockEl.disabled = true;
    this.unlockEl.classList.remove("enabled");

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

    try {
      refRes = this.db.exec(step.refSql);
    } catch (e) {
      this.outEl.textContent = "Interner Referenz-Fehler: " + e.message;
      return;
    }

    const ok = this.validate(studentRes, refRes, step.mode);

    if (ok) {
      this.outEl.textContent = "✅ Korrekt! Du kannst jetzt freischalten.";
      this.unlockEl.disabled = false;
      this.unlockEl.classList.add("enabled");
      return;
    }

    this.outEl.textContent = "❌ Noch nicht korrekt. Tipp: Achte auf die geforderte Ausgabeform (IDs + ggf. Name).";
  }

  async unlockTask() {
    const step = this.steps[this.stepIndex];
    if (!step || step.type !== "task") return;

    // unlock in shop
    this.unlocked[step.taskId] = true;
    await this.shop.lock(step.taskId, false);

    // lock UI: no re-edit in guided
    this.sqlEl.readOnly = true;
    this.runEl.disabled = true;
    this.runEl.style.opacity = ".6";
    this.runEl.style.cursor = "not-allowed";
    this.unlockEl.disabled = true;
    this.unlockEl.classList.remove("enabled");

    this.outEl.textContent = "🎉 Freigeschaltet! Du kannst jetzt weiter.";
    this.nextBtn.disabled = false;

    // optional micro-delay for feel
    setTimeout(() => {
      try { this.nextBtn.focus(); } catch(_) {}
    }, 120);
  }

  /* ---------- Validation helpers ---------- */

  validate(studentExec, refExec, mode) {
    if (mode === "scalar") {
      const a = this.extractScalar(studentExec);
      const b = this.extractScalar(refExec);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
      return Math.abs(a - b) < 1e-9;
    }

    const stu = this.extractIds(studentExec);
    const ref = this.extractIds(refExec);

    if (!stu.ok || !ref.ok) return false;

    if (mode === "order") {
      if (stu.ids.length !== ref.ids.length) return false;
      for (let i = 0; i < stu.ids.length; i++) if (stu.ids[i] !== ref.ids[i]) return false;
      return true;
    }

    const A = new Set(stu.ids);
    const B = new Set(ref.ids);
    if (A.size !== B.size) return false;
    for (const x of A) if (!B.has(x)) return false;
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
    if (!execResult || !execResult.length) return { ok: false, ids: [] };
    const { columns, values } = execResult[0];
    if (!columns || !values) return { ok: false, ids: [] };

    const lower = columns.map(c => String(c).toLowerCase());
    let idx = lower.indexOf("id");
    if (idx === -1) idx = lower.indexOf("produkt_id");
    if (idx === -1 && columns.length === 1) idx = 0;
    if (idx === -1) return { ok: false, ids: [] };

    const ids = values
      .map(row => Number(row[idx]))
      .filter(n => Number.isFinite(n));

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
