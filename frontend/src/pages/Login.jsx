// src/pages/Login.jsx
import { useEffect, useState } from "react";
import { motion as Motion } from "framer-motion";
import { ArrowLeft, Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Link, useNavigate } from "react-router-dom";

import { GET_API_BASE_URL } from "@/components/ui/base_url";
import { setAuthToken } from "@/lib/auth";
import { fetchMe } from "@/lib/utils";

const API_BASE_URL = GET_API_BASE_URL();

const Login = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  const navigate = useNavigate();

  // 1) Handle OAuth hash token or existing token
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      const params = new URLSearchParams(hash);
      const hashToken = params.get("access_token");
      const hashRefreshToken = params.get("refresh_token");
      if (hashToken) {
        setAuthToken(hashToken, hashRefreshToken || null);
        window.dispatchEvent(new Event("auth:changed"));

        // Clean URL
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );

        (async () => {
          await fetchMe();

          const pending = localStorage.getItem("pending_invite_code");
          if (pending) {
            navigate(`/join?code=${encodeURIComponent(pending)}`, { replace: true });
            return;
          }

          navigate("/dashboard", { replace: true });
        })();

        return;
      }
    }
  }, [navigate]);

  const finishLogin = async (accessToken, refreshToken = null) => {
    setAuthToken(accessToken, refreshToken);
    window.dispatchEvent(new Event("auth:changed"));

    await fetchMe();

    const pending = localStorage.getItem("pending_invite_code");
    if (pending) {
      navigate(`/join?code=${encodeURIComponent(pending)}`, { replace: true });
      return;
    }

    navigate("/dashboard", { replace: true });
  };

  const login = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match.");
        }

        const registerRes = await fetch(`${API_BASE_URL}/api/users/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: identifier,
            password,
            email: email || null,
            display_name: name || null,
          }),
        });

        if (!registerRes.ok) {
          const err = await registerRes.json().catch(() => ({}));
          throw new Error(err.detail || `Registration failed (${registerRes.status})`);
        }
      }

      const body = new URLSearchParams();
      body.set("grant_type", "password");
      body.set("username", identifier);
      body.set("password", password);

      const loginRes = await fetch(`${API_BASE_URL}/api/password/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!loginRes.ok) {
        const err = await loginRes.json().catch(() => ({}));
        throw new Error(err.detail || `Login failed (${loginRes.status})`);
      }

      const loginData = await loginRes.json();
      await finishLogin(loginData.access_token, loginData.refresh_token || null);
    } catch (err) {
      setAuthError(err?.message || (isSignUp ? "Registration failed" : "Login failed"));
    } finally {
      setAuthLoading(false);
    }
  };

  const loginWithProvider = (provider) => {
    window.location.href = `${API_BASE_URL}/api/auth/${provider}/login`;
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative items-center justify-center p-12">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Motion.div
            className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-sage/10 blur-3xl"
            animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 8, repeat: Infinity }}
          />
          <Motion.div
            className="absolute -bottom-40 -left-20 w-96 h-96 rounded-full bg-terracotta/10 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 10, repeat: Infinity, delay: 1 }}
          />
        </div>
        <div className="relative z-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl font-bold text-primary-foreground">M</span>
          </div>
          <h2 className="font-display text-3xl font-bold text-foreground mb-4">
            Mental Load Manager
          </h2>
          <p className="text-muted-foreground max-w-sm">
            Share the invisible work of your household. Track, visualize, and balance responsibilities together.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="text-muted-foreground mb-8">
            {isSignUp ? "Start managing your household load" : "Sign in to your account"}
          </p>

          {/* Social login buttons */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              type="button"
              variant="outline"
              className="gap-2 h-11"
              onClick={() => loginWithProvider("google")}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </Button>

            <Button
              type="button"
              variant="outline"
              className="gap-2 h-11"
              onClick={() => loginWithProvider("facebook")}
            >
              Facebook
            </Button>
          </div>

          <div className="relative mb-6">
            <Separator />
            <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
              or continue with username
            </span>
          </div>

          <form onSubmit={login} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10"
                    autoComplete="email"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="identifier">Username</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="kalle_svensson"
                  className="pl-10"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-10"
                    autoComplete="new-password"
                  />
                </div>
              </div>
            )}

            {authError && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {authError}
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={authLoading}>
              {authLoading
                ? isSignUp
                  ? "Creating account..."
                  : "Signing in..."
                : isSignUp
                  ? "Create Account"
                  : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary font-medium hover:underline"
            >
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </p>
        </Motion.div>
      </div>
    </div>
  );
};

export default Login;
