/* =========================
   Amber Character Builder — single-file script.js (repaired)
   ========================= */

/* -------------------------
   Config / Storage Keys
   ------------------------- */
const STORAGE_CHARACTERS = "amber:characters:v1";   // map: { [name]: character }
const STORAGE_CURRENT    = "amber:currentName:v1";  // string: current character name

/* -------------------------
   State
   ------------------------- */
let currentCharacter = null;  // the live/edited character object
let currentName = null;       // string name key
let els = {};                 // cache for DOM els

/* -------------------------
   Utilities
   ------------------------- */
function isObject(v){ return v && typeof v === "object" && !Array.isArray(v); }
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function cryptoRandomId() {
  try {
    return [...crypto.getRandomValues(new Uint8Array(8))]
      .map(b => b.toString(16).padStart(2,"0")).join("");
  } catch {
    return "id_" + Math.random().toString(36).slice(2,10);
  }
}

/* Deep merge that preserves arrays of items by stable id when present */
function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    const byKey = new Map();
    const keyOf = (it) => (it && (it.id ?? it.name)) || null;

    target.forEach(it => {
      const k = keyOf(it);
      byKey.set(k || cryptoRandomId(), it);
    });
    source.forEach(it => {
      const k = keyOf(it);
      if (k && byKey.has(k)) {
        byKey.set(k, deepMerge(byKey.get(k), it));
      } else {
        byKey.set(k || cryptoRandomId(), it);
      }
    });
    return Array.from(byKey.values());
  } else if (isObject(target) && isObject(source)) {
    const out = { ...target };
    Object.keys(source).forEach(k => {
      out[k] = k in target ? deepMerge(target[k], source[k]) : source[k];
    });
    return out;
  }
  return source ?? target;
}

/* -------------------------
   Default Character Template
   ------------------------- */
function defaultCharacter(name = "Untitled") {
  return {
    name,
    totalPoints: 100,        // adjust as needed
    heritage: null,          // "Amber" | "Chaos" | ...
    skills: [],              // [{id,name,rating,costOverride}]
    powers: [],              // [{id,name,baseCost,advanced,advancedCost,includesCredit,discounts}]
    extras: [],              // [{id,type,cost,data:{...}}]
    notes: "",
  };
}

/* -------------------------
   Storage Helpers
   ------------------------- */
function loadAllCharacters() {
  try {
    const raw = localStorage.getItem(STORAGE_CHARACTERS);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function saveAllCharacters(map) {
  try { localStorage.setItem(STORAGE_CHARACTERS, JSON.stringify(map)); } catch {}
}
function getCurrentName() {
  try { return localStorage.getItem(STORAGE_CURRENT); } catch { return null; }
}
function setCurrentName(name) {
  currentName = name;
  try { localStorage.setItem(STORAGE_CURRENT, name); } catch {}
}

/* Debounced save of only the current character back into the characters map */
let saveTimer = null;
function saveCurrentDebounced(delay=400) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentNow, delay);
}
function saveCurrentNow() {
  if (!currentName || !currentCharacter) return;
  const map = loadAllCharacters();
  map[currentName] = currentCharacter;
  saveAllCharacters(map);
}

/* -------------------------
   Point Math — single source of truth
   ------------------------- */
function computePointSummary(char) {
  const total = Number(char.totalPoints ?? 0);
  const skillsCost  = calcSkillsCost(char);
  const powersCost  = calcPowersCost(char);
  const extrasCost  = calcExtrasCost(char);
  const heritageAdj = calcHeritageAdjustments(char);

  const netSpent = skillsCost + powersCost + extrasCost + heritageAdj;
  const remaining = total - netSpent;
  const goodStuff = Math.max(0, remaining);
  const badStuff  = Math.max(0, -remaining);

  return { total, skillsCost, powersCost, extrasCost, heritageAdj, netSpent, remaining, goodStuff, badStuff };
}

function calcSkillsCost(char) {
  return (char.skills || []).reduce((sum, s) => {
    const c = Number(s.costOverride ?? s.rating ?? 0);
    return sum + (Number.isFinite(c) ? c : 0);
  }, 0);
}
function calcPowersCost(char) {
  return (char.powers || []).reduce((sum, p) => {
    const base = Number(p.baseCost ?? 0);
    const adv  = p.advanced ? Number(p.advancedCost ?? 0) : 0;
    const includes = Number(p.includesCredit ?? 0);
    const discounts = Number(p.discounts ?? 0);
    const subtotal = base + adv - includes - discounts;
    return sum + Math.max(0, subtotal);
  }, 0);
}
function calcExtrasCost(char) {
  return (char.extras || []).reduce((sum, e) => {
    const c = Number(e.cost ?? 0);
    return sum + (Number.isFinite(c) ? c : 0);
  }, 0);
}
function calcHeritageAdjustments(char) {
  // Example credits (negative = credit). Adjust to match your rules.
  const h = (char.heritage || "").toLowerCase();
  let adj = 0;
  if (h === "amber") {
    const hasPattern = (char.powers || []).some(p => /pattern/i.test(p.name || ""));
    if (hasPattern) adj -= 50; // example
  }
  if (h === "chaos") {
    const hasLogrus = (char.powers || []).some(p => /logrus/i.test(p.name || ""));
    if (hasLogrus) adj -= 25; // example
  }
  return adj;
}

