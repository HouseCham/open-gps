#pragma once

#include <stddef.h>
#include <stdint.h>

#include "fix_queue.h"
#include "fix_record.h"

// Flash-backed FIFO of FixRecords on LittleFS.
//
// Layout:
//   /fixq.data  — fixed slots of FIX_RECORD_WIRE_SIZE bytes
//   /fixq.a     — meta slot A (FixQueueMeta wire image)
//   /fixq.b     — meta slot B
//
// Commit order is data-then-meta: a power cut before the meta write leaves
// the previous meta intact (the uncommitted slot is simply overwritten on
// the next push). The two meta slots alternate; higher generation + valid
// CRC wins on boot.
//
// When the ring is full the oldest record is dropped (lost_count++) so a
// moving tracker keeps the most recent location, per audit-fix-plan.
class PersistentFixStore {
public:
    // Mount LittleFS, recover meta A/B, ensure the data file exists.
    // Returns false if the filesystem cannot be mounted.
    bool begin(uint32_t capacity);

    // Encode + write one record at head and commit meta. Assigns
    // record.sequence_id from meta.next_seq when it is 0 (written back to
    // the caller). When full, drops the oldest. Returns false on
    // encode/FS failure (queue left unchanged).
    bool push(FixRecord& record);

    // Decode up to `max` records from tail without removing them.
    // Returns how many were written. A corrupt committed slot drops the
    // whole queue (ponytail: prefer reset over complex skip/ack recovery).
    size_t peek(FixRecord* out, size_t max) const;

    // Remove `count` records from the front (after a 201). Returns how
    // many were actually removed. No-op if count == 0.
    size_t ack_front(size_t count);

    uint32_t size() const { return _meta.count; }
    uint32_t capacity() const { return _meta.capacity; }
    uint32_t lostCount() const { return _meta.lost_count; }
    uint32_t nextSequenceId() const { return _meta.next_seq; }
    bool ready() const { return _ready; }

private:
    bool readMeta(const char* path, FixQueueMeta& out) const;
    bool commitMeta();
    bool reset();

    FixQueueMeta _meta{};
    int8_t _nextSlot = 0;  // 0 = write /fixq.a next, 1 = /fixq.b
    uint32_t _capacity = 0;
    bool _ready = false;
};
