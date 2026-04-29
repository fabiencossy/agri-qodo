"use client";

import type { ReactElement, ReactNode } from "react";

/**
 * Rendu markdown léger : titres ##/###, listes -, tables pipe,
 * gras **, italiques *, liens [texte](url), code inline `…`, paragraphes.
 *
 * Pas de dépendance externe — couvre 95% du contenu de veille
 * réglementaire qu'on rédige nous-mêmes. Si on veut un rendu plus
 * complet plus tard, on swap pour `react-markdown`.
 */

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return <div className="prose-veille">{blocks}</div>;
}

function parseBlocks(source: string): ReactElement[] {
  const lines = source.split("\n");
  const out: ReactElement[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(
        <h3 key={i} className="mt-5 mb-2 text-base font-semibold">
          {renderInline(line.slice(4))}
        </h3>,
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(
        <h2 key={i} className="mt-6 mb-3 text-lg font-bold">
          {renderInline(line.slice(3))}
        </h2>,
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      out.push(
        <h1 key={i} className="mt-6 mb-3 text-xl font-bold">
          {renderInline(line.slice(2))}
        </h1>,
      );
      i++;
      continue;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const cur = lines[i] ?? "";
        if (cur.startsWith("- ") || cur.startsWith("* ")) {
          items.push(cur.slice(2));
          i++;
        } else if (cur.trim() === "") {
          i++;
          break;
        } else {
          break;
        }
      }
      out.push(
        <ul key={`ul-${i}`} className="my-3 list-disc space-y-1 pl-5">
          {items.map((it, k) => (
            <li key={k}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("|")) {
        tableLines.push(lines[i] ?? "");
        i++;
      }
      out.push(renderTable(tableLines, `tbl-${i}`));
      continue;
    }
    // Paragraphe : on agrège jusqu'à ligne vide ou bloc spécial.
    const paraLines: string[] = [line];
    i++;
    while (i < lines.length) {
      const cur = lines[i] ?? "";
      if (
        cur.trim() === "" ||
        cur.startsWith("#") ||
        cur.startsWith("- ") ||
        cur.startsWith("* ") ||
        cur.startsWith("|")
      )
        break;
      paraLines.push(cur);
      i++;
    }
    out.push(
      <p key={`p-${i}`} className="my-3 leading-relaxed">
        {renderInline(paraLines.join(" "))}
      </p>,
    );
  }
  return out;
}

function renderTable(lines: string[], baseKey: string): ReactElement {
  const rows = lines
    .map((l) =>
      l
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim()),
    )
    .filter((r) => r.length > 0);
  // Détecte la ligne séparatrice (---|---).
  const sepIdx = rows.findIndex((r) => r.every((c) => /^:?-+:?$/.test(c)));
  const headerRows = sepIdx > 0 ? rows.slice(0, sepIdx) : [];
  const bodyRows = sepIdx > 0 ? rows.slice(sepIdx + 1) : rows;
  return (
    <div key={baseKey} className="my-4 overflow-x-auto">
      <table className="w-full border-collapse border border-border text-sm">
        {headerRows.length > 0 && (
          <thead className="bg-muted">
            {headerRows.map((row, r) => (
              <tr key={r}>
                {row.map((c, k) => (
                  <th key={k} className="border border-border px-3 py-2 text-left font-semibold">
                    {renderInline(c)}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        )}
        <tbody>
          {bodyRows.map((row, r) => (
            <tr key={r}>
              {row.map((c, k) => (
                <td key={k} className="border border-border px-3 py-2">
                  {renderInline(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Inline formatting : **bold**, *italic*, `code`, [text](url). */
function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  // Pattern : capture [text](url) | **bold** | *italic* | `code`
  const re = /(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    if (token.startsWith("[")) {
      const link = /\[([^\]]+)\]\(([^)]+)\)/.exec(token);
      if (link) {
        out.push(
          <a
            key={`a-${key++}`}
            href={link[2]}
            target="_blank"
            rel="noreferrer"
            className="text-green underline hover:no-underline"
          >
            {link[1]}
          </a>,
        );
      }
    } else if (token.startsWith("**")) {
      out.push(<strong key={`s-${key++}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      out.push(<em key={`e-${key++}`}>{token.slice(1, -1)}</em>);
    } else if (token.startsWith("`")) {
      out.push(
        <code key={`c-${key++}`} className="rounded bg-muted px-1 font-mono text-sm">
          {token.slice(1, -1)}
        </code>,
      );
    }
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
