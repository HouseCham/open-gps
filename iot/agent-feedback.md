# Auditoría técnica del firmware IoT

**Fecha:** 2026-09-21  
**Objetivo:** mejorar confiabilidad en campo, consumo energético, calidad de datos, mantenibilidad y seguridad del firmware para la LilyGo T-SIM7080G-S3 H606.

## Resumen ejecutivo

El fallo observado en carretera —el equipo seguía encendido, dejó de consumir datos de Hologram después de unas dos horas y volvió a funcionar tras apagarlo y encenderlo— es altamente consistente con una pérdida de registro LTE-M o del contexto PDP sin recuperación automática. `transport_cellular_begin()` registra la red y activa datos una sola vez durante `setup()`. Después, `transport_post_locations()` sólo consulta un booleano estático (`cellular_up`) que nunca se invalida, no comprueba `modem.isNetworkConnected()`/`modem.isGprsConnected()` y no intenta registrar ni reactivar el PDP cuando fallan los POST. El reinicio recupera el servicio porque repite exactamente esas operaciones.

Esto es un defecto de confiabilidad confirmado por inspección del flujo de control, aunque para atribuir el incidente concreto hace falta conservar logs y estados del módem. El primer cambio debe ser una máquina de estados de conectividad con comprobación periódica, backoff acotado, recuperación de red/PDP y escalamiento a reinicio del módem/ESP32. En paralelo, el dispositivo necesita almacenamiento local persistente: hoy cualquier punto generado durante una caída de cobertura se pierde.

## Hallazgos que determinan el estado

- `src/transport.cpp:16,136,174-210` - recuperación de red obligatoria - `cellular_up` sólo cambia a `true`; no se detecta ni recupera una pérdida de registro o PDP.
- `src/main.cpp:152-164,215` - degradación controlada obligatoria - si falla la conexión inicial no se habilita GNSS y no existe transición posterior para reconectar.
- `src/main.cpp:220-256` - recuperación de periféricos obligatoria - un fallo al reactivar GNSS puede quedar sobrescrito por el estado `WAITING_GNSS_FIX`.
- `src/transport.cpp:69-133` - TLS verificable obligatorio - el cliente seguro no configura de forma visible CA ni validación de hostname y la documentación afirma una llamada a `setInsecure()` que no existe en el código.
- `src/gps_board.cpp:177-184` - memoria dinámica prohibida en `loop()` - `rawGnssState()` crea un Arduino `String` repetidamente durante periodos sin fix.
- `lib/sampling_policy/sampling_policy.cpp:50-58` - transición de estado incorrecta - una velocidad exactamente igual a cero no permite pasar de MOVING a STATIONARY.
- `lib/sampling_policy/sampling_policy.h:16` - configuración inactiva - `maxFixAgeMs` se almacena pero nunca se aplica.
- `src/transport.cpp:136-165` - calidad de datos - CSQ desconocido puede enviarse como `0` porque el payload se inicializa a cero, aunque el comentario declara `-1` como sentinel.
- `src/secrets.cpp:18-37` - límites de memoria - el diagnóstico indexa los primeros y últimos cuatro caracteres de una clave sin validar su longitud.
- `src/transport.cpp:175-186` - retorno de hardware ignorado - varias respuestas AT y cambios de modo se descartan, dejando continuar una configuración celular no confirmada.

## Alcance y método

Se revisaron `README.md`, `AGENTS.md`, `platformio.ini`, el flujo completo de `setup()`/`loop()`, PMU y GNSS, transporte celular, telemetría LED, secretos, serialización, políticas de carga y muestreo, y las pruebas nativas. La revisión es estática: no se dispuso de la placa, trazas seriales del viaje, mediciones de corriente ni firmware del módem.

No fue posible ejecutar `pio test -e native` ni el build ESP32 porque PlatformIO no está instalado ni disponible en `PATH` en este entorno. Los resultados de compilación, consumo y comportamiento de radio deben confirmarse en hardware.

## Arquitectura actual

### Placa y módulos

