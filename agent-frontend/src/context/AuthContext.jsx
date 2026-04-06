/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../lib/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const res = await authApi.getProfile();
          if (res && res.data) {
            setUser(res.data);
            setIsAuthenticated(true);
          } else {
            // Profile fetch didn't return expected data, maybe token is invalid
            handleLogoutState();
          }
        } catch (error) {
          console.error("Failed to fetch profile with stored token:", error);
          handleLogoutState();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const handleLogoutState = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setIsAuthenticated(false);
  };

  const login = async (credentials) => {
    try {
      const resp = await authApi.login(credentials);
      // Backend wraps the payload under `data` (successFormatter.formatSuccess)
      const data = resp && resp.data ? resp.data : resp;
      if (data && data.accessToken) {
        localStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        // Normalize backend `user` shape: split `name` into firstName/lastName when needed
        const user = data.user || null;
        let normalizedUser = user;
        if (user) {
          const hasFirst = user.firstName || user.lastName;
          if (!hasFirst && user.name) {
            const parts = user.name.trim().split(/\s+/);
            normalizedUser = {
              ...user,
              firstName: parts[0] || null,
              lastName: parts.length > 1 ? parts.slice(1).join(' ') : null,
            };
          }
        }
        setUser(normalizedUser);
        setIsAuthenticated(true);
        return { success: true };
      } else {
        throw new Error('Invalid login response format');
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (isAuthenticated) {
        await authApi.logout();
      }
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      handleLogoutState();
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
