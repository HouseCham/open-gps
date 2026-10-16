package reports

import (
	"context"
	"errors"
	"math"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestHaversineKnownCoordinateDistance(t *testing.T) {
	meters, valid := haversine(Point{Latitude: 0, Longitude: 0}, Point{Latitude: 0, Longitude: 1})
	if !valid {
		t.Fatal("expected valid coordinates")
	}
	if math.Abs(meters-111194.9) > 100 {
		t.Fatalf("distance = %.1f, want approximately 111194.9", meters)
	}
}

func TestTrackMetricsExcludesImplausibleJump(t *testing.T) {
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	points := []Point{{RecordedAt: start, Latitude: 0, Longitude: 0}, {RecordedAt: start.Add(time.Minute), Latitude: 1, Longitude: 0}}
	distance, jumps, _, _, _ := trackMetrics(points)
	if distance != 0 || jumps != 1 {
		t.Fatalf("distance=%v jumps=%d, want distance=0 and one jump", distance, jumps)
	}
}

func TestSessionsSplitAfterGapThreshold(t *testing.T) {
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	points := []Point{{RecordedAt: start}, {RecordedAt: start.Add(time.Minute)}, {RecordedAt: start.Add(2 * GapThreshold)}}
	result := sessions(points)
	if len(result) != 2 {
		t.Fatalf("sessions=%d, want 2", len(result))
	}
}

func TestHaversineRejectsInvalidCoordinates(t *testing.T) {
	tests := []struct {
		name string
		from Point
		to   Point
	}{
		{name: "latitude below minimum", from: Point{Latitude: -91}, to: Point{}},
		{name: "latitude above maximum", from: Point{}, to: Point{Latitude: 91}},
		{name: "longitude below minimum", from: Point{Longitude: -181}, to: Point{}},
		{name: "longitude above maximum", from: Point{}, to: Point{Longitude: 181}},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			meters, valid := haversine(test.from, test.to)
			if valid || meters != 0 {
				t.Fatalf("haversine() = (%v, %v), want (0, false)", meters, valid)
			}
		})
	}
}

func TestCompletenessCountsOnlyPresentOptionalValues(t *testing.T) {
	altitude, speed, accuracy, battery, signal := 1.0, 2.0, 3.0, 4.0, 5
	result := completeness([]Point{{Altitude: &altitude, Speed: &speed, Accuracy: &accuracy, BatteryVoltage: &battery, SignalStrength: &signal}, {}})
	want := OptionalPresence{Altitude: 1, Speed: 1, Accuracy: 1, BatteryVoltage: 1, SignalStrength: 1}
	if result != want {
		t.Fatalf("completeness() = %+v, want %+v", result, want)
	}
}

func TestPoorAccuracyUsesStrictThreshold(t *testing.T) {
	acceptable, poor := PoorAccuracyMeters, PoorAccuracyMeters+1
	result := poorAccuracy([]Point{{Accuracy: &acceptable}, {Accuracy: &poor}, {}})
	if result != 1 {
		t.Fatalf("poorAccuracy() = %d, want 1", result)
	}
}

// fakeDatasetRepo implements Repository and records the requested limits.
type fakeDatasetRepo struct {
	dataset     Dataset
	limit       int
	deviceLimit int
}

func (f *fakeDatasetRepo) GetDataset(_ context.Context, _ uuid.UUID, _ Filter, limit, deviceLimit int) (Dataset, error) {
	f.limit = limit
	f.deviceLimit = deviceLimit
	return f.dataset, nil
}

func budgetFilter() Filter {
	from := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	return Filter{From: from, To: from.Add(24 * time.Hour)}
}

func pointsFor(n int) []Point {
	device := uuid.UUID{}
	start := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	points := make([]Point, n)
	for i := range points {
		points[i] = Point{DeviceID: device, RecordedAt: start.Add(time.Duration(i) * time.Second)}
	}
	return points
}

