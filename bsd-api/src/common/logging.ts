// The Free Access Policy promises that search activity stays private, so request logs must not record what people
// searched for. Fastify logs each request URL by default, and search terms live in the query string, so the query
// string is dropped before anything is written. The path, method and status are still logged for operations.

type LoggedRequest = { method?: string; url?: string; ip?: string };

export function redactedRequest(req: LoggedRequest) {
  return {
    method: req.method,
    url: (req.url ?? "").split("?")[0],
    remoteAddress: req.ip,
  };
}

export function loggerOptions() {
  if (process.env.NODE_ENV === "test") return false;
  return { serializers: { req: redactedRequest } };
}
