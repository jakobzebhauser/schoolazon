const STORAGE_KEY = "sql_tutor_onboarding_v1";

const $ = (s, r=document) => r.querySelector(s);
const escapeHtml = (s) => String(s)
  .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
  .replaceAll('"',"&quot;").replaceAll("'","&#039;");

const miniDB = {
  schueler: [
    { schueler_id:101, name:"Mia",  klasse:"10A", klasse_id:1, schnitt:2.1 },
    { schueler_id:102, name:"Noah", klasse:"10A", klasse_id:1, schnitt:1.7 },
    { schueler_id:103, name:"Lea",  klasse:"10B", klasse_id:2, schnitt:2.9 },
    { schueler_id:104, name:"Emil", klasse:"11A", klasse_id:3, schnitt:1.9 },
    { schueler_id:105, name:"Ida",  klasse:"10B", klasse_id:2, schnitt:2.0 }
  ]
};

const state = loadState();

const steps = [
  {
    id:"blocks",
    hint:"Ziel: SELECT/FROM/WHERE auseinanderhalten.",
    example:`SELECT name, schnitt
FROM schueler
WHERE klasse = '10A';`,
    tutorLines: [
      "Wir starten mit dem Grundgerüst. Eine SQL-Abfrage besteht aus festen Bausteinen.",
      "Du musst nur drei sauber trennen: <strong>SELECT</strong> (Spalten), <strong>FROM</strong> (Tabelle), <strong>WHERE</strong> (Bedingung).",
      "Ordne sie kurz zu, dann gehen wir weiter."
    ],
    renderTask: renderBlocksTask,
    unlocks:["SELECT","FROM","WHERE"]
  },
  {
    id:"keys",
    hint:"Ziel: PK eindeutig, FK verweist.",
    example:`klasse(klasse_id PK, name)
schueler(schueler_id PK, klasse_id FK → klasse.klasse_id)`,
    tutorLines: [
      "Jetzt Schlüssel. Ein <strong>Primärschlüssel</strong> identifiziert Datensätze eindeutig.",
      "Ein <strong>Fremdschlüssel</strong> verweist auf den Primärschlüssel einer anderen Tabelle – damit verknüpfst du Tabellen.",
      "Klicke „verstanden“, wenn das sitzt."
    ],
    renderTask: renderKeysTask,
    unlocks:["PK/FK verstanden"]
  },
  {
    id:"distinct",
    hint:"Ziel: DISTINCT entfernt Duplikate in der Ergebnisspalte.",
    example:`SELECT DISTINCT klasse_id
FROM schueler;`,
    tutorLines: [
      "SELECT kann Duplikate liefern, wenn in vielen Zeilen der gleiche Wert steht.",
      "<strong>DISTINCT</strong> sagt: gib jeden Wert nur einmal zurück.",
      "Schalte zwischen „ohne“ und „mit DISTINCT“ um."
    ],
    renderTask: renderDistinctTask,
    unlocks:["DISTINCT"]
  },
  {
    id:"allbuttons",
    hint:"Ziel: richtige Reihenfolge automatisieren.",
    example:`SELECT ...
FROM ...
WHERE ...
GROUP BY ...
HAVING ...
ORDER BY ...;`,
    tutorLines: [
      "Sehr wichtig: die <strong>Reihenfolge</strong> der Bausteine ist nicht beliebig.",
      "Wir üben das einmal als Muskelgedächtnis: klicke die Chips in der richtigen Reihenfolge.",
      "Wenn du einmal durch bist, ist das Thema praktisch erledigt."
    ],
    renderTask: renderAllButtonsTask,
    unlocks:["ORDER BY","GROUP BY","HAVING","AS","AGGREGATE"]
  },
  {
    id:"where",
    hint:"Ziel: AND ohne NOT → Treffer: nur Noah.",
    example:`WHERE klasse = '10A' AND schnitt <= 2.0`,
    tutorLines: [
      "WHERE filtert Zeilen. Bei mehreren Bedingungen ist <strong>AND</strong> meist die Default-Wahl.",
      "<strong>OR</strong> ist großzügiger, <strong>NOT</strong> kehrt um.",
      "Stell es so ein, dass nur 10A mit schnitt <= 2.0 übrig bleibt."
    ],
    renderTask: renderWhereTask,
    unlocks:["AND","OR","NOT"]
  },
  {
    id:"orderby",
    hint:"Ziel: schnitt ASC → beste Note oben.",
    example:`ORDER BY schnitt ASC`,
    tutorLines: [
      "Sortieren: <strong>ORDER BY</strong>.",
      "ASC = aufsteigend, DESC = absteigend.",
      "Für Noten ist „beste oben“ meistens <strong>ASC</strong> (kleiner ist besser)."
    ],
    renderTask: renderOrderByTask,
    unlocks:["ASC","DESC"]
  },
  {
    id:"privacy",
    hint:"Ziel: verstanden bestätigen.",
    example:`Name + Klasse + Note sind i. d. R. personenbezogen.`,
    tutorLines: [
      "Kurz Datenschutz: Personenbezogene Daten machen eine Person direkt oder indirekt identifizierbar.",
      "In Schulkontexten ist das praktisch immer relevant.",
      "Bitte bestätigen – dann bist du durch."
    ],
    renderTask: renderPrivacyTask,
    unlocks:["PRIVACY ✔"]
  }
];

