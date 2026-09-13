package reports

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"time"

	"github.com/google/uuid"
)

const (
	GapThreshold       = 5 * time.Minute
	MinRoutePoints     = 2
	MaxJumpSpeedKPH    = 200.0
	PoorAccuracyMeters = 50.0
	MaxReportRange     = 31 * 24 * time.Hour
	MaxExportPoints    = 100_000
	MaxRoutePoints     = 1_000
)

var ErrTooManyExportPoints = errors.New("report export exceeds the maximum point limit")

// Service calculates bounded report projections from a complete authorized dataset.
type Service struct{ repo Repository }

func New(repo Repository) *Service { return &Service{repo: repo} }

func (s *Service) dataset(ctx context.Context, userID uuid.UUID, filter Filter, limit int) (Dataset, error) {
	if filter.To.Sub(filter.From) > MaxReportRange {
		return Dataset{}, errors.New("report range cannot exceed 31 days")
	}
	return s.repo.GetDataset(ctx, userID, filter, limit)
}

// Overview returns aggregate metrics and per-device summaries.
func (s *Service) Overview(ctx context.Context, userID uuid.UUID, filter Filter) (OverviewReport, error) {
	data, err := s.dataset(ctx, userID, filter, 0)
	if err != nil {
		return OverviewReport{}, fmt.Errorf("get report dataset: %w", err)
	}
	groups := groupPoints(data.Points)
	report := OverviewReport{Bucket: bucketDuration(filter.To.Sub(filter.From)), Devices: make([]DeviceSummary, 0, len(data.Devices))}
	for _, device := range data.Devices {
		points := groups[device.ID]
		distance, anomalies, first, last, longest := trackMetrics(points)
		report.Devices = append(report.Devices, DeviceSummary{Device: device, PointCount: len(points), DistanceMeters: distance, FirstReport: first, LatestReport: last, LongestGapSeconds: longest.Seconds(), JumpCount: anomalies})
		report.DeviceCount += boolToInt(len(points) > 0)
		report.PointCount += len(points)
		report.EstimatedDistanceMeters += distance
		if longest > report.LongestGap {
			report.LongestGap = longest
		}
		if len(points) > report.MostActivePointCount {
			report.MostActivePointCount, report.MostActiveDevice = len(points), device
		}
	}
	report.Series = pointSeries(data.Points, filter.From, filter.To, report.Bucket)
	return report, nil
}

// Routes creates sessions from complete ordered points and samples only their display geometry.
func (s *Service) Routes(ctx context.Context, userID uuid.UUID, filter Filter) (RoutesReport, error) {
	data, err := s.dataset(ctx, userID, filter, 0)
	if err != nil {
		return RoutesReport{}, fmt.Errorf("get route dataset: %w", err)
	}
	groups := groupPoints(data.Points)
	report := RoutesReport{Routes: []RouteSummary{}}
	for _, device := range data.Devices {
		for _, session := range sessions(groups[device.ID]) {
			distance, anomalies, _, _, _ := trackMetrics(session)
			if len(session) < MinRoutePoints {
				continue
			}
			route := RouteSummary{Device: device, StartedAt: session[0].RecordedAt, EndedAt: session[len(session)-1].RecordedAt, DurationSeconds: session[len(session)-1].RecordedAt.Sub(session[0].RecordedAt).Seconds(), DistanceMeters: distance, CompletePointCount: len(session), JumpCount: anomalies, Points: samplePoints(session, MaxRoutePoints)}
			var speedTotal, maxSpeed float64
			var speedCount int
			for _, point := range session {
				if point.Speed != nil {
					speedTotal += *point.Speed
					speedCount++
					if *point.Speed > maxSpeed {
						maxSpeed = *point.Speed
					}
				}
			}
			if speedCount > 0 {
				route.AverageSpeedMPS = speedTotal / float64(speedCount)
				route.MaximumSpeedMPS = maxSpeed
			}
			report.Routes = append(report.Routes, route)
		}
	}
	return report, nil
}

// Health calculates nullable telemetry metrics without manufacturing zero values.
func (s *Service) Health(ctx context.Context, userID uuid.UUID, filter Filter) (HealthReport, error) {
	data, err := s.dataset(ctx, userID, filter, 0)
	if err != nil {
		return HealthReport{}, fmt.Errorf("get report dataset: %w", err)
	}
	groups := groupPoints(data.Points)
	report := HealthReport{Devices: make([]DeviceHealth, 0, len(data.Devices))}
	for _, device := range data.Devices {
		points := groups[device.ID]
		health := DeviceHealth{Device: device, PointCount: len(points)}
		for _, point := range points {
			health.LatestReport = later(health.LatestReport, point.RecordedAt)
			addFloat(&health.Battery, point.BatteryVoltage)
			addInt(&health.Signal, point.SignalStrength)
			addFloat(&health.GPSAccuracy, point.Accuracy)
		}
		finalizeFloat(&health.Battery)
		finalizeInt(&health.Signal)
		finalizeFloat(&health.GPSAccuracy)
		report.Devices = append(report.Devices, health)
	}
	return report, nil
}

