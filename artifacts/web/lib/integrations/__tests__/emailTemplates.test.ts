/**
 * Task-279 — Snapshot/unit tests for renderPatientEmail().
 *
 * Locks in the branded HTML shell produced by the shared patient email
 * renderer so accidental tweaks (wrong brand colour, broken table, missing
 * sign-off) are caught the next time a template is edited.
 */

import { describe, expect, it } from 'vitest';
import { renderPatientEmail } from '../emailTemplates';

describe('renderPatientEmail', () => {
  it('renders heading + paragraphs in both HTML and text outputs', () => {
    const { html, text } = renderPatientEmail({
      heading: 'Hi Sarah,',
      paragraphs: ['Your order is on its way.', 'Tracking details will follow.'],
    });

    expect(html).toContain('<p style="margin:0 0 14px;">Hi Sarah,</p>');
    expect(html).toContain('Your order is on its way.');
    expect(html).toContain('Tracking details will follow.');
    expect(html).toContain('<table');
    expect(html).toContain('Livera');

    expect(text).toContain('Hi Sarah,');
    expect(text).toContain('Your order is on its way.');
    expect(text).toContain('Tracking details will follow.');
  });

  it('keeps inline <strong>/<span> in HTML but strips them from text', () => {
    const { html, text } = renderPatientEmail({
      heading: 'Hi Sarah,',
      paragraphs: [
        'Your refund of <strong>£42.00</strong> has been processed.',
        '<span style="color:#0a7e57">Thanks for your patience.</span>',
      ],
    });

    expect(html).toContain('<strong>£42.00</strong>');
    expect(html).toContain('<span style="color:#0a7e57">Thanks for your patience.</span>');

    expect(text).toContain('Your refund of £42.00 has been processed.');
    expect(text).toContain('Thanks for your patience.');
    expect(text).not.toContain('<strong>');
    expect(text).not.toContain('<span');
    expect(text).not.toContain('</span>');
  });

  it('renders an optional CTA as a button in HTML and a label + URL in text', () => {
    const { html, text } = renderPatientEmail({
      heading: 'Hi Sarah,',
      paragraphs: ['Please confirm your address before we ship.'],
      cta: { label: 'Confirm address', href: 'https://livera.example/confirm/abc' },
    });

    expect(html).toContain('href="https://livera.example/confirm/abc"');
    expect(html).toContain('Confirm address');
    expect(html).toContain('background:#0a7e57');
    expect(html).toContain('display:inline-block');

    expect(text).toContain('Confirm address: https://livera.example/confirm/abc');
  });

  it('omits CTA markup when no cta is supplied', () => {
    const { html, text } = renderPatientEmail({
      heading: 'Hi Sarah,',
      paragraphs: ['Just a heads up.'],
    });

    expect(html).not.toContain('display:inline-block');
    expect(html).not.toContain('href=');
    expect(text).not.toMatch(/https?:\/\//);
  });

  it('defaults the sign-off to "The Livera team"', () => {
    const { html, text } = renderPatientEmail({
      heading: 'Hi Sarah,',
      paragraphs: ['All done.'],
    });

    expect(html).toContain('Thanks,<br/>The Livera team');
    expect(text).toContain('Thanks,\nThe Livera team');
  });

  it('respects a custom sign-off', () => {
    const { html, text } = renderPatientEmail({
      heading: 'Hi Sarah,',
      paragraphs: ['Spoke to you earlier.'],
      signoff: 'Dr Patel, Livera Clinical Team',
    });

    expect(html).toContain('Thanks,<br/>Dr Patel, Livera Clinical Team');
    expect(text).toContain('Thanks,\nDr Patel, Livera Clinical Team');
    expect(html).not.toContain('The Livera team');
    expect(text).not.toContain('The Livera team');
  });

  it('matches the full branded HTML shell snapshot', () => {
    const { html, text } = renderPatientEmail({
      heading: 'Hi Sarah,',
      paragraphs: [
        'Your order <strong>#1234</strong> has been dispatched.',
        'It should arrive within 2 working days.',
      ],
      cta: { label: 'Track order', href: 'https://livera.example/track/1234' },
    });

    const expectedHtml =
      `<!doctype html><html><body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1f2937;">` +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:24px 0;"><tr><td align="center">` +
      `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">` +
      `<tr><td style="background:#0a7e57;padding:20px 28px;color:#ffffff;font-weight:600;font-size:18px;">Livera</td></tr>` +
      `<tr><td style="padding:28px;font-size:15px;line-height:1.55;">` +
      `<p style="margin:0 0 14px;">Hi Sarah,</p>` +
      `<p style="margin:0 0 14px;">Your order <strong>#1234</strong> has been dispatched.</p>` +
      `<p style="margin:0 0 14px;">It should arrive within 2 working days.</p>` +
      `<p style="margin:0 0 20px;"><a href="https://livera.example/track/1234" style="display:inline-block;background:#0a7e57;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">Track order</a></p>` +
      `<p style="margin:0;color:#6b7280;">Thanks,<br/>The Livera team</p>` +
      `</td></tr></table></td></tr></table></body></html>`;
    expect(html).toBe(expectedHtml);

    expect(text).toMatchInlineSnapshot(`
      "Hi Sarah,

      Your order #1234 has been dispatched.

      It should arrive within 2 working days.

      Track order: https://livera.example/track/1234

      Thanks,
      The Livera team"
    `);
  });
});
