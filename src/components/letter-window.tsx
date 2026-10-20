"use client";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { WorldNpc } from "@/game/connected";

/** Split on word boundaries without losing Unicode characters or paragraphs. */
export function letterPages(message: string, size = 180): string[] {
  const remaining = Array.from(message.replace(/\r\n?/g, "\n").trim());
  const pages: string[] = [];
  while (remaining.length) {
    let end = Math.min(size, remaining.length);
    if (end < remaining.length) {
      // Prefer a nearby paragraph boundary over stranding a word on a page.
      let paragraph = -1;
      for (let i = end - 1; i > Math.floor(size / 2); i--)
        if (remaining[i] === "\n" && remaining[i - 1] === "\n") {
          paragraph = i - 1;
          break;
        }
      if (paragraph >= 0) end = paragraph;
      else {
        for (let i = end; i > Math.floor(size / 2); i--) {
          if (/\s/u.test(remaining[i])) {
            end = i;
            break;
          }
        }
      }
    }
    pages.push(remaining.splice(0, end).join("").trim());
    while (remaining.length && /\s/u.test(remaining[0])) remaining.shift();
  }
  return pages.length ? pages : [""];
}

/** Inline Radix content: focus/escape support without a portal or backdrop. */
export function GameDialogueContent({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const release = useRef<() => void>(() => {});
  const bind = useCallback((node: HTMLDivElement | null) => {
    release.current();
    ref.current = node;
    const stage = node?.closest<HTMLElement>(".game-stage");
    if (!node || !stage) return;
    const reserve = () =>
      stage.style.setProperty(
        "--letter-window-height",
        `${Math.ceil(node.getBoundingClientRect().height) + 34}px`,
      );
    reserve();
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(reserve);
    observer?.observe(node);
    release.current = () => {
      observer?.disconnect();
      stage.style.removeProperty("--letter-window-height");
    };
  }, []);
  return (
    <DialogPrimitive.Content
      ref={bind}
      className="windowskin-dialog"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        returnFocus.current =
          ref.current?.closest(".game-stage")?.querySelector("canvas") ?? null;
        ref.current?.focus({ preventScroll: true });
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        returnFocus.current?.focus({ preventScroll: true });
      }}
      onPointerDownOutside={(event) => event.preventDefault()}
      onInteractOutside={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (
          event.repeat ||
          (event.target as HTMLElement).closest(
            "button,a,audio,input,textarea,select",
          )
        )
          return;
        const next = ["Enter", " ", "ArrowRight"].includes(event.key);
        if (!next && event.key !== "ArrowLeft") return;
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
        ref.current
          ?.querySelector<HTMLButtonElement>(
            next ? "[data-window-next]" : "[data-window-previous]",
          )
          ?.click();
      }}
    >
      {children}
    </DialogPrimitive.Content>
  );
}

function BearPortrait({ variant }: { variant: WorldNpc["variant"] }) {
  const coat =
    variant === "npc-brown-scarf"
      ? "#b78459"
      : variant === "npc-rose-bow"
        ? "#f3dfc5"
        : "#f1d8b0";
  return (
    <svg
      viewBox="0 0 32 32"
      className="windowskin-bear"
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path fill="#65483b" d="M6 4h7v6h7V4h7v16h-4v9h-5v-3h-3v3h-5v-9H6z" />
      <path fill={coat} d="M8 6h3v6h11V6h3v12h-2v7H10v-7H8z" />
      <path fill="#dfa69a" d="M8 6h3v4H8zm14 0h3v4h-3z" />
      <path fill="#65483b" d="M11 13h2v3h-2zm10 0h2v3h-2z" />
      <path fill="#fff1d6" d="M14 17h6v4h-6z" />
      <path fill="#65483b" d="M16 17h2v2h-2z" />
      <path
        fill={variant === "npc-rose-bow" ? "#ce8796" : "#778b63"}
        d="M10 22h13v3H10zm2 3h3v3h-3z"
      />
      {variant === "npc-rose-bow" && (
        <path fill="#ce8796" d="M18 5h3v2h3v3h-3V8h-3z" />
      )}
    </svg>
  );
}

export function LetterWindow({
  name,
  subtitle,
  message,
  variant = "npc-cream-1",
  notice,
  attachments,
  onClose,
  returnLabel,
}: {
  name: string;
  subtitle: string;
  message: string;
  variant?: WorldNpc["variant"];
  notice?: ReactNode;
  attachments?: ReactNode;
  onClose: () => void;
  returnLabel: string;
}) {
  const [page, setPage] = useState(0);
  const reading = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (reading.current) reading.current.scrollTop = 0;
  }, [page]);
  const pages = letterPages(message);
  const total = pages.length + (attachments ? 1 : 0);
  const current = Math.min(page, total - 1),
    memories = current === pages.length;
  return (
    <>
      <div className="windowskin-heading">
        <div className="windowskin-portrait">
          <BearPortrait variant={variant} />
        </div>
        <div className="windowskin-speaker">
          <span className="windowskin-eyebrow">A LITTLE HELLO</span>
          <DialogPrimitive.Title>{name}</DialogPrimitive.Title>
          <DialogPrimitive.Description>{subtitle}</DialogPrimitive.Description>
        </div>
        <DialogPrimitive.Close
          className="windowskin-close"
          aria-label="Close dialogue"
        >
          <X size={18} />
        </DialogPrimitive.Close>
      </div>
      <div
        ref={reading}
        className="windowskin-reading"
        tabIndex={0}
        aria-label={memories ? "Photos and voice notes" : "Letter text"}
      >
        {memories ? (
          <div className="windowskin-memories">
            <h3>A few memories, just for you.</h3>
            {attachments}
          </div>
        ) : (
          <p className="windowskin-text">{pages[current]}</p>
        )}
        {notice}
      </div>
      <div className="windowskin-footer">
        <div className="windowskin-pagination">
          <button
            type="button"
            data-window-previous
            aria-label="Previous page"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            <ChevronLeft size={17} />
          </button>
          <span role="status">
            {memories ? "Memories" : `${current + 1} / ${total}`}
          </span>
        </div>
        <span className="windowskin-key-hint">Enter / Space to continue</span>
        <button
          type="button"
          data-window-next
          className="windowskin-continue"
          onClick={() =>
            current === total - 1 ? onClose() : setPage(current + 1)
          }
        >
          {current === total - 1
            ? returnLabel
            : current === pages.length - 1
              ? "View memories"
              : "Continue"}
          <ChevronRight size={17} />
        </button>
      </div>
    </>
  );
}
