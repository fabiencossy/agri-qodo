/**
 * Configuration OpenTelemetry minimale.
 *
 * Activé uniquement si OTEL_EXPORTER_OTLP_ENDPOINT est défini.
 * À enrichir : exporter de métriques, sampling, instrumentations spécifiques.
 */
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

export function setupTelemetry(): NodeSDK | null {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return null;

  const sdk = new NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME ?? "agri-qodo-backend",
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  return sdk;
}
