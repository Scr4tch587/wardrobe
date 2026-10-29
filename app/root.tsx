import { isRouteErrorResponse, Link, Links, Meta, NavLink, Outlet, Scripts, ScrollRestoration } from "react-router";
import type { MiddlewareFunction } from "react-router";
import type { Route } from "./+types/root";
import { mediaOrigin } from "./lib/edge.server";
import "./app.css";

const NAV = [
  ["/", "Today"],
  ["/items", "Items"],
  ["/outfits", "Outfits"],
  ["/leaderboard", "Leaderboard"],
  ["/stats", "Stats"],
  ["/suggestions", "Wall"],
];

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400..700;1,400..700&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,620;1,9..144,560&display=swap",
  },
];

export function loader() {
  return { mediaOrigin: mediaOrigin() };
}

export const middleware: MiddlewareFunction<Response>[] = [
  async ({ request }, next) => {
    const response = await next();
    if (!(response instanceof Response)) return response;
    const headers = new Headers(response.headers);
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    const url = new URL(request.url);
    if (url.pathname.startsWith("/admin")) headers.set("Cache-Control", "private, no-store");
    else if (url.pathname === "/outfits/random") headers.set("Cache-Control", "no-store");
    else if (
      !import.meta.env.DEV &&
      request.method === "GET" &&
      isPublicDocument(url.pathname) &&
      response.status === 200 &&
      !response.headers.has("Set-Cookie")
    ) {
      headers.set("Cache-Control", "public, max-age=0, s-maxage=60");
    }
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
];

function isPublicDocument(pathname: string): boolean {
  if (pathname.startsWith("/admin") || pathname.startsWith("/assets")) return false;
  if (pathname === "/outfits/random") return false;
  return (
    pathname === "/" ||
    pathname === "/items" ||
    pathname.startsWith("/items/") ||
    pathname === "/outfits" ||
    pathname.startsWith("/outfits/") ||
    pathname === "/leaderboard" ||
    pathname === "/stats" ||
    pathname === "/suggest" ||
    pathname === "/suggestions"
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-5 pb-16">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line py-5">
        <Link to="/" className="font-display text-3xl italic leading-none tracking-tight">
          Wardrobe
        </Link>
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {NAV.map(([to, label]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) => (isActive ? "text-ink" : "text-muted hover:text-ink")}
            >
              {label}
            </NavLink>
          ))}
          <Link to="/suggest" className="rounded-full bg-ink px-3 py-1.5 text-paper">
            Suggest
          </Link>
          <Link to="/admin" className="text-muted hover:text-ink">
            Admin
          </Link>
        </nav>
      </header>
      <main className="pt-8">
        <Outlet />
      </main>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let details = "The page couldn't be loaded. Try again in a moment.";
  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Not in the wardrobe" : "Something went wrong";
    details =
      error.status === 404
        ? "That page isn't here."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error instanceof Error) {
    details = error.message;
  }
  return (
    <main className="mx-auto max-w-xl px-5 py-24">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">Wardrobe</p>
      <h1 className="mt-3 font-display text-5xl italic">{title}</h1>
      <p className="mt-4 text-muted">{details}</p>
      <Link to="/" className="mt-8 inline-block text-rust">
        Back home
      </Link>
    </main>
  );
}
