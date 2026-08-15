import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, ilike, inArray } from "drizzle-orm";
import { closeDB, db, initDB, musicPlaylists, musics, podMoodPresets } from "./index";

type EnvValues = {
  DATABASE_URL?: string;
  BUCKET_REGION?: string;
  BUCKET_ACCESS_KEY?: string;
  BUCKET_SECRET_KEY?: string;
  BUCKET_NAME?: string;
};

type PlaylistUpload = {
  folderName: string;
  moodTitle: string;
  objectFolder: string;
  files: AudioFile[];
};

type AudioFile = {
  fileName: string;
  name: string;
  path: string;
  objectKey: string;
  url: string;
  contentType: string;
};

type PlaylistRow = typeof musicPlaylists.$inferSelect;
type MusicRow = typeof musics.$inferSelect;

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg", ".webm"]);
const CONTENT_TYPES = new Map([
  [".mp3", "audio/mpeg"],
  [".wav", "audio/wav"],
  [".m4a", "audio/mp4"],
  [".flac", "audio/flac"],
  [".aac", "audio/aac"],
  [".ogg", "audio/ogg"],
  [".webm", "audio/webm"],
]);
const RANDOM_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const RANDOM_ID_LENGTH = 6;
const dryRun = !process.argv.includes("--apply");

function getArgValues(flag: string): string[] {
  return process.argv.flatMap((arg, index, args) => {
    if (arg === flag) {
      const value = args[index + 1];
      return value ? [value] : [];
    }

    if (arg.startsWith(`${flag}=`)) {
      return [arg.slice(flag.length + 1)];
    }

    return [];
  });
}

const onlyFolders = new Set(getArgValues("--only").map(normalizeName));
const skipFolders = new Set(getArgValues("--skip").map(normalizeName));

