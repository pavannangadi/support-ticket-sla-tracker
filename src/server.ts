import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeExecutableSchema } from '@graphql-tools/schema';

const typeDefs = readFileSync(
  join(import.meta.dir, 'graphql/schema/schema.graphql'),
  'utf-8'
);

const schema = makeExecutableSchema({
  typeDefs,
});

const yoga = createYoga({ schema });

const server = createServer(yoga);

const port = Number(process.env.PORT) || 4000;

server.listen(port, () => {
  console.log(`GraphQL server running at http://localhost:${port}/graphql`);
});
