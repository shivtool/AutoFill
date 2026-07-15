// AutoFill — content script
// Two capabilities:
// 1) Legacy profile fill (label/synonym matching) — triggered explicitly.
// 2) Site rules: capture whatever the user has typed on a page as a "rule",
//    then auto-replay those exact values next time the page loads, without
//    touching fields that already have a value (unless overwrite is on).

(() => {
  if (window.__shivAutofillInstalled) return;
  window.__shivAutofillInstalled = true;

  const FILLABLE_SELECTOR =
    'input:not([type="hidden"]):not([type="password"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"]), textarea, select';

  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.disabled) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden") return false;

    const type = (el.getAttribute("type") || "").toLowerCase();
    // Checkboxes, radios, and selects are very often visually hidden and
    // replaced by a custom-styled widget (common with design systems and
    // libraries like Select2 / react-select / Material UI). The underlying
    // element is still functionally real and usually the right thing to
    // set — the custom widget listens for its "change" event — so don't
    // reject these just because they're collapsed to 0x0 or display:none.
    if (el.tagName === "SELECT" || type === "checkbox" || type === "radio") {
      return true;
    }

    if (style.display === "none") return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function labelTextFor(el) {
    if (el.id) {
      const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lbl) return lbl.textContent.trim();
    }
    const parentLabel = el.closest("label");
    if (parentLabel) return parentLabel.textContent.trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const ref = document.getElementById(labelledBy);
      if (ref) return ref.textContent.trim();
    }
    return "";
  }

  function nativeSetValue(el, value) {
    const isTextarea = el instanceof window.HTMLTextAreaElement;
    const proto = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function fillSelect(el, value) {
    let matched = false;
    for (const opt of el.options) {
      if (opt.value === value || opt.textContent.trim() === value) {
        el.value = opt.value;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const norm = (s) => (s || "").toString().toLowerCase().trim();
      const target = norm(value);
      for (const opt of el.options) {
        if (norm(opt.value) === target || norm(opt.textContent) === target) {
          el.value = opt.value;
          matched = true;
          break;
        }
      }
    }
    if (matched) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return matched;
  }

  // --- Stable element identity (used to find "the same field" again later) ---

  function getPositionalPath(el) {
    const path = [];
    let node = el;
    let depth = 0;
    while (node && node.nodeType === 1 && depth < 8) {
      let seg = node.tagName.toLowerCase();
      const type = node.getAttribute && node.getAttribute("type");
      if (type) seg += `[type=${type}]`;
      const parent = node.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === node.tagName);
        if (siblings.length > 1) seg += `:nth(${siblings.indexOf(node) + 1})`;
      }
      path.unshift(seg);
      node = parent;
      depth++;
    }
    return path.join(">");
  }

  function getElementKey(el) {
    const type = (el.getAttribute("type") || "").toLowerCase();
    // Radios/checkboxes in a group share the same name, so the value must be
    // part of the key or every option in the group would collide.
    if (type === "radio") return `radio:${el.name || getPositionalPath(el)}:${el.value}`;
    if (type === "checkbox") return `checkbox:${el.name || getPositionalPath(el)}:${el.value || "on"}`;
    if (el.name) return "name:" + el.name;
    if (el.id) return "id:" + el.id;
    return "path:" + getPositionalPath(el);
  }

  // Is this field still at whatever the page originally rendered it as?
  // This is the correct way to detect "already filled by the site" —
  // checking el.value alone breaks for checkboxes (always has a value
  // attribute even when unchecked) and selects (the first option is rarely
  // blank), which used to make AutoFill think they were always full.
  function isFieldUntouched(el) {
    const type = (el.getAttribute("type") || "").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      return el.checked === el.defaultChecked;
    }
    if (el.tagName === "SELECT") {
      let defaultOpt = null;
      for (const opt of el.options) {
        if (opt.defaultSelected) {
          defaultOpt = opt;
          break;
        }
      }
      if (!defaultOpt && el.options.length) defaultOpt = el.options[0];
      return defaultOpt ? el.value === defaultOpt.value : true;
    }
    return el.value === el.defaultValue;
  }

  function getFillableElements() {
    return Array.from(document.querySelectorAll(FILLABLE_SELECTOR)).filter(isVisible);
  }

  // --- Snapshot: capture whatever the user has currently set ---

  function collectSnapshot() {
    const elements = getFillableElements();
    const fields = [];
    for (const el of elements) {
      const type = (el.getAttribute("type") || "").toLowerCase();
      if (type === "checkbox" || type === "radio") {
        // Only capture boxes the user actually changed from the page's
        // default — otherwise every untouched checkbox on the page would
        // get recorded as "should be unchecked".
        if (el.checked === el.defaultChecked) continue;
        fields.push({
          key: getElementKey(el),
          value: el.checked,
          kind: "boolean",
          label: labelTextFor(el) || el.name || el.value || "",
        });
        continue;
      }
      const value = el.value;
      if (!value) continue;
      fields.push({
        key: getElementKey(el),
        value,
        kind: el.tagName === "SELECT" ? "select" : "text",
        label: labelTextFor(el) || el.getAttribute("placeholder") || el.name || el.id || "",
      });
    }
    return fields;
  }

  // --- Replay: fill a saved rule, skipping fields that already have a value ---

  function applyRuleToPage(rule) {
    if (!rule || !Array.isArray(rule.fields) || !rule.fields.length) {
      return { ok: false, filled: 0, skipped: 0 };
    }
    const elements = getFillableElements();
    const keyMap = new Map();
    for (const el of elements) keyMap.set(getElementKey(el), el);

    let filled = 0;
    let skipped = 0;

    for (const field of rule.fields) {
      const el = keyMap.get(field.key);
      if (!el) continue;
      if (!isFieldUntouched(el) && !rule.overwrite) {
        skipped++;
        continue;
      }
      if (field.kind === "boolean") {
        if (el.checked !== field.value) {
          el.checked = field.value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
        filled++;
      } else if (el.tagName === "SELECT") {
        if (fillSelect(el, field.value)) filled++;
      } else {
        nativeSetValue(el, field.value);
        filled++;
      }
    }
    return { ok: filled > 0, filled, skipped };
  }

  async function autoApplySiteRules(manual = false) {
    let data;
    try {
      data = await chrome.storage.local.get("safill_rules");
    } catch (e) {
      return { ok: false, filled: 0 }; // extension context not ready / page navigating away
    }
    const rules = Array.isArray(data.safill_rules) ? data.safill_rules : [];
    if (!rules.length) return { ok: false, filled: 0, reason: "no-rules" };

    const url = new URL(location.href);
    const matches = rules.filter(
      (r) => r.host === url.hostname && (r.scope === "site" || (r.scope === "page" && r.path === url.pathname))
    );
    if (!matches.length) return { ok: false, filled: 0, reason: "no-match" };

    // Apply site-wide rules first, then page-specific rules so the more
    // specific rule wins when both exist for the same field.
    matches.sort((a, b) => (a.scope === "site" ? 0 : 1) - (b.scope === "site" ? 0 : 1));

    let totalFilled = 0;
    let totalSkipped = 0;
    for (const rule of matches) {
      const result = applyRuleToPage(rule);
      totalFilled += result.filled;
      totalSkipped += result.skipped;
    }
    if (totalFilled > 0) showPageToast(`शिव ने: ${totalFilled} विकल्प भर दिया ✓`);
    else if (manual) showPageToast("Aur koi khali field nahi mili");
    return { ok: totalFilled > 0, filled: totalFilled, skipped: totalSkipped };
  }

  // --- Small on-page toast (no extra permission needed) ---

  function showPageToast(message) {
  let el = document.getElementById("__shiv_autofill_toast");
  if (el) {
    // Reuse the existing toast instead of removing/recreating it —
    // that remove+recreate cycle is what causes the blinking.
    clearTimeout(el._hideTimer);
    el.textContent = message;
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  } else {
    el = document.createElement("div");
    el.id = "__shiv_autofill_toast";
    el.textContent = message;
    Object.assign(el.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: 2147483647,
      background: "#054ffa",
      color: "#ece9e2",
      border: "2px solid rgba(236, 188, 27, 0.97)",
      borderRadius: "10px",
      padding: "9px 14px",
      font: "600 12.5px/1.3 -apple-system, Segoe UI, sans-serif",
      boxShadow: "0 10px 10px -10px rgba(240, 7, 170, 0.89)",
      opacity: "0",
      transition: "opacity .18s ease, transform .18s ease",
      transform: "translateY(6px)",
      pointerEvents: "none",
    });
    document.documentElement.appendChild(el);
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    });
  }

  el._hideTimer = setTimeout(() => {
    el.style.opacity = "0";
    el.style.transform = "translateY(6px)";
    setTimeout(() => el.remove(), 250);
  }, 2400);
}


  // --- Message handling ---

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "SHIV_AUTOFILL_FILL") {
      // Legacy: fill from a manually-built profile using label/synonym matching.
      sendResponse(applyLegacyProfile(message.profile));
      return;
    }
    if (message?.type === "SHIV_AUTOFILL_COLLECT_SNAPSHOT") {
      sendResponse({ fields: collectSnapshot() });
      return;
    }
    if (message?.type === "SHIV_AUTOFILL_TOAST") {
      showPageToast(message.message);
      return;
    }
    if (message?.type === "SHIV_AUTOFILL_RUN_RULES_NOW") {
      autoApplySiteRules(true).then((result) => sendResponse(result));
      return true; // keep the channel open for the async response
    }
  });

  // --- Legacy profile engine (label/synonym based) kept for manual profiles ---

  const SYNONYMS = {
    name: ["fullname", "yourname", "contactname"],
    firstname: ["fname", "givenname", "first"],
    lastname: ["lname", "surname", "familyname", "last"],
    email: ["emailaddress", "mail", "e-mail"],
    phone: ["mobile", "tel", "telephone", "phonenumber", "contactnumber", "mobilenumber"],
    address: ["addr", "street", "streetaddress", "address1"],
    city: ["town", "city"],
    state: ["province", "region", "state"],
    zip: ["zipcode", "postal", "postalcode", "pincode", "pin"],
    country: ["country", "nation"],
    company: ["organization", "org", "companyname", "employer"],
    website: ["url", "site", "homepage"],
    username: ["user", "login", "userid"],
  };

  function normalize(str) {
    return (str || "").toString().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
  }

  function expandTokens(normalizedLabel) {
    const tokens = new Set([normalizedLabel]);
    for (const [key, alts] of Object.entries(SYNONYMS)) {
      if (normalizedLabel === key || alts.includes(normalizedLabel)) {
        tokens.add(key);
        alts.forEach((a) => tokens.add(a));
      }
    }
    return [...tokens];
  }

  function candidateStrings(el) {
    return [
      el.getAttribute("name"),
      el.id,
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
      el.getAttribute("autocomplete"),
      labelTextFor(el),
    ]
      .filter(Boolean)
      .map(normalize)
      .filter((s) => s.length > 0);
  }

  function scoreMatch(fieldTokens, candidate) {
    let best = 0;
    for (const token of fieldTokens) {
      if (!token) continue;
      if (candidate === token) best = Math.max(best, 100);
      else if (candidate.includes(token) || token.includes(candidate)) {
        const ratio = Math.min(token.length, candidate.length) / Math.max(token.length, candidate.length);
        best = Math.max(best, 40 + ratio * 40);
      }
    }
    return best;
  }

  function applyLegacyProfile(profile) {
    if (!profile || !Array.isArray(profile.fields) || !profile.fields.length) {
      return { ok: false, filled: 0, reason: "empty-profile" };
    }
    const elements = getFillableElements();
    if (!elements.length) return { ok: false, filled: 0, reason: "no-fields-on-page" };

    const fields = profile.fields
      .filter((f) => f.label && f.value)
      .map((f) => ({ ...f, tokens: expandTokens(normalize(f.label)) }));
    if (!fields.length) return { ok: false, filled: 0, reason: "empty-profile" };

    let filled = 0;
    for (const el of elements) {
      const candidates = candidateStrings(el);
      if (!candidates.length) continue;
      let bestField = null;
      let bestScore = 0;
      for (const field of fields) {
        for (const candidate of candidates) {
          const score = scoreMatch(field.tokens, candidate);
          if (score > bestScore) {
            bestScore = score;
            bestField = field;
          }
        }
      }
      if (bestField && bestScore >= 55) {
        if (el.tagName === "SELECT") {
          if (fillSelect(el, bestField.value)) filled++;
        } else {
          nativeSetValue(el, bestField.value);
          filled++;
        }
      }
    }
    return { ok: filled > 0, filled, total: elements.length };
  }

  // Run auto-fill on load, with several retries — government/ASP.NET style
  // pages often reload part of the page (postback) when a dropdown changes,
  // which can interrupt a single fill pass, so keep re-checking for a while.
  autoApplySiteRules();
  [400, 900, 1600, 2600, 4000, 6000].forEach((ms) => setTimeout(autoApplySiteRules, ms));

  // --- Keep working without a manual refresh ---
  // 1) Back/forward navigation often restores the page from bfcache, which
  //    does NOT re-run this script — but it does fire "pageshow".
  window.addEventListener("pageshow", () => {
    autoApplySiteRules();
    setTimeout(autoApplySiteRules, 800);
  });

  // 2) Single-page apps change the URL via pushState/replaceState without a
  //    full reload. Watch for that and re-check rules for the new path.
  let lastPath = location.pathname;
  function handlePossibleUrlChange() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    autoApplySiteRules();
    setTimeout(autoApplySiteRules, 800);
  }
  for (const fn of ["pushState", "replaceState"]) {
    const original = history[fn];
    history[fn] = function (...args) {
      const result = original.apply(this, args);
      handlePossibleUrlChange();
      return result;
    };
  }
  window.addEventListener("popstate", handlePossibleUrlChange);

  // 3) Some forms render late (client-side hydration). Watch the DOM for new
  //    fillable elements and give them one fill pass, debounced.
  let mutationTimer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(autoApplySiteRules, 400);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
