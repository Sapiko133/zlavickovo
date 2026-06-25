import SearchBar from "@/components/SearchBar";

export default function Home() {
  return (
    <main>
      <nav style={{
        background: "#E8001D",
        padding: "0 24px",
        height: 60,
        display: "flex",
        alignItems: "center",
      }}>
        <span style={{ color: "#fff", fontWeight: 900, fontSize: 20 }}>
          ✂️ KupónyZľavy.sk
        </span>
      </nav>

      <div style={{
        background: "linear-gradient(135deg, #1a1a2e, #16213e)",
        padding: "60px 24px",
        textAlign: "center",
      }}>
        <h1 style={{ color: "#fff", fontSize: 32, fontWeight: 900, margin: "0 0 12px" }}>
          Nájdi zľavový kód pre každý obchod
        </h1>
        <p style={{ color: "#aaa", fontSize: 16, margin: "0 0 32px" }}>
          Overené kupóny z Dognet + AI vyhľadávanie
        </p>
        <SearchBar />
      </div>
    </main>
  );
}