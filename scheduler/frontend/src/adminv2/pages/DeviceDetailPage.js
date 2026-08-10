import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '../../admin/components/PageHeader';
import { fetchDeviceDetail, updateDeviceDetail } from '../api';
import { useToastContext } from '../../contexts/ToastContext';

function DetailRow({ label, value }) {
    return (
        <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {label}
            </div>
            <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {value ?? '-'}
            </div>
        </div>
    );
}

const MAINTENANCE_PERIODS = [
    '7 AM - 12 PM',
    '12 PM - 6 PM',
    '6 PM - 11 PM',
];

function parseMaintenanceValue(value) {
    if (!value) {
        return { period: '', date: '' };
    }

    const [period, date] = value.split('/');
    return {
        period: period || '',
        date: date || '',
    };
}

function formatMaintenanceValue(period, date) {
    if (!period || !date) {
        return null;
    }
    return `${period}/${date}`;
}

function formatSlotDataTime(date, time) {
    if (!date || !time) return '-';
    const parsed = new Date(`${date}T${time}:00`);
    return parsed.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

function getPeriodBounds(period) {
    switch (period) {
        case '7 AM - 12 PM':
            return { start: '07:00', end: '12:00' };
        case '12 PM - 6 PM':
            return { start: '12:00', end: '18:00' };
        case '6 PM - 11 PM':
            return { start: '18:00', end: '23:00' };
        case 'All Day':
            return { start: '00:00', end: '23:59' };
        default:
            return null;
    }
}

function formatMaintenanceDisplay(value, edge = 'start') {
    if (!value) return '-';

    const { period, date } = parseMaintenanceValue(value);
    const bounds = getPeriodBounds(period);

    if (!period || !date || !bounds) {
        return value;
    }

    if (period === 'All Day') {
        return `${date} All Day`;
    }

    return edge === 'start'
        ? formatSlotDataTime(date, bounds.start)
        : formatSlotDataTime(date, bounds.end);
}

function addDays(dateString, days) {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month -1, day);
    date.setDate(date.getDate() + days);

    const nextYear = date.getFullYear();
    const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
    const nextDay = String(date.getDate()).padStart(2, '0');

    return `${nextYear}-${nextMonth}-${nextDay}`;
}

function computeMaintenanceEnd(startDate, startPeriod, expectedHours) {
    if (!startDate || !startPeriod) {
        return null;
    }

    if (startPeriod === 'All Day') {
        return `All Day/${startDate}`;
    }

    const hours = Number(expectedHours || 0);
    const slotLengthHours = 5;
    const slotToAdvance = Math.max(0, Math.ceil(hours / slotLengthHours) - 1);

    const startIndex = MAINTENANCE_PERIODS.indexOf(startPeriod);
    if (startIndex === -1) {
        return null;
    }

    const absoluteIndex = startIndex + slotToAdvance;
    const dayOffset = Math.floor(absoluteIndex / MAINTENANCE_PERIODS.length);
    const periodIndex = absoluteIndex % MAINTENANCE_PERIODS.length;

    const endDate = addDays(startDate, dayOffset);
    const endPeriod = MAINTENANCE_PERIODS[periodIndex];

    return `${endPeriod}/${endDate}`;
}


