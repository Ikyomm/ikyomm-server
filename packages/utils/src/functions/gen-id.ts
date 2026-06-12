import { randomBytes } from "node:crypto";

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const CHARS_LENGTH = CHARS.length;
const MAX_UNBIASED_RANDOM_VALUE = Math.floor(256 / CHARS_LENGTH) * CHARS_LENGTH;

const RANDOM_SUFFIX_LENGTH = 6;

const COMPANY_ID_PREFIX = "OMCO";
const COMPANY_ID_REGEX = /^OMCO[A-Z0-9]{6}$/;
const FIRST_COMPANY_ID = "OMCO000001";
const COMPANY_SEQUENCE_MAX = 36 ** RANDOM_SUFFIX_LENGTH - 1;

const OMMPODS_ID_PREFIX = "OMPD";
const OMMPODS_ID_REGEX = /^OMPD[A-Z0-9]{6}$/;
const FIRST_OMMPODS_ID = "OMPD000001";
const OMMPODS_SEQUENCE_MAX = 36 ** RANDOM_SUFFIX_LENGTH - 1;

function generateRandomPart(length: number): string {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error("length must be a positive integer");
  }

  const output = new Array<string>(length);
  let index = 0;

  while (index < length) {
    const bytes = randomBytes(length - index);

    for (const byte of bytes) {
      if (byte >= MAX_UNBIASED_RANDOM_VALUE) {
        continue;
      }

      output[index] = CHARS[byte % CHARS_LENGTH] as string;
      index += 1;

      if (index === length) {
        break;
      }
    }
  }

  return output.join("");
}

export function generateUID(): string {
  return `OMUI${generateRandomPart(RANDOM_SUFFIX_LENGTH)}`;
}

export function generateRandomId(): string {
  return `OMIX${generateRandomPart(RANDOM_SUFFIX_LENGTH)}`;
}

// FIXED: Proper sequential Company ID generation
export function generateNextCompanyId(latestId?: string | null): string {
  // If no latest ID or invalid format, return first Org ID
  if (
    !latestId ||
    latestId.length !== COMPANY_ID_PREFIX.length + RANDOM_SUFFIX_LENGTH ||
    !COMPANY_ID_REGEX.test(latestId)
  ) {
    return FIRST_COMPANY_ID;
  }

  const numericPart = latestId.slice(COMPANY_ID_PREFIX.length);
  const currentNum = parseInt(numericPart, 36); // Base-36 parse

  if (Number.isNaN(currentNum)) {
    return FIRST_COMPANY_ID;
  }

  if (currentNum >= COMPANY_SEQUENCE_MAX) {
    throw new RangeError("Company ID sequence limit reached");
  }

  const nextNum = currentNum + 1;
  const nextNumericPart = nextNum
    .toString(36)
    .toUpperCase()
    .padStart(RANDOM_SUFFIX_LENGTH, "0")
    .slice(-RANDOM_SUFFIX_LENGTH);

  return `${COMPANY_ID_PREFIX}${nextNumericPart}`;
}

// FIXED: Proper sequential Ommpods ID generation
export function generateNextOmmpodsId(latestId?: string | null): string {
  // If no latest ID or invalid format, return first Org ID
  if (
    !latestId ||
    latestId.length !== OMMPODS_ID_PREFIX.length + RANDOM_SUFFIX_LENGTH ||
    !OMMPODS_ID_REGEX.test(latestId)
  ) {
    return FIRST_OMMPODS_ID;
  }

  const numericPart = latestId.slice(OMMPODS_ID_PREFIX.length);
  const currentNum = parseInt(numericPart, 36); // Base-36 parse

  if (Number.isNaN(currentNum)) {
    return FIRST_OMMPODS_ID;
  }

  if (currentNum >= OMMPODS_SEQUENCE_MAX) {
    throw new RangeError("Ommpods ID sequence limit reached");
  }

  const nextNum = currentNum + 1;
  const nextNumericPart = nextNum
    .toString(36)
    .toUpperCase()
    .padStart(RANDOM_SUFFIX_LENGTH, "0")
    .slice(-RANDOM_SUFFIX_LENGTH);

  return `${OMMPODS_ID_PREFIX}${nextNumericPart}`;
}
