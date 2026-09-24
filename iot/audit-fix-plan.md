## Plan: Confiabilidad y autonomía GPS

Aplicar el trabajo en cuatro entregas ordenadas: primero eliminar la parada silenciosa de telemetría con recuperación celular y observabilidad local; después conservar puntos durante caídas; luego optimizar muestreo/energía con medición; por último demostrar TLS de producción. La lógica determinista y testeable se añadirá bajo `lib/`; los adaptadores que tocan AT, PMU, GNSS, filesystem o ESP32 quedarán en `src/`. No se introducirá `String`, `std::vector`, memoria dinámica ni esperas largas dentro de `loop()`.

**Fase 0: Baseline y decisiones de producto**
1. Instalar/normalizar PlatformIO y ejecutar `pio test -e native` y `pio run -e esp32s3box`; guardar versión de toolchain, TinyGSM, XPowersLib y firmware AT del SIM7080G. Esto bloquea validaciones posteriores, no cambios de firmware.
2. Definir una hoja de prueba HIL para el incidente: alimentación, capacidad real de batería, versión de firmware, ubicación de antenas, ventana temporal de la última transmisión, y logs seriales. Añadir un ensayo de pérdida de cobertura/PDP y un soak de al menos 6 horas antes de habilitar modos de ahorro.
3. Acordar los contratos que condicionan las fases siguientes: autonomía objetivo; perfil de uso (auto, bicicleta, peatón); política USB (sólo carga o tracking con VBUS); retención de datos offline; capacidad de backend para un endpoint batch; y si la prioridad de cola llena es conservar lo más reciente o lo más antiguo.

**Fase 1: Recuperación celular y diagnóstico (primera entrega de firmware)**
1. Crear `lib/connectivity_policy/connectivity_policy.h` y `lib/connectivity_policy/connectivity_policy.cpp` como una máquina de estados pura y host-testable: `IDLE`, `READY`, `BACKOFF`, `RECONNECT_PDP`, `RESTART_MODEM`, `FAILED`. La política recibirá eventos ya observados (`registration`, `pdp`, `transport failure`, `upload success`) y devolverá una acción programada y un deadline con aritmética segura ante wraparound. Usará backoff exponencial acotado y determinista; el jitter sólo se incorpora si puede generarse sin entropía falsa y es verificable.
2. Añadir `test/test_connectivity_policy/main.cpp` con transición de pérdida de PDP/registro, errores de transporte consecutivos, reinicio del contador tras `201`, límite de reintentos, expiración del backoff y wraparound de `millis()`. No simular TinyGSM en las pruebas nativas.
3. Crear `include/cellular_manager.h` y `src/cellular_manager.cpp`, adaptador Arduino dueño del estado efectivo del módem. Ejecutará las acciones de `ConnectivityPolicy` usando `board_modem()` y `CELLULAR_APN`, verificando respuesta de cada comando AT. Ninguna operación esperará sin límite: las operaciones TinyGSM conservan un timeout explícito y el watchdog se alimenta antes y después de cada llamada potencialmente bloqueante.
4. Implementar escalamiento conservador: comprobar registro/PDP sólo cuando la política lo solicite; reintentar socket/PDP; reconfigurar contexto y registrar; hacer reset funcional de módem; solicitar reinicio ESP32 sólo después de intentos acotados. No etiquetar un fallo genérico de `connect()` como DNS o TLS sin evidencia del módem.
5. Actualizar `src/main.cpp` para que `CellularManager::tick(millis())` sea la única fuente de disponibilidad de red. Eliminar `wifi_up`; habilitar GNSS incluso si el módem no registra; evitar cualquier upload hasta `ready()`. Coordinar explícitamente el uso compartido GNSS/LTE: antes de una recuperación que use radio se suspende GNSS, y al terminar se intenta restaurarlo; un fallo de restauración conserva estado de error y programa recuperación, no se sobrescribe con `WAITING_GNSS_FIX`.
6. Actualizar `src/transport.cpp` y `include/transport.h`: eliminar `cellular_up`, `WIFI_DISCONNECTED` y documentación WiFi muerta; devolver resultados que distingan sólo lo que la implementación puede probar (`SENT`, `TRANSPORT_ERROR`, `TIMEOUT`, `HTTP_CLIENT_ERROR`, `HTTP_SERVER_ERROR`, `CONFIG_ERROR`). Tras un resultado, notificar al `CellularManager`; el manager decide recuperación, no el transporte.
7. Corregir los defectos locales de bajo riesgo dentro de la misma entrega: inicializar `payload.signal_strength` a `-1` antes de leer CSQ; validar longitud antes de enmascarar API key en `src/secrets.cpp`; sustituir `GpsBoard::rawGnssState()` en `src/gps_board.cpp` por una lectura AT de buffer fijo o, si TinyGSM no expone una API segura, eliminar ese diagnóstico hasta tener una alternativa sin `String`; alimentar watchdog alrededor de esperas de registro; usar `CELLULAR_APN` en todos los comandos; migrar pines de `include/utilities.h` a `constexpr` tipados cuando XPowers/TinyGSM lo permitan.
8. Añadir diagnóstico serial de cambios de estado solamente: razón de reset, uptime, último `201`, fallos consecutivos, registro/PDP, CSQ conocido/desconocido, batería y mínimo de heap. No cambiar el contrato backend en esta entrega. Actualizar LED/telemetría con estados de conectividad inequívocos o documentar que el LED no confirma entrega.
9. Actualizar `README.md`, `AGENTS.md`, `include/transport.h`, `include/config.h` y `config/secrets.example.h` para eliminar referencias WiFi/TLS obsoletas, explicar secuencia AT con enlaces/versiones de manual SIM7080G y documentar configuración de backoff.

