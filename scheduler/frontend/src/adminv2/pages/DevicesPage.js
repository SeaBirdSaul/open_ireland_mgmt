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

export default function DevicesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToastContext();
  const queryClient = useQueryClient();
  const { permissions } = useAdminContext();

  const navigate = useNavigate();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkStatusOpen, setIsBulkStatusOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');

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
    mutationFn: ({ status }) =>
      updateDeviceStatus({ device_ids: Array.from(selection.state.ids), status }),
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

      {isBulkStatusOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
          <div className='w-full max-w-md rounded-xl bg-white dark:bg-gray-900 p-6 shadow-xl'>
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

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsBulkStatusOpen(false);
                  setBulkStatus('');
                }}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!bulkStatus || statusMutation.isPending}
                onClick={() => {
                  statusMutation.mutate(
                    { status: bulkStatus },
                    {
                      onSuccess: async () => {
                        toast.success('Device status updated.');
                        await queryClient.invalidateQueries({ queryKey: ['admin-devices'] });
                        selection.clear();
                        setIsBulkStatusOpen(false);
                        setBulkStatus('');
                      },
                      onError: (err) => {
                        toast.error(err?.message || 'Unable to update device status.');
                      },
                    }
                  );
                }}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Update Devices
                </button>
            </div>
          </div>
        </div>
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

