/** Tiny DOM/string helpers shared by the board. */

const TT = globalThis.trustedTypes;
const HAS_TT = Boolean(TT?.createPolicy);

/** Tinyfill: older browsers still go through escapeHtml before assignment. */
if (!HAS_TT && globalThis.trustedTypes === undefined) {
  globalThis.trustedTypes = {
    createPolicy(name, rules) {
      return {
        createHTML: (s) => rules.createHTML(s),
      };
    },
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export { escapeHtml };

/** Only https: links leave the page. Everything else becomes `#`. */
export function safeUrl(value) {
  try {
    const url = new URL(String(value || ""), "https://example.invalid");
    if (url.protocol === "https:") return url.href;
  } catch {
    /* bad URL */
  }
  return "#";
}

const RAW = Symbol("larry-html");

function asRaw(value) {
  return value && typeof value === "object" && value[RAW] != null ? value[RAW] : null;
}

const POLICY_KEY = "__larryTrustedTypesPolicy";
let policy;

/**
 * One policy for the whole page. Different ?v= imports of this file are
 * separate modules — without a global stash, the second createPolicy("larry")
 * throws and the board boot falls into the empty-menu catch.
 */
function larryPolicy() {
  if (policy) return policy;
  if (globalThis[POLICY_KEY]) {
    policy = globalThis[POLICY_KEY];
    return policy;
  }
  const api = globalThis.trustedTypes;
  try {
    policy =
      api?.createPolicy?.("larry", {
        createHTML: (s) => s,
      }) ?? { createHTML: (s) => s };
  } catch {
    policy = { createHTML: (s) => s };
  }
  globalThis[POLICY_KEY] = policy;
  return policy;
}

/**
 * Tagged template: every interpolation is escaped unless it came from `html` itself.
 * Returns a TrustedHTML (or a branded string) for `setHtml`.
 */
function interpolate(value) {
  if (value == null || value === false) return "";
  const raw = asRaw(value);
  if (raw != null) return raw;
  if (Array.isArray(value)) return value.map(interpolate).join("");
  return escapeHtml(value);
}

export function html(strings, ...values) {
  let out = strings[0] ?? "";
  for (let i = 0; i < values.length; i += 1) {
    out += interpolate(values[i]);
    out += strings[i + 1] ?? "";
  }
  const trusted = larryPolicy().createHTML(out);
  if (trusted && typeof trusted === "object") {
    trusted[RAW] = String(trusted);
    return trusted;
  }
  const boxed = Object.assign(Object(String(trusted)), { [RAW]: String(trusted) });
  return boxed;
}

/** Assign markup that went through `html` (or trusted types). */
export function setHtml(el, value) {
  if (!el) return;
  const raw = asRaw(value);
  if (raw != null && value && typeof value === "object" && !Array.isArray(value) && typeof value !== "string") {
    el.innerHTML = value;
    return;
  }
  if (typeof value === "string") {
    el.innerHTML = larryPolicy().createHTML(escapeHtml(value));
    return;
  }
  el.innerHTML = value;
}
