# Requirements Document

## Introduction

Sistema de Gestión Clínica de nivel VIP (Expediente Médico Electrónico + Gestión de Práctica Médica/Estética). Aplicación web desplegada On-Premise en cada clínica, con acceso remoto seguro para doctores. Optimizada como PWA para iPad (modo kiosco/registro), smartphones (iOS/Android) y desktop (Windows/Mac/Linux). Diseño premium, fluido, minimalista y funcional con estética de lujo clínico.

## Glossary

- **Sistema**: La aplicación web de gestión clínica en su conjunto
- **Módulo_Paciente**: Componente del Sistema que gestiona el perfil, expediente digital, galería multimedia y notas clínicas del paciente
- **Módulo_Dashboard_Doctor**: Componente del Sistema que presenta al doctor la vista de citas del día, tarjeta del próximo paciente y búsqueda global
- **Módulo_Asistente**: Componente del Sistema que gestiona la agenda, logística de materiales, mensajería y bandeja de prescripciones para el asistente
- **Módulo_Kiosco**: Componente del Sistema ejecutado en modo iPad para el registro de nuevos pacientes con firma digital
- **Motor_IA**: Servicio interno del Sistema que genera resúmenes clínicos a partir del historial del paciente
- **Generador_PDF**: Servicio del Sistema que inyecta datos del paciente y tratamiento en plantillas de membrete para producir documentos listos para impresión
- **Registro_Auditoría**: Subsistema inmutable que registra quién (rol) ejecutó qué acción y cuándo
- **Gestor_Archivos**: Servicio del Sistema que almacena archivos (PDFs, fotos, videos) en el sistema de archivos local del servidor, organizados por ID de paciente
- **Gestor_Respaldos**: Servicio automatizado que realiza respaldos mensuales de la base de datos y carpeta de medios, comprimiendo y encriptando los archivos
- **Módulo_WhiteLabel**: Componente de configuración global de tema que permite cambiar logo y colores corporativos por clínica
- **Doctor**: Usuario con rol de médico que tiene acceso completo al expediente clínico
- **Asistente**: Usuario con rol de asistente que gestiona logística, mensajería y recibe prescripciones
- **Paciente**: Persona registrada en el sistema cuyo expediente clínico es gestionado
- **Membrete**: Plantilla PDF o imagen con diseño corporativo de la clínica donde se inyectan datos del paciente y tratamiento
- **Marca_Agua**: Superposición configurable (logo de clínica + ID de paciente) aplicada automáticamente sobre fotos y videos subidos

## Requirements

### Requirement 1: Gestión del Perfil del Paciente

**User Story:** Como doctor, quiero gestionar los datos clínicos completos de cada paciente, para tener acceso inmediato a su información médica relevante.

#### Acceptance Criteria

1. WHEN un Doctor o Asistente crea un nuevo paciente, THE Módulo_Paciente SHALL almacenar los siguientes campos: nombre completo, fecha de nacimiento, sexo, teléfono, correo electrónico, dirección, tipo de sangre, alergias (lista de hasta 50 entradas de máximo 200 caracteres cada una), cirugías previas (lista de hasta 30 entradas con nombre y fecha), contacto de emergencia (nombre, teléfono, parentesco), datos de seguro de gastos médicos mayores (aseguradora, número de póliza) y foto de perfil (formatos JPEG o PNG, tamaño máximo 5 MB); IF cualquier límite de datos es excedido, THEN THE Módulo_Paciente SHALL rechazar la creación y mostrar un mensaje indicando el límite superado
2. WHEN un Doctor consulta un perfil de paciente, THE Módulo_Paciente SHALL presentar todos los datos clínicos agrupados por sección (datos generales, antecedentes médicos, contacto de emergencia, seguro médico) con tiempo de carga no mayor a 2 segundos desde la selección del paciente
3. WHEN un Doctor o Asistente modifica datos del paciente, THE Módulo_Paciente SHALL validar que los campos obligatorios (nombre completo, fecha de nacimiento, sexo y teléfono) estén completos y en formato correcto antes de guardar los cambios
4. IF un campo obligatorio está vacío o contiene datos inválidos (formato de correo incorrecto, teléfono con menos de 10 dígitos, fecha de nacimiento futura), THEN THE Módulo_Paciente SHALL mostrar un mensaje de error junto al campo afectado indicando la corrección requerida sin descartar los datos ya ingresados por el usuario
5. IF un Doctor o Asistente intenta crear un paciente con nombre completo y fecha de nacimiento idénticos a un registro existente, THEN THE Módulo_Paciente SHALL alertar sobre el posible duplicado y solicitar confirmación antes de proceder con la creación
6. WHEN el Módulo_Paciente almacena exitosamente un nuevo paciente o una modificación, THE Módulo_Paciente SHALL mostrar una confirmación visual al usuario y registrar la acción en el Registro_Auditoría

