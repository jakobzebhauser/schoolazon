/************************************************************
 * Schulazon – Shop-Logik (stabile Basis)
 * Fokus:
 * - Filtern
 * - Sortieren
 * - Suche
 * - Warenkorb
 * - Konto & Listen
 *
 * DB-Schema:
 * produkte(id, name, preis, kategorie_id, lagerbestand, liefertage)
 * kategorien(id, name)
 * bewertungen(id, produkt_id, sterne)
 * verkäufe(id, produkt_id, anzahl)
 * warenkorb(produkt_id, menge)
 ************************************************************/

let db = null;

/* =========================================================
   1. GLOBALER STATE (UI-Zustand)
   ========================================================= */
const state = {
  // Anzeige
  showProducts: false,

  // Filter
  categoryId: null,
  priceMin: null,
  priceMax: null,
  availableOnly: false,
  expressDelivery: false,
  bestsellerOnly: false,

  // Bewertung
  minRating: null,
  exactRating: null,

  // Suche & Sortierung
  searchTerm: "",
  sort: "popularity" // default
};

/* =========================================================
   2. DOM-HELPER
   ========================================================= */
const els = {
  products: () => document.querySelector(".products"),
  sortDropdown: () => document.getElementById("sortDropdown"),
  sortSelected: () => document.querySelector("#sortDropdown .sort-selected")
};

/* =========================================================
   3. INITIALISIERUNG
   ========================================================= */
window.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const SQL = await initSqlJs({
      locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${f}`
    });

    const res = await fetch("produkte.sqlite");
    if (!res.ok) throw new Error("produkte.sqlite nicht gefunden");

    db = new SQL.Database(new Uint8Array(await res.arrayBuffer()));

    bindUI();
    render();

  } catch (err) {
    const c = els.products();
    if (c) {
      c.innerHTML = `<p style="padding:20px;color:#b12704;font-weight:600">
        ❌ ${escapeHtml(err.message)}
      </p>`;
    }
    console.error(err);
  }
}

/* =========================================================
   4. UI-BINDINGS
   ========================================================= */
function bindUI() {

  /* ---- Alle Buttons über data-task ---- */
  document.querySelectorAll("[data-task]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      onAction(btn.dataset.task);
    });
  });

  /* ---- Sort-Dropdown ---- */
  const dd = els.sortDropdown();
  const selected = els.sortSelected();

  if (dd && selected) {
    selected.addEventListener("click", e => {
      e.stopPropagation();
      dd.classList.toggle("open");
    });

    document.addEventListener("click", () => dd.classList.remove("open"));
  }

  /* ---- Suche ---- */
  const searchInput = document.getElementById("searchInput");
  const searchClear = document.getElementById("searchClear");
  const searchBox = searchInput?.closest(".search");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      state.searchTerm = searchInput.value.trim();
      state.showProducts = true;

      searchBox?.classList.toggle("has-text", state.searchTerm.length > 0);
      render();
    });
  }

  if (searchClear) {
    searchClear.addEventListener("click", () => {
      state.searchTerm = "";
      searchInput.value = "";
      searchBox?.classList.remove("has-text");
      render();
    });
  }

  /* ---- Warenkorb ---- */
  document.getElementById("cartClose")?.addEventListener("click", closeCart);
  document.getElementById("cartOverlay")?.addEventListener("click", closeCart);
  document.getElementById("btnShowCart")?.addEventListener("click", showCart);
  document.getElementById("btnTotal")?.addEventListener("click", showTotal);

  const cartTrigger = [...document.querySelectorAll(".profile")]
    .find(p => p.textContent.includes("Warenkorb"));
  cartTrigger?.addEventListener("click", openCart);

  /* ---- Konto ---- */
  document.getElementById("accountClose")?.addEventListener("click", closeAccount);
  document.getElementById("accountOverlay")?.addEventListener("click", closeAccount);
  document.getElementById("btnOrders")?.addEventListener("click", showOrders);
  document.getElementById("btnTopProducts")?.addEventListener("click", showTopProducts);

  const accountTrigger = [...document.querySelectorAll(".profile")]
    .find(p => p.textContent.includes("Konto"));
  accountTrigger?.addEventListener("click", openAccount);
}

/* =========================================================
   5. BUTTON-AKTIONEN
   ========================================================= */
function onAction(id) {

  resetFilters();

  switch (id) {
    /* ---- Shop ---- */
    case "all":
      state.showProducts = true;
      break;

    case "express":
      state.expressDelivery = true;
      state.showProducts = true;
      break;

    case "bestseller":
      state.bestsellerOnly = true;
      state.showProducts = true;
      break;

    case "available":
      state.availableOnly = true;
      state.showProducts = true;
      break;

    /* ---- Sortieren ---- */
    case "priceAsc":
      state.sort = "priceAsc";
      setSortLabel("Preis ↑");
      break;

    case "priceDesc":
      state.sort = "priceDesc";
      setSortLabel("Preis ↓");
      break;

    case "popularity":
      state.sort = "popularity";
      setSortLabel("Beliebtheit");
      break;

    /* ---- Kategorien ---- */
    case "cat-electronics": state.categoryId = 1; break;
    case "cat-household":   state.categoryId = 2; break;
    case "cat-sport":       state.categoryId = 3; break;

    /* ---- Preis ---- */
    case "price-25":  state.priceMin = 0;  state.priceMax = 25;  break;
    case "price-50":  state.priceMin = 25; state.priceMax = 50;  break;
    case "price-100": state.priceMin = 50; state.priceMax = 100; break;

    /* ---- Bewertung ---- */
    case "rating-5": state.exactRating = 5; break;
    case "rating-4": state.minRating = 4;   break;

    /* ---- Reset ---- */
    case "reset-filters":
      break;

    default:
      return;
  }

  render();
}

/* =========================================================
   6. QUERY BUILDER
   ========================================================= */
function buildQuery() {

  let sql = `
    SELECT
      p.id, p.name, p.preis, p.lagerbestand, p.liefertage,
      k.name AS kategorie_name,
      COALESCE(ROUND(AVG(b.sterne),1),0) AS bewertung_avg,
      COALESCE(SUM(v.anzahl),0) AS verkauft
    FROM produkte p
    LEFT JOIN kategorien k ON k.id = p.kategorie_id
    LEFT JOIN bewertungen b ON b.produkt_id = p.id
    LEFT JOIN verkäufe v ON v.produkt_id = p.id
  `;

  const where = [];

  if (state.searchTerm)
    where.push(`p.name LIKE '%${state.searchTerm.replace(/'/g, "''")}%'`);

  if (state.categoryId) where.push(`p.kategorie_id = ${state.categoryId}`);
  if (state.priceMin != null) where.push(`p.preis >= ${state.priceMin}`);
  if (state.priceMax != null) where.push(`p.preis <= ${state.priceMax}`);
  if (state.availableOnly) where.push(`p.lagerbestand BETWEEN 1 AND 5`);
  if (state.expressDelivery) where.push(`p.liefertage = 1`);

  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;

  sql += ` GROUP BY p.id`;

  const having = [];
  if (state.exactRating != null) having.push(`AVG(b.sterne) = ${state.exactRating}`);
  if (state.minRating != null)   having.push(`AVG(b.sterne) >= ${state.minRating}`);
  if (state.bestsellerOnly)      having.push(`SUM(v.anzahl) >= 300`);

  if (having.length) sql += ` HAVING ${having.join(" AND ")}`;

  if (state.sort === "priceAsc")       sql += ` ORDER BY p.preis ASC`;
  else if (state.sort === "priceDesc") sql += ` ORDER BY p.preis DESC`;
  else                                 sql += ` ORDER BY verkauft DESC`;

  return sql + ";";
}