- LilyGo T-SIM7080G-S3 H606 con ESP32-S3, módem SIM7080G LTE Cat-M/NB-IoT, GNSS integrado y PMU AXP2101.
- El AXP2101 controla las alimentaciones del módem/UART/GNSS, mide VBUS y batería y reutiliza su LED de carga como telemetría.
- El SIM7080G comparte la radio entre GNSS y datos celulares. El firmware deshabilita GNSS antes de cada POST y lo vuelve a habilitar después.
- UART1 conecta ESP32 y módem. TinyGSM administra AT/GNSS/sockets y XPowersLib administra el PMU.
- La configuración fuerza LTE-M y APN `hologram`; no existe fallback a NB-IoT ni selección dinámica según red visitada.

### Secuencia de arranque

1. Se deshabilita temporalmente el brownout detector.
2. Se inicia sólo el PMU, se apagan rieles no usados y se evalúa VBUS.
3. Si VBUS permanece presente y `CHARGE_MODE_ENABLED=true`, se entra en modo sólo carga y nunca se inicia tracking.
4. Sin VBUS, se energiza el módem, se inicia UART y se prueba `AT`, incluyendo pulsos de PWRKEY si no responde.
5. Se configura watchdog, se cargan secretos, se fuerza LTE-M/APN, se espera registro hasta 10 minutos y se activa PDP.
6. Sólo si la red quedó activa se habilita GNSS.

### Ciclo de tracking

1. `SamplingPolicy` decide cuándo consultar GNSS según velocidad y estado de movimiento.
2. `GpsBoard::pollFixPayload()` obtiene `+CGNSINF` a través de TinyGSM y construye timestamp, coordenadas, velocidad, altitud, precisión y satélites.
3. Si la política decide transmitir, se apaga GNSS, se mide batería/CSQ, se serializa JSON y se abre una conexión TLS nueva.
4. Se envía un POST manual HTTP/1.1; sólo `201` se considera éxito. En error de transporte se espera dos segundos y se intenta una vez más.
5. Se vuelve a habilitar GNSS. No hay cola persistente, ACK por punto, reconexión celular ni recuperación escalonada.

## Incidente de carretera

### Causa más probable: pérdida de red/PDP sin recuperación

**Confianza alta por correspondencia entre código y síntoma.** En carretera hay cambios de celda, zonas de cobertura débil, roaming entre redes asociadas a Hologram y posibles cierres de contexto PDP. Cualquiera de esos eventos puede dejar al ESP32 y LEDs activos mientras el módem ya no puede transportar IP.

El dashboard de Hologram confirma ausencia de tráfico, pero por sí solo no distingue entre pérdida de registro, PDP inactivo, DNS, socket/TLS bloqueado o firmware del módem. El reinicio recupera porque vuelve a ejecutar `CFUN`, registro y `gprsConnect()`; el firmware normal nunca repite esa secuencia.

Problemas concretos relacionados:

- `cellular_up` y `wifi_up` son dos estados independientes que pretenden representar la misma realidad y pueden quedar obsoletos.
- `TransportResult::WIFI_DISCONNECTED` nunca es retornado por el transporte celular; por tanto, la única rama que marca `wifi_up=false` es inalcanzable.
- Un `TRANSPORT_ERROR` sólo cambia el LED y vuelve a probar en el siguiente punto. No invalida el estado ni reabre PDP.
- El watchdog no ayuda si el programa sigue ejecutándose y los AT/sockets fallan rápidamente. Está diseñado para bloqueos, no para estados lógicos inválidos.
- Si la conexión inicial falla, el dispositivo permanece en `ERR_NETWORK` hasta un reinicio y ni siquiera habilita GNSS para conservar puntos offline.

### Otras hipótesis que deben medirse

1. **Módem bloqueado:** el SIM7080G puede seguir respondiendo `AT` pero tener socket o pila IP atascados. Requiere escalamiento desde PDP reconnect hasta `modem.restart()`, `CFUN` o PWRKEY.
2. **Alimentación/batería:** un pico de corriente LTE o caída de batería puede afectar al módem sin apagar visiblemente el ESP32. Hoy no se registra mínimo de voltaje, causa de reset ni estado del riel en el momento del fallo.
3. **Cobertura/antena:** CSQ sólo se lee al enviar y no se conservan RSRP, RSRQ/SINR, operador, celda ni causa extendida de error. Una antena LTE mal ubicada dentro del vehículo agrava handovers y retransmisiones.
4. **Fragmentación de heap:** `getGPSraw()` devuelve `String` cada 10 segundos durante periodos sin fix. Es una ruta posible en ejecuciones largas, pero menos consistente que la falta de reconexión y debe confirmarse con heap mínimo/máximo.
5. **Modo sólo carga:** si el viaje usó alimentación USB del automóvil, VBUS confirmado ordena reiniciar y quedarse sólo cargando. Hay que confirmar si la placa operó exclusivamente con batería y si hubo conexión/desconexión de USB durante el trayecto.
6. **GNSS no reactivado:** después de un POST, `enableGps()` puede fallar. El código registra error, pero el `switch` de un POST exitoso cambia enseguida el estado a `WAITING_GNSS_FIX`, ocultando la condición.