**Criterios de aceptación de Fase 1**
1. `pio test -e native` cubre política de conectividad y los bordes de sampling existentes.
2. `pio run -e esp32s3box` compila sin warnings nuevos; se revisa RAM/flash.
3. En hardware, retirar/restaurar antena o PDP provoca estado diagnosticable, backoff y recuperación automática de un `201` sin apagar el equipo.
4. Un ensayo móvil de 6 horas conserva telemetría de `last successful upload`, estado de red y heap mínimo; no requiere power-cycle para recuperar una caída inducida.

**Fase 2: Cola persistente y carga por lotes (depende de Fase 1 y decisión backend)**
1. Antes de firmware, acordar con backend un endpoint batch y ACK idempotente por `device_id + sequence_id`, con semántica de `2xx`, `4xx`, `429`, `5xx` y timeout. Mantener el endpoint individual durante migración. El backend devuelve explícitamente el mayor `sequence_id` persistido; no retirar un registro local sin ACK.
2. Diseñar una partición de datos específica en `partitions.csv`, sustituyendo/ajustando `huge_app.csv` en `platformio.ini`; fijar capacidad, reserva para OTA si se solicita y desgaste de flash. No usar PSRAM como única cola porque no sobrevive reset.
3. Crear `lib/fix_queue/fix_record.h`, `fix_queue.h` y `fix_queue.cpp` como formato binario fijo, versionado y con CRC. Incluir `sequence_id`, `boot_id`, timestamp GNSS, coordenadas, campos válidos y datos de diagnóstico mínimos; utilizar enteros escalados cuando se justifique. Mantenerlo libre de Arduino/filesystem para probar serialización, CRC, wraparound y recuperación.
4. Crear `include/persistent_fix_store.h` y `src/persistent_fix_store.cpp` como adaptador LittleFS/partición: metadatos A/B con CRC, escritura de dato antes de publicar head, recuperación tras corte de energía y commits agrupados. Elegir explícitamente comportamiento full; recomendar descartar el más antiguo con contador de pérdida y alerta, pues para un tracker en movimiento suele preservar la ubicación actual.
5. Integrar en `src/main.cpp`: aceptar/validar fix, encolar antes de intentar red, y extraer únicamente el frente de la cola. La política de transmisión determina cuándo abrir radio; transport no usa heap ni `std::vector`: serializa un lote máximo con buffers de tamaño fijo y no retira entradas hasta el ACK por secuencia.
6. Extender `src/transport.cpp`, `include/transport.h`, `lib/location_payload/` y los tests para serializar lote con límite de bytes, parsear respuesta HTTP completa y clasificar 401/403 como configuración, 429/5xx como reintentable y timeout como resultado desconocido/idempotente.
7. Añadir pruebas nativas `test/test_fix_queue/main.cpp` y `test/test_batch_payload/main.cpp`: CRC, formato, wraparound, full, recuperación de metadatos parciales, ACK parcial, límite de lote, serialización y códigos HTTP. Añadir prueba HIL de corte de alimentación durante append y de outage de al menos 30 minutos.

