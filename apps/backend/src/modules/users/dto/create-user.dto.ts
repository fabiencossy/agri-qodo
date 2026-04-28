import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { UserRole } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateUserDto {
  @ApiProperty({ description: "Email de l'utilisateur (unique global)." })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: "Mot de passe initial (min 4 chars en démo)." })
  @IsString()
  @MinLength(4)
  @MaxLength(120)
  password!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  prenom!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  nom!: string;

  @ApiPropertyOptional({
    enum: UserRole,
    description:
      "Rôle dans l'exploitation. OWNER = chef d'exploitation, EMPLOYE = salarié, COMPTABLE = lecture/compta, CONSULTANT = conseiller externe.",
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
