// Spinner component to indicate loading state
// Accepts props: size (string: 'sm', 'md', 'lg'), className (string)
import React from 'react';

export default function Spinner({ size = 'md', className }) {
  return (
    <div className={`spinner spinner-${size} ${className || ''}`} role="status" aria-label="Loading">
      <span className="sr-only">Loading...</span>
    </div>
  );
}

