#include "transport_url.h"

#include <cstdio>
#include <cstring>

size_t transportBuildUrl(const char* apiHost,
                           uint16_t    apiPort,
                           const char* uuid,
                           char*       buf,
                           size_t      bufLen) {
    if (!apiHost || !uuid || !buf) return 0;
    int n;
    if (apiPort > 0)
        n = snprintf(buf, bufLen, "%s:%u/api/v1/devices/%s/locations",
                     apiHost, (unsigned)apiPort, uuid);
    else
        n = snprintf(buf, bufLen, "%s/api/v1/devices/%s/locations",
                     apiHost, uuid);
    if (n < 0 || (size_t)n >= bufLen) return 0;
    return (size_t)n;
}

size_t transportBuildBatchUrl(const char* apiHost,
                                 uint16_t    apiPort,
                                 const char* uuid,
                                 char*       buf,
                                 size_t      bufLen) {
    const size_t n = transportBuildUrl(apiHost, apiPort, uuid, buf, bufLen);
    if (n == 0) return 0;
    // "/batch" = 6 chars + NUL
    if (n + 7 > bufLen) return 0;
    memcpy(buf + n, "/batch", 7);
    return n + 6;
}
