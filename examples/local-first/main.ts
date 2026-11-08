// Local-first with barrel-lite: two clients keep a local copy of
// one database, edit offline, sync, and resolve a conflict.
import { Database, MemoryAdapter, SyncError } from "barrel-lite";

const URL = process.env.BARREL_URL ?? "http://localhost:8080";
const DB = "lf_groceries";

// A fetch we can switch off to simulate a lost connection.
let online = true;
const phoneFetch = (input: string, init?: RequestInit) =>
  online ? fetch(input, init) : Promise.reject(new TypeError("offline"));

// Start from an empty database on the server (REST).
await fetch(`${URL}/db/${DB}?purge=true`, { method: "DELETE" });
await fetch(`${URL}/db/${DB}`, { method: "PUT" });

// In Node the local store is in memory; in a browser it is OPFS.
const phone = await Database.open(DB, {
  remote: { url: URL, db: DB, fetch: phoneFetch },
  storage: new MemoryAdapter(),
});
const laptop = await Database.open(DB, {
  remote: { url: URL, db: DB },
  storage: new MemoryAdapter(),
});

// 1. Local writes and reads need no server.
await phone.put({ id: "list", title: "Groceries", items: ["milk"] });
const local = await phone.get("list");
console.log("phone local get:", local?.["items"]);

// 2. Sync: push the phone's copy, pull it on the laptop.
const first = await phone.sync();
console.log("phone sync: pushed", first.push.pushed);
const pulled = await laptop.pull();
console.log("laptop pull: applied", pulled.applied);
console.log("laptop get:", (await laptop.get("list"))?.["items"]);

// 3. The phone goes offline and keeps working.
online = false;
await phone.put({ id: "list", title: "Groceries",
                  items: ["milk", "eggs"] });
await phone.put({ id: "note", text: "store closes at 20:00" });
try {
  await phone.sync();
} catch (e) {
  if (!(e instanceof SyncError)) throw e;
  console.log("phone sync while offline:", e.code);
}
console.log("phone local docs:",
  (await phone.allDocs()).map((d) => d.id).sort());

// Meanwhile the laptop edits the same document and syncs.
await laptop.put({ id: "list", title: "Groceries",
                   items: ["milk", "bread"] });
await laptop.push();

// 4. Back online: the phone's edits go up, the laptop's come down.
online = true;
const back = await phone.sync();
console.log("phone sync back online: pushed", back.push.pushed,
            "applied", back.pull.applied);
const winner = await phone.get("list");
const others = await phone.conflicts("list");
console.log("phone list:", winner?.["items"]);
console.log("phone conflicts:", others.map((c) => c.body?.["items"]));

// 5. Resolve once: merge both edits, push the resolution.
const items = new Set<string>();
for (const body of [winner, ...others.map((c) => c.body)]) {
  for (const i of (body?.["items"] as string[] | undefined) ?? []) {
    items.add(i);
  }
}
await phone.resolve("list", { title: "Groceries",
                              items: [...items].sort() });
await phone.push();
await laptop.pull();
console.log("laptop list:", (await laptop.get("list"))?.["items"]);
console.log("laptop conflicts:", (await laptop.conflicts("list")).length);

// 6. Local BQL over the synced copy, and the server's view.
const rows = await laptop.query(
  "SELECT id, text FROM c WHERE text IS NOT NULL");
console.log("laptop query:", rows);
const res = await fetch(`${URL}/db/${DB}/doc/list`);
const server = (await res.json()) as { items: string[] };
console.log("server list:", server.items);

await phone.close();
await laptop.close();
