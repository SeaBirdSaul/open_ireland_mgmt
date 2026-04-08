/**
 * Handles user authentication including login, registration, and sign out.
 * Includes enhanced error handling for network issues and timeouts.
 */
import React, { useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';

import showPasswordIcon from '../image/show.png';
import hidePasswordIcon from '../image/hide.png';
import { API_BASE_URL } from '../config/api';

export default function LoginRegisterPopup({
    show,
    onClose,
    userName,
    onLoginSuccess,
    onSignOutSuccess
}) {
    const [mode, setMode] = useState('login');
    const [prefillToken, setPrefillToken] = useState('');

    useEffect(() => {
        if (show && !userName) {
            const token = new URLSearchParams(window.location.search).get('reset_token') || '';
            if (token){
                setMode('forgotConfirm');
                setPrefillToken(token);
            } else {
                setMode('login');
                setPrefillToken('');
            }
        }
    }, [show, userName]);

    const switchMode = () => {
        setMode(prev => (prev === 'login' ? 'register' : 'login'));
    };

    // ===================== Handle User Login =====================
    const handleLogin = async (username, password, retryCount = 0) => {
        if (!username || !password) {
            alert('Please enter username and password');
            return;
        }
        try {
            const hashedPassword = CryptoJS.SHA256(password).toString();
            
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
            
            let res;
            try {
                res = await fetch(`${API_BASE_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password: hashedPassword }),
                    credentials: 'include',
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
            } catch (fetchError) {
                clearTimeout(timeoutId);
                
                // Handle network errors with retry
                if (
                    (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') &&
                    retryCount < 2
                ) {
                    // Retry on timeout with exponential backoff
                    await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                    return handleLogin(username, password, retryCount + 1);
                }
                
                // Network error or timeout
                if (fetchError.name === 'AbortError' || fetchError.name === 'TimeoutError') {
                    throw new Error('Connection timeout. Please check your network connection and try again.');
                }
                
                // Other network errors (CORS, DNS, etc.)
                if (fetchError.message?.includes('fetch') || fetchError.message?.includes('network')) {
                    throw new Error('Unable to connect to server. Please check that the backend is running and try again.');
                }
                
                throw fetchError;
            }
            
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Login failed');
            }
            const data = await res.json();
            onLoginSuccess(username, data.user_id);
            onClose();
            alert(data.message);
        } catch (err) {
            // Provide more helpful error messages
            let errorMessage = err.message || 'Unable to sign in.';
            
            // Check if it's a network-related error
            if (
                errorMessage.includes('fetch') ||
                errorMessage.includes('network') ||
                errorMessage.includes('Failed to fetch')
            ) {
                errorMessage = 'Unable to connect to server. Please check that the backend is running and try again.';
            }
            
            alert(errorMessage);
        }
    };

    // ===================== Handle User Register =====================
    const handleRegister = async (username, email, firstName, lastName, pass1, pass2, discordId) => {
        if (!username || !email || !firstName || !lastName || !pass1 || !pass2 || !discordId) {
            alert('All fields are required');
            return;
        }
        if (pass1.length < 8) {
            alert('Password must be at least 8 characters');
            return;
        }
        if (pass1 !== pass2) {
            alert('Passwords do not match');
            return;
        }
        if (!/^\d{17,18}$/.test(discordId)) {
            alert('Discord ID must be a 17 or 18 digit number');
            return;
        }

        try {
            const hashedPass1 = CryptoJS.SHA256(pass1).toString();
            const hashedPass2 = CryptoJS.SHA256(pass2).toString();
            const res = await fetch(`${API_BASE_URL}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    email,
                    firstName,
                    lastName,
                    password: hashedPass1,
                    password2: hashedPass2,
                    discord_id: discordId
                }),
                credentials: 'include'
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Register failed');
            }
            const data = await res.json();
            onLoginSuccess(data.username, data.id);
            onClose();
            alert('Register successfully');
        } catch (err) {
            alert(err.message || 'Register failed');
        }
    };

    const handlePasswordResetRequest = async (email) => {
        if (!email) {
            alert('Email is required');
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/auth/password-reset/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
                credentials: 'include',
            });

            if (!res.ok && res.status!== 202) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || 'Unable to request password reset.');
            }

            alert('If the account exists, a reset link has been sent.');
            setMode('forgotConfirm');
        } catch (err) {
            alert(err.message || 'Unable to request password reset');
        }
    };

    const handlePasswordResetConfirm = async (token, pass1, pass2) => {
        if (!token || !pass1 || !pass2){
            alert('All fields are required');
            return;
        }
        if (pass1.length < 8){
            alert('Password must be at least 8 characters');
            return;
        }
        if (pass1 !== pass2){
            alert('Passwords do not match');
            return;
        }

        try{
            const hashedPass1 = CryptoJS.SHA256(pass1).toString();
            const hashedPass2 = CryptoJS.SHA256(pass2).toString();

            const res = await fetch(`${API_BASE_URL}/auth/password-reset/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.toString({
                    token,
                    new_password: hashedPass1,
                    new_password2: hashedPass2,
                }),
                credentials: 'include',
            });

            if (!res.ok) {
                const errData = await res.join().catch(() => ({}));
                throw new Error(errData.detail || 'Unable to reset password');
            }
            
            const data = await res.json();
            alert(data.message || 'Password reset successful');
            setMode('login');
            setPrefillToken('');
        } catch (err) {
            alert(err.message || 'Unable to reset password');
        }
    };

    // ===================== User Logout =====================
    const handleSignOut = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/logout`, {
                method: 'POST',
                credentials: 'include'
            });
            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.detail || 'Logout failed');
            }
            const data = await res.json();
            onSignOutSuccess();
            onClose();
            alert(data.message || 'Signed out successfully');
        } catch (err) {
            alert(err.message);
        }
    };

    if (!show) return null;

    if (userName) {
        return (
            <div className="popup-overlay" onClick={onClose}>
                <div className="popup-panel">
                    <SignOutPanel onSignOut={handleSignOut} />
                </div>
            </div>
        );
    }

    return (
        <div className="popup-overlay" onClick={onClose}>
            <div className="popup-panel" onClick={e => e.stopPropagation()}>
                {mode === 'login' && (
                    <LoginForm onSwitch={switchMode} onLogin={handleLogin} onForgot={() => setMode('forgotRequest')} />
                )}
                {mode === 'register' && (
                    <RegisterForm onSwitch={switchMode} onRegister={handleRegister} />
                )}
                {mode === 'forgotRequest' && (
                    <ForgotPasswordRequestForm
                        onSubmit={handlePasswordResetRequest}
                        onBackToLogin={() => setMode('login')}
                    />
                )}
                {mode == 'forgotConfirm' && (
                    <ForgotPasswordConfirmForm
                        initialToken={prefillToken}
                        onSubmit={handlePasswordResetConfirm}
                        onBackToRequest={() => setMode('forgotRequest')}
                        onBackToLogin={() => setMode('login')}
                    />
                )}
            </div>
        </div>
    );
}

