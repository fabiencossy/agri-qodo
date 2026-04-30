import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class ChangePasswordDto {
  @ApiProperty({ description: "Mot de passe actuel" })
  @IsString()
  currentPassword!: string;

  @ApiProperty({ description: "Nouveau mot de passe (min 8 caractères)" })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
