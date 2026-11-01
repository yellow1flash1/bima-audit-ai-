import "server-only";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Whether the Anthropic SDK can resolve credentials here: an API key, an auth token,
 * workload identity federation, or an `ant auth login` profile on disk. A missing
 * credential otherwise surfaces only as a generic Error at request time.
 */
export function anthropicCredentialsPresent(): boolean {
  const env = process.env;
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN || env.ANTHROPIC_PROFILE) return true;
  if (env.ANTHROPIC_FEDERATION_RULE_ID && (env.ANTHROPIC_IDENTITY_TOKEN || env.ANTHROPIC_IDENTITY_TOKEN_FILE)) return true;
  const configHome = env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return existsSync(join(configHome, "anthropic"));
}
