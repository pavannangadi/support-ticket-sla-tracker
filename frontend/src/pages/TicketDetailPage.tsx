import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { graphqlRequest, ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { SLABadge } from '../components/SLABadge';
import type { Ticket, User, TicketStatus, UserRole } from '../api/types';

const TICKET_QUERY = `
  query Ticket($id: ID!) {
    ticket(id: $id) {
      id
      title
      description
      priority
      status
      reporter { id name email role }
      assignee { id name email role }
      createdAt
      firstResponseAt
      resolvedAt
      sla {
        firstResponseDueAt
        resolutionDueAt
        firstResponseState
        resolutionState
        firstResponseRemainingMinutes
        resolutionRemainingMinutes
      }
      comments {
        id
        content
        author { id name role }
        createdAt
      }
    }
  }
`;

const USERS_QUERY = `
  query Users($role: UserRole) {
    users(role: $role) {
      id
      name
      email
    }
  }
`;

const ADD_COMMENT_MUTATION = `
  mutation AddComment($ticketId: ID!, $content: String!) {
    addComment(ticketId: $ticketId, content: $content) {
      id
    }
  }
`;

const ASSIGN_TICKET_MUTATION = `
  mutation AssignTicket($ticketId: ID!, $assigneeId: ID!) {
    assignTicket(ticketId: $ticketId, assigneeId: $assigneeId) {
      id
    }
  }
`;

const CHANGE_STATUS_MUTATION = `
  mutation ChangeTicketStatus($ticketId: ID!, $status: TicketStatus!) {
    changeTicketStatus(ticketId: $ticketId, status: $status) {
      id
    }
  }
`;

const RESOLVE_TICKET_MUTATION = `
  mutation ResolveTicket($ticketId: ID!) {
    resolveTicket(ticketId: $ticketId) {
      id
    }
  }
`;

const NEXT_STATUS_OPTIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['RESOLVED', 'OPEN'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'],
};

export function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [agents, setAgents] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const isAgent = user?.role === ('AGENT' as UserRole);

  const loadTicket = useCallback(async () => {
    if (!id) return;
    try {
      const result = await graphqlRequest<{ ticket: Ticket | null }>(TICKET_QUERY, { id });
      if (!result.ticket) {
        setError('Ticket not found.');
        return;
      }
      setTicket(result.ticket);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load ticket.');
    }
  }, [id]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  useEffect(() => {
    if (!isAgent) return;
    graphqlRequest<{ users: User[] }>(USERS_QUERY, { role: 'AGENT' })
      .then((result) => setAgents(result.users))
      .catch(() => {});
  }, [isAgent]);

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!id || !commentText.trim()) return;
    setActionError(null);
    setSubmittingComment(true);
    try {
      await graphqlRequest(ADD_COMMENT_MUTATION, { ticketId: id, content: commentText });
      setCommentText('');
      await loadTicket();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to add comment.');
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleAssign(assigneeId: string) {
    if (!id || !assigneeId) return;
    setActionError(null);
    try {
      await graphqlRequest(ASSIGN_TICKET_MUTATION, { ticketId: id, assigneeId });
      await loadTicket();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to assign ticket.');
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    if (!id) return;
    setActionError(null);
    try {
      await graphqlRequest(CHANGE_STATUS_MUTATION, { ticketId: id, status });
      await loadTicket();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to change status.');
    }
  }

  async function handleResolve() {
    if (!id) return;
    setActionError(null);
    try {
      await graphqlRequest(RESOLVE_TICKET_MUTATION, { ticketId: id });
      await loadTicket();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Failed to resolve ticket.');
    }
  }

  if (error) return <p className="error-message">{error}</p>;
  if (!ticket) return <p>Loading...</p>;

  const nextStatuses = NEXT_STATUS_OPTIONS[ticket.status];

  return (
    <div className="page">
      <h1>{ticket.title}</h1>
      <p className="ticket-meta">
        {ticket.priority} · {ticket.status} · Reported by {ticket.reporter.name}
        {ticket.assignee && ` · Assigned to ${ticket.assignee.name}`}
      </p>

      <p>{ticket.description}</p>

      <div className="sla-panel">
        <div>
          <strong>First Response:</strong>{' '}
          <SLABadge
            state={ticket.sla.firstResponseState}
            remainingMinutes={ticket.sla.firstResponseRemainingMinutes}
          />
        </div>
        <div>
          <strong>Resolution:</strong>{' '}
          <SLABadge
            state={ticket.sla.resolutionState}
            remainingMinutes={ticket.sla.resolutionRemainingMinutes}
          />
        </div>
      </div>

      {actionError && <p className="error-message">{actionError}</p>}

      {isAgent && (
        <div className="agent-actions">
          <label>
            Assign to:
            <select value={ticket.assignee?.id ?? ''} onChange={(e) => handleAssign(e.target.value)}>
              <option value="">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </label>

          {nextStatuses.map((status) => (
            <button key={status} onClick={() => handleStatusChange(status)}>
              Move to {status}
            </button>
          ))}

          {ticket.status === 'IN_PROGRESS' && <button onClick={handleResolve}>Resolve Ticket</button>}
        </div>
      )}

      <h2>Comments</h2>
      <ul className="comment-list">
        {ticket.comments.map((comment) => (
          <li key={comment.id}>
            <strong>
              {comment.author.name} ({comment.author.role})
            </strong>
            <p>{comment.content}</p>
            <span className="comment-timestamp">{new Date(comment.createdAt).toLocaleString()}</span>
          </li>
        ))}
        {ticket.comments.length === 0 && <li>No comments yet.</li>}
      </ul>

      <form onSubmit={handleAddComment} className="comment-form">
        <textarea
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Add a comment..."
          rows={3}
          required
        />
        <button type="submit" disabled={submittingComment}>
          {submittingComment ? 'Posting...' : 'Post Comment'}
        </button>
      </form>
    </div>
  );
}