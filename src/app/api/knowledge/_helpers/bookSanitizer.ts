type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function sanitizeSource(value: unknown) {
  if (!isJsonObject(value)) return undefined;
  const { originalFilePath: _privateOriginalFilePath, ...publicSource } = value;
  return publicSource;
}

export function sanitizeBookContent(
  content: unknown,
  options: { includeBody: boolean }
) {
  if (!isJsonObject(content)) return content;

  const source = sanitizeSource(content.source);
  if (!options.includeBody) {
    return source ? { source } : {};
  }

  return {
    ...content,
    ...(source ? { source } : {}),
  };
}

export function sanitizeBookRowForClient<T extends JsonObject>(
  book: T,
  options: { includeBody: boolean }
) {
  return {
    ...book,
    content: sanitizeBookContent(book.content, options),
  };
}
