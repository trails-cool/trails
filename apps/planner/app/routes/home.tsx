import type { Route } from "./+types/home";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "trails.cool Planner" },
    { name: "description", content: "Collaborative route planning" },
  ];
}

export default function Home() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900">trails.cool Planner</h1>
        <p className="mt-4 text-lg text-gray-600">Collaborative route planning</p>
      </div>
    </div>
  );
}
