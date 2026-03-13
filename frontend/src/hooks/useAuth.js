import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

/**
 * Custom hook for authentication state management
 * @returns {Object} Auth state and methods
 */

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigateRef = useRef(null);
  const navigate = useNavigate();

  // Store navigate in ref to avoid calling hooks at the wrong time
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Check auth status on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = useCallback(async () => {
    // Skip check if user explicitly logged out (stored in localStorage)
    if (localStorage.getItem("rcv_logged_out") === "true") {
      setLoading(false);
      return;
    }

    // On /scanner: do NOT call /api/auth/me — just check if token exists in localStorage
    // This prevents redirect to /login when token expires during a long scanning session
    const onScanner = window.location.pathname === "/scanner";
    const token = localStorage.getItem("rcv_token");

    if (onScanner) {
      // On scanner: if token exists, consider user as authenticated (don't verify with backend)
      // This allows scanner to keep running even if token expires
      if (token) {
        setUser({ username: "scanner_user", auto_login: true });
      } else {
        setUser(null);
      }
      setLoading(false);
      return;
    }

    try {
      const response = await api.get("/api/auth/me");
      if (response.ok) {
        const data = await response.json();
        if (data && data.username) {
          setUser({ username: data.username, auto_login: data.auto_login });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      // Token invalid or not present
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(
    async (username, password) => {
      try {
        setError(null);
        // Clear logout flag to allow re-login
        localStorage.removeItem("rcv_logged_out");
        const response = await api.post("/api/auth/login", {
          username,
          password,
        });

        if (response.ok) {
          const data = await response.json();
          // Save the token from login response
          if (data.access_token) {
            api.setToken(data.access_token);
          }
          await checkAuth();
          return data;
        }

        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Login failed: No token received");
      } catch (err) {
        const message = err.message || "Login failed";
        setError(message);
        throw new Error(message);
      }
    },
    [checkAuth],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (err) {
      // Ignore logout errors
      console.warn("Logout error:", err);
    } finally {
      // Mark as logged out to prevent re-authentication
      localStorage.setItem("rcv_logged_out", "true");
      // Clear local state regardless of API response
      setUser(null);
      api.logout(); // Clear token from API client
    }
  }, []);

  return {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    checkAuth,
    navigate: () => navigateRef.current,
  };
}

export default useAuth;
