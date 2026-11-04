import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { trim } from '../../common/utils/transforms';

export class CategoryDto {
  @Transform(trim)
  @IsString({ message: 'Enter a name.' })
  @Length(2, 60, { message: 'The name must be between 2 and 60 characters.' })
  name!: string;
}
