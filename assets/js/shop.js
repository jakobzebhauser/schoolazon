/************************************************************
 * Schulazon Shop � stabile Basis (ohne Sperren/Rechtsklick)
 * DB-Schema:
 * produkte(id, name, preis, kategorie_id, lagerbestand, liefertage)
 * kategorien(id, name)
 * bewertungen(id, produkt_id, sterne)
 * verk�ufe(id, produkt_id, anzahl)
 * warenkorb(produkt_id, menge)
 ************************************************************/

let db = null;
const MEINE_ID = 1; // Demo-Nutzer
const SHOP_DB_URL = new URL("../data/shop-datenbank.sqlite", document.currentScript?.src || window.location.href).toString();





// ---------- UI / State ----------
const state = {
  // Filter
  categoryId: null,
  priceMax: null,
  priceMin: null,
  availableOnly: false,
  expressDelivery: false,
  showProducts: false,

  // Suche
  searchTerm: "",

  // Rating
  minRating: null,
  exactRating: null,

  // Sort
  sort: "popularity",

  bestsellerOnly: false
};

// ================= TASK SYSTEM (erweiterbar) =================
const TASKS = {
  express: {
    taskId: "express",
    title: "Expresslieferung freischalten",
      difficulty: 1,
    difficultyMax: 3,
    goal: "Zeige nur Produkte, die morgen geliefert werden (liefertage = 1).",
    tip: "Tipp: Die relevante Spalte hei�t `liefertage` in der Tabelle `produkte`.",
    starterSql: `SELECT * FROM produkte WHERE liefertage = 1;`,

    // ? Validation: Ergebnis muss (ID-Menge) exakt matchen
    validate: (studentRes, db) => {
      const idsStudent = extractIdsFromResult(studentRes);
      const ref = db.exec(`SELECT id FROM produkte WHERE liefertage = 1;`);
      const idsRef = extractIdsFromResult(ref);
      return sameSet(idsStudent, idsRef);
    },

    onUnlock: () => {
      // Feature-Effekt im Shop: einfach Flag setzen
      state.expressDelivery = true;
      state.showProducts = true;
      render(); // Shop aktualisieren
    }
  }
};

// Locks: Startzustand (sp�ter per localStorage speicherbar)
const LOCKS = {
  express: false
};




// ---------- DOM ----------
const els = {
  products: () => document.querySelector(".products"),
  studentName: () => document.getElementById("studentName"),

  sortDropdown: () => document.getElementById("sortDropdown"),
  sortSelected: () => document.querySelector("#sortDropdown .sort-selected"),
  sortOptions: () => document.querySelector("#sortDropdown .sort-options"),
};

// ---------- Init ----------
window.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const SQL = await initSqlJs({
      locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`
    });

    const res = await fetch(SHOP_DB_URL);
    if (!res.ok) throw new Error("shop-datenbank.sqlite nicht gefunden (erwartet unter assets/data/).");

    db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));
    ensureDemoUsers();

    // rechter Bereich: Name beibehalten (nur Anzeige)
    const nameEl = els.studentName();
    if (nameEl) nameEl.textContent = "Anna M�ller";

    bindUI();
    await render();
    updateCartBadge();


  } catch (err) {
    const c = els.products();
    if (c) c.innerHTML = `<p style="padding:20px;color:#b12704;font-weight:600">? ${escapeHtml(err.message)}</p>`;
    console.error(err);
  }
}

function ensureDemoUsers() {
  if (!db) return;
  try {
    // Demo users for the SQLi sandbox login.
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        name TEXT,
        password TEXT
      );
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS nutzer (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        name TEXT,
        passwort TEXT
      );
    `);

    const userCount = db.exec("SELECT COUNT(*) AS c FROM users;");
    const userRows = Number(userCount?.[0]?.values?.[0]?.[0] ?? 0);
    if (userRows === 0) {
      db.run(`
        INSERT INTO users (username, name, password)
        VALUES
          ('anna', 'Anna Mueller', 'geheim'),
          ('leo',  'Leo Schmidt',  'pass123');
      `);
    }

    const nutzerCount = db.exec("SELECT COUNT(*) AS c FROM nutzer;");
    const nutzerRows = Number(nutzerCount?.[0]?.values?.[0]?.[0] ?? 0);
    if (nutzerRows === 0) {
      db.run(`
        INSERT INTO nutzer (username, name, passwort)
        VALUES
          ('anna', 'Anna Mueller', 'geheim'),
          ('leo',  'Leo Schmidt',  'pass123');
      `);
    }
  } catch (err) {
    console.warn("Demo-Users konnten nicht angelegt werden:", err);
  }
}

