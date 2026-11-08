import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { createMysqlPool } from './connection';

async function provisionAdmin(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!databaseUrl) throw new Error('DATABASE_URL is required.');
  if (!username || !password) throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD in the protected environment.');
  const isEmailUsername = /^[a-z0-9._+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(username);
  const isSimpleUsername = /^[a-z0-9][a-z0-9._-]{2,63}$/.test(username);
  if (!isEmailUsername && !isSimpleUsername) {
    throw new Error('ADMIN_USERNAME must be a valid email-style identifier or a 3-64 character username.');
  }
  if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('ADMIN_PASSWORD must be at least 12 characters and no more than 72 UTF-8 bytes.');
  }

  const email = isEmailUsername ? username : `${username}@admin.skillbridge.local`;
  const userId = `usr-${randomUUID()}`;
  const passwordHash = await bcrypt.hash(password, 12);
  const pool = createMysqlPool(databaseUrl);
  const connection = await pool.getConnection();

  try {
    const [lockResult] = await connection.execute('SELECT GET_LOCK(?, 10) AS acquired', ['skillbridge_admin_provision']);
    if ((lockResult as Array<{ acquired: number | null }>)[0]?.acquired !== 1) {
      throw new Error('Could not acquire the administrator provisioning lock.');
    }

    await connection.beginTransaction();
    const [existing] = await connection.execute(
      'SELECT `id`, `username`, `email`, `role`, `isActive` FROM `users` WHERE `username` = ? OR `email` = ? OR `role` = ? FOR UPDATE',
      [username, email, 'ADMIN']
    );
    const existingRows = existing as Array<{ id: string; username: string | null; email: string; role: string; isActive: boolean }>;

    if (existingRows.length > 0) {
      const configuredAdmin = existingRows.find((user) => user.role === 'ADMIN' && user.username === username && user.isActive);
      await connection.rollback();
      if (configuredAdmin) {
        console.log(`Administrator ${username} already exists and is active; no changes made.`);
        return;
      }
      throw new Error('An administrator or conflicting account already exists; refusing to create another.');
    }

    await connection.execute(
      'INSERT INTO `users` (`id`, `email`, `username`, `passwordHash`, `fullName`, `role`, `isActive`, `emailVerified`, `createdAt`, `updatedAt`) VALUES (?, ?, ?, ?, ?, ?, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [userId, email, username, passwordHash, 'System Administrator', 'ADMIN']
    );
    await connection.execute(
      'INSERT INTO `platform_audit_logs` (`id`, `userId`, `action`, `entityType`, `entityId`, `details`) VALUES (?, ?, ?, ?, ?, ?)',
      [`audit-${randomUUID()}`, userId, 'ADMIN_ACCOUNT_PROVISIONED', 'User', userId, 'Administrator created by the protected provisioning command.']
    );
    await connection.commit();
    console.log(`Administrator ${username} provisioned. Sign in using the configured username and password.`);
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    await connection.execute('SELECT RELEASE_LOCK(?)', ['skillbridge_admin_provision']).catch(() => undefined);
    connection.release();
    await pool.end();
  }
}

provisionAdmin().catch((error) => {
  const databaseError = error as { code?: string };
  console.error(`Administrator provisioning failed: ${error instanceof Error ? error.message : databaseError.code ?? 'UnknownError'}`);
  process.exitCode = 1;
});