/* -------------------------
   Rendering — Overlay / Footer / Extras
   ------------------------- */
function cacheEls() {
  els.overlay = document.getElementById("overlay-summary");
  els.footer  = document.getElementById("footer-summary");
  els.extras  = document.getElementById("extras-container");

  // Manage Characters section
  els.manageList   = document.getElementById("manage-list");
  els.btnNew       = document.getElementById("btn-new-character");
  els.btnSave      = document.getElementById("btn-save-character");
  els.btnDelete    = document.getElementById("btn-delete-character");

  // Optional: import
  els.importInput  = document.getElementById("import-json");
}

function renderOverlay(char) {
  if (!els.overlay) return;
  const s = computePointSummary(char);
  els.overlay.innerHTML = `
    <div class="points">
      <div><strong>Total:</strong> ${s.total}</div>
      <div><strong>Spent:</strong> ${s.netSpent}</div>
      <div><strong>Good Stuff:</strong> ${s.goodStuff}</div>
      ${s.badStuff ? `<div><strong>Bad Stuff:</strong> ${s.badStuff}</div>` : ""}
    </div>
  `;
}

function renderFooter(char) {
  if (!els.footer) return;
  const s = computePointSummary(char);
  els.footer.innerHTML = `
    <div class="summary">
      <span>Total ${s.total}</span>
      <span>Spent ${s.netSpent}</span>
      <span>Good Stuff ${s.goodStuff}</span>
      ${s.badStuff ? `<span>Bad Stuff ${s.badStuff}</span>` : ""}
    </div>
  `;
}

function renderExtras(char) {
  if (!els.extras) return;
  const extras = char.extras || [];
  els.extras.innerHTML = extras.map(ex => {
    const id = ex.id || cryptoRandomId();
    ex.id = id;
    const cost = Number(ex.cost ?? 0);
    const type = ex.type || "custom";
    const details = ex.data?.details || "";
    return `
      <div class="extra" data-id="${id}">
        <div class="row">
          <label>Type</label>
          <input class="ex-type" value="${escapeHtml(type)}" />
          <label>Cost</label>
          <input class="ex-cost" type="number" step="1" value="${cost}" />
        </div>
        <div class="row">
          <label>Details</label>
          <textarea class="ex-details" rows="2">${escapeHtml(details)}</textarea>
        </div>
      </div>
    `;
  }).join("");

  // Wire inputs (debounced save; do not re-render per keystroke)
  els.extras.querySelectorAll(".extra").forEach(node => {
    const id = node.getAttribute("data-id");
    const ex = extras.find(e => e.id === id);
    const typeEl = node.querySelector(".ex-type");
    const costEl = node.querySelector(".ex-cost");
    const detEl  = node.querySelector(".ex-details");

    typeEl.addEventListener("input", () => {
      ex.type = typeEl.value;
      saveCurrentDebounced();
    });
    costEl.addEventListener("input", () => {
      ex.cost = Number(costEl.value || 0);
      renderOverlay(currentCharacter);
      renderFooter(currentCharacter);
      saveCurrentDebounced();
    });
    detEl.addEventListener("input", () => {
      ex.data = ex.data || {};
      ex.data.details = detEl.value;
      saveCurrentDebounced();
    });
  });
}

/* -------------------------
   Manage Characters — List, New, Save, Delete, Switch
   ------------------------- */
function ensureNameUnique(base, map) {
  if (!map[base]) return base;
  let i = 2;
  while (map[`${base} ${i}`]) i++;
  return `${base} ${i}`;
}

function renderManageList() {
  if (!els.manageList) return;
  const map = loadAllCharacters();
  const names = Object.keys(map).sort((a,b)=>a.localeCompare(b));
  const active = currentName;

  els.manageList.innerHTML = names.map(n => `
    <button class="char-item${n===active ? ' active':''}" data-name="${escapeHtml(n)}" title="Switch to ${escapeHtml(n)}">
      ${escapeHtml(n)}
    </button>
  `).join(names.length ? "" : `<em>No saved characters yet.</em>`);

  els.manageList.querySelectorAll(".char-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-name");
      switchCharacter(name);
    });
  });
}

function newCharacter() {
  const map = loadAllCharacters();
  const name = ensureNameUnique("Untitled", map);
  const fresh = defaultCharacter(name);
  map[name] = fresh;
  saveAllCharacters(map);
  setCurrentName(name);
  loadIntoEditor(fresh, name);
  renderManageList();
}

