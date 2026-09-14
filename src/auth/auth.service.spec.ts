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

  describe('changePassword', () => {
    const NEW_PW = 'brandnewpw12';

    async function withUser(currentPw: string) {
      const passwordHash = await bcrypt.hash(currentPw, 8);
      prisma.adminUser.findUnique.mockResolvedValue({
        id: 'a1',
        username: 'admin',
        role: 'admin',
        tokenVersion: 3,
        passwordHash,
      });
    }

    it('updates the hash, bumps tokenVersion, and returns a fresh token', async () => {
      await withUser('oldpassword1');
      prisma.adminUser.update.mockResolvedValue({
        id: 'a1',
        username: 'admin',
        role: 'admin',
        tokenVersion: 4,
        passwordHash: 'new-hash',
      });

      const r = await service.changePassword('a1', {
        currentPassword: 'oldpassword1',
        newPassword: NEW_PW,
      });

      expect(r).toEqual({ token: 'signed.jwt' });
      const call = prisma.adminUser.update.mock.calls[0][0] as {
        where: unknown;
        data: { passwordHash: string; tokenVersion: unknown };
      };
      expect(call.where).toEqual({ id: 'a1' });
      expect(call.data.tokenVersion).toEqual({ increment: 1 });
      // Stored value is a bcrypt hash of the new password, never plaintext.
      expect(call.data.passwordHash).not.toBe(NEW_PW);
      await expect(bcrypt.compare(NEW_PW, call.data.passwordHash)).resolves.toBe(true);
      // The fresh token is signed against the post-bump version (caller stays logged in).
      expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ ver: 4 }));
    });

    it('throws 401 INVALID_CREDENTIALS when the current password is wrong', async () => {
      await withUser('oldpassword1');
      try {
        await service.changePassword('a1', { currentPassword: 'WRONG', newPassword: NEW_PW });
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AppException);
        expect((e as AppException).getStatus()).toBe(401);
        expect((e as AppException).getResponse()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
      }
      expect(prisma.adminUser.update).not.toHaveBeenCalled();
    });

    it.each([
      ['too short', 'short1'],
      ['letters only', 'onlyletterspw'],
      ['digits only', '123456789012'],
    ])('throws 422 WEAK_PASSWORD when the new password is %s', async (_label, weak) => {
      await withUser('oldpassword1');
      try {
        await service.changePassword('a1', { currentPassword: 'oldpassword1', newPassword: weak });
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AppException);
        expect((e as AppException).getStatus()).toBe(422);
        expect((e as AppException).getResponse()).toMatchObject({ code: 'WEAK_PASSWORD' });
      }
      expect(prisma.adminUser.update).not.toHaveBeenCalled();
    });

    it('throws 422 PASSWORD_UNCHANGED when the new password equals the current one', async () => {
      await withUser('oldpassword1');
      try {
        await service.changePassword('a1', {
          currentPassword: 'oldpassword1',
          newPassword: 'oldpassword1',
        });
        throw new Error('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(AppException);
        expect((e as AppException).getStatus()).toBe(422);
        expect((e as AppException).getResponse()).toMatchObject({ code: 'PASSWORD_UNCHANGED' });
      }
      expect(prisma.adminUser.update).not.toHaveBeenCalled();
    });
  });
});
