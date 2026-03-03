
import React, { useState } from 'react';

const ROLE_OPTIONS = ['admin', 'approver', 'viewer'];

function validateField(name, value){
  switch (name) {
    case 'email':
      if (!value || value.trim() === '') return 'Email is required';
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) ? null : 'Enter a valid email';
    case 'role':
      return !value || value.trim() === '' ? 'Role is required' : null;
    case 'password':
      if (!value || value.trim() === '') return'Password is required';
      else if ( value.length < 8 ) return 'Password must be longer than 8 characters';
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
    ['email', 'role'].forEach((key) => {
      const err = validateField(key, form[key]);
      if (err) nextErrors[key] = err;
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
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

    if(!validateForm()){
      const firstErrorField = Object.keys(errors)[0];
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
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Invite Details</h3>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Email *</label>
            <input
              name="email"
              type="email"
              value={form.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => handleBlur('email')}
              placeholder="user@example.com"
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            />
            {touched.email && errors.email && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.email}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Handle</label>
            <input
              name="handle"
              value={form.handle || ''}
              onChange={(e) => handleChange('handle', e.target.value)}
              placeholder="optional username"
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Role *</label>
            <select
              name="role"
              value={form.role || 'Viewer'}
              onChange={(e) => handleChange('role', e.target.value)}
              onBlur={() => handleBlur('role')}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
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
            <label className="block text-sm font-medium mb-1">First name</label>
            <input
              name="firstName"
              value={form.firstName || ''}
              onChange={(e) => handleChange('firstName', e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Last name</label>
            <input
              name="lastName"
              value={form.lastName || ''}
              onChange={(e) => handleChange('lastName', e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              name="password"
              value={form.password || ''}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
              type="password"
            />
            {touched.password && errors.password && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.password}</p>
            )}
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Note</label>
            <textarea
              name="note"
              rows={3}
              value={form.note || ''}
              onChange={(e) => handleChange('note', e.target.value)}
              className="w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
            />
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || hasErrors}
          className="px-3 py-2 rounded-md bg-blue-600 text-white disabled:opacity-60"
        >
          {isSubmitting ? 'Sending…' : 'Send invite'}
        </button>
      </div>
    </form>
  );
}