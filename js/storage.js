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
    getRulesSafe(),
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

async function getRulesSafe() {
  const data = await chrome.storage.local.get(RULES_KEY);
  return Array.isArray(data[RULES_KEY]) ? data[RULES_KEY] : [];
}

async function importBackup(payload) {
  if (!payload || !Array.isArray(payload.profiles)) {
    throw new Error("Invalid backup file");
  }
  await saveProfiles(payload.profiles);
  if (payload.activeId) await setActiveProfileId(payload.activeId);
  if (Array.isArray(payload.rules)) {
    await chrome.storage.local.set({ [RULES_KEY]: payload.rules });
  }
  return payload.profiles;
}

// --- Site rules: capture-current-form-and-replay-later ---

async function getRules() {
  const data = await chrome.storage.local.get(RULES_KEY);
  return Array.isArray(data[RULES_KEY]) ? data[RULES_KEY] : [];
}

async function saveRules(rules) {
  await chrome.storage.local.set({ [RULES_KEY]: rules });
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
    rule.overwrite = rules[idx].overwrite; // keep user's existing overwrite preference
    rule.id = rules[idx].id;
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
};
