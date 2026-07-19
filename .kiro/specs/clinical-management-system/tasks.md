# Implementation Plan: Sistema de Gestión Clínica

## Overview

Plan de implementación incremental para el Sistema de Gestión Clínica, organizado desde la infraestructura fundacional hasta los módulos de funcionalidad completa. Cada tarea construye sobre las anteriores, priorizando: monorepo + base de datos → autenticación → módulos core → servicios auxiliares → frontend PWA.

## Tasks

- [x] 1. Configurar estructura del monorepo y dependencias base
  - [x] 1.1 Inicializar monorepo con Turborepo, workspaces y configuraciones base
    - Crear `package.json` raíz con workspaces: `apps/*`, `packages/*`
    - Crear `turbo.json` con pipelines: build, dev, test, lint
    - Inicializar `apps/api` como proyecto NestJS con TypeScript
    - Inicializar `apps/web` como proyecto React + Vite con TypeScript y Tailwind CSS
    - Crear `packages/shared-types`, `packages/validators`, `packages/constants`
    - Configurar `tsconfig.json` base con paths compartidos
    - Agregar `docker-compose.yml` con PostgreSQL 16 y Redis
    - _Requirements: 11.4 (estructura PWA), Diseño: Estructura del Monorepo_

  - [x] 1.2 Crear paquete `packages/shared-types` con interfaces TypeScript del sistema
    - Definir `UserRole`, `RolePermissions`, `ThemeConfig`, `FileMetadata`
    - Definir interfaces de Patient, ClinicalNote, Prescription, Appointment
    - Definir interfaces de AuditLog, BackupRecord, SignatureRecord
    - Exportar todos los tipos con barrel exports (`index.ts`)
    - _Requirements: 13.2 (roles), 12.2 (metadatos archivo), Diseño: Interfaces TypeScript Compartidas_

  - [x] 1.3 Crear paquete `packages/validators` con schemas Zod compartidos
    - Implementar schema de validación de paciente (campos obligatorios, formatos)
    - Implementar schema de validación de archivos (MIME, tamaño por categoría)
    - Implementar schema de validación de notas clínicas (1–10,000 chars)
    - Implementar schema de validación de contraseña (8+ chars, mayúscula, minúscula, número)
    - Implementar schema de validación de tema (colores hex, logo PNG/SVG ≤2MB)
    - _Requirements: 1.3, 1.4, 2.4, 3.5, 3.6, 4.2, 12.3, 13.1, 10.1_

  - [x] 1.4 Crear paquete `packages/constants` con límites y configuraciones
    - Definir límites: MAX_ALLERGIES=50, MAX_ALLERGY_LENGTH=200, MAX_SURGERIES=30
    - Definir límites de archivo: PDF_MAX_SIZE=20MB, IMAGE_MAX_SIZE=50MB, VIDEO_MAX_SIZE=200MB
    - Definir MIME types permitidos por categoría
    - Definir constantes de sesión: INACTIVITY_TIMEOUT=15min, MAX_LOGIN_ATTEMPTS=5, LOCKOUT_DURATION=15min
    - Definir constantes de paginación: DOCUMENTS_PAGE_SIZE=20, SEARCH_MAX_RESULTS=10
    - _Requirements: 1.1, 2.4, 3.5, 3.6, 12.3, 13.3, 13.4, 5.3_

  - [x] 1.5 Escribir property tests para validadores del paquete shared
    - **Property 1: Validación de campos obligatorios del paciente**
    - **Property 2: Límites de datos en creación de paciente**
    - **Property 4: Validación compuesta de archivos**
    - **Property 8: Validación de notas clínicas**
    - **Property 15: Validación de esquema de tema**
    - **Property 16: Validación de contraseña**
    - **Validates: Requirements 1.1, 1.3, 1.4, 2.4, 3.5, 3.6, 4.2, 10.1, 12.3, 13.1**

