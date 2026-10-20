// AutoFill — side panel controller
import {
  uid,
  getProfiles,
  getActiveProfileId,
  setActiveProfileId,
  upsertProfile,
  deleteProfile,
  exportBackup,
  importBackup,
  getRules,
  deleteRule,
  setRuleOverwrite,
  updateRule,
} from "./storage.js";

const listEl = document.getElementById("profile-list");
const emptyState = document.getElementById("empty-state");
const cardTemplate = document.getElementById("profile-card-template");
const fieldRowTemplate = document.getElementById("field-row-template");

const rulesListEl = document.getElementById("rules-list");
const emptyRulesState = document.getElementById("empty-rules-state");
const ruleCardTemplate = document.getElementById("rule-card-template");

const dialog = document.getElementById("profile-dialog");
const dialogTitle = document.getElementById("dialog-title");
const form = document.getElementById("profile-form");
const nameInput = document.getElementById("profile-name");
const fieldsContainer = document.getElementById("fields-container");

const addProfileBtn = document.getElementById("btn-add-profile");
const fillNowBtn = document.getElementById("btn-fill-now");

let editingId = null;
let activeTab = "rules";

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2200);
}

// --- Tabs ---

function setTab(tab) {
  activeTab = tab;
  document.getElementById("tab-rules").classList.toggle("is-active", tab === "rules");
  document.getElementById("tab-profiles").classList.toggle("is-active", tab === "profiles");
  document.getElementById("rules-panel").classList.toggle("hidden", tab !== "rules");
  listEl.classList.toggle("hidden", tab !== "profiles");
  addProfileBtn.classList.toggle("hidden", tab !== "profiles");
  fillNowBtn.title = tab === "rules" ? "Is page ke liye saved rules abhi apply karein" : "Active profile se abhi bharein";
  if (tab === "rules") renderRules();
  else render();
}

document.getElementById("tab-rules").addEventListener("click", () => setTab("rules"));
document.getElementById("tab-profiles").addEventListener("click", () => setTab("profiles"));

// --- Site rules rendering ---

function ruleLabel(rule) {
  return rule.scope === "site" ? rule.host : `${rule.host}${rule.path || ""}`;
}

async function renderRules() {
  const rules = await getRules();
  rulesListEl.innerHTML = "";
  emptyRulesState.classList.toggle("hidden", rules.length > 0);

  const sorted = [...rules].sort((a, b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));

  for (const rule of sorted) {
    const node = ruleCardTemplate.content.cloneNode(true);
    node.querySelector(".rule-scope-badge").textContent = rule.scope === "site" ? "Site" : "Page";
    node.querySelector(".rule-label").textContent = ruleLabel(rule);
    node.querySelector(".rule-label").title = ruleLabel(rule);
    const count = (rule.fields || []).length;
    node.querySelector(".rule-field-count").textContent = `${count} field${count === 1 ? "" : "s"}`;

    const checkbox = node.querySelector(".overwrite-checkbox");
    checkbox.checked = !!rule.overwrite;
    checkbox.addEventListener("change", async () => {
      await setRuleOverwrite(rule.id, checkbox.checked);
      toast(checkbox.checked ? "Overwrite ON — pehle se bhari fields bhi badlengi" : "Overwrite OFF — khali fields hi bharengi");
    });

    node.querySelector(".btn-edit-rule").addEventListener("click", () => openRuleEditor(rule));

    node.querySelector(".btn-delete-rule").addEventListener("click", async () => {
      await deleteRule(rule.id);
      toast("Rule delete ho gaya");
      renderRules();
    });

    rulesListEl.appendChild(node);
  }
}

// --- Rule editor ---

const ruleDialog = document.getElementById("rule-dialog");
const ruleForm = document.getElementById("rule-form");
const ruleFieldsEl = document.getElementById("rule-fields-container");
let editingRule = null;

const asList = (v) => (Array.isArray(v) ? v : [v]).map((x) => (x == null ? "" : String(x)));

// What the user sees/edits for a saved field.
function displayValue(f) {
  if (f.kind === "boolean") return f.value ? "yes" : "no";
  if (f.kind === "select" || f.kind === "multiselect") {
    const texts = asList(f.text).filter(Boolean);
    return (texts.length ? texts : asList(f.value)).join(" | ");
  }
  return asList(f.value).join(" | ");
}

