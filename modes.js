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
  "all",
  "express",
  "bestseller",
  "available",
  "cat-electronics",
  "cat-household",
  "cat-sport",
  "price-25",
  "price-50",
  "price-100",
  "rating-5",
  "rating-4",
  "reset-filters",
  "priceAsc",
  "priceDesc",
  "popularity",
  "search",
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
    // Wir validieren immer über Produkt-IDs.
    return {
      "all": {
        title: "Alle Produkte",
        goal: "Gib alle Produkt-IDs aus.",
        starter: "SELECT id FROM produkte;",
        refSql: "SELECT id FROM produkte;",
        mode: "set"
      },

      "express": {
        title: "Expresslieferung",
        goal: "Produkte mit Lieferung morgen (liefertage = 1). Gib IDs aus.",
        starter: "SELECT id FROM produkte WHERE liefertage = 1;",
        refSql: "SELECT id FROM produkte WHERE liefertage = 1;",
        mode: "set"
      },

      "bestseller": {
        title: "Bestseller",
        goal: "Produkte mit mindestens 300 Verkäufen. Gib IDs aus.",
        starter:
`SELECT p.id\nFROM produkte p\nLEFT JOIN verkäufe v ON v.produkt_id = p.id\nGROUP BY p.id\nHAVING COALESCE(SUM(v.anzahl),0) >= 300;`,
        refSql:
`SELECT p.id\nFROM produkte p\nLEFT JOIN verkäufe v ON v.produkt_id = p.id\nGROUP BY p.id\nHAVING COALESCE(SUM(v.anzahl),0) >= 300;`,
        mode: "set"
      },

      "available": {
        title: "Nur noch wenige auf Lager",
        goal: "Produkte mit lagerbestand zwischen 1 und 5. Gib IDs aus.",
        starter: "SELECT id FROM produkte WHERE lagerbestand BETWEEN 1 AND 5;",
        refSql: "SELECT id FROM produkte WHERE lagerbestand BETWEEN 1 AND 5;",
        mode: "set"
      },

      "cat-electronics": {
        title: "Kategorie: Elektronik",
        goal: "Produkte in Kategorie 1. Gib IDs aus.",
        starter: "SELECT id FROM produkte WHERE kategorie_id = 1;",
        refSql: "SELECT id FROM produkte WHERE kategorie_id = 1;",
        mode: "set"
      },
      "cat-household": {
        title: "Kategorie: Haushalt",
        goal: "Produkte in Kategorie 2. Gib IDs aus.",
        starter: "SELECT id FROM produkte WHERE kategorie_id = 2;",
        refSql: "SELECT id FROM produkte WHERE kategorie_id = 2;",
        mode: "set"
      },
      "cat-sport": {
        title: "Kategorie: Sport",
        goal: "Produkte in Kategorie 3. Gib IDs aus.",
        starter: "SELECT id FROM produkte WHERE kategorie_id = 3;",
        refSql: "SELECT id FROM produkte WHERE kategorie_id = 3;",
        mode: "set"
      },

      "price-25": {
        title: "Preis: Unter 25 €",
        goal: "Produkte mit preis <= 25. Gib IDs aus.",
        starter: "SELECT id FROM produkte WHERE preis <= 25;",
        refSql: "SELECT id FROM produkte WHERE preis <= 25;",
        mode: "set"
      },
      "price-50": {
        title: "Preis: 25–50 €",
        goal: "Produkte mit preis zwischen 25 und 50. Gib IDs aus.",
        starter: "SELECT id FROM produkte WHERE preis BETWEEN 25 AND 50;",
        refSql: "SELECT id FROM produkte WHERE preis BETWEEN 25 AND 50;",
        mode: "set"
      },
      "price-100": {
        title: "Preis: 50–100 €",
        goal: "Produkte mit preis zwischen 50 und 100. Gib IDs aus.",
        starter: "SELECT id FROM produkte WHERE preis BETWEEN 50 AND 100;",
        refSql: "SELECT id FROM produkte WHERE preis BETWEEN 50 AND 100;",
        mode: "set"
      },

      "rating-5": {
        title: "Bewertung: ★★★★★",
        goal: "Produkte mit durchschnittlicher Bewertung = 5. Gib IDs aus.",
        starter:
`SELECT p.id\nFROM produkte p\nLEFT JOIN bewertungen b ON b.produkt_id = p.id\nGROUP BY p.id\nHAVING AVG(b.sterne) = 5;`,
        refSql:
`SELECT p.id\nFROM produkte p\nLEFT JOIN bewertungen b ON b.produkt_id = p.id\nGROUP BY p.id\nHAVING AVG(b.sterne) = 5;`,
        mode: "set"
      },
      "rating-4": {
        title: "Bewertung: ≥ ★★★★☆",
        goal: "Produkte mit durchschnittlicher Bewertung >= 4. Gib IDs aus.",
        starter:
`SELECT p.id\nFROM produkte p\nLEFT JOIN bewertungen b ON b.produkt_id = p.id\nGROUP BY p.id\nHAVING AVG(b.sterne) >= 4;`,
        refSql:
`SELECT p.id\nFROM produkte p\nLEFT JOIN bewertungen b ON b.produkt_id = p.id\nGROUP BY p.id\nHAVING AVG(b.sterne) >= 4;`,
        mode: "set"
      },

      "priceAsc": {
        title: "Sortierung: Preis ↑",
        goal: "Gib alle Produkt-IDs sortiert nach preis aufsteigend aus (bei Gleichstand nach id).",
        starter: "SELECT id FROM produkte ORDER BY preis ASC, id ASC;",
        refSql: "SELECT id FROM produkte ORDER BY preis ASC, id ASC;",
        mode: "order"
      },
      "priceDesc": {
        title: "Sortierung: Preis ↓",
        goal: "Gib alle Produkt-IDs sortiert nach preis absteigend aus (bei Gleichstand nach id).",
        starter: "SELECT id FROM produkte ORDER BY preis DESC, id ASC;",
        refSql: "SELECT id FROM produkte ORDER BY preis DESC, id ASC;",
        mode: "order"
      },
      "popularity": {
        title: "Sortierung: Beliebtheit",
        goal: "Gib alle Produkt-IDs sortiert nach Verkäufen (SUM(anzahl)) absteigend aus (bei Gleichstand nach id).",
        starter:
`SELECT p.id\nFROM produkte p\nLEFT JOIN verkäufe v ON v.produkt_id = p.id\nGROUP BY p.id\nORDER BY COALESCE(SUM(v.anzahl),0) DESC, p.id ASC;`,
        refSql:
`SELECT p.id\nFROM produkte p\nLEFT JOIN verkäufe v ON v.produkt_id = p.id\nGROUP BY p.id\nORDER BY COALESCE(SUM(v.anzahl),0) DESC, p.id ASC;`,
        mode: "order"
      },

      "reset-filters": {
        title: "Filter zurücksetzen",
        goal: "Zum Freischalten: gib alle Produkt-IDs aus (wie „Alle Produkte“).",
        starter: "SELECT id FROM produkte;",
        refSql: "SELECT id FROM produkte;",
        mode: "set"
      }
,

      "search": {
        title: "Suche freischalten",
        goal: "Gib Produkt-IDs und Namen aus, um die Suchleiste freizuschalten.",
        starter: "SELECT id, name FROM produkte;",
        refSql: "SELECT id, name FROM produkte;",
        mode: "set"
      },

      "orders": {
        title: "Meine Bestellungen anzeigen",
        goal: "Gib die Produkt-IDs der letzten Bestellungen des Nutzers (nutzer_id = 1) aus.",
        starter: "SELECT produkt_id FROM verkäufe WHERE nutzer_id = 1 ORDER BY id DESC LIMIT 3;",
        refSql: "SELECT produkt_id FROM verkäufe WHERE nutzer_id = 1 ORDER BY id DESC LIMIT 3;",
        mode: "set"
      },

      "topProducts": {
        title: "Meine Top-Produkte anzeigen",
        goal: "Gib die Produkt-IDs der meistgekauften Produkte des Nutzers (nutzer_id = 1) aus (Sortierung: SUM(anzahl) DESC, produkt_id ASC).",
        starter: "SELECT produkt_id FROM verkäufe WHERE nutzer_id = 1 GROUP BY produkt_id ORDER BY SUM(anzahl) DESC, produkt_id ASC LIMIT 3;",
        refSql: "SELECT produkt_id FROM verkäufe WHERE nutzer_id = 1 GROUP BY produkt_id ORDER BY SUM(anzahl) DESC, produkt_id ASC LIMIT 3;",
        mode: "order"
      },

      "cart-refresh": {
        title: "Warenkorb aktualisieren",
        goal: "Gib die Produkt-IDs aus dem Warenkorb aus.",
        starter: "SELECT produkt_id FROM warenkorb;",
        refSql: "SELECT produkt_id FROM warenkorb;",
        mode: "set"
      },

      "cart-total": {
        title: "Gesamtpreis aktualisieren",
        goal: "Berechne den Gesamtpreis des Warenkorbs als einzelne Zahl (SUM(preis * menge)).",
        starter: "SELECT COALESCE(SUM(p.preis * w.menge), 0) AS total FROM warenkorb w JOIN produkte p ON p.id = w.produkt_id;",
        refSql: "SELECT COALESCE(SUM(p.preis * w.menge), 0) AS total FROM warenkorb w JOIN produkte p ON p.id = w.produkt_id;",
        mode: "scalar"
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
    this.root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;min-height:0;">
        <h2 style="margin:0;">Freier Modus</h2>
        <div style="opacity:.85;font-size:13px;">
          Wähle links im Shop einen <strong>gesperrten</strong> Button. Rechts öffnet sich dann die Programmierumgebung.
          <br>Wichtig: Gib immer Produkt-IDs aus (Spalte <code>id</code> oder nur 1 numerische Spalte).
        </div>

        <div id="freeStatus" style="font-size:13px;opacity:.9;">DB wird geladen…</div>

        <div style="border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:12px; min-height:0; display:flex; flex-direction:column; gap:10px;">
          <div id="emptyState" style="opacity:.85; font-size:13px; padding:8px 0;">
            Keine Aufgabe ausgewählt. Klicke im Shop auf einen gesperrten Button.
          </div>

          <div id="editor" style="display:none; min-height:0; flex:1; flex-direction:column; gap:10px;">
            <div id="taskTitle" style="font-weight:800;"></div>
            <div id="taskGoal" style="font-size:13px;opacity:.9;"></div>

            <textarea id="sqlInput" style="
              width:100%;
              min-height:150px;
              resize:vertical;
              border-radius:10px;
              border:1px solid rgba(255,255,255,.15);
              padding:10px;
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
              font-size:13px;
              color:#e8eefc;
              background: rgba(2,6,23,.55);
              outline:none;
            "></textarea>

            <div style="display:flex; gap:10px; justify-content:flex-end;">
              <button id="runBtn" style="padding:10px 12px;border-radius:10px;border:none;cursor:pointer;">Prüfen</button>
              <button id="unlockBtn" disabled style="padding:10px 12px;border-radius:10px;border:none;cursor:not-allowed;opacity:.6;">Freischalten</button>
            </div>

            <pre id="out" style="
              margin:0;
              padding:10px;
              border-radius:10px;
              border:1px solid rgba(255,255,255,.10);
              background: rgba(2,6,23,.40);
              min-height:70px;
              white-space:pre-wrap;
              font-size:12px;
              color:#e8eefc;
            "></pre>
          </div>
        </div>
      </div>
    `;

    this.statusEl = this.root.querySelector("#freeStatus");
    this.emptyEl = this.root.querySelector("#emptyState");
    this.editorEl = this.root.querySelector("#editor");

    this.titleEl = this.root.querySelector("#taskTitle");
    this.goalEl = this.root.querySelector("#taskGoal");
    this.sqlEl = this.root.querySelector("#sqlInput");
    this.outEl = this.root.querySelector("#out");
    this.runBtn = this.root.querySelector("#runBtn");
    this.unlockBtn = this.root.querySelector("#unlockBtn");

    this.runBtn.addEventListener("click", () => this.checkCurrent());
    this.unlockBtn.addEventListener("click", () => this.unlockCurrent());
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
      if (!res.ok) throw new Error("produkte.sqlite nicht gefunden (liegt die Datei im Projektordner?)");

      this.db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));
      this.statusEl.textContent = "✅ DB geladen. Klicke im Shop einen gesperrten Button, dann löse die Aufgabe rechts.";
    } catch (e) {
      this.statusEl.textContent = "❌ DB-Fehler: " + e.message;
      this.db = null;
    }
  }

  selectTask(taskId) {
    this.currentId = taskId;
    const t = this.TASKS[taskId];

    const isUnlocked = !!this.unlocked[taskId];

    // Nach Freischaltung keine erneute SQL-Eingabe erlauben
    this.sqlEl.readOnly = isUnlocked;
    this.runBtn.disabled = isUnlocked;
    this.runBtn.style.cursor = isUnlocked ? "not-allowed" : "pointer";
    this.runBtn.style.opacity = isUnlocked ? ".6" : "1";

    // Unlock-Button bleibt bei unlocked ohnehin deaktiviert

    this.titleEl.textContent = `${isUnlocked ? "✅" : "🔒"} ${t.title}  (${taskId})`;
    this.goalEl.textContent = t.goal;

    this.sqlEl.value = t.starter || "";
    this.outEl.textContent = isUnlocked
      ? "Bereits freigeschaltet. Du kannst die Abfrage trotzdem erneut prüfen."
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
      return;
    }

    this.outEl.textContent =
      "❌ Noch nicht korrekt.\n" +
      "Tipp: Gib nur Produkt-IDs aus (z.B. SELECT id FROM produkte ...).";
  }

  async unlockCurrent() {
    const id = this.currentId;
    if (!id) return;

    this.unlocked[id] = true;
    await this.shop.lock(id, false);

    // UI aktualisieren
    this.selectTask(id);

    this.outEl.textContent = "🎉 Freigeschaltet! Der Button ist jetzt im Shop aktiv.";
  

    // Editor schließen: nach Freischaltung keine erneute Bearbeitung
    this.currentId = null;
    this.setEmptyState(true);
  }

  // ---------- Validation ----------
  validate(studentExec, refExec, mode) {
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


/* ===========================
   Guided/Test Platzhalter
   =========================== */
class GuidedMode {
  constructor(root){ this.root = root; }
  mount(){ this.root.innerHTML = `<h2>Angeleiteter Modus</h2><p>Platzhalter.</p>`; }
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