- [x] 2. Configurar base de datos PostgreSQL y Prisma ORM
  - [x] 2.1 Definir schema Prisma completo con todos los modelos de datos
    - Crear `prisma/schema.prisma` con todos los modelos: User, Patient, Allergy, PreviousSurgery, ClinicalNote, Prescription, Appointment, AppointmentMaterial, FileMetadata, AuditLog, ThemeConfig, Clinic, BackupRecord, SignatureRecord
    - Configurar relaciones, campos obligatorios, enums y valores por defecto
    - Agregar anotaciones `@@index` para índices de performance según diseño
    - _Requirements: 1.1, 8.1, 12.2, Diseño: Data Models_

  - [x] 2.2 Crear migración inicial y seeds de datos base
    - Ejecutar `prisma migrate dev` para generar migración inicial
    - Crear seed con usuario admin por defecto, clínica base y tema por defecto
    - Implementar índice trigram para búsqueda de pacientes (`gin_trgm_ops`)
    - _Requirements: 5.3, 10.4, Diseño: Estrategia de Índices_

  - [x] 2.3 Implementar inmutabilidad del audit log a nivel PostgreSQL
    - Crear migración con `REVOKE UPDATE, DELETE ON audit_logs FROM app_user`
    - Crear trigger `prevent_audit_modification()` que lance excepción en UPDATE/DELETE
    - Configurar política de retención de 5 años (comentario de diseño, sin purga automática)
    - _Requirements: 8.2, 8.4, Diseño: Tabla de Auditoría — Inmutabilidad_

  - [x] 2.4 Crear PrismaService como módulo global de NestJS
    - Implementar `PrismaService` extendiendo `PrismaClient` con `onModuleInit` y `onModuleDestroy`
    - Registrar como `@Global()` module para inyección en toda la app
    - Configurar logging de queries en modo desarrollo
    - _Requirements: Diseño: Flujo de Datos Principal_

- [x] 3. Checkpoint - Verificar infraestructura base
  - Asegurar que todos los tests pasan, verificar que Docker Compose levanta PG + Redis correctamente, y que Prisma genera el cliente sin errores. Preguntar al usuario si hay dudas.

- [x] 4. Implementar módulo de autenticación (AuthModule)
  - [x] 4.1 Implementar AuthService con login, refresh y logout
    - Crear `AuthService` con validación de credenciales (bcrypt, salt=12)
    - Implementar generación de JWT RS256 (access token 15min, refresh token 7d)
    - Almacenar refresh token en Redis con TTL de 7 días
    - Implementar rotación de refresh token en cada uso
    - Implementar lógica de bloqueo: incrementar `failed_login_attempts`, bloquear tras 5 intentos por 15 minutos
    - _Requirements: 13.1, 13.4, Diseño: Flujo de Autenticación_

  - [x] 4.2 Implementar Guards de autenticación y autorización
    - Crear `JwtAuthGuard` que valide access token en header Authorization
    - Crear `RolesGuard` con decorator `@Roles()` que verifique permisos según matriz RBAC
    - Implementar lógica de "fail-closed": si la verificación falla, denegar acceso con HTTP 403
    - _Requirements: 8.3, 13.2, 13.5, Diseño: RBAC — Matriz de Permisos_

  - [x] 4.3 Implementar AuthController con endpoints de autenticación
    - `POST /auth/login`: Recibe username + password, retorna access token + cookie httpOnly refresh
    - `POST /auth/refresh`: Renueva access token usando refresh token de cookie
    - `POST /auth/logout`: Invalida refresh token en Redis
    - Implementar manejo de sesión inactiva (15 min timeout) en middleware
    - _Requirements: 13.1, 13.3, 13.4, Diseño: API REST — Autenticación_

  - [x] 4.4 Escribir property tests para autenticación
    - **Property 16: Validación de contraseña** — verificar que solo contraseñas con 8+ chars, mayúscula, minúscula y número son aceptadas
    - **Property 17: Bloqueo de cuenta por intentos fallidos** — verificar bloqueo tras 5+ intentos consecutivos fallidos
    - **Property 12: Control de acceso basado en roles (RBAC)** — verificar matriz de permisos para todas las combinaciones rol/endpoint
    - **Validates: Requirements 13.1, 13.2, 13.4, 13.5, 8.3**

