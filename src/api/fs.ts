const enum KnownLanguage {
  html = "html",
  javascript = "jaascript",
  typescript = "typescript",
  text = "text",
}

export function getFileParts(
  path: string,
): { extension: string; name: string } | null {
  const match = path.match(/^(?<name>.*)(?<extension>\.\w+$)/);
  return match && match.groups
    ? { extension: match.groups.extension, name: match.groups.name }
    : null;
}

export function getLanguage(path: string): KnownLanguage {
  const { extension } = getFileParts(path) ?? { extension: "" };
  switch (extension) {
    case ".html":
      return KnownLanguage.html;
    case ".js":
    case ".jsx":
      return KnownLanguage.javascript;
    case ".ts":
    case ".tsx":
      return KnownLanguage.typescript;
    default:
      return KnownLanguage.text;
  }
}
