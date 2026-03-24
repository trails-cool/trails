import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from "react-router";
import type { LinksFunction } from "react-router";
import type { Route } from "./+types/root";
import stylesheet from "@trails-cool/ui/styles.css?url";

export const links: LinksFunction = () => [{ rel: "stylesheet", href: stylesheet }];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body className="h-screen w-screen overflow-hidden bg-white">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">{error.status}</h1>
          <p className="mt-2 text-gray-600">
            {error.status === 404 && "Page not found"}
            {error.status === 503 && "Service temporarily unavailable"}
            {error.status !== 404 && error.status !== 503 && (error.statusText || "Something went wrong")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">Error</h1>
        <p className="mt-2 text-gray-600">
          {error instanceof Error ? error.message : "An unexpected error occurred"}
        </p>
      </div>
    </div>
  );
}
