// Only accept a proper random ID. "anonymous" is guessable, so it is refused.
export function getOwnerId(request: Request): string | null {
  const id = request.headers.get("x-owner-id");
  if (!id || id === "anonymous") return null;
  return /^[A-Za-z0-9_-]{8,64}$/.test(id) ? id : null;
}