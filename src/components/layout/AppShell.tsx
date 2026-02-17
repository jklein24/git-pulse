"use client";

import Sidebar from "./Sidebar";
import Header from "./Header";
import { DateProvider, useDateRange } from "./DateContext";

function AppShellInner({ children }: { children: React.ReactNode }) {
  const { startDate, endDate, setRange } = useDateRange();

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header startDate={startDate} endDate={endDate} onDateChange={setRange} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <DateProvider>
      <AppShellInner>{children}</AppShellInner>
    </DateProvider>
  );
}
