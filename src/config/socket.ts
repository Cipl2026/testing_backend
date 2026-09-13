import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { UserRole } from '@ghaarfix/shared-types';
import { env } from '@/config/env.js';
import { isRedisEnabled, getRedisClient } from '@/infra/redis.js';
import { setSocketServer } from '@/modules/realtime/socket.service.js';
import { authorizeBookingChatJoin } from '@/modules/bookings/booking-chat.service.js';
import { verifyAccessToken } from '@/utils/jwt.js';
import { logger } from '@/utils/logger.js';

let ioInstance: SocketIOServer | null = null;

export function attachSocketServer(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
  });

  ioInstance = io;
  setSocketServer(io);

  void configureRedisAdapter(io);

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    const role = socket.data.role as UserRole;
    logger.info('Socket connected', { id: socket.id, userId, role });

    if (role === UserRole.CUSTOMER) {
      socket.join(`customer:${userId}`);
      socket.join(`user:${userId}`);
    } else if (role === UserRole.PROVIDER) {
      socket.join(`provider:${userId}`);
      socket.join(`user:${userId}`);
      socket.join('providers');
    } else if (role === UserRole.ADMIN) {
      socket.join('admin');
      socket.join(`user:${userId}`);
    }

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { id: socket.id, reason });
    });

    socket.on('watch:availability', (payload: { providerId?: string; date?: string }) => {
      if (role !== UserRole.CUSTOMER || !payload?.providerId || !payload?.date) return;
      void socket.join(`availability:${payload.providerId}:${payload.date}`);
    });

    socket.on('unwatch:availability', (payload: { providerId?: string; date?: string }) => {
      if (!payload?.providerId || !payload?.date) return;
      void socket.leave(`availability:${payload.providerId}:${payload.date}`);
    });

    socket.on('booking-chat:join', (payload: { bookingId?: string }) => {
      if (!payload?.bookingId) return;
      void authorizeBookingChatJoin(payload.bookingId, userId, role).then((allowed) => {
        if (allowed) void socket.join(`booking-chat:${payload.bookingId}`);
      });
    });

    socket.on('booking-chat:leave', (payload: { bookingId?: string }) => {
      if (!payload?.bookingId) return;
      void socket.leave(`booking-chat:${payload.bookingId}`);
    });
  });

  return io;
}

async function configureRedisAdapter(io: SocketIOServer): Promise<void> {
  if (!isRedisEnabled()) return;
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    const { createAdapter } = await import('@socket.io/redis-adapter');
    const pubClient = redis.duplicate();
    const subClient = redis.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    io.adapter(createAdapter(pubClient, subClient));
    logger.info('Socket.IO Redis adapter enabled');
  } catch (error) {
    logger.warn('Socket.IO Redis adapter unavailable; using in-memory adapter', {
      error: String(error),
    });
  }
}

export async function closeSocketServer(): Promise<void> {
  if (!ioInstance) return;
  await new Promise<void>((resolve) => {
    ioInstance!.close(() => resolve());
  });
  ioInstance = null;
}
