package score

import "testing"

func TestFeedMirrorsFor(t *testing.T) {
	got := FeedMirrorsFor("https://css-tricks.com/feed/")
	if len(got) != 1 || got[0] != "https://feeds.feedburner.com/CssTricks" {
		t.Fatalf("css-tricks mirrors: %v", got)
	}
	got = FeedMirrorsFor("https://www.css-tricks.com/feed/")
	if len(got) != 1 {
		t.Fatalf("www css-tricks mirrors: %v", got)
	}
	if FeedMirrorsFor("https://example.com/feed") != nil {
		t.Fatal("expected no mirrors for example.com")
	}
}
