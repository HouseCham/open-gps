#pragma once

#include <esp_task_wdt.h>

// Detach the calling (loop) task from the task WDT for this scope.
// TinyGSM blocking calls — connect, gprsConnect, restart, waitForNetwork —
// can run longer than WATCHDOG_TIMEOUT_S with no chance to reset from
// inside. Re-arm as soon as the call returns so the WDT protects again.
// HIL: task_wdt aborts were tripping mid-POST / mid-PDP-recovery.
struct WdtDetachGuard {
    WdtDetachGuard() { esp_task_wdt_delete(nullptr); }
    ~WdtDetachGuard() {
        esp_task_wdt_add(nullptr);
        esp_task_wdt_reset();
    }
};
