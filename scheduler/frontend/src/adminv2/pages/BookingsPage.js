/**
 * BookingsPage component for admin interface.
 * Provides an overview of bookings with filtering, bulk actions, and detailed views.
 * Supports approving, declining, and resolving booking conflicts.
 * Includes export functionality and date range selection.
 * Utilizes React Query for data fetching and state management.
 * Integrates with AdminContext for permissions and toast notifications.
 * Implements bulk selection of bookings for efficient management.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import usePersistentState from '../hooks/usePersistentState';
import useBulkSelection from '../hooks/useBulkSelection';
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import {
  fetchBookings,
  approveBookings,
  declineBookings,
  resolveConflicts,
} from '../api';
import { API_BASE_URL } from '../../config/api';
import DataTable from '../components/DataTable';
import DateRangeControls from '../components/DateRangeControls';
import FilterBar from '../components/FilterBar';
import { formatDateTime } from '../utils/formatters';
import {
  canEditBookings,
  canExportBookings,
} from '../utils/permissions';
import BookingDetailDrawer from '../sections/BookingDetailDrawer';
import ConflictResolutionModal from '../sections/ConflictResolutionModal';

const STATUS_OPTIONS = [
  { key: 'PENDING', label: 'Pending' },
  { key: 'CONFIRMED', label: 'Approved' },
  { key: 'DECLINED', label: 'Declined' },
  { key: 'CONFLICTING', label: 'Conflict' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

function buildParams(searchParams, dateRange) {
  const params = {
    status: searchParams.getAll('status').join(',') || undefined,
    search: searchParams.get('q') || undefined,
    conflict_only: searchParams.get('conflict') === '1' ? true : undefined,
    awaiting_my_action: searchParams.get('awaiting') === '1' ? true : undefined,
    device_type: searchParams.get('device_type') || undefined,
    device_name: searchParams.get('device_name') || undefined,
    user_name: searchParams.get('user') || undefined,
    limit: 25,
    offset: Number(searchParams.get('offset') || 0),
    sort: searchParams.get('sort') || 'start_time:asc',
  };
  if (dateRange?.start) params.date_start = dateRange.start;
  if (dateRange?.end) params.date_end = dateRange.end;
  return params;
}

export default function BookingsPage() {
  const navigate = useNavigate();
  const toast = useToastContext();
  const queryClient = useQueryClient();
  const { permissions } = useAdminContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dateRange, setDateRange] = usePersistentState('admin-bookings-date-range', {
    start: null,
    end: null,
    preset: 'This Week',
  });
  const focusedBookingId = searchParams.get('focus');
  const conflictResolutionId1 = searchParams.get('resolve-id-1');
  const conflictResolutionId2 = searchParams.get('resolve-id-2');

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (dateRange?.start) {
      next.set('start', dateRange.start);
    } else {
      next.delete('start');
    }
    if (dateRange?.end) {
      next.set('end', dateRange.end);
    } else {
      next.delete('end');
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [dateRange, searchParams, setSearchParams]);

  const params = useMemo(() => buildParams(searchParams, dateRange), [searchParams, dateRange]);

  const bookingsQuery = useQuery({
    queryKey: ['admin-bookings', params],
    queryFn: () => fetchBookings(params),
    keepPreviousData: true,
  });

  const selection = useBulkSelection(bookingsQuery.data?.items || [], (row) => row.booking_id);

  const approveMutation = useMutation({
    mutationFn: (payload) => approveBookings(payload),
    onSuccess: async (result) => {
      toast.success(`Approved ${result.updated.length} bookings.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      selection.clear();
    },
    onError: (err) => toast.error(err?.message || 'Unable to approve bookings.'),
  });

  const declineMutation = useMutation({
    mutationFn: (payload) => declineBookings(payload),
    onSuccess: async (result) => {
      toast.success(`Declined ${result.updated.length} bookings.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      selection.clear();
    },
    onError: (err) => toast.error(err?.message || 'Unable to decline bookings.'),
  });

  // const resolveMutation = useMutation({
  //   mutationFn: (payload) => resolveConflicts(payload),
  //   onSuccess: async () => {
  //     toast.success('Conflicts resolved.');
  //     await queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
  //     selection.clear();
  //   },
  //   onError: (err) => toast.error(err?.message || 'Unable to resolve conflicts.'),
  // });

  const handleBulkApprove = () => {
    const ids = Array.from(selection.state.ids);
    approveMutation.mutate({ booking_ids: ids });
  };

  const handleBulkDecline = () => {
    const ids = Array.from(selection.state.ids);
    declineMutation.mutate({ booking_ids: ids });
  };

  const handleResolveConflicts = () => {
    const ids = Array.from(selection.state.ids);

    if (ids.length === 2){
      const next = new URLSearchParams(searchParams);
      next.set('resolve-id-1', ids[0]);
      next.set('resolve-id-2', ids[1]);
      setSearchParams(next, { replace: true });
    } else if (ids.length > 2){
      toast.error('Select exactly 2 conflicting bookings to compare and resolve.');
    } else if (ids.length === 1){
      toast.error('Select at least 2 bookings to resolve conflicts.');
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'booking_id',
        header: 'Booking ID',
        accessor: (row) => row.booking_id,
        className: 'font-mono text-xs text-gray-500 dark:text-gray-400',
      },
      {
        key: 'user',
        header: 'User',
        render: (row) => (
          <div>
            <div className="font-medium text-gray-800 dark:text-gray-100">{row.user.username}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">#{row.user.id}</div>
          </div>
        ),
      },
      {
        key: 'device',
        header: 'Device',
        render: (row) => (
          <div>
            <div className="font-medium text-gray-800 dark:text-gray-100">{row.device.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{row.device.type}</div>
          </div>
        ),
      },
      {
        key: 'time',
        header: 'Time window',
        render: (row) => (
          <div className="text-sm text-gray-700 dark:text-gray-200">
            <div>{formatDateTime(row.start_time)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(row.end_time)}</div>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        render: (row) => {
          const status = row.status || 'PENDING';
          const badgeClasses =
            status === 'CONFIRMED'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
              : status === 'DECLINED'
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
              : status === 'CONFLICTING'
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200'
              : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
          return (
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClasses}`}>
              {status}
            </span>
          );
        },
      },
      {
        key: 'notes',
        header: 'Notes',
        render: (row) => (
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
            {row.comment || '—'}
          </div>
        ),
      },
    ],
    []
  );

  const filterChips = useMemo(() => {
    const chips = [];
    const statusValues = searchParams.getAll('status');
    STATUS_OPTIONS.forEach((option) => {
      const isActive = statusValues.includes(option.key);
      chips.push({
        key: `status-${option.key}`,
        label: option.label,
        active: isActive,
        onRemove: isActive
          ? () => {
              const next = new URLSearchParams(searchParams);
              const remaining = next.getAll('status').filter((value) => value !== option.key);
              next.delete('status');
              remaining.forEach((value) => next.append('status', value));
              setSearchParams(next, { replace: true });
            }
          : () => {
              const next = new URLSearchParams(searchParams);
              next.append('status', option.key);
              setSearchParams(next, { replace: true });
            },
      });
    });

    const conflictOnly = searchParams.get('conflict') === '1';
    chips.push({
      key: 'conflict',
      label: 'Conflicts only',
      active: conflictOnly,
      onRemove: () => {
        const next = new URLSearchParams(searchParams);
        if (conflictOnly) {
          next.delete('conflict');
        } else {
          next.set('conflict', '1');
        }
        setSearchParams(next, { replace: true });
      },
    });

    const awaiting = searchParams.get('awaiting') === '1';
    chips.push({
      key: 'awaiting',
      label: 'Awaiting my action',
      active: awaiting,
      onRemove: () => {
        const next = new URLSearchParams(searchParams);
        if (awaiting) {
          next.delete('awaiting');
        } else {
          next.set('awaiting', '1');
        }
        setSearchParams(next, { replace: true });
      },
    });

    return chips;
  }, [searchParams, setSearchParams]);

  const bulkActions = (selectionState) => {
    const disabled = selectionState.count === 0;
    const hasCancelledBooking = selection.selectedRows.some(
      (row) => row.status === 'CANCELLED'
    );
    return (
      <div className="flex items-center gap-2">
        {canEditBookings(permissions) && (
          <>
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={disabled || approveMutation.isPending || hasCancelledBooking}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={handleBulkDecline}
              disabled={disabled || declineMutation.isPending || hasCancelledBooking}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={handleResolveConflicts}
              disabled={disabled || hasCancelledBooking}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
            >
              Resolve conflicts
            </button>
          </>
        )}
      </div>
    );
  };

  const prevSelectionRef = React.useRef(selection.state.ids);
  const handleRowClick = (row, event) => {
    // Don't trigger if checkbox is clicked
    const currentIds = selection.state.ids;
    const selectionChanged = currentIds.size !== prevSelectionRef.current.size ||
      ![...currentIds].every(id => prevSelectionRef.current.has(id));

    if (selectionChanged){
      prevSelectionRef.current = new Set(currentIds);
      return;
    }

    const next = new URLSearchParams(searchParams);
    next.set('focus', row.booking_id);
    setSearchParams(next, { replace: true });
  };

  const handleCloseDrawer = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('focus');
    setSearchParams(next, { replace: true });
  };

  const handleCloseConflictResolution = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('resolve-id-1');
    next.delete('resolve-id-2');
    setSearchParams(next, { replace: true });
    selection.clear();
  };

  const handleExport = () => {
    if (!canExportBookings(permissions)) {
      toast.error('Export requires additional permissions.');
      return;
    }
    const exportParams = new URLSearchParams(searchParams);
    if (dateRange?.start) exportParams.set('date_start', dateRange.start);
    if (dateRange?.end) exportParams.set('date_end', dateRange.end);
    const query = exportParams.toString();
    const url = `${API_BASE_URL}/admin/v2/bookings/export${query ? `?${query}` : ''}`;
    toast.info('Preparing CSV export…');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings oversight</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Approvals, conflicts, and queue management in one view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canExportBookings(permissions) && (
            <button
              type="button"
              onClick={handleExport}
              className="px-3 py-2 text-sm font-semibold rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Export CSV
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="px-3 py-2 text-sm font-semibold rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            Back to dashboard
          </button>
        </div>
      </div>

      <DateRangeControls
        storageKey="admin-bookings"
        value={dateRange}
        onChange={setDateRange}
      />

      <FilterBar
        filters={filterChips}
        onReset={() => {
          const next = new URLSearchParams();
          if (dateRange?.start) next.set('start', dateRange.start);
          if (dateRange?.end) next.set('end', dateRange.end);
          setSearchParams(next, { replace: true });
        }}
      />

      <DataTable
        rows={bookingsQuery.data?.items || []}
        columns={columns}
        selection={canEditBookings(permissions) ? selection : null}
        bulkActions={canEditBookings(permissions) ? bulkActions : null}
        loading={bookingsQuery.status === 'pending'}
        onRowClick={canEditBookings(permissions) ? handleRowClick : undefined}
        rowId={(row) => row.booking_id}
      />

      <BookingDetailDrawer
        bookingId={focusedBookingId}
        open={Boolean(focusedBookingId)}
        onClose={handleCloseDrawer}
      />
      <ConflictResolutionModal
        bookingId1={conflictResolutionId1}
        bookingId2={conflictResolutionId2}
        open={Boolean(conflictResolutionId1 && conflictResolutionId2)}
        onClosed={handleCloseConflictResolution}
      />
    </div>
  );
}

