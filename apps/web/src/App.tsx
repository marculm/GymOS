import React, { useState } from "react";
import { Dumbbell, Utensils, Sparkles } from "lucide-react";

export function App() {
  const [activeTab, setActiveTab] = useState<"gym" | "nutrition" | "extractor">("gym");

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 16 }}>
      <header style={{ marginBottom: 24, textAlign: "center" }}>
        <h1 style={{ fontSize: "1.8rem", margin: "8px 0" }}>🏋️ GymOS</h1>
        <p style={{ color: "#94a3b8", margin: 0 }}>All-in-one Gym & Nutrition OS</p>
      </header>

      <nav style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => setActiveTab("gym")}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: activeTab === "gym" ? "#3b82f6" : "#1e293b",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Dumbbell size={18} />
          Gym
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("nutrition")}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: activeTab === "nutrition" ? "#3b82f6" : "#1e293b",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Utensils size={18} />
          Nutrition
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("extractor")}
          style={{
            flex: 1,
            padding: 12,
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
            background: activeTab === "extractor" ? "#3b82f6" : "#1e293b",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Sparkles size={18} />
          AI Extractor
        </button>
      </nav>

      <main style={{ background: "#1e293b", padding: 20, borderRadius: 12 }}>
        {activeTab === "gym" && (
          <div>
            <h2 style={{ marginTop: 0 }}>Workout Tracker</h2>
            <p style={{ color: "#cbd5e1" }}>Track sets, reps, weight, and RPE.</p>
          </div>
        )}
        {activeTab === "nutrition" && (
          <div>
            <h2 style={{ marginTop: 0 }}>Nutrition & Mealprep</h2>
            <p style={{ color: "#cbd5e1" }}>Calculate macros, plan meals, and log recipes.</p>
          </div>
        )}
        {activeTab === "extractor" && (
          <div>
            <h2 style={{ marginTop: 0 }}>TikTok / Reels AI Extractor</h2>
            <p style={{ color: "#cbd5e1" }}>Import recipes and ingredients directly from video URLs.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