// ---------- UI Binding ----------
function bindUI() {
  // If the shop runs inside an iframe (Free/Guided mode), start fully locked to avoid a race
  // before the parent sends SET_LOCK messages.
  const inIframe = (window.parent && window.parent !== window);
  if (inIframe) {
    document.querySelectorAll("[data-task]").forEach((el) => {
      const lockedAttr = el.getAttribute("data-locked");
      if (lockedAttr === "false") return;
      el.setAttribute("data-locked", "true");
      el.setAttribute("aria-disabled", "true");
    });

    // Special-case: search should not accept input while locked
    const input = document.getElementById("searchInput");
    const clear = document.getElementById("searchClear");
    const searchEl = document.querySelector('[data-task="search"]');
    const searchLocked = searchEl?.getAttribute("data-locked") === "true";
    if (input) {
      input.readOnly = !!searchLocked;
      input.style.pointerEvents = searchLocked ? "none" : "";
      if (searchLocked) { try { input.blur(); } catch (_) {} }
    }
    if (clear) clear.style.pointerEvents = searchLocked ? "none" : "";

    // Reset-Filter darf nie gesperrt sein
    const resetBtn = document.querySelector('[data-task="reset-filters"]');
    if (resetBtn) {
      resetBtn.setAttribute("data-locked", "false");
      resetBtn.setAttribute("aria-disabled", "false");
    }
  }
  // Ensure cart action buttons participate in the lock/task system.
  // In FreeMode, locked controls must stay clickable so the parent can open the editor.
  const _btnShowCart = document.getElementById("btnShowCart");
  if (_btnShowCart && !_btnShowCart.dataset.task) _btnShowCart.dataset.task = "cart-refresh";
  const _btnTotal = document.getElementById("btnTotal");
  if (_btnTotal && !_btnTotal.dataset.task) _btnTotal.dataset.task = "cart-total";

  // Alle Buttons (Shop + Filter + Sort-Optionen) arbeiten �ber data-task
  document.querySelectorAll("[data-task]").forEach(el => {
    const id = el.dataset.task;
    el.addEventListener("click", (e) => {
      e.preventDefault();
      onAction(id);
    });
  });

  // Sort Dropdown open/close
  const dd = els.sortDropdown();
  const selected = els.sortSelected();

  if (dd && selected) {
    selected.addEventListener("click", (e) => {
      e.stopPropagation();
      dd.classList.toggle("open");
    });

    document.addEventListener("click", () => {
      dd.classList.remove("open");
    });
  }

  // Start: Produkte direkt anzeigen (wie Amazon)
  // optional: state.sort = "popularity" ist bereits gesetzt


const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");
const searchBox = searchInput?.closest(".search");

if (searchInput) {
  searchInput.addEventListener("input", () => {
    state.searchTerm = searchInput.value.trim();
    state.showProducts = true;

    if (searchBox) {
      searchBox.classList.toggle("has-text", state.searchTerm.length > 0);
    }

    render();
  });
}

if (searchClear) {
  searchClear.addEventListener("click", () => {
    state.searchTerm = "";
    searchInput.value = "";

    if (searchBox) {
      searchBox.classList.remove("has-text");
    }

    render();
  });
}

  /* ================= WARENKORB INITIALISIERUNG ================= */

  const cartTrigger = Array.from(document.querySelectorAll(".profile"))
    .find(p => p.textContent.includes("Warenkorb"));

  if (cartTrigger) {
    if (!cartTrigger.dataset.task) cartTrigger.dataset.task = "open-cart";
    cartTrigger.style.cursor = "pointer";
    cartTrigger.addEventListener("click", (e) => {
      // if locked, do not open cart; selection handled via capture listener
      if (cartTrigger.dataset.locked === "true") { e.preventDefault(); return; }
      openCart();
    });
  }

  document.getElementById("cartClose")?.addEventListener("click", closeCart);
  document.getElementById("cartOverlay")?.addEventListener("click", closeCart);

  document.getElementById("btnShowCart")?.addEventListener("click", (e) => {
    const el = e.currentTarget;
    if (el?.dataset?.locked === "true") { e.preventDefault(); return; }
    showCart();
  });
  document.getElementById("btnTotal")?.addEventListener("click", (e) => {
    const el = e.currentTarget;
    if (el?.dataset?.locked === "true") { e.preventDefault(); return; }
    showTotal();
  });


   bindSqlLab();

   // Add-to-cart Delegation
document.querySelector(".products")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-add-cart]");
  if(!btn) return;

  e.preventDefault();
  e.stopPropagation();

  /* ALLE Effekte neu triggern */
  btn.classList.remove("ripple", "click", "shock");
  void btn.offsetWidth; // Reflow erzwingen

  btn.classList.add("ripple", "click", "shock");

  setTimeout(() => {
    btn.classList.remove("click", "shock");
  }, 220);

  addToCart(btn.dataset.addCart);
  flyToCart(btn);
});


}

// ---------- Actions ----------

const buttonGroups = {
  shop: ["all", "today", "bestseller", "available"],
  category: ["cat-electronics", "cat-household", "cat-sport"],
  price: ["price-25", "price-50", "price-100"],
  rating: ["rating-5", "rating-4"]
};


function setActiveButton(groupName, taskId) {
  const group = buttonGroups[groupName];
  if (!group) return;

  group.forEach(id => {
    document
      .querySelectorAll(`[data-task="${id}"]`)
      .forEach(btn => btn.classList.remove("active"));
  });

  document
    .querySelectorAll(`[data-task="${taskId}"]`)
    .forEach(btn => btn.classList.add("active"));
}

function clearAllActiveButtons() {
  document
    .querySelectorAll(".shop-btn.active, .filter-btn.active")
    .forEach(btn => btn.classList.remove("active"));
}


async function onAction(actionId) {

    // HARD LOCK: wenn der Button gelockt ist, darf nichts passieren
  const lockedEl = document.querySelector(`[data-task="${actionId}"][data-locked="true"]`);
  if (lockedEl) {
    // optional: kleines Feedback (kannst du auch weglassen)
    console.log("Locked:", actionId);
    return;
  }


    // Wenn es eine Aufgabe ist und noch gesperrt: Lab �ffnen und NICHT normal ausf�hren
  if (TASKS[actionId] && LOCKS[actionId]) {
    openSqlLab(TASKS[actionId]);
    return;
  }

  switch (actionId) {

    /* ===== SHOP BAR ===== */
    case "all":
      resetFilters();
      clearAllActiveButtons();
      state.showProducts = true; 
      setActiveButton("shop", "all");
      break;


    case "express":
    resetFilters();
    clearAllActiveButtons()
    state.showProducts = true;
    state.expressDelivery = true; // ? RICHTIG
    setActiveButton("shop", "express");
    break;

    case "bestseller":
      resetFilters();
      clearAllActiveButtons()
      state.showProducts = true;
      state.bestsellerOnly = true; 
      setActiveButton("shop", "bestseller");
      break;


    case "available":
      resetFilters();
      clearAllActiveButtons()
      state.showProducts = true;
      state.availableOnly = true;
      setActiveButton("shop", "available");
      break;

    /* ===== SORT ===== */
    case "priceAsc":
      state.sort = "priceAsc";
      setSortLabel("Preis ?");
      closeSort();
      break;

    case "priceDesc":
      state.sort = "priceDesc";
      setSortLabel("Preis ?");
      closeSort();
      break;

    case "popularity":
      state.sort = "popularity";
      setSortLabel("Beliebtheit");
      closeSort();
      break;

    /* ===== KATEGORIE ===== */
    case "cat-electronics":
      state.categoryId = 1;
      setActiveButton("category", actionId);
      break;

    case "cat-household":
      state.categoryId = 2;
      setActiveButton("category", actionId);
      break;

    case "cat-sport":
      state.categoryId = 3;
      setActiveButton("category", actionId);
      break;

    /* ===== PREIS ===== */
    case "price-25":
      state.priceMin = 0;
      state.priceMax = 25;
      setActiveButton("price", actionId);
      break;

    case "price-50":
      state.priceMin = 25;
      state.priceMax = 50;
      setActiveButton("price", actionId);
      break;

    case "price-100":
      state.priceMin = 50;
      state.priceMax = 100;
      setActiveButton("price", actionId);
      break;


    /* ===== BEWERTUNG ===== */
    case "rating-5":
      state.exactRating = 5;
      state.minRating = null;
      setActiveButton("rating", actionId);
      break;

    case "rating-4":
      state.minRating = 4;
      state.exactRating = null;
      setActiveButton("rating", actionId);
      break;

    /* ===== RESET ===== */
    case "reset-filters":
      resetFilters();
      clearAllActiveButtons();
      break;

    default:
      return;
  }

  await render();
}


