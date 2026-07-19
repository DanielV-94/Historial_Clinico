import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { GlassCard, FileUploader } from '@/shared/components';
import { api } from '@/services/api';

export interface ThemeConfig {
  clinicName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  logoUrl: string | null;
}

interface ThemeConfigFormProps {
  className?: string;
}

const DEFAULT_THEME: ThemeConfig = {
  clinicName: '',
  primaryColor: '#2563eb',
  secondaryColor: '#7c3aed',
  accentColor: '#10b981',
  fontFamily: 'Inter',
  logoUrl: null,
};

const FONT_OPTIONS = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'Poppins',
  'Montserrat',
  'Nunito',
];

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_LOGO_TYPES = ['image/png', 'image/svg+xml'];

/**
 * ThemeConfigForm — Formulario de configuración de tema white-label.
 * Permite personalizar logo, colores, fuente y nombre de clínica.
 * Validates: Requirement 10.1
 */
export const ThemeConfigForm: React.FC<ThemeConfigFormProps> = ({ className = '' }) => {
  const [config, setConfig] = useState<ThemeConfig>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentTheme();
  }, []);

  const loadCurrentTheme = async () => {
    try {
      const data = await api.get<ThemeConfig>('/theme/current');
      setConfig(data);
      if (data.logoUrl) {
        setLogoPreview(data.logoUrl);
      }
    } catch {
      // Use defaults if no theme configured
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await api.put('/theme/config', config);
      setMessage({ type: 'success', text: 'Configuración de tema guardada correctamente.' });
    } catch {
      setMessage({ type: 'error', text: 'Error al guardar la configuración.' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('logo', file);

    const result = await api.upload('/theme/logo', formData) as { url: string };
    setConfig((prev) => ({ ...prev, logoUrl: result.url }));
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleColorChange = (field: keyof ThemeConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={className}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Nombre de Clínica */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Identidad de la Clínica
          </h3>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="clinicName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                Nombre de la Clínica
              </label>
              <input
                id="clinicName"
                type="text"
                value={config.clinicName}
                onChange={(e) => setConfig((prev) => ({ ...prev, clinicName: e.target.value }))}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
                placeholder="Nombre de la clínica"
                required
              />
            </div>

            {/* Logo Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Logo (PNG o SVG, máx. 2MB)
              </label>
              {logoPreview && (
                <div className="mb-3 flex items-center gap-4">
                  <img
                    src={logoPreview}
                    alt="Logo actual"
                    className="h-16 w-auto object-contain rounded-lg border border-gray-200 dark:border-gray-700 p-1"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLogoPreview(null);
                      setConfig((prev) => ({ ...prev, logoUrl: null }));
                    }}
                    className="text-sm text-red-500 hover:text-red-700 transition-colors"
                  >
                    Eliminar logo
                  </button>
                </div>
              )}
              <FileUploader
                accept={ACCEPTED_LOGO_TYPES}
                maxSize={MAX_LOGO_SIZE}
                onUpload={handleLogoUpload}
                onError={(err) => setMessage({ type: 'error', text: err })}
                label="Arrastra el logo aquí o haz clic para seleccionar"
              />
            </div>
          </div>
        </GlassCard>

        {/* Colores */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Colores Corporativos
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ColorInput
              label="Color Primario"
              id="primaryColor"
              value={config.primaryColor}
              onChange={(val) => handleColorChange('primaryColor', val)}
            />
            <ColorInput
              label="Color Secundario"
              id="secondaryColor"
              value={config.secondaryColor}
              onChange={(val) => handleColorChange('secondaryColor', val)}
            />
            <ColorInput
              label="Color de Acento"
              id="accentColor"
              value={config.accentColor}
              onChange={(val) => handleColorChange('accentColor', val)}
            />
          </div>

          {/* Preview */}
          <div className="mt-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Vista previa:</p>
            <div className="flex gap-3">
              <div
                className="w-12 h-12 rounded-lg shadow-sm"
                style={{ backgroundColor: config.primaryColor }}
                title="Primario"
              />
              <div
                className="w-12 h-12 rounded-lg shadow-sm"
                style={{ backgroundColor: config.secondaryColor }}
                title="Secundario"
              />
              <div
                className="w-12 h-12 rounded-lg shadow-sm"
                style={{ backgroundColor: config.accentColor }}
                title="Acento"
              />
            </div>
          </div>
        </GlassCard>

        {/* Fuente */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Tipografía
          </h3>

          <div>
            <label
              htmlFor="fontFamily"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Familia de Fuente
            </label>
            <select
              id="fontFamily"
              value={config.fontFamily}
              onChange={(e) => setConfig((prev) => ({ ...prev, fontFamily: e.target.value }))}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
            <p
              className="mt-2 text-sm text-gray-500"
              style={{ fontFamily: config.fontFamily }}
            >
              Texto de ejemplo con la fuente seleccionada: {config.fontFamily}
            </p>
          </div>
        </GlassCard>

        {/* Message */}
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`px-4 py-3 rounded-lg text-sm ${
              message.type === 'success'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
            }`}
            role="alert"
          >
            {message.text}
          </motion.div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </form>
    </motion.div>
  );
};

/* ─── Internal Color Input Component ─── */

interface ColorInputProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
}

const ColorInput: React.FC<ColorInputProps> = ({ label, id, value, onChange }) => {
  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(value);

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          id={`${id}-picker`}
          value={isValidHex ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer"
          aria-label={`Selector de color para ${label}`}
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-gray-100 font-mono text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          placeholder="#000000"
          pattern="^#[0-9a-fA-F]{6}$"
          maxLength={7}
        />
      </div>
      {!isValidHex && value.length > 0 && (
        <p className="text-xs text-red-500 mt-1">Formato inválido (ej: #2563eb)</p>
      )}
    </div>
  );
};
