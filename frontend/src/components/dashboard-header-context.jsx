"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const DEFAULT_HEADER = {
  title: null,
  description: null,
  leading: null,
  actions: null,
};

const DashboardHeaderStateContext = createContext(DEFAULT_HEADER);
const DashboardHeaderActionsContext = createContext(null);

export function DashboardHeaderProvider({ children }) {
  const [header, setHeader] = useState(DEFAULT_HEADER);

  const setHeaderConfig = useCallback((config) => {
    setHeader({ ...DEFAULT_HEADER, ...config });
  }, []);

  const clearHeaderConfig = useCallback(() => {
    setHeader(DEFAULT_HEADER);
  }, []);

  const value = useMemo(
    () => ({
      setHeaderConfig,
      clearHeaderConfig,
    }),
    [clearHeaderConfig, setHeaderConfig],
  );

  return (
    <DashboardHeaderActionsContext.Provider value={value}>
      <DashboardHeaderStateContext.Provider value={header}>
        {children}
      </DashboardHeaderStateContext.Provider>
    </DashboardHeaderActionsContext.Provider>
  );
}

export function useDashboardHeader(config, deps = []) {
  const context = useContext(DashboardHeaderActionsContext);

  useEffect(() => {
    if (!context) return undefined;
    context.setHeaderConfig(config);
    return () => context.clearHeaderConfig();
    // Pages intentionally control when the shared header refreshes through deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, ...deps]);
}

export function useDashboardHeaderState() {
  return useContext(DashboardHeaderStateContext);
}
