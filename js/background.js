// AutoFill — background service worker
import { getProfiles, getActiveProfile, uid, upsertRule } from "./storage.js";

const MENU_ROOT = "safill-root";
const MENU_SAVE_PAGE = "safill-save-page";
const MENU_SAVE_SITE = "safill-save-site";
const MENU_FILL_PARENT = "safill-fill-parent";

async function rebuildContextMenu() {
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
        title: profile.name,
        contexts: ["page", "editable"],
      });
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  rebuildContextMenu();
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.safill_profiles) {
    rebuildContextMenu();
  }
});

// If the content script isn't attached yet (page was open before this
// extension was installed/reloaded), sending a message fails with
// "Could not establish connection". Recover by injecting it on the fly.
async function sendToTab(tabId, message, frameId) {
  const opts = frameId != null ? { frameId } : undefined;
  try {
    return await chrome.tabs.sendMessage(tabId, message, opts);
  } catch (err) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: frameId == null, frameIds: frameId != null ? [frameId] : undefined },
        files: ["js/content.js"],
      });
    } catch {
      throw err; // page is a chrome:// page, store listing, etc. — can't inject there
    }
    return await chrome.tabs.sendMessage(tabId, message, opts);
  }
}

async function fillTabWithProfile(tabId, profile, frameId) {
  if (!profile) return { ok: false, reason: "no-profile" };
  try {
    const result = await sendToTab(tabId, { type: "SHIV_AUTOFILL_FILL", profile }, frameId);
    return result || { ok: true };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

async function saveRuleFromTab(tab, frameId, scope) {
  if (!tab?.id || !tab.url) return;
  let url;
  try {
    url = new URL(tab.url);
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

  const rule = {
    id: uid(),
    scope, // 'page' | 'site'
    host: url.hostname,
    path: scope === "page" ? url.pathname : "",
    fields,
    overwrite: false,
    createdAt: new Date().toISOString(),
  };
  await upsertRule(rule);

  const label = scope === "page" ? "is page ke liye" : "poori site ke liye";
  sendToTab(tab.id, {
    type: "SHIV_AUTOFILL_TOAST",
    message: `Save ho gaya (${label}) — ${fields.length} field ✓`,
  }, frameId).catch(() => {});
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return;

  if (info.menuItemId === MENU_SAVE_PAGE) {
    saveRuleFromTab(tab, info.frameId, "page");
    return;
  }
  if (info.menuItemId === MENU_SAVE_SITE) {
    saveRuleFromTab(tab, info.frameId, "site");
    return;
  }
  if (info.menuItemId.toString().startsWith("safill-profile-")) {
    const profileId = info.menuItemId.toString().replace("safill-profile-", "");
    const profiles = await getProfiles();
    const profile = profiles.find((p) => p.id === profileId);
    if (profile) fillTabWithProfile(tab.id, profile, info.frameId);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill_active_profile") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  const profile = await getActiveProfile();
  fillTabWithProfile(tab.id, profile);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SHIV_AUTOFILL_FILL_ACTIVE_TAB") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        sendResponse({ ok: false, reason: "no-active-tab" });
        return;
      }
      const result = await fillTabWithProfile(tab.id, message.profile);
      sendResponse(result);
    })();
    return true;
  }
  if (message?.type === "SHIV_AUTOFILL_RUN_RULES_ACTIVE_TAB") {
    (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        sendResponse({ ok: false, reason: "no-active-tab" });
        return;
      }
      try {
        const result = await sendToTab(tab.id, { type: "SHIV_AUTOFILL_RUN_RULES_NOW" });
        sendResponse(result || { ok: false });
      } catch (err) {
        sendResponse({ ok: false, reason: String(err) });
      }
    })();
    return true;
  }
});