**Criterios de aceptación de Fase 2**
1. Ningún fix aceptado se pierde durante outage/reinicio dentro de la capacidad documentada.
2. Un ACK parcial conserva el resto y un reenvío no duplica ubicaciones en backend.
3. Se mide y documenta flash usado, capacidad efectiva, tasa de escritura y política cuando la cola se llena.

**Fase 3: Corrección de muestreo y optimización de energía (depende de telemetría y mediciones)**
1. Corregir en `lib/sampling_policy/sampling_policy.cpp` la transición MOVING -> STATIONARY para aceptar velocidad `0.0`; añadir `test/test_sampling_policy/main.cpp` para ese caso, umbrales e histéresis. Conservar `notifyGpsReenabled()` sólo si se desea poll inmediato y documentarlo; cambiar a `_lastPollMs = nowMs` si el requisito es esperar el intervalo completo.
2. Reemplazar `maxFixAgeMs` por una semántica implementable: rastrear el timestamp GNSS previo y rechazar/diagnosticar timestamps que no avanzan más allá de un umbral de estancamiento. No comparar RFC3339 contra `millis()` sin una fuente de hora común. Añadir validación configurable de accuracy, timestamp, satélites y saltos físicamente imposibles; no enviar campos opcionales reales como `0` por usar un sentinel, sino introducir flags de validez compactos.
3. Separar política de adquisición, aceptación y envío: al moverse mantener GNSS para evitar TTFF y encolar a la cadencia de trayectoria; abrir celular por intervalo/lote configurado. Al estar estacionario, reducir heartbeat y evaluar apagar GNSS/radio.
4. Crear una sesión de medición con medidor/analizador: boot, búsqueda GNSS, fix, registro LTE, TLS/POST, idle, backoff, DTR, PSM/eDRX y deep sleep. Establecer baseline y autonomía objetivo antes de cambiar configuraciones de ahorro.
5. Sólo tras validar la hoja de datos y la red Hologram, añadir `src/power_manager.*` para perfil `MOVING`, `STATIONARY`, `NO_NETWORK`, `LOW_BATTERY` y `CHARGING`. El manager decide DTR/rieles/deep sleep; comienza con flags de configuración desactivados y no activa PSM/eDRX hasta registrar los parámetros concedidos por la red y demostrar wake-up confiable.
6. Definir low-battery con histéresis y medición calibrada de AXP2101; reducir actividad antes de deep sleep. Resolver el requisito de VBUS: conservar sólo-carga o permitir tracking alimentado mediante una bandera explícita y HIL repetido de plug/unplug. Para este prototipo, VBUS debe permanecer configurado exclusivamente como señal de carga: al detectarlo se suspenden módem/GNSS y tracking; el seguimiento normal funciona con batería y empieza al retirar el cargador.

**Criterios de aceptación de Fase 3**
1. Pruebas nativas prueban velocidad cero, cambios de estado, fix estancado y validación de calidad.
2. La ruta de prueba reporta consumo promedio/picos por estado y autonomía proyectada basada en medición real.
3. DTR/PSM/eDRX/deep sleep no se activan en producción hasta superar pruebas de wake-up, reconexión y GNSS para cada red objetivo.
4. Con VBUS conectado, la placa entra en modo sólo carga de forma determinista; al retirar VBUS reinicia una vez y vuelve al modo tracker sin intervención adicional.

