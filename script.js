/* =========================
   Amber Character Builder — script.js (extras feature costs fixed)
   ========================= */

/* -------------------------
   Storage Keys
   ------------------------- */
const STORAGE_CHARACTERS = "amber:characters:v1";   // map: { [name]: characterObj }
const STORAGE_CURRENT    = "amber:currentName:v1";  // string: current character name

/* -------------------------
   State & DOM cache
   ------------------------- */
let currentCharacter = null; // live editable character
let currentName = null;      // current character name key
const els = {};              // DOM cache

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

/* Deep merge that preserves arrays by stable key (id or name) */
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
   Defaults
   ------------------------- */
function defaultCharacter(name = "Untitled") {
  return {
    name,
    totalPoints: 100,     // adjust per your rules if needed
    heritage: null,       // "Amber" | "Chaos" | "both" | ...
    skills: [],           // [{id,name,rating,costOverride}]
    powers: [],           // [{id,name,baseCost,advanced,advancedCost,includesCredit,discounts}]
    extras: [],           // [{id,name,type,cost?,features:[{name,cost,...}],data:{details}}]
    notes: "",
  };
}

/* -------------------------
   Storage helpers
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
   Point math — single source of truth
   ------------------------- */
function computePointSummary(char) {
  const total = Number(char.totalPoints ?? 0);
  const skillsCost      = calcSkillsCost(char);
  const powersCost      = calcPowersCost(char);
  const extrasCost      = calcExtrasCost(char);
  const repeatablesCost = calcRepeatablesCost(char);   // 👈 NEW
  const heritageAdj     = calcHeritageAdjustments(char);

  // Net spent = all costs + adjustments (adjustments negative for credits)
  const netSpent = skillsCost + powersCost + extrasCost + repeatablesCost + heritageAdj;

  const remaining = total - netSpent;
  const goodStuff = Math.max(0, remaining);
  const badStuff  = Math.max(0, -remaining);

  return {
    total,
    skillsCost,
    powersCost,
    extrasCost,
    repeatablesCost,   // 👈 expose for debugging if you want
    heritageAdj,
    netSpent,
    remaining,
    goodStuff,
    badStuff,
  };
}

// Sum costs for repeatable things (Allies, Artifacts, Creatures, etc.)
// Supports either item.cost OR item.features[].cost and string numbers like "+1", "-2"
function calcRepeatablesCost(char) {
  const buckets = [
    "allies","ally","artifacts","artifact","creatures","creature",
    "retinue","retinues","followers","items","item","locations","location"
  ];

  const toNum = (v) => {
    if (v == null) return 0;
    if (typeof v === "number") return Number.isFinite(v) ? v : 0;
    const s = String(v).trim();
    if (!s) return 0;
    const n = Number(s.replace(/[^\d\.\-+]/g, "")); // handles "+1", "-2"
    return Number.isFinite(n) ? n : 0;
  };

  const itemCost = (it) => {
    // prefer explicit item.cost if present
    if (it && it.hasOwnProperty("cost")) return toNum(it.cost);
    // else sum feature costs if provided
    const feats = Array.isArray(it?.features) ? it.features : [];
    return feats.reduce((acc, f) => acc + toNum(f?.cost), 0);
  };

  let total = 0;

  // Generic repeatables array (if you keep them under a single key)
  if (Array.isArray(char?.repeatables)) {
    total += char.repeatables.reduce((acc, it) => acc + itemCost(it), 0);
  }

  // Common per-type arrays
  for (const key of buckets) {
    const arr = char && Array.isArray(char[key]) ? char[key] : null;
    if (arr) total += arr.reduce((acc, it) => acc + itemCost(it), 0);
  }

  // Some schemas embed repeatables under a namespace
  if (char?.repeatableGroups && typeof char.repeatableGroups === "object") {
    Object.values(char.repeatableGroups).forEach(group => {
      if (Array.isArray(group)) {
        total += group.reduce((acc, it) => acc + itemCost(it), 0);
      }
    });
  }

  return total;
}