function resetFilters() {
  state.categoryId = null;
  state.priceMax = null;
  state.priceMin = null;
  state.availableOnly = false;
  state.expressDelivery = false;
  state.minRating = null;
  state.exactRating = null;
  state.bestsellerOnly = false;
}



function closeSort() {
  const dd = els.sortDropdown();
  if (dd) dd.classList.remove("open");
}

function setSortLabel(text) {
  const selected = els.sortSelected();
  if (!selected) return;
  // Text + Pfeil beibehalten
  selected.innerHTML = `? Sortieren: ${escapeHtml(text)} <span class="sort-arrow">?</span>`;
}

// ---------- Query Builder (JOINs nach Schema) ----------
function buildQuery() {

  // ======================================================
  // SCH�LER-AUFGABE (SQL):
  // Ein Produkt ist ein BESTSELLER, wenn es mindestens
  // 300 Verk�ufe hat.
  //
  // SELECT *
  // FROM produkte p
  // JOIN verk�ufe v ON v.produkt_id = p.id
  // WHERE v.anzahl >= 300
  // ORDER BY v.anzahl DESC;
  //
  // Umsetzung hier:
  // - Verk�ufe werden summiert (SUM)
  // - Bestseller werden �ber HAVING gefiltert
  // ======================================================

  let sql = `
    SELECT
      p.id,
      p.name,
      p.preis,
      p.kategorie_id,
      k.name AS kategorie_name,
      p.lagerbestand,
      p.liefertage,
      COALESCE(ROUND(AVG(b.sterne), 1), 0) AS bewertung_avg,
      COALESCE(SUM(v.anzahl), 0) AS verkauft
    FROM produkte p
    LEFT JOIN kategorien k ON k.id = p.kategorie_id
    LEFT JOIN bewertungen b ON b.produkt_id = p.id
    LEFT JOIN verk�ufe v ON v.produkt_id = p.id
  `.trim();

  const where = [];


  /* ---------- WHERE (einfache Filter) ---------- */
  if (state.searchTerm && state.searchTerm.length > 0) {
  const term = state.searchTerm.replace(/'/g, "''");
  where.push(`p.name LIKE '%${term}%'`);
}

  if (state.categoryId != null) where.push(`p.kategorie_id = ${Number(state.categoryId)}`);
  if (state.priceMin != null) where.push(`p.preis >= ${Number(state.priceMin)}`);
  if (state.priceMax != null) where.push(`p.preis <= ${Number(state.priceMax)}`);
  if (state.availableOnly) where.push(`p.lagerbestand BETWEEN 1 AND 5`);
  if (state.expressDelivery) { where.push(`p.liefertage = 1`);}

  if (where.length) {
    sql += ` WHERE ${where.join(" AND ")}`;
  }

  /* ---------- GROUP BY (Produkt-Ebene) ---------- */
  sql += ` GROUP BY p.id`;

  /* ---------- HAVING (Aggregation) ---------- */
  const having = [];

  // Bewertungsfilter
  if (state.exactRating != null) having.push(`AVG(b.sterne) = ${Number(state.exactRating)}`);
  if (state.minRating != null) having.push(`AVG(b.sterne) >= ${Number(state.minRating)}`);

  // ======================================================
  // SCH�LER-AUFGABE:
  // Bestseller nur ab 300 Verk�ufen anzeigen
  // ======================================================
  if (state.bestsellerOnly) {
    having.push(`SUM(v.anzahl) >= 300`);
  }

  if (having.length) {
    sql += ` HAVING ${having.join(" AND ")}`;
  }

  /* ---------- SORTIERUNG ---------- */
  if (state.sort === "priceAsc") {
    sql += ` ORDER BY p.preis ASC`;
  } else if (state.sort === "priceDesc") {
    sql += ` ORDER BY p.preis DESC`;
  } else {
    // Standard: Beliebtheit = Verkaufszahlen
    sql += ` ORDER BY verkauft DESC`;
  }

  return sql + ";";
}


// ---------- Render ----------
async function render() {
  const container = els.products();
  if (!container) return;

  // Beim ersten Laden keine Produkte anzeigen

  if (!state.showProducts) {
    container.innerHTML = `
      <div style="
        padding: 40px;
        text-align: center;
        color: #6b7280;
        font-size: 14px;
      ">
      </div>
    `;
    return;
  }

  container.innerHTML = `<p style="padding:20px;opacity:.6">Lade Produkte�</p>`;

  const sql = buildQuery();

  let result;
  try {
    result = db.exec(sql);
  } catch (err) {
    container.innerHTML = `<p style="padding:20px;color:#b12704;font-weight:600">SQL-Fehler: ${escapeHtml(err.message)}</p>`;
    console.error("SQL:", sql);
    return;
  }

  if (!result.length || !result[0].values.length) {
    container.innerHTML = `<p style="padding:20px;opacity:.7">Keine Produkte gefunden.</p>`;
    return;
  }

  const { columns, values } = result[0];

  container.innerHTML = "";
  for (const row of values) {
    const p = Object.fromEntries(columns.map((c, i) => [c, row[i]]));

    const rating = Number(p.bewertung_avg || 0);
    const starsFull = Math.round(rating); // simple rendering
    const stars = "?".repeat(Math.max(0, Math.min(5, starsFull))) + "?".repeat(Math.max(0, 5 - Math.min(5, starsFull)));

    const isFast = Number(p.liefertage) === 1;
    const isBestseller = Number(p.verkauft) >= 300; // Schwelle frei w�hlbar
    const isLowStock = Number(p.lagerbestand) > 0 && Number(p.lagerbestand) <= 5;

   container.insertAdjacentHTML("beforeend", `
      <div class="product" data-product-id="${p.id}">
        
        <button class="add-cart-btn" data-add-cart="${p.id}">
  <svg class="cart-icon" viewBox="0 0 24 24" fill="none">
    <path d="M6 6h15l-1.5 8.5a2 2 0 0 1-2 1.5H9a2 2 0 0 1-2-1.6L5 3H2"
          stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="9" cy="20" r="1" fill="currentColor"/>
    <circle cx="17" cy="20" r="1" fill="currentColor"/>
  </svg>
  <span>In den Warenkorb</span>
</button>


        <div class="product-badges">
          ${isBestseller ? `<div class="badge bestseller">Bestseller</div>` : ""}
          ${isFast ? `<div class="badge fast-delivery">Lieferung morgen</div>` : ""}
          ${isLowStock ? `<div class="badge low-stock">Nur noch wenige auf Lager</div>` : ""}
        </div>

        <div class="product-img"></div>

        <h4 class="product-title">${escapeHtml(String(p.name))}</h4>

        <div class="rating" title="${rating.toFixed(1)} / 5">${stars}</div>

        <div class="price">${Number(p.preis).toFixed(2)} �</div>

        <div class="delivery ${isFast ? "fast" : ""}">
          Lieferung in ${Number(p.liefertage)} Tagen
        </div>

        <div class="meta">
          <span class="meta-chip">${escapeHtml(String(p.kategorie_name || "�"))}</span>
          <span class="meta-chip">${Number(p.lagerbestand) > 0 ? "Auf Lager" : "Nicht verf�gbar"}</span>
        </div>
      </div>
    `);
  }
}

// ================= SQL LAB (UI + Execution) =================
const labEls = {
  panel: () => document.getElementById("sqlLab"),
  empty: () => document.getElementById("labEmpty"),
  title: () => document.getElementById("sqlLabTitle"),
  goal: () => document.getElementById("sqlLabGoal"),
  close: () => document.getElementById("sqlLabClose"),
  input: () => document.getElementById("sqlInput"),
  run: () => document.getElementById("sqlRunBtn"),
  out: () => document.getElementById("sqlOutput"),
  table: () => document.getElementById("sqlTable"),
  tipBtn: () => document.getElementById("sqlTipBtn"),
  tipBox: () => document.getElementById("sqlTipBox")
};

let currentTask = null;


function bindSqlLab() {
  labEls.close()?.addEventListener("click", closeSqlLab);
  labEls.run()?.addEventListener("click", runStudentSql);
  labEls.tipBtn()?.addEventListener("click", () => {
    const box = labEls.tipBox();
    if (!box) return;
    box.style.display = box.style.display === "block" ? "none" : "block";
  });
}


function openSqlLab(task) {
  currentTask = task;

  labEls.title().textContent = task.title;
  labEls.goal().textContent = `Ziel: ${task.goal}`;

  renderDifficulty(task.difficulty, task.difficultyMax);

  labEls.title().textContent = `?? ${task.title}`;
  labEls.goal().textContent = `Ziel: ${task.goal}`;

  labEls.tipBox().textContent = task.tip || "";
  labEls.tipBox().style.display = "none";

  labEls.input().value = task.starterSql || "";




  labEls.out().textContent = "";
  labEls.table().innerHTML = "";

  labEls.empty().style.display = "none";
  labEls.panel().classList.add("open");
}

function renderDifficulty(level, max) {
  const box = document.getElementById("sqlDifficulty");
  if (!box) return;

  const label = box.querySelector(".difficulty-label");
  const dots = box.querySelectorAll(".difficulty-dots .dot");

  label.textContent = `Level ${level} / ${max}`;

  dots.forEach((d, i) => {
    d.classList.toggle("active", i < level);
  });
}


function closeSqlLab() {
  currentTask = null;
  labEls.panel().classList.remove("open");
  labEls.empty().style.display = "block";
}

function runStudentSql() {
  const out = labEls.out();
  const successBox = document.getElementById("sqlSuccess");
  const unlockBtn = document.getElementById("unlockBtn");

  out.textContent = "";
  successBox.style.display = "none";
  unlockBtn.classList.remove("enabled");

  try {
    const sql = labEls.input().value;
    const res = db.exec(sql);


    out.textContent = "Query executed successfully.";

    const ok = currentTask.validate(res, db);
    if (ok) {
      successBox.style.display = "block";
      unlockBtn.classList.add("enabled");

      unlockBtn.onclick = () => {
        unlockTask(currentTask.taskId);
        closeSqlLab();
      };
    }

  } catch (err) {
    out.textContent = err.message;
  }
}


function renderResultTable(execResult) {
  const target = labEls.table();
  target.innerHTML = "";

  if (!execResult || !execResult.length) return;

  const { columns, values } = execResult[0];
  const maxRows = Math.min(values.length, 30);

  let html = `<table><thead><tr>`;
  for (const c of columns) html += `<th>${escapeHtml(c)}</th>`;
  html += `</tr></thead><tbody>`;

  for (let i = 0; i < maxRows; i++) {
    html += `<tr>`;
    for (const cell of values[i]) html += `<td>${escapeHtml(cell)}</td>`;
    html += `</tr>`;
  }

  html += `</tbody></table>`;
  target.innerHTML = html;
}

function unlockTask(taskId) {
  LOCKS[taskId] = false;

  // Button entsperren + Effekt
  document.querySelectorAll(`[data-task="${taskId}"]`).forEach(btn => {
    btn.removeAttribute("data-locked");
    btn.classList.add("active"); // kurzer visueller Kick
    setTimeout(() => btn.classList.remove("active"), 350);
  });

  // Task-spezifische Aktion
  TASKS[taskId]?.onUnlock?.();
}


// ---------- Utils ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}

function extractIdsFromResult(execResult) {
  // execResult ist das Array aus db.exec(...)
  if (!execResult || !execResult.length) return new Set();
  const { columns, values } = execResult[0];
  const idIndex = columns.findIndex(c => String(c).toLowerCase() === "id");
  if (idIndex === -1) {
    // Falls kein id dabei: leeres Set => wird failen
    return new Set();
  }
  return new Set(values.map(v => Number(v[idIndex])));
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function toast(msg){
  const el = document.getElementById("toast");
  if(!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> el.classList.remove("show"), 1200);
}

function updateCartBadge(){
  const badge = document.getElementById("cartBadge");
  if(!badge || !db) return;

  const res = db.exec(`
    SELECT COALESCE(SUM(menge), 0)
    FROM warenkorb;

  `);

  const cnt = (res[0]?.values?.[0]?.[0] ?? 0);
  if(cnt > 0){
    badge.style.display = "flex";
    badge.textContent = String(cnt);
  } else {
    badge.style.display = "none";
    badge.textContent = "0";
  }
}

/** Fly-to-cart mini animation */
function flyToCart(fromEl){
  const cartEl = document.querySelector(".cart-trigger .cart-icon");
  const layer = document.getElementById("flyLayer");
  if(!fromEl || !cartEl || !layer) return;

  const a = fromEl.getBoundingClientRect();
  const b = cartEl.getBoundingClientRect();

  const dot = document.createElement("div");
  dot.className = "fly-dot";
  dot.style.left = (a.left + a.width/2) + "px";
  dot.style.top  = (a.top + a.height/2) + "px";
  layer.appendChild(dot);

  const x = (b.left + b.width/2) - (a.left + a.width/2);
  const y = (b.top + b.height/2) - (a.top + a.height/2);

  dot.animate([
    { transform: "translate(0px, 0px) scale(1)", opacity: 1 },
    { transform: `translate(${x}px, ${y}px) scale(.7)`, opacity: 0.2 }
  ], { duration: 520, easing: "cubic-bezier(.2,.8,.2,1)" });

  setTimeout(()=> dot.remove(), 540);
}

/** Upsert: add product into cart */
function addToCart(productId){
  if(!db) return;

  const pid = Number(productId);

  const check = db.exec(`
    SELECT menge
    FROM warenkorb
    WHERE produkt_id = ${pid};
  `);

  if(check.length && check[0].values.length){
    db.run(`
      UPDATE warenkorb
      SET menge = menge + 1
      WHERE produkt_id = ${pid};
    `);
  } else {
    db.run(`
      INSERT INTO warenkorb (produkt_id, menge)
      VALUES (${pid}, 1);
    `);
  }

  updateCartBadge();
}


/** Remove: delete item from cart completely */
function removeFromCart(productId){
  if(!db) return;

  const pid = Number(productId);

  db.run(`
    DELETE FROM warenkorb
    WHERE produkt_id = ${pid};
  `);

  updateCartBadge();
}



function isSelectOnly(sql) {
  const s = String(sql || "").trim().toLowerCase();
  if (!s.startsWith("select")) return false;

  // harte Blockliste (sicher, read-only)
  const forbidden = ["insert", "update", "delete", "drop", "alter", "create", "pragma", "attach", "detach"];
  return !forbidden.some(k => s.includes(k));
}


// ================= WARENKORB LOGIK =================

const cartPanel = document.getElementById("cartPanel");
const cartOverlay = document.getElementById("cartOverlay");
const cartContent = document.getElementById("cartContent");
const cartTotal = document.getElementById("cartTotal");

cartContent?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-remove-cart]");
  if(!btn) return;

  const productId = btn.dataset.removeCart;

  // Entfernen
  removeFromCart(productId);

  // UI: Zeile entfernen (smooth)
  const row = btn.closest(".cart-row");
  if(row){
    row.animate([{opacity:1, transform:"translateY(0)"},{opacity:0, transform:"translateY(6px)"}],
      {duration:180, easing:"ease-out"});
    setTimeout(()=> row.remove(), 170);
  }

  // Wenn leer -> Hinweis
  if(!cartContent.querySelector(".cart-row")){
    cartContent.innerHTML = `<p class="cart-hint">Warenkorb ist leer.</p>`;
  }

  toast("??? Entfernt");
});



