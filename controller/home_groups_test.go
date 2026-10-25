package controller

import "testing"

func TestParseHomeGroupsHours(t *testing.T) {
	cases := map[string]int{
		"":      1,
		"abc":   1,
		"0":     1,
		"-5":    1,
		"6":     6,
		"24":    24,
		"720":   24,
		"99999": 24,
	}
	for raw, want := range cases {
		if got := parseHomeGroupsHours(raw); got != want {
			t.Errorf("parseHomeGroupsHours(%q) = %d, want %d", raw, got, want)
		}
	}
}
