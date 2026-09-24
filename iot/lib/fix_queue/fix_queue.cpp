#include "fix_queue.h"

#include <string.h>

#include "fix_record.h"

namespace {
constexpr size_t META_OFF_GENERATION = 0;
constexpr size_t META_OFF_CAPACITY = 4;
constexpr size_t META_OFF_HEAD = 8;
constexpr size_t META_OFF_TAIL = 12;
constexpr size_t META_OFF_COUNT = 16;
constexpr size_t META_OFF_NEXT_SEQ = 20;
constexpr size_t META_OFF_LOST = 24;
constexpr size_t META_CRC_OFFSET = 28;
constexpr size_t META_CRC_COVER = 28;

// CRC-16/MODBUS — same polynomial as fixRecordEncode.
uint16_t calculateCrc16(const uint8_t* data, size_t length) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < length; ++i) {
        crc ^= data[i];
        for (uint8_t bit = 0; bit < 8; ++bit)
            crc = (crc & 1) ? static_cast<uint16_t>((crc >> 1) ^ 0xA001) :
                              static_cast<uint16_t>(crc >> 1);
    }
    return crc;
}

void writeUint32(uint8_t* out, uint32_t value) {
    out[0] = static_cast<uint8_t>(value);
    out[1] = static_cast<uint8_t>(value >> 8);
    out[2] = static_cast<uint8_t>(value >> 16);
    out[3] = static_cast<uint8_t>(value >> 24);
}

uint32_t readUint32(const uint8_t* in) {
    return static_cast<uint32_t>(in[0]) |
           (static_cast<uint32_t>(in[1]) << 8) |
           (static_cast<uint32_t>(in[2]) << 16) |
           (static_cast<uint32_t>(in[3]) << 24);
}

void writeUint16(uint8_t* out, uint16_t value) {
    out[0] = static_cast<uint8_t>(value);
    out[1] = static_cast<uint8_t>(value >> 8);
}

uint16_t readUint16(const uint8_t* in) {
    return static_cast<uint16_t>(in[0] | (static_cast<uint16_t>(in[1]) << 8));
}
}

bool fixRecordEncode(const FixRecord& record, uint8_t* buffer, size_t length) {
    if (buffer == nullptr || length < FIX_RECORD_WIRE_SIZE ||
        record.recorded_at[FIX_TIMESTAMP_LENGTH - 1] != '\0')
        return false;

    memset(buffer, 0, FIX_RECORD_WIRE_SIZE);
    buffer[0] = FIX_RECORD_VERSION;
    writeUint32(buffer + 1, record.sequence_id);
    writeUint32(buffer + 5, record.boot_id);
    memcpy(buffer + 9, record.recorded_at, FIX_TIMESTAMP_LENGTH);
    writeUint32(buffer + 30, static_cast<uint32_t>(record.latitude_e6));
    writeUint32(buffer + 34, static_cast<uint32_t>(record.longitude_e6));
    writeUint32(buffer + 38, static_cast<uint32_t>(record.altitude_cm));
    writeUint32(buffer + 42, static_cast<uint32_t>(record.speed_mmps));
    writeUint32(buffer + 46, static_cast<uint32_t>(record.accuracy_cm));
    writeUint16(buffer + 50, record.satellites_used);
    writeUint16(buffer + 52, record.battery_mv);
    buffer[54] = static_cast<uint8_t>(record.signal_strength);
    buffer[55] = record.valid_fields;
    writeUint16(buffer + FIX_RECORD_WIRE_SIZE - 2, calculateCrc16(buffer, FIX_RECORD_WIRE_SIZE - 2));
    return true;
}

