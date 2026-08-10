import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthModal } from '../../client/ClientV2';

function renderAuthModal(overrides = {}) {
  const props = {
    mode: 'login',
    onClose: jest.fn(),
    onSwitchMode: jest.fn(),
    onForgotPassword: jest.fn(),
    onOpenVerifyConfirm: jest.fn(),
    onOpenVerifyResend: jest.fn(),
    onBackToLogin: jest.fn(),
    onBackToResetRequest: jest.fn(),
    onBackToVerifyResend: jest.fn(),
    onLogin: jest.fn(),
    onRegister: jest.fn(),
    onRequestReset: jest.fn(),
    onConfirmReset: jest.fn(),
    onVerifyConfirm: jest.fn(),
    onVerifyResend: jest.fn(),
    initialResetToken: '',
    initialVerifyToken: '',
    initialEmail: '',
    submitting: false,
    ...overrides,
  };

  render(<AuthModal {...props} />);
  return props;
}

describe('AuthModal', () => {
  test('shows verify email action in login mode', async () => {
    const user = userEvent.setup();
    const props = renderAuthModal();

    await user.click(screen.getByRole('button', { name: /verify email/i }));

    expect(props.onOpenVerifyConfirm).toHaveBeenCalledTimes(1);
  });

  test('shows resend and sign-in actions in verify confirm mode', () => {
    renderAuthModal({ mode: 'verifyConfirm' });

    expect(screen.getByRole('button', { name: /resend code/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/verification token/i)).toBeInTheDocument();
  });
});
