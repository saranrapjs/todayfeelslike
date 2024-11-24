package main

import (
	"testing"
)

func TestMatch(t *testing.T) {
	m, day := match("today feels like the tuesdayest saturday since the week we had")
	if !m {
		t.Error("expected a match")
	}
	if day != "tuesday" {
		t.Errorf("expected '%s' got '%s'\n", "tuesday", day)
	}
}

func TestNonMatch(t *testing.T) {
	m, day := match("Today feels like a good day for coffee, thrifting, and ending with a new book! 💙 Happy Saturday Bluesky 🫶")
	if m {
		t.Errorf("expected no match, got: %s", day)
	}
}
