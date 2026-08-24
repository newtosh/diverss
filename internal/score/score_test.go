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

func TestScoreParsedFeed_DatedItemsVelocity(t *testing.T) {
	now := time.Date(2026, 8, 24, 12, 0, 0, 0, time.UTC)
	feed := &gofeed.Feed{
		Title: "Example",
		Items: []*gofeed.Item{
			{PublishedParsed: ptrTime(now.Add(-2 * 24 * time.Hour))},
			{PublishedParsed: ptrTime(now.Add(-5 * 24 * time.Hour))},
			{PublishedParsed: ptrTime(now.Add(-10 * 24 * time.Hour))},
			{PublishedParsed: ptrTime(now.Add(-40 * 24 * time.Hour))}, // outside window
		},
	}
	r := ScoreParsedFeed("https://example.com/feed.xml", feed, now)
	if r.Health != HealthOK {
		t.Fatalf("health=%s want ok", r.Health)
	}
	if r.VelocityUnknown || r.PostsPerWeek == nil {
		t.Fatal("expected known velocity")
	}
	// 3 posts in 30 days ≈ 0.7 posts/week
	if *r.PostsPerWeek < 0.69 || *r.PostsPerWeek > 0.71 {
		t.Fatalf("postsPerWeek=%v want ~0.7", *r.PostsPerWeek)
	}
	if r.ItemCountWindow != 3 {
		t.Fatalf("itemCountWindow=%d want 3", r.ItemCountWindow)
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
	if r.Health != HealthOK {
		t.Fatalf("health=%s", r.Health)
	}
	if !r.VelocityUnknown {
		t.Fatal("expected unknown velocity")
	}
	if r.PostsPerWeek != nil {
		t.Fatal("postsPerWeek should be omitted")
	}
}

func TestScoreParsedFeed_EmptyItems_UnknownVelocity(t *testing.T) {
	now := time.Now().UTC()
	feed := &gofeed.Feed{Title: "Empty", Items: nil}
	r := ScoreParsedFeed("https://example.com/feed.xml", feed, now)
	if r.Health != HealthOK || !r.VelocityUnknown {
		t.Fatalf("got health=%s unknown=%v", r.Health, r.VelocityUnknown)
	}
}

func TestScoreParsedFeed_NilFeed_Unparseable(t *testing.T) {
	r := ScoreParsedFeed("https://example.com/feed.xml", nil, time.Now().UTC())
	if r.Health != HealthUnhealthy || r.Reason != ReasonUnparseable {
		t.Fatalf("got %+v", r)
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
	if r.Health != HealthOK || r.VelocityUnknown || r.PostsPerWeek == nil {
		t.Fatalf("unexpected result %+v", r)
	}
	// 2 posts / ~4.286 weeks in 30d ≈ 0.47
	if *r.PostsPerWeek < 0.46 || *r.PostsPerWeek > 0.48 {
		t.Fatalf("postsPerWeek=%v", *r.PostsPerWeek)
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
	if want.PostsPerWeek == nil || r.PostsPerWeek == nil || *r.PostsPerWeek != *want.PostsPerWeek {
		t.Fatalf("ppw got %v want %v", r.PostsPerWeek, want.PostsPerWeek)
	}
}

func ptrTime(t time.Time) *time.Time { return &t }