**Fase 4: Seguridad de producción y documentación de entrega (depende de investigación SIM7080G/TinyGSM)**
1. Hacer un spike aislado para identificar exactamente cómo `TinyGsmClientSecure` con el firmware SIM7080G actual configura CA, cadena, SNI y validación de hostname. Verificar el código de la versión fijada de TinyGSM y manual AT; no asumir que `configTime()` del ESP32 sirve al TLS ejecutado dentro del módem.
2. Implementar el mecanismo probado para obtener hora y validar certificado en el módem: CA aprovisionada, reloj válido y hostname/SNI. Eliminar cualquier modo inseguro y fallar cerrado si no puede validarse.
3. Crear prueba HIL con certificado correcto, CA desconocida, hostname erróneo y certificado vencido. Confirmar que no se envía API key/ubicación al servidor incorrecto.
4. Endurecer provisionamiento: validación de UUID/token, no imprimir fragmentos de API key en builds de producción, claves por dispositivo revocables, dependencias pinneadas y verificación de secret placeholder en build.
5. Evaluar Secure Boot, Flash Encryption y particiones OTA con rollback como decisión de despliegue, coordinada con Fase 2 por espacio flash. Actualizar README/AGENTS con versión de módem, antenas, parámetros validados, procedimiento de rotación y pruebas de seguridad.

**Archivos relevantes**
- `c:\Users\QV652WS\Dev\personal\open-gps\iot\src\main.cpp` — orquestación de managers, propiedad de flujo GNSS/red/cola.
- `c:\Users\QV652WS\Dev\personal\open-gps\iot\src\transport.cpp` y `include\transport.h` — AT/PDP, POST, resultados y migración batch.
- `c:\Users\QV652WS\Dev\personal\open-gps\iot\src\gps_board.cpp` y `include\gps_board.h` — control GNSS, diagnóstico sin heap, reset/radio del módem.
- `c:\Users\QV652WS\Dev\personal\open-gps\iot\lib\connectivity_policy\` — nueva política pura de recuperación y backoff.
- `c:\Users\QV652WS\Dev\personal\open-gps\iot\src\cellular_manager.cpp` y `include\cellular_manager.h` — nuevo adaptador Arduino de conectividad.
- `c:\Users\QV652WS\Dev\personal\open-gps\iot\lib\fix_queue\` y `src\persistent_fix_store.cpp` — cola persistente de Fase 2.
- `c:\Users\QV652WS\Dev\personal\open-gps\iot\lib\sampling_policy\` — corrección de movimiento y validación de fixes.
- `c:\Users\QV652WS\Dev\personal\open-gps\iot\include\config.h` — parámetros de backoff, lote, calidad y energía, todos documentados.
- `c:\Users\QV652WS\Dev\personal\open-gps\iot\src\telemetry.cpp` y `include\telemetry.h` — estado LED y diagnóstico de salud.
- `c:\Users\QV652WS\Dev\personal\open-gps\iot\platformio.ini` y futura `partitions.csv` — versiones y partición persistente/OTA.
- `c:\Users\QV652WS\Dev\personal\open-gps\iot\README.md`, `AGENTS.md` y `agent-feedback.md` — documentación sincronizada.

**Scope boundaries**
- Fase 1 no modifica el backend ni añade filesystem; su entrega es recuperar red y producir evidencia.
- Fase 2 requiere una decisión explícita de backend antes de borrar registros locales por ACK.
- Fase 3 no habilita DTR, PSM, eDRX ni deep sleep hasta tener datos de corriente y pruebas HIL; no se fijan comandos AT especulativos.
- Fase 4 no presupone WiFi ni reutiliza `configTime()` como solución para TLS del módem.
