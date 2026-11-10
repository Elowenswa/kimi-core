import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "./db.js";

const COLLECTION = "kimi-room:user-identities";

type UserIdentity = {
  id: string;
  name: string;
  nickname: string;
  occupation: string;
  languages: string;
  responseStyle: string;
  notes: string;
  enabled: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

function normalize(value: unknown): UserIdentity | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<UserIdentity>;
  if (typeof row.id !== "string" || !row.id || typeof row.name !== "string") return null;
  const now = new Date().toISOString();
  return {
    id: row.id,
    name: row.name.trim() || "you",
    nickname: typeof row.nickname === "string" ? row.nickname.trim() : "",
    occupation: typeof row.occupation === "string" ? row.occupation.trim() : "",
    languages: typeof row.languages === "string" ? row.languages.trim() : "",
    responseStyle: typeof row.responseStyle === "string" ? row.responseStyle.trim() : "",
    notes: typeof row.notes === "string" ? row.notes.trim() : "",
    enabled: row.enabled !== false,
    isDefault: row.isDefault === true,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : now,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : now,
  };
}

function parseBundle(payload: unknown): { identity?: UserIdentity; activeId?: string } {
  if (!payload || typeof payload !== "object") return {};
  const row = payload as { identity?: unknown; activeId?: unknown };
  const identity = normalize(row.identity);
  return {
    ...(identity ? { identity } : {}),
    ...(typeof row.activeId === "string" ? { activeId: row.activeId } : {}),
  };
}

export function registerUserIdentityTools(server: McpServer) {
  server.tool(
    "user_identities",
    "Synchronize private kimi-room user identities for the authenticated owner. Identity data is separate from character profiles and memory namespaces.",
    {
      op: z.enum(["get", "merge"]),
      identities: z.array(z.unknown()).optional(),
      activeId: z.string().optional(),
    },
    async ({ op, identities, activeId }) => {
      const rows = await prisma.pwaKv.findMany({ where: { namespace: COLLECTION } });
      const merged = new Map<string, UserIdentity>();
      let remoteActiveId: string | undefined;
      for (const row of rows) {
        const bundle = parseBundle(row.payload);
        if (bundle.identity) merged.set(bundle.identity.id, bundle.identity);
        if (bundle.activeId) remoteActiveId = bundle.activeId;
      }

      if (op === "merge") {
        for (const value of identities ?? []) {
          const identity = normalize(value);
          if (!identity) continue;
          const prior = merged.get(identity.id);
          const priorTime = prior ? Date.parse(prior.updatedAt) : 0;
          const nextTime = Date.parse(identity.updatedAt);
          if (!prior || !Number.isFinite(priorTime) || !Number.isFinite(nextTime) || nextTime >= priorTime) {
            merged.set(identity.id, identity);
          }
        }
        remoteActiveId = typeof activeId === "string" && merged.has(activeId) ? activeId : remoteActiveId;
        if (!remoteActiveId) remoteActiveId = [...merged.values()].find((identity) => identity.isDefault && identity.enabled)?.id;
        for (const identity of merged.values()) {
          await prisma.pwaKv.upsert({
            where: { namespace_key: { namespace: COLLECTION, key: identity.id } },
            create: { namespace: COLLECTION, key: identity.id, payload: { identity, activeId: identity.id === remoteActiveId ? remoteActiveId : undefined } as unknown as Prisma.InputJsonValue },
            update: { payload: { identity, activeId: identity.id === remoteActiveId ? remoteActiveId : undefined } as unknown as Prisma.InputJsonValue },
          });
        }
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ identities: [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), activeId: remoteActiveId }) }],
      };
    },
  );
}
