package score

import (
	"bytes"
	"encoding/json"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/mmcdole/gofeed"
)

func TestScoreParsedFeed_WindowCounts(t *testing.T) {
	now := time.Date(2026, 8, 24, 12, 0, 0, 0, time.UTC)
	feed := &gofeed.Feed{
		Title: "Example",
		Items: []*gofeed.Item{
			{PublishedParsed: ptrTime(now.Add(-2 * 24 * time.Hour))},
			{PublishedParsed: ptrTime(now.Add(-5 * 24 * time.Hour))},
			{PublishedParsed: ptrTime(now.Add(-10 * 24 * time.Hour))},
			{PublishedParsed: ptrTime(now.Add(-40 * 24 * time.Hour))},
		},
	}
	r := ScoreParsedFeed("https://example.com/feed.xml", feed, now)
	if r.Health != HealthOK {
		t.Fatalf("health=%s want ok", r.Health)
	}
	if r.VelocityUnknown || r.Posts1d == nil || r.Posts7d == nil || r.Posts30d == nil {
		t.Fatal("expected known cadence windows")
	}
	if *r.Posts1d != 0 || *r.Posts7d != 2 || *r.Posts30d != 3 {
		t.Fatalf("windows 1/7/30=%d/%d/%d", *r.Posts1d, *r.Posts7d, *r.Posts30d)
	}
}

func TestScoreParsedFeed_Stale(t *testing.T) {
	now := time.Date(2026, 8, 24, 12, 0, 0, 0, time.UTC)
	feed := &gofeed.Feed{
		Title: "Old",
		Items: []*gofeed.Item{
			{PublishedParsed: ptrTime(now.Add(-100 * 24 * time.Hour))},
			{PublishedParsed: ptrTime(now.Add(-120 * 24 * time.Hour))},
		},
	}
	r := ScoreParsedFeed("https://example.com/old.xml", feed, now)
	if r.Health != HealthStale || r.Reason != ReasonStale {
		t.Fatalf("got %+v", r)
	}
	if r.Posts30d == nil || *r.Posts30d != 0 {
		t.Fatalf("posts30d=%v", r.Posts30d)
	}
	if r.LastDatedAt == nil {
		t.Fatal("expected lastDatedAt")
	}
}

func TestScoreParsedFeed_NoDatedItems_UnknownVelocity(t *testing.T) {
	now := time.Now().UTC()
	feed := &gofeed.Feed{
		Title: "Undated",
		Items: []*gofeed.Item{
			{Title: "a"},
			{Title: "b"},
		},
	}
	r := ScoreParsedFeed("https://example.com/feed.xml", feed, now)
	if r.Health != HealthStale || r.Reason != ReasonStale {
		t.Fatalf("expected stale undated feed, got health=%s reason=%s", r.Health, r.Reason)
	}
	if !r.VelocityUnknown {
		t.Fatal("expected unknown velocity")
	}
	if r.Posts7d != nil {
		t.Fatal("posts7d should be omitted")
	}
}

func TestScoreParsedFeed_PermalinkDateInference(t *testing.T) {
	now := time.Date(2026, 8, 24, 12, 0, 0, 0, time.UTC)
	feed := &gofeed.Feed{
		Title: "Permalink dates",
		Items: []*gofeed.Item{
			{Title: "Old", Link: "https://example.com/2025/04/18/show-613/"},
		},
	}
	r := ScoreParsedFeed("https://example.com/rss", feed, now)
	if r.Health != HealthStale {
		t.Fatalf("expected stale from old permalink, got %s", r.Health)
	}
	if r.LastDatedAt == nil || r.LastDatedAt.Format("2006-01-02") != "2025-04-18" {
		t.Fatalf("expected lastDatedAt 2025-04-18, got %v", r.LastDatedAt)
	}
}