### Requirement 2: Expediente Digital (Gestión de Documentos)

**User Story:** Como doctor, quiero subir y consultar estudios en PDF del paciente, para tener acceso rápido a su historial de estudios médicos.

#### Acceptance Criteria

1. WHEN un Doctor sube un archivo PDF al expediente de un paciente, THE Gestor_Archivos SHALL almacenar el archivo en el sistema de archivos local estructurado por ID de paciente y registrar los metadatos (nombre del archivo, fecha de subida, tipo de estudio) en la base de datos
2. WHEN un Doctor selecciona un PDF del expediente que ha sido almacenado exitosamente, THE Módulo_Paciente SHALL mostrar una vista previa del documento dentro de la aplicación con un objetivo de carga de 3 segundos, continuando la carga si se excede el tiempo sin mostrar error
3. THE Módulo_Paciente SHALL listar todos los PDFs del paciente ordenados cronológicamente de más reciente a más antiguo, mostrando nombre, fecha y tipo de estudio, con paginación cada 20 documentos
4. IF el archivo subido excede 20 MB o no es un archivo PDF válido (tipo MIME application/pdf), THEN THE Gestor_Archivos SHALL rechazar la subida y mostrar un mensaje de error indicando la causa específica del rechazo (tamaño excedido o formato inválido)
5. WHEN un Doctor elimina un PDF del expediente de un paciente, THE Gestor_Archivos SHALL remover el archivo del sistema de archivos local y eliminar sus metadatos de la base de datos, previa confirmación explícita del Doctor
6. IF el Doctor intenta subir un PDF y el nombre del archivo ya existe en el expediente del mismo paciente, THEN THE Gestor_Archivos SHALL solicitar confirmación al Doctor antes de reemplazar el archivo existente

### Requirement 3: Galería Multimedia y Comparación

**User Story:** Como doctor, quiero subir fotos y videos al perfil del paciente y compararlos cronológicamente, para evaluar la evolución del tratamiento.

#### Acceptance Criteria

1. WHEN un Doctor sube una foto o video al perfil de un paciente, THE Gestor_Archivos SHALL almacenar el archivo sin compresión ni reducción de resolución en el sistema de archivos local y registrar en la base de datos los metadatos: nombre original, fecha de captura, fecha de subida, tipo de archivo, zona anatómica o tratamiento asociado y observaciones opcionales
2. THE Módulo_Paciente SHALL presentar la galería multimedia en una vista de línea de tiempo cronológica ordenada por fecha de captura descendente
3. WHEN un Doctor selecciona dos fotos para comparación, THE Módulo_Paciente SHALL presentar un slider interactivo "Antes y Después" que permita deslizar entre ambas imágenes superpuestas en la misma escala y dimensiones
4. WHILE la opción de Marca_Agua está habilitada en la configuración de la clínica, WHEN un Doctor sube una foto o video, THE Gestor_Archivos SHALL aplicar automáticamente la Marca_Agua (logo de clínica + ID de paciente) sobre el archivo antes de almacenarlo
5. IF el formato del archivo no corresponde a los formatos aceptados (imágenes: JPEG, PNG, HEIC; video: MP4, MOV), THEN THE Gestor_Archivos SHALL rechazar la subida y mostrar un mensaje indicando los formatos permitidos
6. IF el archivo excede 200 MB para video o 50 MB para imagen (donde imagen se define exclusivamente como archivos JPEG, PNG o HEIC), THEN THE Gestor_Archivos SHALL rechazar la subida y mostrar un mensaje indicando el tamaño máximo permitido según el tipo de archivo
7. IF ocurre un error durante el almacenamiento del archivo (fallo de disco o espacio insuficiente), THEN THE Gestor_Archivos SHALL cancelar la operación, descartar cualquier archivo parcial y mostrar un mensaje de error indicando que la subida no pudo completarse

### Requirement 4: Notas Clínicas y Prescripciones

**User Story:** Como doctor, quiero agregar notas de evolución y generar prescripciones que se envíen automáticamente al asistente, para agilizar el flujo de trabajo clínico.