document.getElementById("cartClose").addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);

document.getElementById("btnShowCart").addEventListener("click", (e) => {
    const el = e.currentTarget;
    if (el?.dataset?.locked === "true") { e.preventDefault(); return; }
    showCart();
  });
document.getElementById("btnTotal").addEventListener("click", (e) => {
    const el = e.currentTarget;
    if (el?.dataset?.locked === "true") { e.preventDefault(); return; }
    showTotal();
  });

function openCart() {
  cartPanel.classList.add("open");
  cartOverlay.classList.add("open");
}

function closeCart() {
  cartPanel.classList.remove("open");
  cartOverlay.classList.remove("open");
}

function showCart() {
  const sql = `
    SELECT 
      p.id,
      p.name,
      p.preis,
      w.menge,
      ROUND(p.preis * w.menge, 2) AS zeilensumme
    FROM produkte p, warenkorb w
    WHERE p.id = w.produkt_id
    ORDER BY p.name ASC;
  `;

  const res = db.exec(sql);
  cartTotal.textContent = "";

  if (!res.length || !res[0].values.length) {
    cartContent.innerHTML = `<p class="cart-hint">Warenkorb ist leer.</p>`;
    return;
  }

  const rows = res[0].values;

  cartContent.innerHTML = rows.map(r => `
    <div class="cart-row" data-cart-product="${r[0]}">
      <strong>${escapeHtml(r[1])}<div class="muted">${Number(r[2]).toFixed(2)} �</div></strong>
      <span>� ${r[3]}</span>
      <span><strong>${Number(r[4]).toFixed(2)} �</strong></span>
      <button class="cart-remove" data-remove-cart="${r[0]}" title="Entfernen">?</button>
    </div>
  `).join("");

  // Placeholder sicher weg
  updateCartBadge();
}


