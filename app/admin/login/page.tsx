"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [chyba, setChyba] = useState("");
  const [caka, setCaka] = useState(false);

  async function odosli(e: React.FormEvent) {
    e.preventDefault();
    setCaka(true);
    setChyba("");
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ user, password }),
    });
    setCaka(false);
    if (!r.ok) {
      setChyba("Nesprávne meno alebo heslo");
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="prihlasenie">
      <span className="prihlasenie__znacka">Ramen Brno</span>
      <form className="karta karta--uzka" onSubmit={odosli}>
        <h1>Prihlásenie</h1>
        <p className="ticho" style={{ marginBottom: "1.4rem" }}>
          Správa obrazoviek v prevádzke.
        </p>

        <label className="pole">
          <span className="pole__popis">Meno</span>
          <input
            type="text"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>

        <label className="pole">
          <span className="pole__popis">Heslo</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {chyba && <p className="chyba">{chyba}</p>}

        <button className="tl tl--hlavne tl--siroke" disabled={caka}>
          {caka ? "Overujem…" : "Prihlásiť"}
        </button>
      </form>
    </div>
  );
}
