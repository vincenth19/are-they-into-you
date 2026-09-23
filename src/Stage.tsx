import { AnimatePresence, motion } from "motion/react";

export type Mood = "worried" | "happy" | "dead";

const HEART =
  "M100 180C30 130 10 95 10 62C10 32 34 12 62 12C80 12 93 22 100 38C107 22 120 12 138 12C166 12 190 32 190 62C190 95 170 130 100 180Z";
const STONE = "M30 188V90Q30 30 100 30Q170 30 170 90V188Z";
// Meter segments from "Cooked" (level 0) to "Down bad" (level 4).
const SEGMENTS = ["stroke-sky", "stroke-mint", "stroke-lemon", "stroke-peach", "stroke-heart"];
const PHRASES = ["U UP?", "WYD", "HAHA OK", "K.", "TEXT ME", "SEEN", "BE MINE?", "LOL NO", "DOWN BAD", "COOKED"];

const polar = (deg: number) => {
  const rad = (deg * Math.PI) / 180;
  return `${100 + 80 * Math.cos(rad)} ${100 - 80 * Math.sin(rad)}`;
};

// A ticker of candy-heart texting phrases across the top of the page.
export function Marquee() {
  return (
    <div aria-hidden className="shrink-0 overflow-hidden bg-plum py-2 font-display text-lg text-cream">
      <div className="flex w-max motion-safe:animate-marquee">
        {[0, 1].map((copy) => (
          <div key={copy} className="flex">
            {PHRASES.map((phrase) => (
              <span key={phrase} className="px-4 whitespace-nowrap">
                {phrase} <span className="text-heart">♥</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// The meter's needle pivots on the character's head, so one drawing shows both.
export function Gauge({ mood, score, loading }: { mood: Mood; score: number | null; loading: boolean }) {
  return (
    <svg viewBox="-14 0 228 180" className="min-h-0 w-full max-w-72 flex-1 lg:max-w-96" role="img" aria-label="Interest meter">
      <defs>
        <radialGradient id="candy" cx="35%" cy="25%" r="80%">
          <stop offset="0" stopColor="#ffe3ee" />
          <stop offset="0.6" style={{ stopColor: "var(--color-heart)" }} />
        </radialGradient>
      </defs>
      <path d={`M${polar(180)}A80 80 0 0 1 ${polar(0)}`} className="stroke-plum" strokeWidth={38} strokeLinecap="round" fill="none" />
      {SEGMENTS.map((stroke, i) => (
        <path
          key={stroke}
          d={`M${polar(179 - 36 * i)}A80 80 0 0 1 ${polar(145 - 36 * i)}`}
          className={stroke}
          strokeWidth={26}
          fill="none"
        />
      ))}
      <g textAnchor="middle" className="fill-cream text-[15px] font-medium">
        <text x={20} y={138}>
          Cooked
        </text>
        <text x={180} y={138}>
          Down bad
        </text>
      </g>
      <motion.g
        style={{ originX: 0.5, originY: 1 }}
        animate={{ rotate: loading ? [-70, 40, -20, 75, -50] : score === null ? 0 : -90 + score * 45 }}
        transition={
          loading ? { duration: 1.4, repeat: Infinity, repeatType: "mirror" } : { type: "spring", stiffness: 60, damping: 6 }
        }
      >
        <line x1={100} y1={100} x2={100} y2={30} className="stroke-plum" strokeWidth={10} strokeLinecap="round" />
        <line x1={100} y1={100} x2={100} y2={30} className="stroke-cream" strokeWidth={5} strokeLinecap="round" />
      </motion.g>
      <circle cx={100} cy={100} r={9} className="fill-plum" />
      <g transform="translate(55 83) scale(0.45)">
        <AnimatePresence mode="wait">
          {mood === "dead" ? <Tombstone key="dead" /> : <Heart key={mood} happy={mood === "happy"} loading={loading} />}
        </AnimatePresence>
      </g>
    </svg>
  );
}

function Heart({ happy, loading }: { happy: boolean; loading: boolean }) {
  return (
    <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
      <motion.g
        animate={happy ? { y: [0, -18] } : { rotate: [-5, 5] }}
        transition={{ repeat: Infinity, repeatType: "mirror", duration: happy ? 0.35 : loading ? 0.07 : 1.1 }}
      >
        {/* The candy's thickness, then its face. */}
        <path d={HEART} transform="translate(0 16)" className="fill-heart-side" />
        <path d={HEART} fill="url(#candy)" />
        <g className="stroke-stamp" strokeWidth={6} strokeLinecap="round" fill="none">
          {happy ? (
            <>
              <path d="M63 86Q75 70 87 86M113 86Q125 70 137 86" />
              <path d="M72 106Q100 142 128 106Z" className="fill-stamp" />
            </>
          ) : (
            <>
              <path d="M60 64L84 56M116 56L140 64" />
              <path d="M76 122Q87 112 100 122T124 122" />
            </>
          )}
        </g>
        {happy ? (
          <g className="fill-stamp" opacity={0.25}>
            <ellipse cx={56} cy={104} rx={11} ry={7} />
            <ellipse cx={144} cy={104} rx={11} ry={7} />
          </g>
        ) : (
          <>
            <circle cx={75} cy={84} r={7} className="fill-stamp" />
            <circle cx={125} cy={84} r={7} className="fill-stamp" />
            <motion.path
              d="M166 44Q176 60 166 66Q156 60 166 44Z"
              className="fill-sky stroke-plum/30"
              strokeWidth={2}
              animate={{ y: [0, 34], opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: loading ? 0.6 : 1.6 }}
            />
          </>
        )}
      </motion.g>
    </motion.g>
  );
}

function Tombstone() {
  const year = new Date().getFullYear();
  return (
    <motion.g
      initial={{ y: -240, rotate: -10 }}
      animate={{ y: 0, rotate: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 12 }}
    >
      <ellipse cx={100} cy={188} rx={96} ry={12} className="fill-mint" />
      <path d={STONE} transform="translate(10 6)" className="fill-stone-side" />
      <path d={STONE} className="fill-stone" />
      <g textAnchor="middle" className="fill-plum/60">
        <text x={100} y={100} className="font-display text-[42px]">
          RIP
        </text>
        <text x={100} y={134} className="text-[20px]">
          your chances
        </text>
        <text x={100} y={162} className="text-[17px]">
          {year} – {year}
        </text>
      </g>
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ y: [0, -30], opacity: [0.9, 0] }}
        transition={{ repeat: Infinity, duration: 2.2, delay: 0.8 }}
      >
        <path d={HEART} transform="translate(150 36) scale(0.16)" className="fill-heart" />
      </motion.g>
    </motion.g>
  );
}
