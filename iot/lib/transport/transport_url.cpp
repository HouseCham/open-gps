#include "transport_url.h"

#include <cstdio>

size_t transport_build_url(const char* api_host,
                           uint16_t    api_port,
                           const char* uuid,
                           char*       buf,
                           size_t      buf_len) {
    if (!api_host || !uuid || !buf) return 0;
    int n;
    if (api_port > 0)
        n = snprintf(buf, buf_len, "%s:%u/api/v1/devices/%s/locations",
                     api_host, (unsigned)api_port, uuid);
    else
        n = snprintf(buf, buf_len, "%s/api/v1/devices/%s/locations",
                     api_host, uuid);
    if (n < 0 || (size_t)n >= buf_len) return 0;
    return (size_t)n;
}