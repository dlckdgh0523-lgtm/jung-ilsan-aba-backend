/** Signed JWT body. `ver` mirrors AdminUser.tokenVersion for stateless revocation. */
export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  ver: number;
}
