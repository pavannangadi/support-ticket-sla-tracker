import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { graphqlRequest, ApiError } from '../api/client';
import { SLABadge } from '../components/SLABadge';
import type { TicketConnection, TicketStatus, Priority, SLAState } from '../api/types';

const TICKETS_QUERY = `
  query Tickets($status: TicketStatus, $priority: Priority, $slaState: SLAState, $take: Int, $cursor: String) {
    tickets(status: $status, priority: $priority, slaState: $slaState, take: $take, cursor: $cursor) {
      nodes {
        id
        title
        priority
        status
        assignee { name }
        sla {
          firstResponseState
          resolutionState
          firstResponseRemainingMinutes
          resolutionRemainingMinutes
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const PAGE_SIZE = 10;

export function TicketListPage() {
  const [data, setData] = useState<TicketConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState<TicketStatus | ''>('');
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('');
  const [slaFilter, setSlaFilter] = useState<SLAState | ''>('');
  const [cursorStack, setCursorStack] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await graphqlRequest<{ tickets: TicketConnection }>(TICKETS_QUERY, {
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        slaState: slaFilter || undefined,
        take: PAGE_SIZE,
        cursor: cursorStack[pageIndex] ?? undefined,
      });
      setData(result.tickets);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, slaFilter, cursorStack, pageIndex]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  function resetPagination() {
    setCursorStack([null]);
    setPageIndex(0);
  }

  function goNextPage() {
    if (!data?.pageInfo.hasNextPage || !data.pageInfo.endCursor) return;
    setCursorStack((prev) => [...prev.slice(0, pageIndex + 1), data.pageInfo.endCursor]);
    setPageIndex((prev) => prev + 1);
  }

  function goPrevPage() {
    setPageIndex((prev) => Math.max(0, prev - 1));
  }

  return (
    <div className="page">
      <h1>Support Tickets</h1>

      <div className="filters">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as TicketStatus | '');
            resetPagination();
          }}
        >
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value as Priority | '');
            resetPagination();
          }}
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>

        <select
          value={slaFilter}
          onChange={(e) => {
            setSlaFilter(e.target.value as SLAState | '');
            resetPagination();
          }}
        >
          <option value="">All SLA States</option>
          <option value="ON_TRACK">On Track</option>
          <option value="AT_RISK">At Risk</option>
          <option value="BREACHED">Breached</option>
        </select>
      </div>

      {error && <p className="error-message">{error}</p>}
      {loading && <p>Loading...</p>}

      {!loading && data && (
        <>
          <table className="ticket-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assignee</th>
                <th>First Response SLA</th>
                <th>Resolution SLA</th>
              </tr>
            </thead>
            <tbody>
              {data.nodes.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link to={`/tickets/${ticket.id}`}>{ticket.title}</Link>
                  </td>
                  <td>{ticket.priority}</td>
                  <td>{ticket.status}</td>
                  <td>{ticket.assignee?.name ?? '—'}</td>
                  <td>
                    <SLABadge
                      state={ticket.sla.firstResponseState}
                      remainingMinutes={ticket.sla.firstResponseRemainingMinutes}
                    />
                  </td>
                  <td>
                    <SLABadge
                      state={ticket.sla.resolutionState}
                      remainingMinutes={ticket.sla.resolutionRemainingMinutes}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {data.nodes.length === 0 && <p>No tickets match these filters.</p>}

          <div className="pagination">
            <button onClick={goPrevPage} disabled={pageIndex === 0}>
              Previous
            </button>
            <button onClick={goNextPage} disabled={!data.pageInfo.hasNextPage}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}