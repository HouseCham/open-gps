package reports

import (
	"math"
	"testing"
	"time"
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
