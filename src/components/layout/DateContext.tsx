"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface DateRange {
  startDate: number;
  endDate: number;
  setRange: (start: number, end: number) => void;
}

const DateContext = createContext<DateRange | null>(null);

export function DateProvider({ children }: { children: ReactNode }) {
  const now = Math.floor(Date.now() / 1000);
  const [startDate, setStart] = useState(now - 30 * 86400);
  const [endDate, setEnd] = useState(now);

  const setRange = (start: number, end: number) => {
    setStart(start);
    setEnd(end);
  };

  return (
    <DateContext.Provider value={{ startDate, endDate, setRange }}>
      {children}
    </DateContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateContext);
  if (!ctx) throw new Error("useDateRange must be used within DateProvider");
  return ctx;
}
