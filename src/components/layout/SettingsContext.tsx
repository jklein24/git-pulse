"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface SettingsContextValue {
  hideIndividualMetrics: boolean;
  setHideIndividualMetrics: (value: boolean) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [hideIndividualMetrics, setHideIndividualMetricsState] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.hide_individual_metrics === "true") {
          setHideIndividualMetricsState(true);
        }
      });
  }, []);

  const setHideIndividualMetrics = (value: boolean) => {
    setHideIndividualMetricsState(value);
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "hide_individual_metrics", value: String(value) }),
    });
  };

  return (
    <SettingsContext.Provider value={{ hideIndividualMetrics, setHideIndividualMetrics }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
