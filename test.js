/* Schulazon Tutorial v5
   - Robust über file:// und http(s) (origin "null" / handshake race)
   - Shop ist immer initial gelockt; Unlocks kommen sicher an (Resend Loop)
   - WHERE/ORDER BY sind Unlock-Aufgaben (keine reinen Beispiele)
   - Kein "JOIN": Verknüpfungen nur via FROM ... , ... WHERE ...
   - Beim Öffnen: immer Reset (Step+Unlocks zurücksetzen), damit es jedes Mal gleich startet
*/
"use strict";

const $ = (sel) => document.querySelector(sel);

const SHOP_TASKS = [
  "all","express","bestseller","available",
  "search",
  "priceAsc","priceDesc","popularity",
  "cat-electronics","cat-household","cat-sport",
  "price-25","price-50","price-100",
  "rating-4","rating-5",
  "reset-filters",
  "cart-refresh","cart-total",
  "orders","topProducts"
];

const STORAGE = {
  name: "schulazon_tutorial_name",
  step: "schulazon_tutorial_step",
  unlocked: "schulazon_tutorial_unlocked"
};

const state = {
  name: localStorage.getItem(STORAGE.name) || "",
  idx: 0,
  unlocked: new Set(),     // always reset on open
  shopReady: false
};

// ---------- Messaging (robust) ----------
function postToShop(msg){
  const iframe = $("#shopFrame");
  if (!iframe || !iframe.contentWindow) return;
  try{
    iframe.contentWindow.postMessage({ __SCHULAZON__: true, ...msg }, "*");
  } catch(_) {}
}

function setLock(taskId, locked){
  postToShop({ type: "SET_LOCK", taskId, locked: !!locked });
}

function applyLocksFromState(){
  // lock all known tasks
  for (const t of SHOP_TASKS) setLock(t, true);
  // unlock whatever is in state.unlocked
  for (const t of state.unlocked) setLock(t, false);
}

function unlock(ids){
  const arr = Array.isArray(ids) ? ids : [ids];
  for (const id of arr) state.unlocked.add(id);
  applyLocksFromState();
}

function hardResetOnOpen(){
  // Always reset step+unlocks when opening
  localStorage.removeItem(STORAGE.step);
  localStorage.removeItem(STORAGE.unlocked);
  state.idx = 0;
  state.unlocked = new Set();
  // Immediately attempt to lock all in shop (even before ready)
  applyLocksFromState();
}

// ---------- Utils ----------
function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[c]));
}

