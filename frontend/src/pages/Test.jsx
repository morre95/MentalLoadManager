import Navbar from "../components/landing/Navbar";
import { useEffect, useState } from "react";
import { GET_API_BASE_URL } from "../components/ui/base_url";

import {
  getToken,
  setToken,
  clearToken,
  readTokenFromHashAndCleanUrl,
} from "../lib/auth";

const API_BASE_URL = GET_API_BASE_URL();

function Test() {
  const [message, setMessage] = useState("Click to test /api/hello");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [token, setTokenState] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  const fetchData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/hello`);
      const data = await response.json();
      setMessage(data.message);
    } catch (error) {
      setMessage("Failed to fetch /api/hello");
      console.error(error);
    }
  };

  useEffect(() => {
    const hashToken = readTokenFromHashAndCleanUrl();
    if (hashToken) {
      setToken(hashToken);
      setTokenState(hashToken);
      return;
    }

    const stored = getToken();
    if (stored) setTokenState(stored);
  }, []);

  const performPasswordLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    setCurrentUser(null);

    try {
      const body = new URLSearchParams();
      body.set("grant_type", "password");
      body.set("username", username);
      body.set("password", password);

      const res = await fetch(`${API_BASE_URL}/api/password/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Login failed (${res.status})`);
      }

      const data = await res.json();
      setToken(data.access_token);
      setTokenState(data.access_token);
      return data.access_token;
    } catch (err) {
      setAuthError(err.message || "Login failed");
      return null;
    } finally {
      setAuthLoading(false);
    }
  };

  const login = async (e) => {
    e.preventDefault();
    await performPasswordLogin();
  };

  const fetchMe = async (overrideToken) => {
    const t = overrideToken || token || getToken();
    if (!t) {
      setAuthError("No token available. Login first.");
      return;
    }

    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${t}` },
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

  const runLoginAndFetchMe = async () => {
    const newToken = await performPasswordLogin();
    if (newToken) {
      await fetchMe(newToken);
    }
  };

  const fillTestCredentials = () => {
    setUsername("anna_svensson");
    setPassword("password123");
  };

  const logout = () => {
    clearToken();
    localStorage.removeItem("username");
    localStorage.removeItem("email");
    setTokenState(null);
    setCurrentUser(null);
    setAuthError(null);
  };

  const loginWithProvider = (provider) => {
    window.location.href = `${API_BASE_URL}/api/auth/${provider}/login`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <section className="rounded-xl border border-blue-200 bg-blue-50 p-6">
            <h1 className="text-2xl font-bold text-blue-900">Login API Tester</h1>
            <p className="mt-2 text-sm text-blue-900">
              Use this page to test auth endpoints directly against <code>{API_BASE_URL}</code>.
            </p>
            <div className="mt-4 grid gap-2 text-sm text-blue-900">
              <div><strong>1.</strong> Fill credentials and run password login</div>
              <div><strong>2.</strong> Test <code>/api/users/me</code> with the returned token</div>
              <div><strong>3.</strong> Try OAuth provider redirects if needed</div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">Quick Test Actions</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <button
                className="rounded bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-800"
                onClick={fillTestCredentials}
                type="button"
              >
                Fill test credentials
              </button>
              <button
                className="rounded bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                onClick={performPasswordLogin}
                disabled={authLoading || !username || !password}
                type="button"
              >
                {authLoading ? "Testing login..." : "Test password login"}
              </button>
              <button
                className="rounded bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
                onClick={runLoginAndFetchMe}
                disabled={authLoading || !username || !password}
                type="button"
              >
                Test login + /users/me
              </button>
              <button
                className="rounded bg-gray-300 px-4 py-2 font-semibold text-black hover:bg-gray-400"
                onClick={logout}
                disabled={!token}
                type="button"
              >
                Clear token (logout)
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">Password Login Form</h2>
            <form className="flex flex-col gap-3" onSubmit={login}>
              <input
                className="rounded border px-3 py-2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
              />
              <input
                className="rounded border px-3 py-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
              <button
                className="rounded bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                disabled={authLoading}
                type="submit"
              >
                {authLoading ? "Logging in..." : "Submit password login"}
              </button>
            </form>
          </section>

          <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-lg font-bold">Current Test State</h2>
            <div className="space-y-1 text-sm text-slate-700">
              <div>Token: {token ? `${token.slice(0, 18)}...` : "none"}</div>
              <div>User: {currentUser ? currentUser.username : "not loaded"}</div>
              {authError && <div className="font-semibold text-red-600">Error: {authError}</div>}
            </div>
          </section>


          <section className="rounded-xl border border-gray-300 bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-bold">OAuth Provider Tests</h2>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <button
                className="rounded bg-red-600 px-4 py-2 font-bold text-white hover:bg-red-700"
                onClick={() => loginWithProvider("google")}
                type="button"
              >
                Test Google OAuth
              </button>
              <button
                className="rounded bg-blue-700 px-4 py-2 font-bold text-white hover:bg-blue-800"
                onClick={() => loginWithProvider("facebook")}
                type="button"
              >
                Test Facebook OAuth
              </button>
              <button
                className="rounded bg-pink-600 px-4 py-2 font-bold text-white hover:bg-pink-700"
                onClick={() => loginWithProvider("instagram")}
                type="button"
              >
                Test Instagram OAuth
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-indigo-300 bg-indigo-50 p-6 shadow-sm">
            <h2 className="font-bold text-indigo-900">API Endpoint Checks</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-full bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
                onClick={fetchData}
                type="button"
              >
                Test /api/hello
              </button>
              <button
                className="rounded bg-slate-700 px-4 py-2 font-bold text-white hover:bg-slate-800 disabled:opacity-60"
                onClick={() => fetchMe()}
                disabled={!token}
                type="button"
              >
                Test /api/users/me
              </button>
            </div>
            <p className="mt-3 text-sm text-indigo-900">/api/hello response: {message}</p>
          </section>

        </div>
      </main>
    </div>
  );
}

export default Test;
