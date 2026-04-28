import { Controller, Get } from "@nestjs/common";
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  PrismaHealthIndicator,
} from "@nestjs/terminus";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { PrismaService } from "@/common/prisma/prisma.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Health check (DB + service)" })
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([() => this.prismaHealth.pingCheck("database", this.prisma)]);
  }
}
