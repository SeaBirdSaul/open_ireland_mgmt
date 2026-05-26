/**
 * Allows users to view, create, apply, and delete booking templates.
 * Templates store exact device/day selections as offsets from the first day.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import useSchedulerStore from '../../store/schedulerStore';
import { useDevices } from '../../services/deviceService';
import { useBookingsForRange } from '../../services/bookingService';
import { findConflicts } from '../../services/bookingServiceV2';
import useBookingState from '../../store/useBookingState';
import { useToastContext } from '../../contexts/ToastContext';
import { addDaysLocal, formatLocalDateKey, parseLocalDate } from './utils/localDate';

const TEMPLATE_SEARCH_WINDOW_DAYS = 180;

function TemplateConflictModal({ templateName, blockedDates, onClose }) {
  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-conflict-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-900"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="template-conflict-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Template unavailable
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {templateName
                ? `"${templateName}" cannot be selected because a required device is already booked on the required date.`
                : 'This template cannot be selected because a required device is already booked on the required date.'}
            </p>
            {blockedDates.length > 0 && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Conflicts found on: {blockedDates.join(', ')}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
            aria-label="Close template conflict dialog"
          >
            ✕
          </button>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(modal, document.body);
}

const sortDates = (dates) => [...dates].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const diffInDays = (startDate, endDate) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((endDate.getTime() - startDate.getTime()) / msPerDay);
};

const buildTemplateSelectionsFromSlots = (selectedSlots) => {
  const entries = Object.entries(selectedSlots || {});
  if (entries.length === 0) {
    return null;
  }

  const allDates = sortDates(
    entries.flatMap(([, dates]) => (Array.isArray(dates) ? dates : []))
  );

  if (allDates.length === 0) {
    return null;
  }

  const baseDate = parseLocalDate(allDates[0]);
  if (!baseDate) {
    return null;
  }

  const selections = [];
  const deviceIds = new Set();
  let maxOffset = 0;

  entries.forEach(([deviceIdStr, dates]) => {
    const deviceId = Number(deviceIdStr);
    if (!Number.isFinite(deviceId) || !Array.isArray(dates)) {
      return;
    }

    const uniqueDates = sortDates(Array.from(new Set(dates)));
    uniqueDates.forEach((dateStr) => {
      const date = parseLocalDate(dateStr);
      if (!date) {
        return;
      }

      const offsetDays = diffInDays(baseDate, date);
      if (offsetDays < 0) {
        return;
      }

      deviceIds.add(deviceId);
      maxOffset = Math.max(maxOffset, offsetDays);
      selections.push({ deviceId, offsetDays });
    });
  });

  if (selections.length === 0) {
    return null;
  }

  return {
    deviceIds: Array.from(deviceIds),
    selections,
    duration: maxOffset + 1,
  };
};

const buildLegacySelections = (template, devices) => {
  const matchingDeviceIds = devices
    .filter((device) => {
      if (Array.isArray(template.deviceIds) && template.deviceIds.length > 0) {
        return template.deviceIds.includes(device.id);
      }
      if (Array.isArray(template.deviceTypes) && template.deviceTypes.length > 0) {
        return template.deviceTypes.includes(device.deviceType);
      }
      return false;
    })
    .map((device) => device.id);

  const duration = Number.isFinite(template.duration) && template.duration > 0 ? template.duration : 1;
  const selections = matchingDeviceIds.flatMap((deviceId) =>
    Array.from({ length: duration }, (_, offsetDays) => ({ deviceId, offsetDays }))
  );

  return {
    deviceIds: matchingDeviceIds,
    selections,
    duration,
  };
};

const hydrateTemplateSelections = (template, devices) => {
  if (Array.isArray(template.selections) && template.selections.length > 0) {
    const validSelections = template.selections.filter(
      (selection) =>
        Number.isFinite(selection?.deviceId) &&
        Number.isFinite(selection?.offsetDays) &&
        selection.offsetDays >= 0
    );

    if (validSelections.length > 0) {
      const uniqueDeviceIds = Array.from(new Set(validSelections.map((selection) => selection.deviceId)));
      const duration = validSelections.reduce(
        (max, selection) => Math.max(max, selection.offsetDays),
        0
      ) + 1;

      return {
        deviceIds: uniqueDeviceIds,
        selections: validSelections,
        duration,
      };
    }
  }

  return buildLegacySelections(template, devices);
};

export default function BookingTemplates({ userId, userName, onApply }) {
  const {
    bookingTemplates,
    addBookingTemplate,
    deleteBookingTemplate,
    initializeDefaultTemplates,
    setDateRange,
  } = useSchedulerStore();
  const { data: devices = [] } = useDevices();
  const selectedSlots = useBookingState((state) => state.selectedSlots);
  const setSelectedRange = useBookingState((state) => state.setSelectedRange);
  const setDeviceDates = useBookingState((state) => state.setDeviceDates);
  const clearAllSelections = useBookingState((state) => state.clearAllSelections);
  const toast = useToastContext();
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '' });
  const [conflictModal, setConflictModal] = useState({ open: false, templateName: '', blockedDates: [] });

  useEffect(() => {
    initializeDefaultTemplates();
  }, [initializeDefaultTemplates]);

  const searchStart = useMemo(() => {
    const tomorrow = addDaysLocal(new Date(), 1);
    tomorrow.setHours(0, 0, 0, 0);
    return formatLocalDateKey(tomorrow);
  }, []);

  const searchEnd = useMemo(() => {
    const endDate = addDaysLocal(parseLocalDate(searchStart), TEMPLATE_SEARCH_WINDOW_DAYS);
    return formatLocalDateKey(endDate);
  }, [searchStart]);

  const { data: bookings = [], isLoading: isLoadingBookings } = useBookingsForRange(searchStart, searchEnd);

  const handleApplyTemplate = (template) => {
    if (isLoadingBookings) {
      toast.info('Checking availability for this template. Please try again in a moment.');
      return;
    }

    const hydrated = hydrateTemplateSelections(template, devices);
    if (!hydrated || hydrated.selections.length === 0) {
      toast.warning('This template does not contain any saved bookings.');
      return;
    }

    const today = parseLocalDate(searchStart);
    const searchLimit = TEMPLATE_SEARCH_WINDOW_DAYS;
    let foundSelection = null;
    let firstConflictDates = [];

    for (let offset = 0; offset <= searchLimit; offset += 1) {
      const candidateStart = addDaysLocal(today, offset);
      const candidateSelections = hydrated.selections.map((selection) => ({
        deviceId: selection.deviceId,
        date: formatLocalDateKey(addDaysLocal(candidateStart, selection.offsetDays)),
        hour: null,
      }));

      const conflicts = findConflicts(candidateSelections, bookings, {
        currentUserId: userId ?? null,
        currentUsername: userName ?? null,
      });

      if (conflicts.length === 0) {
        foundSelection = candidateSelections;
        break;
      }

      if (firstConflictDates.length === 0) {
        firstConflictDates = Array.from(
          new Set(
            conflicts
              .map((key) => key.split('-').slice(1).join('-'))
              .filter(Boolean)
          )
        ).sort();
      }
    }

    if (!foundSelection) {
      setConflictModal({
        open: true,
        templateName: template.name || '',
        blockedDates: firstConflictDates.slice(0, 3),
      });
      return;
    }

    const groupedByDevice = foundSelection.reduce((acc, selection) => {
      if (!acc[selection.deviceId]) {
        acc[selection.deviceId] = [];
      }
      acc[selection.deviceId].push(selection.date);
      return acc;
    }, {});

    const allDates = sortDates(foundSelection.map((selection) => selection.date));
    const rangeStart = allDates[0] ?? null;
    const rangeEnd = allDates[allDates.length - 1] ?? null;

    clearAllSelections();

    Object.entries(groupedByDevice).forEach(([deviceIdStr, dates]) => {
      setDeviceDates(Number(deviceIdStr), sortDates(Array.from(new Set(dates))));
    });

    setDateRange({ start: rangeStart, end: rangeEnd });
    setSelectedRange({ start: rangeStart, end: rangeEnd });

    toast.success('Template selections added to the booking cart.');

    if (onApply) {
      onApply();
    }
  };

  const handleCreateTemplate = () => {
    if (!newTemplate.name.trim()) {
      toast.warning('Enter a template name.');
      return;
    }

    const templateSelection = buildTemplateSelectionsFromSlots(selectedSlots);
    if (!templateSelection) {
      toast.warning('Select bookings in the cart before saving a template.');
      return;
    }

    addBookingTemplate({
      name: newTemplate.name.trim(),
      description: newTemplate.description.trim(),
      deviceIds: templateSelection.deviceIds,
      duration: templateSelection.duration,
      selections: templateSelection.selections,
    });

    setNewTemplate({ name: '', description: '' });
    setIsCreating(false);
    toast.success('Template saved from the current booking cart.');
  };

  return (
    <>
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Templates</h3>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            {isCreating ? 'Cancel' : '+ New'}
          </button>
        </div>

        {isCreating && (
          <div className="mb-3 space-y-2 rounded-lg border border-gray-200 p-3 glass-card dark:border-gray-700">
            <input
              type="text"
              placeholder="Template name"
              value={newTemplate.name}
              onChange={(event) => setNewTemplate({ ...newTemplate, name: event.target.value })}
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <input
              type="text"
              placeholder="Description"
              value={newTemplate.description}
              onChange={(event) => setNewTemplate({ ...newTemplate, description: event.target.value })}
              className="w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Saves the current booking cart as a reusable pattern.
              </p>
              <button
                onClick={handleCreateTemplate}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
              >
                Create
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {bookingTemplates.map((template) => {
            const hydrated = hydrateTemplateSelections(template, devices);
            const bookingCount = hydrated?.selections?.length ?? 0;

            return (
              <div
                key={template.id}
                className="cursor-pointer rounded-lg border border-gray-200 p-2 glass-card transition-colors hover:border-blue-300 dark:border-gray-700 dark:hover:border-blue-700"
                onClick={() => handleApplyTemplate(template)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-gray-900 dark:text-white">
                      {template.name}
                    </div>
                    {template.description && (
                      <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        {template.description}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {bookingCount} booking{bookingCount !== 1 ? 's' : ''} over {hydrated?.duration ?? template.duration ?? 0} day{(hydrated?.duration ?? template.duration ?? 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteBookingTemplate(template.id);
                    }}
                    className="ml-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    aria-label={`Delete ${template.name}`}
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {conflictModal.open && (
        <TemplateConflictModal
          templateName={conflictModal.templateName}
          blockedDates={conflictModal.blockedDates}
          onClose={() => setConflictModal({ open: false, templateName: '', blockedDates: [] })}
        />
      )}
    </>
  );
}
