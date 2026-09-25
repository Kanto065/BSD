import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../common/passwords.js";

// Sets an admin's password from the command line, for first setup or when nobody can sign in.
// The password is read from standard input, never from arguments, so it does not appear in the process list or
// shell history. It must be changed at the next sign-in, and every existing session for that account ends.
//
//   printf '%s' 'the-password' | docker exec -i bsd-api node dist/cli/set-admin-password.js admin@example.com
//
// Add --create "Full Name" --role SUPER_ADMIN to create the account if it does not exist yet.

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

async function main() {
  const [email, ...rest] = process.argv.slice(2);
  if (!email || process.stdin.isTTY) {
    console.error("Usage: printf '%s' 'password' | node dist/cli/set-admin-password.js <email> [--create \"Name\" --role ROLE]");
    process.exit(2);
  }
  const createName = rest.includes("--create") ? rest[rest.indexOf("--create") + 1] : undefined;
  const role = (rest.includes("--role") ? rest[rest.indexOf("--role") + 1] : "SUPER_ADMIN") as "SUPER_ADMIN" | "ADMIN" | "MODERATOR" | "VOLUNTEER";

  const password = await readStdin();
  if (password.length < 8) {
    console.error("The password must be at least 8 characters (a stronger one is required at the next sign-in).");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const normalised = email.trim().toLowerCase();
    const existing = await prisma.adminUser.findUnique({ where: { email: normalised } });
    const passwordHash = await hashPassword(password);
    if (existing) {
      await prisma.adminUser.update({
        where: { id: existing.id },
        data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null, active: true, tokenVersion: { increment: 1 } },
      });
      console.log(`Password set for ${normalised} (${existing.role}). It must be changed at the next sign-in.`);
    } else if (createName) {
      await prisma.adminUser.create({ data: { name: createName, email: normalised, role, passwordHash, mustChangePassword: true } });
      console.log(`Created ${normalised} (${role}). The password must be changed at the first sign-in.`);
    } else {
      console.error(`No admin with email ${normalised}. Add --create "Full Name" to create one.`);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
