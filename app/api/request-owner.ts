const localHostnames = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function requestOwner(request: Request) {
  const authenticatedOwner = request.headers.get("oai-authenticated-user-id")?.trim();
  if (authenticatedOwner) return authenticatedOwner;

  const hostname = new URL(request.url).hostname.toLowerCase();
  return localHostnames.has(hostname) ? "local-designer" : null;
}

export function anonymousAccessResponse() {
  return Response.json(
    {
      error: "Project data is unavailable on the public preview.",
      next: "Use the localhost development build until private project links are enabled.",
    },
    { status: 401 },
  );
}
