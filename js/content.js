// AutoFill — content script
// Two capabilities:
// 1) Legacy profile fill (label/synonym matching) — triggered explicitly.
// 2) Site rules: capture whatever the user has typed on a page as a "rule",
//    then auto-replay those exact values next time the page loads, without
//    touching fields that already have a value (unless overwrite is on).

(() => {
  if (window.__shivAutofillInstalled) return;
  window.__shivAutofillInstalled = true;

<<<<<<< HEAD
  const TOAST_ID = "__shiv_autofill_toast";
  const STARTUP_WINDOW_MS = 7000;

  const FILLABLE_SELECTOR =
    'input:not([type="hidden"]):not([type="password"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"]), textarea, select';

  // Never capture or fill payment-card / OTP style fields.
  const SENSITIVE_AUTOCOMPLETE = /(^|\s)(cc-[a-z-]+|one-time-code|current-password|new-password)(\s|$)/i;

  // ---------------------------------------------------------------- helpers

  function inputType(el) {
    return (el.getAttribute("type") || "").toLowerCase();
  }

  function isCheckable(el) {
    const t = inputType(el);
    return el.tagName === "INPUT" && (t === "checkbox" || t === "radio");
  }

  function isSensitive(el) {
    return SENSITIVE_AUTOCOMPLETE.test(el.getAttribute("autocomplete") || "");
  }

  // read-only text inputs must never be written to (checkbox/radio/select
  // have no meaningful readOnly state).
  function isLocked(el) {
    if (isCheckable(el) || el.tagName === "SELECT") return false;
    return !!el.readOnly;
  }

=======
  const FILLABLE_SELECTOR =
    'input:not([type="hidden"]):not([type="password"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"]), textarea, select';

>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
  function isVisible(el) {
    if (!(el instanceof HTMLElement)) return false;
    if (el.disabled) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden") return false;

<<<<<<< HEAD
    // Checkboxes, radios, and selects are very often visually hidden and
    // replaced by a custom-styled widget (Select2 / react-select / MUI ...).
    // The underlying element is still the right thing to set.
    if (el.tagName === "SELECT" || isCheckable(el)) return true;
=======
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
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832

    if (style.display === "none") return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    return true;
  }

  function labelTextFor(el) {
<<<<<<< HEAD
    if (el.labels && el.labels.length) {
      const text = Array.from(el.labels)
        .map((l) => l.textContent.trim())
        .filter(Boolean)
        .join(" ");
      if (text) return text;
    }
    const parentLabel = el.closest("label");
    if (parentLabel) return parentLabel.textContent.trim();
    // aria-labelledby may hold several space-separated ids
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id))
        .filter(Boolean)
        .map((n) => n.textContent.trim())
        .filter(Boolean)
        .join(" ");
      if (text) return text;
=======
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
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
    }
    return "";
  }