bool fixRecordDecode(const uint8_t* buffer, size_t length, FixRecord& record) {
    if (buffer == nullptr || length < FIX_RECORD_WIRE_SIZE ||
        buffer[0] != FIX_RECORD_VERSION ||
        readUint16(buffer + FIX_RECORD_WIRE_SIZE - 2) !=
            calculateCrc16(buffer, FIX_RECORD_WIRE_SIZE - 2))
        return false;

    record.sequence_id = readUint32(buffer + 1);
    record.boot_id = readUint32(buffer + 5);
    memcpy(record.recorded_at, buffer + 9, FIX_TIMESTAMP_LENGTH);
    record.latitude_e6 = static_cast<int32_t>(readUint32(buffer + 30));
    record.longitude_e6 = static_cast<int32_t>(readUint32(buffer + 34));
    record.altitude_cm = static_cast<int32_t>(readUint32(buffer + 38));
    record.speed_mmps = static_cast<int32_t>(readUint32(buffer + 42));
    record.accuracy_cm = static_cast<int32_t>(readUint32(buffer + 46));
    record.satellites_used = readUint16(buffer + 50);
    record.battery_mv = readUint16(buffer + 52);
    record.signal_strength = static_cast<int8_t>(buffer[54]);
    record.valid_fields = buffer[55];
    return record.recorded_at[FIX_TIMESTAMP_LENGTH - 1] == '\0';
}

FixQueueMeta fixQueueMetaFresh(uint32_t capacity) {
    FixQueueMeta meta{};
    meta.capacity = capacity;
    meta.next_seq = 1;
    return meta;
}

bool fixQueueMetaEncode(const FixQueueMeta& meta, uint8_t* buf, size_t length) {
    if (buf == nullptr || length < FIX_QUEUE_META_WIRE_SIZE || meta.capacity == 0 ||
        meta.head >= meta.capacity || meta.tail >= meta.capacity ||
        meta.count > meta.capacity)
        return false;

    memset(buf, 0, FIX_QUEUE_META_WIRE_SIZE);
    writeUint32(buf + META_OFF_GENERATION, meta.generation);
    writeUint32(buf + META_OFF_CAPACITY, meta.capacity);
    writeUint32(buf + META_OFF_HEAD, meta.head);
    writeUint32(buf + META_OFF_TAIL, meta.tail);
    writeUint32(buf + META_OFF_COUNT, meta.count);
    writeUint32(buf + META_OFF_NEXT_SEQ, meta.next_seq);
    writeUint32(buf + META_OFF_LOST, meta.lost_count);
    writeUint16(buf + META_CRC_OFFSET, calculateCrc16(buf, META_CRC_COVER));
    return true;
}

bool fixQueueMetaDecode(const uint8_t* buf, size_t length, FixQueueMeta& out) {
    if (buf == nullptr || length < FIX_QUEUE_META_WIRE_SIZE)
        return false;
    if (readUint16(buf + META_CRC_OFFSET) != calculateCrc16(buf, META_CRC_COVER))
        return false;

    FixQueueMeta meta{};
    meta.generation = readUint32(buf + META_OFF_GENERATION);
    meta.capacity = readUint32(buf + META_OFF_CAPACITY);
    meta.head = readUint32(buf + META_OFF_HEAD);
    meta.tail = readUint32(buf + META_OFF_TAIL);
    meta.count = readUint32(buf + META_OFF_COUNT);
    meta.next_seq = readUint32(buf + META_OFF_NEXT_SEQ);
    meta.lost_count = readUint32(buf + META_OFF_LOST);
    meta.crc = readUint16(buf + META_CRC_OFFSET);

    if (meta.capacity == 0 || meta.head >= meta.capacity ||
        meta.tail >= meta.capacity || meta.count > meta.capacity)
        return false;
    if (meta.next_seq == 0)
        return false;

    out = meta;
    return true;
}

bool fixQueueMetaPick(const FixQueueMeta* a, bool aValid,
                      const FixQueueMeta* b, bool bValid,
                      FixQueueMeta& out) {
    if (aValid && bValid) {
        out = (b->generation > a->generation) ? *b : *a;
        return true;
    }
    if (aValid) { out = *a; return true; }
    if (bValid) { out = *b; return true; }
    return false;
}

bool fixQueueIsFull(const FixQueueMeta& meta) {
    return meta.count >= meta.capacity;
}

bool fixQueueIsEmpty(const FixQueueMeta& meta) {
    return meta.count == 0;
}

uint32_t fixQueueAdvance(uint32_t index, uint32_t capacity) {
    if (capacity == 0) return 0;
    return (index + 1u) % capacity;
}