function normalizeSql(s){
  return String(s || "")
    .replace(/--.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function hasAll(hay, needles){ return needles.every(n => hay.includes(n)); }

function progress(){
  const denom = (slides.length - 1) || 1;
  return Math.round((state.idx / denom) * 100);
}

function setHeader(){
  $("#namePill").textContent = `Name: ${state.name || "—"}`;
  $("#stepPill").textContent = `Schritt: ${state.idx + 1} / ${slides.length}`;
  $("#progressFill").style.width = `${progress()}%`;
  $("#progressPct").textContent = `${progress()}%`;
  $("#btnBack").disabled = state.idx === 0;
  $("#btnNext").disabled = (state.idx === slides.length - 1) || !slides[state.idx].canNext();
  $("#shopPill").textContent = state.shopReady ? "Shop: bereit" : "Shop: lädt…";
}

// ---------- UI helpers ----------
const schemaInline = `produkte(id, name, preis, kategorie_id, lagerbestand, liefertage)
kategorien(id, name)
bewertungen(id, produkt_id, sterne)
verkäufe(id, produkt_id, anzahl)
warenkorb(produkt_id, menge)`;

function blockTheory(title, html){
  return `
  <div class="block theory">
    <div class="blockTitle"><span class="dot"></span>${escapeHtml(title)}</div>
    ${html}
  </div>`;
}
function blockPractice(title, html){
  return `
  <div class="block practice">
    <div class="blockTitle"><span class="dot practiceDot"></span>${escapeHtml(title)}</div>
    ${html}
  </div>`;
}

// ---------- Slides ----------
const slides = [
  {
    id: "name",
    title: () => "Start",
    intro: () => "Wie soll ich dich nennen? Dann spreche ich dich im Tutorial direkt an.",
    canNext: () => (state.name || "").trim().length >= 2,
    render: () => `
      ${blockTheory("Ziel", `
        <p class="p">Du schaltest dir Schritt für Schritt Shop-Buttons frei, indem du kurze SQL-Aufgaben löst.</p>
        <div class="mini">Schema:<br><code>${escapeHtml(schemaInline)}</code></div>
      `)}
      ${blockPractice("Name eingeben", `
        <div class="row">
          <input class="input" id="nameInput" placeholder="Dein Name" maxlength="32" value="${escapeHtml(state.name)}" />
          <button class="primary" id="btnSaveName">Speichern</button>
        </div>
        <div class="feedback" id="fbName"></div>
      `)}
      <div class="panel">
        <div class="mini"><strong>Wichtig:</strong> Der Shop links ist am Anfang komplett gesperrt. Du schaltest ihn hier frei.</div>
      </div>
    `,
    bind: () => {
      const inp = $("#nameInput");
      const fb = $("#fbName");
      $("#btnSaveName").addEventListener("click", () => {
        const v = (inp.value || "").trim();
        if (v.length < 2){
          fb.className = "feedback bad";
          fb.textContent = "Bitte mindestens 2 Zeichen.";
          return;
        }
        state.name = v;
        localStorage.setItem(STORAGE.name, state.name);
        fb.className = "feedback ok";
        fb.textContent = `Alles klar, ${state.name}.`;
        setHeader();
      });
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") $("#btnSaveName").click(); });
      setHeader();
    }
  },

  {
    id: "blocks",
    title: () => `Bausteine einer SQL-Abfrage, ${state.name || ""}`.trim(),
    intro: () => "SELECT/FROM/WHERE/ORDER BY sind die Basics – damit steuerst du fast alles im Schulazon-Shop.",
    canNext: () => true,
    render: () => `
      ${blockTheory("Bausteine", `
        <table>
          <thead><tr><th>Baustein</th><th>Zweck (kurz)</th></tr></thead>
          <tbody>
            <tr><td><code>SELECT</code></td><td>Welche Spalten angezeigt werden</td></tr>
            <tr><td><code>FROM</code></td><td>Welche Tabellen die Daten liefern</td></tr>
            <tr><td><code>WHERE</code></td><td>Filter (welche Zeilen)</td></tr>
            <tr><td><code>ORDER BY</code></td><td>Sortierung</td></tr>
            <tr><td><code>GROUP BY / HAVING</code></td><td>Gruppen + Gruppenfilter</td></tr>
          </tbody>
        </table>
      `)}
      ${blockPractice("Quick Check → erste Shop-Funktion", `
        <p class="p">Welche Klausel filtert Zeilen?</p>
        <div class="row">
          <select id="q1">
            <option value="">Bitte wählen…</option>
            <option value="select">SELECT</option>
            <option value="from">FROM</option>
            <option value="where">WHERE</option>
            <option value="order">ORDER BY</option>
          </select>
          <button class="primary" id="btnCheck1">Check</button>
        </div>
        <div class="feedback" id="fb1"></div>
        <div class="mini">Unlock: <span class="unlockTag">Alle Produkte</span></div>
      `)}
    `,
    bind: () => {
      const fb = $("#fb1");
      $("#btnCheck1").addEventListener("click", () => {
        if ($("#q1").value === "where"){
          fb.className = "feedback ok";
          fb.textContent = "Korrekt: WHERE filtert Zeilen. Button „Alle“ ist frei.";
          unlock(["all"]);
        } else {
          fb.className = "feedback bad";
          fb.textContent = "Nicht ganz. Filter = WHERE.";
        }
      });
      setHeader();
    }
  },

  {
    id: "keys",
    title: () => `Schlüssel (PK/FK), ${state.name || ""}`.trim(),
    intro: () => "Damit verknüpfst du Tabellen – z. B. Produkte ↔ Kategorien.",
    canNext: () => true,
    render: () => `
      ${blockTheory("Schulazon-Bezug", `
        <p class="p">In <code>produkte</code> ist <code>id</code> der Primärschlüssel. <code>kategorie_id</code> ist ein Fremdschlüssel auf <code>kategorien.id</code>.</p>
        <pre>produkte(id, name, preis, kategorie_id, lagerbestand, liefertage)
kategorien(id, name)</pre>
      `)}
      ${blockPractice("Mini-Aufgabe → Kategorie-Buttons", `
        <p class="p">Welche Spalte ist der Fremdschlüssel?</p>
        <div class="row">
          <select id="fk">
            <option value="">Bitte wählen…</option>
            <option value="id">produkte.id</option>
            <option value="kategorie_id">produkte.kategorie_id</option>
            <option value="preis">produkte.preis</option>
          </select>
          <button class="primary" id="btnFk">Check</button>
        </div>
        <div class="feedback" id="fbFk"></div>
        <div class="mini">Unlock: <span class="unlockTag">Elektronik</span> <span class="unlockTag">Haushalt</span> <span class="unlockTag">Sport</span></div>
      `)}
    `,
    bind: () => {
      const fb = $("#fbFk");
      $("#btnFk").addEventListener("click", () => {
        if ($("#fk").value === "kategorie_id"){
          fb.className = "feedback ok";
          fb.textContent = "Yes. Kategorie-Filter sind frei.";
          unlock(["cat-electronics","cat-household","cat-sport"]);
        } else {
          fb.className = "feedback bad";
          fb.textContent = "Nope. Der Fremdschlüssel ist kategorie_id.";
        }
      });
      setHeader();
    }
  },

  {
    id: "selectfrom",
    title: () => `SELECT … FROM …, ${state.name || ""}`.trim(),
    intro: () => "Du holst gezielt Spalten aus Tabellen – Basis für Produktliste und Suche.",
    canNext: () => true,
    render: () => `
      ${blockTheory("Beispiele", `
        <pre>-- alle Produkte (alle Spalten)
SELECT * FROM produkte;

-- nur Name und Preis
SELECT name, preis FROM produkte;</pre>
      `)}
      ${blockPractice("Aufgabe → Suche", `
        <p class="p">Schreibe eine Abfrage, die <strong>Name und Preis</strong> aller Produkte ausgibt.</p>
        <div class="row">
          <input class="input" id="qSel" placeholder="SELECT name, preis FROM produkte;" />
          <button class="primary" id="btnSel">Check</button>
        </div>
        <div class="feedback" id="fbSel"></div>
        <div class="mini">Unlock: <span class="unlockTag">Suche</span></div>
      `)}
    `,
    bind: () => {
      const fb = $("#fbSel");
      $("#btnSel").addEventListener("click", () => {
        const v = normalizeSql($("#qSel").value);
        const ok = hasAll(v, ["select", "from produkte"]) && v.includes("name") && v.includes("preis") && !v.includes(" join ");
        if (ok){
          fb.className = "feedback ok";
          fb.textContent = "Passt. Suche ist frei.";
          unlock(["search"]);
        } else {
          fb.className = "feedback bad";
          fb.textContent = "Tipp: SELECT name, preis FROM produkte; (kein JOIN)";
        }
      });
      setHeader();
    }
  },

  {
    id: "where_unlock",
    title: () => `WHERE – Filter freischalten, ${state.name || ""}`.trim(),
    intro: () => "Mit WHERE baust du echte Shop-Filter.",
    canNext: () => true,
    render: () => `
      ${blockTheory("Merksatz", `
        <p class="p"><strong>WHERE filtert Zeilen.</strong> Expresslieferung = Produkte mit <code>liefertage = 1</code>.</p>
        <pre>SELECT * FROM produkte
WHERE liefertage = 1;</pre>
      `)}
      ${blockPractice("Übung 1 → Expresslieferung", `
        <p class="p">Schreibe die Express-Abfrage.</p>
        <div class="row">
          <input class="input" id="qExpress" placeholder="SELECT * FROM produkte WHERE liefertage = 1;" />
          <button class="primary" id="btnExpress">Check</button>
        </div>
        <div class="feedback" id="fbExpress"></div>
        <div class="mini">Unlock: <span class="unlockTag">Expresslieferung</span></div>
      `)}
      ${blockPractice("Übung 2 → Preis unter 25 €", `
        <p class="p">Schreibe eine Abfrage für <code>preis &lt; 25</code>.</p>
        <div class="row">
          <input class="input" id="qP25" placeholder="SELECT * FROM produkte WHERE preis < 25;" />
          <button class="primary" id="btnP25">Check</button>
        </div>
        <div class="feedback" id="fbP25"></div>
        <div class="mini">Unlock: <span class="unlockTag">Unter 25 €</span></div>
      `)}
    `,
    bind: () => {
      $("#btnExpress").addEventListener("click", () => {
        const fb = $("#fbExpress");
        const v = normalizeSql($("#qExpress").value);
        const ok = hasAll(v, ["select", "from produkte", "where"]) && (v.includes("liefertage = 1") || v.includes("liefertage=1")) && !v.includes(" join ");
        fb.className = ok ? "feedback ok" : "feedback bad";
        fb.textContent = ok ? "Korrekt. Express ist frei." : "Tipp: SELECT * FROM produkte WHERE liefertage = 1; (kein JOIN)";
        if (ok) unlock(["express"]);
      });

      $("#btnP25").addEventListener("click", () => {
        const fb = $("#fbP25");
        const v = normalizeSql($("#qP25").value);
        const ok = hasAll(v, ["select", "from produkte", "where"]) && (v.includes("preis < 25") || v.includes("preis<25")) && !v.includes(" join ");
        fb.className = ok ? "feedback ok" : "feedback bad";
        fb.textContent = ok ? "Sauber. Unter 25 € ist frei." : "Tipp: SELECT * FROM produkte WHERE preis < 25; (kein JOIN)";
        if (ok) unlock(["price-25"]);
      });

      setHeader();
    }
  },

  {
    id: "orderby_unlock",
    title: () => `ORDER BY – Sortierung freischalten, ${state.name || ""}`.trim(),
    intro: () => "ORDER BY bestimmt die Reihenfolge – das ist die Sortierfunktion im Shop.",
    canNext: () => true,
    render: () => `
      ${blockTheory("Merksatz", `
        <p class="p"><strong>ORDER BY</strong> sortiert. <code>ASC</code> = aufsteigend, <code>DESC</code> = absteigend.</p>
      `)}
      ${blockPractice("Übung 1 → Preis ↑", `
        <p class="p">Abfrage nach Preis aufsteigend sortieren.</p>
        <div class="row">
          <input class="input" id="qAsc" placeholder="SELECT name, preis FROM produkte ORDER BY preis ASC;" />
          <button class="primary" id="btnAsc">Check</button>
        </div>
        <div class="feedback" id="fbAsc"></div>
        <div class="mini">Unlock: <span class="unlockTag">Preis ↑</span></div>
      `)}
      ${blockPractice("Übung 2 → Preis ↓", `
        <p class="p">Abfrage nach Preis absteigend sortieren.</p>
        <div class="row">
          <input class="input" id="qDesc" placeholder="SELECT name, preis FROM produkte ORDER BY preis DESC;" />
          <button class="primary" id="btnDesc">Check</button>
        </div>
        <div class="feedback" id="fbDesc"></div>
        <div class="mini">Unlock: <span class="unlockTag">Preis ↓</span></div>
      `)}
    `,
    bind: () => {
      $("#btnAsc").addEventListener("click", () => {
        const fb = $("#fbAsc");
        const v = normalizeSql($("#qAsc").value);
        const ok = hasAll(v, ["select", "from produkte", "order by"]) && v.includes("preis") && (v.includes(" asc") || v.endsWith("asc") ) && !v.includes(" join ");
        fb.className = ok ? "feedback ok" : "feedback bad";
        fb.textContent = ok ? "Top. Preis ↑ ist frei." : "Tipp: SELECT name, preis FROM produkte ORDER BY preis ASC; (kein JOIN)";
        if (ok) unlock(["priceAsc"]);
      });

      $("#btnDesc").addEventListener("click", () => {
        const fb = $("#fbDesc");
        const v = normalizeSql($("#qDesc").value);
        const ok = hasAll(v, ["select", "from produkte", "order by"]) && v.includes("preis") && v.includes("desc") && !v.includes(" join ");
        fb.className = ok ? "feedback ok" : "feedback bad";
        fb.textContent = ok ? "Stark. Preis ↓ ist frei." : "Tipp: SELECT name, preis FROM produkte ORDER BY preis DESC; (kein JOIN)";
        if (ok) unlock(["priceDesc"]);
      });

      setHeader();
    }
  },

  {
    id: "end",
    title: () => `Ende, ${state.name || ""}`.trim(),
    intro: () => "Du bist ready. Klick links die freigeschalteten Buttons und geh dann ins SQL-Lab.",
    canNext: () => false,
    render: () => `
      ${blockTheory("Zusammenfassung", `
        <p class="p">Du kannst jetzt: SELECT/FROM, WHERE, ORDER BY. Das reicht, um viele Shop-Features zu steuern.</p>
      `)}
      ${blockPractice("Test", `
        <p class="p">Wenn Express/Unter-25/Preis↑/Preis↓ frei sind, funktioniert dein Unlock-Flow.</p>
      `)}
    `,
    bind: () => setHeader()
  }
];

// ---------- Render engine ----------
let current = null;

function render(direction = "forward"){
  const stage = $("#stage");
  const s = slides[state.idx];

  const el = document.createElement("section");
  el.className = "slide";
  el.innerHTML = `
    <div class="card">
      <div class="cardHead">
        <h2>${escapeHtml(s.title())}</h2>
        <div class="step">${state.idx + 1}/${slides.length}</div>
      </div>
      <div class="cardBody">
        <p class="p" style="color: rgba(15,23,42,.82)">${escapeHtml(s.intro())}</p>
        ${s.render()}
        <div class="mini">Schema: <code>${escapeHtml(schemaInline)}</code></div>
      </div>
    </div>
  `;

  stage.appendChild(el);
  requestAnimationFrame(() => el.classList.add("active"));

  if (current){
    current.classList.add(direction === "back" ? "exitRight" : "exitLeft");
    const old = current;
    setTimeout(() => { if (old && old.parentNode) old.parentNode.removeChild(old); }, 220);
  }
  current = el;

  setTimeout(() => {
    try { s.bind(); } catch(_) {}
    setHeader();
  }, 0);
}

function next(){
  if (state.idx >= slides.length - 1) return;
  if (!slides[state.idx].canNext()) return;
  state.idx++;
  render("forward");
}
function back(){
  if (state.idx <= 0) return;
  state.idx--;
  render("back");
}
function reset(){
  hardResetOnOpen();
  render("back");
}

// ---------- Event wiring ----------
window.addEventListener("message", (e) => {
  // accept same-origin OR null-origin (file://)
  const same = (e.origin === window.location.origin) || (e.origin === "null" && window.location.origin === "null");
  if (!same) return;

  const msg = e.data;
  if (!msg || msg.__SCHULAZON__ !== true) return;

  if (msg.type === "SHOP_READY"){
    state.shopReady = true;
    applyLocksFromState();
    setHeader();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  $("#btnNext").addEventListener("click", next);
  $("#btnBack").addEventListener("click", back);
  $("#btnReset").addEventListener("click", reset);

  hardResetOnOpen();     // <- required by user
  render("forward");

  // Resend lock-state for ~10s to defeat listener order races
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    applyLocksFromState();
    if (state.shopReady){
      clearInterval(timer);
      return;
    }
    if (tries >= 50) clearInterval(timer);
  }, 200);
});
