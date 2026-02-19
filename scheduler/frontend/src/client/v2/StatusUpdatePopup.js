

import React, { useEffect, useState } from 'react';

const STORAGE_KEY = ''

export default function StatusUpdate() {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const dismissed = window.localStorage.getItem(STORAGE_KEY);
        if (!dismissed) {
            setVisible(true);
        }
    }, []);

    if (!visible) return null;

    return (
        <div className='fixed bottom-6 right-6 z-40 max-w-sm'>
            <div className='bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 shadow-xl rounded-2xl p-5 space-y-3'>
                <div>
                    <div className='text-xs uppercase tracking-wide text-blue-500 font-semibold'>A BOOKING HAS BEEN UPDATED</div>
                    <h3 className='text-lg font-bold text-gray-900 dark:text-gray-100 mt-1'>A status update</h3>
                </div>
                <button
                    type="button"
                    className="w-full px-4 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    onClick={() => {
                        setVisible(false);
                        if (typeof window !== 'undefined') {
                        window.localStorage.setItem(STORAGE_KEY, 'true');
                        }
                    }}
                >
                    Got it
                </button>
            </div>
        </div>
    )
}