- [x] 5. Implementar módulo de auditoría (AuditModule)
  - [x] 5.1 Implementar AuditService y AuditInterceptor global
    - Crear `AuditService` con método `log()` que inserte registro append-only
    - Incluir campos: userId, userRole, action, entityTable, entityId, ipAddress, result, timestamp ISO 8601
    - Crear `AuditInterceptor` como interceptor global NestJS que registre pre/post ejecución
    - Manejar fallo de escritura de auditoría sin bloquear la operación principal
    - _Requirements: 8.1, 8.2, 8.4, Diseño: AuditModule_

  - [x] 5.2 Escribir property test para registro de auditoría
    - **Property 11: Registro de auditoría completo** — verificar que toda acción registrada contiene todos los campos requeridos
    - **Validates: Requirements 8.1**

- [x] 6. Implementar módulo de pacientes (PatientModule)
  - [x] 6.1 Implementar PatientService con CRUD y detección de duplicados
    - Crear `PatientService` con métodos: create, findById, update, search
    - Implementar validación de campos obligatorios usando validators del paquete compartido
    - Implementar detección de duplicados: nombre completo (case-insensitive, normalizado) + fecha de nacimiento idénticos
    - Implementar búsqueda por nombre con trigram (máximo 10 resultados, <500ms)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.3, Diseño: PatientModule_

  - [x] 6.2 Implementar PatientController con endpoints REST
    - `GET /patients` — listado paginado
    - `GET /patients/:id` — detalle completo agrupado por sección
    - `POST /patients` — crear con validación + alerta de duplicado
    - `PATCH /patients/:id` — actualizar con validación
    - `GET /patients/search?q=` — búsqueda rápida (debounced desde frontend)
    - `GET /patients/:id/check-duplicate` — verificar duplicado antes de crear
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 5.3, Diseño: API REST — Pacientes_

  - [x] 6.3 Escribir property tests para módulo de pacientes
    - **Property 1: Validación de campos obligatorios del paciente**
    - **Property 2: Límites de datos en creación de paciente**
    - **Property 3: Detección de paciente duplicado**
    - **Property 22: Búsqueda de pacientes con límite de resultados**
    - **Validates: Requirements 1.1, 1.3, 1.4, 1.5, 5.3**

- [x] 7. Implementar módulo de gestión de archivos (FileModule)
  - [x] 7.1 Implementar FileService con validación, almacenamiento y checksum
    - Crear `FileService` con métodos: upload, download, delete, validateFile
    - Implementar validación compuesta: tipo MIME + tamaño por categoría + checksum SHA-256
    - Implementar generación de nombre único: `{YYYY-MM-DD}_{tipo-documento}_{uuid-corto}.{ext}`
    - Implementar estructura de carpetas por paciente: `/patients/{id}/{category}/`
    - Implementar detección de nombre duplicado en misma categoría/paciente
    - _Requirements: 2.1, 2.4, 3.1, 3.5, 3.6, 12.1, 12.2, 12.3, 12.5, Diseño: FileModule_

  - [x] 7.2 Implementar DiskSpaceService para monitoreo de espacio
    - Crear servicio que verifique espacio disponible en disco antes de cada upload
    - Implementar alerta cuando espacio está por debajo del umbral configurado
    - Rechazar uploads cuando espacio es insuficiente con mensaje descriptivo
    - _Requirements: 12.4, 3.7, Diseño: DiskSpaceService_

  - [x] 7.3 Implementar WatermarkService para marca de agua
    - Crear servicio con `sharp` para aplicar watermark (logo + ID paciente) sobre imágenes
    - Implementar watermark sobre videos con `ffmpeg` (logo + ID paciente)
    - Verificar si la opción de marca de agua está habilitada en configuración de clínica
    - _Requirements: 3.4, Diseño: WatermarkService_

  - [x] 7.4 Implementar FileController con endpoints de upload/download/delete
    - `POST /patients/:id/documents` — subir PDF con validación (≤20MB, MIME pdf)
    - `GET /patients/:id/documents` — listar PDFs paginado (20 por página, orden cronológico desc)
    - `GET /patients/:id/documents/:docId/preview` — servir archivo para vista previa
    - `DELETE /patients/:id/documents/:docId` — eliminar previa confirmación
    - `POST /patients/:id/gallery` — subir foto/video con validación y watermark
    - `GET /patients/:id/gallery` — timeline multimedia ordenada por fecha de captura desc
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 3.1, 3.2, 3.5, 3.6, Diseño: API REST — Expediente/Galería_

  - [x] 7.5 Escribir property tests para módulo de archivos
    - **Property 4: Validación compuesta de archivos** — MIME + tamaño + checksum
    - **Property 5: Detección de nombre de archivo duplicado**
    - **Property 6: Ordenamiento cronológico de listados** (documentos y galería)
    - **Property 7: Paginación de documentos** — máximo 20, sin duplicados ni omisiones
    - **Property 19: Ruta de almacenamiento por paciente**
    - **Property 20: Metadatos de archivo completos sin contenido binario**
    - **Validates: Requirements 2.3, 2.4, 2.6, 3.2, 3.5, 3.6, 12.1, 12.2, 12.3, 12.5**

