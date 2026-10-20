package handlers

import (
	"math"
	"testing"
)

func TestClampPage(t *testing.T) {
	tests := []struct {
		name     string
		page     int
		pageSize int
		want     int
	}{
		{"first page passes through", 1, 20, 1},
		{"ordinary page passes through", 50, 20, 50},
		{"max int32 offset at page size 1", math.MaxInt32 + 1, 1, math.MaxInt32 + 1},
		{"one past max int32 offset at page size 1", math.MaxInt32 + 2, 1, math.MaxInt32 + 1},
		{"max int32 offset at page size 20", math.MaxInt32/20 + 1, 20, math.MaxInt32/20 + 1},
		{"one past max int32 offset at page size 20", math.MaxInt32/20 + 2, 20, math.MaxInt32/20 + 1},
		{"max int32 offset at page size 100", math.MaxInt32/100 + 1, 100, math.MaxInt32/100 + 1},
		{"absurd page is clamped", math.MaxInt, 20, math.MaxInt32/20 + 1},
		{"absurd page size one is clamped", math.MaxInt, 1, math.MaxInt32 + 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := clampPage(tt.page, tt.pageSize)
			if got != tt.want {
				t.Fatalf("clampPage(%d, %d) = %d, want %d", tt.page, tt.pageSize, got, tt.want)
			}
			// The contract every adapter relies on: the resulting
			// offset fits sqlc's int32 without wrapping.
			offset := (got - 1) * tt.pageSize
			if offset > math.MaxInt32 {
				t.Fatalf("offset %d exceeds int32 for page=%d size=%d", offset, got, tt.pageSize)
			}
		})
	}
}
