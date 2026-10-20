// AutoFill — shared storage helpers (chrome.storage.local based)

const PROFILES_KEY = "safill_profiles";
const ACTIVE_KEY = "safill_active";
const RULES_KEY = "safill_rules";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function getProfiles() {
  const data = await chrome.storage.local.get(PROFILES_KEY);
  return Array.isArray(data[PROFILES_KEY]) ? data[PROFILES_KEY] : [];
}

async function saveProfiles(profiles) {
  await chrome.storage.local.set({ [PROFILES_KEY]: profiles });
}

async function getActiveProfileId() {
  const data = await chrome.storage.local.get(ACTIVE_KEY);
  return data[ACTIVE_KEY] || null;
}

async function setActiveProfileId(id) {
  await chrome.storage.local.set({ [ACTIVE_KEY]: id });
}

async function getActiveProfile() {
  const [profiles, activeId] = await Promise.all([getProfiles(), getActiveProfileId()]);
  if (!profiles.length) return null;
  return profiles.find((p) => p.id === activeId) || profiles[0];
}

async function upsertProfile(profile) {
  const profiles = await getProfiles();
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx === -1) {
    profiles.push(profile);
  } else {
    profiles[idx] = profile;
  }
  await saveProfiles(profiles);
  return profiles;
}

async function deleteProfile(id) {
  const profiles = (await getProfiles()).filter((p) => p.id !== id);
  await saveProfiles(profiles);
  const activeId = await getActiveProfileId();
  if (activeId === id) {
    await setActiveProfileId(profiles[0]?.id || null);
  }
  return profiles;
}

async function exportBackup() {
  const [profiles, activeId, rules] = await Promise.all([
    getProfiles(),
    getActiveProfileId(),
    getRules(),
  ]);
  return {
    app: "shiv-autofill",
    version: 2,
    exportedAt: new Date().toISOString(),
    activeId,
    profiles,
    rules,
  };
}

const RULE_KINDS = new Set(["text", "select", "multiselect", "boolean", "custom", "auto"]);

function str(v) {
  return typeof v === "string" ? v : v == null ? "" : String(v);
}

// Imported files are untrusted input: coerce every field to the type the rest
// of the extension assumes, and drop entries that can't possibly work.
function sanitizeProfiles(list) {
  const out = [];
  for (const p of list) {
    if (!p || typeof p !== "object") continue;
    const fields = (Array.isArray(p.fields) ? p.fields : [])
      .filter((f) => f && typeof f === "object" && str(f.label).trim())
      .map((f) => ({ id: str(f.id) || uid(), label: str(f.label).trim(), value: str(f.value) }));
    out.push({
      id: str(p.id) || uid(),
      name: str(p.name).trim() || "Profile",
      fields,
      updatedAt: str(p.updatedAt) || new Date().toISOString(),
    });
  }
  return out;
}

function sanitizeRules(list) {
  const out = [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    if (r.scope !== "page" && r.scope !== "site") continue;
    const host = str(r.host).trim();
    if (!host || !Array.isArray(r.fields)) continue;
    const fields = [];
    for (const f of r.fields) {
      if (!f || typeof f.key !== "string" || !f.key) continue;
      const kind = RULE_KINDS.has(f.kind) ? f.kind : "text";
      let value = f.value;
      if (kind === "boolean") value = !!value;
      else if (kind === "multiselect") value = (Array.isArray(value) ? value : [value]).map(str);
      else if (kind === "custom") value = Array.isArray(value) ? value.map(str) : str(value);
      else value = str(value);
      const out = { key: f.key, value, kind, label: str(f.label) };
      // visible option text of native dropdowns (fallback when option values change)
      if (kind === "select" && f.text != null) out.text = str(f.text);
      else if (kind === "multiselect" && Array.isArray(f.text)) out.text = f.text.map(str);
      fields.push(out);
    }
    if (!fields.length) continue;
    out.push({
      id: str(r.id) || uid(),
      scope: r.scope,
      host,
      path: r.scope === "page" ? str(r.path) : "",
      fields,
      overwrite: !!r.overwrite,
      createdAt: str(r.createdAt) || new Date().toISOString(),
      updatedAt: str(r.updatedAt) || str(r.createdAt) || new Date().toISOString(),
    });
  }
  return out;
}