### Recuperación recomendada

Implementar una sola máquina de estados no bloqueante, por ejemplo:

`MODEM_OFF -> MODEM_READY -> REGISTERING -> PDP_ACTIVE -> UPLOADING -> BACKOFF -> RECOVERING`.

- Consultar registro y PDP antes de enviar y después de un fallo, no continuamente: cada consulta AT también consume energía.
- Clasificar por separado `NO_REGISTRATION`, `NO_PDP`, `DNS_ERROR`, `CONNECT_ERROR`, `TLS_ERROR`, `TIMEOUT`, `HTTP_4XX` y `HTTP_5XX`.
- Primer nivel: cerrar socket y reintentar con backoff exponencial y jitter.
- Segundo nivel: `gprsDisconnect()` + `waitForNetwork()` + `gprsConnect()`.
- Tercer nivel: reinicio funcional del módem/`CFUN` y nueva configuración APN/RAT.
- Cuarto nivel: PWRKEY/rail cycle controlado; `ESP.restart()` sólo como último recurso.
- Alimentar el watchdog antes y después de operaciones potencialmente bloqueantes, con timeout explícito para cada transición.
- Limitar intentos para evitar gastar la batería buscando red sin cobertura: por ejemplo 30 s, 1, 2, 4, 8 y 15 minutos, con un máximo configurable.
- Mantener GNSS y la cola funcionando aunque la red esté caída; conectividad y adquisición no deben compartir un booleano.

## Ahorro de batería

### Problema estructural actual

El módem queda despierto (`DTR` en LOW), sus rieles permanecen encendidos, el ESP32 no entra en light/deep sleep y GNSS consulta entre 1 y 15 segundos. Además, cada punto transmitido abre DNS/TCP/TLS/HTTP y conmuta GNSS->LTE->GNSS. El coste dominante no es serializar JSON: son adquisición GNSS, registro/transmisión RF, handshakes TLS y cambios de radio.

No se deben programar valores `AT+CPSMS`/eDRX fijos sin confirmar qué temporizadores acepta la red visitada por Hologram. El módem solicita PSM/eDRX, pero la red los negocia y puede rechazarlos. Deben leerse y registrarse los valores realmente concedidos.

### Estrategia recomendada por estados

- **MOVING:** mantener GNSS activo para evitar reacquisiciones, guardar puntos localmente y transmitir lotes cada 30-120 segundos o cada N puntos. Una sesión LTE por lote reduce mucho más energía que una conexión por punto.
- **STATIONARY:** después de confirmar inmovilidad, apagar GNSS y radio, poner ESP32 en deep sleep y despertar por temporizador para heartbeat. Para máxima autonomía, añadir un acelerómetro de bajo consumo con interrupción de movimiento; sólo GPS obliga a despertar y adquirir fix para descubrir que nada cambió.
- **NO_NETWORK:** continuar almacenando a la cadencia necesaria, pero espaciar intentos de registro con backoff. Buscar red de forma continua puede ser el peor estado energético.
- **LOW_BATTERY:** reducir muestreo/envío, desactivar LEDs/logs y finalmente entrar en suspensión segura con histéresis. No existe hoy una política de batería baja.
- **CHARGING:** decidir como requisito de producto si USB significa “sólo cargar” o “rastrear con alimentación externa”. El comportamiento actual siempre suspende tracking.

### Acciones de energía priorizadas