#### Acceptance Criteria

1. WHEN un Doctor agrega una nota de evolución al expediente de un paciente, THE Módulo_Paciente SHALL almacenar la nota con fecha, hora, autor y contenido de texto con una longitud máxima de 10,000 caracteres
2. IF un Doctor intenta guardar una nota de evolución con contenido vacío o que exceda los 10,000 caracteres, THEN THE Módulo_Paciente SHALL rechazar el guardado y mostrar un mensaje de error indicando la restricción incumplida
3. WHEN un Doctor genera una prescripción o indicación, THE Módulo_Paciente SHALL enviar la prescripción a la bandeja de entrada del Módulo_Asistente en un tiempo no mayor a 3 segundos, incluyendo nombre del paciente, contenido de la prescripción, fecha y nombre del Doctor que la emitió
4. THE Módulo_Paciente SHALL listar todas las notas de evolución en orden cronológico descendente, mostrando fecha, hora y autor de cada nota
5. IF el envío de una prescripción al Módulo_Asistente falla, THEN THE Módulo_Paciente SHALL notificar inmediatamente al Doctor que la prescripción no pudo ser entregada y presentar la opción de reintentar el envío
6. WHEN un Doctor solicita generar un resumen clínico, THE Motor_IA SHALL analizar el historial completo del paciente y producir un resumen estructurado según lo definido en el Requerimiento 14

### Requirement 5: Dashboard del Doctor

**User Story:** Como doctor, quiero ver mis citas del día y un resumen del próximo paciente, para prepararme de forma eficiente para cada consulta.

#### Acceptance Criteria

1. WHEN un Doctor accede al dashboard, THE Módulo_Dashboard_Doctor SHALL mostrar la lista de citas del día ordenadas por hora ascendente, mostrando hora programada, nombre completo del paciente y motivo de consulta
2. THE Módulo_Dashboard_Doctor SHALL presentar una tarjeta "Próximo Paciente" con: nombre completo, foto de perfil, último procedimiento realizado (nombre y fecha), motivo de la cita actual, y alergias registradas
3. WHEN un Doctor escribe en el campo de búsqueda global, THE Módulo_Dashboard_Doctor SHALL buscar pacientes por nombre y mostrar hasta 10 resultados en menos de 500 milisegundos desde la última tecla presionada
4. IF no existen citas programadas para el día, THEN THE Módulo_Dashboard_Doctor SHALL mostrar un estado vacío con un mensaje indicando que no hay consultas programadas y ocultar la tarjeta de "Próximo Paciente"
5. WHEN todas las citas del día han sido completadas, THEN THE Módulo_Dashboard_Doctor SHALL ocultar la tarjeta "Próximo Paciente" y mostrar un indicador de que todas las consultas fueron atendidas

### Requirement 6: Dashboard y Logística del Asistente

**User Story:** Como asistente, quiero ver las citas del día con los materiales necesarios para cada una, para preparar la consulta con anticipación.

#### Acceptance Criteria

1. WHEN un Asistente accede a su dashboard, THE Módulo_Asistente SHALL mostrar las citas del día ordenadas por hora ascendente con el nombre del paciente, motivo de consulta y la lista de materiales e insumos necesarios para cada consulta
2. WHEN un Asistente presiona el botón de recordatorio para un paciente, THE Módulo_Asistente SHALL abrir WhatsApp Web o Desktop con el número del paciente y un mensaje pre-llenado usando enlaces wa.me con formato: nombre de la clínica, nombre del paciente, fecha y hora de la cita
3. THE Módulo_Asistente SHALL mostrar una bandeja de entrada con las prescripciones e indicaciones enviadas por el Doctor, ordenadas por fecha descendente, con estado de lectura (leída/no leída)
4. WHEN un Asistente selecciona una prescripción para imprimir, THE Generador_PDF SHALL inyectar los datos del paciente (nombre, fecha) y contenido del tratamiento en las coordenadas configuradas del Membrete de la clínica y generar un PDF final listo para impresión en menos de 5 segundos
5. IF la plantilla de Membrete no está configurada para la clínica, THEN THE Generador_PDF SHALL generar el PDF con los datos de la prescripción en formato estándar y mostrar un aviso indicando que no se encontró plantilla de membrete
6. WHEN un Asistente marca una prescripción como completada, THE Módulo_Asistente SHALL registrar la fecha y hora de procesamiento y archivar la prescripción fuera de la bandeja activa

### Requirement 7: Modo Kiosco iPad (Registro de Pacientes)