function showTotal() {
  const sql = `
    SELECT ROUND(COALESCE(SUM(p.preis * w.menge), 0), 2) AS gesamtpreis
    FROM produkte p, warenkorb w
    WHERE p.id = w.produkt_id
  `;

  const res = db.exec(sql);
  const total = (res[0]?.values?.[0]?.[0] ?? 0);

  cartTotal.textContent = `Gesamtpreis: ${Number(total).toFixed(2)} �`;
}


// ================= KONTO & LISTEN LOGIK =================

const accountPanel = document.getElementById("accountPanel");
const accountOverlay = document.getElementById("accountOverlay");
let sqliProtectionEnabled = false;
let sqliSecureSql = `SELECT id, username, name
FROM users
WHERE username = ?
  AND password = ?
LIMIT 1;`;
let sqliSecureBinding = null;

try {
  sqliProtectionEnabled = localStorage.getItem("schulazon_sqli_secured_v1") === "true";
  sqliSecureSql = localStorage.getItem("schulazon_sqli_secure_sql_v1") || sqliSecureSql;
  sqliSecureBinding = JSON.parse(localStorage.getItem("schulazon_sqli_secure_binding_v1") || "null");
} catch (_) {}

// Trigger: Klick auf "Hallo, Anna � Konto & Listen"
const accountTrigger = Array.from(document.querySelectorAll(".profile"))
  .find(p => p.textContent.includes("Konto"));

