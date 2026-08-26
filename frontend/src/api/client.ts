const API_URL = 'http://localhost:4000/graphql';

export interface GraphQLErrorShape {
  message: string;
  extensions?: { code?: string };
}

export class ApiError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

export async function graphqlRequest<TData>(
  query: string,
  variables?: Record<string, unknown>
): Promise<TData> {
  const token = localStorage.getItem('token');

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (json.errors && json.errors.length > 0) {
    const firstError: GraphQLErrorShape = json.errors[0];
    throw new ApiError(
      firstError.message,
      firstError.extensions?.code ?? 'UNKNOWN_ERROR'
    );
  }

  return json.data as TData;
}