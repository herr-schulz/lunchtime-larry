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

let policy;
function larryPolicy() {
  if (policy) return policy;
  const api = globalThis.trustedTypes;
  policy = api?.createPolicy?.("larry", {
    createHTML: (s) => s,
  }) ?? { createHTML: (s) => s };
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
