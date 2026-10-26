import { useEffect, useState } from "react";
import type {
  CreateWorkoutPlanInput,
  Exercise,
  WorkoutPlan,
  WorkoutSessionDetail,
  WorkoutSessionSummary,
} from "@gymos/shared";
import { ApiError } from "../../api/client.ts";
import {
  createPlan,
  getActiveSession,
  listExercises,
  listPlans,
  listSessions,
  startSession,
} from "../../api/gym.ts";
import { PlanForm } from "./PlanForm.tsx";

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

export function GymView() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSessionDetail | null>(
    null
  );
  const [history, setHistory] = useState<WorkoutSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [pending, setPending] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const [exerciseList, planList, active, sessions] = await Promise.all([
        listExercises(),
        listPlans(),
        getActiveSession(),
        listSessions(10),
      ]);
      setExercises(exerciseList);
      setPlans(planList);
      setActiveSession(active);
      setHistory(sessions);
    } catch (loadError) {
      setError(messageOf(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function start(input: { planId?: string }) {
    setPending(true);
    setError(null);

    try {
      setActiveSession(await startSession(input));
    } catch (startError) {
      if (startError instanceof ApiError && startError.status === 409) {
        try {
          setActiveSession(await getActiveSession());
        } catch (refreshError) {
          setError(messageOf(refreshError));
        }
      } else {
        setError(messageOf(startError));
      }
    } finally {
      setPending(false);
    }
  }

  async function handleCreatePlan(input: CreateWorkoutPlanInput) {
    const created = await createPlan(input);
    setPlans((current) => [created, ...current]);
    setShowPlanForm(false);
  }

  if (loading) {
    return <p className="muted">Loading gym data…</p>;
  }

  if (error && plans.length === 0 && exercises.length === 0) {
    return (
      <div className="card stack">
        <p className="error">{error}</p>
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (activeSession) {
    return (
      <section className="card stack">
        <p className="muted">Workout in progress</p>
        <h2 className="card-title">{activeSession.title}</h2>
      </section>
    );
  }

  return (
    <div className="stack">
      {error && <p className="error">{error}</p>}

      <section className="card stack">
        <h2 className="card-title">Today&apos;s workout</h2>
        <p className="muted">Start a session and log sets as you go.</p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending}
          onClick={() => void start({})}
        >
          Start free workout
        </button>
      </section>

      <section className="stack">
        <h2 className="card-title">Training plans</h2>
        {plans.length === 0 ? (
          <p className="empty">No plans yet</p>
        ) : (
          plans.map((plan) => (
            <article key={plan.id} className="card plan-card stack">
              <div>
                <h3 className="card-title">{plan.name}</h3>
                {plan.description && <p className="muted">{plan.description}</p>}
              </div>
              <div className="row">
                <span className="badge">
                  {plan.exercises.length}{" "}
                  {plan.exercises.length === 1 ? "exercise" : "exercises"}
                </span>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={pending}
                  onClick={() => void start({ planId: plan.id })}
                >
                  Start plan
                </button>
              </div>
            </article>
          ))
        )}

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setShowPlanForm((visible) => !visible)}
        >
          {showPlanForm ? "Cancel" : "Create plan"}
        </button>

        {showPlanForm && (
          <PlanForm exercises={exercises} onSubmit={handleCreatePlan} />
        )}
      </section>

      <section className="stack">
        <h2 className="card-title">Recent workouts</h2>
        {history.length === 0 ? (
          <p className="empty">No completed workouts yet</p>
        ) : (
          history.map((session) => (
            <article key={session.id} className="card">
              <h3 className="card-title">{session.title}</h3>
              <div className="row">
                <span className="muted">
                  {new Date(session.startedAt).toLocaleDateString()}
                </span>
                <span className="badge">
                  {session.totalSets} {session.totalSets === 1 ? "set" : "sets"}
                </span>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

export default GymView;