function addRuleFieldRow(field) {
  const row = document.createElement("div");
  row.className = "field-row";
  row._field = field || null; // original saved field (null = added by hand)

  const label = document.createElement("input");
  label.type = "text";
  label.className = "field-label";
  label.placeholder = "Label";
  label.value = field ? field.label || String(field.key) : "";
  label.title = field ? String(field.key) : "Jis field ko bharna hai uska label";

  let valueEl;
  if (field && field.kind === "boolean") {
    valueEl = document.createElement("select");
    valueEl.innerHTML = '<option value="yes">Haan (tick)</option><option value="no">Nahi (untick)</option>';
    valueEl.value = field.value ? "yes" : "no";
  } else {
    valueEl = document.createElement("input");
    valueEl.type = "text";
    valueEl.placeholder = "Value";
    valueEl.value = field ? displayValue(field) : "";
  }
  valueEl.className = "field-value";
  valueEl._orig = valueEl.value;

  const del = document.createElement("button");
  del.type = "button";
  del.className = "icon-btn btn-remove-field";
  del.title = "Ye field hatayein";
  del.textContent = "✕";
  del.addEventListener("click", () => row.remove());

  row.append(label, valueEl, del);
  ruleFieldsEl.appendChild(row);
  return row;
}

function openRuleEditor(rule) {
  editingRule = rule;
  document.getElementById("rule-dialog-title").textContent = "Edit: " + ruleLabel(rule);
  document.getElementById("rule-edit-overwrite").checked = !!rule.overwrite;
  ruleFieldsEl.innerHTML = "";
  (rule.fields || []).forEach((f) => addRuleFieldRow(f));
  ruleDialog.showModal();
}

function collectRuleFields() {
  const out = [];
  for (const row of ruleFieldsEl.querySelectorAll(".field-row")) {
    const label = row.querySelector(".field-label").value.trim();
    const valueEl = row.querySelector(".field-value");
    const raw = valueEl.value.trim();
    const orig = row._field;
    if (!orig) {
      if (!label || !raw) continue; // empty hand-added row
      out.push({ key: "label:" + label, kind: "auto", label, value: raw });
      continue;
    }
    const f = JSON.parse(JSON.stringify(orig)); // keep key / kind / hidden data
    if (label && label !== (orig.label || String(orig.key))) {
      f.label = label;
      if (String(f.key).startsWith("label:")) f.key = "label:" + label;
    }
    if (valueEl.value !== valueEl._orig) { // value was edited
      const parts = raw.split("|").map((x) => x.trim()).filter(Boolean);
      if (f.kind === "boolean") f.value = raw === "yes";
      else if (f.kind === "select") { f.value = raw; f.text = raw; }
      else if (f.kind === "multiselect") { f.value = parts; f.text = parts; }
      else if (f.kind === "custom") f.value = Array.isArray(orig.value) ? parts : raw;
      else f.value = raw;
    }
    out.push(f);
  }
  return out;
}

document.getElementById("btn-rule-add-field").addEventListener("click", () => {
  const row = addRuleFieldRow(null);
  row.querySelector(".field-label").focus();
});
ruleDialog.querySelectorAll("[data-close-rule]").forEach((b) => b.addEventListener("click", () => ruleDialog.close()));
ruleForm.addEventListener("submit", async () => {
  if (!editingRule) return;
  await updateRule(editingRule.id, {
    fields: collectRuleFields(),
    overwrite: document.getElementById("rule-edit-overwrite").checked,
  });
  toast("Rule save ho gaya ✓");
  renderRules();
});

// --- Profiles (manual, optional) ---

function addFieldRow(label = "", value = "") {
  const node = fieldRowTemplate.content.cloneNode(true);
  const row = node.querySelector(".field-row");
  row.querySelector(".field-label").value = label;
  row.querySelector(".field-value").value = value;
  row.querySelector(".btn-remove-field").addEventListener("click", () => row.remove());
  fieldsContainer.appendChild(row);
}

function openDialogForNew() {
  editingId = null;
  dialogTitle.textContent = "Naya profile";
  nameInput.value = "";
  fieldsContainer.innerHTML = "";
  document.getElementById("btn-delete-profile").classList.add("hidden");
  ["Naam", "Email", "Phone", "Address"].forEach((l) => addFieldRow(l, ""));
  dialog.showModal();
  nameInput.focus();
}

function openDialogForEdit(profile) {
  editingId = profile.id;
  dialogTitle.textContent = "Profile edit karein";
  nameInput.value = profile.name;
  fieldsContainer.innerHTML = "";
  (profile.fields || []).forEach((f) => addFieldRow(f.label, f.value));
  if (!profile.fields?.length) addFieldRow();
  document.getElementById("btn-delete-profile").classList.remove("hidden");
  dialog.showModal();
  nameInput.focus();
}

