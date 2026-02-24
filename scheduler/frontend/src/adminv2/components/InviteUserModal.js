

export default function InviteUserModal({ isOpen, onClose, onSubmit, form, setForm, submitting }) {
    if (!isOpen) return null;

    return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-900 p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Invite user</h2>
        <p className="text-sm text-gray-500 mt-1">Create an invitation with role and profile details.</p>

        <form
          className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {/* email, handle, role, firstName, lastName, department, note inputs */}
          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-md border">Cancel</button>
            <button type="submit" disabled={submitting} className="px-3 py-2 rounded-md bg-blue-600 text-white">
              {submitting ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
    );
}