import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: appendConnectionParams(process.env.DATABASE_URL || ''),
      },
    },
  });

globalForPrisma.prisma = prisma;

function appendConnectionParams(url: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=10&pool_timeout=30&connect_timeout=30&socket_timeout=60`;
}

// 연결 끊김 시 자동 재연결을 위한 미들웨어
prisma.$use(async (params, next) => {
  const MAX_RETRIES = 3;
  let retries = 0;
  while (true) {
    try {
      return await next(params);
    } catch (error: any) {
      const isConnectionError =
        error.code === 'P1001' || // Can't reach database
        error.code === 'P1002' || // Timed out
        error.code === 'P1008' || // Operations timed out
        error.code === 'P1017' || // Server closed connection
        error.message?.includes('Connection refused') ||
        error.message?.includes('Connection reset') ||
        error.message?.includes('Connection terminated') ||
        error.message?.includes('ECONNRESET') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('socket hang up') ||
        error.message?.includes('Server has closed the connection');

      if (isConnectionError && retries < MAX_RETRIES) {
        retries++;
        console.warn(`[DB] Connection error (attempt ${retries}/${MAX_RETRIES}): ${error.code || error.message}`);
        await new Promise(r => setTimeout(r, 1000 * retries));
        continue;
      }
      throw error;
    }
  }
});

// 주기적 연결 상태 확인 (5분마다)
const HEARTBEAT_INTERVAL = 5 * 60 * 1000;
setInterval(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    console.warn('[DB] Heartbeat failed, reconnecting...');
    try {
      await prisma.$disconnect();
      await prisma.$connect();
      console.log('[DB] Reconnected successfully');
    } catch (reconnectErr) {
      console.error('[DB] Reconnection failed:', reconnectErr);
    }
  }
}, HEARTBEAT_INTERVAL);

// 프로세스 종료 시 정리
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export { prisma };
export default prisma;
