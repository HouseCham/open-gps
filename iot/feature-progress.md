# Progreso del feature: confiabilidad IoT

## Sesion actual

### Fase 1 implementada

- Se agrego `lib/connectivity_policy/` con una maquina de estados pura para recuperacion celular.
- La politica implementa backoff determinista, limite de intentos, recuperacion PDP, escalamiento a reinicio del modem y manejo seguro de `millis()` con overflow.
- Se agrego `test/test_connectivity_policy/main.cpp` con pruebas de exito, backoff, escalamiento y wraparound.
- Se agrego `CellularManager` en `include/cellular_manager.h` y `src/cellular_manager.cpp`.
- `CellularManager` consulta el estado de red, reconecta PDP, reinicia el modem despues de fallos consecutivos y deja el reinicio del ESP32 como ultimo recurso de la politica.
- Durante una recuperacion celular se suspende GNSS y se intenta reactivarlo al terminar.
- `main.cpp` mantiene GNSS activo aunque la conexion celular inicial falle y delega la disponibilidad de red al manager.
- El transporte dejo de usar los estados heredados de WiFi y reporta resultados HTTP diferenciados.
- Se corrigio el sentinel de CSQ desconocido a `-1`.
- Se corrigio el enmascarado de API keys cortas para evitar accesos fuera de rango.
- El perfil `esp32s3box-debug` desactiva el modo solo carga para permitir diagnostico por USB.

### Problema GNSS encontrado y corregido

- TinyGSM rechazaba la respuesta `+CGNSINF` del SIM7080G porque `fix_status` llegaba vacio.
- Se agrego temporalmente un fallback que aceptaba coordenadas con ese campo vacio.
- Ese fallback envio coordenadas predeterminadas/stale (`23.619999,-102.570001`) y fue retirado inmediatamente.
- El firmware ahora solo acepta fixes cuando TinyGSM confirma `fix_status=1`.
- El funcionamiento real fue comprobado en hardware con coordenadas correctas y respuestas `POST 201`.

### Verificaciones realizadas

- `pio test -e native`: 27/27 pruebas exitosas.
- `pio run -e esp32s3box`: compilacion exitosa.
- `pio run -e esp32s3box-debug`: compilacion exitosa.
- Hardware: registro celular, obtencion de IP, fix GNSS valido y envio confirmado con `POST 201`.

## Estado actual

- La placa envia ubicaciones correctamente al backend.
- El modo debug permite mantener tracking y consola mientras la placa esta conectada por USB.
- El firmware normal conserva el modo USB solo carga.
- La cola persistente offline todavia no existe; los puntos producidos durante una caida de red aun pueden perderse.

## Siguiente paso

Completar la validacion HIL de Fase 1 antes de iniciar Fase 2:

1. Inducir perdida de cobertura o PDP.
2. Confirmar en logs el backoff y la reconexion automatica sin power-cycle.
3. Ejecutar un soak de al menos 6 horas registrando ultimo `POST 201`, estado celular, fallos consecutivos y heap minimo.
4. Confirmar la decision del backend para la cola persistente y el endpoint batch.

La Fase 2 comenzara con el diseno de la cola persistente y sus ACK idempotentes; no se debe implementarla hasta acordar esa semantica con el backend.
