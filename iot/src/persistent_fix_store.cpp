#include "persistent_fix_store.h"

#include <LittleFS.h>
#include <Arduino.h>

#include "location_payload.h"

namespace {
constexpr const char* DATA_PATH = "/fixq.data";
constexpr const char* META_A_PATH = "/fixq.a";
constexpr const char* META_B_PATH = "/fixq.b";
}

bool PersistentFixStore::readMeta(const char* path, FixQueueMeta& out) const {
    File f = LittleFS.open(path, "r");
    if (!f) return false;
    uint8_t wire[FIX_QUEUE_META_WIRE_SIZE];
    const size_t n = f.read(wire, sizeof(wire));
    f.close();
    if (n != sizeof(wire)) return false;
    return fixQueueMetaDecode(wire, sizeof(wire), out);
}

bool PersistentFixStore::commitMeta() {
    uint8_t wire[FIX_QUEUE_META_WIRE_SIZE];
    // Encode first so an invalid meta never reaches flash.
    meta.generation += 1;
    if (!fixQueueMetaEncode(meta, wire, sizeof(wire))) {
        meta.generation -= 1;
        return false;
    }
    const char* path = (nextSlot == 0) ? META_A_PATH : META_B_PATH;
    File f = LittleFS.open(path, "w");
    if (!f) {
        meta.generation -= 1;
        return false;
    }
    const size_t written = f.write(wire, sizeof(wire));
    // Arduino-ESP32 File::flush() returns void; write() above is the checked I/O result.
    f.flush();
    f.close();
    if (written != sizeof(wire)) {
        meta.generation -= 1;
        return false;
    }
    nextSlot = (nextSlot == 0) ? 1 : 0;
    return true;
}

bool PersistentFixStore::reset() {
    meta = fixQueueMetaFresh(queueCapacity);
    nextSlot = 0;
    return commitMeta();
}

bool PersistentFixStore::begin(uint32_t capacity) {
    readyState = false;
    if (capacity == 0) return false;
    queueCapacity = capacity;

    if (!LittleFS.begin(true)) {
        Serial.println(F("[QUEUE] LittleFS mount/format failed"));
        return false;
    }

    FixQueueMeta a{};
    FixQueueMeta b{};
    const bool aOk = readMeta(META_A_PATH, a);
    const bool bOk = readMeta(META_B_PATH, b);

    const FixQueueMeta* ap = aOk ? &a : nullptr;
    const FixQueueMeta* bp = bOk ? &b : nullptr;
    if (!fixQueueMetaPick(ap, aOk, bp, bOk, meta)) {
        meta = fixQueueMetaFresh(capacity);
        nextSlot = 0;
        if (!commitMeta()) return false;
        Serial.println(F("[QUEUE] fresh meta"));
    } else {
        if (meta.capacity != capacity) {
            Serial.println(F("[QUEUE] capacity change; resetting"));
            if (!reset()) return false;
        } else {
            // Next commit must go to the slot that did NOT win.
            int8_t winner;
            if (aOk && bOk)
                winner = (b.generation > a.generation) ? 1 : 0;
            else if (aOk)
                winner = 0;
            else
                winner = 1;
            nextSlot = (winner == 0) ? 1 : 0;
        }
    }

    // Ensure the data file exists so later r+ opens succeed.
    if (!LittleFS.exists(DATA_PATH)) {
        File f = LittleFS.open(DATA_PATH, "w");
        if (!f) {
            Serial.println(F("[QUEUE] data file create failed"));
            return false;
        }
        f.close();
    }

    // Drop a corrupt committed front record rather than wedging the queue.
    if (meta.count > 0) {
        FixRecord probe{};
        if (peek(&probe, 1) == 0 && meta.count > 0) {
            Serial.println(F("[QUEUE] corrupt front; resetting"));
            if (!reset()) return false;
        }
    }

    readyState = true;
    Serial.printf(PSTR("[QUEUE] ready size=%lu/%lu lost=%lu next_seq=%lu\n"),
                  (unsigned long)meta.count, (unsigned long)meta.capacity,
                  (unsigned long)meta.lost_count, (unsigned long)meta.next_seq);
    return true;
}

