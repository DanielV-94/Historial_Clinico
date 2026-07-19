import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PageTransition, SearchInput } from '@/shared/components';
import { api } from '@/services/api';
import { AppointmentList, Appointment } from './AppointmentList';
import { NextPatientCard, NextPatient } from './NextPatientCard';

interface PatientSearchResult {
  id: string;
  name: string;
  birthDate: string;
  phone?: string;
}

interface TodayAppointmentsResponse {
  appointments: Appointment[];
}

interface NextPatientResponse {
  patient: NextPatient | null;
}

interface PatientSearchResponse {
  results: PatientSearchResult[];
}

/**
 * DoctorDashboard — Main dashboard view for the doctor role.
 * Shows today's appointments, next patient card, and global patient search.
 * Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
 */
export const DoctorDashboard: React.FC = () => {
  const navigate = useNavigate();

  // State for appointments
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);

  // State for next patient
  const [nextPatient, setNextPatient] = useState<NextPatient | null>(null);
  const [loadingNextPatient, setLoadingNextPatient] = useState(true);

  // State for search
  const [searchResults, setSearchResults] = useState<PatientSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Computed: all appointments completed
  const allCompleted =
    appointments.length > 0 &&
    appointments.every((apt) => apt.status === 'completed');

  // Fetch today's appointments
  useEffect(() => {
    const fetchAppointments = async () => {
      try {
        setLoadingAppointments(true);
        const data = await api.get<TodayAppointmentsResponse>(
          '/dashboard/doctor/today'
        );
        setAppointments(data.appointments);
      } catch {
        // Handle error gracefully - show empty state
        setAppointments([]);
      } finally {
        setLoadingAppointments(false);
      }
    };

    fetchAppointments();
  }, []);

  // Fetch next patient
  useEffect(() => {
    const fetchNextPatient = async () => {
      try {
        setLoadingNextPatient(true);
        const data = await api.get<NextPatientResponse>(
          '/dashboard/doctor/next-patient'
        );
        setNextPatient(data.patient);
      } catch {
        setNextPatient(null);
      } finally {
        setLoadingNextPatient(false);
      }
    };

    fetchNextPatient();
  }, []);

  // Search patients handler (debounced via SearchInput)
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchLoading(true);
      const data = await api.get<PatientSearchResponse>(
        `/patients/search?q=${encodeURIComponent(query)}`
      );
      // Limit to max 10 results as per requirement 5.3
      setSearchResults(data.results.slice(0, 10));
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Navigate to patient profile on selection
  const handlePatientSelect = useCallback(
    (patient: PatientSearchResult) => {
      navigate(`/patients/${patient.id}`);
    },
    [navigate]
  );

  // Render each search result item
  const renderSearchResult = useCallback(
    (patient: PatientSearchResult) => (
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-xs font-bold">
          {patient.name
            .split(' ')
            .slice(0, 2)
            .map((n) => n[0])
            .join('')
            .toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {patient.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {patient.birthDate}
            {patient.phone && ` • ${patient.phone}`}
          </p>
        </div>
      </div>
    ),
    []
  );

  return (
    <PageTransition transitionKey="doctor-dashboard">
      <div className="space-y-6">
        {/* Header with greeting and search */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Dashboard
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('es-MX', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>

          {/* Global patient search */}
          <SearchInput<PatientSearchResult>
            placeholder="Buscar paciente..."
            onSearch={handleSearch}
            results={searchResults}
            onSelect={handlePatientSelect}
            renderItem={renderSearchResult}
            loading={searchLoading}
            debounceMs={500}
            className="w-full sm:w-80"
          />
        </motion.div>

        {/* Dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Appointments list - takes 2 columns on large screens */}
          <div className="lg:col-span-2">
            <AppointmentList
              appointments={appointments}
              loading={loadingAppointments}
            />
          </div>

          {/* Next patient card - 1 column on large screens */}
          <div className="lg:col-span-1">
            <NextPatientCard
              patient={nextPatient}
              loading={loadingNextPatient}
              allCompleted={allCompleted}
            />
          </div>
        </div>
      </div>
    </PageTransition>
  );
};
