import "express";

declare global {
  namespace Express {
    interface User {
      id?: number | string;
      username?: string;
      email?: string;
      role?: string;
      isLocal?: boolean;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
