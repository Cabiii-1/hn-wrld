"use client";
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import { SCENES, safePlacement, type SceneKey } from "@/game/scenes";
import geometry from "@/game/scene-geometry.json";

export type PlacementPoint = { x: number; y: number; radius: number };
type Neighbor = PlacementPoint & {
  id: string;
  name: string;
  variant: string;
  published: boolean;
};
const clamp = (n: number, max: number) =>
  Math.max(0, Math.min(max, Math.round(n)));

// Same 32px front idle pose and foot anchor as the original game bears.
function Bear({ variant }: { variant: string }) {
  const coat =
    variant === "npc-brown-scarf"
      ? "#b78459"
      : variant === "npc-rose-bow"
        ? "#f3dfc5"
        : "#f1d8b0";
  const accessory = variant === "npc-rose-bow" ? "#ce8796" : "#778b63";
  return (
    <g
      transform="translate(-16 -30)"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path fill="#80634440" d="M7 27h19v3H7z" />
      <path
        fill="#65483b"
        d="M9 19h14v9H9zM7 20h3v5H7zM23 20h3v5h-3zM10 26h5v3h-5zM18 26h5v3h-5zM6 4h7v8H6zM20 4h7v8h-7zM6 10h21v10H6zM9 7h15v16H9z"
      />
      <path
        fill={coat}
        d="M10 19h12v7H10zM8 20h2v4H8zM23 20h2v4h-2zM8 10h17v9H8zM10 9h13v12H10z"
      />
      <path fill="#dfa69a" d="M8 6h3v4H8zM22 6h3v4h-3z" />
      <path fill="#65483b" d="M11 13h2v3h-2zM21 13h2v3h-2z" />
      <path fill="#fff1d6" d="M14 17h6v4h-6z" />
      <path fill="#65483b" d="M16 17h2v2h-2z" />
      <path fill="#edaaa0" d="M9 17h3v2H9zM23 17h2v2h-2z" />
      <path
        fill={accessory}
        d={
          variant === "npc-rose-bow"
            ? "M10 22h13v3H10zM23 8h4v3h-4zM25 6h3v7h-3z"
            : "M10 22h13v3H10zM12 23h3v5h-3z"
        }
      />
    </g>
  );
}

