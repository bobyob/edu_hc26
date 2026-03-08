import { useNavigate } from "react-router-dom";

// Emoji icons to replace the placeholder Figma icons
const icons = {
  book: "📖",
  users: "🤝",
  chart: "📊",
};

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* ── Navbar ── */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎓</span>
          <span className="font-bold text-gray-900 text-lg tracking-tight">
            MyFocusFriend
          </span>
        </div>
        <button
          onClick={() => navigate("/login")}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2 rounded-md transition-colors duration-150"
        >
          Log In
        </button>
      </nav>

      {/* ── Hero Section ── */}
      <section className="bg-gradient-to-b from-blue-50 to-white px-8 py-20 text-center">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight max-w-3xl mx-auto">
          With a Focus Friend, you'll never have to study alone again!
        </h1>
        <p className="mt-6 text-gray-500 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          MyFocusFriend analyzes your emotions while you're studying and completing our quizzes.
          In turn, you'll get personalized feedback and have your companion robot 'Pebble' emote to cheer you up!
        </p>
        <button
          onClick={() => navigate("/dashboard")}
          className="mt-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-md text-base transition-colors duration-150 shadow-md"
        >
          Get Started
        </button>
      </section>

      {/* ── How It Works ── */}
      <section className="px-8 py-20 bg-white">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-14">
          How It Works
        </h2>
        <div className="flex flex-col md:flex-row justify-center items-start gap-12 max-w-4xl mx-auto">
          {[
            {
              icon: icons.book,
              step: "Step 1",
              desc: "Create an account by signing up to save your information",
            },
            {
              icon: icons.users,
              step: "Step 2",
              desc: "Pair your Focus Friend 'Pebble' and your devices' camera to analyse your expressions",
            },
            {
              icon: icons.chart,
              step: "Step 3",
              desc: "View and track your progress and get summaries after your sessions",
            },
          ].map(({ icon, step, desc }) => (
            <div key={step} className="flex flex-col items-center text-center flex-1">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center text-2xl mb-4 shadow-sm">
                {icon}
              </div>
              <p className="font-semibold text-gray-800 mb-2">{step}</p>
              <p className="text-gray-500 text-sm leading-relaxed max-w-[200px]">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What Is This Service ── */}
      <section className="px-8 py-20 bg-gray-50">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-10">
          What Is This Service?
        </h2>
        <div className="max-w-2xl mx-auto bg-white rounded-xl border border-gray-200 p-8 shadow-sm">
          <p className="text-gray-600 leading-relaxed mb-4">
            MyFocusFriend is an AI-powered study companion designed for
            high school and university students who struggle with focus,
            motivation, and knowing how to study effectively.
          </p>
          <p className="text-gray-600 leading-relaxed mb-4">
            Using your device's camera, our system analyses your facial
            expressions in real-time. If you're frustrated or confused,
            questions become easier and your robot companion 'Pebble' reacts
            to encourage you. If you're doing well, questions ramp up to keep
            you challenged.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Parents and tutors can securely access progress summaries to
            understand how sessions are going, identify areas of struggle, and
            get recommendations — all without interrupting the student.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-8 py-8 bg-white border-t border-gray-100 text-center">
        <p className="text-gray-400 text-sm">
          © MyFocusFriend · Built for HackCanada 2026 @ Spur Inovation Campus
        </p>
      </footer>
    </div>
  );
}