if (accountTrigger) {
  accountTrigger.style.cursor = "pointer";
  accountTrigger.addEventListener("click", openAccount);
}

document.getElementById("accountClose")?.addEventListener("click", closeAccount);
accountOverlay?.addEventListener("click", closeAccount);
document.getElementById("sqliLoginTask")?.addEventListener("click", () => {
  emitSqliTaskSelection();
});

// ================= KONTO & LISTEN =================

function createLoginBindValues(binding, username, password) {
  if (!binding || binding.type === "array") {
    const order = binding?.order?.length ? binding.order : ["username", "password"];
    return order.map((name) => name === "password" ? password : username);
  }
  const values = {};
  (binding.items || []).forEach((item) => {
    values[item.key] = item.value === "password" ? password : username;
  });
  return values;
}

function queryLoginPrepared(sql, username, password, binding = null) {
  if (!db) return false;
  let stmt = null;
  try {
    stmt = db.prepare(sql);
    stmt.bind(createLoginBindValues(binding, username, password));
    return !!stmt.step();
  } catch (_) {
    return false;
  } finally {
    try { stmt?.free(); } catch (_) {}
  }
}

function isKnownLogin(username, password) {
  return queryLoginPrepared(
    "SELECT id FROM users WHERE username = ? AND password = ? LIMIT 1;",
    username,
    password
  );
}

function runVulnerableLogin(username, password) {
  const sql = `SELECT id, username, name FROM users WHERE username = '${username}' AND password = '${password}' LIMIT 1;`;
  const res = db.exec(sql);
  return !!res?.[0]?.values?.length;
}

function updateSqliGateState(state = {}) {
  const gate = document.getElementById("btnSqliTask");
  const block = document.getElementById("sqliLoginTask");
  const locked = !state.canOpen;
  const secured = !!state.secured;
  const injected = !!state.injected;

  if (gate) {
    gate.dataset.locked = locked ? "true" : "false";
    gate.setAttribute("aria-disabled", "false");
    const text = gate.querySelector(".account-sqli-text");
    const icon = gate.querySelector(".account-sqli-lock");
    if (icon) icon.textContent = secured ? "ok" : "++++";
    if (text) text.textContent = secured ? "gepusht" : "Zusatz";
  }

  if (block) {
    block.dataset.sqliState = locked ? "locked" : (secured ? "secured" : (injected ? "injected" : "ready"));
    block.classList.toggle("is-sqli-locked", false);
    block.classList.toggle("is-sqli-ready", !secured);
    block.classList.toggle("is-sqli-secured", secured);
  }

  [document.getElementById("loginUser"), document.getElementById("loginPass")].forEach((input) => {
    if (!input) return;
    input.readOnly = false;
    input.style.pointerEvents = "";
  });
  const loginBtn = document.getElementById("btnLogin");
  if (loginBtn) {
    loginBtn.style.pointerEvents = "";
    loginBtn.setAttribute("aria-disabled", "false");
  }
}

function emitSqliTaskSelection() {
  try {
    window.parent?.postMessage(
      { __SCHULAZON__: true, type: "SHOP_ACTION", actionId: "sqli" },
      window.location.origin
    );
  } catch (_) {}
}