func TestOverviewRequestsSQLBoundedRead(t *testing.T) {
	repo := &fakeDatasetRepo{dataset: Dataset{Devices: []Device{{ID: uuid.UUID{}}}, Points: pointsFor(3)}}
	service := New(repo)
	if _, err := service.Overview(context.Background(), uuid.UUID{}, budgetFilter()); err != nil {
		t.Fatalf("Overview() error = %v", err)
	}
	if repo.limit != MaxReportPoints+1 {
		t.Fatalf("repo limit = %d, want %d", repo.limit, MaxReportPoints+1)
	}
	if repo.deviceLimit != MaxReportDevices+1 {
		t.Fatalf("repo deviceLimit = %d, want %d", repo.deviceLimit, MaxReportDevices+1)
	}
}

func TestOverviewRejectsPointsOverBudget(t *testing.T) {
	repo := &fakeDatasetRepo{dataset: Dataset{Devices: []Device{{ID: uuid.UUID{}}}, Points: pointsFor(MaxReportPoints + 1)}}
	service := New(repo)
	if _, err := service.Overview(context.Background(), uuid.UUID{}, budgetFilter()); !errors.Is(err, ErrTooManyReportPoints) {
		t.Fatalf("Overview() error = %v, want ErrTooManyReportPoints", err)
	}
}

func TestOverviewAllowsExactlyAtBudget(t *testing.T) {
	repo := &fakeDatasetRepo{dataset: Dataset{Devices: []Device{{ID: uuid.UUID{}}}, Points: pointsFor(MaxReportPoints)}}
	service := New(repo)
	report, err := service.Overview(context.Background(), uuid.UUID{}, budgetFilter())
	if err != nil {
		t.Fatalf("Overview() error = %v", err)
	}
	if report.PointCount != MaxReportPoints {
		t.Fatalf("PointCount = %d, want %d", report.PointCount, MaxReportPoints)
	}
}

func TestOverviewRejectsTooManyDevices(t *testing.T) {
	devices := make([]Device, MaxReportDevices+1)
	for i := range devices {
		devices[i] = Device{ID: uuid.UUID{}}
	}
	repo := &fakeDatasetRepo{dataset: Dataset{Devices: devices}}
	service := New(repo)
	if _, err := service.Overview(context.Background(), uuid.UUID{}, budgetFilter()); !errors.Is(err, ErrTooManyReportDevices) {
		t.Fatalf("Overview() error = %v, want ErrTooManyReportDevices", err)
	}
}

func TestRoutesSharesPointBudget(t *testing.T) {
	repo := &fakeDatasetRepo{dataset: Dataset{Devices: []Device{{ID: uuid.UUID{}}}, Points: pointsFor(MaxReportPoints + 1)}}
	service := New(repo)
	if _, err := service.Routes(context.Background(), uuid.UUID{}, budgetFilter()); !errors.Is(err, ErrTooManyReportPoints) {
		t.Fatalf("Routes() error = %v, want ErrTooManyReportPoints", err)
	}
}

func TestHealthAndQualityShareDeviceBudget(t *testing.T) {
	devices := make([]Device, MaxReportDevices+1)
	for i := range devices {
		devices[i] = Device{ID: uuid.UUID{}}
	}
	repo := &fakeDatasetRepo{dataset: Dataset{Devices: devices}}
	service := New(repo)
	if _, err := service.Health(context.Background(), uuid.UUID{}, budgetFilter()); !errors.Is(err, ErrTooManyReportDevices) {
		t.Fatalf("Health() error = %v, want ErrTooManyReportDevices", err)
	}
	if _, err := service.Quality(context.Background(), uuid.UUID{}, budgetFilter()); !errors.Is(err, ErrTooManyReportDevices) {
		t.Fatalf("Quality() error = %v, want ErrTooManyReportDevices", err)
	}
}

func TestExportKeepsItsOwnBudget(t *testing.T) {
	repo := &fakeDatasetRepo{dataset: Dataset{Points: pointsFor(MaxExportPoints + 1)}}
	service := New(repo)
	if _, err := service.Export(context.Background(), uuid.UUID{}, budgetFilter()); !errors.Is(err, ErrTooManyExportPoints) {
		t.Fatalf("Export() error = %v, want ErrTooManyExportPoints", err)
	}
	if repo.limit != MaxExportPoints+1 {
		t.Fatalf("repo limit = %d, want %d", repo.limit, MaxExportPoints+1)
	}
	if repo.deviceLimit != 0 {
		t.Fatalf("repo deviceLimit = %d, want 0 (export keeps no device cap)", repo.deviceLimit)
	}
}
