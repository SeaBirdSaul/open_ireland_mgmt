/**
 * UsersPage component for admin interface.
 * Displays and manages users with filtering, bulk actions, and role assignments.
 * Integrates with AdminContext for permissions and toast notifications.
 * Implements bulk selection of users for efficient management.
 * Supports inviting new users and updating user roles and statuses.
 */
import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { fetchUsers, inviteUser, updateUserRole, updateUserStatus, fetchInvitations, approveInvitation, rejectInvitation, deleteUser } from '../api';
import DataTable from '../components/DataTable';
import FilterBar from '../components/FilterBar';
import { useToastContext } from '../../contexts/ToastContext';
import { useAdminContext } from '../context/AdminContext';
import { canEditUsers } from '../utils/permissions';
import useBulkSelection from '../hooks/useBulkSelection';
import InviteUserModal from '../components/InviteUserModal';
import Modal from '../../admin/components/Modal';

const ROLE_TABS = [
  { key: '', label: 'All users' },
  { key: 'Admin', label: 'Admins' },
  { key: 'Approver', label: 'Approvers' },
  { key: 'Viewer', label: 'Viewers' },
];

const emptyInviteForm = {
  email: '',
  handle: '',
  role: 'Viewer',
  firstName: '',
  lastName: '',
  password: '',
  note: '',
};

