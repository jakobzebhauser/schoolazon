function renderFree(root){
  root.innerHTML = `
    <h2>Freier Modus</h2>
    <p>Platzhalter – hier kommt dein freies Üben rein.</p>
  `;
}

function renderGuided(root){
  root.innerHTML = `
    <h2>Angeleiteter Modus</h2>
    <p>Platzhalter – hier kommt die Anleitung rein.</p>
  `;
}

function renderTest(root){
  root.innerHTML = `
    <h2>Test-Modus</h2>
    <p>Platzhalter – hier kommt dein Test rein.</p>
  `;
}

window.addEventListener("DOMContentLoaded", () => {
  const mode = document.body.dataset.mode;   // free | guided | test
  const root = document.getElementById("modeRoot");
  if(!root) return;

  if(mode === "free") return renderFree(root);
  if(mode === "guided") return renderGuided(root);
  if(mode === "test") return renderTest(root);

  root.innerHTML = `<p>Unbekannter Modus: ${mode}</p>`;
});
