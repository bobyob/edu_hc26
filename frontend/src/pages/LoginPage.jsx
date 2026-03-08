import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🎓</span>
        <span className="font-bold text-gray-900 text-xl tracking-tight">
          MyFocusFriend
        </span>
      </div>

      {/* Card */}
      <div className="bg-white rounded-xl shadow-md border border-gray-200 w-full max-w-sm p-8">
        <p className="text-center text-gray-500 text-sm mb-6">
          Sign in to your account
        </p>

        {/* Email */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            type="email"
            placeholder="your.email@example.com"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Password */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            placeholder="••••••••"
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Remember me + Forgot */}
        <div className="flex items-center justify-between mb-6">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" className="rounded" />
            Remember me
          </label>
          <span className="text-sm text-blue-600 cursor-pointer hover:underline">
            Forgot password?
          </span>
        </div>

        {/* Login button (non-functional) */}
        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md text-sm transition-colors duration-150">
          Log In
        </button>

        {/* Sign up */}
        <p className="text-center text-sm text-gray-500 mt-4">
          Don't have an account?{" "}
          <span className="text-blue-600 font-semibold cursor-pointer hover:underline">
            Sign Up
          </span>
        </p>
      </div>

      {/* Back to home */}
      <button
        onClick={() => navigate("/")}
        className="mt-6 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        ← Back to Home
      </button>
    </div>
  );
}
