'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useAppStore } from '@/lib/store';

/* ════════════════════════════════════════════════════════════════
   LOGINPAGE.TSX — React conversion of login.php
   -----------------------------------------------------------------
   Faithful conversion: ALL CSS, HTML structure, and class names
   preserved exactly from the original PHP source.
   ════════════════════════════════════════════════════════════════ */

const DEMO_USER = {
  id: 'demo-001',
  username: 'cartoon_fan_42',
  email: 'demo@megaxtoon.com',
};

export default function LoginPage() {
  const { isLoggedIn, login, navigate } = useAppStore();

  // PHP: $mode = ($_GET['mode'] ?? ($_POST['mode'] ?? 'login'));
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // PHP: $error / $success
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // PHP: $_POST fields
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');

  const siteName = 'MEGAXTOON';

  // PHP: if (isLoggedIn()) { header('Location: index.php'); exit; }
  useEffect(() => {
    if (isLoggedIn) {
      navigate('home');
    }
  }, [isLoggedIn, navigate]);

  // Form submission handler
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'register') {
      // PHP: register path
      const username = formUsername.trim();
      const email = formEmail.trim();
      const password = formPassword;

      // Simulate registration validation (mirrors PHP registerUser logic)
      if (username.length < 3) {
        setError('Username must be at least 3 characters.');
        return;
      }
      if (username.length > 30) {
        setError('Username must be at most 30 characters.');
        return;
      }
      if (!email) {
        setError('Email is required.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }

      // Simulate success → auto-login
      login({ ...DEMO_USER, username, email });
      navigate('home');
    } else {
      // PHP: login path
      const email = formEmail.trim();
      const password = formPassword;

      // Simulate login with hardcoded demo user
      if (email === DEMO_USER.email && password.length >= 6) {
        login(DEMO_USER);
        navigate('home');
      } else if (!email || !password) {
        setError('Please fill in all fields.');
      } else {
        setError('Invalid email or password. Try demo@megaxtoon.com with any 6+ char password.');
      }
    }
  };

  // If already logged in, render nothing (redirect handled by useEffect)
  if (isLoggedIn) {
    return null;
  }

  return (
    <>
      {/* ALL CSS from login.php preserved exactly */}
      <style>{`
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg:#0a0a0a; --surface:#1a1a1a; --surface2:#222; --surface3:#2a2a2a;
  --border:rgba(255,255,255,0.08); --border2:rgba(255,255,255,0.16);
  --text:#e5e5e5; --text2:#a3a3a3; --text3:#666;
  --red:#e50914; --red2:rgba(229,9,20,0.15); --red3:rgba(229,9,20,0.4);
  --green:#22c55e; --green2:rgba(34,197,94,0.15);
  --r:10px;
}
html, body { height: 100%; }
.login-page-body {
  font-family: 'Outfit', -apple-system, sans-serif;
  background:
    radial-gradient(ellipse at top, #1a0606 0%, transparent 60%),
    radial-gradient(ellipse at bottom, #06151a 0%, transparent 60%),
    var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  -webkit-font-smoothing: antialiased;
}

.login-page-body .auth-card {
  width: 100%;
  max-width: 420px;
  background: linear-gradient(180deg, var(--surface) 0%, var(--surface2) 100%);
  border: 1px solid var(--border2);
  border-radius: 18px;
  padding: 36px 32px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
  position: relative;
  overflow: hidden;
}
.login-page-body .auth-card::before {
  content: '';
  position: absolute; top: -50%; left: -50%;
  width: 200%; height: 200%;
  background: radial-gradient(circle, rgba(229,9,20,0.08) 0%, transparent 40%);
  pointer-events: none;
}

.login-page-body .logo {
  font-size: 2rem;
  font-weight: 900;
  color: var(--red);
  letter-spacing: -0.04em;
  text-align: center;
  margin-bottom: 6px;
  text-shadow: 0 0 24px rgba(229,9,20,0.45);
  position: relative;
}
.login-page-body .tagline {
  text-align: center;
  color: var(--text2);
  font-size: 0.88rem;
  margin-bottom: 28px;
  position: relative;
}

.login-page-body .tabs {
  display: flex;
  background: var(--surface3);
  border-radius: var(--r);
  padding: 4px;
  margin-bottom: 24px;
  position: relative;
}
.login-page-body .tab {
  flex: 1;
  padding: 10px;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text2);
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.18s;
  font-family: inherit;
  text-decoration: none;
}
.login-page-body .tab.active {
  background: var(--red);
  color: #fff;
  box-shadow: 0 4px 12px rgba(229,9,20,0.4);
}

.login-page-body .alert {
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 500;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}
.login-page-body .alert.err {
  background: var(--red2);
  border: 1px solid var(--red3);
  color: #ff8888;
}
.login-page-body .alert.ok {
  background: var(--green2);
  border: 1px solid rgba(34,197,94,0.4);
  color: var(--green);
}

.login-page-body .field {
  margin-bottom: 14px;
  position: relative;
}
.login-page-body .field label {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--text2);
  text-transform: uppercase;
  letter-spacing: 0.07em;
  margin-bottom: 6px;
}
.login-page-body .field input {
  width: 100%;
  padding: 12px 14px;
  background: var(--surface3);
  border: 1px solid var(--border2);
  border-radius: 8px;
  color: var(--text);
  font-family: inherit;
  font-size: 0.92rem;
  outline: none;
  transition: all 0.18s;
  -webkit-appearance: none;
}
.login-page-body .field input:focus {
  border-color: var(--red);
  box-shadow: 0 0 0 3px rgba(229,9,20,0.15);
  background: var(--surface2);
}
.login-page-body .field input::placeholder { color: var(--text3); }

.login-page-body .btn {
  width: 100%;
  padding: 13px;
  background: var(--red);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-family: inherit;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s;
  margin-top: 8px;
  position: relative;
}
.login-page-body .btn:hover {
  background: #ff1a25;
  box-shadow: 0 6px 18px rgba(229,9,20,0.4);
  transform: translateY(-1px);
}
.login-page-body .btn:active { transform: translateY(0); }

.login-page-body .hint {
  text-align: center;
  font-size: 0.78rem;
  color: var(--text3);
  margin-top: 18px;
  position: relative;
}
.login-page-body .hint a { color: var(--red); text-decoration: none; cursor: pointer; }
.login-page-body .hint a:hover { text-decoration: underline; }

@media (max-width: 480px) {
  .login-page-body .auth-card { padding: 28px 22px; }
  .login-page-body .logo { font-size: 1.6rem; }
}
      `}</style>

      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      <div className="login-page-body">
        <div className="auth-card">

          <div className="logo">⚡ {siteName}</div>
          <p className="tagline">Where cartoon lovers unite</p>

          {error && (
            <div className="alert err">⚠️ {error}</div>
          )}
          {success && (
            <div className="alert ok">✓ {success}</div>
          )}

          {/* TABS */}
          <div className="tabs">
            <button
              type="button"
              className={`tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
            >
              Sign Up
            </button>
          </div>

          {mode === 'register' ? (
            <>
              {/* REGISTER */}
              <form onSubmit={handleSubmit} autoComplete="on">
                <div className="field">
                  <label>Username</label>
                  <input
                    type="text"
                    name="username"
                    placeholder="cartoon_fan_42"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    minLength={3}
                    maxLength={30}
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input
                    type="password"
                    name="password"
                    placeholder="At least 6 characters"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    minLength={6}
                    required
                    autoComplete="new-password"
                  />
                </div>
                <button type="submit" className="btn">Create Account</button>
              </form>
              <p className="hint">
                Already have an account?{' '}
                <a onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>Sign in →</a>
              </p>
            </>
          ) : (
            <>
              {/* LOGIN */}
              <form onSubmit={handleSubmit} autoComplete="on">
                <div className="field">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="field">
                  <label>Password</label>
                  <input
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <button type="submit" className="btn">Sign In</button>
              </form>
              <p className="hint">
                Don&apos;t have an account?{' '}
                <a onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>Sign up →</a>
              </p>
            </>
          )}

        </div>
      </div>
    </>
  );
}
