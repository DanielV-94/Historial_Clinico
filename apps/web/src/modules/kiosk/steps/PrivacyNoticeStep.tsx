import React, { useState, useRef, useCallback, useEffect } from 'react';

interface PrivacyNoticeStepProps {
  onNext: () => void;
  onPrevious: () => void;
}

const PRIVACY_NOTICE_TEXT = `AVISO DE PRIVACIDAD INTEGRAL

En cumplimiento con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y su Reglamento, le informamos lo siguiente:

I. IDENTIDAD Y DOMICILIO DEL RESPONSABLE

La clínica (en adelante "El Responsable") con domicilio en las instalaciones donde se le atiende, es responsable del tratamiento de sus datos personales.

II. DATOS PERSONALES QUE SE RECABAN

Para las finalidades señaladas en el presente aviso de privacidad, requerimos obtener los siguientes datos personales:
- Nombre completo
- Fecha de nacimiento
- Sexo
- Teléfono
- Correo electrónico
- Dirección
- Tipo de sangre
- Alergias
- Cirugías previas
- Contacto de emergencia (nombre, teléfono, parentesco)
- Firma digital

Además, se podrán recabar datos personales sensibles como:
- Historial clínico y antecedentes médicos
- Fotografías y videos de tratamientos
- Diagnósticos y prescripciones médicas

III. FINALIDADES DEL TRATAMIENTO DE DATOS

Sus datos personales serán utilizados para las siguientes finalidades primarias:
1. Brindar atención médica y seguimiento de tratamientos
2. Crear y mantener su expediente clínico electrónico conforme a la NOM-004-SSA3-2012
3. Generar prescripciones y recetas médicas
4. Contacto para recordatorios de citas
5. Registro fotográfico y de video para documentación de procedimientos y seguimiento de evolución

IV. TRANSFERENCIA DE DATOS

No se realizarán transferencias de sus datos personales a terceros sin su consentimiento, salvo las excepciones previstas en el artículo 37 de la LFPDPPP.

V. DERECHOS ARCO

Usted tiene derecho a Acceder a sus datos personales, Rectificar datos inexactos, Cancelar su tratamiento o bien, Oponerse al mismo (Derechos ARCO). Para ejercer cualquiera de estos derechos, puede presentar una solicitud dirigida al Responsable en el domicilio señalado.

El plazo de respuesta será de 20 días hábiles contados a partir de la recepción de su solicitud.

VI. MECANISMOS PARA LIMITAR USO O DIVULGACIÓN

Usted puede limitar el uso y divulgación de sus datos personales enviando una solicitud al Responsable.

VII. MODIFICACIONES AL AVISO DE PRIVACIDAD

El presente aviso de privacidad puede sufrir modificaciones, cambios o actualizaciones. Cualquier modificación se hará de su conocimiento mediante publicación en nuestras instalaciones.

VIII. CONSENTIMIENTO

Al firmar digitalmente este documento, usted manifiesta que:
- Ha leído y comprende el presente aviso de privacidad
- Otorga su consentimiento expreso para el tratamiento de sus datos personales, incluyendo datos sensibles
- Acepta los términos y condiciones descritos

Fecha de última actualización: ${new Date().getFullYear()}

---

Declaro que he leído, entiendo y acepto los términos del presente aviso de privacidad.`;

/**
 * PrivacyNoticeStep — Step 4 of the kiosk wizard.
 * Shows full scrollable LFPDPPP notice. Must scroll to bottom to proceed.
 * Validates: Requirement 7.2, 8.5
 */
export const PrivacyNoticeStep: React.FC<PrivacyNoticeStepProps> = ({
  onNext,
  onPrevious,
}) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    // User has scrolled to within 50px of the bottom
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (isAtBottom) {
      setHasScrolledToBottom(true);
    }
  }, []);

  // Check if content is short enough to not need scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight) {
      setHasScrolledToBottom(true);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Aviso de Privacidad
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Paso 4 de 5 — Lea el aviso completo para continuar
        </p>
      </div>

      {/* Scrollable privacy notice */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-[400px] overflow-y-auto px-6 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap"
        role="document"
        aria-label="Aviso de privacidad LFPDPPP"
        tabIndex={0}
      >
        {PRIVACY_NOTICE_TEXT}
      </div>

      {!hasScrolledToBottom && (
        <p className="text-center text-sm text-amber-600 dark:text-amber-400 animate-pulse">
          ↓ Desplace hacia abajo para leer el aviso completo ↓
        </p>
      )}

      {/* Navigation */}
      <div className="pt-4 flex gap-4">
        <button
          type="button"
          onClick={onPrevious}
          className="flex-1 py-4 min-h-[48px] text-lg font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors focus:outline-none focus:ring-4 focus:ring-gray-300"
          aria-label="Regresar al paso anterior"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasScrolledToBottom}
          className="flex-1 py-4 min-h-[48px] text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-xl shadow-lg transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300"
          aria-label="Acepto y continúo"
        >
          {hasScrolledToBottom ? 'Acepto y continúo →' : 'Lea el aviso completo'}
        </button>
      </div>
    </div>
  );
};