- [x] 8. Checkpoint - Verificar módulos core del backend
  - Asegurar que todos los tests pasan. Verificar que el flujo completo funciona: crear paciente → subir documento → subir foto con watermark → verificar en filesystem. Preguntar al usuario si hay dudas.

- [x] 9. Implementar notas clínicas y prescripciones
  - [x] 9.1 Implementar ClinicalNoteService y endpoints
    - Crear servicio con métodos: create, findByPatient (paginado, orden desc)
    - Validar contenido: mínimo 1 char, máximo 10,000 chars
    - Registrar autor (userId) y timestamp en cada nota
    - `POST /patients/:id/notes` y `GET /patients/:id/notes`
    - _Requirements: 4.1, 4.2, 4.4, Diseño: Notas Clínicas_

  - [x] 9.2 Implementar PrescriptionService con envío a bandeja del asistente
    - Crear servicio con métodos: create, getInbox, markAsRead, markAsCompleted
    - Implementar envío con notificación SSE al asistente en ≤3 segundos
    - Implementar manejo de fallo: notificar al doctor si no se puede entregar + opción retry
    - Implementar estados: pending → read → completed
    - `POST /prescriptions`, `GET /prescriptions/inbox`, `PATCH /prescriptions/:id/complete`
    - _Requirements: 4.3, 4.5, 6.3, 6.6, Diseño: Prescripciones_

  - [x] 9.3 Escribir property test para notas y ordenamiento
    - **Property 8: Validación de notas clínicas** — aceptar 1–10,000 chars, rechazar vacías o excedidas
    - **Property 6: Ordenamiento cronológico** — notas y prescripciones ordenadas por fecha desc
    - **Validates: Requirements 4.1, 4.2, 4.4, 6.3**

- [x] 10. Implementar módulo de dashboard (DashboardModule)
  - [x] 10.1 Implementar DoctorDashboardService y endpoints
    - Crear servicio: citas del día (orden hora asc), tarjeta próximo paciente, búsqueda global
    - Tarjeta próximo paciente: nombre, foto, último procedimiento, motivo cita, alergias
    - Manejar estado vacío (sin citas) y estado completado (todas atendidas)
    - `GET /dashboard/doctor/today`, `GET /dashboard/doctor/next-patient`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, Diseño: DashboardModule_

  - [x] 10.2 Implementar AssistantDashboardService y endpoints
    - Crear servicio: citas del día con materiales (orden hora asc), bandeja de prescripciones
    - Incluir lista de materiales/insumos por cita
    - `GET /dashboard/assistant/today`
    - _Requirements: 6.1, Diseño: API REST — Dashboard_

