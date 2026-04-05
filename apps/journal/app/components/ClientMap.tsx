import { useState, useEffect, type ComponentProps } from "react";

type MapProps = ComponentProps<typeof import("./RouteMapThumbnail.client").RouteMapThumbnail>;

export function ClientMap(props: MapProps) {
  const [Component, setComponent] = useState<React.ComponentType<MapProps>>();

  useEffect(() => {
    import("./RouteMapThumbnail.client").then((m) => setComponent(() => m.RouteMapThumbnail));
  }, []);

  if (!Component) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-500 ${props.className ?? "h-36 w-full rounded"}`}>
        Loading map...
      </div>
    );
  }

  return <Component {...props} />;
}