// Login page
function LoginForm({ onSwitch, onLogin, onForgot }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    return (
        <div>
            <div className="popup-title">User name:</div>
            <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
            />

            <div className="popup-title">Password:</div>
            <div className="password-container">
                <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                />
                <img
                    className="toggle-password-icon"
                    src={showPassword ? hidePasswordIcon : showPasswordIcon}
                    alt="toggle password"
                    onClick={() => setShowPassword(!showPassword)}
                />
            </div>

            <button onClick={() => onLogin(username, password)}>Sign in</button>
            <div className='switch-link' onClick={onForgot}>Forgot Password?</div>
            <div className="switch-link" onClick={onSwitch}>
                No account? Please Register
            </div>
        </div>
    );
}

// Register page
function RegisterForm({ onSwitch, onRegister }) {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [pass1, setPass1] = useState('');
    const [pass2, setPass2] = useState('');
    const [showPassword1, setShowPassword1] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    const [discordId, setDiscordId] = useState("");

    return (
        <div>
            <div className='popup-title'>First Name</div>
            <input 
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
            />

            <div className='popup-title'>Last Name</div>
            <input 
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
            />

            <div className="popup-title">User Name:</div>
            <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
            />

            <div className="popup-title">Email:</div>
            <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@domain.com"
            />

            <div className="popup-title">Discord ID:</div>
            <input
                type="text"
                value={discordId}
                onChange={e => setDiscordId(e.target.value)}
                placeholder="123456789012345678"
            />


            <div className="popup-title">Password:</div>
            <div className="password-container">
                <input
                    type={showPassword1 ? 'text' : 'password'}
                    value={pass1}
                    onChange={e => setPass1(e.target.value)}
                />
                <img
                    className="toggle-password-icon"
                    src={showPassword1 ? hidePasswordIcon : showPasswordIcon}
                    alt="toggle password 1"
                    onClick={() => setShowPassword1(!showPassword1)}
                />
            </div>

            <div className="popup-title">Confirm Password:</div>
            <div className="password-container">
                <input
                    type={showPassword2 ? 'text' : 'password'}
                    value={pass2}
                    onChange={e => setPass2(e.target.value)}
                />
                <img
                    className="toggle-password-icon"
                    src={showPassword2 ? hidePasswordIcon : showPasswordIcon}
                    alt="toggle password 2"
                    onClick={() => setShowPassword2(!showPassword2)}
                />
            </div>

            <button onClick={() => onRegister(username, email, firstName, lastName, pass1, pass2, discordId)}>Complete</button>
            <div className="switch-link" onClick={onSwitch}>
                Already have an account? Please Sign in
            </div>
        </div>
    );
}

