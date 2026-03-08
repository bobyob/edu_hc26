import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import questions from "../data/questions.json";
import {
  startSession,
  recordAnswer,
  recordEmotion,
  endSession,
  getModuleStats,
  getAllStats,
} from "../services/sessionService";
import { sendEmotionToPi, sendSessionToPi, checkPiConnection } from "../services/piService";
import { StudentSummaryModal, ParentSummaryModal } from "../components/SummaryModals";

const MODULES = [
  { id: "math", label: "Math Assignment", icon: "📐" },
  { id: "science", label: "Science Project", icon: "🔬" },
  { id: "english", label: "English Essay", icon: "📝" },
];

const QUIZ_LENGTH = 5;

// FastAPI emotion server — running on your laptop alongside the React app
const EMOTION_SERVER = "http://localhost:8000";

// How often to capture a frame and analyze emotion (ms)
const EMOTION_INTERVAL_MS = 6000;

export default function DashboardPage() {
  const navigate = useNavigate();

  // ── UI State ──────────────────────────────────────────────────────
  const [activeModule, setActiveModule] = useState("math");
  const [quizState, setQuizState] = useState("idle"); // idle | active | done
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [difficulty, setDifficulty] = useState("easy");
  const [results, setResults] = useState([]);
  const [finishedSession, setFinishedSession] = useState(null);

  // ── Modal State ───────────────────────────────────────────────────
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showParentModal, setShowParentModal] = useState(false);
  const [modalStats, setModalStats] = useState(null);
  const [allStats, setAllStats] = useState(null);

  // ── Pi State ──────────────────────────────────────────────────────
  const [piConnected, setPiConnected] = useState(false);

  // ── Camera / Emotion State ────────────────────────────────────────
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [currentEmotion, setCurrentEmotion] = useState(null);
  const [emotionServerUp, setEmotionServerUp] = useState(false);

  // Refs for camera internals
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const emotionIntervalRef = useRef(null);
  const activeModuleRef = useRef(activeModule);
  const cameraReadyRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { activeModuleRef.current = activeModule; }, [activeModule]);
  useEffect(() => { cameraReadyRef.current = cameraReady; }, [cameraReady]);

  // Check Pi + emotion server on mount
  useEffect(() => {
    checkPiConnection().then(setPiConnected);
    checkEmotionServer();
  }, []);

  // ── Emotion Server Health Check ───────────────────────────────────
  async function checkEmotionServer() {
    try {
      const res = await fetch(`${EMOTION_SERVER}/docs`, {
        signal: AbortSignal.timeout(2000),
      });
      setEmotionServerUp(res.ok);
    } catch {
      setEmotionServerUp(false);
    }
  }

  // ── Camera Setup ──────────────────────────────────────────────────
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err) {
      setCameraError(
        err.name === "NotAllowedError"
          ? "Camera access denied. Please allow camera access in your browser and refresh."
          : `Camera error: ${err.message}`
      );
      setCameraReady(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // ── Frame Capture + Emotion Analysis ─────────────────────────────
  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !cameraReadyRef.current) return;

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

      const base64Image = canvas.toDataURL("image/jpeg", 0.8);

      const response = await fetch(`${EMOTION_SERVER}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64Image }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return;
      const data = await response.json();
      const emotion = data.emotion;
      if (!emotion) return;

      const mapped = mapToDisplayEmotion(emotion);
      setCurrentEmotion(mapped);
      recordEmotion(mapped);
      sendEmotionToPi(mapped, activeModuleRef.current);

      console.log(`[EMOTION] ${emotion} → ${mapped}`);
    } catch (err) {
      console.warn("Emotion capture failed:", err.message);
    }
  }, []);

  // Map DeepFace student states → our 4 Pi display emotions
  function mapToDisplayEmotion(state) {
    const map = {
      engaged: "happy",
      focused: "neutral",
      frustrated: "frustrated",
      discouraged: "sad",
      anxious: "frustrated",
      surprised: "neutral",
      unknown: "neutral",
    };
    return map[state] || "neutral";
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function getQuestionsForSession(module, diff) {
    const pool = questions[module]?.[diff] || questions[module]?.easy || [];
    return [...pool].sort(() => Math.random() - 0.5).slice(0, QUIZ_LENGTH);
  }

  function handleModuleClick(moduleId) {
    if (quizState === "active") return;
    setActiveModule(moduleId);
    setQuizState("idle");
    setFinishedSession(null);
    const stats = getModuleStats(moduleId);
    setDifficulty(stats.nextDifficulty || stats.lastDifficulty || "easy");
  }

  // ── Quiz Flow ─────────────────────────────────────────────────────
  async function handleStartQuiz() {
    const qs = getQuestionsForSession(activeModule, difficulty);
    setQuizQuestions(qs);
    setCurrentQ(0);
    setResults([]);
    setSelectedAnswer(null);
    setShowResult(false);
    setFinishedSession(null);
    setCurrentEmotion(null);

    startSession(activeModule, difficulty);
    setQuizState("active");

    // Start camera first, then begin polling
    await startCamera();

    emotionIntervalRef.current = setInterval(() => {
      captureAndAnalyze();
    }, EMOTION_INTERVAL_MS);

    // Grab first reading after a short delay so camera has time to warm up
    setTimeout(() => captureAndAnalyze(), 1500);
  }

  function handleAnswer(option) {
    if (showResult) return;
    const q = quizQuestions[currentQ];
    const correct = option === q.answer;
    setSelectedAnswer(option);
    setShowResult(true);
    recordAnswer(q.id, correct);
    setResults((prev) => [...prev, { correct }]);
  }

  function handleNext() {
    setSelectedAnswer(null);
    setShowResult(false);

    if (currentQ + 1 >= quizQuestions.length) {
      clearInterval(emotionIntervalRef.current);
      stopCamera();
      const session = endSession();
      setFinishedSession(session);
      setQuizState("done");
      if (session) sendSessionToPi(session);
    } else {
      setCurrentQ((prev) => prev + 1);
    }
  }

  // ── Modals ────────────────────────────────────────────────────────
  function openStudentSummary() {
    setModalStats(getModuleStats(activeModule));
    setShowStudentModal(true);
  }

  function openParentSummary() {
    setModalStats(getModuleStats(activeModule));
    setAllStats(getAllStats());
    setShowParentModal(true);
  }

  // ── Derived ───────────────────────────────────────────────────────
  const activeModuleInfo = MODULES.find((m) => m.id === activeModule);
  const moduleStats = getModuleStats(activeModule);
  const currentQuestion = quizQuestions[currentQ];

  const emotionDotColor = {
    happy: "bg-green-500",
    neutral: "bg-blue-400",
    frustrated: "bg-red-500",
    sad: "bg-yellow-400",
  }[currentEmotion] || "bg-gray-300";

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* Hidden camera elements — never shown to user */}
      <video ref={videoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Top Nav ── */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-lg">🎓</span>
          <span className="font-bold text-gray-900">MyFocusFriend</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Live emotion pill — only during quiz */}
          {quizState === "active" && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
              <div className={`w-2.5 h-2.5 rounded-full ${emotionDotColor} animate-pulse`} />
              <span className="text-xs font-medium text-gray-600 capitalize">
                {currentEmotion ? `Feeling ${currentEmotion}` : "Analysing..."}
              </span>
            </div>
          )}

          <span className={`text-xs font-medium flex items-center gap-1 ${piConnected ? "text-green-600" : "text-gray-400"}`}>
            <span className={`w-2 h-2 rounded-full inline-block ${piConnected ? "bg-green-500" : "bg-gray-300"}`} />
            {piConnected ? "Pebble Connected" : "Pebble Offline"}
          </span>

          <span className={`text-xs font-medium flex items-center gap-1 ${emotionServerUp ? "text-green-600" : "text-gray-400"}`}>
            <span className={`w-2 h-2 rounded-full inline-block ${emotionServerUp ? "bg-green-500" : "bg-gray-300"}`} />
            {emotionServerUp ? "Emotion Server On" : "Emotion Server Off"}
          </span>

          <button
            onClick={() => navigate("/")}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            🏠 Back to Home
          </button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <aside className="w-56 bg-white border-r border-gray-200 flex flex-col pt-6 pb-4 flex-shrink-0">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-5 mb-3">
            Assignments
          </p>
          <nav className="flex-1 px-3 space-y-1">
            {MODULES.map((m) => (
              <button
                key={m.id}
                onClick={() => handleModuleClick(m.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-100 text-left
                  ${activeModule === m.id ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"}`}
              >
                <span>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </nav>
          <div className="px-3 mt-4">
            <button disabled className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white bg-blue-400 cursor-not-allowed opacity-70">
              + Add Assignment
            </button>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 overflow-y-auto p-8">
          <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Student Dashboard</h1>
          <p className="text-gray-500 text-sm mb-8">Track your progress and performance metrics</p>

          {/* Camera error banner */}
          {cameraError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              📷 {cameraError}
            </div>
          )}

          {/* ── Performance Overview ── */}
          {quizState !== "active" && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
              <h2 className="text-base font-semibold text-gray-800 mb-5">Performance Overview</h2>
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-lg border border-gray-200 p-4 flex flex-col items-center gap-2">
                  <p className="text-xs text-gray-500">Average Emotion</p>
                  <div className={`w-10 h-10 rounded-full ${
                    moduleStats.averageEmotion === "happy" ? "bg-green-500" :
                    moduleStats.averageEmotion === "frustrated" ? "bg-red-500" :
                    moduleStats.averageEmotion === "sad" ? "bg-yellow-400" : "bg-blue-400"
                  }`} />
                  <p className="font-semibold text-gray-800 capitalize text-sm">
                    {moduleStats.timesAttempted > 0 ? moduleStats.averageEmotion : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 flex flex-col items-center justify-center gap-1">
                  <div className="relative flex items-center justify-center" style={{ height: 80 }}>
                    <svg width="80" height="80" className="-rotate-90" style={{ position: "absolute" }}>
                      <circle cx="40" cy="40" r="32" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                      <circle cx="40" cy="40" r="32" fill="none" stroke="#2563eb" strokeWidth="8"
                        strokeDasharray={`${(moduleStats.averageScore / 100) * (2 * Math.PI * 32)} ${2 * Math.PI * 32}`}
                        strokeLinecap="round" />
                    </svg>
                    <span className="text-lg font-extrabold text-gray-900 relative z-10">
                      {moduleStats.timesAttempted > 0 ? `${moduleStats.averageScore}%` : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">Average Score</p>
                </div>
                <div className="rounded-lg border-2 border-green-400 p-4 flex flex-col items-center justify-center gap-1">
                  <p className="text-xs text-gray-500">Question Success</p>
                  <span className="text-2xl text-green-500">✓</span>
                  <p className="font-bold text-green-600 text-sm">
                    {moduleStats.timesAttempted > 0 ? moduleStats.successLevel : "No data yet"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4 border-t border-gray-100 pt-4">
                <MetricCell label="Total Modules" value={3} />
                <MetricCell label="Times Attempted" value={moduleStats.timesAttempted || 0} />
                <MetricCell label="Difficulty" value={difficulty} capitalize />
                <MetricCell label="Correct Answers"
                  value={moduleStats.timesAttempted > 0 ? `${moduleStats.totalCorrect}/${moduleStats.totalQuestions}` : "—"} />
              </div>
            </div>
          )}

          {/* ── Quiz Area ── */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">

            {/* IDLE */}
            {quizState === "idle" && (
              <div className="flex flex-col items-center py-10 gap-4">
                <span className="text-5xl">{activeModuleInfo?.icon}</span>
                <h2 className="text-xl font-bold text-gray-900">{activeModuleInfo?.label}</h2>
                <p className="text-gray-500 text-sm">
                  Difficulty: <span className="font-semibold capitalize text-blue-600">{difficulty}</span>
                </p>
                {moduleStats.timesAttempted > 0 && (
                  <p className="text-xs text-gray-400">
                    Last score: {moduleStats.lastScore}% · {moduleStats.timesAttempted} attempt{moduleStats.timesAttempted !== 1 ? "s" : ""}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs mt-1">
                  <span className="text-gray-400">📷 Camera starts with quiz</span>
                  <span className={emotionServerUp ? "text-green-600" : "text-yellow-600"}>
                    🧠 {emotionServerUp ? "Emotion tracking ready" : "Emotion server offline"}
                  </span>
                </div>
                <button
                  onClick={handleStartQuiz}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg text-sm transition-colors shadow-md"
                >
                  Start Quiz
                </button>
              </div>
            )}

            {/* ACTIVE */}
            {quizState === "active" && currentQuestion && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-500">
                    Question {currentQ + 1} of {quizQuestions.length}
                  </p>
                  <div className="flex items-center gap-3">
                    {currentEmotion && (
                      <span className="text-xs text-gray-400 capitalize">😶 {currentEmotion}</span>
                    )}
                    <p className="text-sm text-gray-400 capitalize">{difficulty} difficulty</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
                  <div className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(currentQ / quizQuestions.length) * 100}%` }} />
                </div>
                <p className="text-lg font-semibold text-gray-900 mb-6">{currentQuestion.question}</p>
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {currentQuestion.options.map((opt) => {
                    let style = "border-gray-200 bg-white hover:bg-gray-50 text-gray-700";
                    if (showResult) {
                      if (opt === currentQuestion.answer) style = "border-green-500 bg-green-50 text-green-800 font-semibold";
                      else if (opt === selectedAnswer) style = "border-red-400 bg-red-50 text-red-700";
                      else style = "border-gray-200 bg-white text-gray-400 opacity-60";
                    }
                    return (
                      <button key={opt} onClick={() => handleAnswer(opt)} disabled={showResult}
                        className={`border-2 rounded-lg px-4 py-3 text-sm text-left transition-all duration-150 ${style}`}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {showResult && (
                  <div className="flex items-center justify-between">
                    <p className={`text-sm font-semibold ${selectedAnswer === currentQuestion.answer ? "text-green-600" : "text-red-500"}`}>
                      {selectedAnswer === currentQuestion.answer ? "✓ Correct!" : `✗ Correct answer: ${currentQuestion.answer}`}
                    </p>
                    <button onClick={handleNext}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-6 py-2 rounded-lg transition-colors">
                      {currentQ + 1 >= quizQuestions.length ? "Finish Quiz" : "Next →"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* DONE */}
            {quizState === "done" && finishedSession && (
              <div className="flex flex-col items-center py-8 gap-3">
                <span className="text-5xl">
                  {finishedSession.score >= 80 ? "🎉" : finishedSession.score >= 50 ? "👍" : "💪"}
                </span>
                <h2 className="text-xl font-bold text-gray-900">Quiz Complete!</h2>
                <p className="text-gray-500 text-sm">
                  You got <span className="font-bold text-blue-600">{finishedSession.correctCount} / {finishedSession.totalCount}</span> correct — {finishedSession.score}%
                </p>
                <p className="text-xs text-gray-400 capitalize">Average emotion: {finishedSession.averageEmotion}</p>
                <button onClick={() => setQuizState("idle")} className="mt-2 text-sm text-blue-600 hover:underline">
                  Try again
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Bottom Summary Buttons ── */}
      <div className="bg-white border-t border-gray-200 px-8 py-4 flex gap-4">
        <button onClick={openStudentSummary}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-sm transition-colors">
          👤 View Student Summary
        </button>
        <button onClick={openParentSummary}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 rounded-lg text-sm transition-colors">
          👨‍👩‍👧 View Parent/Tutor Summary
        </button>
      </div>

      {/* ── Modals ── */}
      {showStudentModal && modalStats && (
        <StudentSummaryModal module={activeModule} stats={modalStats} onClose={() => setShowStudentModal(false)} />
      )}
      {showParentModal && modalStats && (
        <ParentSummaryModal module={activeModule} stats={modalStats} allStats={allStats} onClose={() => setShowParentModal(false)} />
      )}
    </div>
  );
}

function MetricCell({ label, value, capitalize }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-bold text-gray-900 ${capitalize ? "capitalize" : ""}`}>{value}</p>
    </div>
  );
}
