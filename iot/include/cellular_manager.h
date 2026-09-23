#pragma once
#include <Arduino.h>
#include "connectivity_policy.h"
#include "gps_board.h"
#include "transport.h"

class CellularManager {
public:
    CellularManager();
    void begin(bool connected);
    void tick(uint32_t nowMs);
    void reportTransportResult(TransportResult result);
    bool ready() const { return _policy.ready(); }
private:
    ConnectivityPolicy _policy;
    bool _gnssWasEnabled = true;
};
