package score

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/mmcdole/gofeed"
)

const maxBodyBytes = 5 << 20 // 5 MiB

func DefaultHTTPClient(timeout time.Duration) *http.Client {
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	return &http.Client{Timeout: timeout}
}

// FetchAndScore downloads and scores a single feed URL.
func FetchAndScore(ctx context.Context, client *http.Client, xmlURL string, now time.Time) Result {
	if client == nil {
		client = DefaultHTTPClient(DefaultTimeout)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, xmlURL, nil)
	if err != nil {
		return Unhealthy(xmlURL, ReasonFetch, now)
	}
	req.Header.Set("User-Agent", UserAgent)
	req.Header.Set("Accept", "application/atom+xml, application/rss+xml, application/xml, text/xml, */*")

	resp, err := client.Do(req)
	if err != nil {
		return mapFetchErr(xmlURL, err, now)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return Unhealthy(xmlURL, ReasonHTTPStatus, now)
	}

	limited := io.LimitReader(resp.Body, maxBodyBytes+1)
	body, err := io.ReadAll(limited)
	if err != nil {
		return Unhealthy(xmlURL, ReasonFetch, now)
	}
	if len(body) > maxBodyBytes {
		return Unhealthy(xmlURL, ReasonTooLarge, now)
	}

	fp := gofeed.NewParser()
	feed, err := fp.ParseString(string(body))
	if err != nil {
		return Unhealthy(xmlURL, ReasonUnparseable, now)
	}
	return ScoreParsedFeed(xmlURL, feed, now)
}

func mapFetchErr(xmlURL string, err error, now time.Time) Result {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "timeout") || strings.Contains(msg, "deadline"):
		return Unhealthy(xmlURL, ReasonTimeout, now)
	case strings.Contains(msg, "x509") || strings.Contains(msg, "tls"):
		return Unhealthy(xmlURL, ReasonTLS, now)
	default:
		var dns *net.DNSError
		if errors.As(err, &dns) {
			return Unhealthy(xmlURL, ReasonDNS, now)
		}
		return Unhealthy(xmlURL, ReasonFetch, now)
	}
}

// ScoreURLs scores a list of feed URLs sequentially (CI-friendly).
func ScoreURLs(ctx context.Context, client *http.Client, urls []string, now time.Time) []Result {
	out := make([]Result, 0, len(urls))
	for _, u := range urls {
		select {
		case <-ctx.Done():
			out = append(out, Unhealthy(u, ReasonTimeout, now))
			continue
		default:
		}
		out = append(out, FetchAndScore(ctx, client, u, now))
	}
	return out
}

func FormatResultLine(r Result) string {
	if r.Health == HealthUnhealthy {
		return fmt.Sprintf("%s\thealth=%s\treason=%s", r.XMLURL, r.Health, r.Reason)
	}
	if r.Health == HealthStale {
		return fmt.Sprintf("%s\thealth=stale\treason=stale\ttitle=%q", r.XMLURL, r.Title)
	}
	if r.VelocityUnknown {
		return fmt.Sprintf("%s\thealth=ok\tvelocity=unknown\ttitle=%q", r.XMLURL, r.Title)
	}
	p1, p7, p30 := 0, 0, 0
	if r.Posts1d != nil {
		p1 = *r.Posts1d
	}
	if r.Posts7d != nil {
		p7 = *r.Posts7d
	}
	if r.Posts30d != nil {
		p30 = *r.Posts30d
	}
	return fmt.Sprintf("%s\thealth=ok\tposts=%d/%d/%d\ttitle=%q", r.XMLURL, p1, p7, p30, r.Title)
}
