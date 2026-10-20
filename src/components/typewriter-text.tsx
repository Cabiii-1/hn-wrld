"use client";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

function reducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
function subscribeMotion(notify: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener?.("change", notify);
  return () => query.removeEventListener?.("change", notify);
}
export type TypewriterHandle = { finish: () => boolean };
export const TypewriterText = forwardRef<
  TypewriterHandle,
  { text: string; onTypingChange: (typing: boolean) => void }
>(function TypewriterText({ text, onTypingChange }, ref) {
  const reduced = useSyncExternalStore(
    subscribeMotion,
    reducedMotion,
    () => true,
  );
  const letters = useMemo(
    () =>
      Array.from(
        new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          text,
        ),
        (part) => part.segment,
      ),
    [text],
  );
  const [visible, setVisible] = useState(() => (reduced ? letters.length : 0));
  const done = reduced || visible >= letters.length;
  useImperativeHandle(
    ref,
    () => ({
      finish() {
        if (done) return false;
        setVisible(letters.length);
        return true;
      },
    }),
    [done, letters.length],
  );
  useEffect(() => {
    onTypingChange(!done);
  }, [done, onTypingChange]);
  useEffect(() => {
    if (done) return;
    const timer = setTimeout(() => setVisible((count) => count + 1), 24);
    return () => clearTimeout(timer);
  }, [done, visible]);
  return (
    <p className="windowskin-text">
      {done ? (
        text
      ) : (
        <>
          <span className="windowskin-accessible-text">{text}</span>
          <span aria-hidden="true">
            <span data-typewriter-revealed>
              {letters.slice(0, visible).join("")}
            </span>
            <span className="windowskin-unrevealed">
              {letters.slice(visible).join("")}
            </span>
          </span>
        </>
      )}
    </p>
  );
});
