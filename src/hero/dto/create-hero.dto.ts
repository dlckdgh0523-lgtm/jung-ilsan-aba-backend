import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderedContentDto } from '../../common/dto/ordered-content.dto';

export class CreateHeroDto extends OrderedContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  eyebrow?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  image?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  buttonText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  buttonLink?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  buttonText2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  buttonLink2?: string;
}