function loadEnvFile(path: string): EnvValues {
  if (!existsSync(path)) {
    return {};
  }

  const values: EnvValues = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim() as keyof EnvValues;
    let value = trimmedLine.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function requireEnv(values: EnvValues, key: keyof EnvValues): string {
  const value = values[key] ?? process.env[key];
  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function sanitizeSegment(value: string): string {
  return value
    .trim()
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) =>
      segment
        .normalize("NFKD")
        .replace(/[^\w.-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()
    )
    .filter(Boolean)
    .join("/");
}

function splitFileName(fileName: string): { baseName: string; extension: string } {
  const trimmed = fileName.trim();
  const lastDotIndex = trimmed.lastIndexOf(".");

  if (lastDotIndex <= 0 || lastDotIndex === trimmed.length - 1) {
    return { baseName: trimmed || "file", extension: "" };
  }

  return {
    baseName: trimmed.slice(0, lastDotIndex) || "file",
    extension: trimmed.slice(lastDotIndex + 1),
  };
}

function sanitizeFileName(fileName: string): string {
  const { baseName, extension } = splitFileName(fileName);
  const safeBaseName = sanitizeSegment(baseName).replace(/\//g, "-") || "file";
  const safeExtension = sanitizeSegment(extension).replace(/\//g, "");

  return safeExtension ? `${safeBaseName}.${safeExtension}` : safeBaseName;
}

function buildObjectUrl(bucketName: string, bucketRegion: string, key: string): string {
  const baseUrl = `https://${bucketName}.${bucketRegion}.linodeobjects.com`;
  return `${baseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function getServerRoot(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return resolve(currentDir, "../../..");
}

function getMusicRoot(): string {
  return resolve(getServerRoot(), "migrate/music");
}

function readPlaylistUploads(bucketName: string, bucketRegion: string): PlaylistUpload[] {
  const rootDirectory = getMusicRoot();
  if (!existsSync(rootDirectory)) {
    throw new Error(`Music folder not found: ${rootDirectory}`);
  }

  return readdirSync(rootDirectory, { withFileTypes: true })
    .filter((entry) => {
      const normalizedName = normalizeName(entry.name);
      return (
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        (onlyFolders.size === 0 || onlyFolders.has(normalizedName)) &&
        !skipFolders.has(normalizedName)
      );
    })
    .map((entry) => {
      const directory = resolve(rootDirectory, entry.name);
      const objectFolder = `music/${sanitizeSegment(entry.name)}`;
      const files = readdirSync(directory, { withFileTypes: true })
        .filter((fileEntry) => {
          const extension = extname(fileEntry.name).toLowerCase();
          return (
            fileEntry.isFile() && !fileEntry.name.startsWith(".") && AUDIO_EXTENSIONS.has(extension)
          );
        })
        .map((fileEntry) => {
          const extension = extname(fileEntry.name).toLowerCase();
          const objectKey = `${objectFolder}/${sanitizeFileName(fileEntry.name)}`;

          return {
            fileName: fileEntry.name,
            name: fileEntry.name.replace(/\.[^.]+$/, "").trim(),
            path: resolve(directory, fileEntry.name),
            objectKey,
            url: buildObjectUrl(bucketName, bucketRegion, objectKey),
            contentType: CONTENT_TYPES.get(extension) ?? "application/octet-stream",
          };
        })
        .sort((left, right) => left.fileName.localeCompare(right.fileName));

      return {
        folderName: entry.name,
        moodTitle: entry.name,
        objectFolder,
        files,
      };
    })
    .filter((playlist) => playlist.files.length > 0)
    .sort((left, right) => left.folderName.localeCompare(right.folderName));
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function sha256Hex(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function getSigningKey(secretKey: string, dateStamp: string, region: string): Buffer {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, "s3");
  return hmac(kService, "aws4_request");
}

function getAmzDate(date: Date): { amzDate: string; dateStamp: string } {
  const iso = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  };
}

function getAuthorizationHeader({
  accessKey,
  secretKey,
  region,
  objectKey,
  headers,
  payloadHash,
}: {
  accessKey: string;
  secretKey: string;
  region: string;
  objectKey: string;
  headers: Record<string, string>;
  payloadHash: string;
}): string {
  const { amzDate, dateStamp } = getAmzDate(new Date());
  headers["x-amz-date"] = amzDate;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name]!.trim().replace(/\s+/g, " ")}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");
  const canonicalUri = `/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  const canonicalRequest = [
    "PUT",
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const signature = createHmac("sha256", getSigningKey(secretKey, dateStamp, region))
    .update(stringToSign)
    .digest("hex");

  return [
    "AWS4-HMAC-SHA256",
    `Credential=${accessKey}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");
}

async function uploadFile({
  file,
  bucketName,
  bucketRegion,
  accessKey,
  secretKey,
}: {
  file: AudioFile;
  bucketName: string;
  bucketRegion: string;
  accessKey: string;
  secretKey: string;
}): Promise<void> {
  const body = readFileSync(file.path);
  const payloadHash = sha256Hex(body);
  const host = `${bucketName}.${bucketRegion}.linodeobjects.com`;
  const headers: Record<string, string> = {
    "cache-control": "public, max-age=31536000, immutable",
    "content-type": file.contentType,
    host,
    "x-amz-acl": "public-read",
    "x-amz-content-sha256": payloadHash,
    "x-amz-meta-originalname": encodeURIComponent(file.fileName),
  };
  const authorization = getAuthorizationHeader({
    accessKey,
    secretKey,
    region: bucketRegion,
    objectKey: file.objectKey,
    headers,
    payloadHash,
  });
  const response = await fetch(file.url, {
    method: "PUT",
    headers: {
      ...headers,
      authorization,
    },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `Upload failed for ${file.fileName}: ${response.status} ${response.statusText}`
    );
  }
}

function generateRandomPart(length: number): string {
  const output = new Array<string>(length);
  let index = 0;
  const maxUnbiasedValue = Math.floor(256 / RANDOM_ID_CHARS.length) * RANDOM_ID_CHARS.length;

  while (index < length) {
    for (const byte of randomBytes(length - index)) {
      if (byte >= maxUnbiasedValue) {
        continue;
      }
      output[index] = RANDOM_ID_CHARS[byte % RANDOM_ID_CHARS.length]!;
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

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

async function getOrCreatePlaylist(upload: PlaylistUpload): Promise<PlaylistRow> {
  const mood = await db.query.podMoodPresets.findFirst({
    where: eq(podMoodPresets.title, upload.moodTitle),
  });
  const moodPlaylistIds = Array.isArray(mood?.playlistIds) ? mood.playlistIds : [];

  if (moodPlaylistIds.length > 0) {
    const linkedPlaylists = await db
      .select()
      .from(musicPlaylists)
      .where(inArray(musicPlaylists.id, moodPlaylistIds));
    const linkedPlaylist = linkedPlaylists.find(
      (playlist) => normalizeName(playlist.name) === normalizeName(upload.folderName)
    );

    if (linkedPlaylist) {
      return linkedPlaylist;
    }
  }

  const existingPlaylist = await db.query.musicPlaylists.findFirst({
    where: ilike(musicPlaylists.name, upload.folderName),
  });

  if (existingPlaylist) {
    return existingPlaylist;
  }

  const [playlist] = await db
    .insert(musicPlaylists)
    .values({
      id: generateRandomId(),
      name: upload.folderName,
      avatar: null,
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      createdByUser: null,
      updatedByUser: null,
    })
    .returning();

  if (!playlist) {
    throw new Error(`Unable to create ${upload.folderName} playlist`);
  }

  return playlist;
}

async function upsertMusicRows(playlist: PlaylistRow, files: AudioFile[]): Promise<MusicRow[]> {
  const existingRows = await db
    .select()
    .from(musics)
    .where(and(eq(musics.playlistId, playlist.id), eq(musics.isDeleted, false)));
  const existingByName = new Map(existingRows.map((row) => [normalizeName(row.name), row]));
  const syncedRows: MusicRow[] = [];

  for (const file of files) {
    const existing = existingByName.get(normalizeName(file.name));

    if (existing) {
      const [updated] = await db
        .update(musics)
        .set({
          fileUrl: file.url,
          updatedByUser: null,
        })
        .where(eq(musics.id, existing.id))
        .returning();

      if (!updated) {
        throw new Error(`Unable to update music row for ${file.name}`);
      }

      syncedRows.push(updated);
      continue;
    }

    const [inserted] = await db
      .insert(musics)
      .values({
        id: generateRandomId(),
        name: file.name,
        playlistId: playlist.id,
        fileUrl: file.url,
        avatar: null,
        isDeleted: false,
        deletedAt: null,
        deletedByUser: null,
        createdByUser: null,
        updatedByUser: null,
      })
      .returning();

    if (!inserted) {
      throw new Error(`Unable to insert music row for ${file.name}`);
    }

    syncedRows.push(inserted);
  }

  return syncedRows;
}

async function attachPlaylistToMood(
  upload: PlaylistUpload,
  playlist: PlaylistRow,
  musicRows: MusicRow[]
) {
  const defaultMusic = musicRows[0]?.id;
  if (!defaultMusic) {
    throw new Error(`${upload.folderName} playlist has no music rows`);
  }

  const [updatedMood] = await db
    .update(podMoodPresets)
    .set({
      playlistIds: [playlist.id],
      defaultMusic,
      updatedByUser: null,
    })
    .where(eq(podMoodPresets.title, upload.moodTitle))
    .returning({ id: podMoodPresets.id });

  if (!updatedMood) {
    console.warn(
      `Mood preset not found for ${upload.moodTitle}; music records were still updated.`
    );
  }
}

async function main(): Promise<void> {
  const serverRoot = getServerRoot();
  const serverEnv = loadEnvFile(resolve(serverRoot, "env/.env"));
  const softwareEnv = loadEnvFile(resolve(serverRoot, "../ikyomm-software/.env"));
  const envValues = { ...serverEnv, ...softwareEnv };
  const databaseUrl = requireEnv(envValues, "DATABASE_URL");
  const bucketName = requireEnv(envValues, "BUCKET_NAME");
  const bucketRegion = requireEnv(envValues, "BUCKET_REGION");
  const accessKey = requireEnv(envValues, "BUCKET_ACCESS_KEY");
  const secretKey = requireEnv(envValues, "BUCKET_SECRET_KEY");
  const uploads = readPlaylistUploads(bucketName, bucketRegion);
  const trackCount = uploads.reduce((total, upload) => total + upload.files.length, 0);

  if (uploads.length === 0) {
    throw new Error("No playlist audio files found for the requested filters");
  }

  await initDB({ databaseUrl, serviceName: "music-upload" });

  console.log(`${dryRun ? "Dry run" : "Applying"} music upload`);
  console.log(`Playlists: ${uploads.length}`);
  console.log(`Tracks: ${trackCount}`);

  for (const upload of uploads) {
    const playlist = await getOrCreatePlaylist(upload);
    console.log(`\n${upload.folderName}: ${playlist.id} (${upload.files.length} tracks)`);

    for (const file of upload.files) {
      console.log(`- ${file.fileName} -> ${file.url}`);
    }
  }

  if (dryRun) {
    await closeDB();
    console.log("\nDry run only. Re-run with --apply to upload and update records.");
    return;
  }

  let updatedCount = 0;

  for (const upload of uploads) {
    const playlist = await getOrCreatePlaylist(upload);
    console.log(`\nUploading ${upload.folderName}`);

    for (const file of upload.files) {
      await uploadFile({
        file,
        bucketName,
        bucketRegion,
        accessKey,
        secretKey,
      });
      console.log(`Uploaded ${upload.folderName}/${file.fileName}`);
    }

    const syncedRows = await upsertMusicRows(playlist, upload.files);
    await attachPlaylistToMood(upload, playlist, syncedRows);
    updatedCount += syncedRows.length;
    console.log(`Updated ${syncedRows.length} ${upload.folderName} music records.`);
  }

  await closeDB();
  console.log(`\nUpdated ${updatedCount} music records across ${uploads.length} playlists.`);
}

await main();
