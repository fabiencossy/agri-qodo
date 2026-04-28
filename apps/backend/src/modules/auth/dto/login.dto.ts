import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "marie@ferme-rolet.ch" })
  @IsEmail()
  email!: string;

  // MinLength(4) pour autoriser un compte de démonstration partageable
  // (test/test). La création de comptes réels reste à durcir séparément.
  @ApiProperty({ example: "motDePasseFort", minLength: 4 })
  @IsString()
  @MinLength(4)
  password!: string;
}