1. Agrupar puntos y reutilizar una sesión de datos; idealmente agregar un endpoint batch con ACK por elemento.
2. Medir energía por fase: boot, búsqueda GNSS, fix estable, registro LTE, TLS, POST, idle, PSM y deep sleep.
3. Probar DTR/sleep del SIM7080G sólo después de configurar correctamente el modo de sueño y verificar wake-up; cambiar el pin sin el AT correspondiente puede dejar el módem inaccesible.
4. Evaluar PSM y eDRX con la SIM/red Hologram reales y registrar temporizadores negociados.
5. Apagar por PMU los rieles que no se usan durante sleeps largos; comparar el coste de re-registro contra mantener PDP para cada cadencia.
6. Compilar fuera los logs verbosos y patrones LED en producción. Los LEDs también deben poder deshabilitarse.
7. Usar porcentaje/estado de batería del PMU si está disponible y calibrado; voltaje instantáneo bajo carga no es una estimación fiable de autonomía.
8. Revisar la necesidad de deshabilitar BOD al inicio. Enmascarar brownout evita resets, pero también permite ejecutar a voltaje inseguro; la solución de raíz es alimentación, capacidad de batería, riel y desacoplo adecuados a los picos LTE.

Definir una meta medible antes de optimizar: batería y capacidad reales, intervalo de tracking, duración diaria en movimiento, cobertura, heartbeat y autonomía objetivo. Sin ese perfil no se puede elegir correctamente entre conexión persistente, PSM o power-cycle completo.

## Muestreo y calidad GNSS

### Defectos actuales

- Velocidad `0.0` es válida para “detenido”, pero `validSpeed()` exige `> 0`; estando en MOVING, una secuencia de ceros nunca confirma STATIONARY. Esto mantiene polling y uploads agresivos cuando el vehículo se detiene.
- `MAX_FIX_AGE_MS`/`maxFixAgeMs` no se usa. Tampoco se rechazan timestamps repetidos, fechas inválidas o fixes cacheados tras reactivar GNSS.
- La validez sólo exige coordenadas en rango y timestamp no vacío. No aplica mínimo de satélites, máximo de accuracy/HDOP, ni prueba de salto físicamente imposible.
- En movimiento, `INTERVAL_ELAPSED` normalmente ordena upload en cada polling adaptativo. Por ello muestreo y reporte están separados en tipos, pero no en coste real.
- A 130 km/h el mínimo de 1 s produce aproximadamente 36 m entre muestras, no los 25 m declarados. Puede ser una decisión válida, pero debe tratarse como límite explícito.
- Cero se usa como “desconocido” en altitud y velocidad, aunque ambos ceros son valores reales. Conviene un bitmask de campos válidos o `std::optional` sólo si su coste/soporte embebido es aceptable.
- El comentario de precisión es engañoso: TinyGSM entrega coordenadas como `float`; convertirlas después a `double` no recupera precisión ya perdida. El formato JSON puede mostrar más dígitos, pero no crea resolución de 1 mm.

### Algoritmo propuesto

- Separar tres decisiones: **cuándo encender/consultar GNSS**, **cuándo aceptar un punto** y **cuándo abrir radio/subir lote**.
- Tratar velocidad cero como válida y usar histéresis temporal: entrar a MOVING tras N observaciones y salir tras N observaciones bajo umbral, incluyendo cero.
- Aceptar un punto sólo si fecha/hora son válidas, cambia respecto al anterior, accuracy está bajo un límite y el salto implica una velocidad físicamente plausible.
- Comparar desplazamiento contra `max(TARGET_SPACING, k * accuracy)` para evitar enviar deriva GPS estando detenido.
- Usar un filtro robusto pequeño, como mediana de 3-5 velocidades/distancias, antes de cambiar estado. Un Kalman complejo no es necesario sin evidencia de beneficio.
- Mantener una cota temporal máxima para no dejar grandes huecos aunque la distancia sea pequeña, y una cota de distancia para curvas/velocidad alta.
- Hacer configurables perfiles `walking`, `bicycle`, `vehicle` o inferirlos con bandas de velocidad; probarlos con trazas grabadas y no sólo puntos sintéticos.
- Cuando GNSS se reactiva, esperar un fix nuevo y no reutilizar automáticamente una solución anterior del módem.

## Datos y tolerancia a desconexión

La ausencia de cola es un bloqueo para el propósito del proyecto. Un tracker móvil debe asumir huecos de cobertura como operación normal, no como excepción.

Diseñar una cola circular persistente con:

- Registro binario versionado y de tamaño fijo; convertir a JSON sólo al enviar.
- `sequence_id`, `boot_id`, timestamp GNSS, coordenadas, campos válidos y CRC.
- Escritura antes del envío y borrado sólo tras ACK inequívoco del backend.
- Límite de capacidad y política explícita: conservar más antiguo, conservar más reciente o degradar cadencia cuando se llena.
- Recuperación tras corte de energía sin corromper head/tail.
- Lotes pequeños y reanudables para no monopolizar radio/watchdog.
- Control de desgaste si se usa flash interna: páginas append-only, commits agrupados y partición dedicada. PSRAM puede servir de caché, pero no sustituye persistencia.

