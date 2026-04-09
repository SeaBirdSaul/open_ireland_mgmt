// A modal for the "resolve conflict" button on the Bookings Page of the admin side 
// Allows the admin to view both sides of the conflict and decide which side to allow
// Updates both statuses to either CONFIRMED or DECLINED

import React, { useEffect } from 'react';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { approveBookings, declineBookings, fetchBookingDetail } from '../api';
import { formatDateTime  } from '../utils/formatters';  
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import { canEditBookings } from '../utils/permissions';


// Reusable component to ensure both sides of the modal are identical
function BookingSummary({ booking, groupInfo }) {
    if (!booking) return null;

    const isGroup = groupInfo?.is_group_booking;
    const groupStart = groupInfo?.devices?.reduce((min, dev) => {
        const current = new Date(dev.start_time);
        return min ? (current < min ? current : min) : current;
    }, null);
    const groupEnd = groupInfo?.devices?.reduce((max, dev) => {
        const current = new Date(dev.end_time);
        return max ? (current > max ? current : max) : current;
    }, null);

    return (
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-3xl p-6 space-y-4 text-sm shadow-sm border border-gray-200 dark:border-gray-800">
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">User</div>
                    <div className="mt-1 text-gray-900 dark:text-gray-100 font-medium">{booking.user.username}</div>
                </div>
                {isGroup && (
                    <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Collaborators</div>
                        <div className="mt-1 text-gray-900 dark:text-gray-100 space-y-1">
                            {groupInfo.collaborators.length > 0
                                ? groupInfo.collaborators.map((collab, idx) => (
                                    <div key={idx}>{collab.username}</div>
                                ))
                                : <div className="text-gray-500 dark:text-gray-500">None</div>
                            }
                        </div>
                    </div>
                )}
                <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Time Frame</div>
                    <div className="mt-1 text-gray-900 dark:text-gray-100 font-medium">
                        {groupStart && groupEnd
                            ? `${groupStart.toLocaleString()} → ${groupEnd.toLocaleString()}`
                            : `${formatDateTime(booking.start_time)} → ${formatDateTime(booking.end_time)}`}
                    </div>
                </div>
                <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Status</div>
                    <div className="mt-1 text-gray-900 dark:text-gray-100 font-medium">{booking.status}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                <div>
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Comment</div>
                    <div className="mt-1 text-gray-900 dark:text-gray-100">{booking.comment || '-'}</div>
                </div>
            </div>
        </div>
    );
}

