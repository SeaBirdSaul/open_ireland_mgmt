

import React, { useEffect, useState } from 'react';

const STORAGE_KEY = ''

export default function StatusUpdate({ updates = [], onClose }) {
    const [index, setIndex] = useState(0);
    if(!updates.length) return null;

    const item = updates[index];
    const bookingNo = item.grouped_booking_id.slice(0, 8).toUpperCase();
    const updatedAt = new Date(item.status_updated_at).toLocaleString();

     return (
    <div className="fixed bottom-6 right-6 z-40 max-w-sm">
      <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-xl rounded-2xl p-5 space-y-3">
        <div className="text-xs uppercase tracking-wide text-blue-500 font-semibold">BOOKING STATUS UPDATED</div>
        <div className="text-sm text-gray-900 dark:text-gray-100">Booking #{bookingNo}</div>
        <div className="text-sm text-gray-900 dark:text-gray-100">New status: <strong>{item.status}</strong></div>
        <div className="text-xs text-gray-500 dark:text-gray-400">Updated: {updatedAt}</div>
        <button
          type="button"
          className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => {
            if (index < updates.length - 1) setIndex(index + 1);
            else onClose?.();
          }}
        >
          {index < updates.length - 1 ? 'Next update' : 'Got it'}
        </button>
      </div>
    </div>
  );
}