// packages/db/src/client.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

// Defaults to the local docker database from `pnpm db:up`. No connection
// opens until the first query, so importing this at build time is safe.
const connectionString = process.env["DATABASE_URL"] ?? "postgres://localhost:5432/backpressure";

const client = postgres(connectionString);

export const db = drizzle(client, { schema });
