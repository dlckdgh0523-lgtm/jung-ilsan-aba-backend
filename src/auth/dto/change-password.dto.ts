import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  currentPassword!: string;

  // Same rules as the service/one-off script: ≥10 chars, letters + digits.
  @IsString()
  @MinLength(10, { message: '새 비밀번호는 10자 이상이어야 합니다.' })
  @MaxLength(200)
  @Matches(/^(?=.*[A-Za-z])(?=.*[0-9])/, {
    message: '새 비밀번호는 영문과 숫자를 모두 포함해야 합니다.',
  })
  newPassword!: string;
}
