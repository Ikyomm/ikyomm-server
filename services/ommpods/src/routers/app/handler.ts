import type { AppBindings } from "@/types/app";
import { createOpenApiHono } from "@/lib/openapi-hono";
import type { Context } from "hono";
import {
  OmmPodType,
  db,
  musicPlaylists,
  musics,
  organization,
  podMoodPresets,
  podSessions,
  pods,
  userWallet,
  waitlist,
  walletTransactions,
} from "@ikyomm/database";
import {
  createErrorResponse,
  createRequiredAuthSessionMiddleware,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
} from "@ikyomm/utils";
import { and, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { buildSessionResponse, hydratePodAromaDefusers } from "../shared";

export const appGroup = createOpenApiHono<AppBindings>();

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

const waitlistSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

appGroup.post("/waitlist", async (c: Context<AppBindings>) => {
  const payload = await c.req.json().catch(() => null);
  const parsed = waitlistSchema.safeParse(payload);

  if (!parsed.success) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: parsed.error.issues[0]?.message ?? "Invalid waitlist payload.",
      }),
      400
    );
  }

  const { email } = parsed.data;

  await db
    .insert(waitlist)
    .values({
      id: generateRandomId(),
      email,
    })
    .onConflictDoNothing({ target: waitlist.email });

  const [record] = await db.select().from(waitlist).where(eq(waitlist.email, email)).limit(1);

  return c.json(createSuccessResponse(record), 200);
});

appGroup.use("*", appAuthMiddleware);

type AppAromaDefuser = {
  id: string;
  name: string | null;
  macId: string;
  containers?: unknown[] | null;
};

type AppPod = typeof pods.$inferSelect & {
  location?: unknown;
  aromaDefuser: AppAromaDefuser | null;
  aromaDefusers: AppAromaDefuser[];
};

function serializeAppPod(pod: AppPod) {
  return {
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
  };
}

appGroup.get("/me", async (c: Context<AppBindings>) => {
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
        metadata: currentUser.metadata ?? null,
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

appGroup.get("/sessions/active", async (c: Context<AppBindings>) => {
  const { user: currentUser } = getBetterAuthContext(c);

  if (!currentUser) {
    return c.json(
      createErrorResponse({ error: "Unauthorized", message: "Active session not found" }),
      401
    );
  }

  const now = new Date();
  const session = await db.query.podSessions.findFirst({
    where: and(
      eq(podSessions.userId, currentUser.id),
      eq(podSessions.status, "CONFIRMED"),
      eq(podSessions.isDeleted, false),
      gt(podSessions.endAt, now)
    ),
    orderBy: (table, { asc }) => [asc(table.endAt)],
    with: {
      pod: {
        with: {
          location: true,
        },
      },
    },
  });

  const pod = await hydratePodAromaDefusers(session?.pod);

  if (!(session && pod)) {
    return c.json(createSuccessResponse(null), 200);
  }

  return c.json(
    createSuccessResponse({
      session: buildSessionResponse(session, now, pod.location),
      pod: serializeAppPod(pod),
    }),
    200
  );
});

appGroup.get("/pods/:id", async (c: Context<AppBindings>) => {
  const podId = c.req.param("id");
  const podRecord = await db.query.pods.findFirst({
    where: and(eq(pods.id, podId), eq(pods.isDeleted, false)),
  });
  const pod = await hydratePodAromaDefusers(podRecord);

  if (!pod) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Pod not found" }), 404);
  }

  return c.json(createSuccessResponse(serializeAppPod(pod)), 200);
});

appGroup.get("/moods/list", async (c: Context<AppBindings>) => {
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

appGroup.get("/playlists/list", async (c: Context<AppBindings>) => {
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

appGroup.get("/musics/list", async (c: Context<AppBindings>) => {
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
