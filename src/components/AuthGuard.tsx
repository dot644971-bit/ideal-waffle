// ============================================================
// components/AuthGuard.tsx — Cross-Domain Authentication Guard
// ============================================================
// Wrap any page component with <AuthGuard> to require authentication.
// If the user is not logged in, they are redirected to auth.megaxtoon.eu.
// During loading, a full-screen spinner is shown.
//
// Usage:
//   export default function MyPage() {
//     return (
//       <AuthGuard>
//         <MyPageContent />
//       </AuthGuard>
//     );
//   }
//
// Or use useAuth() hook directly for more control:
//   const { isAuthenticated, isLoading, login, user, logout } = useAuth();
//   if (isLoading) return <LoadingScreen />;
//   if (!isAuthenticated) return null;
// ============================================================

'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { isAuthenticated, isLoading, login } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Small delay so the loading screen is visible briefly before redirect
      const timer = setTimeout(() => {
        login();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, login]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoadingScreen message="Redirecting to login..." />;
  }

  return <>{children}</>;
}

function LoadingScreen({ message }: { message?: string }) {
  return (
    <div style={styles.container}>
      <style>{`
        @keyframes mx-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={styles.card}>
        <div style={styles.spinner} />
        <p style={styles.text}>{message || 'Loading...'}</p>
        <p style={styles.subtext}>MEGAXTOON</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#0a0a0a',
    color: '#e5e5e5',
    fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    padding: 0,
  },
  card: {
    textAlign: 'center' as const,
  },
  spinner: {
    width: 40,
    height: 40,
    margin: '0 auto 20px',
    border: '3px solid rgba(229, 9, 20, 0.2)',
    borderTopColor: '#e50914',
    borderRadius: '50%',
    animation: 'mx-spin 0.8s linear infinite',
  },
  text: {
    fontSize: '0.95rem',
    color: '#a3a3a3',
    margin: '0 0 8px',
  },
  subtext: {
    fontSize: '0.78rem',
    color: '#666',
    margin: 0,
    letterSpacing: '0.08em',
    fontWeight: 600 as const,
  },
};
