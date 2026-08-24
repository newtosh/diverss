package score

import (
	"math"
	"time"

	"github.com/mmcdole/gofeed"
)

const (
	SchemaVersion   = 1
	VelocityWindow  = 30 * 24 * time.Hour
	UserAgent       = "DiveRSS/0.1 (+https://github.com/jonn/diverss; feed-health)"
	DefaultTimeout  = 15 * time.Second
)

type HealthStatus string

const (
	HealthOK       HealthStatus = "ok"
	HealthUnhealthy HealthStatus = "unhealthy"
)

type ReasonCode string

const (
	ReasonOK          ReasonCode = "ok"
	ReasonTimeout     ReasonCode = "timeout"
	ReasonDNS         ReasonCode = "dns"
	ReasonTLS         ReasonCode = "tls"
	ReasonHTTPStatus  ReasonCode = "http_status"
	ReasonTooLarge    ReasonCode = "too_large"
	ReasonBlockedURL  ReasonCode = "blocked_url"
	ReasonUnparseable ReasonCode = "unparseable"
	ReasonFetch       ReasonCode = "fetch_error"
)

// Result is the versioned per-feed score record.
type Result struct {
	SchemaVersion   int          `json:"schemaVersion"`
	XMLURL          string       `json:"xmlUrl"`
	Health          HealthStatus `json:"health"`
	Reason          ReasonCode   `json:"reason"`
	VelocityUnknown bool         `json:"velocityUnknown"`
	PostsPerWeek    *float64     `json:"postsPerWeek,omitempty"`
	ItemCountWindow int          `json:"itemCountWindow,omitempty"`
	Title           string       `json:"title,omitempty"`
	ScoredAt        time.Time    `json:"scoredAt"`
}

// ScoreParsedFeed computes health+velocity from an already-parsed feed body.
// Fetch failures should be mapped by the caller into Unhealthy results.
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

	windowStart := now.Add(-VelocityWindow)
	datedInWindow := 0
	anyDated := false
	for _, item := range feed.Items {
		t := itemPublished(item)
		if t == nil {
			continue
		}
		anyDated = true
		if !t.Before(windowStart) && !t.After(now) {
			datedInWindow++
		}
	}

	if !anyDated {
		r.VelocityUnknown = true
		return r
	}

	ppw := float64(datedInWindow) / (float64(VelocityWindow) / float64(7*24*time.Hour))
	ppw = math.Round(ppw*100) / 100
	r.PostsPerWeek = &ppw
	r.ItemCountWindow = datedInWindow
	r.VelocityUnknown = false
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
	return nil
}
