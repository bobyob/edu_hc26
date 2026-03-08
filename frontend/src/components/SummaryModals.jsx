// SummaryModals.jsx
// Contains both the StudentSummaryModal and ParentSummaryModal components.

const emotionColors = {
  happy: { bg: "bg-green-100", dot: "bg-green-500", text: "text-green-700" },
  neutral: { bg: "bg-blue-100", dot: "bg-blue-400", text: "text-blue-700" },
  sad: { bg: "bg-yellow-100", dot: "bg-yellow-500", text: "text-yellow-700" },
  frustrated: { bg: "bg-red-100", dot: "bg-red-500", text: "text-red-700" },
};

const moduleLabels = {
  math: "Math Assignment",
  science: "Science Project",
  english: "English Essay",
};

function getSuccessColor(level) {
  if (level === "High Success") return "text-green-600";
  if (level === "Moderate Success") return "text-blue-600";
  if (level === "Needs Practice") return "text-yellow-600";
  return "text-red-500";
}

// ── Circular score arc (replaces dial) ──────────────────────────────
function ScoreCircle({ score }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" className="-rotate-90">
        {/* Track */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
        />
        {/* Progress */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke="#2563eb"
          strokeWidth="12"
          strokeDasharray={`${filled} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ marginTop: "-100px" }}>
        <span className="text-3xl font-extrabold text-gray-900">{score}%</span>
      </div>
      <p className="text-sm text-gray-500 mt-1">Average Score</p>
    </div>
  );
}

// ── Overlay backdrop ─────────────────────────────────────────────────
function ModalBackdrop({ onClose, children }) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// STUDENT SUMMARY MODAL
// ════════════════════════════════════════════════════════════════════
export function StudentSummaryModal({ module, stats, onClose }) {
  const emotion = stats.averageEmotion || "neutral";
  const colors = emotionColors[emotion] || emotionColors.neutral;
  const label = moduleLabels[module] || module;

  return (
    <ModalBackdrop onClose={onClose}>
      {/* Header */}
      <div className="flex items-start justify-between px-8 pt-8 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">
            Student Summary
          </h2>
          <p className="text-gray-500 text-sm mt-1">{label}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none mt-1"
        >
          ×
        </button>
      </div>

      <div className="px-8 pb-8">
        {/* Performance Overview */}
        <h3 className="text-base font-semibold text-gray-800 mb-5">
          Performance Overview
        </h3>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Average Emotion */}
          <div className={`rounded-xl border border-gray-200 p-5 flex flex-col items-center gap-3 ${colors.bg}`}>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Average Emotion
            </p>
            <div className={`w-14 h-14 rounded-full ${colors.dot} shadow-md`} />
            <p className={`font-bold text-lg capitalize ${colors.text}`}>
              {emotion}
            </p>
          </div>

          {/* Average Score */}
          <div className="rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center bg-white relative">
            <div className="relative flex items-center justify-center" style={{ height: 140 }}>
              <svg width="140" height="140" className="-rotate-90" style={{ position: "absolute" }}>
                <circle cx="70" cy="70" r="54" fill="none" stroke="#e5e7eb" strokeWidth="12" />
                <circle
                  cx="70" cy="70" r="54"
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="12"
                  strokeDasharray={`${(stats.averageScore / 100) * (2 * Math.PI * 54)} ${2 * Math.PI * 54}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-2xl font-extrabold text-gray-900 relative z-10">
                {stats.averageScore}%
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Average Score</p>
          </div>

          {/* Question Success */}
          <div className="rounded-xl border-2 border-green-400 p-5 flex flex-col items-center justify-center gap-2 bg-white">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide text-center">
              Question Success
            </p>
            <span className="text-3xl text-green-500">✓</span>
            <p className={`font-bold text-base ${getSuccessColor(stats.successLevel)}`}>
              {stats.successLevel}
            </p>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 grid grid-cols-2 gap-4">
          <Stat label="Questions Correct" value={`${stats.totalCorrect} / ${stats.totalQuestions}`} />
          <Stat label="Times Attempted" value={stats.timesAttempted} />
          <Stat label="Last Score" value={`${stats.lastScore}%`} />
          <Stat label="Next Difficulty" value={stats.nextDifficulty || "—"} capitalize />
        </div>
      </div>
    </ModalBackdrop>
  );
}

// ════════════════════════════════════════════════════════════════════
// PARENT / TUTOR SUMMARY MODAL
// ════════════════════════════════════════════════════════════════════
export function ParentSummaryModal({ module, stats, allStats, onClose }) {
  const label = moduleLabels[module] || module;

  return (
    <ModalBackdrop onClose={onClose}>
      {/* Header */}
      <div className="flex items-start justify-between px-8 pt-8 pb-4">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900">
            Parent / Tutor Summary
          </h2>
          <p className="text-gray-500 text-sm mt-1">{label}</p>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none mt-1"
        >
          ×
        </button>
      </div>

      <div className="px-8 pb-8">
        {/* Top stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center bg-blue-50">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Overall Average</p>
            <p className="text-3xl font-extrabold text-blue-600">
              {allStats?.overallAverage ?? stats.averageScore}%
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center bg-white">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Total Sessions</p>
            <p className="text-3xl font-extrabold text-gray-900">
              {allStats?.totalSessions ?? stats.timesAttempted}
            </p>
          </div>
          <div className="rounded-xl border-2 border-green-400 p-5 flex flex-col items-center justify-center">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2 text-center">Module Score</p>
            <p className={`text-2xl font-bold ${getSuccessColor(stats.successLevel)}`}>
              {stats.successLevel}
            </p>
          </div>
        </div>

        {/* Per-module breakdown */}
        {allStats?.byModule && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Score by Module</h3>
            <div className="space-y-2">
              {Object.entries(allStats.byModule).map(([mod, s]) => (
                <div key={mod} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-gray-600 capitalize">{mod}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${s.averageScore}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 w-10 text-right">
                    {s.timesAttempted > 0 ? `${s.averageScore}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">📋 Next Steps</h3>
          <ul className="space-y-2">
            {(stats.nextSteps || ["Complete a session to get personalized recommendations."]).map(
              (step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-blue-500 mt-0.5">→</span>
                  {step}
                </li>
              )
            )}
          </ul>
        </div>

        {/* Tailscale note */}
        <p className="text-xs text-gray-400 mt-4 text-center">
          🔒 This summary is also accessible securely via your Tailscale network at your Pi's .ts.net URL
        </p>
      </div>
    </ModalBackdrop>
  );
}

// ── Small stat cell helper ────────────────────────────────────────────
function Stat({ label, value, capitalize }) {
  return (
    <div>
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-lg font-bold text-gray-900 ${capitalize ? "capitalize" : ""}`}>
        {value}
      </p>
    </div>
  );
}