function fakeLogin(){
  const status = document.getElementById("loginStatus");
  if(!status) return;

  // Absichtlich verwundbarer Demo-Login: SQL wird per String-Konkatenation gebaut.
  // Ziel der Aufgabe: per SQL-Injection die WHERE-Bedingung manipulieren.

  // Eingaben robust finden (IDs k�nnen je nach HTML variieren)
  const container = document.querySelector('.account-login') || document.getElementById('accountPanel') || document;
  const inputs = Array.from(container.querySelectorAll('input'));
  const userRaw = (inputs[0]?.value ?? '').toString();
  const passRaw = (inputs[1]?.value ?? '').toString();

  {
    let ok = false;
    let injectionBypass = false;
    if (sqliProtectionEnabled) {
      ok = queryLoginPrepared(sqliSecureSql, userRaw, passRaw, sqliSecureBinding);
    } else {
      try {
        ok = runVulnerableLogin(userRaw, passRaw);
        injectionBypass = ok && !isKnownLogin(userRaw, passRaw);
      } catch (_) {
        ok = false;
      }
    }

    if (ok) {
      status.textContent = "Login erfolgreich";
      status.className = "login-status success";
      try {
        if (injectionBypass && localStorage.getItem('schulazon_sqli_done_v1') !== 'true') {
          localStorage.setItem('schulazon_sqli_done_v1', 'true');
          window.parent?.postMessage({ __SCHULAZON__: true, type: 'SQLI_SUCCESS' }, window.location.origin);
        }
      } catch (_) {}
      return;
    }

    status.textContent = "Login fehlgeschlagen";
    status.className = "login-status error";
    return;
  }

  // Versuche mehrere plausible Tabellen/Spalten, ohne die UI zu zerlegen.
  const candidates = [
    { table: 'nutzer', user: 'username', pass: 'passwort' },
    { table: 'nutzer', user: 'name',     pass: 'passwort' },
    { table: 'users',  user: 'username', pass: 'password' },
    { table: 'users',  user: 'name',     pass: 'password' },
  ];

  let ok = false;
  for (const c of candidates) {
    const sql = `SELECT id FROM ${c.table} WHERE ${c.user} = '${userRaw}' AND ${c.pass} = '${passRaw}' LIMIT 1;`;
    try {
      const res = db.exec(sql);
      if (res?.[0]?.values?.length) { ok = true; break; }
    } catch (_) {
      // n�chste Variante probieren
    }
  }

  if (ok) {
    status.textContent = "Login erfolgreich";
    status.className = "login-status success";

    // Einmaliger Bonus-Event an den Parent (Score +10)
    try {
      if (localStorage.getItem('schulazon_sqli_done_v1') !== 'true') {
        localStorage.setItem('schulazon_sqli_done_v1', 'true');
        window.parent?.postMessage({ __SCHULAZON__: true, type: 'SQLI_SUCCESS' }, window.location.origin);
      }
    } catch (_) {}

    return;
  }

  status.textContent = "Login fehlgeschlagen";
  status.className = "login-status error";
}

let ordersOpen = false;

function showOrders(){
  const target = document.getElementById("ordersResult");
  const btn = document.getElementById("btnOrders");

  if (ordersOpen) {
    target.innerHTML = "";
    btn.textContent = "?? Meine Bestellungen anzeigen";
    ordersOpen = false;
    return;
  }

  const sql = `
    SELECT
      p.name,
      v.anzahl,
      ROUND(p.preis * v.anzahl, 2) AS summe
    FROM verk�ufe v
    JOIN produkte p ON p.id = v.produkt_id
    WHERE v.nutzer_id = ${MEINE_ID}
    ORDER BY v.id DESC
    LIMIT 3;
  `;

  const res = db.exec(sql);

  if (!res.length || !res[0].values.length) {
    target.innerHTML = `<div class="account-hint">Keine Bestellungen vorhanden.</div>`;
  } else {
    target.innerHTML = res[0].values.map(r => `
      <div class="account-row">
        <div>
          <strong>${escapeHtml(r[0])}</strong>
          <div class="muted">${r[1]}�</div>
        </div>
        <div><strong>${Number(r[2]).toFixed(2)} �</strong></div>
      </div>
    `).join("");
  }

  btn.textContent = "?? Meine Bestellungen einklappen";
  ordersOpen = true;
}

let topProductsOpen = false;

function showTopProducts(){
  const target = document.getElementById("topProductsResult");
  const btn = document.getElementById("btnTopProducts");

  if (!target || !btn || !db) return;

  if (topProductsOpen) {
    target.innerHTML = "";
    btn.textContent = "? Meine Top-Produkte anzeigen";
    topProductsOpen = false;
    return;
  }

  const sql = `
    SELECT
      p.name,
      SUM(v.anzahl) AS gesamt
    FROM verk�ufe v
    JOIN produkte p ON p.id = v.produkt_id
    GROUP BY p.id
    ORDER BY gesamt DESC
    LIMIT 2;
  `;

  const res = db.exec(sql);

  if (!res.length || !res[0].values.length) {
    target.innerHTML = `<div class="account-hint">Keine Daten vorhanden.</div>`;
  } else {
    target.innerHTML = res[0].values.map(r => `
      <div class="account-row">
        <div>
          <strong>${escapeHtml(r[0])}</strong>
          <div class="muted">${r[1]}� gekauft</div>
        </div>
      </div>
    `).join("");
  }

  btn.textContent = "? Meine Top-Produkte einklappen";
  topProductsOpen = true;
}





function openAccount() {
  closeCart(); // ?? wichtig: nie beide Panels gleichzeitig
  accountPanel.classList.add("open");
  accountOverlay.classList.add("open");
}

function closeAccount() {
  accountPanel.classList.remove("open");
  accountOverlay.classList.remove("open");
}

// ================= ACCOUNT PANEL EVENT DELEGATION =================

document.getElementById("accountPanel")?.addEventListener("click", (e) => {
  const btnLogin = e.target.closest("#btnLogin");
  const btnOrders = e.target.closest("#btnOrders");
  const btnTop = e.target.closest("#btnTopProducts");

  if (btnLogin) {
    e.preventDefault();
    fakeLogin();
    return;
  }

  if (btnOrders) {
    e.preventDefault();
    if (btnOrders.dataset.locked === "true") return;
    showOrders();
    return;
  }

  if (btnTop) {
    e.preventDefault();
    if (btnTop.dataset.locked === "true") return;
    showTopProducts();
    return;
  }
});

