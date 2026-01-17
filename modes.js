/* ===========================
   ShopBridge (Parent -> iframe)
   =========================== */


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
  "reset-filters",
  "priceAsc","priceDesc","popularity"
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
    this.root = root;
    this.shop = new ShopBridge("shopFrame");
    this.db = null;

    // welche Shop-Buttons im FreeMode gesperrt sind
    this.TASKS = this.buildTasks();

    // unlocked state (nur RAM, v1)
    this.unlocked = {};
    Object.keys(this.TASKS).forEach(id => this.unlocked[id] = false);
  }

  buildTasks() {
    // Wir validieren immer über Produkt-IDs.
    // Sort-Tasks prüfen Reihenfolge.
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
        goal: "Nur Produkte, die morgen geliefert werden (liefertage = 1). Gib IDs aus.",
        starter: "SELECT id FROM produkte WHERE liefertage = 1;",
        refSql: "SELECT id FROM produkte WHERE liefertage = 1;",
        mode: "set"
      },
      "bestseller": {
        title: "Bestseller",
        goal: "Produkte mit insgesamt mind. 300 verkauften Einheiten. Gib IDs aus.",
        starter:
`SELECT p.id
FROM produkte p, verkäufe v
WHERE v.produkt_id = p.id
GROUP BY p.id
HAVING SUM(v.anzahl) >= 300;`,
        refSql:
`SELECT p.id
FROM produkte p
LEFT JOIN verkäufe v ON v.produkt_id = p.id
GROUP BY p.id
HAVING COALESCE(SUM(v.anzahl),0) >= 300;`,
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
        goal: "Produkte mit kategorie_id = 1. Gib IDs aus.",
        starter: "SELECT id FROM produkte WHERE kategorie_id = 1;",
        refSql: "SELECT id FROM produkte WHERE kategorie_id = 1;",
        mode: "set"
      },
      "cat-household": {
        title: "Kategorie: Haushalt",
        goal: "Produkte mit kategorie_id = 2. Gib IDs aus.",
        starter: "SELECT id FROM produkte WHERE kategorie_id = 2;",
        refSql: "SELECT id FROM produkte WHERE kategorie_id = 2;",
        mode: "set"
      },
      "cat-sport": {
        title: "Kategorie: Sport",
        goal: "Produkte mit kategorie_id = 3. Gib IDs aus.",
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
`SELECT p.id
FROM produkte p, bewertungen b
WHERE b.produkt_id = p.id
GROUP BY p.id
HAVING AVG(b.sterne) = 5;`,
        refSql:
`SELECT p.id
FROM produkte p
LEFT JOIN bewertungen b ON b.produkt_id = p.id
GROUP BY p.id
HAVING AVG(b.sterne) = 5;`,
        mode: "set"
      },
      "rating-4": {
        title: "Bewertung: ≥ ★★★★☆",
        goal: "Produkte mit durchschnittlicher Bewertung >= 4. Gib IDs aus.",
        starter:
`SELECT p.id
FROM produkte p, bewertungen b
WHERE b.produkt_id = p.id
GROUP BY p.id
HAVING AVG(b.sterne) >= 4;`,
        refSql:
`SELECT p.id
FROM produkte p
LEFT JOIN bewertungen b ON b.produkt_id = p.id
GROUP BY p.id
HAVING AVG(b.sterne) >= 4;`,
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
`SELECT p.id
FROM produkte p
LEFT JOIN verkäufe v ON v.produkt_id = p.id
GROUP BY p.id
ORDER BY COALESCE(SUM(v.anzahl),0) DESC, p.id ASC;`,
        refSql:
`SELECT p.id
FROM produkte p
LEFT JOIN verkäufe v ON v.produkt_id = p.id
GROUP BY p.id
ORDER BY COALESCE(SUM(v.anzahl),0) DESC, p.id ASC;`,
        mode: "order"
      },

      "reset-filters": {
        title: "Filter zurücksetzen",
        goal: "Zum Freischalten: gib alle Produkt-IDs aus (wie „Alle Produkte“).",
        starter: "SELECT id FROM produkte;",
        refSql: "SELECT id FROM produkte;",
        mode: "set"
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

    // UI aktualisieren
    this.renderTaskList();
    this.selectTask("all");
  }

  renderShell() {
    this.root.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <h2 style="margin:0;">Freier Modus</h2>
        <div style="opacity:.85;font-size:13px;">
          Alle Shop-Buttons sind gesperrt. Löse rechts Aufgaben mit SQL, um Buttons freizuschalten.
          <br>Wichtig: Gib immer Produkt-IDs aus (Spalte <code>id</code> oder nur 1 numerische Spalte).
        </div>

        <div id="freeStatus" style="font-size:13px;opacity:.9;">DB wird geladen…</div>

        <div style="display:grid;grid-template-columns: 1fr 2fr; gap:12px; min-height: 0;">
          <div style="border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:10px; overflow:auto; min-height: 0;">
            <div style="font-weight:700; margin-bottom:8px;">Aufgaben</div>
            <div id="taskList" style="display:flex;flex-direction:column; gap:8px;"></div>
          </div>

          <div style="border:1px solid rgba(255,255,255,.12); border-radius:12px; padding:12px; min-height: 0; display:flex; flex-direction:column; gap:10px;">
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

    this.taskListEl = this.root.querySelector("#taskList");
    this.statusEl = this.root.querySelector("#freeStatus");
    this.titleEl = this.root.querySelector("#taskTitle");
    this.goalEl = this.root.querySelector("#taskGoal");
    this.sqlEl = this.root.querySelector("#sqlInput");
    this.outEl = this.root.querySelector("#out");
    this.runBtn = this.root.querySelector("#runBtn");
    this.unlockBtn = this.root.querySelector("#unlockBtn");

    this.runBtn.addEventListener("click", () => this.checkCurrent());
    this.unlockBtn.addEventListener("click", () => this.unlockCurrent());
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
      this.statusEl.textContent = "✅ DB geladen. Wähle links eine Aufgabe und gib SQL ein.";
    } catch (e) {
      this.statusEl.textContent = "❌ DB-Fehler: " + e.message;
      this.db = null;
    }
  }

  renderTaskList() {
    const ids = Object.keys(this.TASKS);

    this.taskListEl.innerHTML = ids.map(id => {
      const t = this.TASKS[id];
      const ok = !!this.unlocked[id];
      return `
        <button data-tid="${id}" style="
          text-align:left;
          padding:10px 10px;
          border-radius:10px;
          border:1px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.04);
          color:#e8eefc;
          cursor:pointer;
          opacity:${ok ? "1" : ".85"};
        ">
          ${ok ? "✅" : "🔒"} <strong>${this.escape(t.title)}</strong>
          <div style="font-size:12px;opacity:.85;margin-top:2px;">${this.escape(id)}</div>
        </button>
      `;
    }).join("");

    this.taskListEl.querySelectorAll("[data-tid]").forEach(btn => {
      btn.addEventListener("click", () => this.selectTask(btn.dataset.tid));
    });
  }

  selectTask(taskId) {
    this.currentId = taskId;
    const t = this.TASKS[taskId];

    this.titleEl.textContent = `${this.unlocked[taskId] ? "✅" : "🔒"} ${t.title}`;
    this.goalEl.textContent = t.goal;

    this.sqlEl.value = t.starter || "";
    this.outEl.textContent = "";
    this.unlockBtn.disabled = true;
    this.unlockBtn.style.cursor = "not-allowed";
    this.unlockBtn.style.opacity = ".6";
  }

  checkCurrent() {
    this.outEl.textContent = "";
    this.unlockBtn.disabled = true;
    this.unlockBtn.style.cursor = "not-allowed";
    this.unlockBtn.style.opacity = ".6";

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

    this.renderTaskList();
    this.selectTask(id);

    this.outEl.textContent = "🎉 Freigeschaltet! Der Button funktioniert jetzt im Shop.";
  }

  // ---------- Validation ----------
  validate(studentExec, refExec, mode) {
    const stu = this.extractIds(studentExec);
    const ref = this.extractIds(refExec);

    if (!stu.ok) return false;
    if (!ref.ok) return false;

    if (mode === "order") {
      // Reihenfolge exakt
      if (stu.ids.length !== ref.ids.length) return false;
      for (let i = 0; i < stu.ids.length; i++) {
        if (stu.ids[i] !== ref.ids[i]) return false;
      }
      return true;
    }

    // set comparison
    const a = new Set(stu.ids);
    const b = new Set(ref.ids);
    if (a.size !== b.size) return false;
    for (const x of a) if (!b.has(x)) return false;
    return true;
  }

  extractIds(execResult) {
    if (!execResult || !execResult.length) return { ok: false, ids: [] };
    const { columns, values } = execResult[0];
    if (!columns || !values) return { ok: false, ids: [] };

    // prefer explicit id columns
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
