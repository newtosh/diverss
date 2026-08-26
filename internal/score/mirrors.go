package score

import (
	"net/url"
	"strings"
)

// feedMirrors lists alternate feed URLs when the publisher host blocks
// datacenter crawl egress (same content, reachable host).
var feedMirrors = map[string][]string{
	"css-tricks.com": {"https://feeds.feedburner.com/CssTricks"},
}

// FeedMirrorsFor returns known mirrors for a feed or page URL's host.
func FeedMirrorsFor(xmlURL string) []string {
	u, err := url.Parse(xmlURL)
	if err != nil {
		return nil
	}
	host := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	out := feedMirrors[host]
	if len(out) == 0 {
		return nil
	}
	cp := make([]string, len(out))
	copy(cp, out)
	return cp
}