Como orden de magnitud, tres horas a un punto cada cinco segundos son 2160 registros. Un formato binario compacto cabe en una fracción del espacio que ocuparía JSON y reduce escrituras y bytes celulares.

El backend debería aceptar lotes e indicar qué elementos fueron persistidos. La idempotencia actual por `(device_id, recorded_at)` ayuda, pero un `sequence_id` evita ambigüedad si el GNSS repite segundos o reinicia. Conservar también `received_at` del servidor permite diagnosticar atraso de cola.

Clasificar respuestas HTTP:

- `2xx`: ACK y retirar de cola.
- `400/401/403/404`: error permanente/configuración; no reintentar agresivamente cada ciclo.
- `408/429/5xx`: conservar y reintentar con backoff, respetando `Retry-After`.
- Respuesta inválida/timeout: estado desconocido; reenviar de forma idempotente.

## Seguridad

### TLS

El README afirma que `src/transport.cpp` ejecuta `client.setInsecure()`, pero el código sólo contiene comentarios al respecto. La ruta activa usa `TinyGsmClientSecure`, no `WiFiClientSecure`, y no se observa carga de CA, asociación de certificado, SNI/hostname verification ni configuración SSL del SIM7080G. Por tanto, no debe afirmarse que TLS está validado ni que está explícitamente en modo insecure: el estado real es **no demostrado**.

Además, `configTime()` descrito en el README pertenecía a la ruta WiFi. En una ruta TinyGSM basada en sockets del módem, SNTP del ESP32 no necesariamente alimenta el reloj/certificados del SIM7080G. La solución debe seguir la API TinyGSM y el manual AT de la versión exacta del módem: provisionar CA, configurar contexto SSL, habilitar SNI/hostname validation y asegurar hora válida por red/GNSS o mecanismo soportado por el módem.

Pruebas de aceptación obligatorias:

- El dispositivo acepta el certificado real con cadena vigente.
- Rechaza certificado expirado, CA desconocida y hostname incorrecto.
- El cambio/rotación de CA tiene procedimiento documentado.
- Una captura o proxy controlado confirma que la API key y ubicación no son recuperables mediante MITM.

### Credenciales y cadena de suministro

- `config/secrets.h` está correctamente ignorado, pero UUID/API key quedan en `.rodata` del firmware y pueden extraerse de flash. Usar una clave única y revocable por dispositivo; evaluar Secure Boot y Flash Encryption del ESP32-S3 para producción.
- Validar formato/longitud de UUID y token, no sólo que sean no vacíos. No imprimir ningún fragmento de API key en producción.
- Pinnear versiones de TinyGSM y XPowersLib; hoy sólo plataforma y ArduinoJson tienen restricción explícita. Añadir un proceso de actualización y revisión de vulnerabilidades.
- Evitar un endpoint placeholder en builds de producción. `https://gps-tracker.local` no es un destino DNS celular apropiado; el build debe fallar si host/credenciales siguen con valores de ejemplo.
- El perfil `huge_app.csv` debe revisarse: normalmente prioriza tamaño de aplicación y puede impedir una estrategia OTA con partición dual y rollback seguro.

## Transporte y clean code

