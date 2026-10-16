"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState, type PointerEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Heart,
  House,
  Leaf,
  MapPin,
  MessageCircle,
  RotateCcw,
  Sparkles,
  Trees,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { GameBridge, type GameStatus } from "@/game/bridge";
import type { Direction } from "@/game/world";
const GameCanvas = dynamic(() => import("./game-canvas"), { ssr: false });
const directions = [
  { direction: "up", Icon: ArrowUp },
  { direction: "left", Icon: ArrowLeft },
  { direction: "down", Icon: ArrowDown },
  { direction: "right", Icon: ArrowRight },
] as const;

export function World() {
  const [bridge] = useState(() => new GameBridge());
  const [near, setNear] = useState(false);
  const [dialogue, setDialogue] = useState(false);
  const [help, setHelp] = useState(false);
  const [status, setStatus] = useState<GameStatus>("loading");
  const [seen, setSeen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    bridge.connect(setNear, () => setDialogue(true), setStatus);
    return () => {
      bridge.connect(
        () => {},
        () => {},
        () => {},
      );
    };
  }, [bridge]);
  useEffect(() => {
    bridge.pause(dialogue || help);
  }, [bridge, dialogue, help]);
  const actions = useMemo(
    () => ({
      press(direction: Direction, event: PointerEvent<HTMLButtonElement>) {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        bridge.held.add(direction);
      },
      release(direction: Direction) {
        bridge.held.delete(direction);
      },
    }),
    [bridge],
  );
  function closeDialogue(open: boolean) {
    setDialogue(open);
    if (!open) setSeen(true);
  }
  return (
    <main className="world-shell">
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Bubu’s Little World home">
          <span className="brand-icon">
            <Heart size={22} fill="currentColor" />
          </span>
          <span>
            Bubu’s <span className="brand-light">Little World</span>
            <small>A LITTLE PLACE TO FEEL LOVED</small>
          </span>
        </Link>
        <div className="header-note">
          <span className="status-dot" /> A little world, just for you
        </div>
        <Dialog open={help} onOpenChange={setHelp}>
          <DialogTrigger asChild>
            <Button variant="outline" className="help-button">
              How to play <span aria-hidden>↗</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <div className="dialog-eyebrow">
              <Leaf size={16} /> A gentle little guide
            </div>
            <DialogTitle>Make yourself at home.</DialogTitle>
            <DialogDescription>
              There’s no rush and nothing to win. Wander around the yard and say
              hello.
            </DialogDescription>
            <ul className="help-list">
              <li>
                <strong>Move</strong> with WASD, arrow keys, or the on-screen
                direction pad.
              </li>
              <li>
                <strong>Talk</strong> when you’re near Teddy. Press E, Space,
                Enter, or tap Talk.
              </li>
              <li>
                <strong>Take your time.</strong> The world pauses while a
                message is open. Escape closes it.
              </li>
            </ul>
            <p className="sample-note">
              Milestone 1 preview · all dialogue is synthetic.
            </p>
          </DialogContent>
        </Dialog>
      </header>
      <section className="intro">
        <div>
          <div className="eyebrow">
            <span /> CHAPTER ONE · WHERE IT ALL BEGAN
          </div>
          <h1>
            A little closer to <em>home.</em>
            <Heart className="title-heart" size={26} />
          </h1>
          <p>Familiar places. Your favorite people. A whole lot of love.</p>
        </div>
        <div className="chapter-mark">
          <House size={20} />
          <span>
            Sta. Ana, Cagayan<small>Home is a feeling ♡</small>
          </span>
        </div>
      </section>
      <section className="game-frame" aria-label="Explore the Sta. Ana house">
        <div className="stage-top">
          <span>
            <MapPin size={15} /> Sta. Ana House
          </span>
          <span className="sun-label">☀ A lovely day to wander</span>
          <span className="preview-tag">PLAYABLE PREVIEW</span>
        </div>
        <div className="game-stage">
          <GameCanvas key={attempt} bridge={bridge} />
          {status === "loading" && (
            <div className="loading-state" role="status">
              <Heart size={30} /> Making a little room for you…
            </div>
          )}
          {status === "error" && (
            <div className="loading-state" role="alert">
              <p>The yard couldn’t load. Let’s try again.</p>
              <Button
                onClick={() => {
                  setStatus("loading");
                  setAttempt((a) => a + 1);
                }}
              >
                Try again
              </Button>
            </div>
          )}
          {status === "ready" && (
            <>
              <div className="welcome-chip">
                <Sparkles size={16} />
                <span>
                  You’re home, Bubu.
                  <small>Take a little walk. Someone’s here for you.</small>
                </span>
              </div>
              <div className="yard-caption">
                <span /> THE FAMILY YARD
              </div>
            </>
          )}
          <div
            className="touch-controls"
            aria-label="Movement controls"
            hidden={dialogue || help || status !== "ready"}
          >
            <div className="dpad">
              {directions.map(({ direction, Icon }) => (
                <button
                  key={direction}
                  className={`pad-${direction}`}
                  aria-label={`Move ${direction}`}
                  onPointerDown={(e) => actions.press(direction, e)}
                  onPointerUp={() => actions.release(direction)}
                  onPointerCancel={() => actions.release(direction)}
                  onLostPointerCapture={() => actions.release(direction)}
                  onContextMenu={(e) => e.preventDefault()}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      bridge.held.add(direction);
                    }
                  }}
                  onKeyUp={() => actions.release(direction)}
                  onBlur={() => actions.release(direction)}
                >
                  <Icon size={22} />
                </button>
              ))}
              <span className="pad-center">♡</span>
            </div>
            <Button
              className="touch-talk"
              disabled={!near}
              aria-label="Talk to Teddy"
              onClick={() => {
                bridge.requestTalk();
              }}
            >
              <MessageCircle size={21} />
              Talk
            </Button>
          </div>
        </div>
        <div className="stage-bottom">
          <div className="keyboard-hint">
            <span className="keycap">W A S D</span>
            <span>or</span>
            <span className="keycap">↑ ← ↓ →</span>
            <span>to wander</span>
            <i />
            <span className="keycap">E</span>
            <span>to say hello</span>
          </div>
          <p className="near-status" role="status">
            {near
              ? "Teddy is nearby. Say hello!"
              : "Follow your feet. Find a familiar face."}
          </p>
          <Button
            variant="ghost"
            className="reset-button"
            aria-label="Return Bubu to the starting spot"
            onClick={() => {
              bridge.requestReset();
            }}
          >
            <RotateCcw size={15} />
            <span>Back to start</span>
          </Button>
        </div>
      </section>
      <footer className="world-footer">
        <div className="location-pill">
          <span className="location-symbol">
            <House size={19} />
          </span>
          <span>
            Sta. Ana House<small>CHAPTER 01</small>
          </span>
          <span className="here-label">YOU ARE HERE</span>
        </div>
        <p>
          <Leaf size={15} /> Little steps. Lovely memories.
        </p>
        <span className="seen-count">
          <MessageCircle size={16} />{" "}
          {seen ? "1 hello shared" : "A hello is waiting"}
        </span>
      </footer>
      <p className="preview-note">
        <Trees size={14} /> Milestone 1 · A cozy prototype with sample
        characters and dialogue.
      </p>
      <Dialog open={dialogue} onOpenChange={closeDialogue}>
        <DialogContent
          className="message-dialog"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            document
              .querySelector<HTMLButtonElement>(".help-button")
              ?.focus({ preventScroll: true });
          }}
        >
          <div className="dialog-eyebrow">
            <MessageCircle size={16} /> A LITTLE HELLO · SAMPLE MESSAGE
          </div>
          <div className="sender">
            <span className="bear-avatar" aria-hidden>
              ʕ•ᴥ•ʔ
            </span>
            <div>
              <DialogTitle>Teddy</DialogTitle>
              <span>Your friendly yard companion</span>
            </div>
            <Heart size={23} className="message-heart" />
          </div>
          <DialogDescription asChild>
            <div className="message-body">
              <p>Welcome home, Bubu! 🌼</p>
              <p>
                This is a little practice hello from your sample bear friend.
                Take a walk around the yard, enjoy the sunshine, and make
                yourself at home.
              </p>
              <p>
                Walang nagmamadali dito. There’s always time for a little rest
                and a friendly hello. ♡
              </p>
              <p className="sample-note">
                Synthetic demo text — personal messages will arrive in a later
                milestone.
              </p>
            </div>
          </DialogDescription>
          <div className="message-footer">
            <span>
              <Leaf size={14} /> The world can wait.
            </span>
            <Button onClick={() => closeDialogue(false)}>
              Back to the sunshine <ArrowRight size={17} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
