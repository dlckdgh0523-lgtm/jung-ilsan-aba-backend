// One-off admin password reset — run from the server shell (e.g. Render):
//
//   ADMIN_NEW_PASSWORD='<새 비밀번호>' node prisma/set-admin-password.js
//
// Plain JS on purpose (no ts-node in the runtime image); only @prisma/client +
// bcryptjs. The password comes from the environment, never argv, so it does not
// land in shell history — and it is never printed.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
  const username = process.env.ADMIN_DEFAULT_USERNAME || 'admin';
  const password = process.env.ADMIN_NEW_PASSWORD;

  if (!password) {
    console.error('실패: ADMIN_NEW_PASSWORD 환경변수가 없습니다.');
    console.error("사용법: ADMIN_NEW_PASSWORD='<새 비밀번호>' node prisma/set-admin-password.js");
    process.exitCode = 1;
    return;
  }
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    console.error('실패: 비밀번호는 10자 이상, 영문과 숫자를 모두 포함해야 합니다.');
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    // tokenVersion bump revokes every previously issued JWT for this account.
    const updated = await prisma.adminUser.updateMany({
      where: { username },
      data: { passwordHash, tokenVersion: { increment: 1 } },
    });
    if (updated.count === 0) {
      console.error(`실패: 관리자 계정 '${username}'을(를) 찾지 못했습니다.`);
      console.error('ADMIN_DEFAULT_USERNAME이 실제 계정명과 일치하는지 확인하세요.');
      process.exitCode = 1;
      return;
    }
    console.log(`성공: '${username}' 비밀번호를 변경했고 기존 세션을 전부 무효화했습니다.`);
    console.log('관리자페이지에서 새 비밀번호로 다시 로그인하세요.');
  } catch (e) {
    console.error('실패:', e instanceof Error ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
