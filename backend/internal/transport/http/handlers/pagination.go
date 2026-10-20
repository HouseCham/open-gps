package handlers

import (
	"math"
	"strconv"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/log"
)

const (
	defaultPage     = 1
	defaultPageSize = 20
	maxPageSize     = 100
)

// clampPage caps page so (page-1)*pageSize stays within int32 — the
// type sqlc/PostgreSQL receive for OFFSET (BA-14). An extreme page
// number then yields the last addressable page (effectively empty)
// instead of an overflowing offset. The cap is computed in int64 and
// bounded to the platform's largest int, so it is overflow-safe even
// on 32-bit platforms where int == int32.
func clampPage(page, pageSize int) int {
	if pageSize < 1 {
		pageSize = 1
	}
	maxPage64 := int64(math.MaxInt32)/int64(pageSize) + 1
	if maxInt := int64(^uint(0) >> 1); maxPage64 > maxInt {
		maxPage64 = maxInt
	}
	maxPage := int(maxPage64)
	if page > maxPage {
		return maxPage
	}
	return page
}

// parsePagination reads ?page and ?page_size from the request, falling
// back to defaults on missing/invalid input and clamping page_size to
// [1, maxPageSize]. The caller supplies the desired default page size.
func parsePagination(c fiber.Ctx, defaultSize int) (page, pageSize int) {
	page = defaultPage
	if raw := c.Query("page"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			page = parsed
		} else {
			log.Warn("parsePagination", "invalid page", "value", raw, "err", err)
		}
	}
	if page < 1 {
		page = defaultPage
	}

	pageSize = defaultSize
	if raw := c.Query("page_size"); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil {
			pageSize = parsed
		} else {
			log.Warn("parsePagination", "invalid page_size", "value", raw, "err", err)
		}
	}
	if pageSize < 1 || pageSize > maxPageSize {
		pageSize = defaultSize
	}

	return clampPage(page, pageSize), pageSize
}
