package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/jonn/diverss/internal/score"
)

func main() {
	dirPath := flag.String("directory", "data/directory.json", "path to directory.json")
	outPath := flag.String("out", "", "write JSON results to file (default stdout)")
	timeout := flag.Duration("timeout", score.DefaultTimeout, "per-feed HTTP timeout")
	flag.Parse()

	raw, err := os.ReadFile(*dirPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "read directory: %v\n", err)
		os.Exit(1)
	}
	var dir struct {
		Feeds []struct {
			XMLURL string `json:"xmlUrl"`
		} `json:"feeds"`
	}
	if err := json.Unmarshal(raw, &dir); err != nil {
		fmt.Fprintf(os.Stderr, "parse directory: %v\n", err)
		os.Exit(1)
	}
	urls := make([]string, 0, len(dir.Feeds))
	for _, f := range dir.Feeds {
		if f.XMLURL != "" {
			urls = append(urls, f.XMLURL)
		}
	}

	now := time.Now().UTC()
	client := score.DefaultHTTPClient(*timeout)
	results := score.ScoreURLs(context.Background(), client, urls, now)

	payload := map[string]any{
		"schemaVersion": score.SchemaVersion,
		"generatedAt":   now,
		"results":       results,
	}
	enc, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "encode: %v\n", err)
		os.Exit(1)
	}
	if *outPath == "" {
		os.Stdout.Write(enc)
		fmt.Println()
		return
	}
	if err := os.WriteFile(*outPath, append(enc, '\n'), 0o644); err != nil {
		fmt.Fprintf(os.Stderr, "write: %v\n", err)
		os.Exit(1)
	}
}
