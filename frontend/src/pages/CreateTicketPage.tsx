import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { graphqlRequest, ApiError } from '../api/client';
import type { Priority, Ticket } from '../api/types';

const CREATE_TICKET_MUTATION = `
  mutation CreateTicket($title: String!, $description: String!, $priority: Priority!) {
    createTicket(title: $title, description: $description, priority: $priority) {
      id
    }
  }
`;

export function CreateTicketPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await graphqlRequest<{ createTicket: Ticket }>(CREATE_TICKET_MUTATION, {
        title,
        description,
        priority,
      });
      navigate(`/tickets/${data.createTicket.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create ticket.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Create Ticket</h1>
      <form onSubmit={handleSubmit} className="ticket-form">
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>
        <label>
          Description
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            rows={5}
          />
        </label>
        <label>
          Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </label>
        {error && <p className="error-message">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? 'Creating...' : 'Create Ticket'}
        </button>
      </form>
    </div>
  );
}
