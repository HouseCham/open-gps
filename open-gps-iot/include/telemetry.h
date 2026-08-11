#pragma once
#include <Arduino.h>

enum class SystemState {
    BOOTING,
    CONNECTING_NETWORK,
    WAITING_GNSS_FIX,
    GNSS_FIX_READY,
    GNSS_NO_RESPONSE,
    UPLOADING_API,
    ERR_BOARD,
    ERR_SECRETS,
    ERR_NETWORK,
    ERR_API_TRANSPORT,
    ERR_API_HTTP,
    ERR_API_CONFIG
};

void telemetry_set_state(SystemState state);
void telemetry_pulse_success();
void telemetry_tick();
