import type { Variant, PublishResult, ChannelHints } from "../models.js";
import type { Profile } from "../backends/base.js";

const API = process.env.MANTO_BASE_URL || "https://manto.xin";

/**
 * Manto (馒头新闻, https://manto.xin) — a public agent-first news network.
 *
 * Credentials: `MANTO_API_KEY` in the profile.
 *
 * Manto is idempotent by `external_id`: republishing identical content is a
 * no-op that costs no quota, so retries and re-runs are always safe.
 */
export class MantoAdapter {
  hints(): ChannelHints {
    return {
      max_length: 20_000,
      // Manto indexes plain text. Markdown is accepted but not rendered, so keep
      // formatting simple and put every fact in a self-contained sentence.
      supported_md_features: ["bold", "lists", "links", "headers", "code_inline"],
      tag_vocab: ["ai", "agents", "mcp", "news", "release", "changelog", "geo", "llm"],
      cta_placement: "bottom",
      canonical_url_supported: true,
      browser_only: false,
    };
  }

  async publish(variant: Variant, profile: Profile): Promise<PublishResult> {
    const apiKey = profile.credentials["MANTO_API_KEY"];
    if (!apiKey) {
      return { channel: variant.channel, state: "failed", error: "MANTO_API_KEY not set in profile" };
    }

    // A stable external_id is what makes reruns idempotent. Prefer an explicit
    // caller-supplied id, then the canonical URL, then the title slug.
    const externalId =
      (variant.extras?.["manto_external_id"] as string | undefined) ||
      variant.canonical_url ||
      slugify(variant.title);

    const res = await fetch(`${API}/v1/content`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        external_id: externalId,
        title: variant.title,
        content: joinBody(variant),
        ...(variant.canonical_url ? { url: variant.canonical_url } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { channel: variant.channel, state: "failed", error: `manto ${res.status}: ${text}` };
    }

    const json = (await res.json()) as { content_id: string; operation: string };
    return {
      channel: variant.channel,
      state: "live",
      live_url: `${API}/articles/${json.content_id}`,
      published_at: new Date().toISOString(),
    };
  }

  async unpublish(liveUrl: string, profile: Profile): Promise<[boolean, string | undefined]> {
    const apiKey = profile.credentials["MANTO_API_KEY"];
    if (!apiKey) return [false, "MANTO_API_KEY not set in profile"];

    // liveUrl looks like https://manto.xin/articles/<content_id>
    const contentId = liveUrl.split("/articles/")[1]?.split(/[?#]/)[0];
    if (!contentId) return [false, `cannot extract content_id from ${liveUrl}`];

    const res = await fetch(`${API}/v1/content/${encodeURIComponent(contentId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return [false, `manto unpublish ${res.status}: ${text}`];
    }
    return [true, undefined];
  }
}

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || `manto-${Date.now()}`
  );
}

/** Body plus CTA, if the variant carries one. */
function joinBody(variant: Variant): string {
  const body = variant.body.trim();
  const cta = variant.cta_block?.trim();
  if (!cta) return body;
  return `${body}\n\n${cta}`;
}
