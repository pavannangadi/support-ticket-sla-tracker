import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { userResolvers } from './graphql/resolvers/userResolvers';
import { authResolvers } from './graphql/resolvers/authResolvers';
import { ticketResolvers } from './graphql/resolvers/ticketResolvers';
import { createContext } from './graphql/context';

const typeDefs = readFileSync(
  join(import.meta.dir, 'graphql/schema/schema.graphql'),
  'utf-8'
);

const schema = makeExecutableSchema({
  typeDefs,
  resolvers: [userResolvers, authResolvers, ticketResolvers],
});

const yoga = createYoga({
  schema,
  context: createContext,
});

const server = createServer(yoga);

const port = Number(process.env.PORT) || 4000;

server.listen(port, () => {
  console.log(`GraphQL server running at http://localhost:${port}/graphql`);
});