- Renombrar `wifi_up` a un estado de red real y `WIFI_DISCONNECTED` a `NETWORK_DISCONNECTED`; eliminar la ruta WiFi muerta o convertirla en una implementación explícita detrás de una interfaz.
- `transport.h` aún documenta “Stage 3 WiFi”, mientras `main.cpp` sólo llama a celular. Es deuda que ya está ocultando errores de seguridad y recuperación.
- Comprobar todos los `sendAT()`, `waitResponse()`, `setNetworkMode()` y `setPreferredMode()`. Activar errores extendidos del módem y abortar/reintentar si la configuración no fue confirmada.
- Usar `CELLULAR_APN` en todos los comandos; ahora `hologram` está duplicado como literal varias veces.
- Sustituir el parser HTTP manual por una implementación pequeña pero completa/probada, o cubrir escrituras parciales, status line, headers, body, timeout y `Connection` de forma explícita.
- El parser de URL ignora el esquema, siempre conecta al puerto 443 y trata `host:port` como hostname. Esto contradice la prueba que anuncia soporte de puerto. Parsear URL estructuralmente o aceptar host, puerto y TLS como campos separados.
- `http_error_name()` describe errores de `HTTPClient`, pero la ruta activa no usa `HTTPClient` para realizar el POST y la rama de código negativo no representa el resultado del parser actual. Eliminar ese legado.
- Reemplazar `getGPSraw()`/`String` por lectura AT hacia buffer fijo o encapsular una API TinyGSM que no asigne heap.
- Dividir `main.cpp`: `ChargeModeController`, `ConnectivityManager`, `TrackerController` y `PersistentFixQueue`. `setup()`/`loop()` deberían sólo coordinar `begin()`/`tick()`.
- Los pines están definidos como macros aunque la regla local pide `constexpr`; migrarlos con tipos explícitos.
- No usar `delay()` para retry de red en operación. Una máquina de estados basada en `millis()` permite telemetría, watchdog, cola y gestión de batería concurrentes.

## Observabilidad

Los LEDs visibles no prueban que haya conectividad. En el firmware actual pueden indicar PMU, carga, estado GNSS o error; ver parpadeo “normal” no significa que se haya recibido un `201` reciente.

Persistir y reportar, sin exponer secretos:

- Versión de firmware, versión de módem, `boot_id`, contador de boots y `esp_reset_reason()`.
- Uptime, última transmisión exitosa y edad desde ese éxito.
- Estado de registro/PDP, operador, RAT, celda y calidad LTE relevante (CSQ y, si el módem lo expone, RSRP/RSRQ/SINR).
- Código/categoría del último error, fallos consecutivos y nivel de recuperación aplicado.
- Voltaje/SOC de batería, mínimo observado y causa de low-power.
- Heap libre, mínimo de heap y mayor bloque contiguo para detectar fragmentación.
- Estado GNSS, TTFF, satélites, accuracy y tiempo que la radio permaneció apagada.
- Profundidad, capacidad y edad del elemento más antiguo de la cola.

Agregar un heartbeat de salud poco frecuente al backend, separado de ubicaciones, y una alerta si `last_success_age` supera el umbral. La ubicación es dato sensible: limitar retención y detalle de logs de diagnóstico.

## Pruebas faltantes

Las pruebas nativas cubren payload, URL, debounce de VBUS y varias transiciones de sampling, incluyendo wraparound de `millis()`. Faltan:

- MOVING -> STATIONARY con velocidad exactamente cero.
- Uso real de `maxFixAgeMs`, timestamps inválidos/repetidos y saltos imposibles.
- CSQ `99`/desconocido desde construcción del payload hasta JSON.
- Fallo y recuperación de `enableGps()`/`disableGps()`.
- Pérdida de registro y PDP, DNS/TLS timeout, reconexión y escalamiento de módem.
- Backoff con wraparound, jitter y límite de intentos.
- Cola: power-loss en cada paso, CRC, overflow, ACK parcial y reenvío idempotente.
- Parser HTTP: respuestas fragmentadas, malformadas, 401, 429, 500 y timeout.
- URL con puerto, esquema no HTTPS, IPv4/IPv6 si se soportan y hostname excesivo.
- Soak de heap de 6-24 horas y watchdog durante AT/socket bloqueado.
- Hardware-in-the-loop para PMU, VBUS, battery low, GNSS y recuperación RF.

## Documentación

- Completar en `AGENTS.md` los placeholders de placa, build, conectividad, protocolo, periféricos y perfil de energía. El documento aún parece plantilla y menciona reglas compartidas que no están enlazadas en esta sección.
- Actualizar el árbol/tabla del README: faltan sampling/telemetry y los conteos de pruebas están desactualizados.
- Eliminar referencias activas a WiFi, `setInsecure()`, `setCACert(NULL)` y `configTime()` que ya no describen la implementación celular.
- Documentar el significado exacto de patrones LED y aclarar que sólo un pulso tras `201` confirma envío.
- Documentar firmware del SIM7080G probado, comandos AT, RAT, APN, antenas, alimentación, batería y mediciones reales.
- Corregir la afirmación de precisión `double` y describir la precisión efectiva desde el `float` de TinyGSM.
- Verificar el environment `esp32s3box` contra flash, PSRAM, frecuencia y particiones reales de la H606; idealmente añadir una definición de placa específica.
- El README menciona `make run && make test`, pero no se observa un Makefile en la estructura suministrada. Mantener sólo comandos reproducibles o agregar el wrapper.

