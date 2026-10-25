declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: number;
        role: string;
      };
    }
  }
}

export {};

