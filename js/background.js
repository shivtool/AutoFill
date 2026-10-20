// AutoFill — background service worker
import { getProfiles, getActiveProfile, uid, upsertRule } from "./storage.js";

const MENU_ROOT = "safill-root";
const MENU_SAVE_PAGE = "safill-save-page";
const MENU_SAVE_SITE = "safill-save-site";
const MENU_FILL_PARENT = "safill-fill-parent";

// Menu rebuilds are serialized: two overlapping removeAll()+create() runs
// (e.g. several quick profile edits) used to collide on duplicate ids.
let menuQueue = Promise.resolve();
function rebuildContextMenu() {
  menuQueue = menuQueue.then(doRebuildContextMenu).catch((err) => console.warn("AutoFill menu:", err));
  return menuQueue;
}

async function doRebuildContextMenu() {
  await chrome.contextMenus.removeAll();

  chrome.contextMenus.create({ id: MENU_ROOT, title: "AutoFill", contexts: ["page", "editable"] });
  chrome.contextMenus.create({
    id: MENU_SAVE_PAGE,
    parentId: MENU_ROOT,
    title: "Yeh form is page ke liye save karein",
    contexts: ["page", "editable"],
  });
  chrome.contextMenus.create({
    id: MENU_SAVE_SITE,
    parentId: MENU_ROOT,
    title: "Yeh form poori site ke liye save karein",
    contexts: ["page", "editable"],
  });

  const profiles = await getProfiles();
  if (profiles.length) {
    chrome.contextMenus.create({
      id: MENU_FILL_PARENT,
      parentId: MENU_ROOT,
      title: "Manual profile se bharein",
      contexts: ["page", "editable"],
    });
    for (const profile of profiles) {
      chrome.contextMenus.create({
        id: `safill-profile-${profile.id}`,
        parentId: MENU_FILL_PARENT,
        title: String(profile.name || "(bina naam)"),
        contexts: ["page", "editable"],
      });
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  rebuildContextMenu();
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  rebuildContextMenu();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.safill_profiles) {
    rebuildContextMenu();
  }
});

// --- talking to content scripts ---

function frameTarget(tabId, frameId) {
  // chrome.scripting rejects a target that has BOTH allFrames and frameIds
  // (even allFrames:false), so only ever set one of them.
  return frameId != null ? { tabId, frameIds: [frameId] } : { tabId, allFrames: true };
}

// If the content script isn't attached yet (page was open before this
// extension was installed/reloaded), recover by injecting it on the fly.
async function injectContentScript(tabId, frameId) {
  await chrome.scripting.executeScript({ target: frameTarget(tabId, frameId), files: ["js/content.js"] });
}

async function sendToTab(tabId, message, frameId) {
  const opts = frameId != null ? { frameId } : undefined;
  try {
    return await chrome.tabs.sendMessage(tabId, message, opts);
  } catch (err) {
    try {
      await injectContentScript(tabId, frameId);
    } catch {
      throw err; // chrome:// page, web store, etc. — can't inject there
    }
    return await chrome.tabs.sendMessage(tabId, message, opts);
  }
}

// Run a content-script API method in every frame (or one frame) and collect
// each frame's result. Unlike sendMessage, this doesn't let the first frame
// to answer (often an empty top frame) hide what an iframe actually did.
async function runInFrames(tabId, method, arg, frameId) {
  const run = () =>
    chrome.scripting.executeScript({
      target: frameTarget(tabId, frameId),
      func: async (m, a) => {
        const api = window.__shivAutofillApi;
        if (!api) return { missing: true };
        return await api[m](a);
      },
      args: [method, arg ?? null],
    });

  let results = await run();
  if (results.some((r) => r.result && r.result.missing)) {
    await injectContentScript(tabId, frameId);
    results = await run();
  }
  return results.map((r) => r.result).filter((r) => r && typeof r === "object" && !r.missing);
}

const REASON_RANK = { undefined: 0, "already-filled": 1, "no-match": 2, "empty-profile": 3, "no-rules": 3, "no-fields-on-page": 4 };

