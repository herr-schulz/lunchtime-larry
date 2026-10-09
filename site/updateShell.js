/** Stamped from version.json so a cached app.js can notice a newer deploy. */
export const SHELL_BUILD = "44";

export function cacheNameFor(build) {
  return `larry-shell-v${build}`;
}

export function remoteBuildFrom(payload) {
  if (!payload || typeof payload !== "object") return "";
  return typeof payload.build === "string" ? payload.build : "";
}

export function isStaleShell(localBuild, remoteBuild) {
  return Boolean(remoteBuild) && remoteBuild !== localBuild;
}

export function shouldBypassCache(pathname) {
  const file = pathname.split("/").pop() || "";
  if (
    file === "version.json" ||
    file === "sw.js" ||
    file === "index.html" ||
    file === "alternativen.html"
  ) {
    return true;
  }
  return pathname.endsWith("/");
}

export function staleShellCopy() {
  return {
    kicker: "Alter Zettel",
    line: "Dein Larry ist noch der vom letzten Stand. Einmal neu laden, dann passt’s.",
    action: "Neu laden",
  };
}

export async function reloadFresh() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  } catch {
    /* private mode / no SW */
  }
  location.reload();
}
