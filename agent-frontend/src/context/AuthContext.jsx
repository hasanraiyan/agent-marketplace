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
          console.error('Failed to fetch profile with stored token:', error);
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
      const res = await authApi.login(credentials);
      // Backend responses are wrapped with { success, statusCode, message, data }
      const payload = res && res.data ? res.data : res;
      if (payload && payload.accessToken) {
        localStorage.setItem('accessToken', payload.accessToken);
        if (payload.refreshToken) {
          localStorage.setItem('refreshToken', payload.refreshToken);
        }
        setUser(payload.user);
        setIsAuthenticated(true);
        return { success: true };
      }
      throw new Error('Invalid login response format');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (isAuthenticated) {
        await authApi.logout();
      }
    } catch (error) {
      console.error('Logout API error:', error);
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
