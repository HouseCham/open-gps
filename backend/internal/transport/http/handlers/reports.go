package handlers

import (
	"encoding/csv"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"github.com/HouseCham/gps-tracker/backend/internal/app/reports"
	"github.com/HouseCham/gps-tracker/backend/internal/domain"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/dto"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/http/middleware"
	"github.com/HouseCham/gps-tracker/backend/internal/transport/response"
)

const reportTimeLayout = "2006-01-02T15:04:05"

type ReportsHandler struct{ service *reports.Service }

func NewReportsHandler(service *reports.Service) *ReportsHandler {
	return &ReportsHandler{service: service}
}

func (h *ReportsHandler) Overview(c fiber.Ctx) error {
	user, filter, err := reportRequest(c)
	if err != nil {
		return middleware.BadRequestResponse(c, err.Error())
	}
	value, err := h.service.Overview(c.Context(), user.ID, filter)
	if err != nil {
		return err
	}
	return c.JSON(response.HTTPResponse[dto.OverviewReportResponse]{StatusCode: 200, Message: "report overview retrieved", Data: dto.OverviewFromDomain(value)})
}
func (h *ReportsHandler) Routes(c fiber.Ctx) error {
	user, filter, err := reportRequest(c)
	if err != nil {
		return middleware.BadRequestResponse(c, err.Error())
	}
	value, err := h.service.Routes(c.Context(), user.ID, filter)
	if err != nil {
		return err
	}
	return c.JSON(response.HTTPResponse[dto.RoutesReportResponse]{StatusCode: 200, Message: "report routes retrieved", Data: dto.RoutesFromDomain(value)})
}
func (h *ReportsHandler) Health(c fiber.Ctx) error {
	user, filter, err := reportRequest(c)
	if err != nil {
		return middleware.BadRequestResponse(c, err.Error())
	}
	value, err := h.service.Health(c.Context(), user.ID, filter)
	if err != nil {
		return err
	}
	return c.JSON(response.HTTPResponse[dto.HealthReportResponse]{StatusCode: 200, Message: "report health retrieved", Data: dto.HealthFromDomain(value)})
}
func (h *ReportsHandler) Quality(c fiber.Ctx) error {
	user, filter, err := reportRequest(c)
	if err != nil {
		return middleware.BadRequestResponse(c, err.Error())
	}
	value, err := h.service.Quality(c.Context(), user.ID, filter)
	if err != nil {
		return err
	}
	return c.JSON(response.HTTPResponse[dto.QualityReportResponse]{StatusCode: 200, Message: "report data quality retrieved", Data: dto.QualityFromDomain(value)})
}

func (h *ReportsHandler) Export(c fiber.Ctx) error {
	user, filter, err := reportRequest(c)
	if err != nil {
		return middleware.BadRequestResponse(c, err.Error())
	}
	format := strings.ToLower(c.Query("format"))
	if format != "csv" && format != "gpx" {
		return middleware.BadRequestResponse(c, "format must be csv or gpx")
	}
	points, err := h.service.Export(c.Context(), user.ID, filter)
	if errors.Is(err, reports.ErrTooManyExportPoints) {
		return middleware.BadRequestResponse(c, err.Error())
	}
	if err != nil {
		return err
	}
	switch format {
	case "csv":
		content, err := csvContent(points)
		if err != nil {
			return fmt.Errorf("build csv report: %w", err)
		}
		c.Set("Content-Type", "text/csv; charset=utf-8")
		c.Set("Content-Disposition", "attachment; filename=report.csv")
		return c.SendString(content)
	case "gpx":
		c.Set("Content-Type", "application/gpx+xml; charset=utf-8")
		c.Set("Content-Disposition", "attachment; filename=report.gpx")
		return c.SendString(gpxContent(points))
	default:
		return middleware.BadRequestResponse(c, "format must be csv or gpx")
	}
}

