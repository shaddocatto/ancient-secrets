/* =========================
   Amber Character Builder — single-file script.js (Manage Characters + Import fixed)
   ========================= */

/* -------------------------
   Config / Storage Keys
   ------------------------- */
const STORAGE_CHARACTERS = "amber:characters:v1";   // map: { [name]: characterObj }
const STORAGE_CURRENT    = "amber:currentName:v1";  // string: current character name

/* -------------------------
   State
   ------------------------- */
let currentCharacter = null; // the live, editable character
let currentName = null;      // the name (key) of current character
const els = {};              // DOM element cache

/* -------------------------
   Utilities
   ------------------------- */
function isObject(v){ return v && typeof v === "object" && !Array.isArray(v); }
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}
function cryptoRandomId() {
  try {
    return [...crypto.getRandomValues(new Uint8Array(8))]
      .map(b => b.toString(16).padStart(2,"0")).join("");
  } catch {
    return "id_" + Math.random().toString(36).slice(2,10);
  }
}

/* Deep merge that tries to match array items by stable key (id or name) */
function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    const byKey = new Map();
    const keyOf = (it) => (it && (it.id ?? it.name)) || null;

    // seed with target
    target.forEach(it => {
      const k = keyOf(it);
      byKey.set(k || cryptoRandomId(), it);
    });
    // merge/append from source
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
   Defaults
   ------------------------- */
