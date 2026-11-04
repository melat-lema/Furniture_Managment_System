import { IsBoolean } from 'class-validator';

export class SetActiveDto {
  @IsBoolean({ message: 'isActive must be true or false.' })
  isActive!: boolean;
}