- [x] 11. Implementar módulo de generación PDF (PDFModule)
  - [x] 11.1 Implementar PDFService con inyección de datos en membrete
    - Crear servicio con `pdf-lib` que cargue template PDF de membrete
    - Implementar inyección de datos en coordenadas configuradas (patientName, date, content, doctorSignature, footer)
    - Implementar fallback a formato estándar cuando no hay plantilla configurada
    - Generar PDF final listo para impresión en ≤5 segundos
    - `GET /prescriptions/:id/pdf`
    - _Requirements: 6.4, 6.5, Diseño: PDFModule_

  - [x] 11.2 Implementar generación de URL WhatsApp para recordatorios
    - Crear utility que genere enlace `wa.me/{teléfono}?text={mensaje}` con datos pre-llenados
    - Formato de mensaje: nombre clínica, nombre paciente, fecha y hora de cita
    - _Requirements: 6.2, Diseño: WhatsAppButton_

  - [x] 11.3 Escribir property tests para PDF y WhatsApp
    - **Property 9: Generación de URL WhatsApp** — verificar formato correcto con todos los datos
    - **Property 10: Inyección de datos en PDF con membrete** — verificar que el PDF contiene nombre, fecha y contenido como texto extraíble
    - **Validates: Requirements 6.2, 6.4**

- [x] 12. Implementar módulo de IA (AIModule)
  - [x] 12.1 Implementar AIService para generación de resumen clínico
    - Crear servicio que recopile historial completo del paciente (notas, diagnósticos, tratamientos, alergias)
    - Implementar llamada a OpenAI API con prompt estructurado para resumen clínico
    - Estructurar respuesta en secciones: diagnósticos, tratamientos, alergias, recomendaciones (últimas 10 notas)
    - Implementar timeout 30s + retry con backoff exponencial (2s, 4s)
    - Implementar fallback local si LLM no disponible
    - Validar que paciente tenga al menos 1 nota de evolución antes de generar
    - `POST /ai/summary/:patientId`
    - _Requirements: 4.6, 14.1, 14.2, 14.3, 14.4, 14.5, Diseño: AIModule_

  - [x] 12.2 Escribir property test para resumen clínico IA
    - **Property 18: Estructura completa del resumen clínico IA** — verificar que el resumen contiene todas las secciones requeridas y todos los datos del historial
    - **Validates: Requirements 14.1, 14.3**

- [x] 13. Implementar módulo de kiosco (KioskModule)
  - [x] 13.1 Implementar KioskService con registro wizard y firma digital
    - Crear servicio con flujo wizard: datos personales → antecedentes → contacto emergencia → firma
    - Implementar validación en tiempo real campo por campo (mismo schema de paciente)
    - Implementar detección de duplicados (nombre + fecha nacimiento)
    - Implementar firma digital: almacenar imagen de firma asociada al paciente
    - Implementar timeout por inactividad (3 min) + limpieza + reinicio
    - Implementar creación automática de paciente tras firma + notificación a recepción
    - `POST /kiosk/register`, `GET /kiosk/privacy-notice`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, Diseño: KioskModule_

- [x] 14. Implementar módulo de respaldos (BackupModule)
  - [x] 14.1 Implementar BackupService con cron job mensual
    - Crear servicio con `@Cron('0 2 1 * *')` — ejecutar el 1 de cada mes a las 02:00
    - Implementar `pg_dump` para respaldo completo de BD
    - Implementar copia de carpeta de archivos multimedia
    - Comprimir con tar.gz y encriptar con AES-256-CBC (clave derivada con PBKDF2)
    - Registrar en audit log: fecha, tamaño, ubicación, checksum SHA-256
    - Implementar retry: si falla, reintentar una vez después de 30 minutos
    - Implementar notificación al admin en caso de fallo
    - Implementar retención: mantener últimos 12 respaldos, eliminar los más antiguos
    - `POST /backups/trigger`, `GET /backups`, `GET /backups/:id/status`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, Diseño: BackupModule_

  - [x] 14.2 Escribir property tests para respaldos
    - **Property 13: Round-trip de respaldo** — verificar que compress+encrypt seguido de decrypt+decompress produce datos idénticos
    - **Property 14: Retención máxima de respaldos** — verificar que nunca se retienen más de 12 y los eliminados son los más antiguos
    - **Validates: Requirements 9.2, 9.5**

