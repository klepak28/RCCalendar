import { IsString, MinLength, IsOptional, IsEmail, ValidateIf } from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  fullName: string;

  @IsString()
  @MinLength(1)
  address: string;

  @IsString()
  @MinLength(1)
  phone: string;

  @IsOptional()
  @ValidateIf((_o: unknown, v: unknown) => v != null && v !== '')
  @IsEmail()
  email?: string | null;
}