function saveCharacter() {
  if (!currentName || !currentCharacter) return;
  // sync character's internal name with the key
  currentCharacter.name = currentName;

  const map = loadAllCharacters();
  // Merge with any stored version to avoid accidental field loss
  const stored = map[currentName] || {};
  map[currentName] = deepMerge(stored, currentCharacter);
  saveAllCharacters(map);

  renderManageList();
}

function deleteCharacter() {
  if (!currentName) return;
  const map = loadAllCharacters();
  if (!map[currentName]) return;

  // Simple confirm UX; adjust if you have a modal
  const ok = confirm(`Delete "${currentName}"? This cannot be undone.`);
  if (!ok) return;

  delete map[currentName];
  saveAllCharacters(map);

  // Pick another character if any exist
  const names = Object.keys(map);
  if (names.length) {
    const next = names[0];
    setCurrentName(next);
    loadIntoEditor(map[next], next);
  } else {
    // Start fresh
    const fresh = defaultCharacter("Untitled");
    const unique = ensureNameUnique(fresh.name, map);
    fresh.name = unique;
    map[unique] = fresh;
    saveAllCharacters(map);
    setCurrentName(unique);
    loadIntoEditor(fresh, unique);
  }
  renderManageList();
}

function switchCharacter(name) {
  const map = loadAllCharacters();
  const data = map[name];
  if (!data) return;
  setCurrentName(name);
  loadIntoEditor(data, name);
  renderManageList();
}

/* -------------------------
   Import JSON (e.g., Jericho)
   ------------------------- */
function importCharacterJSON(json) {
  const inbound = sanitizeCharacter(json);
  delete inbound.usedPoints;

  // Determine a name for the imported character
  const baseName = inbound.name && String(inbound.name).trim() ? inbound.name.trim() : "Imported";
  const map = loadAllCharacters();
  const uniqueName = ensureNameUnique(baseName, map);

  // Merge with default to ensure shape completeness
  const merged = deepMerge(defaultCharacter(uniqueName), inbound);

  map[uniqueName] = merged;
  saveAllCharacters(map);

  setCurrentName(uniqueName);
  loadIntoEditor(merged, uniqueName);
  renderManageList();
}

function sanitizeCharacter(raw) {
  const safe = isObject(raw) ? { ...raw } : {};
  safe.skills = Array.isArray(safe.skills) ? safe.skills : [];
  safe.powers = Array.isArray(safe.powers) ? safe.powers : [];
  safe.extras = Array.isArray(safe.extras) ? safe.extras : [];
  return safe;
}

/* -------------------------
   Editor Load/Render
   ------------------------- */
function loadIntoEditor(data, name) {
  // Deep merge into default to avoid missing fields; DO NOT trust serialized totals
  const merged = deepMerge(defaultCharacter(name), sanitizeCharacter(data));
  currentCharacter = merged;
  currentName = name;

  // Render UI sections
  renderOverlay(currentCharacter);
  renderFooter(currentCharacter);
  renderExtras(currentCharacter);

  // Persist selection
  saveCurrentNow();
}

/* -------------------------
   Wiring / Init
   ------------------------- */
function wireManageButtons() {
  if (els.btnNew)    els.btnNew.addEventListener("click", newCharacter);
  if (els.btnSave)   els.btnSave.addEventListener("click", saveCharacter);
  if (els.btnDelete) els.btnDelete.addEventListener("click", deleteCharacter);
}
function wireImportInput() {
  if (!els.importInput) return;
  els.importInput.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const json = JSON.parse(text);
      importCharacterJSON(json);
    } catch (err) {
      console.error("Invalid JSON import", err);
      alert("Invalid JSON file.");
    } finally {
      e.target.value = ""; // allow re-importing same file
    }
  });
}

function init() {
  cacheEls();
  wireManageButtons();
  wireImportInput();

  // Boot: load map and pick current or create one
  const map = loadAllCharacters();
  let name = getCurrentName();
  if (name && map[name]) {
    loadIntoEditor(map[name], name);
  } else {
    // If any characters exist, pick the first; else create a fresh one
    const names = Object.keys(map);
    if (names.length) {
      name = names[0];
      setCurrentName(name);
      loadIntoEditor(map[name], name);
    } else {
      const fresh = defaultCharacter("Untitled");
      const unique = ensureNameUnique(fresh.name, map);
      fresh.name = unique;
      map[unique] = fresh;
      saveAllCharacters(map);
      setCurrentName(unique);
      loadIntoEditor(fresh, unique);
    }
  }
  renderManageList();
}

document.addEventListener("DOMContentLoaded", init);

/* Expose import for programmatic use if needed */
window.importCharacterJSON = importCharacterJSON;
