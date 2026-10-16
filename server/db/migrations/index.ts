import type { Migration } from "../migrate.ts";
import { baseline } from "./001_baseline.ts";
import { joinCodes } from "./002_join_codes.ts";

/** Every migration, oldest first. Add new migrations to the end. */
export const migrations: Migration[] = [baseline, joinCodes];
