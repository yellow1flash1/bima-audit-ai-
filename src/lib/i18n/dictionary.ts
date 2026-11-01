import en from "../../i18n/messages/en.json";
import hi from "../../i18n/messages/hi.json";

export type Locale = "en-IN" | "hi-IN";
export const LOCALES: Locale[] = ["en-IN", "hi-IN"];

type Tree = { [k: string]: string | Tree };
const MESSAGES: Record<Locale, Tree> = { "en-IN": en as Tree, "hi-IN": hi as Tree };

function lookup(tree: Tree, key: string): string | undefined {
  let node: string | Tree | undefined = tree;
  for (const part of key.split(".")) {
    if (typeof node !== "object") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

export type Vars = Record<string, string | number>;

/**
 * Resolve `key` for `locale`. In plain-language mode `plain.<key>` wins when it
 * exists. Missing Hindi strings fall back to English, never to the raw key.
 */
export function translate(locale: Locale, key: string, vars?: Vars, plain = false): string {
  const tpl =
    (plain && (lookup(MESSAGES[locale], `plain.${key}`) ?? lookup(MESSAGES["en-IN"], `plain.${key}`))) ||
    lookup(MESSAGES[locale], key) ||
    lookup(MESSAGES["en-IN"], key) ||
    key;
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export function flatKeys(tree: Tree = MESSAGES["en-IN"], prefix = ""): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === "string" ? [`${prefix}${k}`] : flatKeys(v, `${prefix}${k}.`),
  );
}

export function messagesFor(locale: Locale): Tree {
  return MESSAGES[locale];
}