bool PersistentFixStore::push(FixRecord& record) {
    if (!readyState) return false;

    if (record.sequence_id == 0)
        record.sequence_id = meta.next_seq;

    uint8_t wire[FIX_RECORD_WIRE_SIZE];
    if (!fixRecordEncode(record, wire, sizeof(wire))) return false;

    File f = LittleFS.open(DATA_PATH, "r+");
    if (!f) {
        // First write on a freshly created empty file.
        f = LittleFS.open(DATA_PATH, "w");
        if (!f) return false;
    }
    const uint32_t slot = meta.head;
    if (!f.seek(slot * FIX_RECORD_WIRE_SIZE)) {
        f.close();
        return false;
    }
    const size_t written = f.write(wire, sizeof(wire));
    // Arduino-ESP32 File::flush() returns void; write() below is the checked I/O result.
    f.flush();
    f.close();
    if (written != sizeof(wire)) return false;

    // Data is durable — now publish via meta.
    const bool wasFull = fixQueueIsFull(meta);
    if (wasFull) {
        meta.tail = fixQueueAdvance(meta.tail, meta.capacity);
        meta.lost_count += 1;
    } else {
        meta.count += 1;
    }
    meta.head = fixQueueAdvance(meta.head, meta.capacity);
    if (record.sequence_id >= meta.next_seq)
        meta.next_seq = record.sequence_id + 1;

    if (!commitMeta()) {
        // Meta not published: next push overwrites this slot. Roll back
        // in-memory counters so size() stays consistent with flash.
        if (wasFull) {
            meta.tail = (meta.tail == 0) ? meta.capacity - 1 : meta.tail - 1;
            meta.lost_count -= 1;
        } else {
            meta.count -= 1;
        }
        meta.head = (meta.head == 0) ? meta.capacity - 1 : meta.head - 1;
        return false;
    }
    return true;
}

size_t PersistentFixStore::peek(FixRecord* out, size_t max) const {
    if (!readyState || out == nullptr || max == 0 || meta.count == 0) return 0;

    File f = LittleFS.open(DATA_PATH, "r");
    if (!f) return 0;

    size_t n = 0;
    uint32_t idx = meta.tail;
    const uint32_t limit = (meta.count < max) ? meta.count : max;
    while (n < limit) {
        if (!f.seek(idx * FIX_RECORD_WIRE_SIZE)) break;
        uint8_t wire[FIX_RECORD_WIRE_SIZE];
        if (f.read(wire, sizeof(wire)) != sizeof(wire)) break;
        if (!fixRecordDecode(wire, sizeof(wire), out[n])) {
            f.close();
            Serial.printf(PSTR("[QUEUE] corrupt slot %lu; dropping queue\n"),
                          (unsigned long)idx);
            const_cast<PersistentFixStore*>(this)->reset();
            return 0;
        }
        ++n;
        idx = fixQueueAdvance(idx, meta.capacity);
    }
    f.close();
    return n;
}

size_t PersistentFixStore::ackFront(size_t count) {
    if (!readyState || count == 0) return 0;
    if (count > meta.count) count = meta.count;

    for (size_t i = 0; i < count; ++i)
        meta.tail = fixQueueAdvance(meta.tail, meta.capacity);
    meta.count -= count;

    if (!commitMeta()) {
        // Best-effort rollback of in-memory state; flash meta still old
        // so a reboot re-sends — backend idempotency by sequence_id covers it.
        for (size_t i = 0; i < count; ++i)
            meta.tail = (meta.tail == 0) ? meta.capacity - 1 : meta.tail - 1;
        meta.count += count;
        return 0;
    }
    return count;
}
