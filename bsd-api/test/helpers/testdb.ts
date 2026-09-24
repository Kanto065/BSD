import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";

// A real PostgreSQL for integration tests with nothing to install: PGlite (PostgreSQL compiled to WebAssembly)
// runs in this process and serves the normal Postgres wire protocol on a local port, so the real Prisma engine
// can connect to it. The real migration files are applied in order, exactly as `migrate deploy` would.
//
// `pgbouncer=true` makes Prisma avoid named prepared statements, which PGlite's single shared session cannot
// keep apart. `connection_limit=1` keeps Prisma to a single connection.

const MIGRATIONS = path.resolve(__dirname, "../../prisma/migrations");

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
  });
}

export type TestDb = { url: string; db: PGlite; stop: () => Promise<void> };

export async function startTestDb(): Promise<TestDb> {
  const db = new PGlite();
  const folders = fs
    .readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  for (const folder of folders) await db.exec(fs.readFileSync(path.join(MIGRATIONS, folder, "migration.sql"), "utf8"));

  const port = await freePort();
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 8 });
  await server.start();
  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1&pgbouncer=true`,
    db,
    stop: async () => {
      await server.stop();
      await db.close();
    },
  };
}