- [x] 15. Implementar módulo de tema White-Label (ThemeModule)
  - [x] 15.1 Implementar ThemeService con lectura/validación de configuración
    - Crear servicio que lea JSON de tema desde archivo de configuración
    - Implementar validación de schema (colores hex, logo PNG/SVG ≤2MB, font_family)
    - Implementar fallback a valores por defecto si configuración inválida
    - Implementar hot-reload sin reinicio de servidor
    - `GET /theme/current`, `PUT /theme/config`
    - _Requirements: 10.1, 10.2, 10.4, Diseño: ThemeModule_

- [x] 16. Checkpoint - Verificar todos los módulos backend
  - Asegurar que todos los tests pasan. Verificar integración entre módulos: auth → patient → files → notes → prescriptions → PDF → audit. Preguntar al usuario si hay dudas.

- [x] 17. Implementar frontend - Estructura base y componentes compartidos
  - [x] 17.1 Configurar app React con Vite, Tailwind CSS, Framer Motion y routing
    - Configurar Vite con alias paths hacia packages compartidos
    - Instalar y configurar Tailwind CSS con tema base (glassmorphism, sombras, opacidad)
    - Configurar React Router con layouts: MainLayout, KioskLayout, AuthLayout
    - Configurar Zustand para estado global (auth, theme, offline status)
    - Configurar API client layer con interceptors (JWT, refresh, error handling)
    - _Requirements: 11.1, 11.2, 11.4, Diseño: Módulos Frontend_

  - [x] 17.2 Implementar componentes UI compartidos
    - `GlassCard` — contenedor con efecto glassmorphism configurable
    - `SkeletonLoader` — placeholder animado cuando carga >300ms
    - `PageTransition` — wrapper Framer Motion (200-400ms)
    - `FileUploader` — drag & drop con validación y progress bar
    - `SearchInput` — debounced 500ms con dropdown de resultados
    - `OfflineBanner` — indicador de modo sin conectividad
    - `ThemeProvider` — context con polling de tema white-label cada 30s
    - _Requirements: 11.1, 11.2, 11.5, 11.6, 10.2, 10.3, Diseño: Componentes UI Compartidos_

  - [x] 17.3 Implementar sistema de tema (modo claro/oscuro + white-label)
    - Implementar `ThemeProvider` que haga polling cada 30s a `/theme/current`
    - Implementar toggle modo claro/oscuro con persistencia en localStorage
    - Aplicar colores corporativos desde configuración white-label
    - Implementar responsive: móvil (320-767px), tablet (768-1023px), desktop (1024px+)
    - _Requirements: 10.2, 10.3, 11.1, 11.3, 11.4, Diseño: White-label via JSON hot-reload_

  - [x] 17.4 Escribir property test para persistencia de tema
    - **Property 21: Persistencia de preferencia de modo oscuro/claro** — verificar que la preferencia guardada se restaura al iniciar sesión
    - **Validates: Requirements 11.3**

- [x] 18. Implementar frontend - Módulo de autenticación
  - [x] 18.1 Implementar pantalla de login y manejo de sesión
    - Crear página de login con formulario (username + password)
    - Implementar almacenamiento de access token en memoria (no localStorage)
    - Implementar refresh automático de token antes de expiración
    - Implementar cierre de sesión por inactividad (15 min) con redirección a login
    - Mostrar mensajes de error: credenciales incorrectas, cuenta bloqueada con tiempo restante
    - _Requirements: 13.1, 13.3, 13.4, Diseño: Arquitectura de Seguridad_

- [x] 19. Implementar frontend - Dashboard del Doctor
  - [x] 19.1 Implementar vista de dashboard con citas del día y próximo paciente
    - Crear componente de lista de citas (hora, nombre, motivo) ordenadas ascendente
    - Crear componente tarjeta "Próximo Paciente" (foto, nombre, último procedimiento, alergias)
    - Implementar estado vacío (sin citas) y estado completado (todas atendidas)
    - Implementar SearchInput con búsqueda global de pacientes (debounced 500ms, max 10 resultados)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, Diseño: DoctorDashController_

