import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  OmmPodType,
  db,
  musicPlaylists,
  musics,
  organization,
  podMoodPresets,
  pods,
  userWallet,
  walletTransactions,
} from "@ikyomm/database";
import {
  createErrorResponse,
  createRequiredAuthSessionMiddleware,
  createSuccessResponse,
  getBetterAuthContext,
} from "@ikyomm/utils";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { hydratePodAromaDefusers } from "../shared";

export const appGroup = new OpenAPIHono<AppBindings>();

const appAuthMiddleware = createRequiredAuthSessionMiddleware({
  entities: {
    user: true,
    session: true,
    data: false,
    organization: false,
    hasOrganization: false,
  },
  enableRedisCache: true,
});

appGroup.use("*", appAuthMiddleware);

appGroup.get("/me", async (c) => {
  const { user: currentUser } = getBetterAuthContext(c);

  if (!currentUser) {
    return c.json(
      createErrorResponse({ error: "Unauthorized", message: "Active session not found" }),
      401
    );
  }

  const wallet = await db.query.userWallet.findFirst({
    where: and(eq(userWallet.userId, currentUser.id), eq(userWallet.isDeleted, false)),
  });
  const company =
    currentUser.company && typeof currentUser.company === "string"
      ? await db.query.organization.findFirst({
          where: and(eq(organization.id, currentUser.company), eq(organization.isDeleted, false)),
        })
      : null;

  const transactions = wallet
    ? await db
        .select()
        .from(walletTransactions)
        .where(
          and(
            eq(walletTransactions.isDeleted, false),
            or(
              eq(walletTransactions.fromUserWalletId, wallet.id),
              eq(walletTransactions.toUserWalletId, wallet.id)
            )
          )
        )
        .orderBy(desc(walletTransactions.transactedAt))
        .limit(20)
    : [];

  return c.json(
    createSuccessResponse({
      user: {
        id: currentUser.id,
        name: currentUser.name ?? null,
        email: currentUser.email ?? null,
        emailVerified: currentUser.emailVerified ?? false,
        role: currentUser.role ?? null,
        panel: currentUser.panel ?? null,
        companyId: currentUser.company ?? null,
      },
      company: company
        ? {
            id: company.id,
            name: company.name,
            email: company.email,
            type: company.type,
            isActive: company.isActive,
          }
        : null,
      wallet: wallet
        ? {
            id: wallet.id,
            creditMinute: wallet.creditMinute,
          }
        : null,
      transactions: transactions.map((transaction) => ({
        ...transaction,
        direction:
          transaction.fromUserWalletId === wallet?.id && transaction.toUserWalletId === wallet?.id
            ? transaction.type === "DEBIT"
              ? ("debit" as const)
              : transaction.type === "CREDIT"
                ? ("credit" as const)
                : ("internal" as const)
            : transaction.toUserWalletId === wallet?.id
              ? ("credit" as const)
              : ("debit" as const),
      })),
    }),
    200
  );
});

appGroup.get("/pods/:id", async (c) => {
  const podId = c.req.param("id");
  const podRecord = await db.query.pods.findFirst({
    where: and(eq(pods.id, podId), eq(pods.isDeleted, false)),
  });
  const pod = await hydratePodAromaDefusers(podRecord);

  if (!pod) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Pod not found" }), 404);
  }

  return c.json(
    createSuccessResponse({
      ...pod,
      rateConfig: pod.rateConfig ?? [],
      connectedDeviceConfig: pod.connectedDeviceConfig ?? [],
      aromaDefuser: pod.aromaDefuser
        ? {
            id: pod.aromaDefuser.id,
            name: pod.aromaDefuser.name,
            macId: pod.aromaDefuser.macId,
            containers: pod.aromaDefuser.containers ?? [],
          }
        : null,
      aromaDefusers: (pod.aromaDefusers ?? []).map((aromaDefuser) => ({
        id: aromaDefuser.id,
        name: aromaDefuser.name,
        macId: aromaDefuser.macId,
        containers: aromaDefuser.containers ?? [],
      })),
    }),
    200
  );
});

appGroup.get("/moods/list", async (c) => {
  const podType = c.req.query("podType");
  const isKnownPodType = (value: string): value is (typeof OmmPodType.enumValues)[number] =>
    OmmPodType.enumValues.includes(value as (typeof OmmPodType.enumValues)[number]);

  if (podType && !isKnownPodType(podType)) {
    return c.json(createErrorResponse({ error: "Bad Request", message: "Invalid pod type" }), 400);
  }

  const moods = await db.query.podMoodPresets.findMany({
    where: and(
      eq(podMoodPresets.isDeleted, false),
      podType ? sql`${podType}::ommpod_type = ANY(${podMoodPresets.enabledPodTypes})` : undefined
    ),
    orderBy: (table, { asc }) => [asc(table.title)],
  });

  return c.json(createSuccessResponse(moods), 200);
});

appGroup.get("/playlists/list", async (c) => {
  const moodPresetId = c.req.query("moodPresetId");
  const moodPreset = moodPresetId
    ? await db.query.podMoodPresets.findFirst({
        where: and(eq(podMoodPresets.id, moodPresetId), eq(podMoodPresets.isDeleted, false)),
      })
    : null;
  const playlistIds = moodPreset?.playlistIds ?? [];

  if (moodPresetId && playlistIds.length === 0) {
    return c.json(createSuccessResponse([]), 200);
  }

  const playlists = await db.query.musicPlaylists.findMany({
    where: and(
      eq(musicPlaylists.isDeleted, false),
      playlistIds.length > 0 ? inArray(musicPlaylists.id, playlistIds) : undefined
    ),
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  return c.json(createSuccessResponse(playlists), 200);
});

appGroup.get("/musics/list", async (c) => {
  const playlistId = c.req.query("playlistId");

  if (!playlistId) {
    return c.json(createSuccessResponse([]), 200);
  }

  const items = await db.query.musics.findMany({
    where: and(eq(musics.playlistId, playlistId), eq(musics.isDeleted, false)),
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  return c.json(createSuccessResponse(items), 200);
});
