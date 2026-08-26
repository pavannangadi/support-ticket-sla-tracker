import { useState, useEffect } from 'react';
import { graphqlRequest, ApiError } from '../api/client';
import type { TicketDashboard } from '../api/types';

const DASHBOARD_QUERY = `
  query Dashboard {
    dashboard {
      openTickets
      inProgressTickets
      atRiskTickets
      breachedTickets
    }
  }
`;

export function DashboardPage() {
  const [data, setData] = useState<TicketDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    graphqlRequest<{ dashboard: TicketDashboard }>(DASHBOARD_QUERY)
      .then((result) => setData(result.dashboard))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard.'));
  }, []);

  if (error) return <p className="error-message">{error}</p>;
  if (!data) return <p>Loading...</p>;

  return (
    <div className="page">
      <h1>Dashboard</h1>
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <span className="dashboard-number">{data.openTickets}</span>
          <span className="dashboard-label">Open</span>
        </div>
        <div className="dashboard-card">
          <span className="dashboard-number">{data.inProgressTickets}</span>
          <span className="dashboard-label">In Progress</span>
        </div>
        <div className="dashboard-card dashboard-card-warning">
          <span className="dashboard-number">{data.atRiskTickets}</span>
          <span className="dashboard-label">At Risk</span>
        </div>
        <div className="dashboard-card dashboard-card-danger">
          <span className="dashboard-number">{data.breachedTickets}</span>
          <span className="dashboard-label">Breached</span>
        </div>
      </div>
    </div>
  );
}