export function PlacementEditor({
  map,
  point,
  onChange,
  variant,
  name,
  neighbors = [],
  disabled = false,
}: {
  map: SceneKey;
  point: PlacementPoint;
  onChange: (point: PlacementPoint) => void;
  variant: string;
  name: string;
  neighbors?: Neighbor[];
  disabled?: boolean;
}) {
  const mask = useId(),
    hint = useId();
  const [boundaries, setBoundaries] = useState(true);
  const [zoomed, setZoomed] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const area = viewport.current;
    const bear = area?.querySelector('[data-placement-control="position"]');
    if (!zoomed || !area || !bear) return;
    const marker = bear.getBoundingClientRect(),
      box = area.getBoundingClientRect();
    area.scrollLeft +=
      (marker.left + marker.right) / 2 - box.left - area.clientWidth / 2;
  }, [zoomed]);
  const drag = useRef<{
    mode: "position" | "radius";
    id: number;
    offsetX: number;
    offsetY: number;
    pointerX: number;
    direction: number;
    start: PlacementPoint;
  } | null>(null);
  const valid = safePlacement(map, point.x, point.y, point.radius);
  const handleDistance = Math.max(point.radius + 7, 52);
  const handleDirection = point.x + handleDistance <= 812 ? 1 : -1;
  const handleX = point.x + handleDistance * handleDirection;
  const near = neighbors.some(
    (n) => n.published && Math.hypot(n.x - point.x, n.y - point.y) < 30,
  );
  function location(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - box.left) * 836) / box.width, 836),
      y: clamp(((event.clientY - box.top) * 470) / box.height, 470),
    };
  }
  function update(event: PointerEvent<SVGSVGElement>) {
    const active = drag.current;
    if (!active || active.id !== event.pointerId || disabled) return;
    const p = location(event);
    onChange(
      active.mode === "position"
        ? {
            ...point,
            x: clamp(p.x - active.offsetX, 836),
            y: clamp(p.y - active.offsetY, 470),
          }
        : {
            ...point,
            radius: clamp(
              active.start.radius + (p.x - active.pointerX) * active.direction,
              80,
            ),
          },
    );
  }
  function keyboard(
    event: KeyboardEvent<SVGGElement>,
    mode: "position" | "radius",
  ) {
    if (
      disabled ||
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    const step = event.shiftKey ? 10 : 1;
    const delta = ["ArrowLeft", "ArrowDown"].includes(event.key) ? -step : step;
    if (mode === "radius")
      onChange({ ...point, radius: clamp(point.radius + delta, 80) });
    else
      onChange({
        ...point,
        x: clamp(
          point.x +
            (event.key === "ArrowLeft"
              ? -step
              : event.key === "ArrowRight"
                ? step
                : 0),
          836,
        ),
        y: clamp(
          point.y +
            (event.key === "ArrowUp"
              ? -step
              : event.key === "ArrowDown"
                ? step
                : 0),
          470,
        ),
      });
  }
  return (
    <div className="placement-editor">
      <p id={hint} className="quiet-copy">
        Drag the bear or tap a spot. Drag the round handle to resize its wander
        area. Arrow keys fine-tune; Shift moves faster.
      </p>
      <div className="placement-map-viewport" ref={viewport}>
        <svg
          className={`placement-map${zoomed ? " zoomed" : ""}`}
          viewBox="0 0 836 470"
          width="836"
          height="470"
          aria-label={`Place ${name} in ${SCENES[map].name}`}
          aria-describedby={hint}
          onPointerDown={(event) => {
            if (disabled || event.button !== 0 || drag.current) return;
            const target = (event.target as Element).closest(
              "[data-placement-control]",
            );
            if (zoomed && !target) return;
            const mode =
              target?.getAttribute("data-placement-control") === "radius"
                ? "radius"
                : "position";
            const p = location(event);
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              mode,
              id: event.pointerId,
              offsetX: target && mode === "position" ? p.x - point.x : 0,
              offsetY: target && mode === "position" ? p.y - point.y : 0,
              pointerX: p.x,
              direction: handleDirection,
              start: point,
            };
            update(event);
          }}
          onPointerMove={update}
          onPointerUp={(event) => {
            if (drag.current?.id !== event.pointerId) return;
            update(event);
            drag.current = null;
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={(event) => {
            if (drag.current?.id !== event.pointerId) return;
            onChange(drag.current.start);
            drag.current = null;
          }}
          onLostPointerCapture={() => {
            drag.current = null;
          }}
        >
          <image href={SCENES[map].background} width="836" height="470" />
          {boundaries && (
            <>
              <defs>
                <mask id={mask}>
                  <rect width="836" height="470" fill="white" />
                  {geometry[map].regions.map((r, i) => (
                    <rect
                      key={i}
                      x={r.left}
                      y={r.top}
                      width={r.right - r.left}
                      height={r.bottom - r.top}
                      fill="black"
                    />
                  ))}
                  {geometry[map].obstacles.map((o, i) => (
                    <rect key={i} {...o} fill="white" />
                  ))}
                </mask>
              </defs>
              <rect
                width="836"
                height="470"
                fill="#582229"
                opacity=".36"
                mask={`url(#${mask})`}
                pointerEvents="none"
              />
            </>
          )}
          {neighbors.map((n) => (
            <g
              key={n.id}
              transform={`translate(${n.x} ${n.y})`}
              opacity={n.published ? 0.65 : 0.35}
              pointerEvents="none"
            >
              <Bear variant={n.variant} />
              <text y="-35" textAnchor="middle" className="placement-map-name">
                {n.name.slice(0, 22)}
              </text>
            </g>
          ))}
          <rect
            x={point.x - point.radius - 7}
            y={point.y - point.radius - 7}
            width={point.radius * 2 + 14}
            height={point.radius * 2 + 7}
            fill={valid ? "#8fe3af" : "#ff897b"}
            fillOpacity=".2"
            stroke={valid ? "#dbffdf" : "#ffb1a2"}
            strokeWidth="2"
            strokeDasharray="5 3"
            pointerEvents="none"
          />
          <g
            transform={`translate(${point.x} ${point.y})`}
            data-placement-control="position"
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-label={`Move ${name}`}
            onKeyDown={(e) => keyboard(e, "position")}
          >
            <circle r="24" fill="transparent" />
            <Bear variant={variant} />
            <circle r="3" fill="#fff7d7" stroke="#284a3a" />
          </g>
          <line
            x1={point.x + (point.radius + 7) * handleDirection}
            y1={point.y}
            x2={handleX}
            y2={point.y}
            stroke="#fff4cf"
            strokeDasharray="3 3"
            pointerEvents="none"
          />
          <g
            transform={`translate(${handleX} ${point.y})`}
            data-placement-control="radius"
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-disabled={disabled}
            aria-label="Resize wander area"
            aria-valuemin={0}
            aria-valuemax={80}
            aria-valuenow={point.radius}
            onKeyDown={(e) => keyboard(e, "radius")}
          >
            <circle r="24" fill="transparent" />
            <circle r="8" fill="#fff4cf" stroke="#284a3a" strokeWidth="2" />
            <path d="M-4 0h8M0-4v8" stroke="#284a3a" strokeWidth="1.5" />
          </g>
        </svg>
      </div>
      <div className="placement-map-tools">
        <button
          className="placement-zoom"
          type="button"
          aria-pressed={zoomed}
          onClick={() => setZoomed((value) => !value)}
        >
          {zoomed ? "Fit whole scene" : "Zoom map"}
        </button>
        <div
          className="placement-nudge"
          role="group"
          aria-label="Fine-tune bear position"
        >
          {[
            ["left", -1, 0, "←"],
            ["up", 0, -1, "↑"],
            ["down", 0, 1, "↓"],
            ["right", 1, 0, "→"],
          ].map(([label, dx, dy, icon]) => (
            <button
              key={label}
              type="button"
              aria-label={`Move bear ${label}`}
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...point,
                  x: clamp(point.x + Number(dx), 836),
                  y: clamp(point.y + Number(dy), 470),
                })
              }
            >
              {icon}
            </button>
          ))}
        </div>
        <label>
          <input
            type="checkbox"
            checked={boundaries}
            onChange={(e) => setBoundaries(e.target.checked)}
          />{" "}
          Shade blocked scenery
        </label>
        <label>
          Wander distance: {point.radius}
          <input
            type="range"
            min="0"
            max="80"
            value={point.radius}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...point, radius: Number(e.target.value) })
            }
          />
        </label>
      </div>
      {zoomed && (
        <p className="quiet-copy">
          Swipe or scroll the scenery to look around. Drag the bear and its
          handle to edit.
        </p>
      )}
      <p
        className={
          valid ? "placement-map-status" : "placement-map-status invalid"
        }
        role="status"
      >
        {valid
          ? near
            ? "Safe path, but close to another bear. Give them a little more space."
            : "Safe spot. Changes go live only when you save."
          : "Blocked area. Move the bear or shrink its wander area until the outline is safe."}
      </p>
      <small className="quiet-copy">
        Foot position: {point.x}, {point.y} · Faded bears show other saved
        placements.
      </small>
    </div>
  );
}
