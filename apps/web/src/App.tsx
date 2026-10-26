import { useState } from "react";
import { Dumbbell, Sparkles, Utensils, type LucideIcon } from "lucide-react";

type Tab = "gym" | "nutrition" | "extractor";

const TABS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: "gym", label: "Gym", icon: Dumbbell },
  { id: "nutrition", label: "Nutrition", icon: Utensils },
  { id: "extractor", label: "AI Extractor", icon: Sparkles },
];

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("gym");

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏋️ GymOS</h1>
        <p className="muted">All-in-one Gym & Nutrition OS</p>
      </header>

      <main className="content">
        {activeTab === "gym" && (
          <section className="card">
            <h2 className="card-title">Workout Tracker</h2>
            <p className="muted">Track sets, reps, weight, and RPE.</p>
          </section>
        )}
        {activeTab === "nutrition" && (
          <section className="card">
            <h2 className="card-title">Nutrition & Mealprep</h2>
            <p className="muted">Calculate macros, plan meals, and log recipes.</p>
          </section>
        )}
        {activeTab === "extractor" && (
          <section className="card">
            <h2 className="card-title">TikTok / Reels AI Extractor</h2>
            <p className="muted">Import recipes and ingredients directly from video URLs.</p>
          </section>
        )}
      </main>

      <nav className="tab-bar" aria-label="Main navigation">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            className={activeTab === id ? "tab tab-active" : "tab"}
            aria-pressed={activeTab === id}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={20} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
