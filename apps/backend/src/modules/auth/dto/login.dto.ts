import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

/**
 * Login = email + mot de passe seuls. Si le couple matche plusieurs
 * Users (compte fédéré : même email/password chez plusieurs
 * exploitations), le JWT inclut la liste de tenants accessibles et
 * l'utilisateur peut basculer entre eux via le tenant switcher.
 */
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
