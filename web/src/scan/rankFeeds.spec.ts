import { describe, expect, it } from "vitest";
import { rankFeeds } from "./rankFeeds";
import type { ScanResult } from "./client";

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function ok(xmlUrl: string, posts30d: number, ageDays: number): ScanResult {
  return {
    schemaVersion: 2,
    xmlUrl,
    health: "ok",
    reason: "ok",
    velocityUnknown: false,
    posts30d,
    lastDatedAt: daysAgo(ageDays),
    scannedAt: new Date().toISOString(),
  };
}

describe("rankFeeds", () => {
  it("ranks by volume before recency, mirroring daringfireball.net main vs articles", () => {
    const candidates = [
      {
        xmlUrl: "https://low-volume.example/feed",
        title: "Low Volume (newer)",
      },
      {
        xmlUrl: "https://high-volume.example/feed",
        title: "High Volume (older)",
      },
      { xmlUrl: "https://dead.example/feed", title: "Dead" },
      { xmlUrl: "https://unreachable.example/feed", title: "Unreachable" },
    ];
    const scans = new Map<string, ScanResult>([
      [
        "https://high-volume.example/feed",
        ok("https://high-volume.example/feed", 48, 2),
      ],
      [
        "https://low-volume.example/feed",
        ok("https://low-volume.example/feed", 8, 0),
      ],
      ["https://dead.example/feed", ok("https://dead.example/feed", 0, 90)],
    ]);

    const ranked = rankFeeds(candidates, scans);

    expect(ranked.map((r) => r.candidate.title)).toEqual([
      "High Volume (older)",
      "Low Volume (newer)",
      "Dead",
      "Unreachable",
    ]);
    expect(ranked.map((r) => r.bucket)).toEqual([
      "fresh",
      "fresh",
      "inactive",
      "unverified",
    ]);
  });

  it("returns empty for no candidates", () => {
    expect(rankFeeds([], new Map())).toEqual([]);
  });
});
