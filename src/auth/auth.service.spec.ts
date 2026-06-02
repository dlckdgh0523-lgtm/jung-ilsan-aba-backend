import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { AppException } from '../common/exceptions/app.exception';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { adminUser: { findUnique: jest.Mock; update: jest.Mock } };
  let jwt: { signAsync: jest.Mock; verifyAsync: jest.Mock };

  beforeEach(() => {
    prisma = { adminUser: { findUnique: jest.fn(), update: jest.fn() } };
    jwt = { signAsync: jest.fn().mockResolvedValue('signed.jwt'), verifyAsync: jest.fn() };
    service = new AuthService(prisma as never, jwt as unknown as JwtService);
  });

  it('login returns token + user on valid credentials', async () => {
    const passwordHash = await bcrypt.hash('pw', 8);
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 'a1',
      username: 'admin',
      role: 'admin',
      tokenVersion: 0,
      passwordHash,
    });
    const r = await service.login({ username: 'admin', password: 'pw' });
    expect(r.token).toBe('signed.jwt');
    expect(r.user).toEqual({ id: 'a1', username: 'admin', role: 'admin' });
  });

  it('login throws 401 INVALID_CREDENTIALS on wrong password', async () => {
    const passwordHash = await bcrypt.hash('pw', 8);
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 'a1',
      username: 'admin',
      role: 'admin',
      tokenVersion: 0,
      passwordHash,
    });
    try {
      await service.login({ username: 'admin', password: 'WRONG' });
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppException);
      expect((e as AppException).getStatus()).toBe(401);
      expect((e as AppException).getResponse()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    }
  });

  it('login throws 401 when the user does not exist', async () => {
    prisma.adminUser.findUnique.mockResolvedValue(null);
    await expect(service.login({ username: 'nope', password: 'x' })).rejects.toBeInstanceOf(
      AppException,
    );
  });

  it('verifyToken returns user when signature + version are valid', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'a1', username: 'admin', role: 'admin', ver: 2 });
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 'a1',
      username: 'admin',
      role: 'admin',
      tokenVersion: 2,
      passwordHash: 'x',
    });
    await expect(service.verifyToken('t')).resolves.toEqual({
      id: 'a1',
      username: 'admin',
      role: 'admin',
    });
  });

  it('verifyToken throws 401 when tokenVersion is stale (revoked)', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'a1', ver: 1 });
    prisma.adminUser.findUnique.mockResolvedValue({
      id: 'a1',
      username: 'admin',
      role: 'admin',
      tokenVersion: 9,
      passwordHash: 'x',
    });
    await expect(service.verifyToken('t')).rejects.toBeInstanceOf(AppException);
  });

  it('verifyToken throws 401 when the JWT is invalid/expired', async () => {
    jwt.verifyAsync.mockRejectedValue(new Error('bad token'));
    await expect(service.verifyToken('t')).rejects.toBeInstanceOf(AppException);
  });

  it('logout bumps tokenVersion (revokes prior tokens)', async () => {
    prisma.adminUser.update.mockResolvedValue({});
    await service.logout('a1');
    expect(prisma.adminUser.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { tokenVersion: { increment: 1 } },
    });
  });
});
