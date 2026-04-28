import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "marie@ferme-rolet.ch" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "motDePasseFort", minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