- [x] 20. Implementar frontend - Dashboard del Asistente
  - [x] 20.1 Implementar vista de dashboard con citas, materiales y bandeja de prescripciones
    - Crear componente de citas del día con materiales/insumos por consulta
    - Crear componente `WhatsAppButton` con enlace wa.me pre-llenado
    - Crear bandeja de prescripciones con estados leída/no leída, orden desc
    - Implementar acción "marcar completada" con archivado
    - Implementar botón de impresión que genera PDF con membrete
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, Diseño: AssistantDashController_

- [x] 21. Implementar frontend - Módulo de Paciente completo
  - [x] 21.1 Implementar vista de perfil del paciente con secciones agrupadas
    - Crear vista con secciones: datos generales, antecedentes médicos, contacto emergencia, seguro médico
    - Implementar formulario de edición con validación inline (campos obligatorios, formatos)
    - Implementar alerta de duplicado antes de creación
    - Implementar confirmación visual al guardar + registro en audit
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, Diseño: PatientModule Frontend_

  - [x] 21.2 Implementar expediente digital (listado y preview de PDFs)
    - Crear vista de listado de PDFs con paginación (20 por página), orden cronológico desc
    - Implementar vista previa de PDF inline
    - Implementar upload con validación (≤20MB, tipo PDF)
    - Implementar eliminación con confirmación explícita
    - Implementar alerta de nombre duplicado con opción de reemplazo
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, Diseño: Expediente Digital_

  - [x] 21.3 Implementar galería multimedia con timeline y comparador
    - Crear vista de timeline cronológica (fecha captura desc)
    - Implementar upload de fotos/videos con validación de formato y tamaño
    - Implementar componente `BeforeAfterSlider` para comparación de imágenes
    - Mostrar metadatos: fecha captura, zona anatómica, observaciones
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, Diseño: Galería Multimedia_

  - [x] 21.4 Implementar notas clínicas y prescripciones en frontend
    - Crear vista de listado de notas (fecha, hora, autor, orden desc)
    - Implementar editor de notas con validación (1–10,000 chars)
    - Implementar creación de prescripción con envío automático al asistente
    - Mostrar feedback de éxito/fallo en envío de prescripción
    - Implementar botón "Generar Resumen Clínico" con visualización del resultado
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 14.1, Diseño: Notas y Prescripciones_

- [x] 22. Implementar frontend - Modo Kiosco iPad
  - [x] 22.1 Implementar wizard de registro con firma digital
    - Crear flujo wizard paso a paso: datos personales → antecedentes → contacto emergencia
    - Implementar validación en tiempo real (inline) por campo antes de avanzar
    - Implementar pantalla de aviso de privacidad (LFPDPPP) con scroll
    - Implementar componente `SignaturePad` (canvas táctil) para firma digital
    - Implementar timeout por inactividad (3 min) → limpieza → reinicio
    - Implementar detección de duplicado con mensaje "ya registrado"
    - Implementar meta tags Apple para modo standalone iPad
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 8.5, Diseño: KioskModule Frontend_

- [x] 23. Implementar PWA y soporte offline
  - [x] 23.1 Configurar Service Worker con Workbox y manifest PWA
    - Configurar Workbox con estrategias: CacheFirst (static), StaleWhileRevalidate (API lectura), NetworkOnly (API escritura), NetworkFirst (config)
    - Crear `manifest.webmanifest` con nombre, iconos, display standalone, theme_color
    - Implementar detección de conectividad y `OfflineBanner`
    - Implementar bloqueo de operaciones de escritura offline con mensaje informativo
    - Implementar `beforeinstallprompt` para prompt de instalación PWA
    - Implementar precache de app shell y datos previamente consultados
    - _Requirements: 11.4, 11.5, 11.6, Diseño: PWA y Estrategia Offline_

- [x] 24. Implementar frontend - Panel de administración
  - [x] 24.1 Implementar vista de configuración white-label y auditoría
    - Crear formulario de configuración de tema (logo, colores, fuente, nombre clínica)
    - Crear vista de logs de auditoría con paginación y filtros (fecha, usuario, acción)
    - Crear vista de estado de respaldos (listado, estado, trigger manual)
    - Crear indicador de espacio en disco disponible
    - _Requirements: 10.1, 8.1, 9.1, 12.4, Diseño: Settings Frontend_

