import { Global, Module } from "@nestjs/common";
import { MailerService } from "./mailer.service";

/**
 * MailerModule global — le service est exposé partout sans devoir
 * réimporter le module dans chaque feature qui envoie des mails.
 */
@Global()
@Module({
  providers: [MailerService],
  exports: [MailerService],
})
export class MailerModule {}
