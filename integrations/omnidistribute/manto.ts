import axios from "axios";
import type { Adapter, Post, PublishResult } from "../types.js";
import { logger } from "../utils/logger.js";

const API = process.env.MANTO_BASE_URL || "https://manto.xin";
const DAILY_QUOTA_HINT = "Manto daily quota exceeded; retries will not help until the next day";

/**
 * Manto (馒头新闻, https://manto.xin) — an agent-first news network.
 *
 * Publishes to Manto's public HTTP API. `external_id` is the idempotency key, so
 * the post slug is used: re-publishing an unchanged post returns `unchanged` and
 * costs no quota, while changed content updates in place instead of duplicating.
 *
 * Env:
 *   MANTO_API_KEY  required, issued once at `POST /v1/accounts`
 *   MANTO_BASE_URL optional, defaults to https://manto.xin
 */
export class MantoAdapter implements Adapter {
  name = "manto";
  enabled = true;

  async validate(): Promise<boolean> {
    if (!process.env.MANTO_API_KEY) {
      logger.warn("MANTO_API_KEY is missing");
      return false;
    }
    return true;
  }

  async publish(post: Post): Promise<PublishResult> {
    const apiKey = process.env.MANTO_API_KEY;
    if (!apiKey) {
      return { platform: this.name, success: false, error: "MANTO_API_KEY is not set" };
    }

    try {
      const response = await axios.post(
        `${API}/v1/content`,
        {
          external_id: post.slug,
          title: post.title,
          content: post.content,
          // Prefer the origin-site URL so Manto attributes the source correctly,
          // falling back to the primary platform URL.
          url: post.canonicalUrl || post.publishedUrl,
        },
        {
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
        },
      );

      const data = response.data as {
        content_id: string;
        operation: "created" | "updated" | "unchanged";
      };

      return {
        platform: this.name,
        success: true,
        url: `${API}/articles/${data.content_id}`,
        postId: data.content_id,
      };
    } catch (error: any) {
      const message = error.response?.data?.error || error.message;
      if (message === "daily_quota_exceeded") {
        logger.warn(DAILY_QUOTA_HINT);
      }
      return { platform: this.name, success: false, error: message };
    }
  }

  /**
   * Manto has no separate update endpoint: re-publishing with the same
   * external_id updates in place. `postId` is echoed for state tracking.
   */
  async update(post: Post, postId: string): Promise<PublishResult> {
    const result = await this.publish(post);
    if (result.success) {
      logger.info(`Manto updated content ${postId} in place via external_id`);
    }
    return result;
  }
}
