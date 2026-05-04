import { ApiProperty } from "@nestjs/swagger";
import { Canton } from "@prisma/client";
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class RegisterDto {
  @ApiProperty({ example: "marie@ferme-rolet.ch" })
  @IsEmail()
  @MaxLength(120)
  email!: string;

  @ApiProperty({ example: "secret1234", minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(120)
  password!: string;

  @ApiProperty({ example: "Marie" })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  prenom!: string;

  @ApiProperty({ example: "Rolet" })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  nom!: string;

  @ApiProperty({ example: "Ferme du Rolet" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  exploitationNom!: string;

  @ApiProperty({ enum: Canton })
  @IsEnum(Canton)
  canton!: Canton;

  @ApiProperty({
    description:
      "Consentement CGU + politique de confidentialité (obligatoire). Doit être true pour valider le signup.",
  })
  @IsBoolean()
  @Equals(true, { message: "Tu dois accepter les CGU pour créer un compte." })
  cguAccepted!: boolean;
}