function calcSkillsCost(char) {
  return (char.skills || []).reduce((sum, s) => {
    const c = Number(s.costOverride ?? s.rating ?? 0);
    return sum + (Number.isFinite(c) ? c : 0);
  }, 0);
}

function calcPowersCost(char) {
  return (char.powers || []).reduce((sum, p) => {
    const base = Number(p.baseCost ?? p.cost ?? 0);  // accept .cost or .baseCost
    const adv  = p.advanced ? Number(p.advancedCost ?? 0) : 0;
    const includes = Number(p.includesCredit ?? 0);  // credits for included base
    const discounts = Number(p.discounts ?? 0);      // other discounts
    const subtotal = base + adv - includes - discounts;
    return sum + Math.max(0, subtotal);              // clamp if your rules disallow negatives
  }, 0);
}

/* 🔥 FIX: derive Extras cost from features when .cost not present */
function calcExtrasCost(char) {
  return (char.extras || []).reduce((sum, ex) => {
    // If the extra itself has a numeric cost, use it
    const direct = Number(ex?.cost);
    if (Number.isFinite(direct)) return sum + direct;

    // Else, sum feature costs
    const features = Array.isArray(ex?.features) ? ex.features : [];
    const fcost = features.reduce((s, f) => s + (Number(f?.cost) || 0), 0);
    return sum + fcost;
  }, 0);
}

/* Heritage adjustments; tweak per your guide. Handles "both". */
function calcHeritageAdjustments(char) {
  let adj = 0;
  const h = (char.heritage || "").toLowerCase();

  // Example credits; modify to your real rules
  const hasPattern = (char.powers || []).some(p => /pattern/i.test(p.name || p.id || ""));
  const hasLogrus  = (char.powers || []).some(p => /logrus/i.test(p.name || p.id || ""));

  if (h === "amber" || h === "both") {
    if (hasPattern) adj -= 50;
  }
  if (h === "chaos" || h === "both") {
    if (hasLogrus) adj -= 25;
  }
  return adj;
}

/* -------------------------
   DOM cache (matches YOUR markup)
   ------------------------- */
function cacheEls() {
  els.overlay     = document.getElementById("overlay-summary");
  els.footer      = document.getElementById("footer-summary");
  els.extras      = document.getElementById("extras-container");

  // Manage Characters section (your IDs)
  els.charSelect  = document.getElementById("characterSelect");
  els.btnNew      = document.getElementById("newCharacterBtn");
  els.btnImport   = document.getElementById("importCharacterBtn");
  els.btnExport   = document.getElementById("exportJsonBtn");
  els.btnDelete   = document.getElementById("deleteCharacterBtn");
  els.importInput = document.getElementById("importFile");
}

/* -------------------------
   Points render — compute once, feed both UIs
   ------------------------- */
function renderPoints(char) {
  if (!char) return;
  const s = computePointSummary(char);
  renderOverlayWithSummary(s);
  renderFooterWithSummary(s);

  // DEBUG (remove later)
  console.debug("[points]", {
    skills: s.skillsCost,
    powers: s.powersCost,
    extras: s.extrasCost,
    repeatables: s.repeatablesCost,
    heritageAdj: s.heritageAdj,
    netSpent: s.netSpent,
    goodStuff: s.goodStuff,
    badStuff: s.badStuff
  });

}
function renderOverlayWithSummary(s) {
  if (!els.overlay || !s) return;
  els.overlay.innerHTML = `
    <div class="points">
      <div><strong>Total:</strong> ${s.total}</div>
      <div><strong>Spent:</strong> ${s.netSpent}</div>
      <div><strong>Good Stuff:</strong> ${s.goodStuff}</div>
      ${s.badStuff ? `<div><strong>Bad Stuff:</strong> ${s.badStuff}</div>` : ""}
    </div>
  `;
}
function renderFooterWithSummary(s) {
  if (!els.footer || !s) return;
  els.footer.innerHTML = `
    <div class="summary">
      <span>Total ${s.total}</span>
      <span>Spent ${s.netSpent}</span>
      <span>Good Stuff ${s.goodStuff}</span>
      ${s.badStuff ? `<span>Bad Stuff ${s.badStuff}</span>` : ""}
    </div>
  `;
}