**User Story:** Como paciente nuevo, quiero registrarme de forma interactiva en un iPad en la clínica, para completar mi alta de manera rápida y elegante.

#### Acceptance Criteria

1. WHEN el Sistema se ejecuta en modo kiosco, THE Módulo_Kiosco SHALL presentar un formulario interactivo tipo wizard (paso a paso) para el registro de nuevos pacientes, comenzando con datos personales, seguido de antecedentes médicos y finalizando con contacto de emergencia
2. WHEN el paciente completa todos los pasos del formulario de registro, THE Módulo_Kiosco SHALL presentar el aviso de privacidad (LFPDPPP) con texto completo desplazable y un área de firma digital táctil en pantalla
3. WHEN el paciente firma digitalmente el acuerdo de privacidad, THE Módulo_Kiosco SHALL crear automáticamente el perfil del paciente en la base de datos, almacenar la imagen de la firma asociada al paciente, y enviar una notificación a recepción en menos de 5 segundos
4. THE Módulo_Kiosco SHALL validar cada campo del formulario en tiempo real conforme el paciente lo completa, mostrando mensajes de error inline antes de permitir avanzar al siguiente paso
5. IF el paciente abandona el formulario antes de completar la firma (inactividad superior a 3 minutos o presión del botón cancelar), THEN THE Módulo_Kiosco SHALL descartar los datos parciales, verificar que la limpieza se completó exitosamente, y reiniciar el flujo de registro a la pantalla de bienvenida; IF la limpieza falla, THEN THE Módulo_Kiosco SHALL forzar un reinicio completo del módulo antes de permitir un nuevo registro
6. IF el Módulo_Kiosco detecta que ya existe un paciente con el mismo nombre y fecha de nacimiento, THEN THE Módulo_Kiosco SHALL mostrar un mensaje indicando que el paciente ya está registrado y sugerir contactar a recepción

### Requirement 8: Seguridad y Registro de Auditoría

**User Story:** Como administrador, quiero que todas las acciones queden registradas de forma inmutable, para cumplir con las normativas mexicanas de expediente clínico.

#### Acceptance Criteria

1. THE Registro_Auditoría SHALL registrar cada acción realizada en el Sistema incluyendo: ID de usuario, rol del usuario, tipo de acción (crear, leer, actualizar, eliminar), entidad afectada (tabla y registro), marca de tiempo en formato ISO 8601, dirección IP de origen y resultado de la acción (éxito o fallo)
2. THE Registro_Auditoría SHALL ser inmutable: la tabla de auditoría no aceptará operaciones UPDATE ni DELETE, implementadas mediante restricciones a nivel de base de datos y permisos de rol de la base de datos
3. WHEN un usuario intenta acceder a un recurso sin los permisos correspondientes a su rol, THE Sistema SHALL denegar el acceso, retornar un código de error HTTP 403, y registrar el intento en el Registro_Auditoría con la URL solicitada y el rol del usuario; IF el sistema de autorización falla durante la verificación, THEN THE Sistema SHALL denegar el acceso igualmente y retornar HTTP 403
4. THE Sistema SHALL almacenar los registros de auditoría con un período de retención mínimo de 5 años conforme a la NOM-004-SSA3-2012 para expediente clínico
5. THE Sistema SHALL implementar las medidas técnicas requeridas por la LFPDPPP: aviso de privacidad accesible, consentimiento documentado, y mecanismos para ejercer derechos ARCO (Acceso, Rectificación, Cancelación y Oposición)

### Requirement 9: Respaldos Automatizados

**User Story:** Como administrador, quiero respaldos automáticos mensuales encriptados, para proteger la información clínica ante pérdida de datos.

#### Acceptance Criteria

1. THE Gestor_Respaldos SHALL ejecutar automáticamente un respaldo el primer día de cada mes a las 02:00 horas (hora local del servidor), generando un dump completo de la base de datos PostgreSQL y una copia de la carpeta de archivos multimedia
2. THE Gestor_Respaldos SHALL comprimir cada respaldo usando formato tar.gz y encriptarlo con AES-256 antes de almacenarlo en la ubicación de respaldos configurada
3. WHEN un respaldo se completa exitosamente, THE Gestor_Respaldos SHALL registrar en el Registro_Auditoría la fecha de ejecución, tamaño del archivo resultante, ubicación de almacenamiento y hash de verificación de integridad; IF el registro de auditoría falla pero el respaldo fue exitoso, THEN el respaldo se considerará completado y se generará una alerta separada sobre la falla de auditoría
4. IF un respaldo falla durante su ejecución (error de conexión a BD, espacio insuficiente en destino, error de encriptación), THEN THE Gestor_Respaldos SHALL registrar el error con detalle en el Registro_Auditoría, notificar al administrador vía correo electrónico o notificación del sistema, y reintentar la operación una vez después de 30 minutos
5. THE Gestor_Respaldos SHALL retener al menos los últimos 12 respaldos mensuales, eliminando automáticamente los respaldos más antiguos cuando se exceda la cantidad configurada

