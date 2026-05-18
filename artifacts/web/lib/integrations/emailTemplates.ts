/**
 * Task-186 — Shared patient email renderer.
 *
 * Single source of truth for the branded HTML shell + plain-text fallback used
 * by every transactional patient email (refund processed, order cancelled,
 * dispatch, decline, approval, …). Callers supply structured content; this
 * module owns the wrapper table, brand bar, typography and colours so a
 * branding tweak only has to land in one place.
 *
 * Paragraph strings MAY contain a small subset of inline HTML (`<strong>`,
 * `<span style="…">`, `<em>`, `<a>`). The HTML output uses them verbatim; the
 * text output strips tags so callers don't have to maintain two parallel
 * copies of every paragraph.
 *
 * ⚠️ TRUSTED-INPUT CONTRACT
 * `heading`, `paragraphs`, `cta.label` and `cta.href` are interpolated into
 * the HTML output **without escaping**. Callers MUST only pass content they
 * trust — server-controlled copy, server-controlled IDs (e.g. order IDs,
 * formatted currency), and the small inline-HTML subset listed above.
 * NEVER pass raw user-supplied text (patient-typed reasons, free-form
 * questionnaire answers, etc.) without first running it through an HTML
 * escaper. Before onboarding any caller that needs to render untrusted
 * input, add an explicit escape helper here and require callers to opt in.
 */

const BRAND = {
  primary: '#0a7e57',
  background: '#f4f4f7',
  card: '#ffffff',
  text: '#1f2937',
  muted: '#6b7280',
  font: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
};

export interface PatientEmailCta {
  label: string;
  href: string;
}

export interface RenderPatientEmailInput {
  /** Greeting line, e.g. `"Hi Sarah,"`. Rendered as the first paragraph. */
  heading: string;
  /** Body paragraphs. May include inline `<strong>`, `<span>`, `<em>`, `<a>`. */
  paragraphs: string[];
  /** Optional call-to-action button rendered below the body paragraphs. */
  cta?: PatientEmailCta;
  /** Defaults to `"The Livera team"`. */
  signoff?: string;
}

export interface RenderedPatientEmail {
  text: string;
  html: string;
}

function stripInlineHtml(input: string): string {
  return input.replace(/<[^>]+>/g, '');
}

export function renderPatientEmail(input: RenderPatientEmailInput): RenderedPatientEmail {
  const signoff = input.signoff ?? 'The Livera team';

  const textParts: string[] = [stripInlineHtml(input.heading), ''];
  for (const p of input.paragraphs) {
    textParts.push(stripInlineHtml(p), '');
  }
  if (input.cta) {
    textParts.push(`${input.cta.label}: ${input.cta.href}`, '');
  }
  textParts.push(`Thanks,\n${signoff}`);
  const text = textParts.join('\n');

  const lastBodyIndex = input.paragraphs.length - 1;
  const paragraphsHtml = input.paragraphs
    .map((p, i) => {
      const isLast = i === lastBodyIndex && !input.cta;
      const margin = isLast ? '0 0 20px' : '0 0 14px';
      return `<p style="margin:${margin};">${p}</p>`;
    })
    .join('');

  const ctaHtml = input.cta
    ? `<p style="margin:0 0 20px;"><a href="${input.cta.href}" style="display:inline-block;background:${BRAND.primary};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">${input.cta.label}</a></p>`
    : '';

  const html =
    `<!doctype html><html><body style="margin:0;padding:0;background:${BRAND.background};font-family:${BRAND.font};color:${BRAND.text};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.background};padding:24px 0;"><tr><td align="center">` +
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:${BRAND.card};border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">` +
    `<tr><td style="background:${BRAND.primary};padding:20px 28px;color:#ffffff;font-weight:600;font-size:18px;">Livera</td></tr>` +
    `<tr><td style="padding:28px;font-size:15px;line-height:1.55;">` +
    `<p style="margin:0 0 14px;">${input.heading}</p>` +
    paragraphsHtml +
    ctaHtml +
    `<p style="margin:0;color:${BRAND.muted};">Thanks,<br/>${signoff}</p>` +
    `</td></tr></table></td></tr></table></body></html>`;

  return { text, html };
}
