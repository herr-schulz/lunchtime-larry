import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";

describe("vote opt-in and first visit", () => {
  const html = readFileSync("site/index.html", "utf8");
  const { document } = parseHTML(html);

  it("keeps one board ticket and leaves voting off it", () => {
    const items = [...document.querySelectorAll("#intro-dialog .intro-points li")].map(
      (li) => li.textContent?.replace(/\s+/g, " ").trim(),
    );
    const text = items.join(" ");
    expect(items).toHaveLength(4);
    expect(items[0]).toMatch(/StMUV/);
    expect(items[0]).toMatch(/Dave B/);
    expect(items[0]).toMatch(/Bella 23/);
    expect(items[0]).toMatch(/vorausgewählt/);
    expect(items[1]).toMatch(/Herz/);
    expect(items[1]).toMatch(/diesem Gerät/);
    expect(items[2]).toMatch(/Lass Larry entscheiden/);
    expect(items[2]).toMatch(/Was anderes/);
    expect(items[3]).toMatch(/10:45/);
    expect(text).not.toMatch(/11:55|Mitstimmen|Hausrunde|Rundencode|Haken/);
    expect(document.querySelectorAll("#intro-dialog")).toHaveLength(1);
    const app = readFileSync("site/app.js", "utf8");
    expect(app).toMatch(
      /function maybeIntro\(\) \{\s*if \(!introDialog \|\| loadIntroSeen\(\)\) return false;/,
    );
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
    expect(document.querySelector("#intro-again")?.textContent).toBe("Was ist das hier?");
    expect(document.querySelector("#intro-again")?.hasAttribute("hidden")).toBe(false);
  });

  it("reveals with Larry's line and paper confetti, not a second tour", () => {
    expect(document.querySelector("#reveal-dialog h2")?.textContent).toBe(
      "Larry präsentiert heute:",
    );
    expect(document.querySelectorAll("#reveal-dialog .confetti i").length).toBeGreaterThan(0);
    expect(document.querySelectorAll("[data-tour]")).toHaveLength(0);
  });
});

describe("voting welcome", () => {
  const html = readFileSync("site/index.html", "utf8");
  const { document } = parseHTML(html);
  const app = readFileSync("site/app.js", "utf8");

  it("keeps the round rules on the welcome ticket", () => {
    const welcome = document.querySelector("#welcome-dialog");
    expect(welcome?.className).toMatch(/weekend-dialog/);
    const text = welcome?.textContent?.replace(/\s+/g, " ") ?? "";
    expect(text).toMatch(/11:55/);
    expect(text).toMatch(/geheim/);
    expect(text).toMatch(/12 Uhr/);
    expect(text).toMatch(/sechs/);
    expect(text).toMatch(/denselben Teamnamen oder Code/);
    expect(document.querySelector("#welcome-dialog button[value='ok']")?.textContent).toBe(
      "Alles klar",
    );
  });

  it("opens the welcome only after a stored nick and slug", () => {
    expect(app).toMatch(
      /if \(!nick \|\| !loadRoundCode\(\)\) return;\s*await settleRound\(\)/,
    );
    expect(app).toMatch(
      /if \(!loadNick\(\) \|\| !loadRoundCode\(\)\) return;\s*if \(!welcomePassed\)/,
    );
    expect(app).toMatch(/function startVotes[\s\S]*if \(!welcomePassed\) return/);
    expect(app).toMatch(
      /introAgain\?\.addEventListener\("click", \(\) => \{\s*introDialog\?\.showModal\(\);\s*\}\)/,
    );
  });
});

describe("vote phases sit on a round", () => {
  const app = readFileSync("site/app.js", "utf8");

  it("does not keep a house-day winner key", () => {
    expect(app).toMatch(/if \(!code\) return "";/);
    expect(app).toMatch(/lunchtime-larry-winner-\$\{lastVoteDate\(\)\}-\$\{code\}/);
    expect(app).not.toMatch(/lunchtime-larry-winner-\$\{day\}/);
    expect(app).toMatch(
      /if \(!reveal \|\| !loadVoteOptIn\(\) \|\| !loadRoundCode\(\)\) return/,
    );
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
