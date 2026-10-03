package postgres

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/HouseCham/gps-tracker/backend/internal/app/reports"
)

// ReportsAdapter is the SQL authorization boundary for report datasets.
type ReportsAdapter struct{ pool *pgxpool.Pool }

func NewReportsAdapter(pool *pgxpool.Pool) *ReportsAdapter { return &ReportsAdapter{pool: pool} }

func (a *ReportsAdapter) GetDataset(ctx context.Context, userID uuid.UUID, filter reports.Filter, limit int) (reports.Dataset, error) {
	devices, err := a.getDevices(ctx, userID, filter)
	if err != nil {
		return reports.Dataset{}, WrapPgError(err)
	}
	points, err := a.getPoints(ctx, userID, filter, limit)
	if err != nil {
		return reports.Dataset{}, WrapPgError(err)
	}
	return reports.Dataset{Devices: devices, Points: points}, nil
}

func (a *ReportsAdapter) getDevices(ctx context.Context, userID uuid.UUID, filter reports.Filter) ([]reports.Device, error) {
	query, args := deviceQuery(filter)
	args = append([]any{userID}, args...)
	rows, err := a.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]reports.Device, 0)
	for rows.Next() {
		var id uuid.UUID
		var name, vehicle string
		if err := rows.Scan(&id, &name, &vehicle); err != nil {
			return nil, err
		}
		result = append(result, reports.Device{ID: id, Name: name, VehicleType: vehicle})
	}
	return result, rows.Err()
}

func (a *ReportsAdapter) getPoints(ctx context.Context, userID uuid.UUID, filter reports.Filter, limit int) ([]reports.Point, error) {
	conditions := []string{"uda.user_id = $1", "d.deleted_at IS NULL", "uda.deleted_at IS NULL", "l.recorded_at >= $2", "l.recorded_at < $3"}
	args := []any{userID, filter.From, filter.To}
	next := 4
	if len(filter.DeviceIDs) > 0 {
		conditions = append(conditions, fmt.Sprintf("l.device_id = ANY($%d::uuid[])", next))
		args = append(args, filter.DeviceIDs)
		next++
	}
	if filter.VehicleType != "" {
		conditions = append(conditions, fmt.Sprintf("d.vehicle_type = $%d::device_vehicle_type", next))
		args = append(args, filter.VehicleType)
		next++
	}
	query := fmt.Sprintf(`SELECT l.device_id,l.recorded_at,l.latitude,l.longitude,l.altitude,l.speed,l.accuracy,l.battery_voltage,l.signal_strength FROM locations l JOIN devices d ON d.id=l.device_id JOIN user_device_access uda ON uda.device_id=l.device_id WHERE %s ORDER BY l.device_id,l.recorded_at`, strings.Join(conditions, " AND "))
	if limit > 0 {
		args = append(args, limit)
		query += fmt.Sprintf(" LIMIT $%d", next)
	}
	rows, err := a.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make([]reports.Point, 0)
	for rows.Next() {
		var p reports.Point
		if err := rows.Scan(&p.DeviceID, &p.RecordedAt, &p.Latitude, &p.Longitude, &p.Altitude, &p.Speed, &p.Accuracy, &p.BatteryVoltage, &p.SignalStrength); err != nil {
			return nil, err
		}
		result = append(result, p)
	}
	return result, rows.Err()
}

func deviceQuery(filter reports.Filter) (string, []any) {
	conditions := []string{"d.deleted_at IS NULL", "uda.deleted_at IS NULL", "uda.user_id = $1"}
	args := []any{}
	if len(filter.DeviceIDs) > 0 {
		conditions = append(conditions, "d.id = ANY($2::uuid[])")
		args = append(args, filter.DeviceIDs)
	}
	if filter.VehicleType != "" {
		position := 2
		if len(filter.DeviceIDs) > 0 {
			position = 3
		}
		conditions = append(conditions, fmt.Sprintf("d.vehicle_type = $%d::device_vehicle_type", position))
		args = append(args, filter.VehicleType)
	}
	return fmt.Sprintf("SELECT d.id,d.name,d.vehicle_type FROM devices d JOIN user_device_access uda ON uda.device_id=d.id WHERE %s ORDER BY d.name", strings.Join(conditions, " AND ")), args
}
