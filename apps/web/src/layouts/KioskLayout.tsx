import { Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * KioskLayout: Full-screen layout optimized for iPad/tablet kiosk mode.
 * - Larger touch targets (min 48x48px)
 * - No browser chrome (designed for standalone PWA)
 * - Centered content with generous spacing
 */
export function KioskLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* Header bar */}
      <header className="flex items-center justify-center h-20 bg-white/70 dark:bg-gray-800/70 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Registro de Paciente
        </h1>
      </header>

      {/* Main content area - optimized for touch */}
      <main className="flex-1 flex items-center justify-center p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="w-full max-w-2xl"
          >
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-3xl shadow-glass border border-gray-200/50 dark:border-gray-700/50 p-10">
              <Outlet />
            </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer with clinic branding */}
      <footer className="flex items-center justify-center h-16 text-sm text-gray-500 dark:text-gray-400">
        <p>Toque la pantalla para comenzar</p>
      </footer>
    </div>
  );
}
