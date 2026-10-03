package dto

import (
	"time"

	"github.com/HouseCham/gps-tracker/backend/internal/app/reports"
)

type ReportDevice struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	VehicleType string `json:"vehicle_type"`
}
type ReportPoint struct {
	DeviceID       string    `json:"device_id"`
	RecordedAt     time.Time `json:"recorded_at"`
	Latitude       float64   `json:"latitude"`
	Longitude      float64   `json:"longitude"`
	Altitude       *float64  `json:"altitude"`
	Speed          *float64  `json:"speed"`
	Accuracy       *float64  `json:"accuracy"`
	BatteryVoltage *float64  `json:"battery_voltage"`
	SignalStrength *int      `json:"signal_strength"`
}
type OverviewReportResponse struct {
	DeviceCount          int                     `json:"device_count"`
	PointCount           int                     `json:"point_count"`
	EstimatedDistanceKm  float64                 `json:"estimated_distance_km"`
	MostActiveDevice     *ReportDevice           `json:"most_active_device,omitempty"`
	MostActivePointCount int                     `json:"most_active_point_count"`
	LongestGapSeconds    float64                 `json:"longest_gap_seconds"`
	BucketSeconds        int                     `json:"bucket_seconds"`
	Series               []BucketResponse        `json:"series"`
	Devices              []DeviceSummaryResponse `json:"devices"`
	Metadata             ReportMetadata          `json:"metadata"`
}
type BucketResponse struct {
	StartedAt time.Time `json:"started_at"`
	Count     int       `json:"count"`
}
type DeviceSummaryResponse struct {
	Device              ReportDevice `json:"device"`
	PointCount          int          `json:"point_count"`
	EstimatedDistanceKm float64      `json:"estimated_distance_km"`
	FirstReport         *time.Time   `json:"first_report"`
	LatestReport        *time.Time   `json:"latest_report"`
	LongestGapSeconds   float64      `json:"longest_gap_seconds"`
	JumpCount           int          `json:"jump_count"`
}
type RouteResponse struct {
	Device             ReportDevice  `json:"device"`
	StartedAt          time.Time     `json:"started_at"`
	EndedAt            time.Time     `json:"ended_at"`
	DurationSeconds    float64       `json:"duration_seconds"`
	DistanceKm         float64       `json:"distance_km"`
	AverageSpeedKph    float64       `json:"average_speed_kph"`
	MaximumSpeedKph    float64       `json:"maximum_speed_kph"`
	CompletePointCount int           `json:"complete_point_count"`
	ReturnedPointCount int           `json:"returned_point_count"`
	JumpCount          int           `json:"jump_count"`
	Sampled            bool          `json:"sampled"`
	Points             []ReportPoint `json:"points"`
}
type RoutesReportResponse struct {
	Routes   []RouteResponse `json:"routes"`
	Metadata ReportMetadata  `json:"metadata"`
}
type HealthReportResponse struct {
	Devices  []DeviceHealthResponse `json:"devices"`
	Metadata ReportMetadata         `json:"metadata"`
}
type DeviceHealthResponse struct {
	Device       ReportDevice           `json:"device"`
	LatestReport *time.Time             `json:"latest_report"`
	PointCount   int                    `json:"point_count"`
	Battery      TelemetryFloatResponse `json:"battery_voltage"`
	Signal       TelemetryIntResponse   `json:"signal_strength"`
	GPSAccuracy  TelemetryFloatResponse `json:"gps_accuracy"`
}
type TelemetryFloatResponse struct {
	Latest       *float64 `json:"latest"`
	Minimum      *float64 `json:"minimum"`
	Maximum      *float64 `json:"maximum"`
	Average      *float64 `json:"average"`
	PresentCount int      `json:"present_count"`
}
type TelemetryIntResponse struct {
	Latest       *int     `json:"latest"`
	Minimum      *int     `json:"minimum"`
	Maximum      *int     `json:"maximum"`
	Average      *float64 `json:"average"`
	PresentCount int      `json:"present_count"`
}
type QualityReportResponse struct {
	Devices  []DeviceQualityResponse `json:"devices"`
	Metadata ReportMetadata          `json:"metadata"`
}
type DeviceQualityResponse struct {
	Device                 ReportDevice             `json:"device"`
	PointCount             int                      `json:"point_count"`
	GapCount               int                      `json:"gap_count"`
	PoorAccuracyCount      int                      `json:"poor_accuracy_count"`
	JumpCount              int                      `json:"jump_count"`
	IntervalCount          int                      `json:"interval_count"`
	AverageIntervalSeconds float64                  `json:"average_interval_seconds"`
	LongestGapSeconds      float64                  `json:"longest_gap_seconds"`
	OptionalPresence       reports.OptionalPresence `json:"optional_presence"`
	FirstReport            *time.Time               `json:"first_report"`
	LatestReport           *time.Time               `json:"latest_report"`
}
type ReportMetadata struct {
	Estimated                   bool    `json:"estimated"`
	DistanceUnit                string  `json:"distance_unit"`
	GapThresholdSeconds         int     `json:"gap_threshold_seconds"`
	PoorAccuracyThresholdMeters float64 `json:"poor_accuracy_threshold_meters"`
	MaxJumpSpeedKph             float64 `json:"max_jump_speed_kph"`
}

