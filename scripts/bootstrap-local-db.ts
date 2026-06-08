import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const envPath = path.join(cwd, ".env");

type Mode = "docker" | "local";

type BootstrapConfig = {
  mode: Mode;
  psqlPath: string;
  adminUser: string;
};

function randomToken(size = 24) {
  return randomBytes(size).toString("base64url");
}

function upsertEnv(content: string, key: string, value: string) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  const nextLine = `${key}="${value}"`;
  if (pattern.test(content)) {
    return content.replace(pattern, nextLine);
  }
  return `${content.trim()}\n${nextLine}\n`;
}

function ensureLineBreak(content: string) {
  return content.endsWith("\n") ? content : `${content}\n`;
}

function tryExecFile(command: string, args: string[]) {
  try {
    return execFileSync(command, args, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch {
    return null;
  }
}

function resolveBootstrapConfig(): BootstrapConfig {
  const dockerVersion = tryExecFile("docker", ["--version"]);
  if (dockerVersion) {
    try {
      execFileSync("docker", ["compose", "up", "-d", "postgres"], {
        stdio: "inherit",
      });
      return {
        mode: "docker",
        psqlPath: "psql",
        adminUser: process.env.POSTGRES_DOCKER_ADMIN_USER ?? "natta",
      };
    } catch {
      // Fallback to local postgres mode.
    }
  }

  const localCandidates = [
    "/Applications/Postgres.app/Contents/Versions/latest/bin/psql",
    "/Applications/Postgres.app/Contents/Versions/18/bin/psql",
    "psql",
  ];

  for (const candidate of localCandidates) {
    const version = tryExecFile(candidate, ["--version"]);
    if (version) {
      return {
        mode: "local",
        psqlPath: candidate,
        adminUser:
          process.env.POSTGRES_ADMIN_USER ?? process.env.USER ?? "postgres",
      };
    }
  }

  throw new Error(
    "No se encontró docker ni psql local. Instalá Docker o Postgres.app y reintentá.",
  );
}

function runPsql(config: BootstrapConfig, sql: string, database = "postgres") {
  const baseArgs = [
    "-v",
    "ON_ERROR_STOP=1",
    "-U",
    config.adminUser,
    "-d",
    database,
    "-tAc",
    sql,
  ];

  if (config.mode === "docker") {
    return execFileSync(
      "docker",
      ["exec", "natta-postgres", config.psqlPath, ...baseArgs],
      {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
  }

  return execFileSync(config.psqlPath, baseArgs, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function main() {
  const config = resolveBootstrapConfig();

  const dbName = "natta_app";
  const dbUser = `natta_app_${randomBytes(4).toString("hex")}`;
  const dbPassword = randomToken(12);
  const jwtSecret = randomToken(24);

  const roleExists = runPsql(
    config,
    `SELECT 1 FROM pg_roles WHERE rolname='${dbUser}'`,
  )
    .trim()
    .includes("1");

  if (!roleExists) {
    runPsql(
      config,
      `CREATE ROLE ${dbUser} LOGIN PASSWORD '${dbPassword}';`,
    );
  } else {
    runPsql(config, `ALTER ROLE ${dbUser} WITH PASSWORD '${dbPassword}';`);
  }

  const dbExists = runPsql(
    config,
    `SELECT 1 FROM pg_database WHERE datname='${dbName}'`,
  )
    .trim()
    .includes("1");

  if (!dbExists) {
    runPsql(config, `CREATE DATABASE ${dbName};`);
  }

  runPsql(config, `GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${dbUser};`);
  runPsql(config, `GRANT USAGE, CREATE ON SCHEMA public TO ${dbUser};`, dbName);

  const databaseUrl = `postgresql://${dbUser}:${dbPassword}@localhost:5432/${dbName}?schema=public`;

  let envContent = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, "utf-8")
    : fs.readFileSync(path.join(cwd, ".env.example"), "utf-8");

  envContent = ensureLineBreak(envContent);
  envContent = upsertEnv(envContent, "DATABASE_URL", databaseUrl);
  envContent = upsertEnv(envContent, "DIRECT_URL", databaseUrl);
  envContent = upsertEnv(envContent, "JWT_SECRET", jwtSecret);
  envContent = upsertEnv(envContent, "NEXT_PUBLIC_APP_URL", "http://localhost:3000");

  if (!/MERCADOPAGO_ACCESS_TOKEN=/.test(envContent)) {
    envContent = upsertEnv(
      envContent,
      "MERCADOPAGO_ACCESS_TOKEN",
      "TEST-REEMPLAZAR-CON-TOKEN-SANDBOX",
    );
  }

  if (!/MERCADOPAGO_WEBHOOK_SECRET=/.test(envContent)) {
    envContent = upsertEnv(
      envContent,
      "MERCADOPAGO_WEBHOOK_SECRET",
      "REEMPLAZAR-CON-WEBHOOK-SECRET",
    );
  }

  fs.writeFileSync(envPath, ensureLineBreak(envContent), "utf-8");

  console.log("Bootstrap local de DB completado.");
  console.log(`MODE=${config.mode}`);
  console.log(`POSTGRES_ADMIN_USER=${config.adminUser}`);
  console.log(`DB_USER=${dbUser}`);
  console.log(`DB_PASSWORD=${dbPassword}`);
  console.log(`DB_NAME=${dbName}`);
  console.log(`DATABASE_URL=${databaseUrl}`);
  console.log(`DIRECT_URL=${databaseUrl}`);
  console.log(`JWT_SECRET=${jwtSecret}`);
  console.log("Archivo .env actualizado.");
}

main();
