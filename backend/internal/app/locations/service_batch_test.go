package locations

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// fakeBatchWriter implements Writer + BatchWriter with the batch
// behavior the service depends on: recorded batches and a switchable
// failure that stands in for a rolled-back transaction.
type fakeBatchWriter struct {
	batches [][]domain.Location
	err     error
}

func (f *fakeBatchWriter) Insert(context.Context, domain.Location) error { return f.err }

func (f *fakeBatchWriter) InsertBatch(_ context.Context, items []domain.Location) ([]uint64, error) {
	if f.err != nil {
		return nil, f.err
	}
	f.batches = append(f.batches, items)
	accepted := make([]uint64, 0, len(items))
	for _, item := range items {
		accepted = append(accepted, item.SequenceID)
	}
	return accepted, nil
}

// fakeLiveReader is a Reader + LiveReader returning a canned snapshot
// so tests can assert exactly what reaches the hub.
type fakeLiveReader struct {
	snapshot domain.LiveLocation
	liveErr  error
}

func (f *fakeLiveReader) GetLatest(context.Context, uuid.UUID) (domain.Location, error) {
	return domain.Location{}, nil
}

func (f *fakeLiveReader) GetHistory(context.Context, uuid.UUID, time.Time, time.Time, int, int) ([]domain.Location, int, error) {
	return nil, 0, nil
}

func (f *fakeLiveReader) GetRoute(context.Context, uuid.UUID, time.Time, time.Time, int) ([]domain.Location, int, bool, error) {
	return nil, 0, false, nil
}

func (f *fakeLiveReader) GetLive(context.Context, uuid.UUID, time.Time, time.Duration, float64) (domain.LiveLocation, error) {
	return f.snapshot, f.liveErr
}

type publishedEvent struct {
	deviceID uuid.UUID
	kind     string
	snapshot domain.LiveLocation
}

type fakePublisher struct {
	events []publishedEvent
}

func (f *fakePublisher) Publish(deviceID uuid.UUID, kind string, snapshot domain.LiveLocation) {
	f.events = append(f.events, publishedEvent{deviceID: deviceID, kind: kind, snapshot: snapshot})
}

func batchItem(seq uint64) domain.Location {
	loc := validBase()
	loc.SequenceID = seq
	return loc
}

// BA-05: a committed batch must reach live subscribers; the batch route
// is the primary firmware path and used to publish nothing.
func TestIngestBatch_PublishesSnapshotAfterCommit(t *testing.T) {
	w := &fakeBatchWriter{}
	live := &fakeLiveReader{snapshot: domain.LiveLocation{DeviceID: uuid.New()}}
	pub := &fakePublisher{}
	svc := New(w, live, pub)

	items := []domain.Location{batchItem(1), batchItem(2)}
	accepted, rejected, err := svc.IngestBatch(context.Background(), items)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(accepted) != 2 || len(rejected) != 0 {
		t.Fatalf("accepted=%d rejected=%d, want 2/0", len(accepted), len(rejected))
	}
	if len(pub.events) != 1 {
		t.Fatalf("publishes = %d, want 1", len(pub.events))
	}
	ev := pub.events[0]
	if ev.deviceID != items[0].DeviceID {
		t.Errorf("published deviceID = %v, want %v", ev.deviceID, items[0].DeviceID)
	}
	if ev.kind != "location" {
		t.Errorf("kind = %q, want location", ev.kind)
	}
	// The payload must be the fresh GetLive snapshot, not a raw point.
	if ev.snapshot.Location != live.snapshot.Location {
		t.Errorf("snapshot = %+v, want the committed GetLive snapshot", ev.snapshot)
	}
}

// A partially rejected batch still persists the valid points, so it
// still publishes.
func TestIngestBatch_PublishesOnPartialRejection(t *testing.T) {
	w := &fakeBatchWriter{}
	pub := &fakePublisher{}
	svc := New(w, &fakeLiveReader{snapshot: domain.LiveLocation{}}, pub)

	invalid := batchItem(2)
	invalid.Latitude = 999 // rejected by validateRanges
	_, rejected, err := svc.IngestBatch(context.Background(), []domain.Location{batchItem(1), invalid, batchItem(3)})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(rejected) != 1 || rejected[0].SequenceID != 2 {
		t.Fatalf("rejected = %+v, want only sequence 2", rejected)
	}
	if len(w.batches) != 1 || len(w.batches[0]) != 2 {
		t.Fatalf("persisted batch = %v, want the 2 valid items", w.batches)
	}
	if len(pub.events) != 1 {
		t.Fatalf("publishes = %d, want 1", len(pub.events))
	}
}