async function importBackup(payload) {
  const hasProfiles = payload && Array.isArray(payload.profiles);
  const hasRules = payload && Array.isArray(payload.rules);
  // A rules-only (or profiles-only) file is valid; a file with neither isn't.
  if (!hasProfiles && !hasRules) {
    throw new Error("Invalid backup file");
  }
  let profiles = null;
  if (hasProfiles) {
    profiles = sanitizeProfiles(payload.profiles);
    await saveProfiles(profiles);
    const wanted = typeof payload.activeId === "string" ? payload.activeId : null;
    const activeId = profiles.some((p) => p.id === wanted) ? wanted : profiles[0]?.id || null;
    await setActiveProfileId(activeId);
  }
  if (hasRules) {
    await saveRules(sanitizeRules(payload.rules));
  }
  return profiles;
}

// --- Site rules: capture-current-form-and-replay-later ---

async function getRules() {
  const data = await chrome.storage.local.get(RULES_KEY);
  return Array.isArray(data[RULES_KEY]) ? data[RULES_KEY] : [];
}

async function saveRules(rules) {
  await chrome.storage.local.set({ [RULES_KEY]: rules });
}

// Multi-tab / multi-step forms live on ONE url, and each save only sees the
// step the user is on. So a new save is merged into the saved rule: fields saved
// now replace the same field, everything else already saved is kept (remove
// unwanted ones with the edit button).
function radioGroupOf(f) {
  return f && typeof f.key === "string" && f.key.startsWith("radio:") ? f.key.replace(/:[^:]*$/, "") : null;
}
function mergeFields(oldFields, newFields) {
  const incoming = Array.isArray(newFields) ? newFields : [];
  const groups = new Set(incoming.map(radioGroupOf).filter(Boolean));
  const keys = new Set(incoming.map((f) => f.key));
  const kept = (Array.isArray(oldFields) ? oldFields : []).filter((f) => {
    if (!f || keys.has(f.key)) return false;
    const g = radioGroupOf(f);
    return !(g && groups.has(g)); // a newly chosen radio replaces the old choice of its group
  });
  return kept.concat(incoming);
}

async function upsertRule(rule) {
  const rules = await getRules();
  // Same host+path+scope replaces the previous rule instead of duplicating.
  const idx = rules.findIndex(
    (r) => r.host === rule.host && r.path === rule.path && r.scope === rule.scope
  );
  if (idx === -1) {
    rules.push(rule);
  } else {
    rule.overwrite = !!rules[idx].overwrite; // keep user's existing overwrite preference
    rule.fields = mergeFields(rules[idx].fields, rule.fields);
    rule.id = rules[idx].id;
    rule.createdAt = rules[idx].createdAt || rule.createdAt;
    rule.updatedAt = new Date().toISOString();
    rules[idx] = rule;
  }
  await saveRules(rules);
  return rules;
}

async function deleteRule(id) {
  const rules = (await getRules()).filter((r) => r.id !== id);
  await saveRules(rules);
  return rules;
}

// Edit a saved rule: replace its fields and/or overwrite flag.
async function updateRule(id, patch) {
  const rules = await getRules();
  const rule = rules.find((r) => r.id === id);
  if (!rule) return rules;
  if (Array.isArray(patch.fields)) rule.fields = patch.fields;
  if (typeof patch.overwrite === "boolean") rule.overwrite = patch.overwrite;
  rule.updatedAt = new Date().toISOString();
  await saveRules(rules);
  return rules;
}

async function setRuleOverwrite(id, overwrite) {
  const rules = await getRules();
  const rule = rules.find((r) => r.id === id);
  if (rule) {
    rule.overwrite = overwrite;
    await saveRules(rules);
  }
  return rules;
}

export {
  uid,
  getProfiles,
  saveProfiles,
  getActiveProfileId,
  setActiveProfileId,
  getActiveProfile,
  upsertProfile,
  deleteProfile,
  exportBackup,
  importBackup,
  getRules,
  saveRules,
  upsertRule,
  deleteRule,
  setRuleOverwrite,
  updateRule,
  mergeFields,
};
