"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PointerEvent,
} from "react";
import type { WorldNpc, ContributorVisit } from "@/game/connected";
import { SCENES, SCENE_KEYS, type SceneKey } from "@/game/scenes";
import { RecipientDialogue } from "./recipient-dialogue";
import { ParkAudio } from "./park-audio";
import { SharedLetterBody } from "./shared-letters";
import { api } from "@/lib/backend/browser-api";
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
  Pencil,
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

export function World({
  npcs,
  mapKey = "sta_ana_house",
  preview = false,
  onSceneChange,
  visitor,
  paused = false,
}: {
  npcs?: WorldNpc[];
  mapKey?: SceneKey;
  preview?: boolean;
  onSceneChange?: (map: SceneKey) => void;
  visitor?: ContributorVisit["visitor"];
  paused?: boolean;
}) {
  const connected = npcs !== undefined && !preview && !visitor;
  const place = SCENES[mapKey];
  const [bridge] = useState(() => new GameBridge(npcs, mapKey, visitor));
  const [nearId, setNearId] = useState("");
  const [talkId, setTalkId] = useState("");
  const [privateSeen, setPrivateSeen] = useState(
    () => new Set(npcs?.filter((n) => n.seen).map((n) => n.id)),
  );
  const markSeen = useCallback((id: string) => {
    setPrivateSeen((s) => new Set([...s, id]));
    window.dispatchEvent(new Event("hanna:seen"));
  }, []);
  const near = !!nearId;
  const canReadLetters = !visitor || !!npcs?.some((npc) => npc.readable);
  const nearName = npcs?.find((n) => n.id === nearId)?.name ?? "Teddy";
  const [dialogue, setDialogue] = useState(false);
  const [help, setHelp] = useState(false);
  const [status, setStatus] = useState<GameStatus>("loading");
  const [seen, setSeen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    bridge.connect(
      () => setNearId(bridge.nearId),
      (id) => {
        if (visitor && !bridge.canTalk(id)) return;
        setTalkId(id);
        setDialogue(true);
      },
      setStatus,
    );
    return () => {
      bridge.connect(
        () => {},
        () => {},
        () => {},
      );
    };
  }, [bridge, visitor]);
  useEffect(() => {
    bridge.pause(dialogue || help || paused);
  }, [bridge, dialogue, help, paused]);
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
    if (!open && !connected && !visitor) setSeen(true);
  }
  return (
    <main className="world-shell">
      {mapKey === "tuguegarao_park" && (
        <ParkAudio paused={dialogue || help || paused || status !== "ready"} />
      )}
      <header className="site-header">
        <Link
          className="brand"
          href={visitor ? "/contribute/visit" : "/"}
          aria-label="Hanna’s Little World home"
        >
          <span className="brand-icon">
            <Heart size={22} fill="currentColor" />
          </span>
          <span>
            Hanna’s <span className="brand-light">Little World</span>
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
              {visitor
                ? "Take a little walk with your bear. Everyone here is part of Hanna’s circle of support."
                : "There’s no rush and nothing to win. Wander around the yard and say hello."}
            </DialogDescription>
            <ul className="help-list">
              <li>
                <strong>Move</strong> with WASD, arrow keys, or the on-screen
                direction pad.
              </li>
              {canReadLetters && (
                <>
                  <li>
                    <strong>Talk</strong> when you’re near a bear. Press E,
                    Space, Enter, or tap Talk.
                  </li>
                </>
              )}
              <li>
                <strong>Take your time.</strong>{" "}
                {visitor
                  ? "The world pauses while a shared letter is open. Escape closes it."
                  : "The world pauses while a message is open. Escape closes it."}
              </li>
            </ul>
            <p className="sample-note">
              {visitor
                ? "Walk up to a bear who shared their letter and press E or tap Talk. Private letters, photos and voice notes stay private."
                : connected
                  ? "Your hellos are saved as you open them. You can always read them again."
                  : "Sample world · all characters and dialogue are synthetic."}
            </p>
          </DialogContent>
        </Dialog>
      </header>
      <section className="intro">
        <div>
          <div className="eyebrow">
            <span /> CHAPTER {place.chapter} · {place.eyebrow}
          </div>
          <h1>
            {place.title} <em>{place.accent}</em>
            <Heart className="title-heart" size={26} />
          </h1>
          <p>
            {visitor
              ? "A little place for everyone cheering Hanna on. You belong here, too."
              : "Familiar places. Your favorite people. A whole lot of love."}
          </p>
        </div>
        <div className="chapter-mark">
          <House size={20} />
          <span>
            {place.location}
            <small>{place.description}</small>
          </span>
        </div>
      </section>
      {onSceneChange && (
        <nav className="scene-picker" aria-label="Places in your little world">
          {SCENE_KEYS.map((key) => (
            <Button
              key={key}
              variant="outline"
              aria-pressed={mapKey === key}
              aria-label={`Visit ${SCENES[key].name}`}
              disabled={dialogue || help || mapKey === key}
              onClick={() => onSceneChange(key)}
            >
              <span>CHAPTER {SCENES[key].chapter}</span>
              {SCENES[key].name}
            </Button>
          ))}
        </nav>
      )}
      <section className="game-frame" aria-label={`Explore ${place.name}`}>
        <div className="stage-top">
          <span>
            <MapPin size={15} /> {place.name}
          </span>
          <span className="sun-label">☀ A lovely day to wander</span>
          <span className="preview-tag">
            {visitor
              ? "YOUR PLACE IN HER WORLD"
              : connected
                ? "YOUR LITTLE WORLD"
                : "SAMPLE WORLD"}
          </span>
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
              <p>This little place couldn’t load. Let’s try again.</p>
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
                  {visitor ? `Welcome, ${visitor.name}.` : place.welcome}
                  <small>
                    {visitor
                      ? "Take a little walk. Every bear is cheering her on."
                      : connected && !npcs.length
                        ? "A quiet little moment. More hellos will arrive soon."
                        : "Take a little walk. Someone’s here for you."}
                  </small>
                </span>
              </div>
              <div className="yard-caption">
                <span /> {place.caption}
              </div>
            </>
          )}
          <div
            className="touch-controls"
            aria-label="Movement controls"
            hidden={dialogue || help || paused || status !== "ready"}
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
            {canReadLetters && (
              <Button
                className="touch-talk"
                disabled={!near}
                aria-label={`Talk to ${nearName}`}
                onClick={() => {
                  bridge.requestTalk();
                }}
              >
                <MessageCircle size={21} />
                Talk
              </Button>
            )}
          </div>
        </div>
        <div className="stage-bottom">
          <div className="keyboard-hint">
            <span className="keycap">W A S D</span>
            <span>or</span>
            <span className="keycap">↑ ← ↓ →</span>
            <span>to wander</span>
            {canReadLetters && (
              <>
                <i />
                <span className="keycap">E</span>
                <span>to say hello</span>
              </>
            )}
          </div>
          <p className="near-status" role="status">
            {visitor
              ? near
                ? `${nearName} shared a letter. Say hello!`
                : "Walk up to a bear to read their shared letter."
              : near
                ? `${nearName} is nearby. Say hello!`
                : "Follow your feet. Find a familiar face."}
          </p>
          {visitor ? (
            <Button
              asChild
              variant="ghost"
              className="reset-button edit-message-button"
            >
              <Link href="/contribute?edit=1" aria-label="Edit your message">
                <Pencil size={15} />
                <span>Edit your message</span>
              </Link>
            </Button>
          ) : (
            <Button
              variant="ghost"
              className="reset-button"
              aria-label={"Return Hanna to the starting spot"}
              onClick={() => {
                bridge.requestReset();
              }}
            >
              <RotateCcw size={15} />
              <span>Back to start</span>
            </Button>
          )}
        </div>
      </section>
      <footer className="world-footer">
        <div className="location-pill">
          <span className="location-symbol">
            <House size={19} />
          </span>
          <span>
            {place.name}
            <small>CHAPTER {place.chapter}</small>
          </span>
          <span className="here-label">YOU ARE HERE</span>
        </div>
        <p>
          <Leaf size={15} /> Little steps. Lovely memories.
        </p>
        <span className="seen-count">
          <MessageCircle size={16} />{" "}
          {visitor
            ? `${(npcs?.length ?? 0) + 1} little bear${npcs?.length ? "s" : ""} cheering Hanna on`
            : connected
              ? `${npcs.filter((n) => n.seen || privateSeen.has(n.id)).length} of ${npcs.length} hellos shared`
              : seen
                ? "1 hello shared"
                : "A hello is waiting"}
        </span>
      </footer>
      {visitor ? (
        <p className="preview-note">
          <Heart size={14} /> Walk up to a bear and say hello to read their
          shared letter. Each person chooses whether their words can be read by
          invited friends.
        </p>
      ) : connected ? (
        <div className="preview-note recipient-actions">
          <Button variant="outline" onClick={() => location.reload()}>
            Refresh the world
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await api("recipient/logout", "POST");
              } finally {
                location.replace("/");
              }
            }}
          >
            Leave for now
          </Button>
        </div>
      ) : (
        <p className="preview-note">
          <Trees size={14} /> Sample characters and dialogue · Open your private
          recipient link for published hellos.
        </p>
      )}
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
          {visitor ? (
            <>
              <SharedLetterBody key={talkId} id={talkId} />
              <div className="message-footer">
                <span>The world can wait.</span>
                <Button onClick={() => closeDialogue(false)}>
                  Back to our little place
                </Button>
              </div>
            </>
          ) : connected ? (
            <>
              <RecipientDialogue key={talkId} id={talkId} onSeen={markSeen} />
              <div className="message-footer">
                <span>The world can wait.</span>
                <Button onClick={() => closeDialogue(false)}>
                  Back to the sunshine
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="dialog-eyebrow">
                <MessageCircle size={16} /> A LITTLE HELLO · SAMPLE MESSAGE
              </div>
              <div className="sender">
                <span className="bear-avatar" aria-hidden>
                  ʕ•ᴥ•ʔ
                </span>
                <div>
                  <DialogTitle>{nearName}</DialogTitle>
                  <span>Your friendly sample companion</span>
                </div>
                <Heart size={23} className="message-heart" />
              </div>
              <DialogDescription asChild>
                <div className="message-body">
                  <p>Welcome home, Hanna! 🌼</p>
                  <p>
                    This is a little practice hello from your sample bear
                    friend. Take a walk around the yard, enjoy the sunshine, and
                    make yourself at home.
                  </p>
                  <p>
                    Walang nagmamadali dito. There’s always time for a little
                    rest and a friendly hello. ♡
                  </p>
                  <p className="sample-note">
                    Synthetic demo text. Open your private recipient link to
                    read published personal messages.
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
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
