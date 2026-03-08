// sessionService.js
// Manages all in-memory session state for quiz attempts, emotions, and history.
// No database needed — data persists while the tab is open.

const SESSION_KEY = "mff_sessions";

// ---------- Helpers ----------

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to save sessions:", e);
  }
}

// ---------- Active Session (current quiz in progress) ----------

let activeSession = null;

/**
 * Start a new quiz session for a given module.
 * @param {string} module - "math" | "science" | "english"
 * @param {string} difficulty - "easy" | "medium" | "hard"
 */
export function startSession(module, difficulty = "easy") {
  activeSession = {
    module,
    difficulty,
    startTime: Date.now(),
    emotions: [],       // array of emotion strings recorded during quiz
    answers: [],        // { questionId, correct: bool }
    completed: false,
  };
}

/**
 * Record an emotion reading during the quiz.
 * @param {string} emotion - "happy" | "sad" | "frustrated" | "neutral"
 */
export function recordEmotion(emotion) {
  if (!activeSession) return;
  activeSession.emotions.push(emotion);
}

/**
 * Record an answer result.
 * @param {string} questionId
 * @param {boolean} correct
 */
export function recordAnswer(questionId, correct) {
  if (!activeSession) return;
  activeSession.answers.push({ questionId, correct });
}

/**
 * End the current session and persist it.
 * Returns the completed session object.
 */
export function endSession() {
  if (!activeSession) return null;

  activeSession.completed = true;
  activeSession.endTime = Date.now();

  // Calculate score
  const total = activeSession.answers.length;
  const correct = activeSession.answers.filter((a) => a.correct).length;
  activeSession.score = total > 0 ? Math.round((correct / total) * 100) : 0;
  activeSession.correctCount = correct;
  activeSession.totalCount = total;

  // Calculate average emotion
  activeSession.averageEmotion = computeAverageEmotion(activeSession.emotions);

  // Determine next difficulty
  activeSession.nextDifficulty = recommendDifficulty(
    activeSession.score,
    activeSession.difficulty
  );

  // Persist
  const sessions = loadSessions();
  if (!sessions[activeSession.module]) {
    sessions[activeSession.module] = [];
  }
  sessions[activeSession.module].push({ ...activeSession });
  saveSessions(sessions);

  const finished = { ...activeSession };
  activeSession = null;
  return finished;
}

// ---------- Historical Data ----------

/**
 * Get all past sessions for a module.
 * @param {string} module
 */
export function getSessionHistory(module) {
  const sessions = loadSessions();
  return sessions[module] || [];
}

/**
 * Get aggregated stats for a module (for summaries).
 * @param {string} module
 */
export function getModuleStats(module) {
  const history = getSessionHistory(module);
  if (history.length === 0) {
    return {
      timesAttempted: 0,
      averageScore: 0,
      lastScore: 0,
      averageEmotion: "neutral",
      totalCorrect: 0,
      totalQuestions: 0,
      successLevel: "N/A",
      nextSteps: generateNextSteps(module, 0, 0),
    };
  }

  const totalScore = history.reduce((sum, s) => sum + (s.score || 0), 0);
  const averageScore = Math.round(totalScore / history.length);
  const lastSession = history[history.length - 1];

  const allEmotions = history.flatMap((s) => s.emotions || []);
  const averageEmotion = computeAverageEmotion(allEmotions);

  const totalCorrect = history.reduce((sum, s) => sum + (s.correctCount || 0), 0);
  const totalQuestions = history.reduce((sum, s) => sum + (s.totalCount || 0), 0);

  return {
    timesAttempted: history.length,
    averageScore,
    lastScore: lastSession.score || 0,
    averageEmotion,
    totalCorrect,
    totalQuestions,
    successLevel: getSuccessLevel(averageScore),
    nextSteps: generateNextSteps(module, averageScore, history.length),
    lastDifficulty: lastSession.difficulty,
    nextDifficulty: lastSession.nextDifficulty,
  };
}

/**
 * Get stats across ALL modules (for parent/tutor summary).
 */
export function getAllStats() {
  const modules = ["math", "science", "english"];
  const allStats = {};
  let totalSessions = 0;
  let totalScore = 0;
  let scoredModules = 0;

  modules.forEach((m) => {
    const stats = getModuleStats(m);
    allStats[m] = stats;
    totalSessions += stats.timesAttempted;
    if (stats.timesAttempted > 0) {
      totalScore += stats.averageScore;
      scoredModules++;
    }
  });

  return {
    byModule: allStats,
    totalSessions,
    overallAverage: scoredModules > 0 ? Math.round(totalScore / scoredModules) : 0,
  };
}

// ---------- Private Helpers ----------

function computeAverageEmotion(emotions) {
  if (!emotions || emotions.length === 0) return "neutral";
  const counts = { happy: 0, sad: 0, frustrated: 0, neutral: 0 };
  emotions.forEach((e) => {
    if (counts[e] !== undefined) counts[e]++;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function getSuccessLevel(score) {
  if (score >= 80) return "High Success";
  if (score >= 60) return "Moderate Success";
  if (score >= 40) return "Needs Practice";
  return "Needs Support";
}

function recommendDifficulty(score, current) {
  if (score >= 80 && current !== "hard") {
    return current === "easy" ? "medium" : "hard";
  }
  if (score < 50 && current !== "easy") {
    return current === "hard" ? "medium" : "easy";
  }
  return current;
}

function generateNextSteps(module, averageScore, attempts) {
  if (attempts === 0) return [`Start your first ${module} quiz to get personalized feedback.`];

  const steps = [];
  if (averageScore < 60) {
    steps.push(`Review core ${module} concepts before the next attempt.`);
    steps.push("Consider trying the easy difficulty to build confidence.");
  } else if (averageScore < 80) {
    steps.push(`Good progress in ${module}! Try increasing the difficulty.`);
    steps.push("Focus on the questions you got wrong in previous sessions.");
  } else {
    steps.push(`Excellent ${module} performance! Try the hard difficulty.`);
    steps.push("Challenge yourself with timed practice.");
  }

  if (attempts < 3) {
    steps.push("Complete more sessions for a more accurate performance picture.");
  }

  return steps;
}
