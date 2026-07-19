import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PageTransition, GlassCard } from '@/shared/components';
import { ThemeConfigForm } from './ThemeConfigForm';
import { AuditLogViewer } from './AuditLogViewer';
import { BackupStatus } from './BackupStatus';
import { DiskSpaceIndicator } from './DiskSpaceIndicator';

type SettingsTab = 'theme' | 'audit' | 'backups';

interface TabConfig {
  id: SettingsTab;
  label: string;
  icon: string;
}

const TABS: TabConfig[] = [
  { id: 'theme', label: 'Tema', icon: '🎨' },
  { id: 'audit', label: 'Auditoría', icon: '📋' },
  { id: 'backups', label: 'Respaldos', icon: '💾' },
];

/**
 * SettingsPage — Panel de administración con pestañas: Tema | Auditoría | Respaldos.
 * Solo accesible para administradores.
 * Validates: Requirements 10.1, 8.1, 9.1, 12.4
 */
export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('theme');

  return (
    <PageTransition transitionKey="settings">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Configuración del Sistema
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Administra la apariencia, auditoría y respaldos del sistema.
          </p>
        </div>

        {/* Disk Space Indicator - Always visible */}
        <DiskSpaceIndicator className="mb-6" />

        {/* Tab Navigation */}
        <GlassCard className="p-1 mb-6">
          <nav className="flex gap-1" role="tablist" aria-label="Secciones de configuración">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`panel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 rounded-xl shadow-sm"
                    transition={{ type: 'spring', duration: 0.4, bounce: 0.15 }}
                  />
                )}
                <span className="relative z-10" aria-hidden="true">
                  {tab.icon}
                </span>
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </nav>
        </GlassCard>

        {/* Tab Content */}
        <div
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === 'theme' && <ThemeConfigForm />}
            {activeTab === 'audit' && <AuditLogViewer />}
            {activeTab === 'backups' && <BackupStatus />}
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
};
