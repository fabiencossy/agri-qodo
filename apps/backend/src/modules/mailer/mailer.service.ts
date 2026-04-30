import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "@/config/env.schema";

interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  /** Texte de fallback (clients qui ne lisent pas HTML). Si vide, généré
   *  depuis le HTML (strip basique). */
  text?: string;
  /** Reply-To optionnel (ex pour invitations partenaires). */
  replyTo?: string;
}

export interface SendMailResult {
  /** True = envoyé via le provider, false = mode log-only. */
  delivered: boolean;
  providerId?: string;
}

/**
 * MailerService — envoie des e-mails via Resend (REST API directe, pas
 * de SDK pour éviter une dépendance npm).
 *
 * En mode dev / staging, on peut laisser `RESEND_API_KEY` vide : les
 * mails sont juste loggés (avec sujet, destinataire, lien si reset
 * password — pour copier/coller pendant les tests).
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly apiKey: string | undefined;
  private readonly from: string;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.apiKey = this.config.get("RESEND_API_KEY", { infer: true });
    this.from = this.config.get("MAIL_FROM", { infer: true });
  }

  async send(input: SendMailInput): Promise<SendMailResult> {
    if (!this.apiKey) {
      this.logger.warn(
        `[MAIL LOG ONLY] To: ${input.to} | Subject: ${input.subject} | HTML preview:\n${input.html.slice(0, 500)}…`,
      );
      return { delivered: false };
    }

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: input.to,
          subject: input.subject,
          html: input.html,
          ...(input.text ? { text: input.text } : {}),
          ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        }),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        this.logger.error(`Resend API ${response.status} pour ${input.to} : ${body.slice(0, 200)}`);
        return { delivered: false };
      }
      const data = (await response.json()) as { id?: string };
      this.logger.log(`Mail envoyé à ${input.to} (id ${data.id ?? "n/a"})`);
      return { delivered: true, ...(data.id ? { providerId: data.id } : {}) };
    } catch (err) {
      this.logger.error(
        `Mail envoi échoué pour ${input.to} : ${err instanceof Error ? err.message : err}`,
      );
      return { delivered: false };
    }
  }
}