function mergeResults(results) {
  if (!results.length) return { ok: false, filled: 0, reason: "no-response" };
  const filled = results.reduce((n, r) => n + (r.filled || 0), 0);
  const skipped = results.reduce((n, r) => n + (r.skipped || 0), 0);
  const unfilled = results.reduce((n, r) => n + (r.unfilled || 0), 0);
  if (filled > 0) return { ok: true, filled, skipped, unfilled };
  // Nothing filled anywhere: report the most informative reason across frames.
  let best = results[0];
  for (const r of results) {
    if ((REASON_RANK[r.reason] ?? 5) < (REASON_RANK[best.reason] ?? 5)) best = r;
  }
  return { ok: false, filled: 0, skipped, unfilled, reason: best.reason };
}

async function fillTabWithProfile(tabId, profile, frameId) {
  if (!profile) return { ok: false, reason: "no-profile" };
  try {
    return mergeResults(await runInFrames(tabId, "fillProfile", profile, frameId));
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

async function saveRuleFromTab(tab, frameId, scope, frameUrl) {
  // Use the URL of the frame the form lives in: for an iframe the content
  // script matches on the iframe's own host, not the top page's.
  const rawUrl = frameUrl || tab?.url;
  if (!tab?.id || !rawUrl) return;
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return;
  }
  if (!/^https?:$/.test(url.protocol)) {
    sendToTab(tab.id, { type: "SHIV_AUTOFILL_TOAST", message: "Ye page save nahi ho sakta" }, frameId).catch(() => {});
    return;
  }

  let response;
  try {
    response = await sendToTab(tab.id, { type: "SHIV_AUTOFILL_COLLECT_SNAPSHOT" }, frameId);
  } catch {
    return;
  }

  const fields = response?.fields || [];
  if (!fields.length) {
    sendToTab(tab.id, { type: "SHIV_AUTOFILL_TOAST", message: "Pehle form mein kuch bharein, phir save karein" }, frameId).catch(() => {});
    return;
  }

  const now = new Date().toISOString();
  const rule = {
    id: uid(),
    scope, // 'page' | 'site'
    host: url.hostname,
    path: scope === "page" ? url.pathname : "",
    fields,
    overwrite: false,
    createdAt: now,
    updatedAt: now,
  };
  const saved = await upsertRule(rule);
  const total = (saved.find((r) => r.id === rule.id || (r.host === rule.host && r.path === rule.path && r.scope === rule.scope))?.fields || fields).length;

  const label = scope === "page" ? "is page ke liye" : "poori site ke liye";
  sendToTab(tab.id, {
    type: "SHIV_AUTOFILL_TOAST",
    message: `Save ho gaya (${label}) — ${fields.length} field` + (total > fields.length ? ` (kul ${total} saved)` : "") + " ✓" +
      (fields.some((f) => f.kind === "custom") ? ` (${fields.filter((f) => f.kind === "custom").length} dropdown)` : ""),
  }, frameId).catch(() => {});
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;
  const id = String(info.menuItemId);

  if (id === MENU_SAVE_PAGE) {
    saveRuleFromTab(tab, info.frameId, "page", info.frameUrl);
    return;
  }
  if (id === MENU_SAVE_SITE) {
    saveRuleFromTab(tab, info.frameId, "site", info.frameUrl);
    return;
  }
  if (id.startsWith("safill-profile-")) {
    const profileId = id.slice("safill-profile-".length);
    const profiles = await getProfiles();
    const profile = profiles.find((p) => p.id === profileId);
    if (profile) fillTabWithProfile(tab.id, profile, info.frameId);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill_active_profile") return;
  const tab = await getActiveTab();
  if (!tab?.id) return;
  const profile = await getActiveProfile();
  fillTabWithProfile(tab.id, profile);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SHIV_AUTOFILL_FILL_ACTIVE_TAB") {
    (async () => {
      try {
        const tab = await getActiveTab();
        if (!tab?.id) return sendResponse({ ok: false, reason: "no-active-tab" });
        sendResponse(await fillTabWithProfile(tab.id, message.profile));
      } catch (err) {
        sendResponse({ ok: false, reason: String(err) });
      }
    })();
    return true;
  }
  if (message?.type === "SHIV_AUTOFILL_RUN_RULES_ACTIVE_TAB") {
    (async () => {
      try {
        const tab = await getActiveTab();
        if (!tab?.id) return sendResponse({ ok: false, reason: "no-active-tab" });
        sendResponse(mergeResults(await runInFrames(tab.id, "runRules", null)));
      } catch (err) {
        sendResponse({ ok: false, reason: String(err) });
      }
    })();
    return true;
  }
});