func TestScoreParsedFeed_EmptyItems_UnknownVelocity(t *testing.T) {
	now := time.Now().UTC()
	feed := &gofeed.Feed{Title: "Empty", Items: nil}
	r := ScoreParsedFeed("https://example.com/feed.xml", feed, now)
	if r.Health != HealthStale || !r.VelocityUnknown {
		t.Fatalf("got health=%s unknown=%v", r.Health, r.VelocityUnknown)
	}
}

func TestScoreParsedFeed_NilFeed_Unparseable(t *testing.T) {
	r := ScoreParsedFeed("https://example.com/feed.xml", nil, time.Now().UTC())
	if r.Health != HealthUnhealthy || r.Reason != ReasonUnparseable {
		t.Fatalf("got %+v", r)
	}
}

func TestScoreParsedFeed_AvgWordsPrefersContent(t *testing.T) {
	now := time.Date(2026, 8, 24, 12, 0, 0, 0, time.UTC)
	feed := &gofeed.Feed{
		Items: []*gofeed.Item{
			{
				PublishedParsed: ptrTime(now.Add(-2 * 24 * time.Hour)),
				Description:     "short teaser only",
				Content:         "<p>one two three four five six seven eight nine ten</p>",
			},
		},
	}
	r := ScoreParsedFeed("https://example.com/feed.xml", feed, now)
	if r.AvgWords == nil || *r.AvgWords != 10 {
		t.Fatalf("avgWords=%v want 10", r.AvgWords)
	}
}

func TestGoldenFixtureFile(t *testing.T) {
	body, err := os.ReadFile("../../testdata/feeds/fixture-blog.xml")
	if err != nil {
		t.Fatal(err)
	}
	fp := gofeed.NewParser()
	feed, err := fp.Parse(bytes.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 24, 12, 0, 0, 0, time.UTC)
	r := ScoreParsedFeed("https://fixture.example/feed.xml", feed, now)

	raw, err := os.ReadFile("../../testdata/score-golden/fixture-blog.json")
	if err != nil {
		t.Fatal(err)
	}
	var want Result
	if err := json.Unmarshal(raw, &want); err != nil {
		t.Fatal(err)
	}
	if r.Health != want.Health || r.Title != want.Title || r.VelocityUnknown != want.VelocityUnknown {
		t.Fatalf("got %+v want %+v", r, want)
	}
	if want.Posts1d == nil || r.Posts1d == nil || *r.Posts1d != *want.Posts1d {
		t.Fatalf("posts1d got %v want %v", r.Posts1d, want.Posts1d)
	}
	if want.Posts7d == nil || r.Posts7d == nil || *r.Posts7d != *want.Posts7d {
		t.Fatalf("posts7d got %v want %v", r.Posts7d, want.Posts7d)
	}
	if want.Posts30d == nil || r.Posts30d == nil || *r.Posts30d != *want.Posts30d {
		t.Fatalf("posts30d got %v want %v", r.Posts30d, want.Posts30d)
	}
}

func TestParseFixture_MatchesGoldenShape(t *testing.T) {
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Fixture Blog</title>
    <item>
      <title>One</title>
      <pubDate>Mon, 10 Aug 2026 12:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Two</title>
      <pubDate>Mon, 17 Aug 2026 12:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`
	fp := gofeed.NewParser()
	feed, err := fp.Parse(strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 8, 24, 12, 0, 0, 0, time.UTC)
	r := ScoreParsedFeed("https://fixture.example/feed.xml", feed, now)
	if r.Title != "Fixture Blog" {
		t.Fatalf("title=%q", r.Title)
	}
	if r.Health != HealthOK || r.VelocityUnknown {
		t.Fatalf("unexpected result %+v", r)
	}
	if r.Posts7d == nil || *r.Posts7d != 1 || r.Posts30d == nil || *r.Posts30d != 2 {
		t.Fatalf("windows got 7=%v 30=%v", r.Posts7d, r.Posts30d)
	}
}

func ptrTime(t time.Time) *time.Time { return &t }
