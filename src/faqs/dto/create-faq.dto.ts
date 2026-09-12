import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { OrderedContentDto } from '../../common/dto/ordered-content.dto';

export class CreateFaqDto extends OrderedContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  question!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  answer!: string;
}