<<<<<<< HEAD
  function fireInputEvents(el) {
=======
  function nativeSetValue(el, value) {
    const isTextarea = el instanceof window.HTMLTextAreaElement;
    const proto = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && descriptor.set) {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

<<<<<<< HEAD
  // All setters return "changed" | "same" | "fail".

  function nativeSetValue(el, value) {
    value = value == null ? "" : String(value);
    if (el.value === value) return "same";
    const isTextarea = el instanceof window.HTMLTextAreaElement;
    const proto = isTextarea ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, "value");
    if (descriptor && descriptor.set) descriptor.set.call(el, value);
    else el.value = value;
    // <input type=date|time|number|color|...> silently drops values in the
    // wrong format. Don't report success (or fire events) when that happens.
    if (el.value === "" && value !== "") return "fail";
    fireInputEvents(el);
    return "changed";
  }

  function normText(s) {
    return (s || "").toString().toLowerCase().trim();
  }

  function fillSelect(el, value, text, byCode) {
    const options = Array.from(el.options);
    const find = (wanted, wantedText) => {
      const w = String(wanted == null ? "" : wanted);
      if (byCode && isCodeOnly(w)) {
        const c = options.find((o) => !o.disabled && codeOf(o.textContent) === normOpt(w));
        if (c) return c;
      }
      let opt = options.find((o) => !o.disabled && (o.value === w || o.textContent.trim() === w));
      if (!opt) {
        const t = normText(w);
        opt = options.find((o) => !o.disabled && (normText(o.value) === t || normText(o.textContent) === t));
      }
      // Dependent lists (Stream -> Subject) are often rebuilt by the page with
      // different option values each time; the visible text is the stable part.
      if (!opt && wantedText) {
        opt = options.find((o) => !o.disabled && o.value !== "" && sameOption(o.textContent, wantedText));
      }
      return opt || null;
    };

    if (el.multiple) {
      const vals = Array.isArray(value) ? value : [value];
      const texts = Array.isArray(text) ? text : [];
      const wanted = vals.map((v, i) => find(v, texts[i])).filter(Boolean);
      if (!wanted.length) return "fail";
      const set = new Set(wanted);
      const same = options.every((o) => o.selected === set.has(o));
      if (same) return "same";
      options.forEach((o) => { o.selected = set.has(o); });
      fireInputEvents(el);
      return "changed";
    }

    const opt = find(Array.isArray(value) ? value[0] : value, Array.isArray(text) ? text[0] : text);
    if (!opt) return "fail";
    if (el.selectedIndex === opt.index) return "same";
    el.selectedIndex = opt.index;
    fireInputEvents(el);
    return "changed";
  }

  // Frameworks (React etc.) track checkbox/radio state through the real
  // click event; setting .checked + a synthetic change event is ignored.
  function setChecked(el, desired) {
    if (el.checked === desired) return "same";
    if (inputType(el) === "radio" && !desired) return "same"; // radios can't be unchecked directly
    el.click();
    if (el.checked !== desired) {
      // page cancelled the click — force it
      el.checked = desired;
      fireInputEvents(el);
    }
    return el.checked === desired ? "changed" : "fail";
=======
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
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
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
<<<<<<< HEAD
    const type = inputType(el);
=======
    const type = (el.getAttribute("type") || "").toLowerCase();
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
    // Radios/checkboxes in a group share the same name, so the value must be
    // part of the key or every option in the group would collide.
    if (type === "radio") return `radio:${el.name || getPositionalPath(el)}:${el.value}`;
    if (type === "checkbox") return `checkbox:${el.name || getPositionalPath(el)}:${el.value || "on"}`;
    if (el.name) return "name:" + el.name;
    if (el.id) return "id:" + el.id;
    return "path:" + getPositionalPath(el);
  }

<<<<<<< HEAD
  // Fields that share a name (items[], repeated rows, same id twice) used to
  // collapse into one key, so only the last one was ever restored. The first
  // occurrence keeps the plain key (old saved rules still match); later ones
  // get "#2", "#3"... Counting includes hidden elements so indexes stay stable.
  function keyedElements(ctx, includeHidden) {
    const counts = new Map();
    const out = [];
    for (const el of document.querySelectorAll(FILLABLE_SELECTOR)) {
      // inner search/hidden inputs of a custom dropdown are part of that widget
      if (ctx && ctx.roots.some((r) => r.contains(el))) continue;
      const base = getElementKey(el);
      const n = (counts.get(base) || 0) + 1;
      counts.set(base, n);
      if (!isVisible(el)) {
        // Saving: a field inside a hidden tab / collapsed step still holds what the user typed.
        if (!(includeHidden && !el.disabled)) continue;
      }
      out.push({ el, key: n === 1 ? base : `${base}#${n}` });
    }
    return out;
=======
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
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
  }

  function getFillableElements() {
    return Array.from(document.querySelectorAll(FILLABLE_SELECTOR)).filter(isVisible);
  }

<<<<<<< HEAD
  // type=range / type=color always have a non-empty value even with no
  // value attribute, so `el.value === el.defaultValue` is never true for them.
  // Ask the browser what the sanitized default would be.
  function sanitizedDefault(el) {
    const type = inputType(el);
    if (type !== "range" && type !== "color") return el.defaultValue;
    const probe = document.createElement("input");
    probe.type = type;
    for (const attr of ["min", "max", "step"]) {
      if (el.hasAttribute(attr)) probe.setAttribute(attr, el.getAttribute(attr));
    }
    probe.setAttribute("value", el.defaultValue);
    return probe.value;
  }

  // Is this field still at whatever the page originally rendered it as?
  function isFieldUntouched(el) {
    if (isCheckable(el)) return el.checked === el.defaultChecked;
    if (el.tagName === "SELECT") {
      const opts = Array.from(el.options);
      if (el.multiple) return opts.every((o) => o.selected === o.defaultSelected);
      const defaults = opts.filter((o) => o.defaultSelected);
      let def = defaults.length ? defaults[defaults.length - 1] : null;
      // With no `selected` attribute a dropdown shows its first enabled option.
      if (!def && !(el.size > 1)) def = opts.find((o) => !o.disabled) || null;
      return def ? el.selectedIndex === def.index : el.selectedIndex === -1;
    }
    return el.value === sanitizedDefault(el);
  }


  // =====================================================================
  //  CUSTOM (non-native) DROPDOWNS
  //  Angular ng-select / Material mat-select, React-Select, MUI, Ant Design,
  //  Select2-style widgets and hand-made "div + ul/li" selects do not use a
  //  <select>, so they were invisible to the code above. They are detected
  //  here, saved by the text they display, and replayed by really opening the
  //  list, finding the option (scrolling / typing / geometry fallbacks) and
  //  clicking it with a full pointer-event sequence.
  // =====================================================================

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, timeout = 500, step = 40) {
    const end = Date.now() + timeout;
    for (;;) {
      let v = false;
      try { v = fn(); } catch (e) { /* keep polling */ }
      if (v) return true;
      if (Date.now() >= end) return false;
      await sleep(step);
    }
  }

  const STRONG_SEEDS = [
    '[role="combobox"]', '[aria-haspopup="listbox"]',
    "ng-select", "mat-select", ".ng-select", ".ant-select", ".mat-select", ".mat-mdc-select",
    ".MuiSelect-root", ".MuiAutocomplete-root", ".p-dropdown", ".p-multiselect", ".vs__dropdown-toggle",
    ".choices", ".chosen-container", ".multiselect", ".selectize-control", ".k-dropdown", ".k-picker",
    ".el-select", ".v-select", ".q-select",
    '[class*="select__control"]', '[class*="css-"][class*="-control"]',
  ].join(",");

  const ROOT_SELECTORS = [
    "ng-select", "mat-select", ".ng-select", ".ant-select", ".mat-select", ".mat-mdc-select",
    ".MuiSelect-root", ".MuiAutocomplete-root", ".p-dropdown", ".p-multiselect", ".vs__dropdown-toggle",
    ".choices", ".chosen-container", ".multiselect", ".selectize-control", ".k-dropdown", ".k-picker",
    ".el-select", ".v-select", ".q-select",
    '[class*="select__control"]', '[class*="css-"][class*="-control"]',
  ].join(",");

  // Unknown libraries: anything whose class/aria hints at a dropdown, accepted
  // only if it sits in a labelled single-field container (see buildCustomContext).
  const WEAK_SEEDS = '[class*="select"],[class*="dropdown"],[class*="Dropdown"],[class*="combo"],[aria-expanded]';

  const OPTION_SELECTORS = [
    '[role="option"]', ".ng-option", "mat-option", ".mat-option", ".mat-mdc-option",
    ".select2-results__option", ".ant-select-item-option", ".MuiMenuItem-root", ".MuiAutocomplete-option",
    ".p-dropdown-item", ".p-multiselect-item", ".vs__dropdown-option", ".choices__item--choice",
    ".chosen-results li", ".dropdown-item", ".el-select-dropdown__item", ".k-list-item",
    '[class*="select__option"]', '[class*="option"]:not([class*="options"]):not([class*="optional"])',
    '[role="listbox"] li', ".dropdown-menu li",
  ].join(",");

  const SINGLE_VALUE_SEL = [
    ".ng-value-label", ".mat-mdc-select-value-text", ".mat-select-value-text", ".select2-selection__rendered",
    ".ant-select-selection-item", '[class*="single-value"]', '[class*="singleValue"]', '[class*="selected-value"]',
    '[class*="selectedValue"]', ".MuiSelect-select", ".p-dropdown-label", ".vs__selected",
    ".choices__item--selectable", ".k-input-value-text", '[class*="multi-value__label"]',
    '[class*="multiValue"] [class*="label"]', ".mat-chip", ".mat-mdc-chip", ".select2-selection__choice",
    ".p-multiselect-token-label",
  ].join(",");

  const NOISE_SEL =
    'svg,i,script,style,input,textarea,[class*="icon"],[class*="arrow"],[class*="caret"],[class*="chevron"],' +
    '[class*="clear"],[class*="indicator"],[aria-hidden="true"],[class*="placeholder"],[class*="Placeholder"],' +
    '[role="listbox"],[class*="menu"],[class*="options"]';

  const PLACEHOLDER_RE =
    /^[-–—\s]*((please\s+)?(select|choose|pick)(\b.{0,40})?|(कृपया\s+)?(चुनें|चुने|चयन)(\b.{0,40})?)[-–—\s.…]*$/i;

  function normOpt(s) {
    return String(s == null ? "" : s)
      .normalize("NFKC")
      .replace(/[\u200b-\u200d\ufeff]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
  // "MATHEMATICS(131)" and "MATHEMATICS" are the same option (the number is a code).
  function stripCode(s) {
    return normOpt(s).replace(/\s*[(\[]\s*\d+\s*[)\]]\s*$/, "");
  }
  // Subject / stream codes: "HINDI(101)" -> 101, "1-Arts Stream" -> 1
  function codeOf(s) {
    const t = normOpt(s);
    const m = t.match(/\(\s*(\d{1,4})\s*\)\s*$/) || t.match(/^(\d{1,4})\s*[-–:]/);
    return m ? m[1] : "";
  }
  function isCodeOnly(s) { return /^\d{2,4}$/.test(normOpt(s)); }
  function sameOption(a, b) {
    if (normOpt(a) === normOpt(b) || stripCode(a) === stripCode(b)) return true;
    if (isCodeOnly(b) && codeOf(a) === normOpt(b)) return true;
    if (isCodeOnly(a) && codeOf(b) === normOpt(a)) return true;
    return false;
  }
  function isPlaceholderText(t) {
    const n = normOpt(t).replace(/[×✕✖▼▲▾▴⌄˅⌃▽△]+/g, "").trim();
    return n === "" || n === "-" || n === "--" || PLACEHOLDER_RE.test(n);
  }
  function cleanGlyphs(t) {
    return String(t || "").replace(/\s+/g, " ").replace(/[\s×✕✖▼▲▾▴⌄˅⌃▽△]+$/u, "").replace(/^[\s×✕✖]+/u, "").trim();
  }

  // Rendered (not just present in the DOM): walks ancestors, so it also works
  // for display:none parents and for engines without layout.
  function isShown(el) {
    // cheap test first (one layout read), ancestor walk only for boxes that have a size
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hidden) return false;
      const st = window.getComputedStyle(n);
      if (st.display === "none" || st.visibility === "hidden") return false;
    }
    return true;
  }

  function isDisabledWidget(root) {
    if (root.getAttribute("aria-disabled") === "true" || root.hasAttribute("disabled")) return true;
    return /(^|[\s_-])(disabled|readonly)([\s_-]|$)/i.test(root.className && root.className.baseVal === undefined ? root.className : "");
  }

  function collectCandidateRoots() {
    const found = new Map(); // root -> { root, seed, strong }
    const add = (seed, strong) => {
      if (seed.tagName === "SELECT" || seed.tagName === "OPTION" || seed.tagName === "LABEL") return;
      if (seed.closest('[role="listbox"],[role="option"],[role="menu"],[role="menuitem"]')) return;
      let root = seed.closest(ROOT_SELECTORS) || seed;
      if (root.tagName === "INPUT" || root.tagName === "TEXTAREA") return; // plain text field — handled natively
      if (root.matches(".select2-container") || root.closest(".select2-container")) return; // real <select> underneath
      if (root.tagName === "LI" || root.closest("li[role=option]")) return;
      const prev = found.get(root);
      if (prev) { if (strong) prev.strong = true; return; }
      found.set(root, { root, seed, strong });
    };
    document.querySelectorAll(STRONG_SEEDS).forEach((el) => add(el, true));
    document.querySelectorAll(WEAK_SEEDS).forEach((el) => {
      if (el.tagName === "BODY" || el.tagName === "HTML" || el.tagName === "FORM") return;
      if (el.tagName === "LI") return;
      add(el, false);
    });

    const all = [...found.values()].filter((c) => isShown(c.root) && !isDisabledWidget(c.root));

    // Weak candidates must look like a compact control (not a whole form row).
    const strongRoots = all.filter((c) => c.strong).map((c) => c.root);
    let weak = all.filter((c) => !c.strong).filter((c) => {
      const r = c.root.getBoundingClientRect();
      if (r.height < 18 || r.height > 100 || r.width < 60) return false;
      if (c.root.querySelector("label,legend")) return false;
      if (strongRoots.some((s) => s === c.root || s.contains(c.root) || c.root.contains(s))) return false;
      return true;
    });
    // keep the outermost compact control: .custom-select > .selected > span
    const weakRoots = new Set(weak.map((c) => c.root));
    weak = weak.filter((c) => {
      for (let n = c.root.parentElement; n; n = n.parentElement) if (weakRoots.has(n)) return false;
      return true;
    });
    // strong ones: if nested, keep the innermost
    const strong = all.filter((c) => c.strong).filter(
      (c) => !all.some((o) => o !== c && o.strong && c.root.contains(o.root))
    );
    return [...strong, ...weak];
  }

  function ariaLabelOf(el) {
    const al = el.getAttribute && el.getAttribute("aria-label");
    if (al && !isPlaceholderText(al)) return al;
    const lb = el.getAttribute && el.getAttribute("aria-labelledby");
    if (lb) {
      const first = document.getElementById(lb.trim().split(/\s+/)[0]);
      if (first && first.textContent.trim()) return first.textContent;
    }
    if (el.id) {
      const lbl = Array.from(document.getElementsByTagName("label")).find((l) => l.htmlFor === el.id);
      if (lbl && lbl.textContent.trim()) return lbl.textContent;
    }
    return "";
  }

  function cleanLabel(t) {
    return normOpt(t).replace(/[*:：]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function ownText(el) {
    let t = "";
    for (const n of el.childNodes) if (n.nodeType === 3) t += n.nodeValue;
    return t.trim();
  }

  // Nearest preceding label text inside the smallest container that holds just
  // this one control — works for <label>, "form-label" divs, plain <span>s.
  function customLabelText(cand, ctx) {
    const { root, seed } = cand;
    for (const el of [seed, root]) {
      const t = cleanLabel(ariaLabelOf(el));
      if (t) return t;
    }
    // How many controls sit inside a node. Counted once per scan (walk up from
    // every control) instead of testing every control against every ancestor.
    const controlsIn = (node) => {
      if (!ctx._cnt) {
        const m = new Map();
        const add = (el) => { for (let n = el; n; n = n.parentElement) m.set(n, (m.get(n) || 0) + 1); };
        ctx.roots.forEach(add);
        ctx.natives.forEach(add);
        ctx._cnt = m;
      }
      return ctx._cnt.get(node) || 0;
    };
    let node = root;
    for (let depth = 0; depth < 6 && node.parentElement; depth++) {
      node = node.parentElement;
      if (controlsIn(node) > 1) break;
      const els = node.querySelectorAll("label,legend,[class*='label'],[class*='Label'],span,p,div,b,strong,h1,h2,h3,h4,h5,h6");
      for (const el of els) {
        if (el === root || root.contains(el) || el.contains(root)) continue;
        if (!(root.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING)) continue;
        const text = el.tagName === "LABEL" || el.tagName === "LEGEND" ? el.textContent : ownText(el);
        const t = cleanLabel(text);
        if (!t || t.length > 80 || isPlaceholderText(t)) continue;
        return t;
      }
    }
    return "";
  }

  const AUTO_ID_RE = /(\d{2,}|:r|react-select|mat-|mui-|ng-|cdk-|select2-|ember|headlessui|rc_select|radix)/i;

  function customBaseKey(cand) {
    const { root, seed, label } = cand;
    const fcn = root.closest("[formcontrolname]");
    if (fcn) return "csn:" + fcn.getAttribute("formcontrolname");
    const hidden = root.querySelector("input[type=hidden][name]");
    const name = root.getAttribute("name") || seed.getAttribute("name") || (hidden && hidden.getAttribute("name"));
    if (name) return "csn:" + name;
    const id = root.id || (seed !== root ? seed.id : "");
    if (id && !AUTO_ID_RE.test(id)) return "csi:" + id;
    if (label) return "cs:" + label;
    return "csp:" + getPositionalPath(root);
  }

  function buildCustomContext() {
    let cands = collectCandidateRoots();
    const fillable = getFillableElements();
    // a "weak" wrapper that contains a real editable control is just a form row
    cands = cands.filter((c) => c.strong || !fillable.some((n) => c.root.contains(n)));
    const roots = cands.map((c) => c.root);
    const natives = fillable.filter((el) => !roots.some((r) => r.contains(el)));
    const ctx = { roots, natives, widgets: [] };
    const counts = new Map();
    for (const c of cands) {
      c.label = customLabelText(c, ctx);
      if (!c.strong && !c.label) continue; // unlabeled hint-only match: too risky (nav menus etc.)
      const base = customBaseKey(c);
      const n = (counts.get(base) || 0) + 1;
      counts.set(base, n);
      c.key = n === 1 ? base : `${base}#${n}`;
      ctx.widgets.push(c);
    }
    return ctx;
  }

  function textOfClone(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll(NOISE_SEL).forEach((n) => n.remove());
    return cleanGlyphs(clone.textContent);
  }

  // What does this widget currently show? -> { values: [...], placeholder }
  function readCustomValue(root) {
    const matched = Array.from(root.querySelectorAll(SINGLE_VALUE_SEL));
    if (root.matches(SINGLE_VALUE_SEL)) matched.unshift(root);
    const outer = matched.filter((el) => !matched.some((o) => o !== el && o.contains(el)));
    const values = [];
    for (const el of outer) {
      const t = cleanGlyphs(textOfClone(el) || el.textContent);
      if (t && !isPlaceholderText(t) && !values.some((v) => normOpt(v) === normOpt(t))) values.push(t);
    }
    if (values.length) return { values, placeholder: false };
    if (outer.length) return { values: [], placeholder: true };
    const t = textOfClone(root);
    if (!t || isPlaceholderText(t)) return { values: [], placeholder: true };
    return { values: [t], placeholder: false };
  }

  // ---- finding options ----

  function queryOptions() {
    const out = [];
    for (const el of document.querySelectorAll(OPTION_SELECTORS)) {
      if (el.tagName === "OPTION") continue;
      if (!isShown(el)) continue;
      out.push(el);
    }
    return out;
  }

  function optText(el) {
    return cleanGlyphs((el.innerText !== undefined ? el.innerText : el.textContent) || "");
  }

  function distanceTo(rootRect, el) {
    const r = el.getBoundingClientRect();
    return Math.min(Math.abs(r.top - rootRect.bottom), Math.abs(r.bottom - rootRect.top));
  }

  function pickBest(options, wanted, root, allowLoose) {
    const rootRect = root.getBoundingClientRect();
    const scored = [];
    const w = normOpt(wanted);
    const ws = stripCode(wanted);
    for (const el of options) {
      if (el === root) continue;
      const t = optText(el);
      if (!t) continue;
      const n = normOpt(t);
      let tier = 0;
      if (n === w) tier = 3;
      else if (stripCode(t) === ws) tier = 2;
      else if (isCodeOnly(wanted) && codeOf(t) === w) tier = 3;
      if (tier) scored.push({ el, tier, d: distanceTo(rootRect, el), len: n.length });
    }
    if (!scored.length) {
      // Loose ("option text contains the wanted text") is only allowed as a
      // final fallback and only when it is unambiguous. It must never run
      // while we are still scrolling: "ITEM 1" would win over a not-yet-
      // rendered "ITEM 100".
      if (!allowLoose || ws.length < 4) return null;
      const loose = options.filter((el) => normOpt(optText(el)).includes(ws));
      return loose.length === 1 ? loose[0] : null;
    }
    scored.sort((a, b) => b.tier - a.tier || a.d - b.d || a.len - b.len);
    return scored[0].el;
  }

  // Last resort for libraries with unknown option markup: any rendered element
  // near the control whose own text equals the wanted text.
  function findOptionGeometric(root, wanted) {
    const rr = root.getBoundingClientRect();
    const cands = [];
    let scanned = 0;
    for (const el of document.querySelectorAll("li,div,span,a,p,button,td,label,mat-option")) {
      if (++scanned > 6000) break;
      if (el === root || el.contains(root)) continue; // the list is often rendered inside the wrapper itself
      const own = el.children.length === 0 ? el.textContent : ownText(el);
      if (!own || own.length > 200) continue;
      if (!sameOption(own, wanted)) continue;
      if (!isShown(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right < rr.left - 60 || r.left > rr.right + 60) continue;
      if (r.top < rr.top - 700 || r.top > rr.bottom + 700) continue;
      cands.push(el);
    }
    return pickBest(cands, wanted, root, true);
  }

  function scrollParent(el) {
    for (let n = el.parentElement, i = 0; n && i < 10; n = n.parentElement, i++) {
      if (n.scrollHeight > n.clientHeight + 4) {
        const oy = window.getComputedStyle(n).overflowY;
        if (oy === "auto" || oy === "scroll" || oy === "overlay" || n.clientHeight > 0) return n;
      }
    }
    return null;
  }

  async function findOptionWithScroll(root, wanted) {
    let opt = pickBest(queryOptions(), wanted, root);
    if (opt) return opt;
    const first = queryOptions()[0];
    const box = first && scrollParent(first);
    if (!box) return pickBest(queryOptions(), wanted, root, true);
    box.scrollTop = 0;
    for (let i = 0; i < 120; i++) {
      await sleep(30);
      opt = pickBest(queryOptions(), wanted, root);
      if (opt) return opt;
      const prev = box.scrollTop;
      box.scrollTop = prev + Math.max(40, box.clientHeight * 0.8);
      box.dispatchEvent(new Event("scroll", { bubbles: true }));
      if (box.scrollTop === prev) break; // bottom reached
    }
    return pickBest(queryOptions(), wanted, root, true);
  }

  async function findOptionBySearch(cand, wanted) {
    const { root, seed } = cand;
    const input =
      seed.tagName === "INPUT" && !seed.readOnly ? seed
      : root.querySelector("input:not([type=hidden]):not([readonly]):not([type=checkbox]):not([type=radio])");
    if (!input) return null;
    input.focus && input.focus();
    const proto = window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(input, stripCode(wanted).replace(/\s+$/, ""));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
    await waitFor(() => pickBest(queryOptions(), wanted, root, true), 700);
    return pickBest(queryOptions(), wanted, root, true);
  }

  function searchInputOf(cand) {
    const { root, seed } = cand;
    return seed.tagName === "INPUT" && !seed.readOnly ? seed
      : root.querySelector("input:not([type=hidden]):not([readonly]):not([type=checkbox]):not([type=radio])");
  }
  function clearSearch(cand) {
    const input = searchInputOf(cand);
    if (!input || !input.value) return;
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // ---- real-looking pointer / keyboard input ----

  function pointerInit(el, extra) {
    const r = el.getBoundingClientRect();
    return Object.assign(
      { bubbles: true, cancelable: true, composed: true, view: window, button: 0,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 },
      extra || {}
    );
  }
  function fire(el, type, init) {
    const Ctor = type.startsWith("pointer") && window.PointerEvent ? window.PointerEvent : window.MouseEvent;
    el.dispatchEvent(new Ctor(type, init));
  }
  function clickSequence(el) {
    const down = pointerInit(el, { buttons: 1 });
    const up = pointerInit(el, { buttons: 0 });
    fire(el, "pointerover", up); fire(el, "mouseover", up);
    fire(el, "pointermove", up); fire(el, "mousemove", up);
    fire(el, "pointerdown", down); fire(el, "mousedown", down);
    const focusable = el.closest && el.closest("input,button,[tabindex]");
    if (focusable && focusable.focus) { try { focusable.focus({ preventScroll: true }); } catch (e) {} }
    fire(el, "pointerup", up); fire(el, "mouseup", up);
    fire(el, "click", up);
  }
  function pressKey(el, key, code) {
    const init = { bubbles: true, cancelable: true, key, code: code || key, keyCode: { ArrowDown: 40, Enter: 13, Escape: 27, " ": 32 }[key] };
    el.dispatchEvent(new KeyboardEvent("keydown", init));
    el.dispatchEvent(new KeyboardEvent("keyup", init));
  }
  function hitTarget(root) {
    try {
      const r = root.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (hit && root.contains(hit)) return hit;
    } catch (e) { /* no layout engine */ }
    return root;
  }

  // Containers a dropdown list typically lives in, for libraries whose option
  // markup we don't know. A NEW rendered one near the control means "open".
  const PANEL_SEL =
    'ul,ol,[role="listbox"],[role="menu"],[class*="menu"],[class*="option"],[class*="list"],[class*="panel"],[class*="dropdown"],[class*="Dropdown"],[class*="popup"],[class*="popper"],[class*="overlay"]';

  function openSnapshot() {
    return {
      opts: new Set(queryOptions()),
      panels: new Set(Array.from(document.querySelectorAll(PANEL_SEL)).filter(isShown)),
    };
  }

  function nearControl(root, el) {
    const rr = root.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return !(r.right < rr.left - 80 || r.left > rr.right + 80 || r.top > rr.bottom + 800 || r.bottom < rr.top - 800);
  }

  function hasNewOpen(snap, cand) {
    const { root, seed } = cand;
    for (const o of queryOptions()) if (!snap.opts.has(o)) return true;
    if (root.getAttribute("aria-expanded") === "true" || seed.getAttribute("aria-expanded") === "true") return true;
    // The full panel scan is expensive on big pages: do it at most every 150ms.
    const now = Date.now();
    if (panelScan.snap === snap && panelScan.root === root && now - panelScan.at < 150) return panelScan.res;
    let res = false;
    for (const el of document.querySelectorAll(PANEL_SEL)) {
      if (snap.panels.has(el) || el === root || el.contains(root)) continue;
      if (!el.textContent.trim() || !isShown(el)) continue;
      if (nearControl(root, el)) { res = true; break; }
    }
    panelScan.snap = snap; panelScan.root = root; panelScan.at = Date.now(); panelScan.res = res;
    return res;
  }
  const panelScan = { snap: null, root: null, at: 0, res: false };

  async function openDropdown(cand) {
    const { root, seed } = cand;
    const snap = openSnapshot();
    const isOpen = () => hasNewOpen(snap, cand);
    const kbTarget = seed.tagName === "INPUT" ? seed : root;

    clickSequence(hitTarget(root));
    if (await waitFor(isOpen, 500)) return true;

    for (const k of ["ArrowDown", " ", "Enter"]) {
      pressKey(kbTarget, k);
      if (await waitFor(isOpen, 220)) return true;
    }
    clickSequence(hitTarget(root)); // some widgets toggle: the first click may have closed a lazily opened list
    return await waitFor(isOpen, 450);
  }

  async function closeDropdown(cand, snap) {
    const stillOpen = () => (snap ? hasNewOpen(snap, cand) : queryOptions().length > 0);
    if (!stillOpen()) return;
    const target = document.activeElement && document.activeElement !== document.body ? document.activeElement : cand.root;
    pressKey(target, "Escape");
    if (await waitFor(() => !stillOpen(), 150)) return;
    try { document.activeElement && document.activeElement.blur && document.activeElement.blur(); } catch (e) {}
    if (await waitFor(() => !stillOpen(), 120)) return;
    clickSequence(document.body);
    if (await waitFor(() => !stillOpen(), 250)) return;
    // hand-made toggle widgets only close when their own control is clicked again
    clickSequence(hitTarget(cand.root));
    await waitFor(() => !stillOpen(), 250);
  }

  async function selectCustomOption(cand, text, manual) {
    const { root } = cand;
    if (queryOptions().length) {
      if (manual || Date.now() < startupUntil || Date.now() - lastFieldChange < 15000) {
        // The list we just used (previous dropdown) is usually still playing its
        // closing animation. Wait for it instead of giving up with "busy".
        await waitFor(() => queryOptions().length === 0, 250); // then carry on regardless
      } else {
        return "busy"; // somebody (the user?) has a list open long after page load
      }
    }
    try { root.scrollIntoView({ block: "center", inline: "nearest" }); } catch (e) {}
    await sleep(30);

    const tm = { t0: performance.now(), how: "-" };
    const snap = openSnapshot();
    const opened = await openDropdown(cand);
    tm.open = performance.now();

    let opt = null;
    if (opened) {
      opt = pickBest(queryOptions(), text, root);
      if (opt) tm.how = "visible";
      // Typing the value into the widget's own search box is far faster than
      // scrolling through a long list (and does not depend on list length).
      if (!opt && searchInputOf(cand)) {
        opt = await findOptionBySearch(cand, text);
        if (opt) tm.how = "search"; else clearSearch(cand);
      }
      if (!opt) {
        opt = await findOptionWithScroll(root, text);
        if (!opt) opt = findOptionGeometric(root, text);
        if (opt) tm.how = "scroll";
      }
      if (!opt) {
        // A dependent list (Subject after Stream) is often empty / "Loading..." /
        // "No items found" for a moment while the page fetches its options.
        const patient = Date.now() < startupUntil || Date.now() - lastFieldChange < 15000;
        const end = Date.now() + (patient ? 4500 : 800);
        let n = 0;
        while (!opt && Date.now() < end && root.isConnected) {
          await sleep(150);
          opt = pickBest(queryOptions(), text, root) || findOptionGeometric(root, text);
          if (!opt && ++n % 6 === 0) opt = await findOptionWithScroll(root, text); // now and then: full scroll search
        }
        if (opt) tm.how = "waited";
      }
    }
    tm.found = performance.now();
    // Search-as-you-type widgets show nothing until text is entered, so an
    // "empty" list is not a failure — try typing before giving up.
    if (!opt && opened && root.isConnected) opt = findOptionGeometric(root, text);
    if (!opt) {
      console.log(`[AutoFill] ${cand.key} "${text}": option NOT found after ${Math.round(performance.now() - tm.t0)}ms (open ${Math.round(tm.open - tm.t0)}, search/scroll ${Math.round(performance.now() - tm.open)})`);
      await closeDropdown(cand, snap);
      return "fail";
    }
    try { opt.scrollIntoView({ block: "nearest" }); } catch (e) {}
    clickSequence(opt);

    const matches = () => readCustomValue(root).values.some((v) => sameOption(v, text));
    const ok = await waitFor(matches, 900);
    tm.click = performance.now();
    await closeDropdown(cand, snap);
    const r = (n) => Math.round(n);
    console.log(`[AutoFill] ${cand.key} "${text}": ${ok ? "ok" : "?"} ${r(performance.now() - tm.t0)}ms ` +
      `(open ${r(tm.open - tm.t0)}, find ${r(tm.found - tm.open)} via ${tm.how}, click ${r(tm.click - tm.found)}, close ${r(performance.now() - tm.click)})`);
    if (ok) return "changed";
    // The display element may be one we can't read; if the list closed by itself
    // after the click and the control no longer shows a placeholder, it worked.
    const now = readCustomValue(root);
    return !hasNewOpen(snap, cand) && !now.placeholder ? "changed" : "fail";
  }

  async function fillCustom(cand, wantedList, overwrite, manual) {
    const { root } = cand;
    if (!root.isConnected) return "fail";
    const cur = readCustomValue(root);
    const missing = wantedList.filter((x) => !cur.values.some((h) => sameOption(h, x)));
    if (!missing.length) return "same";
    if (!overwrite && !cur.placeholder && cur.values.length) return "skipped"; // site/user already chose something
    let changed = false;
    for (const text of missing) {
      const r = await selectCustomOption(cand, text, manual);
      if (r === "busy") return changed ? "changed" : "busy";
      if (r !== "changed") return changed ? "changed" : "fail";
      changed = true;
    }
    return "changed";
  }

  // Shared state of the replay engine (see runSession below).
  let sessionRunning = false;
  let sessionRerun = false;
  let sessionPromise = null;
  let lastSessionEnd = 0;
  let lastDomChange = Date.now();   // last time the page's DOM changed (not counting our toast)
  let lastFieldChange = 0;          // last time WE changed a dropdown / checkbox
  const customState = new WeakMap(); // widget root -> { fails, nextAt, lastAt }

  // --- Snapshot: capture whatever the user has changed ---

  function collectSnapshot() {
    const fields = [];
    const ctx = buildCustomContext();
    for (const w of ctx.widgets) {
      const cur = readCustomValue(w.root);
      if (cur.placeholder || !cur.values.length) continue;
      fields.push({
        key: w.key,
        value: cur.values.length > 1 ? cur.values : cur.values[0],
        kind: "custom",
        label: w.label || "",
      });
    }
    for (const { el, key } of keyedElements(ctx, true)) {
      if (isSensitive(el) || isLocked(el)) continue;
      const label = labelTextFor(el) || el.getAttribute("placeholder") || el.name || el.id || "";

      if (isCheckable(el)) {
        // Only capture boxes the user actually changed. For radios, only the
        // newly chosen one matters — the browser unchecks its siblings, and
        // "uncheck this radio" can never be replayed.
        if (el.checked === el.defaultChecked) continue;
        if (inputType(el) === "radio" && !el.checked) continue;
        fields.push({ key, value: el.checked, kind: "boolean", label: labelTextFor(el) || el.name || el.value || "" });
        continue;
      }

      if (el.tagName === "SELECT") {
        // Used to capture every dropdown (first option is always "set").
        if (isFieldUntouched(el)) continue;
        if (el.multiple) {
          const values = Array.from(el.selectedOptions).map((o) => o.value);
          if (!values.length) continue;
          const texts = Array.from(el.selectedOptions).map((o) => o.textContent.trim());
          fields.push({ key, value: values, text: texts, kind: "multiselect", label });
        } else {
          if (!el.value) continue; // chose the blank placeholder
          const so = el.selectedOptions && el.selectedOptions[0];
          fields.push({ key, value: el.value, text: so ? so.textContent.trim() : "", kind: "select", label });
        }
        continue;
      }

      const value = el.value;
      if (!value || isFieldUntouched(el)) continue; // empty, or just what the site pre-rendered
      fields.push({ key, value, kind: "text", label });
=======
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
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
    }
    return fields;
  }

<<<<<<< HEAD
  // --- Replay ---

  // Never replay a value onto an element of a different type than it was
  // captured from (keys can collide when a page changes between visits).
  function kindMatches(el, field) {
    const kind = field.kind || "text";
    if (kind === "boolean") return isCheckable(el);
    if (kind === "select" || kind === "multiselect") return el.tagName === "SELECT";
    return !isCheckable(el) && el.tagName !== "SELECT";
  }

  // Elements we've already filled. After the startup window we don't touch
  // them again, so the user can edit/clear a value without it snapping back.
  const applied = new WeakSet();
  let startupUntil = Date.now() + STARTUP_WINDOW_MS;

  function normPath(p) {
    return (p || "").replace(/\/+$/, "") || "/";
  }

  // =====================================================================
  //  REPLAY ENGINE
  //  Fields are filled one at a time, in the order they appear on the page,
  //  and after every dropdown/checkbox change we wait for the page to settle
  //  and look at the page again. That is what makes DEPENDENT dropdowns work:
  //  Stream = Art  ->  page loads / rebuilds the Subject list  ->  Subject is
  //  filled from the NEW list (even if it takes several seconds to arrive).
  // =====================================================================

  async function settleDom(minMs = 50, quietMs = 120, maxMs = 2000) {
    const start = Date.now();
    await sleep(minMs);
    while (Date.now() - start < maxMs) {
      if (Date.now() - lastDomChange >= quietMs) return;
      await sleep(60);
    }
  }

  const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
  const isAfter = (a, b) => a !== b && !!(a.compareDocumentPosition(b) & FOLLOWING); // b after a

  // ---- Built-in preset: Academic Stream -> Subject_1..5 (by subject CODE) ----
  const STREAM_PRESETS = [
    { stream: /\barts?\b/i, subjects: ["101", "117", "129", "140", "142"] },
  ];

  function streamPresetPossible() {
    return !!(document.body && /academic\s+stream/i.test(document.body.textContent || ""));
  }

  function nativeLabels(el, ctx) {
    return [cleanLabel(labelTextFor(el)), cleanLabel(customLabelText({ root: el, seed: el }, ctx)), cleanLabel(el.name), cleanLabel(el.id)].filter(Boolean);
  }

  function presetTargets(ctx) {
    const items = [];
    for (const el of ctx.natives) {
      if (el.tagName !== "SELECT") continue;
      const names = nativeLabels(el, ctx);
      items.push({ el, custom: false, names });
    }
    for (const w of ctx.widgets) items.push({ el: w.root, custom: true, w, names: [cleanLabel(w.label || ""), cleanLabel(String(w.key).replace(/^cs[nip]?:/, ""))] });
    const curText = (i) => (i.custom ? (readCustomValue(i.el).values[0] || "") : ((i.el.selectedOptions[0] || {}).textContent || ""));
    const streamItem = items.find((i) => i.names.some((n) => /academic\s*stream/.test(n)) || /\bstream\b/i.test(curText(i)));
    if (!streamItem) return [];
    const cur = curText(streamItem);
    const preset = cur && STREAM_PRESETS.find((pr) => pr.stream.test(cur));
    if (!preset) return [];
    const out = [];
    for (const i of items) {
      let m = null;
      for (const n of i.names) { m = n && n.match(/^subject[\s_-]*([1-9])\b/); if (m) break; }
      if (!m) continue;
      const code = preset.subjects[Number(m[1]) - 1];
      if (!code) continue;
      out.push({
        key: "preset:subject_" + m[1], noCascade: true, overwrite: false, custom: i.custom, w: i.w, el: i.el,
        field: { kind: i.custom ? "custom" : "select", value: code, byCode: true, label: "subject_" + m[1] },
      });
    }
    return out;
  }

  // Which element on the page does each saved field belong to right now?
  function resolveTargets(merged, ctx) {
    const keyMap = new Map();
    for (const { el, key } of keyedElements(ctx)) keyMap.set(key, el);
    const byKey = new Map(ctx.widgets.map((w) => [w.key, w]));
    const claimed = new Set();
    const customKeys = new Set([...merged].filter(([, v]) => v.field.kind === "custom").map(([k]) => k));
    const targets = [];
    const absentFields = [];
    let absent = 0;
    const usedEl = new Set();

    for (const [key, { field, overwrite }] of merged) {
      if (key.indexOf("label:") === 0) {
        // Field added by hand in the editor: found purely by its label text.
        const want = cleanLabel(field.label);
        const pickBy = (arr, get) => arr.find((x) => get(x).some((l) => l === want)) ||
          (want.length >= 3 ? arr.find((x) => get(x).some((l) => l.indexOf(want) !== -1)) : null);
        const w = pickBy(ctx.widgets.filter((x) => !claimed.has(x)), (x) => [cleanLabel(x.label || "")]);
        if (w) {
          claimed.add(w);
          targets.push({ key, field: Object.assign({}, field, { kind: "custom" }), overwrite, custom: true, w, el: w.root });
          continue;
        }
        const el = pickBy(ctx.natives.filter((n) => !usedEl.has(n) && !isLocked(n) && !isSensitive(n) &&
          (n.tagName === "SELECT" || n.tagName === "TEXTAREA" || (n.tagName === "INPUT" && inputType(n) !== "radio"))), (n) => nativeLabels(n, ctx));
        if (!el) { absent++; absentFields.push(field); continue; }
        usedEl.add(el);
        const kind = el.tagName === "SELECT" ? "select" : inputType(el) === "checkbox" ? "boolean" : "text";
        const value = kind === "boolean" ? /^(1|true|yes|haan|ha|on)$/i.test(String(field.value)) : field.value;
        targets.push({ key, field: Object.assign({}, field, { kind, value }), overwrite, custom: false, el });
        continue;
      }
      if (field.kind === "custom") {
        let w = byKey.get(key);
        if (!w && field.label) {
          // The widget's key can shift when the page re-renders around it; fall
          // back to an unclaimed widget that has exactly the same label.
          const lab = cleanLabel(field.label);
          const same = ctx.widgets.filter((x) => !customKeys.has(x.key) && !claimed.has(x) && x.label && cleanLabel(x.label) === lab);
          if (same.length === 1) w = same[0];
        }
        if (!w) { absent++; absentFields.push(field); continue; }
        claimed.add(w);
        targets.push({ key, field, overwrite, custom: true, w, el: w.root });
      } else {
        const el = keyMap.get(key);
        if (!el || isLocked(el) || isSensitive(el) || !kindMatches(el, field)) { absent++; absentFields.push(field); continue; }
        targets.push({ key, field, overwrite, custom: false, el });
      }
    }
    for (const pt of presetTargets(ctx)) {
      if (!targets.some((t) => t.el === pt.el)) targets.push(pt); // a saved rule for the same field wins
    }
    targets.sort((a, b) => (a.el === b.el ? 0 : isAfter(a.el, b.el) ? -1 : 1));
    return { targets, absent, absentFields };
  }

  function attemptNative(t, manual, inStartup) {
    const { el, field, overwrite } = t;
    if (!manual && !inStartup && applied.has(el)) return "done";
    if (field.kind === "boolean" && inputType(el) === "radio" && !field.value) return "done"; // legacy rules
    if (!overwrite && !isFieldUntouched(el)) return "skipped";
    let result;
    if (field.kind === "boolean") result = setChecked(el, !!field.value);
    else if (el.tagName === "SELECT") result = fillSelect(el, field.value, field.text, field.byCode);
    else result = nativeSetValue(el, field.value);
    if (result !== "fail") applied.add(el);
    return result; // changed | same | fail
  }

  async function attemptCustom(t, manual, inStartup) {
    const w = t.w;
    if (!manual && !inStartup && applied.has(w.root)) return "done";
    const st = customState.get(w.root) || { fails: 0, nextAt: 0, lastAt: 0 };
    if (manual || lastFieldChange > st.lastAt) st.fails = 0; // an earlier field changed: this list may be different now
    if (!manual && st.fails >= 6) { customState.set(w.root, st); return "done"; } // never hammer a list that won't open
    if (Date.now() < st.nextAt) return "wait";
    if (Date.now() - lastDomChange < 80) return "wait";      // page still busy re-rendering
    const list = (Array.isArray(t.field.value) ? t.field.value : [t.field.value]).map((v) => String(v == null ? "" : v));
    st.lastAt = Date.now();
    const res = await fillCustom(w, list, t.overwrite, manual);
    if (res === "changed" || res === "same") { applied.add(w.root); st.fails = 0; }
    else if (res === "fail") { st.fails++; st.nextAt = Date.now() + Math.min(3000, 600 * st.fails); }
    customState.set(w.root, st);
    return res === "busy" ? "wait" : res; // changed | same | skipped | fail | wait
  }

  async function runSession(merged, manual, startPath) {
    sessionRunning = true;
    const start = Date.now();
    const hardEnd = start + 25000;
    let patientUntil = start + 10000;   // keep waiting for a slow dependent list at least this long
    const done = new Map();             // key -> element it was settled on
    let filled = 0;
    let skipped = 0;
    let last = { targets: [], absentFields: [] };
    let toasted = 0;
    try {
      while (Date.now() < hardEnd && location.pathname === startPath) {
        const ctx = buildCustomContext();
        const { targets, absent, absentFields } = resolveTargets(merged, ctx);
        last = { targets, absentFields };
        const inStartup = () => Date.now() < startupUntil;
        let restart = false;

        for (const t of targets) {
          if (done.get(t.key) === t.el) continue;
          if (!t.el.isConnected) continue;
          const r = t.custom ? await attemptCustom(t, manual, inStartup()) : attemptNative(t, manual, inStartup());
          if (r === "same" || r === "done") { done.set(t.key, t.el); continue; }
          if (r === "skipped") { done.set(t.key, t.el); skipped++; continue; }
          if (r === "changed") {
            filled++;
            done.set(t.key, t.el);
            const cascades = !t.noCascade && (t.custom || t.el.tagName === "SELECT" || isCheckable(t.el));
            if (!cascades) { lastFieldChange = Date.now(); continue; } // text / preset subjects: nothing depends on it
            lastFieldChange = Date.now();
            patientUntil = Date.now() + 10000;
            // Everything BELOW this field may have been reset / reloaded by the page.
            for (const o of targets) {
              if (isAfter(t.el, o.el)) { done.delete(o.key); applied.delete(o.el); }
            }
            await settleDom();
            restart = true; // look at the page again
            break;
          }
          // "fail" / "wait": not possible yet — try again on the next round
        }
        if (restart) continue;

        const pending = targets.filter((t) => done.get(t.key) !== t.el && t.el.isConnected).length;
        if (!pending && filled > toasted) { toasted = filled; showPageToast(`शिव ने: ${filled} विकल्प भर दिया ✓`); } // tell the user as soon as the visible fields are done
        if (!pending && manual) break;                        // manual run: don't wait for fields that are not on this page
        if (!pending && !absent) break;                       // everything settled
        if (!pending && Date.now() >= patientUntil) break;    // only fields that never appeared are left
        if (pending && Date.now() >= patientUntil) break;     // gave it a fair chance
        if (!pending && !filled) break;                       // nothing was filled: don't poll for absent fields
        await sleep(100);
      }
    } finally {
      sessionRunning = false;
      lastSessionEnd = Date.now();
    }
    // Which saved fields could NOT be filled (not on the page, or option never appeared)?
    const labelOf = (f) => f.label || String(f.key);
    const notFilled = last.targets.filter((t) => done.get(t.key) !== t.el).map((t) => labelOf(t.field));
    const missingLabels = notFilled.concat(last.absentFields.map(labelOf));
    if (filled > 0 || skipped > 0 || missingLabels.length) {
      console.log(`[AutoFill] bhara: ${filled}, pehle se bhari (chhoda): ${skipped}, nahi bhara/nahi mila: ${missingLabels.length}` +
        (missingLabels.length ? " -> " + missingLabels.join(" | ") : ""));
    }
    if (filled > toasted) showPageToast(`शिव ने: ${filled} विकल्प भर दिया ✓`);
    else if (!filled && manual && window === window.top) showPageToast("Aur koi khali field nahi mili");
    return { ok: filled > 0, filled, skipped, unfilled: missingLabels.length, unfilledLabels: missingLabels };
=======
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
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
  }

  async function autoApplySiteRules(manual = false) {
    let data;
    try {
      data = await chrome.storage.local.get("safill_rules");
    } catch (e) {
<<<<<<< HEAD
      return { ok: false, filled: 0, reason: "no-context" }; // extension reloaded / page navigating away
    }
    const rules = Array.isArray(data.safill_rules) ? data.safill_rules : [];
    const host = location.hostname;
    const path = normPath(location.pathname);
    const matches = rules.filter(
      (r) => r && r.host === host && (r.scope === "site" || (r.scope === "page" && normPath(r.path) === path))
    );

    // Site-wide rules first, page rules after. Merge per field so the more
    // specific (page) rule really wins, including its own overwrite flag.
    matches.sort((a, b) => (a.scope === "site" ? 0 : 1) - (b.scope === "site" ? 0 : 1));
    const merged = new Map();
    for (const rule of matches) {
      if (!Array.isArray(rule.fields)) continue;
      for (const field of rule.fields) {
        if (field && typeof field.key === "string") merged.set(field.key, { field, overwrite: !!rule.overwrite });
      }
    }
    if (!merged.size && !streamPresetPossible()) {
      return { ok: false, filled: 0, reason: !rules.length ? "no-rules" : "no-match" };
    }

    if (sessionRunning) {
      if (!manual) { sessionRerun = true; return { ok: false, filled: 0, reason: "busy" }; }
      while (sessionRunning) await sleep(100); // manual run: let the current pass finish first
    }
    sessionPromise = runSession(merged, manual, location.pathname);
    const result = await sessionPromise;
    if (sessionRerun) { sessionRerun = false; setTimeout(autoApplySiteRules, 500); }
    return result;
=======
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
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
  }

  // --- Small on-page toast (no extra permission needed) ---

  function showPageToast(message) {
<<<<<<< HEAD
    let el = document.getElementById(TOAST_ID);
    if (el) {
      // Reuse the existing toast instead of removing/recreating it —
      // that remove+recreate cycle is what causes the blinking.
      clearTimeout(el._hideTimer);
      clearTimeout(el._removeTimer);
      el.textContent = message;
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    } else {
      el = document.createElement("div");
      el.id = TOAST_ID;
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
      el._removeTimer = setTimeout(() => el.remove(), 250);
    }, 2400);
  }

=======
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

>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
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

<<<<<<< HEAD
  // Unicode-aware: the old a-z0-9 filter erased Hindi (and every other
  // non-Latin) labels completely, so they could never match anything.
  function normalize(str) {
    return (str || "")
      .toString()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip Latin accents only; keep Devanagari vowel signs
      .replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
=======
  function normalize(str) {
    return (str || "").toString().toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "");
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
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

<<<<<<< HEAD
  // Each candidate keeps its normalized form AND its separate words
  // ("txtMobileNo" -> txt, mobile, no) so a profile label can match a whole
  // word instead of any substring ("name" must not match "username").
  function toCandidate(raw) {
    const norm = normalize(raw);
    if (!norm) return null;
    const words = new Set(
      String(raw)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .split(/[^\p{L}\p{M}\p{N}]+/u)
        .map(normalize)
        .filter(Boolean)
    );
    return { norm, words };
  }

  function candidateStrings(el) {
    const ac = (el.getAttribute("autocomplete") || "").trim().toLowerCase();
=======
  function candidateStrings(el) {
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
    return [
      el.getAttribute("name"),
      el.id,
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label"),
<<<<<<< HEAD
      ac === "on" || ac === "off" ? "" : ac,
      labelTextFor(el),
    ]
      .filter(Boolean)
      .map(toCandidate)
      .filter(Boolean);
=======
      el.getAttribute("autocomplete"),
      labelTextFor(el),
    ]
      .filter(Boolean)
      .map(normalize)
      .filter((s) => s.length > 0);
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
  }

  function scoreMatch(fieldTokens, candidate) {
    let best = 0;
    for (const token of fieldTokens) {
      if (!token) continue;
<<<<<<< HEAD
      if (candidate.norm === token) {
        best = Math.max(best, 100);
        continue;
      }
      if (candidate.words.has(token)) {
        best = Math.max(best, 90);
        continue;
      }
      // Pure substring match ("tel" in "hotel", "pin" in "shipping", "name"
      // in "username"): only for 4+ chars and only when the two are close in length.
      const shorter = Math.min(token.length, candidate.norm.length);
      const longer = Math.max(token.length, candidate.norm.length);
      if (shorter >= 4 && (candidate.norm.includes(token) || token.includes(candidate.norm))) {
        const ratio = shorter / longer;
        if (ratio >= 0.65) best = Math.max(best, 40 + ratio * 40);
=======
      if (candidate === token) best = Math.max(best, 100);
      else if (candidate.includes(token) || token.includes(candidate)) {
        const ratio = Math.min(token.length, candidate.length) / Math.max(token.length, candidate.length);
        best = Math.max(best, 40 + ratio * 40);
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
      }
    }
    return best;
  }

  function applyLegacyProfile(profile) {
    if (!profile || !Array.isArray(profile.fields) || !profile.fields.length) {
      return { ok: false, filled: 0, reason: "empty-profile" };
    }
<<<<<<< HEAD
    // Checkbox/radio are excluded: writing .value into them rewrites the value
    // that gets submitted instead of ticking anything.
    const elements = getFillableElements().filter((el) => !isCheckable(el) && !isLocked(el) && !isSensitive(el));
    if (!elements.length) return { ok: false, filled: 0, reason: "no-fields-on-page" };

    const fields = profile.fields
      .filter((f) => f && f.label && f.value)
      .map((f) => ({ ...f, tokens: expandTokens(normalize(f.label)).filter(Boolean) }))
      .filter((f) => f.tokens.length);
    if (!fields.length) return { ok: false, filled: 0, reason: "empty-profile" };

    let filled = 0;
    let matched = 0;
=======
    const elements = getFillableElements();
    if (!elements.length) return { ok: false, filled: 0, reason: "no-fields-on-page" };

    const fields = profile.fields
      .filter((f) => f.label && f.value)
      .map((f) => ({ ...f, tokens: expandTokens(normalize(f.label)) }));
    if (!fields.length) return { ok: false, filled: 0, reason: "empty-profile" };

    let filled = 0;
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
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
<<<<<<< HEAD
        matched++;
        const result = el.tagName === "SELECT" ? fillSelect(el, bestField.value) : nativeSetValue(el, bestField.value);
        if (result === "changed") filled++;
      }
    }
    if (filled > 0) showPageToast(`शिव ने: ${filled} field भर दिए ✓`);
    return {
      ok: filled > 0,
      filled,
      total: elements.length,
      reason: filled > 0 ? undefined : matched > 0 ? "already-filled" : "no-match",
    };
  }

  // --- Message handling ---

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "SHIV_AUTOFILL_FILL") {
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

  // Direct entry points for chrome.scripting.executeScript (same isolated
  // world). Used for "fill the whole tab" so every frame is handled and the
  // results can be merged — with sendMessage only the first frame to reply wins.
  window.__shivAutofillApi = {
    fillProfile: (profile) => applyLegacyProfile(profile),
    runRules: () => autoApplySiteRules(true),
    debugDropdowns: () =>
      buildCustomContext().widgets.map((w) => ({ key: w.key, label: w.label, strong: w.strong, value: readCustomValue(w.root) })),
  };

  // --- Automatic replay ---

  function restartStartupWindow() {
    startupUntil = Date.now() + STARTUP_WINDOW_MS;
  }

  // Government/ASP.NET style pages often reload part of the page (postback)
  // when a dropdown changes, so keep re-checking for the first few seconds.
  autoApplySiteRules();
  [400, 900, 1600, 2600, 4000, 6000].forEach((ms) => setTimeout(autoApplySiteRules, ms));

  // 1) bfcache restore does not re-run this script but fires "pageshow".
  window.addEventListener("pageshow", () => {
    restartStartupWindow();
=======
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
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
    autoApplySiteRules();
    setTimeout(autoApplySiteRules, 800);
  });

<<<<<<< HEAD
  // 2) SPA navigation. Content scripts live in an isolated world, so wrapping
  //    history.pushState here never sees the page's own calls — the old
  //    wrapper was dead code. Use the Navigation API plus popstate, and also
  //    re-check from the DOM observer below.
=======
  // 2) Single-page apps change the URL via pushState/replaceState without a
  //    full reload. Watch for that and re-check rules for the new path.
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
  let lastPath = location.pathname;
  function handlePossibleUrlChange() {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
<<<<<<< HEAD
    restartStartupWindow();
    autoApplySiteRules();
    setTimeout(autoApplySiteRules, 800);
  }
  window.addEventListener("popstate", handlePossibleUrlChange);
  try {
    if (window.navigation && typeof window.navigation.addEventListener === "function") {
      window.navigation.addEventListener("navigatesuccess", handlePossibleUrlChange);
    }
  } catch (e) { /* older Chrome */ }

  // 3) Late-rendered forms: watch the DOM, debounced, ignoring our own toast
  //    (it used to re-trigger a fill pass every time it appeared/disappeared).
  function isOwnToastMutation(record) {
    const t = record.target;
    if (t && t.nodeType === 1 && (t.id === TOAST_ID || (t.closest && t.closest("#" + TOAST_ID)))) return true;
    const nodes = [...record.addedNodes, ...record.removedNodes];
    return nodes.length > 0 && nodes.every((n) => n.nodeType === 1 && n.id === TOAST_ID);
  }

  let mutationTimer = null;
  const observer = new MutationObserver((records) => {
    if (records.every(isOwnToastMutation)) return;
    lastDomChange = Date.now();
    handlePossibleUrlChange();
    if (sessionRunning) return; // the running pass keeps looking at the page itself
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(autoApplySiteRules, Math.max(500, lastSessionEnd + 1500 - Date.now()));
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Tabs / accordions / "show more" usually just toggle a class or style, which the
  // childList observer above never sees. Re-check after clicks and after
  // visibility-related attribute changes so fields that become visible get filled.
  function schedulePass(ms) {
    if (sessionRunning) { sessionRerun = true; return; }
    clearTimeout(mutationTimer);
    mutationTimer = setTimeout(autoApplySiteRules, Math.max(ms, lastSessionEnd + 1000 - Date.now()));
  }
  document.addEventListener("click", () => schedulePass(350), true);
  document.addEventListener("keyup", (e) => { if (e.key === "Enter" || e.key === " " || e.key.indexOf("Arrow") === 0) schedulePass(350); }, true);
  document.addEventListener("transitionend", () => schedulePass(300), true);
  try {
    new MutationObserver((records) => {
      if (records.every((r) => isOwnToastMutation(r))) return;
      schedulePass(500);
    }).observe(document.documentElement, {
      attributes: true, subtree: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden", "aria-selected", "aria-expanded", "open"],
    });
  } catch (e) { /* ignore */ }
=======
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
>>>>>>> 7a2b773fb3a8b7a94a825f0ff2b89c1ae7345832
})();
