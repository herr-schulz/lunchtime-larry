import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";

describe("vote opt-in and first visit", () => {
  const html = readFileSync("site/index.html", "utf8");
  const { document } = parseHTML(html);

  it("keeps one intro ticket with the original three points plus the noon rule", () => {
    const items = [...document.querySelectorAll("#intro-dialog .intro-points li")].map(
      (li) => li.textContent?.replace(/\s+/g, " ").trim(),
    );
    expect(items).toHaveLength(4);
    expect(items[0]).toMatch(/Drei Kantinen/);
    expect(items[1]).toMatch(/Herz/);
    expect(items[1]).toMatch(/diesem Gerät/);
    expect(items[2]).toMatch(/Mitstimmen/);
    expect(items[3]).toMatch(/11:55/);
    expect(items[3]).toMatch(/geheim/);
    expect(items[3]).toMatch(/12 Uhr/);
    expect(items[3]).toMatch(/sechs/);
    expect(items[3]).toMatch(/Rundencode/);
    expect(document.querySelectorAll("#intro-dialog")).toHaveLength(1);
  });

  it("requires a round name and escapes it in the footer", () => {
    const label = document.querySelector("#nick-form .round-field");
    expect(label?.textContent).toMatch(/Runde/);
    expect(label?.textContent).toMatch(/Teamname oder Code/);
    expect(label?.textContent).not.toMatch(/Hausrunde/);
    expect(document.querySelector("#round-roll")?.textContent).toBe("Code würfeln");
    expect(document.querySelector("#round-input")?.hasAttribute("required")).toBe(true);
    const client = readFileSync("site/voteClient.js", "utf8");
    expect(client).toMatch(/votesPath\(day, loadRoundCode\(\)\)/);
    expect(client).not.toMatch(/votesPath\(day\)/);
    const app = readFileSync("site/app.js", "utf8");
    expect(app).toMatch(/escapeHtml\(code\)/);
  });

  it("puts Mitstimmen in the footer and Abstimmen on the opt-in dialog", () => {
    expect(document.querySelector("#nick-edit")?.textContent).toBe("Mitstimmen");
    expect(document.querySelector("#optin-dialog button[value='ok']")?.textContent).toBe(
      "Abstimmen",
    );
    expect(document.querySelector("#intro-again")?.textContent).toBe("Der Zettel");
  });

  it("reveals with Larry's line and paper confetti, not a second tour", () => {
    expect(document.querySelector("#reveal-dialog h2")?.textContent).toBe(
      "Larry präsentiert heute:",
    );
    expect(document.querySelectorAll("#reveal-dialog .confetti i").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-tour]")).toHaveLength(0);
  });
});

describe("round migration", () => {
  const app = readFileSync("site/app.js", "utf8");

  it("blocks opt-in without a slug and does not copy the house round", () => {
    expect(app).toMatch(/Deine Stimme braucht eine Runde/);
    expect(app).toMatch(/roundMigrateLock/);
    expect(app).toMatch(/if \(roundMigrateLock\) event\.preventDefault\(\)/);
    const client = readFileSync("site/voteClient.js", "utf8");
    expect(client).not.toMatch(/votes\/\$\{berlinDate/);
    expect(client).not.toMatch(/copy/);
  });
});

describe("listenVotes stays behind the opt-in flag", () => {
  it("does not start the ballot listener before Mitstimmen", () => {
    const app = readFileSync("site/app.js", "utf8");
    expect(app).toMatch(/function startVotes[\s\S]*if \(!loadVoteOptIn\(\)\) return/);
  });
});
