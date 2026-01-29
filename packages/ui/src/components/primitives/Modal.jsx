// Modal component for displaying content in an overlay
// Accepts props: isOpen (boolean), onClose (function), title (string), children (content), size (string), footer (React nodes)
// Sizes include: sm, md, lg, xl
// Closes when clicking outside the modal or on the close button
// Prevents propagation of click events inside the modal content
import React from 'react';
import clsx from 'clsx';

export default function Modal({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  size = 'md',
  footer 
}) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className={clsx(
          'bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full mx-4',
          sizeClasses[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            <button 
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={onClose}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        )}
        <div className="px-6 py-4">
          {children}
        </div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