/* -------------------------
   Extras — collapsed summary + editor (with feature rollups)
   ------------------------- */
function renderExtras(char) {
  if (!els.extras) return;
  try {
    const extras = Array.isArray(char?.extras) ? char.extras : [];

    // Roll up features for each extra: {name -> count}
    function featureRollup(features) {
      const map = new Map();
      (features || []).forEach(f => {
        const key = (f?.name || "Feature").trim();
        map.set(key, (map.get(key) || 0) + 1);
      });
      return Array.from(map.entries())
        .map(([k,count]) => count > 1 ? `${escapeHtml(k)}×${count}` : escapeHtml(k))
        .join(", ");
    }

    // Collapsed summary of ALL extras with feature names
    const summaryLines = extras.map(ex => {
      const name = (ex?.name || ex?.type || "extra").trim();
      const features = Array.isArray(ex?.features) ? ex.features : [];
      const roll = featureRollup(features);
      // derive cost the same way calcExtrasCost will
      const direct = Number(ex?.cost);
      const fcost = features.reduce((s, f) => s + (Number(f?.cost) || 0), 0);
      const cost = Number.isFinite(direct) ? direct : fcost;

      return `<li><strong>${escapeHtml(name)}</strong> (${isFinite(cost) ? cost : 0})${roll ? ` — ${roll}` : ""}</li>`;
    });

    // Expanded cards editor
    const cardsHtml = extras.map(ex => {
      const id = ex.id || cryptoRandomId(); ex.id = id;
      const cost = Number(ex.cost ?? "");
      const name = ex.name || ex.type || "extra";
      const details = (ex.data && typeof ex.data.details === "string") ? ex.data.details : "";
      return `
        <div class="extra" data-id="${id}">
          <div class="row">
            <label>Name</label>
            <input class="ex-name" value="${escapeHtml(name)}" />
            <label>Cost</label>
            <input class="ex-cost" type="number" step="0.5" value="${Number.isFinite(cost) ? cost : ""}" placeholder="auto (sum of features)" />
          </div>
          <div class="row">
            <label>Details</label>
            <textarea class="ex-details" rows="2">${escapeHtml(details)}</textarea>
          </div>
        </div>
      `;
    }).join("");

    // Toggle collapsed/expanded; remember state
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
        const nowCollapsed = expandedEl.style.display !== "none";
        collapsedEl.style.display = nowCollapsed ? "" : "none";
        expandedEl.style.display  = nowCollapsed ? "none" : "";
        toggleBtn.textContent = nowCollapsed ? "Expand" : "Collapse";
        localStorage.setItem(COLLAPSE_KEY, nowCollapsed ? "1" : "0");
      });
    }

    // Input wiring (expanded only)
    expandedEl?.querySelectorAll(".extra").forEach(node => {
      const id = node.getAttribute("data-id");
      const ex = extras.find(e => e.id === id);
      const nameEl = node.querySelector(".ex-name");
      const costEl = node.querySelector(".ex-cost");
      const detEl  = node.querySelector(".ex-details");

      nameEl.addEventListener("input", () => { ex.name = nameEl.value; saveCurrentDebounced(); });
      costEl.addEventListener("input", () => {
        const val = costEl.value;
        ex.cost = val === "" ? undefined : Number(val || 0); // empty → derive from features
        renderPoints(currentCharacter);   // keep overlay/footer in sync
        saveCurrentDebounced();
      });
      detEl.addEventListener("input", () => {
        ex.data = ex.data || {};
        ex.data.details = detEl.value;
        saveCurrentDebounced();
      });
    });
  } catch (err) {
    console.error("[renderExtras] failed:", err);
    els.extras.innerHTML = `<em>Could not render extras (see console).</em>`;
  }
}

