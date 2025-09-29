/* =========================
   Amber Character Builder — single-file script.js
   ========================= */

/* -------------------------
   LocalStorage persistence
   ------------------------- */
const STORAGE_KEY = "amber:character:v1";

// Deep merge utility to preserve arrays like extras
function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    // Prefer source items but keep target items that don’t collide by id
    const byId = new Map(target.map(it => [it && it.id, it]));
    source.forEach(it => byId.set(it && it.id, it));
    return Array.from(byId.values()).filter(Boolean);
  } else if (isObject(target) && isObject(source)) {
    const out = { ...target };
    Object.keys(source).forEach(k => {
      out[k] = k in target ? deepMerge(target[k], source[k]) : source[k];
    });
    return out;
  }
  return source ?? target;
}
function isObject(v){ return v && typeof v === "object" && !Array.isArray(v); }

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveToStorage(char) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(char));
  } catch {}
}

// Debounced save so inputs don’t lose focus
let saveTimer = null;
function saveDebounced(char, delay=400) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveToStorage(char), delay);
}

/* -------------------------
   App State
   ------------------------- */
let character = {
  name: "",
  totalPoints: 100,      // example default; your JSON may override
  heritage: null,        // "Amber", "Chaos", etc.
  skills: [],            // [{ id, name, rating, costOverride? }]
  powers: [],            // [{ id, name, baseCost, advanced, includes?, discounts? }]
  extras: [],            // [{ id, type, cost, data: {…} }]
  notes: "",
  // Do not store computed summary permanently; we recompute on demand
};

// One-time guards to avoid double rendering
let overlayEl, footerSummaryEl, extrasContainerEl;

/* -------------------------
   Import character JSON (e.g., Jericho)
   ------------------------- */
window.importCharacterJSON = function importCharacterJSON(json) {
  // Sanitize inbound
  const inbound = sanitizeCharacter(json);

  // Important: never trust serialized totals/used points
  delete inbound.usedPoints;
  delete inbound._summary;

  // Merge with what we have in storage to avoid purging arrays like extras
  character = deepMerge(character, inbound);

  // Recompute summary fresh
  character._summary = computePointSummary(character);

  renderAll();
  saveToStorage(character);
};

function sanitizeCharacter(raw) {
  const safe = isObject(raw) ? { ...raw } : {};
  safe.skills = Array.isArray(safe.skills) ? safe.skills : [];
  safe.powers = Array.isArray(safe.powers) ? safe.powers : [];
  safe.extras = Array.isArray(safe.extras) ? safe.extras : [];
  return safe;
}

/* -------------------------
   Point math — single source of truth
   ------------------------- */
function computePointSummary(char) {
  const total = Number(char.totalPoints ?? 0);

  const skillsCost  = calcSkillsCost(char);
  const powersCost  = calcPowersCost(char);          // includes adv. credits/links
  const extrasCost  = calcExtrasCost(char);          // per-instance costs
  const heritageAdj = calcHeritageAdjustments(char); // freebies/discounts as negatives

  // Net spent = all costs + adjustments (adjustments negative for freebies)
  const netSpent = skillsCost + powersCost + extrasCost + heritageAdj;

  const remaining = total - netSpent;
  const goodStuff = Math.max(0, remaining);
  const badStuff  = Math.max(0, -remaining);

  return {
    total,
    skillsCost,
    powersCost,
    extrasCost,
    heritageAdj,
    netSpent,
    remaining,
    goodStuff,
    badStuff,
  };
}

// --- Cost helpers (keep logic here; adjust to your exact ruleset) ---
function calcSkillsCost(char) {
  // Example: sum rating (or costOverride if present)
  return (char.skills || []).reduce((sum, s) => {
    const c = Number(s.costOverride ?? s.rating ?? 0);
    return sum + (Number.isFinite(c) ? c : 0);
  }, 0);
}

function calcPowersCost(char) {
  // Example:
  // baseCost + advancedCost - includedCredits - discounts
  return (char.powers || []).reduce((sum, p) => {
    const base = Number(p.baseCost ?? 0);
    const adv  = p.advanced ? Number(p.advancedCost ?? 0) : 0;

    // If an advanced form includes base at discount or free:
    const includes = Number(p.includesCredit ?? 0); // treat as negative later
    const discounts = Number(p.discounts ?? 0);     // other credits

    const subtotal = base + adv - includes - discounts;
    return sum + Math.max(0, subtotal); // clamp if your rules forbid negatives
  }, 0);
}

