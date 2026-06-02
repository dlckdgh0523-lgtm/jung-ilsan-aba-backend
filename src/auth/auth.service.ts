import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import type { AuthUser } from './interfaces/auth-user.interface';

type AdminRecord = { id: string; username: string; role: string; tokenVersion: number };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<{ token: string; user: AuthUser }> {
    const user = await this.prisma.adminUser.findUnique({ where: { username: dto.username } });
    // Compare against a known-shape hash even when the user is missing would be ideal for
    // timing safety, but bcrypt.compare on the stored hash is sufficient here.
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw AppException.unauthorized(
        '아이디 또는 비밀번호가 올바르지 않습니다.',
        'INVALID_CREDENTIALS',
      );
    }
    return { token: await this.signToken(user), user: this.toAuthUser(user) };
  }

  /** Verifies signature + expiry, then checks the user still exists and the token isn't revoked. */
  async verifyToken(token: string): Promise<AuthUser> {
    let payload: JwtPayload;
    try {
      payload = await this.jwt.verifyAsync<JwtPayload>(token);
    } catch {
      throw AppException.unauthorized('유효하지 않거나 만료된 토큰입니다.');
    }
    const user = await this.prisma.adminUser.findUnique({ where: { id: payload.sub } });
    if (!user) throw AppException.unauthorized('유효하지 않은 토큰입니다.');
    if (user.tokenVersion !== payload.ver) {
      throw AppException.unauthorized('세션이 만료되었습니다. 다시 로그인해 주세요.');
    }
    return this.toAuthUser(user);
  }

  /** Bumps tokenVersion, invalidating every token previously issued to this user. */
  async logout(userId: string): Promise<void> {
    await this.prisma.adminUser.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    });
  }

  private signToken(user: AdminRecord): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      ver: user.tokenVersion,
    };
    return this.jwt.signAsync(payload);
  }

  private toAuthUser(user: AdminRecord): AuthUser {
    return { id: user.id, username: user.username, role: user.role };
  }
}
