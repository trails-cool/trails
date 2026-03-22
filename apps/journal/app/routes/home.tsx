import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "trails.cool" },
    { name: "description", content: "Your outdoor activity journal" },
  ];
}

export default function Home() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-4xl font-bold text-gray-900">trails.cool</h1>
      <p className="mt-4 text-lg text-gray-600">Your outdoor activity journal</p>
    </div>
  );
}
