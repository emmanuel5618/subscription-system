"use client";
import { useState } from "react";
export default function ResetPage() {
const [email, setEmail] = useState("");
const [token, setToken] = useState("");
const [password, setPassword] = useState("");
const [message, setMessage] = useState("");
async function requestReset(e: React.FormEvent) {
        e.preventDefault();
setMessage("");
const res = await fetch("/api/system", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
op: "resetRequest",
email
})
});
const data = await res.json();
setMessage(data.error ?? `Reset requested. Dev token: ${data.devToken ?? "hidden"}`);
}
async function confirmReset(e: React.FormEvent) {
e.preventDefault();
setMessage("");
const res = await fetch("/api/system", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
op: "resetConfirm",
token,
password
}) });
const data = await res.json();
setMessage(data.error ?? "Password reset successful");
}
return (
  <main className="container">
    <div className="card">
      <h1>Request password reset</h1>
      <form onSubmit={requestReset}>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit">Request reset</button>
      </form>
    </div>

    <div className="card">
      <h1>Confirm password reset</h1>
      <form onSubmit={confirmReset}>
        <input
          placeholder="Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <input
          placeholder="New password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Reset password</button>
      </form>
      <p>{message}</p>
    </div>
  </main>
);
}