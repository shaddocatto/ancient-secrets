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
    const subtotal = base + adv - includes - discount
