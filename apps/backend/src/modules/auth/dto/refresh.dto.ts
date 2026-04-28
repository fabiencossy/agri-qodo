import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class RefreshDto {
  @ApiProperty({ description: "Refresh token reçu lors du login" })
  @IsString()
  refreshToken!: string;
}
