#pragma once
#include <Arduino.h>

enum class SystemState {
    BOOTING,
    CONNECTING_NETWORK,
    WAITING_GNSS_FIX,
    UPLOADING_API,
    ERR_SECRETS,
    ERR_NETWORK,
    ERR_API_FAIL
};

void telemetry_set_state(SystemState state);
void telemetry_tick();
