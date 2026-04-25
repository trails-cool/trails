import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

interface FollowState {
  following: boolean;
  pending: boolean;
}

interface Props {
  username: string;
  // Whether the followed profile is private/locked. Drives the "Request to
  // follow" label vs. plain "Follow" before any click happens.
  isPrivateTarget: boolean;
  initialState: FollowState | null;
}

type Display = "follow" | "request" | "pending" | "unfollow";

function displayFor(state: FollowState | null, isPrivateTarget: boolean): Display {
  if (state?.following) return "unfollow";
  if (state?.pending) return "pending";
  return isPrivateTarget ? "request" : "follow";
}

export function FollowButton({ username, isPrivateTarget, initialState }: Props) {
  const { t } = useTranslation("journal");
  const [state, setState] = useState<FollowState>(
    initialState ?? { following: false, pending: false },
  );
  const [isInFlight, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const display = displayFor(state, isPrivateTarget);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      // For "pending" we treat the click as cancel-request: same /unfollow
      // endpoint deletes the row whether it's accepted or pending.
      const path = state.following || state.pending
        ? `/api/users/${username}/unfollow`
        : `/api/users/${username}/follow`;
      try {
        const res = await fetch(path, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Failed");
          return;
        }
        const body = (await res.json()) as { following: boolean; pending: boolean };
        setState({ following: body.following, pending: body.pending });
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const label = (() => {
    switch (display) {
      case "unfollow":
        return t("social.unfollow");
      case "pending":
        return t("social.pendingCancel");
      case "request":
        return t("social.requestToFollow");
      case "follow":
      default:
        return t("social.follow");
    }
  })();

  const baseClass = display === "follow" || display === "request"
    ? "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    : "rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50";

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isInFlight}
        className={baseClass}
      >
        {isInFlight ? "…" : label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
