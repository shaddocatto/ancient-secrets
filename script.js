/* =========================
   Amber Character Builder — single-file script.js (Import hardened)
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
  els.overlay.innerHTML = pointsSummaryMarkup(char);
}

function renderFooter(char) {
  if (!els.footer) return;
  els.footer.innerHTML = `
    <div class="summary">
      ${pointsSummaryMarkup(char)
        // strip outer wrapper to fit footer inline look (optional)
        .replace(/^<div class="points">|<\/div>$/g, "")
        .replaceAll("<div>", "<span>").replaceAll("</div>", "</span>")
      }
    </div>
  `;
}

// 🔁 Replace your entire renderExtras() with this:

function renderExtras(char) {
  if (!els.extras) return;
  const extras = Array.isArray(char.extras) ? char.extras : [];

  // Build a compact summary of ALL extras (not just 'Exceptional')
  const summaryLines = extras.map(ex => {
    const type = (ex.type || "custom").trim();
    const cost = Number(ex.cost ?? 0);
    const details = (ex.data && ex.data.details ? String(ex.data.details) : "").trim();

    // Try to craft a helpful one-liner. If we know nothing else, show details snippet.
    let info = details ? details : "";
    // keep the summary short
    if (info.length > 120) info = info.slice(0, 117) + "…";

    return `<li><strong>${escapeHtml(type)}</strong> (${isFinite(cost) ? cost : 0})${info ? ` — ${escapeHtml(info)}` : ""}</li>`;
  });

  // Main editor (expanded cards)
  const cardsHtml = extras.map(ex => {
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

  // Collapsed + Expanded UI (simple toggle; persists in localStorage)
  const COLLAPSE_KEY = "amber:extras:collapsed:v1";
  const collapsed = localStorage.getItem(COLLAPSE_KEY) === "1";

  els.extras.innerHTML = `
    <div class="extras-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.5rem;">
      <h3 style="margin:0;">Extras</h3>
      <button id="toggleExtrasBtn" type="button">${collapsed ? "Expand" : "Collapse"}</button>
    </div>

    <div id="extrasCollapsed" style="${collapsed ? "" : "display:none"}">
      ${
        extras.length
          ? `<ul style="margin-left:1rem;line-height:1.4;">${summaryLines.join("")}</ul>`
          : `<em>No extras yet.</em>`
      }
    </div>

    <div id="extrasExpanded" style="${collapsed ? "display:none" : ""}">
      ${cardsHtml || `<em>No extras yet.</em>`}
    </div>
  `;

  // Toggle wiring
  const toggleBtn = document.getElementById("toggleExtrasBtn");
  const collapsedEl = document.getElementById("extrasCollapsed");
  const expandedEl  = document.getElementById("extrasExpanded");
  if (toggleBtn && collapsedEl && expandedEl) {
    toggleBtn.addEventListener("click", () => {
      const nowCollapsed = expandedEl.style.display !== "none"; // if expanded is visible, we'll collapse
      collapsedEl.style.display = nowCollapsed ? "" : "none";
      expandedEl.style.display  = nowCollapsed ? "none" : "";
      toggleBtn.textContent = nowCollapsed ? "Expand" : "Collapse";
      localStorage.setItem(COLLAPSE_KEY, nowCollapsed ? "1" : "0");
    });
  }

  // Wire inputs (debounced save; no re-render per keystroke to keep focus)
  // Only add listeners when expanded exists
  expandedEl?.querySelectorAll(".extra").forEach(node => {
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
      // Keep Good/Bad Stuff live
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
   Import / Export (HARDENED)
   ------------------------- */
function sanitizeCharacter(raw) {
  const safe = isObject(raw) ? { ...raw } : {};
  safe.skills = Array.isArray(safe.skills) ? safe.skills : [];
  safe.powers = Array.isArray(safe.powers) ? safe.powers : [];
  safe.extras = Array.isArray(safe.extras) ? safe.extras : [];
  return safe;
}

