/**
 * DevicesPage component for managing and viewing devices in the admin interface.
 * Supports filtering, bulk actions, and detailed device information.
 * Utilizes React Query for data fetching and state management.
 * Integrates with AdminContext for permissions and toast notifications.
 * Implements bulk selection of devices for efficient management.
 * Displays device status, ownership, tags, and last updated information.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../admin/components/PageHeader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createPortal } from 'react-dom';
import useBulkSelection from '../hooks/useBulkSelection';
import {
  fetchDevices,
  updateDeviceOwner,
  updateDeviceStatus,
  updateDeviceTags,
} from '../api';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import { formatDateTime } from '../utils/formatters';
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import { canEditDevices } from '../utils/permissions';

const STATUS_OPTIONS = ['Available', 'Maintenance', 'Unavailable'];
const MAINTENANCE_PERIODS = ['7 AM - 12 PM', '12 AM - 6PM', '6PM - 11PM'];

function addDays(dateString, days) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function computeMaintenanceEnd(startDate, startPeriod, expectedHours) {
  if (!startDate || !startPeriod) return null;
  if (startPeriod === 'All Day') return `All Day/${startDate}`;

  const hours = Number(expectedHours || 0);
  const slotLengthHours = 5;
  const slotsToAdvance = Math.max(0, Math.ceil(hours / slotLengthHours) - 1);

  const startIndex = MAINTENANCE_PERIODS.indexOf(startPeriod);
  if (startIndex === -1) return null;

  const absoluteIndex = startIndex + slotsToAdvance;
  const dayOffset = Math.floor(absoluteIndex / MAINTENANCE_PERIODS.length);
  const periodIndex = absoluteIndex % MAINTENANCE_PERIODS.length;

  const endDate = addDays(startDate, dayOffset);
  const endPeriod = MAINTENANCE_PERIODS[periodIndex];

  return `${endPeriod}/${endDate}`;
}

function buildMaintenanceWindow({ mode, date, startDate, endDate, period }) {
  if (!period) return {start: null, end: null };

  if (mode === 'single') {
    if (!date) return { start: null, end: null };
    return {
      start: `${period}/${date}`,
      end: `${period}/${date}`,
    };
  }

  if (!startDate || !endDate) {
    return { start: null, end: null };
  }

  return {
    start: `${period}/${startDate}`,
    end: `${period}/${endDate}`,
  };
}

export default function DevicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToastContext();
  const queryClient = useQueryClient();
  const { permissions } = useAdminContext();

  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkMaintenanceMode, setBulkMaintenanceMode] = useState('single');
  const [bulkMaintenanceDate, setBulkMaintenanceDate] = useState('');
  const [bulkMaintenanceStartDate, setBulkMaintenanceStartDate] = useState('');
  const [bulkMaintenanceEndDate, setBulkMaintenanceEndDate] = useState('');
  const [bulkMaintenancePeriod, setBulkMaintenancePeriod] = useState('');

  const params = useMemo(() => {
    const status = searchParams.get('status') || undefined;
    const owner = searchParams.get('owner') || undefined;
    const tag = searchParams.get('tag') || undefined;
    return { status, owner, tag };
  }, [searchParams]);

  const devicesQuery = useQuery({
    queryKey: ['admin-devices', params],
    queryFn: () => fetchDevices(params),
    keepPreviousData: true,
  });

  const selection = useBulkSelection(devicesQuery.data?.items || [], (row) => row.id);

  const statusMutation = useMutation({
    mutationFn: ({ status, maintenance_start, maintenance_end }) =>
      updateDeviceStatus({
        device_ids: Array.from(selection.state.ids),
        status,
        maintenance_start,
        maintenance_end,
      }),
    onSuccess: async (result) => {
      const affectedCount = result?.maintenance?.affected_count ?? 0;

      toast.success(
        affectedCount > 0
          ? `Device status updated. ${affectedCount} booking(s) were affected by maintenance.`
          : 'Device status updated successfully.'
      );

      await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });

      selection.clear();
      setIsBulkStatusOpen(false);
      setBulkStatus('');
      setBulkMaintenanceMode('single');
      setBulkMaintenanceDate('');
      setBulkMaintenanceStartDate('');
      setBulkMaintenanceEndDate('');
      setBulkMaintenancePeriod('');
    },
    onError: (err) => {
      toast.error(err?.message || 'Unable to update device status.');
    },
  });

  const ownerMutation = useMutation({
    mutationFn: ({ ownerId }) =>
      updateDeviceOwner({ device_ids: Array.from(selection.state.ids), owner_id: ownerId }),
    onSuccess: async () => {
      toast.success('Device ownership updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
      selection.clear();
    },
    onError: (err) => toast.error(err?.message || 'Unable to assign owner.'),
  });

  const tagsMutation = useMutation({
    mutationFn: ({ tags, mode }) =>
      updateDeviceTags({ device_ids: Array.from(selection.state.ids), tags, mode }),
    onSuccess: async () => {
      toast.success('Device tags updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
      selection.clear();
    },
    onError: (err) => toast.error(err?.message || 'Unable to update tags.'),
  });

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <button
            type="button"
            onClick={() => navigate(`/admin/devices/${row.id}`)}
            className="text-left"
          >
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100">{row.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{row.type}</div>
            </div>
          </button>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            {row.status}
          </span>
        ),
      },
      {
        key: 'owner',
        header: 'Owner',
        render: (row) => (row.owner?.username ? row.owner.username : '—'),
      },
      {
        key: 'tags',
        header: 'Tags',
        render: (row) =>
          row.tags && row.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {row.tags.map((tag) => (
                <span key={tag} className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-xs text-gray-400 dark:text-gray-500">No tags</span>
          ),
      },
      {
        key: 'polatis_name',
        header: 'Polatis Name',
        render: (row) => (row.polatis_name ? row.polatis_name : '—'),
      },
      // {
      //   key: 'status_action',
      //   header: 'Update Status',
      //   render: (row) => (
      //     <select
      //       value={row.status || 'Available'}
      //       onChange={(e) => updateDeviceStatus({ device_ids: [row.id], status: e.target.value })}
      //     >
      //       <option value="Available">Available</option>
      //       <option value="Maintenance">Maintenance</option>
      //       <option value="Unavailable">Unavailable</option>
      //     </select>
      //   ),
      // }
    ],
    []
  );

  const filterChips = useMemo(() => {
    const chips = [];
    const status = searchParams.get('status');
    if (status) {
      chips.push({
        key: `status-${status}`,
        label: `Status: ${status}`,
        active: true,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          next.delete('status');
          setSearchParams(next, { replace: true });
        },
      });
    }
    const owner = searchParams.get('owner');
    if (owner) {
      chips.push({
        key: `owner-${owner}`,
        label: `Owner: ${owner}`,
        active: true,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          next.delete('owner');
          setSearchParams(next, { replace: true });
        },
      });
    }
    const tag = searchParams.get('tag');
    if (tag) {
      chips.push({
        key: `tag-${tag}`,
        label: `Tag: ${tag}`,
        active: true,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          next.delete('tag');
          setSearchParams(next, { replace: true });
        },
      });
    }
    STATUS_OPTIONS.forEach((option) => {
      chips.push({
        key: `option-${option}`,
        label: option,
        active: option === status,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          if (status === option) {
            next.delete('status');
          } else {
            next.set('status', option);
          }
          setSearchParams(next, { replace: true });
        },
      });
    });
    return chips;
  }, [searchParams, setSearchParams]);

  const bulkActions = () => {
    const disabled = selection.state.count === 0;

    return (
      <button
      type="button"
      onClick={() => setIsBulkStatusOpen(true)}
      disabled={disabled || statusMutation.isPending}
      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
    >
      Bulk Update Status
    </button>
    );  
  };

  return(
    <div className='space-y-6'>
      <PageHeader
        title="Devices"
        subtitle="Manage scheduler devices and maintenance state."
        actions={
          canEditDevices(permissions) ? (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className='px-4 py-2 rounded-md bg-blue-600 text-white'
            >
              Add Device
            </button>
          ) : null
        }
      />

      <DataTable
        rows={devicesQuery.data?.items || []}
        columns={columns}
        selection={selection}
        bulkActions={bulkActions}
        loading={devicesQuery.status === 'pending'}
        onRowClick={(row) => navigate(`/admin/devices/${row.id}`)}
      />

      {isBulkStatusOpen && createPortal(
        <div className="fixed inset-0 z-[200]">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setIsBulkStatusOpen(false);
              setBulkStatus('');
              setBulkMaintenanceMode('single');
              setBulkMaintenanceDate('');
              setBulkMaintenanceStartDate('');
              setBulkMaintenanceEndDate('');
              setBulkMaintenancePeriod('');
            }}
            role="presentation"
          />
          <div className="relative flex min-h-screen items-center justify-center p-4">
            <div className="relative z-10 w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Bulk Update Status
              </h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Update status for {selection.state.count} selected device(s).
              </p>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  New status
                </label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                >
                  <option value="">Select status</option>
                  <option value="Available">Available</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Unavailable">Unavailable</option>
                </select>
              </div>

              {bulkStatus === 'Maintenance' && (
                <div className="mt-4 space-y-4">
                  <div className="rounded-md border border-gray-200 dark:border-gray-800 px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          Maintenance span
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          Choose single-day maintenance or switch to multi-day maintenance.
                        </div>
                      </div>

                      <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={bulkMaintenanceMode === 'multi'}
                          onChange={(e) =>
                            setBulkMaintenanceMode(e.target.checked ? 'multi' : 'single')
                          }
                        />
                        Multi-day maintenance
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Maintenance Time Slot
                    </label>
                    <select
                      value={bulkMaintenancePeriod}
                      onChange={(e) => setBulkMaintenancePeriod(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                      <option value="">Select slot</option>
                      <option value="7 AM - 12 PM">7 AM - 12 PM</option>
                      <option value="12 PM - 6 PM">12 PM - 6 PM</option>
                      <option value="6 PM - 11 PM">6 PM - 11 PM</option>
                      <option value="All Day">All Day</option>
                    </select>
                  </div>

                  {bulkMaintenanceMode === 'single' ? (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Maintenance Date
                      </label>
                      <input
                        type="date"
                        value={bulkMaintenanceDate}
                        onChange={(e) => setBulkMaintenanceDate(e.target.value)}
                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Maintenance Start Date
                        </label>
                        <input
                          type="date"
                          value={bulkMaintenanceStartDate}
                          onChange={(e) => setBulkMaintenanceStartDate(e.target.value)}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Maintenance End Date
                        </label>
                        <input
                          type="date"
                          value={bulkMaintenanceEndDate}
                          onChange={(e) => setBulkMaintenanceEndDate(e.target.value)}
                          className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkStatusOpen(false);
                    setBulkStatus('');
                    setBulkMaintenanceMode('single');
                    setBulkMaintenanceDate('');
                    setBulkMaintenanceStartDate('');
                    setBulkMaintenanceEndDate('');
                    setBulkMaintenancePeriod('');
                  }}
                  className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!bulkStatus || statusMutation.isPending}
                  onClick={() => {
                    const maintenanceWindow = buildMaintenanceWindow({
                      mode: bulkMaintenanceMode,
                      date: bulkMaintenanceDate,
                      startDate: bulkMaintenanceStartDate,
                      endDate: bulkMaintenanceEndDate,
                      period: bulkMaintenancePeriod,
                    });

                    if (bulkStatus === 'Maintenance') {
                      if (!bulkMaintenancePeriod) {
                        toast.error('Maintenance requires a time slot.');
                        return;
                      }

                      if (bulkMaintenanceMode === 'single' && !bulkMaintenanceDate) {
                        toast.error('Single-day maintenance requires a date.');
                        return;
                      }

                      if (
                        bulkMaintenanceMode === 'multi' &&
                        (!bulkMaintenanceStartDate || !bulkMaintenanceEndDate)
                      ) {
                        toast.error('Multi-day maintenance requires a start and end date.');
                        return;
                      }

                      if (
                        bulkMaintenanceMode === 'multi' &&
                        bulkMaintenanceEndDate < bulkMaintenanceStartDate
                      ) {
                        toast.error('Maintenance end date must be on or after the start date.');
                        return;
                      }
                    }

                    statusMutation.mutate({
                      status: bulkStatus,
                      maintenance_start: bulkStatus === 'Maintenance' ? maintenanceWindow.start : null,
                      maintenance_end: bulkStatus === 'Maintenance' ? maintenanceWindow.end : null,
                    });
                  }}
                  className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Update Devices
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* <BulkStatusModal
        isOpen={isBulkStatusOpen}
        onClose={() => setIsBulkStatusOpen(false)}
        selectedCount={selection.state.count}
        onConfirm={(status) => statusMutation.mutate({ status })}
      /> */}

      {/* <DeviceFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={(payload) => createDeviceMutation.mutate(payload)}
      /> */}
    </div>
  );

  // return (
  //   <div className="space-y-6">
  //     <div>
  //       <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Devices inventory</h1>
  //       <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
  //         View device health, ownership, and apply bulk actions.
  //       </p>
  //     </div>

  //     <FilterBar
  //       filters={filterChips}
  //       onReset={() => {
  //         const next = new URLSearchParams();
  //         setSearchParams(next, { replace: true });
  //       }}
  //     />

  //     <DataTable
  //       rows={devicesQuery.data?.items || []}
  //       columns={columns}
  //       selection={canEditDevices(permissions) ? selection : null}
  //       bulkActions={canEditDevices(permissions) ? bulkActions : null}
  //       loading={devicesQuery.status === 'pending'}
  //     />
  //   </div>
  // );
}