## Aspectos positivos

- Buena separación inicial entre lógica host-testable en `lib/` y hardware en `src/`.
- Uso generalizado de buffers fijos para URL/JSON y ausencia de asignación dinámica en la ruta principal, salvo el diagnóstico GNSS señalado.
- Aritmética de intervalos de sampling/debounce preparada para wraparound de `millis()` y pruebas asociadas.
- Watchdog activado y alimentado durante la espera larga de registro.
- Secuencia PMU/módem y precaución de no pulsar PWRKEY si el módem ya responde.
- Secretos reales ignorados por Git y key por dispositivo en lugar de una credencial global.
- Histéresis/debounce de VBUS y apagado de rieles en modo carga.
- Backend idempotente por timestamp, que ofrece una base para reintentos y cola.

## Plan de implementación recomendado

### Fase 0: reproducibilidad y diagnóstico

1. Corregir documentación celular/TLS y pinnear dependencias.
2. Añadir reset reason, estado red/PDP, errores, heap mínimo, batería mínima y last-success.
3. Ejecutar soak de 6-12 horas y una prueba con pérdida inducida de red.

### Fase 1: confiabilidad de campo

1. Crear `ConnectivityManager` no bloqueante con recovery ladder y backoff.
2. Habilitar GNSS aunque la red esté caída.
3. Implementar cola persistente y ACK idempotente.
4. Corregir estados GNSS, CSQ sentinel, comprobaciones AT y errores HTTP.

### Fase 2: energía y muestreo

1. Corregir transición con velocidad cero y validación de fixes.
2. Crear endpoint/lógica batch para desacoplar sampling de upload.
3. Añadir perfiles moving/stationary/no-network/low-battery.
4. Medir y después activar deep sleep, DTR, PSM/eDRX o power-cycle según el perfil ganador.

### Fase 3: seguridad de producción

1. Configurar y demostrar CA + hostname validation en SIM7080G/TinyGSM.
2. Probar rechazo de certificados inválidos y rotación de CA/API key.
3. Evaluar Secure Boot, Flash Encryption y OTA con rollback.

### Fase 4: validación de hardware

1. Repetir ruta real con logs persistentes y telemetría de salud.
2. Probar ciudad, carretera, túnel/sin cobertura, handovers, batería baja y reinicios.
3. Medir consumo por estado y autonomía completa con la batería objetivo.

## Criterios de aceptación sugeridos

- Tras perder cobertura/PDP, el dispositivo recupera transmisión sin intervención en un tiempo máximo definido.
- Ningún punto aceptado se pierde durante una desconexión dentro de la capacidad declarada de cola, incluso tras reset.
- Cero reintentos rápidos indefinidos; todos respetan backoff y presupuesto de batería.
- Heap mínimo y mayor bloque permanecen estables durante una prueba de 24 horas.
- TLS rechaza CA/hostname incorrectos.
- El estado estacionario reduce corriente a una cifra objetivo medida, no estimada.
- Un recorrido de tres horas puede reconstruirse y cada hueco queda explicado por accuracy, cola llena o política documentada.

## Información necesaria del incidente

Para confirmar la causa exacta del viaje hacen falta:

1. Fuente de alimentación usada: batería/USB del automóvil, capacidad, estado inicial/final y si VBUS se conectó durante la ruta.
2. Log serial desde minutos antes del corte hasta el reinicio, especialmente último `POST`, `CSQ`, `STATE` y `RADIO`.
3. Hora exacta del último punto y primer punto tras reinicio; cobertura, túneles o cambio de zona en ese tramo.
4. Patrón LED observado después del corte (frecuencia y color), no sólo que seguía parpadeando.
5. Firmware/commit grabado, versión AT del SIM7080G y configuración/operador mostrado por Hologram.
6. Tipo y ubicación de antenas LTE/GNSS y si estaban dentro del vehículo.

Sin esos datos no puede demostrarse retrospectivamente si el evento inicial fue handover, PDP, socket/TLS, alimentación o módem. Sí puede afirmarse que, cualquiera que haya sido el disparador, el firmware carecía de la recuperación y persistencia necesarias para tolerarlo.

