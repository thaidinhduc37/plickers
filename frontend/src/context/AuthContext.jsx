/**
 * src/context/AuthContext.jsx
 * Shared authentication context for the entire app.
 * This ensures all components use the same auth state.
 */
import React, { createContext, useContext } from 'react';
import { useAuth } from '../hooks/useAuth';

const AuthContext = createContext(null);

console.log('[AuthContext] Module loaded');

export function AuthProvider({ children }) {
  console.log('[AuthProvider] Rendering');
  try {
    const auth = useAuth();
    console.log('[AuthProvider] Auth state:', auth);
    return (
      <AuthContext.Provider value={auth}>
        {children}
      </AuthContext.Provider>
    );
  } catch (error) {
    console.error('[AuthProvider] Error:', error);
    throw error;
  }
}

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;