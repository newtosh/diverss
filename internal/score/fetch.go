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

const htmlFetchUserAgent = "Mozilla/5.0 (compatible; DiveRSS/0.1; +https://github.com/jonn/diverss)"

func DefaultHTTPClient(timeout time.Duration) *http.Client {
	if timeout <= 0 {
		timeout = DefaultTimeout
	}
	return &http.Client{Timeout: timeout}
}

// FetchAndScore downloads and scores a single feed URL.
// On host blocks (401/403/429/503), retries with a browser-like UA, then known mirrors.
func FetchAndScore(ctx context.Context, client *http.Client, xmlURL string, now time.Time) Result {
	if client == nil {
		client = DefaultHTTPClient(DefaultTimeout)
	}

	body, err := resolveFeedBody(ctx, client, xmlURL)
	if err != nil {
		return mapResolveErr(xmlURL, err, now)
	}

	fp := gofeed.NewParser()
	feed, perr := fp.ParseString(string(body))
	if perr != nil {
		return Unhealthy(xmlURL, ReasonUnparseable, now)
	}
	return ScoreParsedFeed(xmlURL, feed, now)
}

type resolveError struct {
	reason ReasonCode
	detail string
}

func (e *resolveError) Error() string {
	if e.detail != "" {
		return e.detail
	}
	return string(e.reason)
}

func resolveFeedBody(ctx context.Context, client *http.Client, xmlURL string) ([]byte, error) {
	body, err := fetchFeedBodyWithUARetry(ctx, client, xmlURL)
	if err == nil {
		return body, nil
	}
	var re *resolveError
	if errors.As(err, &re) && re.reason == ReasonHTTPStatus && isHostBlockDetail(re.detail) {
		for _, mirror := range FeedMirrorsFor(xmlURL) {
			mb, merr := fetchFeedBodyWithUARetry(ctx, client, mirror)
			if merr == nil {
				return mb, nil
			}
		}
	}
	return nil, err
}

func fetchFeedBodyWithUARetry(ctx context.Context, client *http.Client, xmlURL string) ([]byte, error) {
	body, err := fetchFeedBodyOnce(ctx, client, xmlURL, UserAgent)
	if err == nil {
		return body, nil
	}
	var re *resolveError
	if errors.As(err, &re) && re.reason == ReasonHTTPStatus && isHostBlockDetail(re.detail) {
		retry, rerr := fetchFeedBodyOnce(ctx, client, xmlURL, htmlFetchUserAgent)
		if rerr == nil {
			return retry, nil
		}
	}
	return nil, err
}

func fetchFeedBodyOnce(ctx context.Context, client *http.Client, xmlURL, ua string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, xmlURL, nil)
	if err != nil {
		return nil, &resolveError{reason: ReasonFetch}
	}
	req.Header.Set("User-Agent", ua)
	req.Header.Set("Accept", "application/atom+xml, application/rss+xml, application/xml, text/xml, */*")
	if ua == htmlFetchUserAgent {
		req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, mapNetErr(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, &resolveError{
			reason: ReasonHTTPStatus,
			detail: fmt.Sprintf("HTTP %d", resp.StatusCode),
		}
	}

	limited := io.LimitReader(resp.Body, maxBodyBytes+1)
	body, err := io.ReadAll(limited)
	if err != nil {
		return nil, &resolveError{reason: ReasonFetch}
	}
	if len(body) > maxBodyBytes {
		return nil, &resolveError{reason: ReasonTooLarge}
	}
	return body, nil
}

func isHostBlockDetail(detail string) bool {
	return strings.Contains(detail, "HTTP 401") ||
		strings.Contains(detail, "HTTP 403") ||
		strings.Contains(detail, "HTTP 429") ||
		strings.Contains(detail, "HTTP 503")
}

func mapResolveErr(xmlURL string, err error, now time.Time) Result {
	var re *resolveError
	if errors.As(err, &re) {
		r := Unhealthy(xmlURL, re.reason, now)
		if re.detail != "" {
			r.Detail = re.detail
		}
		return r
	}
	return mapFetchErr(xmlURL, err, now)
}

func mapNetErr(err error) error {
	msg := err.Error()
	switch {
	case strings.Contains(msg, "timeout") || strings.Contains(msg, "deadline"):
		return &resolveError{reason: ReasonTimeout}
	case strings.Contains(msg, "x509") || strings.Contains(msg, "tls"):
		return &resolveError{reason: ReasonTLS}
	default:
		var dns *net.DNSError
		if errors.As(err, &dns) {
			return &resolveError{reason: ReasonDNS}
		}
		return &resolveError{reason: ReasonFetch}
	}
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
		if r.Detail != "" {
			return fmt.Sprintf("%s\thealth=%s\treason=%s\tdetail=%s", r.XMLURL, r.Health, r.Reason, r.Detail)
		}
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
