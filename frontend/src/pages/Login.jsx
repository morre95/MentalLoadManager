import Navbar from "../components/landing/Navbar";


import { useEffect, useState } from 'react';
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function Login() {
  const [message, setMessage] = useState("Click to Load...");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hello`);
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage("Failed to fetch data from FastAPI.");
      console.error(error);
    }
  };

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      const params = new URLSearchParams(hash);
      const hashToken = params.get("access_token");
      if (hashToken) {
        localStorage.setItem("auth_token", hashToken);
        localStorage.setItem("token", hashToken);
        setToken(hashToken);
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        return;
      }
    }

    const stored = localStorage.getItem("auth_token") || localStorage.getItem("token");
    if (stored) {
      localStorage.setItem("auth_token", stored);
      localStorage.setItem("token", stored);
      setToken(stored);
    }
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    setCurrentUser(null);
    try {
      const body = new URLSearchParams();
      body.set("grant_type", "password");
      body.set("username", username);
      body.set("password", password);

      const res = await fetch(`${API_BASE_URL}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Login failed (${res.status})`);
      }

      const data = await res.json();
      localStorage.setItem("auth_token", data.access_token);
      localStorage.setItem("token", data.access_token);
      setToken(data.access_token);
    } catch (err) {
      setAuthError(err.message || "Login failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchMe = async () => {
    if (!token) return;
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to fetch user");
      }
      const data = await res.json();
      setCurrentUser(data);
    } catch (err) {
      setAuthError(err.message || "Failed to fetch user");
    }
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("token");
    setToken(null);
    setCurrentUser(null);
  };

  const loginWithProvider = (provider) => {
    window.location.href = `${API_BASE_URL}/api/auth/${provider}/login`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>

        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
          {/* Test Card */}
          <div className="max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden md:max-w-2xl border border-gray-100 transition-transform hover:scale-105 duration-300">
            <div className="md:flex">
              <div className="p-8">
                <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">
                  Tailwind CSS Test
                </div>
                <h1 className="block mt-1 text-3xl leading-tight font-bold text-black">
                  Is it working? 🚀
                </h1>
                <p className="mt-2 text-slate-500">
                  If you see a rounded white card with a soft shadow, a purple "Tailwind CSS Test" label, and a blue button below,
                  <strong> then Tailwind is installed correctly.</strong>
                </p>

                <button className="mt-6 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
                  Confirm Connection
                </button>
              </div>
            </div>
          </div>

          {/* Grid Test */}
          <div className="mt-10 grid grid-cols-3 gap-4">
            <div className="h-12 w-12 bg-red-400 rounded-full animate-bounce"></div>
            <div className="h-12 w-12 bg-green-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="h-12 w-12 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          </div>

          <div className="border-2 border-indigo-600 m-5 p-5">
            <h2 className="font-bold">FastAPI + React = ❤️</h2>
            <p>{message}</p>
            <button
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full"
              onClick={fetchData}
            >
              Load from API...
            </button>
          </div>

          <div className="border-2 border-gray-300 m-5 p-5 w-full max-w-md bg-white rounded-lg shadow">
            <h2 className="font-bold mb-3">Login (JWT)</h2>
            <form className="flex flex-col gap-3" onSubmit={login}>
              <input
                className="border rounded px-3 py-2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
              />
              <input
                className="border rounded px-3 py-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
              <button
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded"
                disabled={authLoading}
                type="submit"
              >
                {authLoading ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="mt-4 grid grid-cols-1 gap-2">
              <button
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                onClick={() => loginWithProvider("google")}
                type="button"
              >
                Continue with Google
              </button>
              <button
                className="bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded"
                onClick={() => loginWithProvider("facebook")}
                type="button"
              >
                Continue with Facebook
              </button>
              <button
                className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded"
                onClick={() => loginWithProvider("instagram")}
                type="button"
              >
                Continue with Instagram
              </button>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2 px-4 rounded"
                onClick={fetchMe}
                disabled={!token}
              >
                Fetch /users/me
              </button>
              <button
                className="bg-gray-300 hover:bg-gray-400 text-black font-bold py-2 px-4 rounded"
                onClick={logout}
                disabled={!token}
              >
                Logout
              </button>
            </div>

            <div className="mt-4 text-sm text-slate-700">
              <div>Token: {token ? `${token.slice(0, 18)}...` : "none"}</div>
              <div>User: {currentUser ? currentUser.username : "not loaded"}</div>
              {authError && <div className="text-red-600">Error: {authError}</div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Login
