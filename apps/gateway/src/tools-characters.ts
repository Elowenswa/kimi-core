import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "./db.js";

const COLLECTION = "kimi-room:characters";

type CharacterProfile = {
  id: string;
  name: string;
  displayName: string;
  systemPrompt: string;
  charPrompt: string;
  scenario: string;
  memoryEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

function normalize(value: unknown): CharacterProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<CharacterProfile>;
  if (typeof row.id !== "string" || !row.id || typeof row.name !== "string") return null;
  const now = new Date().toISOString();
  return {
    id: row.id,
    name: row.name.trim() || "未命名角色",
    displayName: typeof row.displayName === "string" ? row.displayName : "TA",
    systemPrompt: typeof row.systemPrompt === "string" ? row.systemPrompt : "",
    charPrompt: typeof row.charPrompt === "string" ? row.charPrompt : "",
    scenario: typeof row.scenario === "string" ? row.scenario : "",
    memoryEnabled: row.memoryEnabled !== false,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : now,
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : now,
  };
}

export function registerCharacterTools(server: McpServer) {
  server.tool(
    "character_profiles",
    "Synchronize kimi-room character profiles for the authenticated owner. Character prompts are stored as structured private PWA data and never exposed through memory search.",
    {
      op: z.enum(["get", "merge"]),
      profiles: z.array(z.unknown()).optional(),
    },
    async ({ op, profiles }) => {
      const rows = await prisma.pwaKv.findMany({ where: { namespace: COLLECTION } });
      const merged = new Map<string, CharacterProfile>();
      for (const row of rows) {
        const profile = normalize(row.payload);
        if (profile) merged.set(profile.id, profile);
      }
      if (op === "merge") {
        for (const value of profiles ?? []) {
          const profile = normalize(value);
          if (!profile) continue;
          const prior = merged.get(profile.id);
          const priorTime = prior ? Date.parse(prior.updatedAt) : 0;
          const nextTime = Date.parse(profile.updatedAt);
          if (!prior || !Number.isFinite(priorTime) || !Number.isFinite(nextTime) || nextTime >= priorTime) {
            merged.set(profile.id, profile);
          }
        }
        for (const profile of merged.values()) {
          await prisma.pwaKv.upsert({
            where: { namespace_key: { namespace: COLLECTION, key: profile.id } },
            create: { namespace: COLLECTION, key: profile.id, payload: profile as unknown as Prisma.InputJsonValue },
            update: { payload: profile as unknown as Prisma.InputJsonValue },
          });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify({ profiles: [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }) }] };
    },
  );
}
