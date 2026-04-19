# Demo persona

The Journal's demo bot (see the `demo-activity-bot` spec) ships with a default Bruno-in-Berlin persona. Self-hosted instances can override the identity and voice without touching code by supplying `DEMO_BOT_PERSONA` to the journal container.

Region is separate (`DEMO_BOT_REGION`) — an operator may mix-and-match a non-Berlin region with the default Bruno persona, or vice versa, though it usually reads better to keep persona and region stylistically consistent.

## Supplying a persona

Two forms are accepted:

1. **Inline JSON** — `DEMO_BOT_PERSONA='{"username":"hamish",...}'`. Workable for short personas; gets ugly fast once the pools are realistic.
2. **File path** — `DEMO_BOT_PERSONA=file:/etc/trails-cool/persona.json`. The journal container reads the file once at boot; mount the file via a volume or Docker secret.

A missing / invalid / unreadable persona falls back to the built-in default with a single warn log line. The bot never crashes over a bad persona.

## Schema

```json
{
  "username": "<kebab-case, 2–32 chars, matches /^[a-z0-9][a-z0-9_-]{1,30}$/>",
  "displayName": "<string, 1–200 chars>",
  "bio": "<string, 0–200 chars>",
  "locales": ["en"] | ["de"] | ["en","de"],
  "content": {
    "names": {
      "en": ["<3 to 50 non-empty strings>"],
      "de": ["<3 to 50 non-empty strings>"]
    },
    "descriptions": {
      "en": ["<3 to 50 non-empty strings>"],
      "de": ["<3 to 50 non-empty strings>"]
    }
  }
}
```

Every locale listed in `locales` MUST have both a `names` pool and a `descriptions` pool. Locales omitted from `locales` may also omit their pools.

Sensible pool size is 10–15 entries per pool. Fewer than 3 is rejected; more than 50 is rejected. The generator samples deterministically from the walk's start-time, so very small pools produce visibly-repeating copy in the daily feed.

## Example: Hamish the English-only Scottish collie

```json
{
  "username": "hamish",
  "displayName": "Hamish",
  "bio": "Border collie. Arthur's Seat regular.",
  "locales": ["en"],
  "content": {
    "names": {
      "en": [
        "Arthur's Seat summit patrol",
        "Holyrood Park morning rounds",
        "Royal Mile crumb inspection",
        "Dean Village bridge audit",
        "Inverleith perimeter check",
        "Blackford Hill squirrel count",
        "Water of Leith investigation",
        "Hamish vs. the seagulls",
        "Portobello beach reconnaissance",
        "Cramond causeway survey"
      ]
    },
    "descriptions": {
      "en": [
        "Sniffed an impressive number of bins. All catalogued.",
        "Weather: dreich. Ears: flat.",
        "One dropped scone located. Consumed as evidence.",
        "Diplomacy established with the resident Labrador.",
        "Route completed. Biscuits expected.",
        "Found three sticks. Returned with one."
      ]
    }
  }
}
```

## Rollout

1. Write `persona.json`, mount it via your compose override or Docker secret.
2. Set `DEMO_BOT_PERSONA=file:/path/to/persona.json` in your SOPS env.
3. Set `DEMO_BOT_ENABLED=true`.
4. Restart the journal container.

On boot, the worker logs `demo-bot user ensured` with the persona's user id. If that username is already in use by a real human user, the worker logs a `demo persona username clash` error and declines to schedule the demo jobs — pick a different username and restart.

Rolling back is the same in reverse: unset `DEMO_BOT_PERSONA`, restart. The built-in default returns.
