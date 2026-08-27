package score

import (
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/mmcdole/gofeed"
)

const (
	SchemaVersion  = 2
	UserAgent      = "GardenRSS/0.1 (+https://github.com/newtosh/gardenrss; feed-health)"
	DefaultTimeout = 15 * time.Second

	Window1d  = 24 * time.Hour
	Window7d  = 7 * 24 * time.Hour
	Window30d = 30 * 24 * time.Hour
	Window90d = 90 * 24 * time.Hour
)

type HealthStatus string

const (
	HealthOK        HealthStatus = "ok"
	HealthStale     HealthStatus = "stale"
	HealthUnhealthy HealthStatus = "unhealthy"
)

type ReasonCode string

const (
	ReasonOK          ReasonCode = "ok"
	ReasonStale       ReasonCode = "stale"
	ReasonTimeout     ReasonCode = "timeout"
	ReasonDNS         ReasonCode = "dns"
	ReasonTLS         ReasonCode = "tls"
	ReasonHTTPStatus  ReasonCode = "http_status"
	ReasonTooLarge    ReasonCode = "too_large"
	ReasonBlockedURL  ReasonCode = "blocked_url"
	ReasonUnparseable ReasonCode = "unparseable"
	ReasonFetch       ReasonCode = "fetch_error"
)

// Result is the versioned per-feed score record (schemaVersion 2).
type Result struct {
	SchemaVersion   int          `json:"schemaVersion"`
	XMLURL          string       `json:"xmlUrl"`
	Health          HealthStatus `json:"health"`
	Reason          ReasonCode   `json:"reason"`
	VelocityUnknown bool         `json:"velocityUnknown"`
	Posts1d         *int         `json:"posts1d,omitempty"`
	Posts7d         *int         `json:"posts7d,omitempty"`
	Posts30d        *int         `json:"posts30d,omitempty"`
	AvgWords        *float64     `json:"avgWords,omitempty"`
	LastDatedAt     *time.Time   `json:"lastDatedAt,omitempty"`
	Title           string       `json:"title,omitempty"`
	Detail          string       `json:"detail,omitempty"`
	ScoredAt        time.Time    `json:"scoredAt"`
}

var tagStripper = regexp.MustCompile(`(?s)<[^>]*>`)

// ScoreParsedFeed computes health + multi-window cadence + word burden.
func ScoreParsedFeed(xmlURL string, feed *gofeed.Feed, now time.Time) Result {
	r := Result{
		SchemaVersion: SchemaVersion,
		XMLURL:        xmlURL,
		Health:        HealthOK,
		Reason:        ReasonOK,
		ScoredAt:      now.UTC(),
	}
	if feed == nil {
		r.Health = HealthUnhealthy
		r.Reason = ReasonUnparseable
		r.VelocityUnknown = true
		return r
	}
	if feed.Title != "" {
		r.Title = feed.Title
	}

	start1 := now.Add(-Window1d)
	start7 := now.Add(-Window7d)
	start30 := now.Add(-Window30d)
	start90 := now.Add(-Window90d)

	var posts1, posts7, posts30, posts90 int
	var anyDated bool
	var lastDated *time.Time
	var wordSum int
	var wordItems int

	for _, item := range feed.Items {
		t := itemPublished(item)
		if t == nil {
			continue
		}
		anyDated = true
		if lastDated == nil || t.After(*lastDated) {
			cp := *t
			lastDated = &cp
		}
		if !t.Before(start1) && !t.After(now) {
			posts1++
		}
		if !t.Before(start7) && !t.After(now) {
			posts7++
		}
		if !t.Before(start30) && !t.After(now) {
			posts30++
		}
		if !t.Before(start90) && !t.After(now) {
			posts90++
		}
		if n := wordCount(bestItemText(item)); n > 0 {
			wordSum += n
			wordItems++
		}
	}

	if !anyDated {
		// No publish dates (even after permalink inference): treat as stale
		// so OPML owners get Fix URL instead of silent cadence-unknown healthy.
		r.Health = HealthStale
		r.Reason = ReasonStale
		r.VelocityUnknown = true
		return r
	}

	r.Posts1d = &posts1
	r.Posts7d = &posts7
	r.Posts30d = &posts30
	r.VelocityUnknown = false
	if lastDated != nil {
		utc := lastDated.UTC()
		r.LastDatedAt = &utc
	}
	if wordItems > 0 {
		avg := float64(wordSum) / float64(wordItems)
		avg = float64(int(avg*100+0.5)) / 100
		r.AvgWords = &avg
	}

	if posts90 == 0 {
		r.Health = HealthStale
		r.Reason = ReasonStale
	}
	return r
}

func Unhealthy(xmlURL string, reason ReasonCode, now time.Time) Result {
	return Result{
		SchemaVersion:   SchemaVersion,
		XMLURL:          xmlURL,
		Health:          HealthUnhealthy,
		Reason:          reason,
		VelocityUnknown: true,
		ScoredAt:        now.UTC(),
	}
}

func itemPublished(item *gofeed.Item) *time.Time {
	if item == nil {
		return nil
	}
	if item.PublishedParsed != nil {
		return item.PublishedParsed
	}
	if item.UpdatedParsed != nil {
		return item.UpdatedParsed
	}
	if t := inferDateFromPermalink(item.Link); t != nil {
		return t
	}
	return nil
}

// inferDateFromPermalink reads /YYYY/MM/DD/ or /YYYY-MM-DD/ from item links.
func inferDateFromPermalink(link string) *time.Time {
	if link == "" {
		return nil
	}
	path := link
	if u, err := url.Parse(link); err == nil {
		path = u.Path
	}
	reSlash := regexp.MustCompile(`/((?:19|20)\d{2})/([01]?\d)/([0-3]?\d)(?:/|$)`)
	reDash := regexp.MustCompile(`/((?:19|20)\d{2})-([01]?\d)-([0-3]?\d)(?:/|$)`)
	m := reSlash.FindStringSubmatch(path)
	if m == nil {
		m = reDash.FindStringSubmatch(path)
	}
	if m == nil {
		return nil
	}
	y, _ := strconv.Atoi(m[1])
	mo, _ := strconv.Atoi(m[2])
	d, _ := strconv.Atoi(m[3])
	if mo < 1 || mo > 12 || d < 1 || d > 31 {
		return nil
	}
	t := time.Date(y, time.Month(mo), d, 0, 0, 0, 0, time.UTC)
	if t.Year() != y || int(t.Month()) != mo || t.Day() != d {
		return nil
	}
	return &t
}

func bestItemText(item *gofeed.Item) string {
	if item == nil {
		return ""
	}
	if item.Content != "" {
		return item.Content
	}
	if item.Description != "" {
		return item.Description
	}
	return ""
}

func wordCount(raw string) int {
	plain := tagStripper.ReplaceAllString(raw, " ")
	plain = htmlEntityRough(plain)
	n := 0
	inWord := false
	for _, r := range plain {
		if unicode.IsSpace(r) {
			inWord = false
			continue
		}
		if !inWord {
			n++
			inWord = true
		}
	}
	return n
}

func htmlEntityRough(s string) string {
	s = strings.ReplaceAll(s, "&nbsp;", " ")
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;", "\"")
	return s
}
