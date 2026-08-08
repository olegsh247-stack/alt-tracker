import crypto from 'crypto';

const SECRET = process.env.APP_SECRET || 'dev-secret-change-me';

// Создаёт подписанное значение cookie вида: userId.подпись
export function createSessionValue(userId) {
  const sig = crypto.createHmac('sha256', SECRET).update(String(userId)).digest('hex');
  return `${userId}.${sig}`;
}

// Проверяет cookie и возвращает userId, либо null если подпись неверна/подделана
export function verifySessionValue(value) {
  if (!value) return null;
  const [userId, sig] = value.split('.');
  if (!userId || !sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(String(userId)).digest('hex');
  if (sig !== expected) return null;
  return Number(userId);
}