const allUnlocks = [
  "SELECT","FROM","WHERE","DISTINCT","ORDER BY","GROUP BY","HAVING","AS","AGGREGATE",
  "AND","OR","NOT","ASC","DESC","PK/FK verstanden","PRIVACY ✔"
];

// ---------- Boot ----------
$("#btnReset").addEventListener("click", resetAll);
$("#btnBack").addEventListener("click", () => go(-1));
$("#btnNext").addEventListener("click", () => go(+1));

renderStep();

// ---------- Step orchestration ----------
function renderStep(){
  const step = steps[state.i];

  $("#stepHint").textContent = step.hint;
  $("#example").textContent = step.example || "";
  $("#exampleBox").open = false;

  setFeedback("");

  const chat = $("#chat");
  chat.innerHTML = "";

  // Tutor "typing" then message
  showTyping(chat);
  setTimeout(() => {
    removeTyping(chat);
    step.tutorLines.forEach(line => addTutor(chat, line));
    // Task container after tutor explanation (same screen)
    const taskWrap = document.createElement("div");
    taskWrap.className = "bubble studentB";
    taskWrap.innerHTML = `
      <strong>Deine Mini-Aufgabe</strong>
      <div class="mini">Kurz einstellen/auswählen und „Prüfen“ drücken.</div>
      <div id="taskUI"></div>
    `;
    chat.appendChild(taskWrap);

    const uiRoot = $("#taskUI", taskWrap);
    step.renderTask(uiRoot, step);

    renderUnlockChips();
    updateHeader();
    saveState();
    chat.scrollTo?.(0, chat.scrollHeight);
  }, 350);
}

// ---------- Chat helpers ----------
function addTutor(chat, html){
  const b = document.createElement("div");
  b.className = "bubble tutorB";
  b.innerHTML = html;
  chat.appendChild(b);
}

function addStudent(chat, text){
  const b = document.createElement("div");
  b.className = "bubble studentB";
  b.textContent = text;
  chat.appendChild(b);
}

function showTyping(chat){
  const t = document.createElement("div");
  t.className = "typing";
  t.id = "typing";
  t.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  chat.appendChild(t);
}

function removeTyping(chat){
  $("#typing", chat)?.remove();
}