func reportRequest(c fiber.Ctx) (*domain.User, reports.Filter, error) {
	user, ok := middleware.GetRequestUser(c)
	if !ok {
		return nil, reports.Filter{}, fiber.ErrUnauthorized
	}
	from, to, err := parseReportRange(c)
	if err != nil {
		return nil, reports.Filter{}, err
	}
	ids, err := parseReportIDs(c.Query("device_ids"))
	if err != nil {
		return nil, reports.Filter{}, err
	}
	vehicle := c.Query("vehicle_type")
	if vehicle != "" && !validVehicle(vehicle) {
		return nil, reports.Filter{}, errors.New("invalid vehicle_type")
	}
	return user, reports.Filter{From: from, To: to, DeviceIDs: ids, VehicleType: vehicle}, nil
}

func parseReportRange(c fiber.Ctx) (time.Time, time.Time, error) {
	zone := c.Query("time-zone")
	if zone == "" {
		return time.Time{}, time.Time{}, errors.New("from, to, and time-zone are required")
	}
	location, err := time.LoadLocation(zone)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("invalid time-zone")
	}
	from, err := time.ParseInLocation(reportTimeLayout, c.Query("from"), location)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("invalid from")
	}
	to, err := time.ParseInLocation(reportTimeLayout, c.Query("to"), location)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("invalid to")
	}
	if !from.Before(to) {
		return time.Time{}, time.Time{}, errors.New("from must be before to")
	}
	if to.Sub(from) > reports.MaxReportRange {
		return time.Time{}, time.Time{}, errors.New("report range cannot exceed 31 days")
	}
	return from.UTC(), to.UTC(), nil
}
func parseReportIDs(raw string) ([]uuid.UUID, error) {
	if raw == "" {
		return nil, nil
	}
	parts := strings.Split(raw, ",")
	ids := make([]uuid.UUID, 0, len(parts))
	for _, part := range parts {
		id, err := uuid.Parse(strings.TrimSpace(part))
		if err != nil {
			return nil, errors.New("invalid device id")
		}
		ids = append(ids, id)
	}
	return ids, nil
}
func validVehicle(value string) bool {
	switch value {
	case "bicycle", "motorcycle", "car", "truck", "van", "other":
		return true
	}
	return false
}
func csvContent(points []reports.Point) (string, error) {
	var b strings.Builder
	writer := csv.NewWriter(&b)
	if err := writer.Write([]string{"timestamp", "device_id", "latitude", "longitude", "speed_mps", "altitude_m", "accuracy_m", "battery_voltage_v", "signal_strength_csq"}); err != nil {
		return "", err
	}
	for _, p := range points {
		if err := writer.Write([]string{p.RecordedAt.Format(time.RFC3339), p.DeviceID.String(), fmt.Sprintf("%f", p.Latitude), fmt.Sprintf("%f", p.Longitude), optionalFloat(p.Speed), optionalFloat(p.Altitude), optionalFloat(p.Accuracy), optionalFloat(p.BatteryVoltage), optionalInt(p.SignalStrength)}); err != nil {
			return "", err
		}
	}
	writer.Flush()
	if err := writer.Error(); err != nil {
		return "", err
	}
	return b.String(), nil
}
func gpxContent(points []reports.Point) string {
	var b strings.Builder
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="OpenGPS" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>OpenGPS report</name><trkseg>`)
	for _, p := range points {
		fmt.Fprintf(&b, `<trkpt lat="%g" lon="%g"><time>%s</time>`, p.Latitude, p.Longitude, p.RecordedAt.Format(time.RFC3339))
		if p.Altitude != nil {
			fmt.Fprintf(&b, `<ele>%g</ele>`, *p.Altitude)
		}
		b.WriteString(`</trkpt>`)
	}
	b.WriteString(`</trkseg></trk></gpx>`)
	return b.String()
}
func optionalFloat(value *float64) string {
	if value == nil {
		return ""
	}
	return strconv.FormatFloat(*value, 'f', -1, 64)
}
func optionalInt(value *int) string {
	if value == nil {
		return ""
	}
	return strconv.Itoa(*value)
}
