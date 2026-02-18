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
function BookingSummary({ booking }) {
    if (!booking) return null;

    return (
        <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">User</span>
                <span className="text-gray-900 dark:text-gray-100">{booking.user.username}</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Device</span>
                <span className="text-gray-900 dark:text-gray-100">{booking.device.name}</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Start</span>
                <span className="text-gray-900 dark:text-gray-100">{formatDateTime(booking.start_time)}</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-gray-600 dark:text-gray-400">Status</span>
                <span className="text-gray-900 dark:text-gray-100">{booking.status}</span>
            </div>
            <div className="flex items-center justify-between">
                <div className="text-gray-600 dark:text-gray-400">Comment</div>
                <div className="mt-1 text-gray-900 dark:text-gray-100 text-sm">
                    {booking.comment || '-'}
                </div>
            </div>
        </div>
    );
}

// Displays details of each booking 
function BookingDetailPanel({ booking, bookingId, isLoading, isError }) {
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
        <div className="p-4 space-y-4 h-full overflow-y-auto">
            <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">
                    Booking #{bookingId}
                </div>
                <BookingSummary booking={booking} />
            </div>
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
      mutationFn: () => approveBookings({ booking_ids: [bookingId1] }),
      onSuccess: async () => {
        declineMutation2.mutate();
        toast.success('Booking approved.');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-one', bookingId1] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-two', bookingId2] }),
        ]);
        onClosed?.();
      },
      onError: (err) => toast.error(err?.message || 'Unable to approve booking.'),
    });

    const declineMutation1 = useMutation({
      mutationFn: () => declineBookings({ booking_ids: [bookingId1] }),
      onSuccess: async () => {
        approveMutation2.mutate();
        toast.success('Booking declined.');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-one', bookingId1] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-two', bookingId2] }),
        ]);
        onClosed?.();
      },
      onError: (err) => toast.error(err?.message || 'Unable to decline booking.'),
    });

    const approveMutation2 = useMutation({
      mutationFn: () => approveBookings({ booking_ids: [bookingId2] }),
      onSuccess: async () => {
        declineMutation1.mutate();
        toast.success('Booking approved.');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-one', bookingId1] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-two', bookingId2] }),
        ]);
        onClosed?.();
      },
      onError: (err) => toast.error(err?.message || 'Unable to approve booking.'),
    });

    const declineMutation2 = useMutation({
      mutationFn: () => declineBookings({ booking_ids: [bookingId2] }),
      onSuccess: async () => {
        approveMutation1.mutate();
        toast.success('Booking declined.');
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['admin-bookings'] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-one', bookingId1] }),
          queryClient.invalidateQueries({ queryKey: ['conflict-resolution-two', bookingId2] }),
        ]);
        onClosed?.();
      },
      onError: (err) => toast.error(err?.message || 'Unable to decline booking.'),
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
    const booking2 = bookingQuery2.data?.booking;

    return(
        <div className="fixed inset-0 z-50 flex justify-end">
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
                            Booking #{bookingId1} vs #{bookingId2}
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
                        isLoading={bookingQuery1.status === 'pending'}
                        isError={bookingQuery1.status === 'error'}
                    />
                    {canEditBookings(permissions) && booking1 && (
                        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
                            <button
                                type="button"
                                onClick={() => approveMutation1.mutate()}
                                disabled={approveMutation1.isPending  || booking1.status != "CONFLICTING"}
                                className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                Approve Booking {bookingId1}
                            </button>
                            <button
                                type="button"
                                onClick={() => declineMutation1.mutate()}
                                disabled={declineMutation1.isPending || booking1.status != "CONFLICTING"}
                                className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                                Decline Booking {bookingId1}
                            </button>
                        </div>
                    )}
                </div>
                {/* Right Booking */}
                <div className="flex-1 overflow-y-auto">
                    <BookingDetailPanel
                        booking={booking2}
                        bookingId={bookingId2}
                        isLoading={bookingQuery2.status === 'pending'}
                        isError={bookingQuery2.status === 'error'}
                    />
                    {canEditBookings(permissions) && booking2 && (
                        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
                            <button
                                type="button"
                                onClick={() => approveMutation2.mutate()}
                                disabled={approveMutation2.isPending || booking2.status != "CONFLICTING"}
                                className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                                Approve Booking {bookingId2}
                            </button>
                            <button
                                type="button"
                                onClick={() => declineMutation2.mutate()}
                                disabled={declineMutation2.isPending || booking2.status != "CONFLICTING"}
                                className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60"
                            >
                                Decline Booking {bookingId2}
                            </button>
                        </div>
                    )}
                    </div>
                </div>
            </div>
        </div>
    );

}