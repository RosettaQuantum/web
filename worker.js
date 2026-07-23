// Serves the static Astro build (dist/), redirects to the canonical host, and
// accepts lead submissions at POST /api/lead -> D1 `leads` table.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.hostname !== "rosettaquantum.com" && url.hostname !== "localhost") {
      url.hostname = "rosettaquantum.com"; url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/lead" && request.method === "POST") {
      try {
        const b = await request.json();
        if (!b.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email))
          return json({ ok: false, error: "valid email required" }, 400);
        await env.DB.prepare(
          "INSERT INTO leads (name,email,role,org,problem_class,note,lang,source) VALUES (?,?,?,?,?,?,?,?)"
        ).bind(
          b.name || null, b.email, b.role || null, b.org || null,
          b.problem_class || null, b.note || null, b.lang || "en", "site-modal"
        ).run();
        return json({ ok: true });
      } catch (e) {
        return json({ ok: false, error: "server error" }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  }
};
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}