// ---------- Tasks ----------
function renderBlocksTask(root, step){
  const options = [
    "Welche Spalten sollen angezeigt werden",
    "Aus welcher(n) Tabelle(n) kommen die Daten",
    "Welche Zeilen sollen ausgewählt werden (Bedingungen)"
  ];

  root.innerHTML = `
    <div class="row">
      <label class="pill" style="width:100%; justify-content:space-between">
        <span style="font-family:var(--mono)">SELECT</span>
        <select id="bSelect">
          <option value="">– wählen –</option>
          ${options.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
        </select>
      </label>

      <label class="pill" style="width:100%; justify-content:space-between">
        <span style="font-family:var(--mono)">FROM</span>
        <select id="bFrom">
          <option value="">– wählen –</option>
          ${options.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
        </select>
      </label>

      <label class="pill" style="width:100%; justify-content:space-between">
        <span style="font-family:var(--mono)">WHERE</span>
        <select id="bWhere">
          <option value="">– wählen –</option>
          ${options.map(o=>`<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join("")}
        </select>
      </label>
    </div>

    <div class="row">
      <button class="btn primary" id="bCheck">Prüfen</button>
      <button class="btn" id="bAuto">Auto-Fill</button>
      <button class="btn" id="bExplain">Erklär’s nochmal</button>
    </div>
  `;

  $("#bAuto").addEventListener("click", () => {
    $("#bSelect").value = options[0];
    $("#bFrom").value = options[1];
    $("#bWhere").value = options[2];
  });

  $("#bExplain").addEventListener("click", () => {
    addStudent($("#chat"), "Kannst du SELECT/FROM/WHERE nochmal kurz erklären?");
    showTyping($("#chat"));
    setTimeout(() => {
      removeTyping($("#chat"));
      addTutor($("#chat"), "<strong>SELECT</strong> = welche Spalten. <strong>FROM</strong> = aus welcher Tabelle. <strong>WHERE</strong> = welche Zeilen (Bedingung).");
    }, 350);
  });

  $("#bCheck").addEventListener("click", () => {
    const ok =
      $("#bSelect").value === options[0] &&
      $("#bFrom").value === options[1] &&
      $("#bWhere").value === options[2];

    if (!ok){
      setFeedback("Noch nicht. SELECT=Spalten, FROM=Tabelle, WHERE=Bedingung.", "bad");
      return;
    }
    complete(step.id);
    unlock(step.unlocks);
    setFeedback("Korrekt. Freigeschaltet: SELECT/FROM/WHERE.", "ok");
  });
}

function renderKeysTask(root, step){
  root.innerHTML = `
    <div class="mono">
      klasse(klasse_id, name)<br/>
      schueler(schueler_id, name, klasse_id)
    </div>
    <div class="row">
      <button class="btn primary" id="kOk">Verstanden</button>
      <button class="btn" id="kAsk">Kurze Nachfrage</button>
    </div>
  `;

  $("#kAsk").addEventListener("click", () => {
    addStudent($("#chat"), "Wo liegt der Fremdschlüssel genau und warum?");
    showTyping($("#chat"));
    setTimeout(() => {
      removeTyping($("#chat"));
      addTutor($("#chat"), "Der FK liegt auf der „n-Seite“ (schueler.klasse_id), weil viele Schüler:innen zu genau einer Klasse gehören. Damit verweist jede Schüler-Zeile auf eine Klassen-Zeile.");
    }, 350);
  });

  $("#kOk").addEventListener("click", () => {
    complete(step.id);
    unlock(step.unlocks);
    setFeedback("OK. PK/FK verstanden.", "ok");
  });
}

function renderDistinctTask(root, step){
  const vals = miniDB.schueler.map(r => r.klasse_id);
  root.innerHTML = `
    <div class="row">
      <button class="btn" id="dNo">Ohne DISTINCT</button>
      <button class="btn primary" id="dYes">Mit DISTINCT</button>
    </div>
    <div class="mono" id="dOut" style="min-height:92px"></div>
    <div class="row">
      <button class="btn primary" id="dDone">Gesehen</button>
    </div>
  `;

  const out = $("#dOut");
  $("#dNo").addEventListener("click", () => out.textContent = vals.join("\n"));

  $("#dYes").addEventListener("click", () => {
    const seen = new Set();
    const lines = vals.map(v => {
      const dup = seen.has(v);
      seen.add(v);
      return dup ? `<span style="color:#dc2626;text-decoration:line-through;opacity:.75">${v}</span>` : `${v}`;
    });
    out.innerHTML = lines.join("<br/>");
  });

  $("#dDone").addEventListener("click", () => {
    complete(step.id);
    unlock(step.unlocks);
    setFeedback("OK. DISTINCT verstanden.", "ok");
  });
}

function renderAllButtonsTask(root, step){
  const order = ["SELECT","FROM","WHERE","GROUP BY","HAVING","ORDER BY"];
  let idx = 0;

  root.innerHTML = `
    <div class="row" id="abRow"></div>
    <div class="mono" id="abPreview" style="min-height:92px"></div>
    <div class="row">
      <button class="btn" id="abReset">Neu</button>
    </div>
  `;

  const row = $("#abRow");
  const preview = $("#abPreview");

  function render(){
    row.innerHTML = order.map(k => `<button class="btn ${k===order[idx] ? "primary" : ""}" data-k="${k}">${k}</button>`).join("");
    preview.textContent = idx === 0 ? "Klicke den nächsten Baustein." : `${order.slice(0, idx).map(x=>x+" ...").join("\n")}\n;`;

    row.querySelectorAll("button[data-k]").forEach(b => {
      b.addEventListener("click", () => {
        const k = b.dataset.k;
        if (k !== order[idx]){
          setFeedback(`Falsch. Als nächstes: ${order[idx]}`, "bad");
          return;
        }
        idx++;
        setFeedback(`Richtig: ${k}`, "ok");
        if (idx === order.length){
          complete(step.id);
          unlock(step.unlocks);
          preview.textContent = `${order.map(x=>x+" ...").join("\n")}\n;`;
          setFeedback("Perfekt. Gerüst sitzt. Mehrere Bausteine freigeschaltet.", "ok");
          return;
        }
        render();
      });
    });
  }

  $("#abReset").addEventListener("click", () => { idx = 0; setFeedback(""); render(); });
  render();
}

function renderWhereTask(root, step){
  root.innerHTML = `
    <div class="row">
      <select id="wLogic">
        <option value="AND">AND</option>
        <option value="OR">OR</option>
      </select>
      <label class="pill" style="cursor:pointer">
        <input type="checkbox" id="wNot" style="margin-right:8px" /> NOT
      </label>
      <button class="btn primary" id="wCheck">Prüfen</button>
    </div>
    <div class="mono" id="wQuery"></div>
    <div class="mono" id="wHits" style="min-height:92px"></div>
  `;

  const logic = $("#wLogic");
  const not = $("#wNot");
  const q = $("#wQuery");
  const hits = $("#wHits");

  function evalNow(){
    q.textContent =
`SELECT * FROM schueler
WHERE ${not.checked ? "NOT (" : ""}klasse = '10A' ${logic.value} schnitt <= 2.0${not.checked ? ")" : ""};`;

    const predAND = (r) => r.klasse === "10A" && r.schnitt <= 2.0;
    const predOR  = (r) => r.klasse === "10A" || r.schnitt <= 2.0;

    const base = logic.value === "AND" ? predAND : predOR;
    const final = not.checked ? (r) => !base(r) : base;

    const res = miniDB.schueler.filter(final);
    hits.textContent = res.length ? res.map(r => `${r.name} (${r.klasse}, schnitt=${r.schnitt})`).join("\n") : "– keine Treffer –";
    return res;
  }

  logic.addEventListener("change", () => { setFeedback(""); evalNow(); });
  not.addEventListener("change", () => { setFeedback(""); evalNow(); });
  evalNow();

  $("#wCheck").addEventListener("click", () => {
    const res = evalNow();
    const ok = (logic.value === "AND" && !not.checked && res.length === 1 && res[0].name === "Noah");
    if (!ok){
      setFeedback("Ziel verfehlt. Erwartet: AND, kein NOT, Treffer: nur Noah.", "bad");
      return;
    }
    complete(step.id);
    unlock(step.unlocks);
    setFeedback("Korrekt. AND/OR/NOT freigeschaltet.", "ok");
  });
}

function renderOrderByTask(root, step){
  root.innerHTML = `
    <div class="row">
      <select id="oDir">
        <option value="ASC">ASC</option>
        <option value="DESC">DESC</option>
      </select>
      <button class="btn primary" id="oRun">Sortieren</button>
    </div>
    <div class="mono" id="oQuery"></div>
    <div class="mono" id="oRes" style="min-height:92px"></div>
  `;

  const dir = $("#oDir");
  const q = $("#oQuery");
  const out = $("#oRes");

  function run(){
    const rows = [...miniDB.schueler].sort((a,b) => dir.value === "ASC" ? a.schnitt - b.schnitt : b.schnitt - a.schnitt);
    q.textContent = `SELECT * FROM schueler\nORDER BY schnitt ${dir.value};`;
    out.textContent = rows.slice(0,4).map(r => `${r.name} | schnitt=${r.schnitt}`).join("\n");

    const ok = dir.value === "ASC" && rows[0].name === "Noah";
    if (ok){
      complete(step.id);
      unlock(step.unlocks);
      setFeedback("Korrekt. ASC/DESC freigeschaltet.", "ok");
    } else {
      setFeedback("Fast. Ziel: beste Note oben ⇒ schnitt ASC.", "warn");
    }
  }

  $("#oRun").addEventListener("click", run);
  run();
}

function renderPrivacyTask(root, step){
  root.innerHTML = `
    <div class="row">
      <button class="btn primary" id="pOk">Verstanden</button>
      <button class="btn" id="pAsk">Beispiel?</button>
    </div>
  `;

  $("#pAsk").addEventListener("click", () => {
    addStudent($("#chat"), "Was ist hier konkret personenbezogen?");
    showTyping($("#chat"));
    setTimeout(() => {
      removeTyping($("#chat"));
      addTutor($("#chat"), "Name ist direkt personenbezogen. In Kombination sind auch Klasse/Noten typischerweise personenbezogen, weil du Personen in einer Klasse identifizierbar machen kannst.");
    }, 350);
  });

  $("#pOk").addEventListener("click", () => {
    complete(step.id);
    unlock(step.unlocks);
    setFeedback("Bestätigt. Onboarding abgeschlossen.", "ok");
  });
}

// ---------- Header / Progress ----------
function updateHeader(){
  const doneCount = steps.filter(s => state.done[s.id]).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  $("#hdrSub").textContent = `Schritt ${state.i+1}/${steps.length} · 1:1-Modus`;
  $("#hdrPill").textContent = `Fortschritt: ${pct}%`;
  $("#progressBar").style.width = `${pct}%`;

  $("#btnBack").disabled = (state.i === 0);
  $("#btnNext").disabled = (state.i === steps.length - 1);
}

function setFeedback(text, kind=""){
  const fb = $("#feedback");
  fb.className = "feedback" + (kind ? " " + kind : "");
  fb.textContent = text || "";
}

// ---------- Unlock chips (dezent) ----------
function renderUnlockChips(){
  const chips = $("#unlockChips");
  const unlocked = new Set(state.unlocks);
  const show = allUnlocks.filter(u => unlocked.has(u)).slice(0, 14);

  chips.innerHTML = show.length
    ? show.map(u => `<span class="chip on">${escapeHtml(u)}</span>`).join("")
    : `<span class="chip">noch keine Unlocks</span>`;
}

// ---------- Navigation ----------
function go(delta){
  state.i = Math.max(0, Math.min(steps.length - 1, state.i + delta));
  renderStep();
}

function complete(stepId){
  state.done[stepId] = true;
  saveState();
  updateHeader();
}

function unlock(items){
  const set = new Set(state.unlocks);
  items.forEach(x => set.add(x));
  state.unlocks = [...set];
  saveState();
  renderUnlockChips();
}

// ---------- Persistence ----------
function loadState(){
  const base = { i:0, done:{}, unlocks:[] };
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const s = JSON.parse(raw);
    return {
      i: Number.isFinite(s.i) ? s.i : 0,
      done: s.done && typeof s.done === "object" ? s.done : {},
      unlocks: Array.isArray(s.unlocks) ? s.unlocks : []
    };
  } catch { return base; }
}

function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function resetAll(){
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}
