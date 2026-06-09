"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  collection,
  query,
  getDocs,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { waitForAuthReady } from "@/lib/auth";

interface Customer {
  userId: string;
  name: string;
  totalVisits: number;
  totalPoints: number;
  lastVisit: Timestamp | null;
}

function timeAgo(ts: Timestamp | null): string {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (diff < 86400) return "hoy";
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)}d`;
  if (diff < 2592000) return `hace ${Math.floor(diff / 604800)}sem`;
  return `hace ${Math.floor(diff / 2592000)}mes`;
}

export default function ClientesPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const u = await waitForAuthReady();
      if (!u || u.isAnonymous) { router.push("/activar"); return; }

      const db = getFirebaseDb();
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const rid = userSnap.data()?.ownedRestaurantId as string | undefined;
      if (!rid) { router.push("/activar"); return; }

      const visitsSnap = await getDocs(
        query(collection(db, "restaurants", rid, "visitHistory"), orderBy("timestamp", "desc"))
      );

      // Group by userId
      const map: Record<string, { visits: number; points: number; lastVisit: Timestamp | null }> = {};
      visitsSnap.forEach((d) => {
        const uid = d.data().userId as string;
        const pts = (d.data().pointsAwarded as number) ?? 0;
        const ts = (d.data().timestamp as Timestamp) ?? null;
        if (!map[uid]) map[uid] = { visits: 0, points: 0, lastVisit: ts };
        map[uid].visits++;
        map[uid].points += pts;
        if (ts && (!map[uid].lastVisit || ts.toMillis() > map[uid].lastVisit!.toMillis())) {
          map[uid].lastVisit = ts;
        }
      });

      // Resolve names
      const uids = Object.keys(map);
      const userDocs = await Promise.all(uids.map((uid) => getDoc(doc(db, "users", uid)).catch(() => null)));
      const result: Customer[] = uids.map((uid, i) => {
        const uData = userDocs[i]?.data();
        const displayName = uData?.displayName as string | undefined;
        const email = uData?.email as string | undefined;
        const name = displayName?.trim().split(" ")[0] ?? email?.split("@")[0] ?? `#${uid.slice(-4).toUpperCase()}`;
        return { userId: uid, name, totalVisits: map[uid].visits, totalPoints: map[uid].points, lastVisit: map[uid].lastVisit };
      });

      result.sort((a, b) => b.totalVisits - a.totalVisits);
      setCustomers(result);
      setLoading(false);
    }
    init().catch(() => setLoading(false));
  }, [router]);

  return (
    <div className="min-h-screen" style={{ background: "#F5F3EF" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4"
        style={{ background: "#ffffff", borderBottom: "1px solid rgba(28,37,38,0.07)" }}>
        <Link href="/vendor" className="text-[13px] font-medium" style={{ color: "rgba(28,37,38,0.45)" }}>
          ← Panel
        </Link>
        <span style={{ color: "rgba(28,37,38,0.2)" }}>/</span>
        <h1 className="text-[15px] font-bold" style={{ color: "#1C2526" }}>Clientes</h1>
        {!loading && (
          <span className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{ background: "#F5F3EF", color: "rgba(28,37,38,0.5)" }}>
            {customers.length} clientes
          </span>
        )}
      </div>

      <main className="px-4 py-6 md:px-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <svg className="h-5 w-5 animate-spin" style={{ color: "#d97757" }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 5.373 12 12H4z" />
            </svg>
          </div>
        ) : customers.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <span className="text-[40px]">👥</span>
            <p className="mt-4 text-[15px] font-semibold" style={{ color: "rgba(28,37,38,0.45)" }}>
              Sin clientes aún
            </p>
            <p className="mt-1 text-[13px]" style={{ color: "rgba(28,37,38,0.3)" }}>
              Escanea tu primer cliente para verlos aquí.
            </p>
            <Link href="/vendor/scanner"
              className="mt-5 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white"
              style={{ background: "#d97757" }}>
              Ir al escáner
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden"
            style={{ background: "#ffffff", border: "1px solid rgba(28,37,38,0.07)", boxShadow: "0 1px 4px rgba(28,37,38,0.05)" }}>
            {/* Table header */}
            <div className="grid grid-cols-[1fr_60px_80px_80px] gap-3 px-5 py-3"
              style={{ borderBottom: "1px solid rgba(28,37,38,0.07)", background: "#FAFAF8" }}>
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.35)" }}>
                Cliente
              </span>
              <span className="text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.35)" }}>
                Visitas
              </span>
              <span className="text-center text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.35)" }}>
                Puntos
              </span>
              <span className="text-right text-[10px] font-bold uppercase tracking-widest" style={{ color: "rgba(28,37,38,0.35)" }}>
                Última
              </span>
            </div>
            {customers.map((c, i) => (
              <div key={c.userId}
                className="grid grid-cols-[1fr_60px_80px_80px] items-center gap-3 px-5 py-3.5"
                style={{ borderBottom: i < customers.length - 1 ? "1px solid rgba(28,37,38,0.05)" : "none" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ background: "rgba(242,140,56,0.12)", color: "#d97757" }}>
                    {(c.name[0] ?? "C").toUpperCase()}
                  </div>
                  <p className="truncate text-[13px] font-semibold" style={{ color: "#1C2526" }}>
                    {c.name}
                  </p>
                  {c.totalVisits >= 5 && (
                    <span className="shrink-0 text-[11px]" title="Cliente frecuente">⭐</span>
                  )}
                </div>
                <p className="text-center font-mono text-[14px] font-bold" style={{ color: "#1C2526" }}>
                  {c.totalVisits}
                </p>
                <p className="text-center font-mono text-[13px] font-semibold" style={{ color: "#d97757" }}>
                  {c.totalPoints}
                </p>
                <p className="text-right text-[11px]" style={{ color: "rgba(28,37,38,0.38)" }}>
                  {timeAgo(c.lastVisit)}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