### Requirement 10: Configuración White-Label

**User Story:** Como administrador de clínica, quiero personalizar el logo y colores corporativos, para que el sistema refleje la identidad de mi clínica.

#### Acceptance Criteria

1. THE Módulo_WhiteLabel SHALL permitir al administrador configurar desde un archivo JSON de tema global los siguientes elementos: logo principal (formatos PNG o SVG, tamaño máximo 2 MB), color primario, color secundario, color de acento, fuente tipográfica principal, y nombre de la clínica
2. WHEN un administrador actualiza el archivo de configuración de tema, THE Sistema SHALL aplicar los cambios de logo y colores en todas las vistas de la aplicación sin necesidad de reinicio del servidor, ni recarga manual por parte de los usuarios activos, ni interrupción de servicio (hot-swap con zero downtime)
3. THE Sistema SHALL utilizar la configuración de tema del Módulo_WhiteLabel para renderizar la interfaz de usuario consistentemente en todos los dispositivos (iPad, smartphone, desktop) y en todos los módulos, garantizando que todos los usuarios vean el mismo tema activo independientemente de cuándo iniciaron su sesión
4. IF el archivo de configuración de tema contiene valores inválidos (color en formato incorrecto, archivo de logo no encontrado), THEN THE Sistema SHALL utilizar los valores por defecto del tema base y registrar un warning en los logs del sistema

### Requirement 11: Diseño y Experiencia de Usuario Premium

**User Story:** Como usuario del sistema, quiero una interfaz elegante, fluida y responsiva, para tener una experiencia de uso premium comparable a una aplicación de alta gama.

#### Acceptance Criteria

1. THE Sistema SHALL renderizar la interfaz con una paleta base de tonos blancos, grises claros y sombras con opacidad de fondo (glassmorfismo), aplicando la configuración de tema del Módulo_WhiteLabel cuando esté definida
2. THE Sistema SHALL aplicar transiciones de página con una duración entre 200 y 400 milisegundos, mostrar skeletons de carga cuando el contenido tarde más de 300 milisegundos en renderizar, y aplicar micro-interacciones de retroalimentación visual en botones al ser presionados
3. THE Sistema SHALL presentar modo claro por defecto y ofrecer la opción de modo oscuro, persistiendo la preferencia del usuario entre sesiones
4. THE Sistema SHALL ser responsivo con soporte para viewports desde 320px de ancho mínimo, adaptando el layout a tres rangos: móvil (320px–767px), tablet (768px–1023px) y escritorio (1024px en adelante), cumplir los criterios de instalabilidad PWA (manifest válido, service worker registrado, servido sobre HTTPS), y mostrar automáticamente un prompt de instalación al usuario cuando los criterios de instalabilidad sean cumplidos
5. WHEN la aplicación se instala como PWA y el dispositivo pierde conectividad, THE Sistema SHALL permitir la consulta en modo lectura de los datos del paciente, citas y notas clínicas previamente visualizados durante la sesión activa
6. IF el usuario intenta realizar una operación de escritura mientras el Sistema se encuentra sin conectividad, THEN THE Sistema SHALL mostrar un indicador informando que la operación requiere conexión y no se ejecutará hasta que se restablezca la conectividad

### Requirement 12: Gestión de Archivos y Almacenamiento Local

**User Story:** Como administrador, quiero que los archivos se almacenen localmente en el servidor organizados por paciente, para mantener el control total sobre los datos clínicos.

#### Acceptance Criteria

