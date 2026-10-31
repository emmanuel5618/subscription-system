"use client";

import { useEffect, useState } from "react";

export default function FinancePage() {
  const [summary, setSummary] = useState<any>(null);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/system", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "financeSummary" })
    });

    const data = await res.json();
    setSummary(data.summary ?? null);
    setError(data.error ?? "");
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="container">
      <div className="card">
        <h1>Finance Dashboard</h1>
        <button onClick={load}>Refresh</button>
        <p>{error}</p>
        <pre>{JSON.stringify(summary, null, 2)}</pre>
      </div>
    </main>
  );
}