import type { UserRole } from '@ghaarfix/shared-types';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      userId: string;
      role: UserRole;
    };
  }
}