1. THE Gestor_Archivos SHALL almacenar todos los archivos (PDFs, fotos, videos) en el sistema de archivos local del servidor, estructurados en carpetas por ID de paciente
2. THE Sistema SHALL almacenar en la base de datos los metadatos de cada archivo incluyendo: nombre original, nombre único asignado, ruta de almacenamiento, tipo MIME, tamaño en bytes, fecha de subida, usuario que subió el archivo e ID de paciente asociado, sin almacenar contenido binario en la base de datos
3. WHEN un archivo es subido al sistema, THE Gestor_Archivos SHALL validar que el tipo MIME corresponda a los formatos aceptados (PDF, JPEG, PNG, HEIC, MP4, MOV), verificar la integridad del archivo mediante validación de checksum, rechazar archivos que excedan 500 MB de tamaño, y asignarle un nombre único basado en ID de paciente, fecha y tipo de documento
4. IF el espacio en disco del servidor es inferior al umbral configurado, THEN THE Gestor_Archivos SHALL mostrar una alerta visible en el dashboard del administrador indicando el porcentaje de espacio disponible y rechazar nuevas subidas hasta que se libere espacio
5. IF un archivo subido no supera la validación de tipo MIME, integridad o tamaño máximo (donde el resultado de validación se computa a partir de las verificaciones individuales de MIME, integridad y tamaño), THEN THE Gestor_Archivos SHALL rechazar la subida, descartar el archivo temporal y mostrar un mensaje de error indicando el motivo específico del rechazo

### Requirement 13: Autenticación y Control de Acceso

**User Story:** Como administrador, quiero controlar el acceso por roles, para que cada usuario vea únicamente la información que le corresponde.

#### Acceptance Criteria

1. THE Sistema SHALL autenticar a cada usuario mediante nombre de usuario y contraseña antes de permitir el acceso a cualquier módulo, exigiendo una contraseña con un mínimo de 8 caracteres que incluya al menos una letra mayúscula, una minúscula y un número
2. THE Sistema SHALL implementar control de acceso basado en roles con los siguientes permisos por módulo: Doctor accede a Módulo_Paciente, Módulo_Dashboard_Doctor y Motor_IA; Asistente accede a Módulo_Asistente y Módulo_Paciente en modo lectura; Administrador accede a todos los módulos incluyendo Módulo_WhiteLabel y Registro_Auditoría; Kiosco accede únicamente al Módulo_Kiosco
3. WHEN una sesión de usuario permanece inactiva por más del tiempo configurado (15 minutos por defecto, tolerancia de hasta 1 minuto adicional permitida), THE Sistema SHALL cerrar la sesión automáticamente, redirigir al usuario a la pantalla de inicio de sesión y mostrar un mensaje indicando que la sesión expiró por inactividad
4. IF un usuario ingresa credenciales incorrectas más de 5 veces consecutivas, THEN THE Sistema SHALL bloquear la cuenta temporalmente durante 15 minutos, mostrar un mensaje indicando el tiempo restante de bloqueo y registrar el evento en el Registro_Auditoría
5. IF un usuario con sesión activa intenta acceder a un módulo no autorizado para su rol, THEN THE Sistema SHALL denegar el acceso, mostrar un mensaje indicando permisos insuficientes y registrar el intento en el Registro_Auditoría

### Requirement 14: Generación de Resumen Clínico por IA

**User Story:** Como doctor, quiero generar un resumen clínico automatizado basado en el historial del paciente, para obtener una síntesis rápida antes de la consulta.

#### Acceptance Criteria

1. WHEN un Doctor presiona el botón "Generar Resumen Clínico", THE Motor_IA SHALL analizar las notas de evolución, diagnósticos, tratamientos y estudios del paciente y presentar inmediatamente el resumen estructurado en secciones claramente separadas (diagnósticos, tratamientos realizados, alergias, recomendaciones previas) con estado COMPLETADO
2. THE Motor_IA SHALL generar el resumen en menos de 10 segundos para pacientes con hasta 100 notas de evolución, y en menos de 30 segundos para pacientes con más de 100 y hasta 500 notas de evolución, medido únicamente durante operaciones activas de generación que se completan exitosamente
3. THE Motor_IA SHALL incluir en el resumen: todos los diagnósticos registrados en el expediente, todos los tratamientos realizados, todas las alergias registradas y las recomendaciones documentadas en las últimas 10 notas de evolución
4. IF el historial del paciente contiene menos de 1 nota de evolución, THEN THE Motor_IA SHALL mostrar un mensaje al Doctor indicando que se requiere al menos 1 nota de evolución para generar el resumen
5. IF el Motor_IA no puede completar la generación del resumen debido a un error de procesamiento o indisponibilidad del servicio (únicamente cuando el Doctor ha solicitado activamente la generación), THEN THE Sistema SHALL mostrar un mensaje de error al Doctor indicando la falla y permitir reintentar la operación
