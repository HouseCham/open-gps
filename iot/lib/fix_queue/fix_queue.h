#pragma once

#include <stddef.h>
#include <stdint.h>

// Power-safe metadata for the persistent FixRecord ring. Stored twice (A/B)
// on flash; the slot with the higher generation and a valid CRC wins after
// a power cut.
constexpr size_t FIX_QUEUE_META_WIRE_SIZE = 32;

struct FixQueueMeta {
    uint32_t generation;  // strictly increases on every commit; picks A vs B
    uint32_t capacity;    // ring capacity this meta describes (slots)
    uint32_t head;        // next slot to write
    uint32_t tail;        // next slot to read (oldest live record)
    uint32_t count;       // live records, 0..capacity
    uint32_t next_seq;    // next sequence_id to assign; starts at 1
    uint32_t lost_count;  // records dropped because the ring was full
    uint16_t crc;         // CRC-16/MODBUS over the preceding fields
};

// Fresh empty meta for `capacity` slots. next_seq starts at 1 (backend
// rejects sequence_id <= 0).
FixQueueMeta fix_queue_meta_fresh(uint32_t capacity);

// Serialize with version-less fixed layout + CRC. Returns false if buf is
// null or length < FIX_QUEUE_META_WIRE_SIZE.
bool fix_queue_meta_encode(const FixQueueMeta& meta, uint8_t* buf, size_t length);

// Decode and verify CRC + structural invariants (head/tail/count within
// capacity, capacity > 0). Returns false on any failure.
bool fix_queue_meta_decode(const uint8_t* buf, size_t length, FixQueueMeta& out);

// Choose the surviving meta after power loss. Invalid slots are ignored;
// the higher generation wins. Returns false if neither slot is usable.
bool fix_queue_meta_pick(const FixQueueMeta* a, bool a_valid,
                         const FixQueueMeta* b, bool b_valid,
                         FixQueueMeta& out);

// Ring arithmetic helpers (pure; capacity is an explicit parameter so the
// store and the tests share one implementation).
bool fix_queue_is_full(const FixQueueMeta& meta);
bool fix_queue_is_empty(const FixQueueMeta& meta);

// Advance `index` modulo `capacity`. Returns 0 if capacity is 0.
uint32_t fix_queue_advance(uint32_t index, uint32_t capacity);
