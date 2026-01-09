/************************************************************
 * Schulazon Shop – stabile Basis (ohne Sperren/Rechtsklick)
 * DB-Schema:
 * produkte(id, name, preis, kategorie_id, lagerbestand, liefertage)
 * kategorien(id, name)
 * bewertungen(id, produkt_id, sterne)
 * verkäufe(id, produkt_id, anzahl)
 * warenkorb(produkt_id, menge)
 ************************************************************/

let db = null;

// ---------- UI / State ----------
const state = {
  // Filter
  categoryId: null,     // number | null
  priceMax: null,       // number | null
  priceMin: null,
  availableOnly: false, // boolean
  expressDelivery: false,  // boolean
  

  // Rating Filter (aggregiert)
  minRating: null,      // number | null (z.B. 4)
  exactRating: null,    // number | null (z.B. 5)

  // Sort
  sort: "popularity",    // "popularity" | "priceAsc" | "priceDesc"

  bestsellerOnly: false
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

    const res = await fetch("produkte.sqlite");
    if (!res.ok) throw new Error("produkte.sqlite nicht gefunden (liegt die Datei im selben Ordner wie index.html?)");

    db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));

    // rechter Bereich: Name beibehalten (nur Anzeige)
    const nameEl = els.studentName();
    if (nameEl) nameEl.textContent = "Anna Müller";

    bindUI();
    await render();

  } catch (err) {
    const c = els.products();
    if (c) c.innerHTML = `<p style="padding:20px;color:#b12704;font-weight:600">❌ ${escapeHtml(err.message)}</p>`;
    console.error(err);
  }
}

// ---------- UI Binding ----------
function bindUI() {
  // Alle Buttons (Shop + Filter + Sort-Optionen) arbeiten über data-task
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
  switch (actionId) {

    /* ===== SHOP BAR ===== */
    case "all":
      resetFilters();
      clearAllActiveButtons()
      setActiveButton("shop", "all");
      break;

    case "express":
    resetFilters();
    clearAllActiveButtons()
    state.expressDelivery = true; // ✅ RICHTIG
    setActiveButton("shop", "express");
    break;

    case "bestseller":
      resetFilters();
      clearAllActiveButtons()
      state.bestsellerOnly = true; 
      setActiveButton("shop", "bestseller");
      break;


    case "available":
      resetFilters();
      clearAllActiveButtons()
      state.availableOnly = true;
      setActiveButton("shop", "available");
      break;

    /* ===== SORT ===== */
    case "priceAsc":
      state.sort = "priceAsc";
      setSortLabel("Preis ↑");
      closeSort();
      break;

    case "priceDesc":
      state.sort = "priceDesc";
      setSortLabel("Preis ↓");
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
  selected.innerHTML = `⇅ Sortieren: ${escapeHtml(text)} <span class="sort-arrow">▾</span>`;
}

// ---------- Query Builder (JOINs nach Schema) ----------
function buildQuery() {

  // ======================================================
  // SCHÜLER-AUFGABE (SQL):
  // Ein Produkt ist ein BESTSELLER, wenn es mindestens
  // 300 Verkäufe hat.
  //
  // SELECT *
  // FROM produkte p
  // JOIN verkäufe v ON v.produkt_id = p.id
  // WHERE v.anzahl >= 300
  // ORDER BY v.anzahl DESC;
  //
  // Umsetzung hier:
  // - Verkäufe werden summiert (SUM)
  // - Bestseller werden über HAVING gefiltert
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
    LEFT JOIN verkäufe v ON v.produkt_id = p.id
  `.trim();

  /* ---------- WHERE (einfache Filter) ---------- */
  const where = [];
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
  // SCHÜLER-AUFGABE:
  // Bestseller nur ab 300 Verkäufen anzeigen
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

  container.innerHTML = `<p style="padding:20px;opacity:.6">Lade Produkte…</p>`;

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
    const stars = "★".repeat(Math.max(0, Math.min(5, starsFull))) + "☆".repeat(Math.max(0, 5 - Math.min(5, starsFull)));

    const isFast = Number(p.liefertage) === 1;
    const isBestseller = Number(p.verkauft) >= 300; // Schwelle frei wählbar
    const isLowStock = Number(p.lagerbestand) > 0 && Number(p.lagerbestand) <= 5;

    container.insertAdjacentHTML("beforeend", `
      <div class="product">
        
      <div class="product-badges">
        ${isBestseller ? `<div class="badge bestseller">Bestseller</div>` : ""}
        ${isFast ? `<div class="badge fast-delivery">Lieferung morgen</div>` : ""}
        ${isLowStock ? `<div class="badge low-stock">Nur noch wenige auf Lager</div>` : ""}
      </div>



        <div class="product-img"></div>

        <h4 class="product-title">${escapeHtml(String(p.name))}</h4>

        <div class="rating" title="${rating.toFixed(1)} / 5">${stars}</div>

        <div class="price">${Number(p.preis).toFixed(2)} €</div>

        <div class="delivery ${isFast ? "fast" : ""}">
          Lieferung in ${Number(p.liefertage)} Tagen
        </div>

        <div class="meta">
          <span class="meta-chip">${escapeHtml(String(p.kategorie_name || "—"))}</span>
          <span class="meta-chip">${Number(p.lagerbestand) > 0 ? "Auf Lager" : "Nicht verfügbar"}</span>
        </div>
      </div>
    `);
  }
}

// ---------- Utils ----------
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[m]));
}
