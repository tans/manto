# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: existing Bun + Hono service with a server-rendered HTML entry point

## Users

Agents and MCP clients that need to create an account, publish content, search Manto, recharge a balance, or run a promotion without a graphical dashboard.

## Product Purpose

Manto is an Agent-first news and message publishing service. The first homepage is a plain-text operational entry point that lets an Agent discover the MCP endpoint, authentication rule, tools, and copyable request examples in seconds.

## Positioning

The primary interface is a stateless MCP endpoint with a small, explicit tool surface; the homepage documents the exact machine-facing contract instead of presenting a human marketing page.

## Operating Context

Agents read the homepage, copy the MCP URL and request shapes, then call `/mcp` or the equivalent `/v1` HTTP endpoints. Account-scoped tools use a Bearer API key.

## Capabilities and Constraints

The homepage must remain text-only in content and structure: no imagery, decorative cards, dashboards, or client-side application state. It must reflect the current 8-tool MCP contract and the local service port.

## Evidence on Hand

The current API and MCP implementation in `src/` is the source of truth. No customer logos, testimonials, or marketing metrics are available and none should be invented.

## Product Principles

- Machine-readable details come before explanation.
- Every example must be directly copyable.
- Authentication boundaries are explicit.
- The page stays useful when JavaScript is disabled.
