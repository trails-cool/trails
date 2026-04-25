import { useState, useTransition } from "react";
import { useTranslation } from "react-i18next";

interface FollowState {
  following: boolean;
  pending: boolean;
}

interface Props {
  username: string;
  initialState: FollowState | null;
}

export function FollowButton({ username, initialState }: Props) {
  const { t } = useTranslation("journal");
  const [state, setState] = useState<FollowState>(
    initialState ?? { following: false, pending: false },
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onClick = () => {
    setError(null);
    startTransition(async () => {
      const path = state.following
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

  const label = state.following ? t("social.unfollow") : t("social.follow");

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className={
          state.following
            ? "rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            : "rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        }
      >
        {isPending ? "…" : label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
