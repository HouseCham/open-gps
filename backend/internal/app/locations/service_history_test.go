package locations

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

func TestGetHistoryReturnsPageAndTotal(t *testing.T) {
	from := time.Date(2026, time.August, 17, 18, 0, 0, 0, time.UTC)
	to := from.Add(2 * time.Hour)
	reader := &mockReader{history: []domain.Location{validBase()}, total: 21}

	got, total, err := New(&mockWriter{}, reader).GetHistory(context.Background(), uuid.New(), from, to, 2, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 1 || total != 21 {
		t.Fatalf("got %d locations and total %d, want 1 and 21", len(got), total)
	}
}
