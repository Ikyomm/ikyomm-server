/** biome-ignore-all lint/style/noNonNullAssertion: forced */
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { type DB, db, initDB, musicPlaylists, musics, podMoodPresets } from "./index";

type PlaylistSync = {
  id: string;
  name: string;
  files: Array<{
    id: string;
    name: string;
    fileUrl: string;
  }>;
};

type MusicDbClient = Pick<DB, "query" | "select" | "insert" | "delete" | "transaction">;

type MoodPresetSync = {
  title: string;
  playlistName: string;
};

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg", ".webm"]);
const RANDOM_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const RANDOM_ID_MAX_UNBIASED_VALUE =
  Math.floor(256 / RANDOM_ID_CHARS.length) * RANDOM_ID_CHARS.length;
const RANDOM_ID_LENGTH = 6;
const MANUAL_MOOD_PRESETS = new Set(["Rest"]);
const MOOD_PRESET_SYNC_MAP: MoodPresetSync[] = [
  { title: "Uplift", playlistName: "uplifted" },
  { title: "Still", playlistName: "still" },
  { title: "Recharge", playlistName: "recharge" },
  { title: "Lucid", playlistName: "lucid" },
  { title: "Ground", playlistName: "grounded" },
  { title: "Focus", playlistName: "focused" },
  { title: "Energy", playlistName: "energised" },
  { title: "Calm", playlistName: "calm" },
];

function generateRandomPart(length: number): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error("length must be a positive integer");
  }

  const output = new Array<string>(length);
  let index = 0;

  while (index < length) {
    const bytes = randomBytes(length - index);

    for (const byte of bytes) {
      if (byte >= RANDOM_ID_MAX_UNBIASED_VALUE) {
        continue;
      }

      output[index] = RANDOM_ID_CHARS[byte % RANDOM_ID_CHARS.length] as string;
      index += 1;

      if (index === length) {
        break;
      }
    }
  }

  return output.join("");
}

function generateRandomId(): string {
  return `OMIX${generateRandomPart(RANDOM_ID_LENGTH)}`;
}

function loadDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const envPath = resolve(process.cwd(), "../../env/.env");
  if (!existsSync(envPath)) {
    return undefined;
  }

  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const [key, ...valueParts] = trimmedLine.split("=");
    if (key === "DATABASE_URL") {
      return valueParts.join("=").trim();
    }
  }

  return undefined;
}

function getMusicRoot(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return resolve(currentDir, "../../../migrate/music");
}

function getRelativeWebPath(playlistName: string, fileName: string): string {
  return `/migrate/music/${encodeURIComponent(playlistName)}/${encodeURIComponent(fileName)}`;
}

function buildMusicId(): string {
  return generateRandomId();
}

function isAudioFile(fileName: string): boolean {
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1) {
    return false;
  }

  return AUDIO_EXTENSIONS.has(fileName.slice(lastDotIndex).toLowerCase());
}

function readPlaylistSync(rootDirectory: string): PlaylistSync[] {
  const entries = readdirSync(rootDirectory, { withFileTypes: true });
  const playlistFolders = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  return playlistFolders.map((playlistName) => {
    const playlistDirectory = resolve(rootDirectory, playlistName);
    const files = readdirSync(playlistDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.name.startsWith(".") && isAudioFile(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));

    return {
      id: generateRandomId(),
      name: playlistName,
      files: files.map((fileName) => ({
        id: buildMusicId(),
        name: fileName.replace(/\.[^.]+$/, "").trim(),
        fileUrl: getRelativeWebPath(playlistName, fileName),
      })),
    };
  });
}

function buildMoodPresetUpdates(playlists: PlaylistSync[]): Array<{
  title: string;
  playlistIds: string[];
  defaultMusic: string;
}> {
  const playlistByName = new Map(playlists.map((playlist) => [playlist.name, playlist]));

  return MOOD_PRESET_SYNC_MAP.flatMap((moodPreset) => {
    if (MANUAL_MOOD_PRESETS.has(moodPreset.title)) {
      return [];
    }

    const playlist = playlistByName.get(moodPreset.playlistName);
    if (!playlist || playlist.files.length === 0) {
      return [];
    }

    return [
      {
        title: moodPreset.title,
        playlistIds: [playlist.id],
        defaultMusic: playlist.files[0]!.id,
      },
    ];
  });
}

async function syncPlaylists(client: MusicDbClient, playlists: PlaylistSync[]): Promise<void> {
  if (playlists.length === 0) {
    return;
  }

  await client.insert(musicPlaylists).values(
    playlists.map((playlist) => ({
      id: playlist.id,
      name: playlist.name,
      avatar: null,
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      createdByUser: null,
      updatedByUser: null,
    }))
  );
}

async function syncMusics(client: MusicDbClient, playlists: PlaylistSync[]): Promise<void> {
  const musicRows = playlists.flatMap((playlist) =>
    playlist.files.map((file) => ({
      id: file.id,
      name: file.name,
      playlistId: playlist.id,
      fileUrl: file.fileUrl,
      avatar: null,
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      createdByUser: null,
      updatedByUser: null,
    }))
  );

  if (musicRows.length === 0) {
    return;
  }

  await client.insert(musics).values(musicRows);
}

async function getMusicRowCount(client: MusicDbClient): Promise<number> {
  const [result] = await client.select({ count: sql<number>`count(*)::int` }).from(musics);
  return result?.count ?? 0;
}

async function syncMusicLibrary(): Promise<void> {
  const databaseUrl = loadDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for music sync commands");
  }

  await initDB({
    databaseUrl,
    serviceName: "music-sync",
  });

  const rootDirectory = getMusicRoot();
  const playlists = readPlaylistSync(rootDirectory);
  const expectedTrackCount = playlists.reduce(
    (total, playlist) => total + playlist.files.length,
    0
  );
  const moodPresetUpdates = buildMoodPresetUpdates(playlists);

  await db.transaction(async (client) => {
    await client.delete(musics);
    await client.delete(musicPlaylists);

    await syncPlaylists(client, playlists);
    await syncMusics(client, playlists);

    for (const moodPreset of moodPresetUpdates) {
      await client
        .update(podMoodPresets)
        .set({
          playlistIds: moodPreset.playlistIds,
          defaultMusic: moodPreset.defaultMusic,
        })
        .where(eq(podMoodPresets.title, moodPreset.title));
    }
  });

  const actualTrackCount = await getMusicRowCount(db);
  if (actualTrackCount !== expectedTrackCount) {
    throw new Error(
      `Music sync count mismatch: expected ${expectedTrackCount} tracks from local folders, found ${actualTrackCount} rows in the database.`
    );
  }

  console.log(
    `Music sync completed for ${playlists.length} playlists and ${actualTrackCount} tracks.`
  );
}

await syncMusicLibrary();