// Quality calculates reporting regularity and optional-field completeness.
func (s *Service) Quality(ctx context.Context, userID uuid.UUID, filter Filter) (QualityReport, error) {
	data, err := s.dataset(ctx, userID, filter, 0)
	if err != nil {
		return QualityReport{}, fmt.Errorf("get report dataset: %w", err)
	}
	groups := groupPoints(data.Points)
	report := QualityReport{Devices: make([]DeviceQuality, 0, len(data.Devices))}
	for _, device := range data.Devices {
		points := groups[device.ID]
		quality := DeviceQuality{Device: device, PointCount: len(points)}
		_, jumps, first, last, longest := trackMetrics(points)
		quality.FirstReport, quality.LatestReport, quality.LongestGapSeconds, quality.JumpCount = first, last, longest.Seconds(), jumps
		var intervals time.Duration
		for i := 1; i < len(points); i++ {
			gap := points[i].RecordedAt.Sub(points[i-1].RecordedAt)
			if gap > 0 {
				intervals += gap
				quality.IntervalCount++
				if gap > GapThreshold {
					quality.GapCount++
				}
			}
		}
		if quality.IntervalCount > 0 {
			quality.AverageIntervalSeconds = intervals.Seconds() / float64(quality.IntervalCount)
		}
		quality.OptionalPresence = completeness(points)
		quality.PoorAccuracyCount = poorAccuracy(points)
		report.Devices = append(report.Devices, quality)
	}
	return report, nil
}

func (s *Service) Export(ctx context.Context, userID uuid.UUID, filter Filter) ([]Point, error) {
	data, err := s.dataset(ctx, userID, filter, MaxExportPoints+1)
	if err != nil {
		return nil, fmt.Errorf("get report dataset: %w", err)
	}
	if len(data.Points) > MaxExportPoints {
		return nil, ErrTooManyExportPoints
	}
	sort.Slice(data.Points, func(i, j int) bool { return data.Points[i].RecordedAt.Before(data.Points[j].RecordedAt) })
	return data.Points, nil
}

type OverviewReport struct {
	DeviceCount, PointCount, MostActivePointCount int
	EstimatedDistanceMeters                       float64
	MostActiveDevice                              Device
	LongestGap                                    time.Duration
	Bucket                                        time.Duration
	Series                                        []BucketCount
	Devices                                       []DeviceSummary
}
type DeviceSummary struct {
	Device                    Device
	PointCount                int
	DistanceMeters            float64
	FirstReport, LatestReport *time.Time
	LongestGapSeconds         float64
	JumpCount                 int
}
type BucketCount struct {
	StartedAt time.Time
	Count     int
}
type RoutesReport struct{ Routes []RouteSummary }
type RouteSummary struct {
	Device                                                            Device
	StartedAt, EndedAt                                                time.Time
	DurationSeconds, DistanceMeters, AverageSpeedMPS, MaximumSpeedMPS float64
	CompletePointCount, JumpCount                                     int
	Points                                                            []Point
}
type HealthReport struct{ Devices []DeviceHealth }
type DeviceHealth struct {
	Device               Device
	LatestReport         *time.Time
	PointCount           int
	Battery, GPSAccuracy Stats
	Signal               IntStats
}
type Stats struct {
	Latest                    *float64
	Minimum, Maximum, Average *float64
	PresentCount              int
	sum                       float64
}
type IntStats struct {
	Latest           *int
	Minimum, Maximum *int
	Average          *float64
	PresentCount     int
	sum              float64
}
type DeviceQuality struct {
	Device                                                            Device
	PointCount, GapCount, PoorAccuracyCount, JumpCount, IntervalCount int
	AverageIntervalSeconds, LongestGapSeconds                         float64
	OptionalPresence                                                  OptionalPresence
	FirstReport, LatestReport                                         *time.Time
}
type OptionalPresence struct{ Altitude, Speed, Accuracy, BatteryVoltage, SignalStrength int }
type QualityReport struct{ Devices []DeviceQuality }

