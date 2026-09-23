#include "cellular_manager.h"
#include <esp_task_wdt.h>
#include "config.h"
#include "secrets_data.h"

CellularManager::CellularManager()
    : policy(CELLULAR_RECOVERY_BASE_MS, CELLULAR_RECOVERY_MAX_MS,
              CELLULAR_RECOVERY_MAX_ATTEMPTS) {}

void CellularManager::begin(bool connected) {
    policy.event(connected ? ConnectivityEvent::PDP_OK : ConnectivityEvent::TRANSPORT_FAILURE, millis());
}

void CellularManager::reportTransportResult(TransportResult result) {
    if (result == TransportResult::SENT) policy.event(ConnectivityEvent::UPLOAD_SUCCESS, millis());
    else if (result == TransportResult::TRANSPORT_ERROR || result == TransportResult::TIMEOUT ||
             result == TransportResult::HTTP_SERVER_ERROR)
        policy.event(ConnectivityEvent::TRANSPORT_FAILURE, millis());
}

void CellularManager::tick(uint32_t nowMs) {
    const ConnectivityDecision decision = policy.tick(nowMs);
    if (decision.action == ConnectivityAction::NONE) return;
    TinyGsm& modem = board_modem();
    // The SIM7080G shares its radio: keep GNSS off for the recovery transaction.
    gnssWasEnabled = true;
    if (!modem.disableGPS()) {
        Serial.println(F("[WARN] GNSS was already disabled; continuing recovery"));
    }
    esp_task_wdt_reset();
    bool recovered = false;
    if (decision.action == ConnectivityAction::CONNECT_PDP) {
        // A false result is harmless when there was no active PDP context.
        if (!modem.gprsDisconnect())
            Serial.println(F("[WARN] PDP was already disconnected; reconnecting"));
        esp_task_wdt_reset();
        recovered = modem.isNetworkConnected() && modem.gprsConnect(CELLULAR_APN, "", "");
    }
    else if (decision.action == ConnectivityAction::RESTART_MODEM) {
        recovered = modem.restart();
        esp_task_wdt_reset();
        recovered = recovered && modem.waitForNetwork(CELLULAR_OPERATION_TIMEOUT_MS, true);
        esp_task_wdt_reset();
        recovered = recovered && modem.gprsConnect(CELLULAR_APN, "", "");
    }
    esp_task_wdt_reset();
    if (recovered) {
        policy.event(ConnectivityEvent::PDP_OK, millis());
        if (gnssWasEnabled && !modem.enableGPS())
            policy.event(ConnectivityEvent::TRANSPORT_FAILURE, millis());
    } else {
        policy.event(ConnectivityEvent::TRANSPORT_FAILURE, millis());
    }
}
