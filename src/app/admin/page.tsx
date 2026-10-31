"use client";
import { useEffect, useState } from "react";
async function rpc(op: string, payload: Record<string, unknown> = {}) {
const res = await fetch("/api/system", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ op, ...payload })
});
return res.json();
}
export default function AdminPage() {
const [modules, setModules] = useState<string[]>([]);
const [module, setModule] = useState("customers");
const [items, setItems] = useState<any[]>([]);
const [json, setJson] = useState("{}");
const [selectedId, setSelectedId] = useState("");
const [message, setMessage] = useState("");
useEffect(() => {
rpc("meta").then((data) => setModules(data.modules ?? []));
}, []);
async function loadList() {
const data = await rpc("list", { module, page: 1, pageSize: 20 });
setItems(data.items ?? []);
setMessage(data.error ?? "");
}
async function createItem() {
const data = await rpc("create", {
module,
data: JSON.parse(json)
});
setMessage(data.error ?? "Created");
await loadList(); }
async function updateItem() {
const data = await rpc("update", {
module,
id: selectedId,
data: JSON.parse(json)
});
setMessage(data.error ?? "Updated");
await loadList();
}
async function deleteItem() {
const data = await rpc("delete", {
module,
id: selectedId
});
setMessage(data.error ?? "Deleted");
await loadList();
}
return (
<main className="container">
<div className="card">
<h1>Admin</h1>
<select value={module} onChange={(e) => setModule(e.target.value)}>
{modules.map((m) => (
<option key={m} value={m}>
{m}
</option>
))}
</select>
<button onClick={loadList}>Load</button>
</div>
<div className="card">
<h2>Create / Update JSON</h2>
<textarea rows={10} value={json} onChange={(e) => setJson(e.target.value)} />
<button onClick={createItem}>Create</button>
<input
placeholder="Record ID for update/delete" value={selectedId}
onChange={(e) => setSelectedId(e.target.value)}
/>
<button onClick={updateItem}>Update</button>
<button onClick={deleteItem}>Delete</button>
<p>{message}</p>
</div>
<div className="card">
<h2>Records</h2>
<pre>{JSON.stringify(items, null, 2)}</pre>
</div>
</main>
);
}