function ForgotPasswordConfirmForm({ initialToken, onSubmit, onBackToRequest, onBackToLogin }) {
    const [token, setToken] = useState(initialToken || '');
    const [pass1, setPass1] = useState('');
    const [pass2, setPass2] = useState('');
    const [showPassword1, setShowPassword1] = useState(false);
    const [showPassword2, setShowPassword2] = useState(false);
    
    return (
        <div>
        <div className="popup-title">Complete Reset</div>

        <div className="popup-title">Reset Token:</div>
        <input
            type="text"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="Paste reset token"
        />

        <div className="popup-title">New Password:</div>
        <div className="password-container">
            <input
            type={showPassword1 ? 'text' : 'password'}
            value={pass1}
            onChange={e => setPass1(e.target.value)}
            />
            <img
            className="toggle-password-icon"
            src={showPassword1 ? hidePasswordIcon : showPasswordIcon}
            alt="toggle password 1"
            onClick={() => setShowPassword1(!showPassword1)}
            />
        </div>

        <div className="popup-title">Confirm New Password:</div>
        <div className="password-container">
            <input
            type={showPassword2 ? 'text' : 'password'}
            value={pass2}
            onChange={e => setPass2(e.target.value)}
            />
            <img
            className="toggle-password-icon"
            src={showPassword2 ? hidePasswordIcon : showPasswordIcon}
            alt="toggle password 2"
            onClick={() => setShowPassword2(!showPassword2)}
            />
        </div>

        <button onClick={() => onSubmit(token, pass1, pass2)}>Reset password</button>
        <div className="switch-link" onClick={onBackToRequest}>Need a new reset email?</div>
        <div className="switch-link" onClick={onBackToLogin}>Back to Sign in</div>
        </div>
    );
}

function SignOutPanel({ onSignOut }) {
    return (
        <div>
            <div style={{ marginBottom: '10px' }}>Sign out?</div>
            <button onClick={onSignOut}>Sign out</button>
        </div>
    );
}