function defaultCharacter(name = "Untitled") {
  return {
    name,
    totalPoints: 100,     // adjust if your guide specifies a different default
    heritage: null,       // "Amber" | "Chaos" | etc.
    skills: [],           // [{id,name,rating,costOverride}]
    powers: [],           // [{id,name,baseCost,advanced,advancedCost,includesCredit,discounts}]
    extras: [],           // [{id,type,cost,data:{details}}]
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

/* Debounced save of current only */
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
   Points — single source of truth
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
    const includes = Number(p.includesCredit ?? 0); // credits for included base
    const discounts = Number(p.discounts ?? 0);     // other discounts
    const subtotal = base + adv - includes - discounts;
    return sum + Math.max(0, subtotal);             // clamp if needed by your rules
  }, 0);
}
function calcExtrasCost(char) {
  return (char.extras || []).reduce((sum, e) => {
    const c = Number(e.cost ?? 0);
    return sum + (Number.isFinite(c) ? c : 0);
  }, 0);
}
function calcHeritageAdjustments(char) {
  // Example credits (negative means credit). Adjust to your rulebook.
  let adj = 0;
  const h = (char.heritage || "").toLowerCase();
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
   DOM Cache (matches YOUR markup)
   ------------------------- */
function cacheEls() {
  els.overlay     = document.getElementById("overlay-summary");
  els.footer      = document.getElementById("footer-summary");
  els.extras      = document.getElementById("extras-container");

  // Manage Characters section (as provided)
  els.charSelect  = document.getElementById("characterSelect");
  els.btnNew      = document.getElementById("newCharacterBtn");
  els.btnImport   = document.getElementById("importCharacterBtn");
  els.btnExport   = document.getElementById("exportJsonBtn");
  els.btnDelete   = document.getElementById("deleteCharacterBtn");
  els.importInput = document.getElementById("importFile");
}

/* -------------------------
   Rendering — Overlay / Footer / Extras
   ------------------------- */
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
    ex.id = id; // ensure stable id for merge/persist
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

  // Wire inputs (debounced save; DO NOT re-render per keystroke to keep focus)
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
   Manage Characters — Dropdown/List + Actions
   ------------------------- */
function ensureNameUnique(base, map) {
  if (!map[base]) return base;
  let i = 2;
  while (map[`${base} ${i}`]) i++;
  return `${base} ${i}`;
}
function renderManageList() {
  if (!els.charSelect) return;
  const map = loadAllCharacters();
  const names = Object.keys(map).sort((a,b)=>a.localeCompare(b));
  const active = currentName;

  els.charSelect.innerHTML = names.map(n =>
    `<option value="${escapeHtml(n)}"${n===active ? " selected":""}>${escapeHtml(n)}</option>`
  ).join("");

  // Make sure the select reflects current
  if (active && names.includes(active)) {
    els.charSelect.value = active;
  }
}
function newCharacter() {
  const map = loadAllCharacters();
  const base = "Untitled";
  const unique = ensureNameUnique(base, map);
  const fresh = defaultCharacter(unique);
  map[unique] = fresh;
  saveAllCharacters(map);
  setCurrentName(unique);
  loadIntoEditor(fresh, unique);
  renderManageList();
}
function deleteCharacter() {
  if (!currentName) return;
  const map = loadAllCharacters();
  if (!map[currentName]) return;

  if (!confirm(`Delete "${currentName}"? This cannot be undone.`)) return;

  delete map[currentName];
  saveAllCharacters(map);

  const names = Object.keys(map).sort((a,b)=>a.localeCompare(b));
  if (names.length) {
    const next = names[0];
    setCurrentName(next);
    loadIntoEditor(map[next], next);
  } else {
    // start fresh if none left
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
   Import / Export
   ------------------------- */
function sanitizeCharacter(raw) {
  const safe = isObject(raw) ? { ...raw } : {};
  safe.skills = Array.isArray(safe.skills) ? safe.skills : [];
  safe.powers = Array.isArray(safe.powers) ? safe.powers : [];
  safe.extras = Array.isArray(safe.extras) ? safe.extras : [];
  return safe;
}
function importCharacterJSON(json) {
  const inbound = sanitizeCharacter(json);
  // Never trust serialized totals
  delete inbound.usedPoints;

  const baseName = inbound.name && String(inbound.name).trim()
    ? String(inbound.name).trim()
    : "Imported";

  const map = loadAllCharacters();
  const uniqueName = ensureNameUnique(baseName, map);

  // Merge with defaults for completeness
  const merged = deepMerge(defaultCharacter(uniqueName), inbound);

  map[uniqueName] = merged;
  saveAllCharacters(map);

  setCurrentName(uniqueName);
  loadIntoEditor(merged, uniqueName);
  renderManageList();
}
function exportCharacterJSON() {
  if (!currentCharacter) return;
  const data = JSON.stringify(currentCharacter, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${currentName || "character"}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* -------------------------
   Editor Load
   ------------------------- */
function loadIntoEditor(data, name) {
  // Ensure stable ids in arrays like extras so they persist across merges
  const cleaned = sanitizeCharacter(data);
  ["skills","powers","extras"].forEach(arrKey => {
    if (Array.isArray(cleaned[arrKey])) {
      cleaned[arrKey] = cleaned[arrKey].map(item => {
        if (isObject(item) && !item.id) return { id: cryptoRandomId(), ...item };
        return item;
      });
    }
  });

  // Deep merge into defaults; DO NOT carry any stale totals
  const merged = deepMerge(defaultCharacter(name), cleaned);

  currentCharacter = merged;
  currentName = name;

  // Render sections
  renderOverlay(currentCharacter);
  renderFooter(currentCharacter);
  renderExtras(currentCharacter);

  // Persist selection+data
  saveCurrentNow();
}

/* -------------------------
   Wiring / Init
   ------------------------- */
function wireManage() {
  if (els.btnNew)    els.btnNew.addEventListener("click", newCharacter);
  if (els.btnDelete) els.btnDelete.addEventListener("click", deleteCharacter);
  if (els.btnExport) els.btnExport.addEventListener("click", exportCharacterJSON);

  // Import: open file picker
  if (els.btnImport && els.importInput) {
    els.btnImport.addEventListener("click", () => els.importInput.click());
  }
  // File input change → read + import
  if (els.importInput) {
    els.importInput.addEventListener("change", async (e) => {
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        const json = JSON.parse(text);
        importCharacterJSON(json);
      } catch (err) {
        console.error("Invalid JSON import:", err);
        alert("That file doesn't look like valid character JSON.");
      } finally {
        // allow selecting the same file again later
        e.target.value = "";
      }
    });
  }

  // Change selection in dropdown → switch characters
  if (els.charSelect) {
    els.charSelect.addEventListener("change", () => {
      const name = els.charSelect.value;
      if (name && name !== currentName) switchCharacter(name);
    });
  }
}

function init() {
  cacheEls();
  wireManage();

  // Boot: choose current or create one
  const map = loadAllCharacters();
  let name = getCurrentName();

  if (name && map[name]) {
    loadIntoEditor(map[name], name);
  } else {
    const names = Object.keys(map).sort((a,b)=>a.localeCompare(b));
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

// Start once DOM is ready
document.addEventListener("DOMContentLoaded", init);

/* Optional: expose import for programmatic calls */
window.importCharacterJSON = importCharacterJSON;
