import type { Request } from 'express';

/** The authenticated admin, attached to the request by the JWT guards. */
export interface AuthUser {
  id: string;
  username: string;
  role: string;
}

export type RequestWithUser = Request & { user?: AuthUser };
