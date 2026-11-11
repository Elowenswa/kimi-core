import { afterAll, beforeAll, describe, expect, it } from "vitest";
import prisma from "../db.js";
import { scoreMemories } from "./retrieval.js";

// Run against a disposable local PostgreSQL only. CI without a database still
// runs the pure retrieval tests and skips this integration layer safely.
const local = process.env.DATABASE_URL?.includes("localhost") ? describe : describe.skip;

local("memory_search_safe tag filtering — PostgreSQL integration", () => {
  const marker = `tag-filter-${Date.now()}`;
  const namespaceA = `${marker}:character-a`;
  const namespaceB = `${marker}:character-b`;
  const ids: string[] = [];

  beforeAll(async () => {
    const rows = await Promise.all([
      prisma.memory.create({
        data: {
          namespace: namespaceA,
          title: `${marker} reading preference`,
          summary: "The user prefers quiet reading sessions.",
          content: "The user prefers quiet reading sessions.",
          tags: ["preference", "reading"],
          memoryType: "PREFERENCE",
          sourceType: "MANUAL",
        },
      }),
      prisma.memory.create({
        data: {
          namespace: namespaceA,
          title: `${marker} travel preference`,
          summary: "The user prefers rail travel.",
          content: "The user prefers rail travel.",
          tags: ["preference", "travel"],
          memoryType: "PREFERENCE",
          sourceType: "MANUAL",
        },
      }),
      prisma.memory.create({
        data: {
          namespace: namespaceA,
          title: `${marker} closed preference`,
          summary: "This closed preference must not be returned.",
          content: "This closed preference must not be returned.",
          tags: ["preference", "closed"],
          memoryType: "PREFERENCE",
          sourceType: "MANUAL",
          isActive: false,
        },
      }),
      prisma.memory.create({
        data: {
          namespace: namespaceA,
          title: `${marker} restricted preference`,
          summary: "This restricted row must not enter the safe default pool.",
          content: "This restricted row must not enter the safe default pool.",
          tags: ["preference", "restricted"],
          memoryType: "RESTRICTED",
          sourceType: "MANUAL",
        },
      }),
      prisma.memory.create({
        data: {
          namespace: namespaceB,
          title: `${marker} other character preference`,
          summary: "This belongs to another character namespace.",
          content: "This belongs to another character namespace.",
          tags: ["preference", "reading"],
          memoryType: "PREFERENCE",
          sourceType: "MANUAL",
        },
      }),
    ]);
    ids.push(...rows.map((row) => row.id));
  });

  afterAll(async () => {
    if (ids.length) await prisma.memory.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("returns only memories matching any requested tag", async () => {
    const rows = await scoreMemories(marker, {
      namespace: namespaceA,
      tags: ["reading"],
      limit: 20,
    });

    expect(rows.map((row) => row.title)).toEqual([`${marker} reading preference`]);
  });

  it("treats multiple tags as OR and still applies namespace isolation", async () => {
    const rows = await scoreMemories(marker, {
      namespace: namespaceA,
      tags: ["reading", "travel"],
      limit: 20,
    });
    const titles = rows.map((row) => row.title);

    expect(titles).toEqual(expect.arrayContaining([
      `${marker} reading preference`,
      `${marker} travel preference`,
    ]));
    expect(titles).not.toContain(`${marker} other character preference`);
    expect(titles).not.toContain(`${marker} closed preference`);
    expect(titles).not.toContain(`${marker} restricted preference`);
  });

  it("normalizes hash-prefixed tags before applying JSONB filtering", async () => {
    const rows = await scoreMemories(marker, {
      namespace: namespaceA,
      tags: ["#travel"],
      limit: 20,
    });

    expect(rows.map((row) => row.title)).toEqual([`${marker} travel preference`]);
  });

  it("returns no rows for a tag absent from the namespace", async () => {
    const rows = await scoreMemories(marker, {
      namespace: namespaceA,
      tags: ["does-not-exist"],
      limit: 20,
    });

    expect(rows).toEqual([]);
  });
});
