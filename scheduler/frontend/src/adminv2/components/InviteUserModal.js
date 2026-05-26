
import React, { useState } from 'react';

const ROLE_OPTIONS = ['admin', 'approver', 'viewer'];
const INPUT_CLASSNAME = 'w-full glass-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2';

function validateField(name, value){
  switch (name) {
    case 'email':
      if (!value || value.trim() === '') return 'Email is required';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : 'Enter a valid email';
    case 'handle':
      return !value || value.trim() === '' ? 'Username is required' : null;
    case 'discordId':
      if (!value || value.trim() === '') return 'Discord ID is required';
      return /^\d{17,20}$/.test(value.trim()) ? null : 'Enter a valid Discord ID';
    case 'role':
      return !value || value.trim() === '' ? 'Role is required' : null;
    case 'password':
      if (!value || value.trim() === '') return 'Password is required';
      if (value.length < 8) return 'Password must be at least 8 characters';
      return null;
    default:
      return null;
  }
}

export default function InviteUserModal({ onSubmit, form, setForm, onCancel, isSubmitting = false }) {
  const [ errors, setErrors ] = useState({});  
  const [ touched, setTouched ] = useState({});

  const validateForm = () => {
    const nextErrors = {};
    ['handle', 'email', 'discordId', 'role', 'password'].forEach((key) => {
      const err = validateField(key, form[key]);
      if (err) nextErrors[key] = err;
    });
    setErrors(nextErrors);
    return nextErrors;
  };

  // handles single field updates and value changes
  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    if(errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };
  // once feild is left will validate said field
  const handleBlur = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true}));
    const err = validateField(name, form[name]);
    if(err) setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const allTouched = {};
    Object.keys(form).forEach((key) => {
      allTouched[key] = true;
    });
    setTouched(allTouched);

    const nextErrors = validateForm();
    if (Object.keys(nextErrors).length > 0) {
      const firstErrorField = Object.keys(nextErrors)[0];
      if(firstErrorField) {
        const element = document.querySelector(`[name="${firstErrorField}"]`);
        if (element) element.focus();
      }
      return;
    }
    onSubmit();
  };

  const hasErrors = Object.keys(errors).length > 0;
  const showErrors = Object.keys(touched).length > 0 && hasErrors;
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {showErrors && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
          Please fix the errors below before submitting.
        </div>
      )}
      <div className="space-y-4">
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Create the account details here, then send the invite with the role you want this user to start with.
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="invite-handle">Username</label>
          <input
            id="invite-handle"
            name="handle"
            type="text"
            value={form.handle || ''}
            onChange={(e) => handleChange('handle', e.target.value)}
            onBlur={() => handleBlur('handle')}
            placeholder="username"
            className={INPUT_CLASSNAME}
            autoFocus
          />
          {touched.handle && errors.handle && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.handle}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="invite-email">Email</label>
          <input
            id="invite-email"
            name="email"
            type="email"
            value={form.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
            onBlur={() => handleBlur('email')}
            placeholder="you@example.com"
            className={INPUT_CLASSNAME}
          />
          {touched.email && errors.email && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="invite-discord-id">Discord ID</label>
          <input
            id="invite-discord-id"
            name="discordId"
            type="text"
            value={form.discordId || ''}
            onChange={(e) => handleChange('discordId', e.target.value)}
            onBlur={() => handleBlur('discordId')}
            placeholder="123456789012345678"
            className={INPUT_CLASSNAME}
          />
          {touched.discordId && errors.discordId && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.discordId}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="invite-first-name">First Name</label>
            <input
              id="invite-first-name"
              name="firstName"
              type="text"
              value={form.firstName || ''}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="First Name"
              className={INPUT_CLASSNAME}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="invite-last-name">Last Name</label>
            <input
              id="invite-last-name"
              name="lastName"
              type="text"
              value={form.lastName || ''}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder="Last Name"
              className={INPUT_CLASSNAME}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="invite-password">Password</label>
          <input
            id="invite-password"
            name="password"
            value={form.password || ''}
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={() => handleBlur('password')}
            className={INPUT_CLASSNAME}
            type="password"
          />
          {touched.password && errors.password && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.password}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="invite-role">Role</label>
          <select
            id="invite-role"
            name="role"
            value={form.role || 'viewer'}
            onChange={(e) => handleChange('role', e.target.value)}
            onBlur={() => handleBlur('role')}
            className={INPUT_CLASSNAME}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          {touched.role && errors.role && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.role}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="invite-note">Note</label>
          <textarea
            id="invite-note"
            name="note"
            rows={3}
            value={form.note || ''}
            onChange={(e) => handleChange('note', e.target.value)}
            placeholder="Optional context for the invite"
            className={INPUT_CLASSNAME}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="glass-button px-4 py-2 rounded-md text-sm font-semibold uppercase tracking-wide disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Sending…' : 'Send invite'}
        </button>
      </div>
    </form>
  );
}
