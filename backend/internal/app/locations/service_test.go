package locations

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/domain"
)

// mockWriter records every Insert call so the tests can assert exactly
// what the service forwarded. We deliberately do NOT fake a DB layer:
// the service range-checks happen before persistence and that is what
// the tests care about.
type mockWriter struct {
	calls []domain.Location
	err   error
}

func (m *mockWriter) Insert(_ context.Context, loc domain.Location) error {
	m.calls = append(m.calls, loc)
	return m.err
}

// mockReader is the no-op Reader used by every Ingest unit test — Ingest
// never touches the read path. The GetLatest tests swap in their own
// reader to control the returned location / error.
type mockReader struct {
	loc     domain.Location
	err     error
	history []domain.Location
	total   int
}

func (m *mockReader) GetLatest(_ context.Context, _ uuid.UUID) (domain.Location, error) {
	return m.loc, m.err
}

func (m *mockReader) GetHistory(context.Context, uuid.UUID, time.Time, time.Time, int, int) ([]domain.Location, int, error) {
	return m.history, m.total, nil
}

func (m *mockReader) GetRoute(context.Context, uuid.UUID, time.Time, time.Time, int) ([]domain.Location, int, bool, error) {
	return m.history, m.total, false, nil
}

func validBase() domain.Location {
	return domain.Location{
		DeviceID:   uuid.New(),
		RecordedAt: time.Now(),
		Latitude:   19.432608,
		Longitude:  -99.133207,
	}
}

func TestIngest_AcceptsValidPayload(t *testing.T) {
	w := &mockWriter{}
	svc := New(w, &mockReader{})

	in := validBase()
	if err := svc.Ingest(context.Background(), in); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(w.calls) != 1 {
		t.Fatalf("writer.Insert calls = %d, want 1", len(w.calls))
	}
	if w.calls[0].DeviceID != in.DeviceID {
		t.Errorf("DeviceID not forwarded: got %v want %v", w.calls[0].DeviceID, in.DeviceID)
	}
}

func TestIngest_RejectsOutOfRangeLatitude(t *testing.T) {
	cases := []float64{-90.1, -200, 91, 200}
	for _, lat := range cases {
		t.Run("", func(tt *testing.T) {
			w := &mockWriter{}
			in := validBase()
			in.Latitude = lat
			if err := New(w, &mockReader{}).Ingest(context.Background(), in); !errors.Is(err, ErrInvalidLatitude) {
				tt.Fatalf("latitude=%v: got %v want ErrInvalidLatitude", lat, err)
			}
			if len(w.calls) != 0 {
				tt.Errorf("writer should not be called for invalid payload, got %d calls", len(w.calls))
			}
		})
	}
}

func TestIngest_RejectsOutOfRangeLongitude(t *testing.T) {
	cases := []float64{-180.1, -200, 181, 200}
	for _, lon := range cases {
		t.Run("", func(tt *testing.T) {
			w := &mockWriter{}
			in := validBase()
			in.Longitude = lon
			if err := New(w, &mockReader{}).Ingest(context.Background(), in); !errors.Is(err, ErrInvalidLongitude) {
				tt.Fatalf("longitude=%v: got %v want ErrInvalidLongitude", lon, err)
			}
		})
	}
}

func TestIngest_AcceptsBoundaryAltitudes(t *testing.T) {
	w := &mockWriter{}
	minAlt := MinAltitudeMeters
	maxAlt := MaxAltitudeMeters

	for _, alt := range []float64{minAlt - 1, minAlt, maxAlt, maxAlt + 1} {
		in := validBase()
		a := alt
		in.Altitude = &a
		err := New(w, &mockReader{}).Ingest(context.Background(), in)
		if alt == minAlt || alt == maxAlt {
			if err != nil {
				t.Errorf("altitude=%v should be accepted, got %v", alt, err)
			}
		} else {
			if !errors.Is(err, ErrInvalidAltitude) {
				t.Errorf("altitude=%v should be rejected, got %v", alt, err)
			}
		}
	}
}

func TestIngest_RejectsNegativeSpeed(t *testing.T) {
	w := &mockWriter{}
	in := validBase()
	s := -0.01
	in.Speed = &s
	if err := New(w, &mockReader{}).Ingest(context.Background(), in); !errors.Is(err, ErrInvalidSpeed) {
		t.Fatalf("got %v want ErrInvalidSpeed", err)
	}
}