// Displays details of each booking 
function BookingDetailPanel({ booking, bookingId, groupInfo, isLoading, isError }) {
    if (isLoading) {
        return (
        <div className="flex items-center justify-center h-full py-8 text-sm text-gray-500 dark:text-gray-400">
            Loading booking details…
        </div>
        );
    }

    if (isError) {
        return (
        <div className="flex items-center justify-center h-full py-8 text-sm text-red-600 dark:text-red-300">
            Unable to load booking details.
        </div>
        );
    }

    if (!booking) {
        return (
        <div className="flex items-center justify-center h-full py-8 text-sm text-gray-500 dark:text-gray-400">
            Booking not found.
        </div>
        );
    }

    return (
        <div className="p-4 space-y-6 h-full overflow-y-auto">
            <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">
                    {groupInfo?.is_group_booking ? `Group ${booking.grouped_booking_id}` : `Booking #${bookingId}`}
                </div>
                <BookingSummary booking={booking} groupInfo={groupInfo} />
            </div>

            {groupInfo?.devices?.length > 0 && (
                <div className="space-y-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Device in group</div>
                    <div className="space-y-3">
                        {groupInfo.devices.map((dev, idx) => (
                            <div key={idx} className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 shadow-sm">
                                <div className="flex items-center justify-between gap-4">
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{dev.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{dev.type}</div>
                                    </div>
                                    <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200 px-3 py-1 text-[11px] font-semibold">CONFLICTING</span>
                                </div>
                                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(dev.start_time).toLocaleString()} → {new Date(dev.end_time).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* {groupInfo?.group_bookings?.length > 0 && (
                <div className="space-y-3">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">Individual bookings</div>
                    <div className="space-y-2">
                        {groupInfo.group_bookings.map((gb) => (
                            <div key={gb.booking_id} className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Booking #{gb.booking_id}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">{gb.user.username}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            disabled
                                            className="px-3 py-1 text-[11px] font-semibold rounded-full border border-gray-300 text-gray-500 bg-white dark:bg-gray-950 dark:border-gray-800 dark:text-gray-400"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            disabled
                                            className="px-3 py-1 text-[11px] font-semibold rounded-full border border-gray-300 text-gray-500 bg-white dark:bg-gray-950 dark:border-gray-800 dark:text-gray-400"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    {gb.device.name} ({gb.device.type})
                                </div>
                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(gb.start_time).toLocaleString()} → {new Date(gb.end_time).toLocaleString()}
                                </div>
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    Status: {gb.status}
                                </div>
                                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    Comment: {gb.comment || '-'}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )} */}
        </div>
    );
}

export default function ConflictResolutionModal( { bookingId1, bookingId2, open, onClosed }) {
    const toast = useToastContext();
    const { permissions } = useAdminContext();
    const queryClient = useQueryClient();

    const bookingQuery1 = useQuery({
        queryKey: ['conflict-resolution-one', bookingId1],
        queryFn: () => fetchBookingDetail(bookingId1),
        enabled: open && Boolean(bookingId1),
    });

    const bookingQuery2 = useQuery({
        queryKey: ['conflict-resolution-two', bookingId2],
        queryFn: () => fetchBookingDetail(bookingId2),
        enabled: open && Boolean(bookingId2),
    });

    const approveMutation1 = useMutation({
      mutationFn: async () => {
        await approveBookings({ booking_ids: [bookingId1] });
        await declineBookings({ booking_ids: [bookingId2] });
      },
      onSuccess: async () => {
        toast.success('Conflict resolved: Group 1 approved, Group 2 declined.');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-one', bookingId1] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-two', bookingId2] }),
        ]);
        onClosed?.();
      },
      onError: (err) => toast.error(err?.message || 'Unable to resolve conflict.'),
    });

    const declineMutation1 = useMutation({
      mutationFn: async () => {
        await declineBookings({ booking_ids: [bookingId1] });
        await approveBookings({ booking_ids: [bookingId2] });
      },
      onSuccess: async () => {
        toast.success('Conflict resolved: Group 1 declined, Group 2 approved.');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-one', bookingId1] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-two', bookingId2] }),
        ]);
        onClosed?.();
      },
      onError: (err) => toast.error(err?.message || 'Unable to resolve conflict.'),
    });

    const approveMutation2 = useMutation({
      mutationFn: async () => {
        await approveBookings({ booking_ids: [bookingId2] });
        await declineBookings({ booking_ids: [bookingId1] });
      },
      onSuccess: async () => {
        toast.success('Conflict resolved: Group 2 approved, Group 1 declined.');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-one', bookingId1] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-two', bookingId2] }),
        ]);
        onClosed?.();
      },
      onError: (err) => toast.error(err?.message || 'Unable to resolve conflict.'),
    });

    const declineMutation2 = useMutation({
      mutationFn: async () => {
        await declineBookings({ booking_ids: [bookingId2] });
        await approveBookings({ booking_ids: [bookingId1] });
      },
      onSuccess: async () => {
        toast.success('Conflict resolved: Group 2 declined, Group 1 approved.');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-one', bookingId1] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-two', bookingId2] }),
        ]);
        onClosed?.();
      },
      onError: (err) => toast.error(err?.message || 'Unable to resolve conflict.'),
    });

    useEffect(() => {
        if (!open) return;
        const handleKey = (event) => {
            if (event.key === 'Escape') {
                onClosed?.();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open, onClosed]);

    if(!open) return null;

    const booking1 = bookingQuery1.data?.booking;
    const groupInfo1 = bookingQuery1.data?.group_info;
    const booking2 = bookingQuery2.data?.booking;
    const groupInfo2 = bookingQuery2.data?.group_info;

    return(
        <div className="fixed inset-0 z-[100] flex justify-end">
            <div
            className="fixed inset-0 bg-black/40"
            onClick={onClosed}
            role="presentation"
            />
            <div className="relative z-10 w-full h-full bg-white dark:bg-gray-950 flex flex-col">
                {/* Header */}
                <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <div>
                        <div className="text-xs uppercase tracking-wide text-gray-500 dark:border-gray-400">
                            Conflict Resolution
                        </div>
                        <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {groupInfo1?.is_group_booking || groupInfo2?.is_group_booking 
                                ? `Group ${booking1?.grouped_booking_id || bookingId1} vs Group ${booking2?.grouped_booking_id || bookingId2}`
                                : `Booking #${bookingId1} vs Booking #${bookingId2}`
                            }
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClosed}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                        Close
                    </button>
            </div>
            {/* Main Content - Split View */}
            <div className="flex-1 overflow-hidden flex">
                {/* Left Booking */}
                <div className="flex-1 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
                    <BookingDetailPanel
                        booking={booking1}
                        bookingId={bookingId1}
                        groupInfo={groupInfo1}
                        isLoading={bookingQuery1.status === 'pending'}
                        isError={bookingQuery1.status === 'error'}
                    />
                    {canEditBookings(permissions) && booking1 && (
                        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
                            <button
                                type="button"
                                onClick={() => approveMutation1.mutate()}
                                disabled={approveMutation1.isPending}
                                className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                Approve {groupInfo1?.is_group_booking ? 'Group' : 'Booking'} {groupInfo1?.is_group_booking ? booking1.grouped_booking_id : bookingId1}
                            </button>
                            <button
                                type="button"
                                onClick={() => declineMutation1.mutate()}
                                disabled={declineMutation1.isPending}
                                className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                                Decline {groupInfo1?.is_group_booking ? 'Group' : 'Booking'} {groupInfo1?.is_group_booking ? booking1.grouped_booking_id : bookingId1}
                            </button>
                        </div>
                    )}
                </div>
                {/* Right Booking */}
                <div className="flex-1 overflow-y-auto">
                    <BookingDetailPanel
                        booking={booking2}
                        bookingId={bookingId2}
                        groupInfo={groupInfo2}
                        isLoading={bookingQuery2.status === 'pending'}
                        isError={bookingQuery2.status === 'error'}
                    />
                    {canEditBookings(permissions) && booking2 && (
                        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
                            <button
                                type="button"
                                onClick={() => approveMutation2.mutate()}
                                disabled={approveMutation2.isPending}
                                className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                Approve {groupInfo2?.is_group_booking ? 'Group' : 'Booking'} {groupInfo2?.is_group_booking ? booking2.grouped_booking_id : bookingId2}
                            </button>
                            <button
                                type="button"
                                onClick={() => declineMutation2.mutate()}
                                disabled={declineMutation2.isPending}
                                className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                                Decline {groupInfo2?.is_group_booking ? 'Group' : 'Booking'} {groupInfo2?.is_group_booking ? booking2.grouped_booking_id : bookingId2}
                            </button>
                        </div>
                    )}
                    </div>
                </div>
            </div>
        </div>
    );

}