// A fully rejected batch persisted nothing — no publish.
func TestIngestBatch_NoPublishWhenNothingPersisted(t *testing.T) {
	w := &fakeBatchWriter{}
	pub := &fakePublisher{}
	svc := New(w, &fakeLiveReader{}, pub)

	bad := batchItem(1)
	bad.Latitude = -999
	if _, _, err := svc.IngestBatch(context.Background(), []domain.Location{bad}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(w.batches) != 1 || len(w.batches[0]) != 0 {
		t.Fatalf("persisted batch = %v, want empty", w.batches)
	}
	if len(pub.events) != 0 {
		t.Fatalf("publishes = %d, want 0", len(pub.events))
	}
}

// A rolled-back batch (InsertBatch error) must not publish.
func TestIngestBatch_NoPublishOnWriterError(t *testing.T) {
	w := &fakeBatchWriter{err: errors.New("db down")}
	pub := &fakePublisher{}
	svc := New(w, &fakeLiveReader{}, pub)

	if _, _, err := svc.IngestBatch(context.Background(), []domain.Location{batchItem(1)}); err == nil {
		t.Fatal("want error from failed InsertBatch")
	}
	if len(pub.events) != 0 {
		t.Fatalf("publishes = %d, want 0 after rollback", len(pub.events))
	}
}

// The single-point path keeps its publish behavior via the shared helper.
func TestIngest_PublishesSnapshot(t *testing.T) {
	pub := &fakePublisher{}
	snap := domain.LiveLocation{DeviceID: uuid.New()}
	svc := New(&mockWriter{}, &fakeLiveReader{snapshot: snap}, pub)

	if err := svc.Ingest(context.Background(), validBase()); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(pub.events) != 1 {
		t.Fatalf("publishes = %d, want 1", len(pub.events))
	}
	if pub.events[0].snapshot.DeviceID != snap.DeviceID {
		t.Errorf("snapshot = %+v, want the GetLive snapshot", pub.events[0].snapshot)
	}
}

// raceFreeWriter touches no shared state, so concurrent test requests
// can pass through it without tripping the race detector.
type raceFreeWriter struct{}

func (raceFreeWriter) Insert(context.Context, domain.Location) error { return nil }

func (raceFreeWriter) InsertBatch(_ context.Context, items []domain.Location) ([]uint64, error) {
	accepted := make([]uint64, 0, len(items))
	for _, item := range items {
		accepted = append(accepted, item.SequenceID)
	}
	return accepted, nil
}

// sequencingLiveReader returns a snapshot whose Location.RecordedAt
// advances on every call, so the test can check that publish order is
// monotonic in freshness.
type sequencingLiveReader struct {
	mu    sync.Mutex
	calls int
}

func (f *sequencingLiveReader) GetLatest(context.Context, uuid.UUID) (domain.Location, error) {
	return domain.Location{}, nil
}

func (f *sequencingLiveReader) GetHistory(context.Context, uuid.UUID, time.Time, time.Time, int, int) ([]domain.Location, int, error) {
	return nil, 0, nil
}

func (f *sequencingLiveReader) GetRoute(context.Context, uuid.UUID, time.Time, time.Time, int) ([]domain.Location, int, bool, error) {
	return nil, 0, false, nil
}

func (f *sequencingLiveReader) GetLive(_ context.Context, deviceID uuid.UUID, _ time.Time, _ time.Duration, _ float64) (domain.LiveLocation, error) {
	f.mu.Lock()
	f.calls++
	n := f.calls
	f.mu.Unlock()
	at := time.Date(2026, 1, 1, 0, 0, n, 0, time.UTC)
	return domain.LiveLocation{
		DeviceID: deviceID,
		Location: &domain.Location{DeviceID: deviceID, RecordedAt: at},
	}, nil
}

// gatedPublisher parks the first Publish until the test releases it,
// holding the read-and-publish window open so a second request can
// interleave — the exact race the review flagged.
type gatedPublisher struct {
	mu           sync.Mutex
	parked       bool
	events       []publishedEvent
	firstEntered chan struct{}
	releaseFirst chan struct{}
}

func newGatedPublisher() *gatedPublisher {
	return &gatedPublisher{
		firstEntered: make(chan struct{}),
		releaseFirst: make(chan struct{}),
	}
}

func (f *gatedPublisher) Publish(deviceID uuid.UUID, kind string, snapshot domain.LiveLocation) {
	f.mu.Lock()
	first := !f.parked
	if first {
		f.parked = true
	}
	f.mu.Unlock()
	if first {
		close(f.firstEntered)
		<-f.releaseFirst
	}
	f.mu.Lock()
	f.events = append(f.events, publishedEvent{deviceID: deviceID, kind: kind, snapshot: snapshot})
	f.mu.Unlock()
}

// Review BA-05: the hub preserves call order, not location freshness.
// Two concurrent ingests must not deliver an older snapshot after a
// newer one; the service serializes read-and-publish per device.
func TestIngest_ConcurrentPublishesKeepFreshnessOrder(t *testing.T) {
	deviceID := uuid.New()
	reader := &sequencingLiveReader{}
	pub := newGatedPublisher()
	svc := New(raceFreeWriter{}, reader, pub)

	itemA := batchItem(1)
	itemA.DeviceID = deviceID
	itemB := batchItem(2)
	itemB.DeviceID = deviceID

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		_, _, _ = svc.IngestBatch(context.Background(), []domain.Location{itemA})
	}()
	// Request A is now parked inside Publish, holding the device lock.
	<-pub.firstEntered

	go func() {
		defer wg.Done()
		_, _, _ = svc.IngestBatch(context.Background(), []domain.Location{itemB})
	}()
	// Without the lock B races through GetLive+Publish while A is
	// parked and records the newer snapshot first; with the lock B
	// waits for A and the order stays fresh.
	time.Sleep(50 * time.Millisecond)
	close(pub.releaseFirst)
	wg.Wait()

	pub.mu.Lock()
	defer pub.mu.Unlock()
	if len(pub.events) != 2 {
		t.Fatalf("publishes = %d, want 2", len(pub.events))
	}
	var last time.Time
	for i, ev := range pub.events {
		if ev.snapshot.Location == nil {
			t.Fatalf("publish %d has no location", i)
		}
		got := ev.snapshot.Location.RecordedAt
		if got.Before(last) {
			t.Fatalf("publish %d went backwards: %s after %s", i, got, last)
		}
		last = got
	}
}