export default function UsersPage() {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);

  const [searchParams, setSearchParams] = useSearchParams();
  const toast = useToastContext();
  const queryClient = useQueryClient();
  const { permissions, role: roleSession } = useAdminContext();
  const isSuperAdmin = String(roleSession || '').toLowerCase() === 'super admin';

  const roleFilter = searchParams.get('role') || undefined;
  const status = searchParams.get('status') || undefined;

  const view = searchParams.get('view') || 'users';
  const invitationStatus = searchParams.get('invStatus') || undefined;
  
  const usersQuery = useQuery({
    queryKey: ['admin-users', { roleFilter, status }],
    queryFn: () => fetchUsers({ roll: roleFilter, status }),
    keepPreviousData: true,
  });

  const selection = useBulkSelection(usersQuery.data?.items || [], (row) => row.id);

  const inviteMutation = useMutation({
    mutationFn: (payload) => inviteUser(payload),
    onSuccess: async () => {
      toast.success('Invitation created.');
      setIsInviteOpen(false);
      setInviteForm(emptyInviteForm);
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err?.message || 'Unable to send invitation.'),
  });

  const handleInviteSubmit = () => {
    inviteMutation.mutate({
      email: inviteForm.email.trim(),
      handle: inviteForm.handle.trim() || undefined,
      role: inviteForm.role,
      firstName: inviteForm.firstName.trim(),
      lastName: inviteForm.lastName.trim(),
      password: inviteForm.password,
      notes: inviteForm.note?.trim() || undefined,
    });
  };

  const roleMutation = useMutation({
    mutationFn: ({ userId, newRole }) => updateUserRole(userId, { role: newRole }),
    onSuccess: async () => {
      toast.success('Role updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err?.message || 'Unable to update role.'),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, nextStatus }) => updateUserStatus(userId, { status: nextStatus }),
    onSuccess: async () => {
      toast.success('Status updated.');
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err?.message || 'Unable to update status.'),
  });

  const invitationQuery = useQuery({
    queryKey: ['admin-invitations', { invitationStatus }],
    queryFn: () => fetchInvitations({ status: invitationStatus }),
    enabled: view === 'invitations',
    keepPreviousData: true,
  });

  const approveInviteMutation = useMutation({
    mutationFn: (invitationId) => approveInvitation(invitationId),
    onSuccess: async () => {
      toast.success('Invitation approved.');
      await queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err) => toast.error(err?.message || 'Unable to approve invitation.'),
  });

  const rejectInviteMutation = useMutation({
    mutationFn: (invitationId) => rejectInvitation(invitationId),
    onSuccess: async () => {
      toast.success('Invitation rejected.');
      await queryClient.invalidateQueries({ queryKey: ['admin-invitations'] });
    },
    onError: (err) => toast.error(err?.message || 'Unable to reject invitation.'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId) => deleteUser(userId),
    onSuccess: async () => {
      toast.success('User deleted.');
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      selection.clear()
    },
    onError: (err) => toast.error(err?.message || 'Unable to delete user.'),
  });

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        render: (row) => (
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100">{row.username}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{row.email || 'No email'}</div>
          </div>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        render: (row) => (
          <span className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
            {row.role}
          </span>
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
        key: 'bookings',
        header: 'Bookings',
        accessor: (row) => row.bookings_count,
      },
      {
        key: 'last_active',
        header: 'Last active',
        render: (row) => (row.last_active ? new Date(row.last_active).toLocaleString() : '—'),
      },
    ],
    []
  );

  const invitationColumns = useMemo(() => [
    {
      key: 'email',
      header: 'Email',
      accessor: (row) => row.email
    },
    {
      key: 'name',
      header: 'Name',
      accessor: (row) => `${row.firstName} ${row.lastName}`.trim() || '-'
    },
    {
      key: 'handle',
      header: 'Handle',
      accessor: (row) => row.handle || '-'
    },
    {
      key: 'role',
      header: 'Role',
      accessor: (row) => row.role
    },
    {
      key: 'inviter',
      header: 'Invited by',
      accessor: (row) => row.inviter_username || '-'
    },
    {
      key: 'expires_at',
      header: 'Expires',
      render: (row) => (row.expires_at ? new Date(row.expires_at).toLocaleString() : '-'),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (row) => row.status,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => row.status === 'pending' ? (
        <div className='flex gap-2'>
          <button type="button" className='px-2 py-1 rounded bg-green-600 text-white text-xs'
            onClick={() => approveInviteMutation.mutate(row.id)}>
              Approve
          </button>
          <button type="button" className='px-2 py-1 rounded border text-xs'
            onClick={() => rejectInviteMutation.mutate(row.id)}>
              Reject
          </button>
        </div>
      ) : '-',
    },
  ], [approveInviteMutation, rejectInviteMutation]);

  const filterChips = useMemo(() => {
    const chips = [];
    ROLE_TABS.forEach((tab) => {
      const isActive = (roleFilter || '') === tab.key;
      chips.push({
        key: `role-${tab.key || 'all'}`,
        label: tab.label,
        active: isActive,
        onRemove: () => {
          const next = new URLSearchParams(searchParams);
          if (isActive) {
            next.delete('role');
          } else if (tab.key) {
            next.set('role', tab.key);
          } else {
            next.delete('role');
          }
          setSearchParams(next, { replace: true });
        },
      });
    });
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
    return chips;
  }, [roleFilter, status, searchParams, setSearchParams]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users & roles</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage admin access, approvals, and visibility.
          </p>
        </div>
        {canEditUsers(permissions) && (
          <button
            type="button"
            onClick={() => 
              setIsInviteOpen(true)
            }
            className="px-3 py-2 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
          >
            Invite user
          </button>
        )}
      </div>

      <FilterBar
        filters={filterChips}
        onReset={() => setSearchParams(new URLSearchParams(), { replace: true })}
      />

      <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-700 overflow-hidden">
        <button
          type="button"
          className={`px-3 py-1.5 text-sm ${view === 'users' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900'}`}
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set('view', 'users');
            next.delete('invStatus');
            setSearchParams(next, { replace: true });
          }}
        >
          Users
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-sm ${view === 'invitations' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900'}`}
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set('view', 'invitations');
            setSearchParams(next, { replace: true });
          }}
        >
          Invitations
        </button>
      </div>
      
      {view === 'users' && (
        <DataTable
          rows={usersQuery.data?.items || []}
          columns={columns}
          selection={canEditUsers(permissions) ? selection : null}
          bulkActions={
            canEditUsers(permissions)
              ? () => (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const roleInput = window.prompt('Set role for selected users: (viewer/admin)', 'viewer');
                        if (!roleInput) return;
                        Array.from(selection.state.ids).forEach((userId) =>
                          roleMutation.mutate({ userId, newRole: roleInput })
                        );
                        selection.clear();
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Set role
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextStatus = window.prompt('Set status (active/disabled):', 'active');
                        if (!nextStatus) return;
                        Array.from(selection.state.ids).forEach((userId) =>
                          statusMutation.mutate({ userId, nextStatus })
                        );
                        selection.clear();
                      }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-md border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      Set status
                    </button>
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          const ids = Array.from(selection.state.ids);
                          if (ids.length !== 1){
                            toast.error('Select exactly one user to delete.');
                            return;
                          }
                          const confirmed = window.confirm('Delete this user permanently? This cannot be undone.');
                          if (!confirmed) return;
                          deleteUserMutation.mutate(ids[0]);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700"
                      >
                        Delete user
                      </button>
                    )}
                  </div>
                )
              : null
          }
          loading={usersQuery.status === 'pending'}
        />
      )}
      {view === 'invitations' && (
        <DataTable
          rows={invitationQuery.data?.items || []}
          columns={invitationColumns}
          loading={invitationQuery.status === 'pending'}
        />
      )}
        <Modal isOpen={isInviteOpen} 
        onClose={() => {
          setIsInviteOpen(false);
          setInviteForm(emptyInviteForm);
        }} 
        title="Invite User" 
        size="lg">
          <InviteUserModal
            form={inviteForm}
            setForm={setInviteForm}
            onSubmit={handleInviteSubmit}
            onCancel={() => {
              setIsInviteOpen(false);
              setInviteForm(emptyInviteForm);
            }}
            isSubmitting={inviteMutation.status === 'pending'}
          />
        </Modal>
    </div>
  );
}