func TestIngest_RejectsNegativeAccuracy(t *testing.T) {
	w := &mockWriter{}
	in := validBase()
	a := -5.0
	in.Accuracy = &a
	if err := New(w, &mockReader{}).Ingest(context.Background(), in); !errors.Is(err, ErrInvalidAccuracy) {
		t.Fatalf("got %v want ErrInvalidAccuracy", err)
	}
}

func TestIngest_BatteryVoltageBoundaries(t *testing.T) {
	cases := []struct {
		volts   float64
		wantErr error
	}{
		{0, nil}, {3.7, nil}, {6.0, nil},
		{-0.01, ErrInvalidBatteryVoltage},
		{6.01, ErrInvalidBatteryVoltage},
	}
	for _, c := range cases {
		w := &mockWriter{}
		in := validBase()
		v := c.volts
		in.BatteryVoltage = &v
		got := New(w, &mockReader{}).Ingest(context.Background(), in)
		if c.wantErr == nil && got != nil {
			t.Errorf("volts=%v: got %v want nil", c.volts, got)
		}
		if c.wantErr != nil && !errors.Is(got, c.wantErr) {
			t.Errorf("volts=%v: got %v want %v", c.volts, got, c.wantErr)
		}
	}
}

func TestIngest_SignalStrengthBoundaries(t *testing.T) {
	cases := []struct {
		rssi    int
		wantErr error
	}{
		{0, nil}, {23, nil}, {31, nil},
		{-1, ErrInvalidSignalStrength},
		{32, ErrInvalidSignalStrength},
	}
	for _, c := range cases {
		w := &mockWriter{}
		in := validBase()
		r := c.rssi
		in.SignalStrength = &r
		got := New(w, &mockReader{}).Ingest(context.Background(), in)
		if c.wantErr == nil && got != nil {
			t.Errorf("rssi=%v: got %v want nil", c.rssi, got)
		}
		if c.wantErr != nil && !errors.Is(got, c.wantErr) {
			t.Errorf("rssi=%v: got %v want %v", c.rssi, got, c.wantErr)
		}
	}
}

func TestIngest_AcceptsNilOptionalFields(t *testing.T) {
	w := &mockWriter{}
	in := validBase()
	// All five optional fields stay nil — the device might not have
	// every sensor reading on every cycle.
	if err := New(w, &mockReader{}).Ingest(context.Background(), in); err != nil {
		t.Fatalf("got %v want nil", err)
	}
}

func TestIngest_PropagatesWriterError(t *testing.T) {
	w := &mockWriter{err: errors.New("db down")}
	svc := New(w, &mockReader{})
	if err := svc.Ingest(context.Background(), validBase()); err == nil {
		t.Fatal("expected writer error to propagate")
	}
}

func TestGetLatest_ReturnsReaderLocation(t *testing.T) {
	now := time.Now().UTC()
	want := domain.Location{
		DeviceID:   uuid.New(),
		RecordedAt: now,
		Latitude:   19.4326,
		Longitude:  -99.1332,
	}
	r := &mockReader{loc: want}
	svc := New(&mockWriter{}, r)

	got, err := svc.GetLatest(context.Background(), want.DeviceID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.DeviceID != want.DeviceID || got.RecordedAt != want.RecordedAt {
		t.Errorf("got %+v want %+v", got, want)
	}
}

func TestGetLatest_PreservesErrNotFound(t *testing.T) {
	// The handler matches on errors.Is(err, domain.ErrNotFound); the
	// service's fmt.Errorf wrap must keep the sentinel reachable.
	r := &mockReader{err: domain.ErrNotFound}
	svc := New(&mockWriter{}, r)

	_, err := svc.GetLatest(context.Background(), uuid.New())
	if !errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("got %v want domain.ErrNotFound", err)
	}
}

func TestGetLatest_PropagatesOtherErrors(t *testing.T) {
	r := &mockReader{err: errors.New("db down")}
	svc := New(&mockWriter{}, r)

	_, err := svc.GetLatest(context.Background(), uuid.New())
	if err == nil || errors.Is(err, domain.ErrNotFound) {
		t.Fatalf("expected wrapped db-down error, got %v", err)
	}
}
