"use client";

import React, { useEffect, useState } from "react";

type TopCondition = {
  condition: string;
  icd_code: string;
  icd_description?: string;
};

type Metrics = {
  total_conditions: number;
  unique_icd_codes: number;
  top_conditions: TopCondition[];
};

export default function Dashboard() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchMetrics = async () => {
      try {
        // Use a Next.js server-side proxy so the browser doesn't need direct access
        // to the backend host (useful in Codespaces / container previews).
        const res = await fetch('/api/metrics');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (mounted) setMetrics(data as Metrics);
      } catch (err: any) {
        if (mounted) setError(String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchMetrics();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

      {loading && <div>Loading metrics…</div>}
      {error && <div className="text-red-600">Error: {error}</div>}

      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded shadow-sm bg-white">
            <div className="text-sm text-gray-500">Total Conditions</div>
            <div className="text-3xl font-semibold">{metrics.total_conditions}</div>
          </div>

          <div className="p-4 border rounded shadow-sm bg-white">
            <div className="text-sm text-gray-500">Unique ICD Codes</div>
            <div className="text-3xl font-semibold">{metrics.unique_icd_codes}</div>
          </div>

          <div className="p-4 border rounded shadow-sm bg-white">
            <div className="text-sm text-gray-500">Top Conditions</div>
            <ul className="mt-2">
              {metrics.top_conditions.map((c, i) => (
                <li key={i} className="py-2">
                  <div className="font-medium">{c.condition}</div>
                  <div className="text-sm text-gray-600">{c.icd_code} — {c.icd_description}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