func Metadata() ReportMetadata {
	return ReportMetadata{Estimated: true, DistanceUnit: "km", GapThresholdSeconds: int(reports.GapThreshold.Seconds()), PoorAccuracyThresholdMeters: reports.PoorAccuracyMeters, MaxJumpSpeedKph: reports.MaxJumpSpeedKPH}
}
func device(d reports.Device) ReportDevice {
	return ReportDevice{ID: d.ID.String(), Name: d.Name, VehicleType: d.VehicleType}
}
func point(p reports.Point) ReportPoint {
	return ReportPoint{DeviceID: p.DeviceID.String(), RecordedAt: p.RecordedAt, Latitude: p.Latitude, Longitude: p.Longitude, Altitude: p.Altitude, Speed: p.Speed, Accuracy: p.Accuracy, BatteryVoltage: p.BatteryVoltage, SignalStrength: p.SignalStrength}
}
func OverviewFromDomain(r reports.OverviewReport) OverviewReportResponse {
	var active *ReportDevice
	if r.MostActivePointCount > 0 {
		d := device(r.MostActiveDevice)
		active = &d
	}
	items := make([]DeviceSummaryResponse, 0, len(r.Devices))
	for _, v := range r.Devices {
		items = append(items, DeviceSummaryResponse{Device: device(v.Device), PointCount: v.PointCount, EstimatedDistanceKm: v.DistanceMeters / 1000, FirstReport: v.FirstReport, LatestReport: v.LatestReport, LongestGapSeconds: v.LongestGapSeconds, JumpCount: v.JumpCount})
	}
	series := make([]BucketResponse, 0, len(r.Series))
	for _, v := range r.Series {
		series = append(series, BucketResponse{StartedAt: v.StartedAt, Count: v.Count})
	}
	return OverviewReportResponse{DeviceCount: r.DeviceCount, PointCount: r.PointCount, EstimatedDistanceKm: r.EstimatedDistanceMeters / 1000, MostActiveDevice: active, MostActivePointCount: r.MostActivePointCount, LongestGapSeconds: r.LongestGap.Seconds(), BucketSeconds: int(r.Bucket.Seconds()), Series: series, Devices: items, Metadata: Metadata()}
}
func RoutesFromDomain(r reports.RoutesReport) RoutesReportResponse {
	items := make([]RouteResponse, 0, len(r.Routes))
	for _, v := range r.Routes {
		pts := make([]ReportPoint, 0, len(v.Points))
		for _, p := range v.Points {
			pts = append(pts, point(p))
		}
		items = append(items, RouteResponse{Device: device(v.Device), StartedAt: v.StartedAt, EndedAt: v.EndedAt, DurationSeconds: v.DurationSeconds, DistanceKm: v.DistanceMeters / 1000, AverageSpeedKph: v.AverageSpeedMPS * 3.6, MaximumSpeedKph: v.MaximumSpeedMPS * 3.6, CompletePointCount: v.CompletePointCount, ReturnedPointCount: len(pts), JumpCount: v.JumpCount, Sampled: len(pts) < v.CompletePointCount, Points: pts})
	}
	return RoutesReportResponse{Routes: items, Metadata: Metadata()}
}
func HealthFromDomain(r reports.HealthReport) HealthReportResponse {
	items := make([]DeviceHealthResponse, 0, len(r.Devices))
	for _, v := range r.Devices {
		items = append(items, DeviceHealthResponse{Device: device(v.Device), LatestReport: v.LatestReport, PointCount: v.PointCount, Battery: floatStats(v.Battery), Signal: intStats(v.Signal), GPSAccuracy: floatStats(v.GPSAccuracy)})
	}
	return HealthReportResponse{Devices: items, Metadata: Metadata()}
}
func QualityFromDomain(r reports.QualityReport) QualityReportResponse {
	items := make([]DeviceQualityResponse, 0, len(r.Devices))
	for _, v := range r.Devices {
		items = append(items, DeviceQualityResponse{Device: device(v.Device), PointCount: v.PointCount, GapCount: v.GapCount, PoorAccuracyCount: v.PoorAccuracyCount, JumpCount: v.JumpCount, IntervalCount: v.IntervalCount, AverageIntervalSeconds: v.AverageIntervalSeconds, LongestGapSeconds: v.LongestGapSeconds, OptionalPresence: v.OptionalPresence, FirstReport: v.FirstReport, LatestReport: v.LatestReport})
	}
	return QualityReportResponse{Devices: items, Metadata: Metadata()}
}
func floatStats(v reports.Stats) TelemetryFloatResponse {
	return TelemetryFloatResponse{Latest: v.Latest, Minimum: v.Minimum, Maximum: v.Maximum, Average: v.Average, PresentCount: v.PresentCount}
}
func intStats(v reports.IntStats) TelemetryIntResponse {
	return TelemetryIntResponse{Latest: v.Latest, Minimum: v.Minimum, Maximum: v.Maximum, Average: v.Average, PresentCount: v.PresentCount}
}
