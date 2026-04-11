import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

interface WaypointContextMenuProps {
  position: { x: number; y: number };
  isFirst: boolean;
  isLast: boolean;
  isOvernight: boolean;
  onDelete: () => void;
  onToggleOvernight: () => void;
  onClose: () => void;
}

export function WaypointContextMenu({
  position,
  isFirst,
  isLast,
  isOvernight,
  onDelete,
  onToggleOvernight,
  onClose,
}: WaypointContextMenuProps) {
  const { t } = useTranslation("planner");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const canToggleOvernight = !isFirst && !isLast;

  return (
    <div
      ref={ref}
      className="fixed z-[2000] min-w-40 rounded-md border border-gray-200 bg-white py-1 shadow-lg"
      style={{ left: position.x, top: position.y }}
    >
      {canToggleOvernight && (
        <button
          onClick={() => { onToggleOvernight(); onClose(); }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
        >
          <span>☾</span>
          {isOvernight ? t("multiDay.removeOvernight") : t("multiDay.markOvernight")}
        </button>
      )}
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
      >
        <span>×</span>
        {t("common:delete", "Delete")}
      </button>
    </div>
  );
}