- [x] 25. Integración final y wiring
  - [x] 25.1 Conectar todos los módulos frontend con backend API
    - Verificar que todos los endpoints están correctamente consumidos desde el frontend
    - Configurar interceptor de errores global (400 inline, 403 redirect, 409 modal, 507 banner)
    - Configurar SSE para notificaciones en tiempo real (prescripciones al asistente)
    - Verificar que audit log registra todas las acciones del sistema
    - Verificar RBAC end-to-end: cada rol solo ve/accede a sus módulos autorizados
    - _Requirements: 8.1, 8.3, 13.2, 13.5, Diseño: Estrategia de Comunicación_

  - [x] 25.2 Configurar Nginx reverse proxy y seguridad de transporte
    - Crear configuración Nginx con proxy pass a NestJS (puerto 3000)
    - Configurar HTTPS con TLS 1.3
    - Configurar headers de seguridad (HSTS, X-Frame-Options, CSP)
    - Servir archivos estáticos del frontend
    - _Requirements: 11.4, Diseño: Seguridad de Datos_

  - [x] 25.3 Escribir tests de integración end-to-end
    - Test flujo kiosco: wizard completo → firma → paciente creado
    - Test flujo doctor: login → dashboard → paciente → nota → prescripción → PDF
    - Test flujo asistente: login → bandeja → prescripción → imprimir → completar
    - Test inmutabilidad audit log: intentar UPDATE/DELETE y verificar rechazo
    - Test modo offline: cache de datos previamente consultados
    - **Validates: Requirements 7.1-7.6, 5.1-5.5, 6.1-6.6, 8.2, 11.5**

- [x] 26. Checkpoint final - Verificar sistema completo
  - Asegurar que todos los tests pasan (unit, property, integración). Verificar que la PWA cumple criterios de instalabilidad. Verificar responsive en los tres rangos de viewport. Verificar que el tema white-label se aplica correctamente en todos los módulos. Preguntar al usuario si hay dudas.

## Notes

- Las tareas marcadas con `*` son opcionales (property-based tests) y pueden omitirse para un MVP más rápido
- Cada tarea referencia los requerimientos específicos que implementa para trazabilidad
- Los checkpoints aseguran validación incremental del sistema
- Los property tests usan `fast-check` con mínimo 100 iteraciones por propiedad
- Los unit tests complementan los property tests verificando edge cases específicos
- El stack completo es TypeScript (NestJS + React + packages compartidos)
- La estructura del monorepo permite reutilizar tipos, validadores y constantes entre frontend y backend
- Docker Compose se usa para desarrollo local (PostgreSQL 16 + Redis)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 4, "tasks": ["4.1", "5.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "5.2"] },
    { "id": 6, "tasks": ["4.4", "6.1"] },
    { "id": 7, "tasks": ["6.2", "6.3", "7.1"] },
    { "id": 8, "tasks": ["7.2", "7.3", "7.4"] },
    { "id": 9, "tasks": ["7.5", "9.1"] },
    { "id": 10, "tasks": ["9.2", "9.3", "10.1"] },
    { "id": 11, "tasks": ["10.2", "11.1", "11.2"] },
    { "id": 12, "tasks": ["11.3", "12.1", "13.1"] },
    { "id": 13, "tasks": ["12.2", "14.1"] },
    { "id": 14, "tasks": ["14.2", "15.1"] },
    { "id": 15, "tasks": ["17.1"] },
    { "id": 16, "tasks": ["17.2", "17.3"] },
    { "id": 17, "tasks": ["17.4", "18.1"] },
    { "id": 18, "tasks": ["19.1", "20.1"] },
    { "id": 19, "tasks": ["21.1", "21.2", "22.1"] },
    { "id": 20, "tasks": ["21.3", "21.4", "23.1"] },
    { "id": 21, "tasks": ["24.1", "25.1"] },
    { "id": 22, "tasks": ["25.2", "25.3"] }
  ]
}
```
