"use client";
import { useState } from "react";
export default function SignupPage() {
const [name, setName] = useState("");
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [message, setMessage] = useState("");
async function submit(e: React.FormEvent) {
e.preventDefault();
setMessage("");
const res = await fetch("/api/system", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
op: "signup",
name,
email,
password
})
});
const data = await res.json();
setMessage(data.error ?? "Signup successful");
}
return (
<main className="container">
<div className="card">
<h1>Customer Signup</h1>
<form onSubmit={submit}>
<input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
<input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
<input
placeholder="Password" type="password"
value={password}
onChange={(e) => setPassword(e.target.value)}
/>
<button type="submit">Sign up</button>
</form>
<p>{message}</p>
</div>
</main>
);
}