function calcExtrasCost(char) {
  // Each extra explicitly defines its cost (can be zero/negative if it’s a credit)
  return (char.extras || []).reduce((sum, e) => {
    const c = Number(e.cost ?? 0);
    return sum + (Number.isFinite(c) ? c : 0);
  }, 0);
}

function calcHeritageAdjustments(char) {
  // Return a negative number for freebies/credits (e.g., Pattern free with Amber Heritage)
  // and positive for surcharges. Adjust to your rules.
  const h = (char.heritage || "").toLowerCase();
  let adj = 0;

  if (h === "amber") {
    // Example: Pattern is free → credit
    const hasPattern = (char.powers || []).some(p => /pattern/i.test(p.name));
    if (hasPattern) adj -= 50; // Adjust to the actual rule cost
  }
  if (h === "chaos") {
    // Example: Logrus discount, etc.
    const hasLogrus = (char.powers || []).some(p => /logrus/i.test(p.name));
    if (hasLogrus) adj -= 25; // Adjust to the actual rule cost
  }
  // If heritage grants extra freebies/discounts, add them here.

  return adj;
}

/* -------------------------
   Rendering (overlay + footer share the same summary)
   ------------------------- */
function ensureEls() {
  overlayEl = overlayEl || document.getElementById("overlay-summary");
  footerSummaryEl = footerSummaryEl || document.getElementById("footer-summary");
  extrasContainerEl = extrasContainerEl || document.getElementById("extras-container");
}

function renderOverlay(char) {
  if (!overlayEl) return;
  const s = char._summary || computePointSummary(char);
  overlayEl.innerHTML = `
    <div class="points">
      <div><strong>Total:</strong> ${s.total}</div>
      <div><strong>Spent:</strong> ${s.netSpent}</div>
      <div><strong>Good Stuff:</strong> ${s.goodStuff}</div>
      ${s.badStuff ? `<div><strong>Bad Stuff:</strong> ${s.badStuff}</div>` : ""}
    </div>
  `;
}

function renderFooterSummary(char) {
  if (!footerSummaryEl) return;
  const s = char._summary || computePointSummary(char);
  footerSummaryEl.innerHTML = `
    <div class="summary">
      <span>Total ${s.total}</span>
      <span>Spent ${s.netSpent}</span>
      <span>Good Stuff ${s.goodStuff}</span>
      ${s.badStuff ? `<span>Bad Stuff ${s.badStuff}</span>` : ""}
    </div>
  `;
}

// Example Extras UI (keeps focus; debounced save)
function renderExtras(char) {
  if (!extrasContainerEl) return;
  const extras = char.extras || [];
  extrasContainerEl.innerHTML = extras.map(ex => {
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

  // Wire inputs (input events are debounced; we do not re-render on each keystroke)
  extrasContainerEl.querySelectorAll(".extra").forEach(node => {
    const id = node.getAttribute("data-id");
    const ex = extras.find(e => e.id === id);
    const typeEl = node.querySelector(".ex-type");
    const costEl = node.querySelector(".ex-cost");
    const detEl  = node.querySelector(".ex-details");

    typeEl.addEventListener("input", () => {
      ex.type = typeEl.value;
      saveDebounced(character);
    });
    costEl.addEventListener("input", () => {
      ex.cost = Number(costEl.value || 0);
      character._summary = computePointSummary(character);
      renderOverlay(character);
      renderFooterSummary(character);
      saveDebounced(character);
    });
    detEl.addEventListener("input", () => {
      ex.data = ex.data || {};
      ex.data.details = detEl.value;
      saveDebounced(character);
    });
  });
}

/* -------------------------
   App lifecycle
   ------------------------- */
function renderAll() {
  ensureEls();
  character._summary = computePointSummary(character);
  renderOverlay(character);
  renderFooterSummary(character);
  renderExtras(character);
}

function init() {
  ensureEls();
  // Load storage, then deep merge into default shape so arrays like extras survive
  const stored = loadFromStorage();
  if (stored) character = deepMerge(character, sanitizeCharacter(stored));
  character._summary = computePointSummary(character);
  renderAll();

  // If there’s a global file picker/import hook, wire it:
  const fileInput = document.getElementById("import-json");
  if (fileInput) {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const json = JSON.parse(text);
        importCharacterJSON(json);
      } catch (err) {
        console.error("Invalid JSON", err);
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", init);

/* -------------------------
   Utilities
   ------------------------- */
function cryptoRandomId() {
  try {
    return [...crypto.getRandomValues(new Uint8Array(8))]
      .map(b => b.toString(16).padStart(2,"0")).join("");
  } catch {
    // Fallback
    return "id_" + Math.random().toString(36).slice(2,10);
  }
}
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}