async function render() {
  let [profiles, activeId] = await Promise.all([getProfiles(), getActiveProfileId()]);
  const effectiveActive = activeId && profiles.some((p) => p.id === activeId) ? activeId : profiles[0]?.id ?? null;
  if (effectiveActive !== activeId) {
    await setActiveProfileId(effectiveActive);
    // re-read: another render may have changed things while we awaited
    [profiles, activeId] = await Promise.all([getProfiles(), getActiveProfileId()]);
  }

  // From here on there is no await, so overlapping render() calls can't interleave.
  listEl.querySelectorAll(".profile-card").forEach((n) => n.remove());
  emptyState.classList.toggle("hidden", profiles.length > 0);

  for (const profile of profiles) {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".profile-card");
    const radio = node.querySelector(".active-radio");
    radio.checked = profile.id === activeId;
    card.classList.toggle("is-active", profile.id === activeId);
    node.querySelector(".profile-name").textContent = profile.name;
    const count = (profile.fields || []).filter((f) => f.label).length;
    node.querySelector(".field-count").textContent = `${count} field${count === 1 ? "" : "s"}`;

    radio.addEventListener("change", async () => {
      await setActiveProfileId(profile.id);
      render();
    });

    node.querySelector(".btn-fill-one").addEventListener("click", (e) => {
      e.stopPropagation();
      triggerFill(profile);
    });

    node.querySelector(".btn-edit").addEventListener("click", (e) => {
      e.stopPropagation();
      openDialogForEdit(profile);
    });

    listEl.appendChild(node);
  }
}

async function triggerFill(profile) {
  if (!profile) {
    toast("Pehle ek profile chunein");
    return;
  }
  chrome.runtime.sendMessage({ type: "SHIV_AUTOFILL_FILL_ACTIVE_TAB", profile }, (result) => {
    if (chrome.runtime.lastError) {
      toast("Is page par fill nahi ho saka");
      return;
    }
    if (result?.ok) {
      toast(`${result.filled} field bhare gaye ✓`);
    } else if (result?.reason === "no-fields-on-page") {
      toast("Is page par koi form field nahi mila");
    } else if (result?.reason === "empty-profile") {
      toast("Is profile mein koi field nahi hai");
    } else if (result?.reason === "no-match") {
      toast("Profile ki koi field is page se match nahi hui");
    } else if (result?.reason === "already-filled") {
      toast("Matching fields pehle se bhari hui hain");
    } else {
      toast("Fill nahi ho paya, page reload karke try karein");
    }
  });
}

// --- Event wiring ---

addProfileBtn.addEventListener("click", openDialogForNew);
document.getElementById("btn-empty-add").addEventListener("click", openDialogForNew);
document.getElementById("btn-add-field").addEventListener("click", () => addFieldRow());

dialog.querySelectorAll("[data-close]").forEach((btn) => btn.addEventListener("click", () => dialog.close()));

document.getElementById("btn-delete-profile").addEventListener("click", async () => {
  if (!editingId) return;
  await deleteProfile(editingId);
  dialog.close();
  toast("Profile delete ho gaya");
  render();
});

form.addEventListener("submit", async (e) => {
  const name = nameInput.value.trim();
  if (!name) {
    e.preventDefault();
    nameInput.focus();
    return;
  }

  const rows = [...fieldsContainer.querySelectorAll(".field-row")];
  const fields = rows
    .map((row) => ({
      id: uid(),
      label: row.querySelector(".field-label").value.trim(),
      value: row.querySelector(".field-value").value.trim(),
    }))
    .filter((f) => f.label);

  const profile = {
    id: editingId || uid(),
    name,
    fields,
    updatedAt: new Date().toISOString(),
  };

  await upsertProfile(profile);
  if (!editingId) await setActiveProfileId(profile.id);
  toast("Profile save ho gaya ✓");
  render();
});

fillNowBtn.addEventListener("click", async () => {
  if (activeTab === "rules") {
    chrome.runtime.sendMessage({ type: "SHIV_AUTOFILL_RUN_RULES_ACTIVE_TAB" }, (result) => {
      if (chrome.runtime.lastError) {
        toast("Is page par fill nahi ho saka");
        return;
      }
      if (result?.ok) toast(`${result.filled} field bhare gaye ✓` + (result.unfilled ? ` — ${result.unfilled} nahi bhari (page ka Console dekhein)` : ""));
      else if (result?.reason === "no-match") toast("Is page ke liye koi rule save nahi hai");
      else if (result?.reason === "no-rules") toast("Abhi koi rule save nahi hai");
      else toast("Koi nayi khali field nahi mili");
    });
    return;
  }
  const [profiles, activeId] = await Promise.all([getProfiles(), getActiveProfileId()]);
  const profile = profiles.find((p) => p.id === activeId) || profiles[0];
  triggerFill(profile);
});

document.getElementById("btn-export").addEventListener("click", async () => {
  const backup = await exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shiv-autofill-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Backup export ho gaya");
});

document.getElementById("btn-import").addEventListener("click", () => {
  document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    await importBackup(payload);
    toast("Backup import ho gaya ✓");
    renderRules();
    render();
  } catch (err) {
    toast("Import fail: file sahi nahi hai");
  } finally {
    e.target.value = "";
  }
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.safill_rules && activeTab === "rules") renderRules();
  if ((changes.safill_profiles || changes.safill_active) && activeTab === "profiles") render();
});

setTab("rules");
