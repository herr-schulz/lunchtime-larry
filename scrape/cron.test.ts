import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const yaml = readFileSync(new URL("../.github/workflows/scrape.yml", import.meta.url), "utf8");
const onBlock = yaml.split(/\njobs:/)[0] ?? yaml;

describe("scrape triggers", () => {
  it("has no GitHub schedule cron (Cursor automation kicks workflow_dispatch)", () => {
    expect(onBlock).not.toMatch(/^\s+schedule:/m);
    expect(onBlock).not.toMatch(/- cron:/);
  });

  it("accepts workflow_dispatch and repository_dispatch", () => {
    expect(onBlock).toMatch(/^\s+workflow_dispatch:/m);
    expect(onBlock).toMatch(/repository_dispatch:\r?\n\s+types: \[scrape\]/);
    expect(yaml).toMatch("github.event_name == 'repository_dispatch'");
  });
});