/* -------------------------
   Manage Characters — list + actions
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
   Import / Export (robust)
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

    // Ensure stable ids in arrays
    ["skills","powers","extras"].forEach(arrKey => {
      if (Array.isArray(inbound[arrKey])) {
        inbound[arrKey] = inbound[arrKey].map(item => {
          if (isObject(item) && !item.id) return { id: cryptoRandomId(), ...item };
          return item;
        });
      }
      // normalize extras.features ids? (not needed for cost calc)
    });

    const map = loadAllCharacters();
    const uniqueName = ensureNameUnique(baseName, map);
    const merged = deepMerge(defaultCharacter(uniqueName), inbound);

    map[uniqueName] = merged;
    saveAllCharacters(map);

    setCurrentName(uniqueName);
    loadIntoEditor(merged, uniqueName);

    // Ensure UI sync
    renderPoints(currentCharacter);
    renderExtras(currentCharacter);
    renderManageList();
    if (els.charSelect) els.charSelect.value = uniqueName;

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

/* Read file as text (prefers File.text, falls back to FileReader) */
async function readFileAsText(file) {
  if (!file) throw new Error("No file provided");
  if (typeof file.text === "function") return await file.text();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ""));
    fr.onerror = () => reject(fr.error || new Error("FileReader error"));
    fr.readAsText(file);
  });
}

/* -------------------------
   Editor load
   ------------------------- */
function loadIntoEditor(data, name) {
  try {
    const cleaned = sanitizeCharacter(data);
    ["skills","powers","extras"].forEach(arrKey => {
      if (Array.isArray(cleaned[arrKey])) {
        cleaned[arrKey] = cleaned[arrKey].map(item => {
          if (isObject(item) && !item.id) return { id: cryptoRandomId(), ...item };
          return item;
        });
      }
    });

    const merged = deepMerge(defaultCharacter(name), cleaned);
    currentCharacter = merged;
    currentName = name;

    renderPoints(currentCharacter);
    renderExtras(currentCharacter);

    saveCurrentNow();
  } catch (err) {
    console.error("[loadIntoEditor] Failed:", err);
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

  // Import button → click file input (works even if visually hidden)
  if (els.btnImport && els.importInput) {
    els.btnImport.addEventListener("click", () => {
      try { els.importInput.click(); }
      catch { els.importInput.focus(); }
    });
  }

  // File input change → read + import (robust)
  if (els.importInput) {
    els.importInput.addEventListener("change", async (e) => {
      try {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const text = await readFileAsText(f);
        const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text; // strip BOM
        importCharacterJSON(JSON.parse(clean));
      } catch (err) {
        console.error("[Import] Unexpected error:", err);
        alert("Import failed. See console for details.");
      } finally {
        e.target.value = ""; // allow re-importing same file
      }
    });
  }

  // Dropdown switch
  if (els.charSelect) {
    els.charSelect.addEventListener("change", () => {
      const name = els.charSelect.value;
      if (name && name !== currentName) switchCharacter(name);
    });
  }

  // Safety: delegated handler in case input is replaced dynamically
  document.addEventListener("change", async (evt) => {
    const t = evt.target;
    if (t && t.id === "importFile" && t.files && t.files[0]) {
      try {
        const text = await readFileAsText(t.files[0]);
        const clean = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
        importCharacterJSON(JSON.parse(clean));
      } catch (err) {
        console.error("[Import-delegated] Failed:", err);
        alert("Import failed (delegated). See console for details.");
      } finally {
        t.value = "";
      }
    }
  }, { capture: true });
}

function init() {
  cacheEls();
  wireManage();

  // Boot: load current or create one
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

document.addEventListener("DOMContentLoaded", init);

/* Optional: expose import for programmatic calls */
window.importCharacterJSON = importCharacterJSON;