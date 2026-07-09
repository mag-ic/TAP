import React, { useState } from 'react';

const USERS = [
  { email: 'ali@tap.com', password: '123456', name: 'Ali', role: 'admin' },
  { email: 'tarik@tap.com', password: '123456', name: 'Tarik', role: 'viewer' }
];

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const user = USERS.find(
        u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password
      );

      if (user) {
        onLogin(user);
      } else {
        setError('Email ou mot de passe incorrect');
        setLoading(false);
      }
    }, 600);
  };

  return (
    <div style={styles.wrapper}>
      {/* Animated background */}
      <div style={styles.bgGlow1} />
      <div style={styles.bgGlow2} />

      <div style={styles.card}>
        {/* Logo */}
        <div style={styles.logoContainer}>
          <div style={styles.logo}>
            <span style={styles.logoText}>TP</span>
          </div>
          <h1 style={styles.title}>TRADING PARTNERSHIPS</h1>
          <p style={styles.subtitle}>Système de Gestion Intégré</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Adresse e-mail</label>
            <div style={styles.inputWrapper}>
              <svg style={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemple@tap.com"
                required
                style={styles.input}
                autoComplete="email"
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Mot de passe</label>
            <div style={styles.inputWrapper}>
              <svg style={styles.inputIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
                style={styles.input}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div style={styles.error}>
              <svg style={{ width: 16, height: 16, flexShrink: 0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" x2="9" y1="9" y2="15" />
                <line x1="9" x2="15" y1="9" y2="15" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (
              <div style={styles.spinner} />
            ) : (
              <>
                <svg style={{ width: 18, height: 18 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                  <polyline points="10 17 15 12 10 7" />
                  <line x1="15" x2="3" y1="12" y2="12" />
                </svg>
                Se Connecter
              </>
            )}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.footerText}>© 2026 Trading Partnerships S.A.R.L</p>
        </div>
      </div>

      <style>{`
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.15); }
          66% { transform: translate(25px, -40px) scale(0.85); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .login-input:focus {
          border-color: #3b82f6 !important;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15) !important;
          outline: none;
        }
        .login-btn:hover {
          background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%) !important;
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(59, 130, 246, 0.35) !important;
        }
        .login-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000000',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif"
  },
  bgGlow1: {
    position: 'absolute',
    top: '-20%',
    left: '-10%',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(59, 130, 246, 0.12) 0%, transparent 70%)',
    animation: 'float1 15s ease-in-out infinite',
    pointerEvents: 'none'
  },
  bgGlow2: {
    position: 'absolute',
    bottom: '-15%',
    right: '-5%',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(124, 58, 237, 0.1) 0%, transparent 70%)',
    animation: 'float2 18s ease-in-out infinite',
    pointerEvents: 'none'
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: '420px',
    padding: '48px 40px',
    borderRadius: '24px',
    background: 'linear-gradient(145deg, rgba(15, 15, 20, 0.95) 0%, rgba(10, 10, 15, 0.98) 100%)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    boxShadow: '0 25px 80px rgba(0, 0, 0, 0.6), 0 0 120px rgba(59, 130, 246, 0.04)',
    backdropFilter: 'blur(20px)'
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '36px'
  },
  logo: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 8px 30px rgba(59, 130, 246, 0.25)'
  },
  logoText: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '800',
    letterSpacing: '1px'
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: '2px',
    margin: '0 0 6px 0'
  },
  subtitle: {
    fontSize: '13px',
    color: '#64748b',
    margin: 0,
    fontWeight: '400'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: '0.5px',
    textTransform: 'uppercase'
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    width: '18px',
    height: '18px',
    color: '#475569',
    pointerEvents: 'none'
  },
  input: {
    width: '100%',
    padding: '14px 14px 14px 44px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(255, 255, 255, 0.04)',
    color: '#f1f5f9',
    fontSize: '14px',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    outline: 'none',
    boxSizing: 'border-box',
    className: 'login-input'
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 14px',
    borderRadius: '10px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    color: '#f87171',
    fontSize: '13px',
    fontWeight: '500'
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '14px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '600',
    fontFamily: 'inherit',
    letterSpacing: '0.5px',
    transition: 'all 0.25s ease',
    boxShadow: '0 4px 15px rgba(59, 130, 246, 0.25)',
    marginTop: '4px'
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    borderTopColor: '#ffffff',
    borderRadius: '50%',
    animation: 'spin 0.6s linear infinite'
  },
  footer: {
    marginTop: '28px',
    textAlign: 'center'
  },
  footerText: {
    fontSize: '11px',
    color: '#334155',
    margin: 0
  }
};