function importCharacterJSON(json) {
  try {
    const inbound = sanitizeCharacter(json);
    delete inbound.usedPoints; // never trust serialized totals

    const baseName = inbound.name && String(inbound.name).trim()
      ? String(inbound.name).trim()
      : "Imported";

    const map = loadAllCharacters();
    const uniqueName = ensureNameUnique(baseName, map);

    // Ensure stable ids inside arrays before merging
    ["skills","powers","extras"].forEach(arrKey => {
      if (Array.isArray(inbound[arrKey])) {
        inbound[arrKey] = inbound[arrKey].map(item => {
          if (isObject(item) && !item.id) return { id: cryptoRandomId(), ...item };
          return item;
        });
      }
    });

    const merged = deepMerge(defaultCharacter(uniqueName), inbound);
    map[uniqueName] = merged;
    saveAllCharacters(map);

    setCurrentName(uniqueName);
    loadIntoEditor(merged, uniqueName);
    renderManageList();
    console.info(`[Import] Imported as "${uniqueName}"`);
  } catch (err) {
    console.error("[Import] Failed to process JSON:", err);
    alert("Sorry, we couldn't import that file. Check the console for details.");
  }
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

/* Robust file → JSON reader (handles more environments) */
async function readFileAsText(file) {
  if (!file) throw new Error("No file provided");
  // Prefer File.text() if available
  if (typeof file.text === "function") {
    return await file.text();
  }
  // Fallback to FileReader
  console.debug("[Import] Using FileReader fallback");
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(fr.error || new Error("FileReader error"));
    fr.readAsText(file);
  });
}

/* -------------------------
   Editor Load
   ------------------------- */
function loadIntoEditor(data, name) {
  try {
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
  } catch (err) {
    console.error("[LoadIntoEditor] Failed:", err);
    alert("There was a problem displaying that character. See console for details.");
  }
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
    els.btnImport.addEventListener("click", () => {
      // Some browsers block programmatic clicks on display:none inputs.
      // Ensure the input is not display:none; use visually-hidden styles instead (opacity:0).
      // If it must be display:none, we'll also attach a delegated change listener below.
      try {
        els.importInput.click();
      } catch (e) {
        console.warn("[Import] Programmatic click failed, focusing input instead");
        els.importInput.focus();
      }
    });
  }

  // File input change → read + import (robust)
  if (els.importInput) {
    els.importInput.addEventListener("change", async (e) => {
      try {
        const f = e.target.files && e.target.files[0];
        if (!f) {
          console.warn("[Import] No file selected");
          return;
        }
        console.info(`[Import] Reading file: ${f.name} (${f.type || "unknown type"})`);
        const text = await readFileAsText(f);

        // Strip UTF-8 BOM if present
        const cleanText = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;

        let json;
        try {
          json = JSON.parse(cleanText);
        } catch (parseErr) {
          console.error("[Import] JSON parse error:", parseErr, { preview: cleanText.slice(0, 200) });
          alert("That file isn't valid JSON. (See console for details.)");
          return;
        }
        importCharacterJSON(json);
      } catch (err) {
        console.error("[Import] Unexpected error:", err);
        alert("Import failed due to an unexpected error. See console for details.");
      } finally {
        // Allow re-selecting the same file to re-trigger change event
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

  // Extra safety: delegated change listener in case the input is replaced dynamically
  document.addEventListener("change", async (evt) => {
    const t = evt.target;
    if (t && t.id === "importFile" && t.files && t.files[0]) {
      // If primary listener didn't fire for any reason, handle it here too
      try {
        const text = await readFileAsText(t.files[0]);
        const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
        importCharacterJSON(JSON.parse(clean));
      } catch (err) {
        console.error("[Import-delegated] Failed:", err);
        alert("Import failed (delegated handler). See console for details.");
      } finally {
        t.value = "";
      }
    }
  }, { capture: true });
}

function cacheElsAndWarnIfMissing() {
  cacheEls();
  // Helpful console hints if something isn't wired in HTML
  if (!els.charSelect) console.warn('Missing #characterSelect');
  if (!els.btnNew) console.warn('Missing #newCharacterBtn');
  if (!els.btnImport) console.warn('Missing #importCharacterBtn');
  if (!els.btnExport) console.warn('Missing #exportJsonBtn');
  if (!els.btnDelete) console.warn('Missing #deleteCharacterBtn');
  if (!els.importInput) console.warn('Missing #importFile');
}

function init() {
  cacheElsAndWarnIfMissing();
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

/* Optional: expose import for programmatic calls (e.g., tests) */
window.importCharacterJSON = importCharacterJSON;