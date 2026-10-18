import type { CSSProperties } from "react";
import {
  CAPYBARA,
  CHARACTER_DIRECTIONS,
  characterAnimation,
} from "@/game/characters/capybara";

export function CharacterStudy() {
  return (
    <section
      className="character-study"
      aria-labelledby="character-study-title"
    >
      <div>
        <span className="eyebrow">CHARACTER ART · FIRST SLICE</span>
        <h2 id="character-study-title">A little capybara.</h2>
        <p>
          Try walking in every direction. These are the actual game frames; the
          bears beside you are here for scale.
        </p>
      </div>
      <div className="character-study-poses">
        {CHARACTER_DIRECTIONS.map((direction) => (
          <div key={direction} className="character-study-direction">
            <strong>
              {direction === "down"
                ? "Front"
                : direction === "up"
                  ? "Back"
                  : "Side"}
            </strong>
            {(["idle", "walk"] as const).map((action) => {
              const { start, rate } = characterAnimation(direction, action);
              return (
                <figure key={action}>
                  <span
                    className="character-sprite-preview"
                    role="img"
                    aria-label={`Capybara ${action}, ${direction}`}
                    style={
                      {
                        backgroundImage: `url(${CAPYBARA.src})`,
                        "--pose-start": `${-start * 64}px`,
                        "--pose-end": `${-(start + 2) * 64}px`,
                        "--pose-duration": `${2 / rate}s`,
                      } as CSSProperties
                    }
                  />
                  <figcaption>{action === "walk" ? "Walk" : "Idle"}</figcaption>
                </figure>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}