// ======================================================
// SHOP <-> MODE BRIDGE (iframe postMessage, minimal)
// ======================================================
(function () {
  // Mode -> Shop empfangen
  window.addEventListener("message", (e) => {
    // nur gleiche Origin + unser Marker
    if (e.origin !== window.location.origin) return;
    const msg = e.data;
    if (!msg || msg.__SCHULAZON__ !== true) return;

    if (msg.type === "SET_SQLI_STATE") {
      updateSqliGateState(msg);
      return;
    }

    if (msg.type === "SET_SQLI_PROTECTION") {
      sqliProtectionEnabled = !!msg.enabled;
      if (msg.sql) sqliSecureSql = String(msg.sql);
      sqliSecureBinding = msg.binding || null;
      try {
        localStorage.setItem("schulazon_sqli_secured_v1", sqliProtectionEnabled ? "true" : "false");
        localStorage.setItem("schulazon_sqli_secure_sql_v1", sqliSecureSql);
        localStorage.setItem("schulazon_sqli_secure_binding_v1", JSON.stringify(sqliSecureBinding));
      } catch (_) {}
      return;
    }

    // a) Button sperren/entsperren
    if (msg.type === "SET_LOCK") {
      const { taskId, locked } = msg;

      if (taskId === "sqli") {
        updateSqliGateState({
          minPct: 5,
          canOpen: !locked,
          injected: localStorage.getItem("schulazon_sqli_done_v1") === "true",
          secured: sqliProtectionEnabled
        });
      }

      if (taskId === "reset-filters") {
        document.querySelectorAll(`[data-task="${taskId}"]`).forEach((el) => {
          el.setAttribute("data-locked", "false");
          el.setAttribute("aria-disabled", "false");
        });
        return;
      }

      document.querySelectorAll(`[data-task="${taskId}"]`).forEach((el) => {
        // Locked controls must stay clickable (parent opens editor on click).
        // If an element was shipped as <button disabled>, remove it here.
        if (el.hasAttribute("disabled")) el.removeAttribute("disabled");
        if ("disabled" in el) {
          try { el.disabled = false; } catch (_) {}
        }

        el.setAttribute("data-locked", locked ? "true" : "false");
        el.setAttribute("aria-disabled", locked ? "true" : "false");

        // Locked must remain clickable (task selection happens via click -> parent editor)
        // Therefore: NEVER set pointer-events:none and NEVER set disabled=true here.
        el.style.opacity = locked ? "0.88" : "";

        // Special-case: search bar should not be usable while locked
        if (taskId === "search") {
          const input = el.querySelector("#searchInput");
          const clear = el.querySelector("#searchClear");

          if (input) {
            input.readOnly = !!locked;
            // ensure clicks land on the container when locked (so it can be selected as a task)
            input.style.pointerEvents = locked ? "none" : "";
            if (locked) { try { input.blur(); } catch(_) {} }
          }
          if (clear) {
            clear.style.pointerEvents = locked ? "none" : "";
          }
        }
      });

      return;
    }

    if (msg.type === "SET_TASK_META") {
      const tasks = (msg.tasks && typeof msg.tasks === "object") ? msg.tasks : {};
      document.querySelectorAll("[data-task]").forEach((el) => {
        const meta = tasks[el.dataset.task];
        if (!meta) {
          el.removeAttribute("data-lock-difficulty");
          el.removeAttribute("data-difficulty-level");
          return;
        }

        const level = Math.max(1, Math.min(3, Number(meta.difficultyLevel) || 1));
        const rawLabel = String(meta.difficulty || "").trim();
        const label = /^[+]{1,3}$/.test(rawLabel) ? rawLabel : "+".repeat(level);
        el.setAttribute("data-lock-difficulty", label);
        el.setAttribute("data-difficulty-level", String(level));
      });
      return;
    }

    // a2) Unlock-Pulse auf einem konkreten Button
    if (msg.type === "PULSE_ACTION") {
      const { taskId } = msg;
      if (!taskId) return;

      document.querySelectorAll(`[data-task="${taskId}"]`).forEach((el) => {
        el.classList.remove("unlock-pulse");
        // reflow -> Animation neu starten
        void el.offsetWidth;
        el.classList.add("unlock-pulse");
        window.setTimeout(() => {
          try { el.classList.remove("unlock-pulse"); } catch (_) {}
        }, 900);
      });
      return;
    }

// b) Shop-Aktion ausl�sen (wie Klick)
    if (msg.type === "RUN_ACTION") {
      const { actionId } = msg;
      if (typeof onAction === "function") onAction(actionId);
      return;
    }
  });

  // Shop -> Mode melden, wenn im Shop etwas geklickt wurde
  function shopEmit(type, payload = {}) {
    try {
      window.parent?.postMessage(
        { __SCHULAZON__: true, type, ...payload },
        window.location.origin
      );
    } catch (_) {}
  }

  // Hook: onAction wrapper (�ndert Logik nicht)
  const _onAction = (typeof onAction === "function") ? onAction : null;
  if (_onAction) {
    onAction = async function(actionId) {
      shopEmit("SHOP_ACTION", { actionId });
      return _onAction(actionId);
    };
  }

    // Shop meldet: Listener ist aktiv und Shop ist bereit
  shopEmit("SHOP_READY", {});

})();


// === CAPTURE delegated handler for parent task selection (iframe -> parent) ===
document.addEventListener("DOMContentLoaded", () => {
  if (window.__SCHULAZON_PARENT_TASK_CAPTURE__) return;
  window.__SCHULAZON_PARENT_TASK_CAPTURE__ = true;

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-task]");
    if (!el) return;

    const actionId = el.dataset.task;
    if (!actionId) return;

    // Always notify parent first (opens editor)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: "SHOP_ACTION", actionId }, "*");
    }
  }, true); // capture
});