func groupPoints(points []Point) map[uuid.UUID][]Point {
	groups := map[uuid.UUID][]Point{}
	for _, point := range points {
		groups[point.DeviceID] = append(groups[point.DeviceID], point)
	}
	for id := range groups {
		sort.SliceStable(groups[id], func(i, j int) bool { return groups[id][i].RecordedAt.Before(groups[id][j].RecordedAt) })
	}
	return groups
}
func sessions(points []Point) [][]Point {
	if len(points) == 0 {
		return nil
	}
	result := [][]Point{{points[0]}}
	for _, point := range points[1:] {
		current := &result[len(result)-1]
		if point.RecordedAt.Sub((*current)[len(*current)-1].RecordedAt) > GapThreshold {
			result = append(result, []Point{point})
		} else {
			*current = append(*current, point)
		}
	}
	return result
}
func trackMetrics(points []Point) (float64, int, *time.Time, *time.Time, time.Duration) {
	if len(points) == 0 {
		return 0, 0, nil, nil, 0
	}
	first, last := points[0].RecordedAt, points[len(points)-1].RecordedAt
	var distance float64
	var longest time.Duration
	jumps := 0
	for i := 1; i < len(points); i++ {
		gap := points[i].RecordedAt.Sub(points[i-1].RecordedAt)
		if gap > longest {
			longest = gap
		}
		meters, valid := haversine(points[i-1], points[i])
		if !valid {
			continue
		}
		if gap > 0 && meters/gap.Seconds()*3.6 > MaxJumpSpeedKPH {
			jumps++
			continue
		}
		distance += meters
	}
	return distance, jumps, &first, &last, time.Duration(longest)
}
func haversine(a, b Point) (float64, bool) {
	if math.Abs(a.Latitude) > 90 || math.Abs(b.Latitude) > 90 || math.Abs(a.Longitude) > 180 || math.Abs(b.Longitude) > 180 {
		return 0, false
	}
	const earth = 6371000
	lat1, lat2 := a.Latitude*math.Pi/180, b.Latitude*math.Pi/180
	dlat := (b.Latitude - a.Latitude) * math.Pi / 180
	dlon := (b.Longitude - a.Longitude) * math.Pi / 180
	x := math.Sin(dlat/2)*math.Sin(dlat/2) + math.Cos(lat1)*math.Cos(lat2)*math.Sin(dlon/2)*math.Sin(dlon/2)
	return 2 * earth * math.Asin(math.Sqrt(x)), true
}
func samplePoints(points []Point, max int) []Point {
	if len(points) <= max {
		return points
	}
	sampled := make([]Point, 0, max)
	for i := 0; i < max; i++ {
		index := i * (len(points) - 1) / (max - 1)
		sampled = append(sampled, points[index])
	}
	return sampled
}
func bucketDuration(span time.Duration) time.Duration {
	switch {
	case span <= 6*time.Hour:
		return 15 * time.Minute
	case span <= 24*time.Hour:
		return time.Hour
	case span <= 7*24*time.Hour:
		return 6 * time.Hour
	default:
		return 24 * time.Hour
	}
}
func pointSeries(points []Point, from, to time.Time, bucket time.Duration) []BucketCount {
	counts := map[time.Time]int{}
	for _, p := range points {
		offset := p.RecordedAt.Sub(from)
		if offset < 0 || p.RecordedAt.After(to) {
			continue
		}
		start := from.Add((offset / bucket) * bucket)
		counts[start]++
	}
	result := make([]BucketCount, 0, len(counts))
	for start, count := range counts {
		result = append(result, BucketCount{start, count})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].StartedAt.Before(result[j].StartedAt) })
	return result
}
func later(current *time.Time, value time.Time) *time.Time {
	if current == nil || value.After(*current) {
		v := value
		return &v
	}
	return current
}

type floatAccumulator struct {
	sum      float64
	count    int
	min, max float64
	latest   *float64
}

func addFloat(stats *Stats, value *float64) {
	if value == nil {
		return
	}
	if stats.PresentCount == 0 || *value < *stats.Minimum {
		v := *value
		stats.Minimum = &v
	}
	if stats.PresentCount == 0 || *value > *stats.Maximum {
		v := *value
		stats.Maximum = &v
	}
	stats.PresentCount++
	stats.sum += *value
	stats.Latest = value
}
func finalizeFloat(stats *Stats) {
	if stats.PresentCount > 0 {
		v := stats.sum / float64(stats.PresentCount)
		stats.Average = &v
	}
}
func addInt(stats *IntStats, value *int) {
	if value == nil {
		return
	}
	if stats.PresentCount == 0 || *value < *stats.Minimum {
		v := *value
		stats.Minimum = &v
	}
	if stats.PresentCount == 0 || *value > *stats.Maximum {
		v := *value
		stats.Maximum = &v
	}
	stats.PresentCount++
	stats.sum += float64(*value)
	stats.Latest = value
}
func finalizeInt(stats *IntStats) {
	if stats.PresentCount > 0 {
		v := stats.sum / float64(stats.PresentCount)
		stats.Average = &v
	}
}
func completeness(points []Point) OptionalPresence {
	var result OptionalPresence
	for _, p := range points {
		if p.Altitude != nil {
			result.Altitude++
		}
		if p.Speed != nil {
			result.Speed++
		}
		if p.Accuracy != nil {
			result.Accuracy++
		}
		if p.BatteryVoltage != nil {
			result.BatteryVoltage++
		}
		if p.SignalStrength != nil {
			result.SignalStrength++
		}
	}
	return result
}
func poorAccuracy(points []Point) int {
	count := 0
	for _, p := range points {
		if p.Accuracy != nil && *p.Accuracy > PoorAccuracyMeters {
			count++
		}
	}
	return count
}
func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}
