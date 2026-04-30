import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class RequestPasswordResetDto {
  @ApiProperty({ description: "E-mail du compte à réinitialiser" })
  @IsEmail()
  email!: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty({ description: "Token reçu par e-mail" })
  @IsString()
  token!: string;

  @ApiProperty({ description: "Nouveau mot de passe (min 8 caractères)" })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
