import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export interface AuthToken {
  userId: string;
  email: string;
  role: 'ADMIN' | 'USER';
  exp: number;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  static generateToken(userId: string, email: string, role: string): string {
    const payload: AuthToken = {
      userId,
      email,
      role: role as 'ADMIN' | 'USER',
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    };

    return jwt.sign(payload, JWT_SECRET);
  }

  static verifyToken(token: string): AuthToken | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthToken;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  static async authenticateUser(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return null;
    }

    const isValidPassword = await this.comparePassword(password, user.password);
    if (!isValidPassword) {
      return null;
    }

    return user;
  }

  static async createUser(email: string, password: string, role: 'ADMIN' | 'USER' = 'USER') {
    const hashedPassword = await this.hashPassword(password);
    
    return prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
      },
    });
  }
}

export function getAuthToken(req: any): AuthToken | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  return AuthService.verifyToken(token);
}

export function requireAuth(req: any): AuthToken {
  const token = getAuthToken(req);
  if (!token) {
    throw new Error('Authentication required');
  }
  return token;
}

export function requireAdmin(req: any): AuthToken {
  const token = requireAuth(req);
  if (token.role !== 'ADMIN') {
    throw new Error('Admin access required');
  }
  return token;
}