/* =========================================================
   7. RENDER
   ========================================================= */
function render() {
  const container = els.products();
  if (!container) return;

  if (!state.showProducts) {
    container.innerHTML = "";
    return;
  }

  let result;
  try {
    result = db.exec(buildQuery());
  } catch (err) {
    container.innerHTML = `<p style="padding:20px;color:#b12704">SQL-Fehler</p>`;
    return;
  }

  if (!result.length || !result[0].values.length) {
    container.innerHTML = `<p style="padding:20px;opacity:.7">Keine Produkte gefunden.</p>`;
    return;
  }

  const { columns, values } = result[0];
  container.innerHTML = "";

  values.forEach(row => {
    const p = Object.fromEntries(columns.map((c, i) => [c, row[i]]));
    const isFast = p.liefertage === 1;
    const isLow = p.lagerbestand > 0 && p.lagerbestand <= 5;
    const isBest = p.verkauft >= 300;

    container.insertAdjacentHTML("beforeend", `
      <div class="product">
        <div class="product-badges">
          ${isBest ? `<div class="badge bestseller">Bestseller</div>` : ""}
          ${isFast ? `<div class="badge fast-delivery">Lieferung morgen</div>` : ""}
          ${isLow ? `<div class="badge low-stock">Nur noch wenige</div>` : ""}
        </div>
        <div class="product-img"></div>
        <h4>${escapeHtml(p.name)}</h4>
        <div class="price">${p.preis.toFixed(2)} €</div>
        <div class="delivery">Lieferung in ${p.liefertage} Tagen</div>
      </div>
    `);
  });
}

/* =========================================================
   8. WARENKORB & KONTO
   ========================================================= */
function openCart() {
  document.getElementById("cartPanel")?.classList.add("open");
  document.getElementById("cartOverlay")?.classList.add("open");
}
function closeCart() {
  document.getElementById("cartPanel")?.classList.remove("open");
  document.getElementById("cartOverlay")?.classList.remove("open");
}
function showCart() { /* unverändert – DB-Abfrage wie zuvor */ }
function showTotal() { /* unverändert */ }

function openAccount() {
  closeCart();
  document.getElementById("accountPanel")?.classList.add("open");
  document.getElementById("accountOverlay")?.classList.add("open");
}
function closeAccount() {
  document.getElementById("accountPanel")?.classList.remove("open");
  document.getElementById("accountOverlay")?.classList.remove("open");
}
function showOrders() {
  document.getElementById("accountResult").innerHTML =
    `<p class="account-hint">Keine Daten verfügbar.</p>`;
}
function showTopProducts() {
  document.getElementById("accountResult").innerHTML =
    `<p class="account-hint">Noch nicht implementiert.</p>`;
}

/* =========================================================
   9. HILFSFUNKTIONEN
   ========================================================= */
function resetFilters() {
  state.categoryId = null;
  state.priceMin = null;
  state.priceMax = null;
  state.availableOnly = false;
  state.expressDelivery = false;
  state.bestsellerOnly = false;
  state.minRating = null;
  state.exactRating = null;
}

function setSortLabel(text) {
  els.sortSelected().innerHTML =
    `⇅ Sortieren: ${escapeHtml(text)} <span class="sort-arrow">▾</span>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m])
  );
}