export default function DeviceDetailPage() {
    const { deviceId } = useParams();
    const navigate = useNavigate();
    const toast = useToastContext();
    const queryClient = useQueryClient();

    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm] = useState({
        deviceType: '',
        deviceName: '',
        polatis_name: '',
        ip_address: '',
        status: 'Available',
        maintenance_mode: 'single',
        maintenance_date: '',
        maintenance_start_date: '',
        maintenance_end_date: '',
        maintenance_period: '',
        Out_Port: '',
        In_Port: '',
    });

    const deviceQuery = useQuery({
        queryKey: ['admin-device', deviceId],
        queryFn: () => fetchDeviceDetail(deviceId),
        enabled:Boolean(deviceId),
    });

    useEffect(() => {
        if (!deviceQuery.data) return;
        setForm({
            deviceType: deviceQuery.data.deviceType || '',
            deviceName: deviceQuery.data.deviceName || '',
            polatis_name: deviceQuery.data.polatis_name || '',
            ip_address: deviceQuery.data.ip_address || '',
            status: deviceQuery.data.status || 'Available',
            maintenance_mode: isMultiDayMaintenance ? 'multi' : 'single',
            maintenance_date: !isMultiDayMaintenance ? parsedMaintenanceStart.date || '' : '',
            maintenance_start_date: parsedMaintenanceStart.date || '',
            maintenance_end_date: parsedMaintenanceEnd.date || '',
            maintenance_period: parsedMaintenanceStart.period || '',
            Out_Port: deviceQuery.data.Out_Port || '',
            In_Port: deviceQuery.data.In_Port || '',
        });
    }, [deviceQuery.data]);

    const updateMutation = useMutation({
        mutationFn: (payload) => updateDeviceDetail(deviceId, payload),
        onSuccess: async (result) => {
            const affectedCount = result?.maintenance?.affected_count ?? 0;

            if (affectedCount > 0) {
                toast.success(`Device updated. ${affectedCount} bookings were affected by maintenance.`);
            } else {
                toast.success('Device updated.');
            }
            
            await queryClient.invalidateQueries({ queryKey: ['admin-device', deviceId] });
            await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
            await queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
            setIsEditing(false);
        },
        onError: (err) => {
            const detail = 
            err?.payload?.detail
                ? JSON.stringify(err.payload.detail)
                : err?.message || 'Unable to update device.'; 
            toast.error(detail);
        },
    });

    if (deviceQuery.isPending) {
        return (
            <div className="space-y-6">
                <PageHeader title="Device" subtitle="Loading device details" />
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
                    <div className="animate-pulse space-y-3">
                        <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-gray-800" />
                        <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-800" />
                        <div className="h-4 w-2/3 rounded bg-gray-200 dark:bg-gray-800" />
                    </div>
                </div>
            </div>
        );
    }

    if (deviceQuery.isError || !deviceQuery.data) {
        return (
            <div className="space-y-6">
                <PageHeader
                    title="Device"
                    subtitle="Unable to load device details."
                    actions={
                        <button
                            type="button"
                            onClick={() => navigate('/admin/devices')}
                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700"
                        >
                            Back to Devices
                        </button>
                    }
                />
                <div className="rounded-xl border border-red-200 dark:border-red-900 bg-white dark:bg-gray-950 p-6">
                    <p className="text-sm text-red-600 dark:text-red-300">
                        {deviceQuery.error?.message || 'Failed to load device.'}
                    </p>
                </div>
            </div>
        );
    }

    const device = deviceQuery.data;
    const parsedMaintenanceStart = parseMaintenanceValue(deviceQuery.data.maintenance_start);
    const parsedMaintenanceEnd = parseMaintenanceValue(deviceQuery.data.maintenance_end);
    
    const isMultiDayMaintenance =
        parsedMaintenanceStart.date &&
        parsedMaintenanceEnd.date &&
        parsedMaintenanceStart.date !== parsedMaintenanceEnd.date;

    function buildMaintenanceWindow({ mode, date, startDate, endDate, period }) {
        if (!period) return { start: null, end: null};

        if(mode === 'single') {
            if (!date) return { start: null, end: null };
            return {
                start: `${period}/${date}`,
                end: `${period}/${date}`
            };
        }

        if (!startDate || !endDate) {
            return { start: null, end: null };
        }

        return {
            start: `${period}/${startDate}`,
            end: `${period}/${endDate}`
        };
    }

    if (!device) {
        return (
            <div className="space-y-6">
                <PageHeader
                title="Device Not Found"
                subtitle="The requested device could not be found."
                actions={
                    <button
                    type="button"
                    onClick={() => navigate('/admin/devices')}
                    className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700"
                    >
                    Back
                    </button>
                }
                />
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                    No device exists for ID {deviceId}.
                </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={device.deviceName}
                subtitle="View and update scheduler device details."
                breadcrumbs={[
                    { label: 'Devices', path: '/admin/devices' },
                    { label: device.deviceName},
                ]}
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => navigate('/admin/devices')}
                            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700"
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsEditing((prev) => !prev)}
                            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                        >
                            {isEditing ? 'Cancel Edit' : 'Edit Device'}
                        </button>
                    </div>
                }
            />

            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-6">
                {!isEditing ? (
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <DetailRow label="ID" value={device.id} />
                        <DetailRow label="Device Type" value={device.deviceType || device.type} />
                        <DetailRow label="Device Name" value={device.deviceName || device.name} />
                        <DetailRow label="Polatis Name" value={device.polatis_name} />
                        <DetailRow label="IP Address" value={device.ip_address} />
                        <DetailRow label="Status" value={device.status} />
                        <DetailRow label="In Port" value={device.In_Port} />
                        <DetailRow label="Out Port" value={device.Out_Port} />
                        <DetailRow label="Maintenance Start" value={formatMaintenanceDisplay(device.maintenance_start, 'start')} />
                        <DetailRow label="Maintenance End" value={formatMaintenanceDisplay(device.maintenance_end, 'end')} />
                    </div>
                ) : (
                    <form
                        className="grid grid-cols-1 gap-4 md:grid-cols-2"
                        onSubmit={(e) => {
                            e.preventDefault();

                            const maintenanceWindow = buildMaintenanceWindow({
                                mode: form.maintenance_mode,
                                date: form.maintenance_date,
                                startDate: form.maintenance_start_date,
                                endDate: form.maintenance_end_date,
                                period: form.maintenance_period
                            });

                            if (form.status === 'Maintenance') {
                                if (!form.maintenance_period) {
                                    toast.error('Maintenance requires a time slot.');
                                    return;
                                }

                                if (form.maintenance_mode === 'single' && !form.maintenance_date) {
                                    toast.error('Single-day maintenance requires a date.');
                                    return;
                                }

                                if (form.maintenance_mode === 'multi' && (!form.maintenance_start_date || !form.maintenance_end_date)) {
                                    toast.error('Invalid maintenance window.');
                                    return;
                                }

                                if (form.maintenance_mode === 'multi' && form.maintenance_end_date < form.maintenance_start_date) {
                                    toast.error('Maintenance end date must be on or after the start date.');
                                    return;
                                }
                            }

                            const payload = {
                                deviceType: form.deviceType,
                                deviceName: form.deviceName,
                                polatis_name: form.polatis_name?.trim() ? form.polatis_name.trim() : null,
                                ip_address: form.ip_address?.trim() ? form.ip_address.trim() : null,
                                status: form.status,
                                maintenance_start: form.status === 'Maintenance' ? maintenanceWindow.start : null,
                                maintenance_end: form.status === 'Maintenance' ? maintenanceWindow.end : null,
                                Out_Port: Number(form.Out_Port),
                                In_Port: Number(form.In_Port),
                            };
                            updateMutation.mutate(payload);
                        }}
                    >
                        <div>
                            <label className="block text-sm font-medium mb-1">Device Type</label>
                            <input
                                value={form.deviceType}
                                onChange={(e) => setForm((prev) => ({ ...prev, deviceType: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Device Name</label>
                            <input
                                value={form.deviceName}
                                onChange={(e) => setForm((prev) => ({ ...prev, deviceName: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Polatis Name</label>
                            <input
                                value={form.polatis_name}
                                onChange={(e) => setForm((prev) => ({ ...prev, polatis_name: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">IP Address</label>
                            <input
                                value={form.ip_address}
                                onChange={(e) => setForm((prev) => ({ ...prev, ip_address: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">In Port</label>
                            <input
                                type="number"
                                value={form.In_Port}
                                onChange={(e) => setForm((prev) => ({ ...prev, In_Port: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Out Port</label>
                            <input
                                type="number"
                                value={form.Out_Port}
                                onChange={(e) => setForm((prev) => ({ ...prev, Out_Port: e.target.value }))}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-sm font-medium mb-1">Status</label>
                            <select
                                value={form.status}
                                onChange={(e) => {
                                    const nextStatus = e.target.value
                                    setForm((prev) => ({ 
                                        ...prev, 
                                        status: nextStatus,
                                        ...(nextStatus !== 'Maintenance'
                                            ? {
                                                maintenance_start_date: '',
                                                maintenance_start_period: '',
                                                expected_duration_hours: '',
                                            }
                                        : {}),
                                    }));
                                }}
                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                            >
                                <option value="Available">Available</option>
                                <option value="Maintenance">Maintenance</option>
                                <option value="Unavailable">Unavailable</option>
                            </select>
                        </div>

                        {form.status === 'Maintenance' && (
                            <>
                                <div className="md:col-span-2 rounded-md border border-gray-200 dark:border-gray-800 px-4 py-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <div className="text-sm font-medium">Maintenance span</div>
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                Choose single-day maintenance or switch to multi-day maintenance.
                                            </div>
                                        </div>
                                        <label className="inline-flex items-center gap-2 text-sm">
                                            <input 
                                                type="checkbox"
                                                checked={form.maintenance_mode === 'multi'}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        maintenance_mode: e.target.checked? 'multi' : 'single',
                                                    }))
                                                }
                                            />
                                            Multi-day maintenance
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Maintenance Time Slot</label>
                                    <select
                                        value={form.maintenance_period}
                                        onChange={(e) =>
                                            setForm((prev) => ({ ...prev, maintenance_period: e.target.value }))
                                        }
                                        className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                                    >
                                        <option value="">Select slot</option>
                                        <option value="7 AM - 12 PM">7 AM - 12 PM</option>
                                        <option value="12 PM - 6 PM">12 PM - 6 PM</option>
                                        <option value="6 PM - 11 PM">6 PM - 11 PM</option>
                                        <option value="All Day">All Day</option>
                                    </select>
                                </div>

                                {form.maintenance_mode === 'single' ? (
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Maintenance Date</label>
                                        <input
                                            type="date"
                                            value={form.maintenance_date}
                                            onChange={(e) => 
                                                setForm((prev) => ({ ...prev, maintenance_date: e.target.value }))
                                            }
                                            className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">Maintenance Start Date</label>
                                            <input
                                                type="date"
                                                value={form.maintenance_start_date}
                                                onChange={(e) => 
                                                    setForm((prev) => ({ ...prev, maintenance_start_date: e.target.value }))
                                                }
                                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium mb-1">Maintenance End Date</label>
                                            <input
                                                type="date"
                                                value={form.maintenance_end_date}
                                                onChange={(e) => 
                                                    setForm((prev) => ({ ...prev, maintenance_end_date: e.target.value }))
                                                }
                                                className="w-full rounded-md border border-gray-300 dark:border-gray-700 px-3 py-2 bg-white dark:bg-gray-900"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="md:col-span-2 rounded-md bg-gray-50 dark:bg-gray-900 px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                    <div>
                                        Maintenance Start: {form.maintenance_period ? (
                                            form.maintenance_mode === 'single'
                                                ? formatMaintenanceDisplay(`${form.maintenance_period}/${form.maintenance_date}`, 'start')
                                                : formatMaintenanceDisplay(`${form.maintenance_period}/${form.maintenance_start_date}`, 'start')
                                        ) : '-'}
                                    </div>
                                    <div className="mt-1">
                                        Maintenance end: {form.maintenance_period ? (
                                            form.maintenance_mode === 'single'
                                                ? formatMaintenanceDisplay(`${form.maintenance_period}/${form.maintenance_date}`, 'end')
                                                : formatMaintenanceDisplay(`${form.maintenance_period}/${form.maintenance_end_date}`, 'end')
                                        ) : '-'}
                                    </div>
                                </div>
                            </>
                        )}
                        
                        <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                            <button
                                type="submit"
                                disabled={updateMutation.isPending}
                                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                            >
                                Save Changes
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}