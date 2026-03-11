/**
 * Displays detailed information about a booking.
 * Includes booking details, conflict overview, activity log, and device health.
 * Provides actions to approve, decline, or request changes for the booking.
 * Integrates with AdminContext for permissions and toast notifications.
 */
import React, { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchBookingGroupDetail, approveBookings, declineBookings } from '../api';
import { formatDateTime } from '../utils/formatters';
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import { canEditBookings } from '../utils/permissions';

function Timeline({ label, items }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">{label}</div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={`${label}-${item.booking_id}`} className="border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {formatDateTime(item.start_time)} → {formatDateTime(item.end_time)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Status: {item.status}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">Owner: {item.owner?.username}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConflictList({ conflicts }) {
  if (!conflicts || conflicts.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No overlapping bookings detected.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {conflicts.map((conflict) => (
        <li key={conflict.booking_id} className="border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20 rounded-lg px-3 py-2">
          <div className="text-sm font-semibold text-orange-700 dark:text-orange-200">
            Booking #{conflict.booking_id} · {conflict.owner?.username}
          </div>
          <div className="text-xs text-orange-600 dark:text-orange-300">
            {formatDateTime(conflict.overlap_start)} → {formatDateTime(conflict.overlap_end)} ({conflict.status})
          </div>
        </li>
      ))}
    </ul>
  );
}

const TERMINAL_STATUSES = new Set(['CANCELLED', 'REJECTED', 'DECLINED', 'CONFIRMED', 'APPROVED', 'EXPIRED']);

function toDisplayStatus(statuses = []) {
  const normalized = statuses.map((s) => String(s || '').toUpperCase());

  if (normalized.includes('CONFLICTING')) return 'CONFLICTING';

  const allTerminal = normalized.length > 0 && normalized.every((s) => TERMINAL_STATUSES.has(s));
  if (allTerminal) {
    const uniq = [...new Set(normalized)];
    if (uniq.length === 1) {
      const s = uniq[0];
      if (s === 'DECLINED' || s === 'REJECTED') return 'REJECTED';
      if (s === 'CONFIRMED' || s === 'APPROVED') return 'APPROVED';
      if (s === 'CANCELLED') return 'CANCELLED';
      if (s === 'EXPIRED') return 'EXPIRED';
    }
    if (uniq.includes('CANCELLED')) return 'CANCELLED';
    if (uniq.includes('DECLINED') || uniq.includes('REJECTED')) return 'REJECTED';
    if (uniq.includes('EXPIRED')) return 'EXPIRED';
    return 'APPROVED';
  }

  return 'PENDING';
}

function statusBadgeClass(s) {
  if (s === 'CONFLICTING') return 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200';
  if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200';
  if (s === 'REJECTED') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200';
  if (s === 'CANCELLED') return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  if (s === 'EXPIRED') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200';
}

export default function BookingDetailDrawer({ groupId, open, onClose }) {
  const toast = useToastContext();
  const { permissions } = useAdminContext();
  const queryClient = useQueryClient();

  const bookingQuery = useQuery({
    queryKey: ['admin-booking-group-detail', groupId],
    queryFn: () => fetchBookingGroupDetail(groupId),
    enabled: open && Boolean(groupId),
  });

  const bookingIds = bookingQuery.data?.bookings?.map((b) => b.booking_id) || [];

  const approveMutation = useMutation({
    mutationFn: () => approveBookings({ booking_ids: bookingIds }),
    onSuccess: async () => {
      toast.success('Booking approved.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-booking-group-detail', groupId] }),
      ]);
      onClose?.();
    },
    onError: (err) => toast.error(err?.message || 'Unable to approve booking.'),
  });

  const declineMutation = useMutation({
    mutationFn: () => declineBookings({ booking_ids: bookingIds }),
    onSuccess: async () => {
      toast.success('Booking declined.');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-booking-group-detail', groupId] }),
      ]);
      onClose?.();
    },
    onError: (err) => toast.error(err?.message || 'Unable to decline booking.'),
  });

  useEffect(() => {
    if (!open) return;
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const data = bookingQuery.data;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
        role="presentation"
      />
      <aside className="relative z-10 w-full max-w-xl h-full bg-white dark:bg-gray-950 shadow-xl border-l border-gray-200 dark:border-gray-800 overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Booking detail</div>
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              #{groupId}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Close
          </button>
        </div>

        {bookingQuery.status === 'pending' ? (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading booking details…</div>
        ) : bookingQuery.status === 'error' ? (
          <div className="p-6 text-sm text-red-600 dark:text-red-300">
            Unable to load booking details. Please try again later.
          </div>
        ) : data ? (
          <div className="p-6 space-y-6">
            <section>
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">
                Summary
              </div>
              <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">User</span>
                  <span className="text-gray-900 dark:text-gray-100">{data.owner?.username || 'Unknown'}</span>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-gray-600 dark:text-gray-400">Collaborators</span>
                  <span className="text-right text-gray-900 dark:text-gray-100">
                    {(data.summary?.collaborators || []).length
                      ? data.summary.collaborators.join(', ')
                      : 'None'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Time Frame</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatDateTime(data.summary?.group_start)} → {formatDateTime(data.summary?.group_end)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Status</span>
                  <span className="text-gray-900 dark:text-gray-100">{data.summary?.statuses?.join(', ') || 'Pending'}</span>
                </div>
                <div>
                  <div className="text-gray-600 dark:text-gray-400">Comment</div>
                  <div className="mt-1 text-gray-900 dark:text-gray-100 text-sm">
                    {(data.summary?.comments || []).length ? data.summary.comments.join(' |') : '-'}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <Timeline label="Timeline" items={bookingQuery.data.timeline} />
            </section>

            <section>
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">
                Conflicts
              </div>
              <ConflictList conflicts={bookingQuery.data.conflicts} />
            </section>

            {bookingQuery.data.device_health && (
              <section>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">
                  Device health snapshot
                </div>
                <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 text-sm text-gray-700 dark:text-gray-200">
                  <div>Status: {bookingQuery.data.device_health.status}</div>
                  {bookingQuery.data.device_health.heartbeat_at && (
                    <div>Last heartbeat: {formatDateTime(bookingQuery.data.device_health.heartbeat_at)}</div>
                  )}
                </div>
              </section>
            )}

            <section>
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">Device in group</div>
              <ul className="space-y-2">
                {(data.devices || []).map((d) => (
                  <li key={d.device_id} className="border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2">
                    <div className='text-sm font-semibold'>{d.device_name}</div>
                    <div className='text-xs text-gray-500'>{d.device_type}</div>
                    <div className='text-xs text-gray-500'>
                      {formatDateTime(d.first_start_time)} → {formatDateTime(d.last_end_time)}
                    </div>
                    {(() => {
                      const deviceStatus = toDisplayStatus(d.statuses || []);
                      return (
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(deviceStatus)}`}>
                            {deviceStatus}
                          </span>
                        </div>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            </section>

            {canEditBookings(permissions) && (
              <section>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => declineMutation.mutate()}
                    disabled={declineMutation.isPending}
                    className="px-4 py-2 text-sm font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>
              </section>
            )}
          </div>
        ) : (
          <div className="p-6 text-sm text-gray-500 dark:text-gray-400">Booking not found.</div>
        )}
      </aside>
    </div>
  );
}

