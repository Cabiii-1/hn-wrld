import { ImageIcon } from "lucide-react";

export function WindowskinLoader({
  kind = "letter",
}: {
  kind?: "letter" | "photo" | "voice";
}) {
  return (
    <div
      className={`windowskin-loader windowskin-loader-${kind}`}
      role="status"
    >
      <span className="windowskin-accessible-text">
        {kind === "letter"
          ? "Opening their letter…"
          : kind === "photo"
            ? "Loading photo…"
            : "Loading voice note…"}
      </span>
      {kind === "letter" ? (
        <svg viewBox="0 0 48 48" aria-hidden="true" shapeRendering="crispEdges">
          <path
            className="loader-envelope-flap"
            d="M6 18 24 5l18 13"
            fill="#879c7d"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M6 18h36v24H6z"
            fill="#879c7d"
            stroke="currentColor"
            strokeWidth="2"
          />
          <g className="loader-envelope-paper">
            <path d="M12 13h24v25H12z" fill="#fff4cb" />
            <path
              d="M17 20h14M17 25h14M17 30h9"
              stroke="#6d856e"
              strokeWidth="2"
            />
          </g>
          <path
            d="m6 18 18 14 18-14v24H6z"
            fill="#45645a"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="m6 42 14-13m22 13L28 29"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ) : kind === "photo" ? (
        <ImageIcon className="loader-photo-icon" aria-hidden="true" />
      ) : (
        <svg viewBox="0 0 40 32" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((bar) => (
            <rect
              className="loader-wave-bar"
              key={bar}
              x={3 + bar * 7}
              y={6}
              width="4"
              height="20"
              style={{ animationDelay: `${bar * 110}ms` }}
              fill="currentColor"
            />
          ))}
        </svg>
      )}
    </div>
  );
}
