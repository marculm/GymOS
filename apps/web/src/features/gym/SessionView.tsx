import { useState, type FormEvent } from "react";
import type {
  CreateWorkoutSetInput,
  Exercise,
  LoggedSet,
  WorkoutPlan,
  WorkoutSessionDetail,
} from "@gymos/shared";

type SessionViewProps = {
  session: WorkoutSessionDetail;
  plan: WorkoutPlan | null;
  exercises: Exercise[];
  onLogSet: (input: CreateWorkoutSetInput) => Promise<void>;
  onComplete: () => Promise<void>;
};

function SetRow({ set }: { set: LoggedSet }) {
  return (
    <p className="set-row">
      <span className="badge">Set {set.setNumber}</span>
      <span>
        {set.reps} × {set.weightKg} kg
      </span>
      {set.rpe != null && <span className="muted">@ RPE {set.rpe}</span>}
    </p>
  );
}

export function SessionView({
  session,
  plan,
  exercises,
  onLogSet,
  onComplete,
}: SessionViewProps) {
  const completed = session.completedAt !== null;
  const selectableExercises = plan
    ? plan.exercises.map((entry) => ({
        id: entry.exercise.id,
        name: entry.exercise.name,
      }))
    : exercises.map((exercise) => ({ id: exercise.id, name: exercise.name }));

  const [exerciseId, setExerciseId] = useState(
    plan?.exercises[0]?.exercise.id ?? exercises[0]?.id ?? ""
  );
  const [weightKg, setWeightKg] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setsByExercise = new Map<string, LoggedSet[]>();
  for (const set of session.sets) {
    const current = setsByExercise.get(set.exerciseId) ?? [];
    current.push(set);
    setsByExercise.set(set.exerciseId, current);
  }
  for (const sets of setsByExercise.values()) {
    sets.sort((a, b) => a.setNumber - b.setNumber);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      await onLogSet({
        exerciseId,
        weightKg: Number(weightKg),
        reps: Number(reps),
        rpe: rpe === "" ? undefined : Number(rpe),
      });
      setWeightKg("");
      setReps("");
      setRpe("");
    } catch (logError) {
      setError(logError instanceof Error ? logError.message : "Could not log the set");
    } finally {
      setPending(false);
    }
  }

  async function handleComplete() {
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      await onComplete();
    } catch (completeError) {
      setError(
        completeError instanceof Error
          ? completeError.message
          : "Could not finish the workout"
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack">
      <header className="card stack">
        <div>
          <p className="muted">{new Date(session.startedAt).toLocaleString()}</p>
          <h2 className="card-title">{session.title}</h2>
        </div>
        {!completed && (
          <button
            type="button"
            className="btn btn-primary"
            disabled={pending}
            onClick={() => void handleComplete()}
          >
            Finish workout
          </button>
        )}
      </header>

      {plan ? (
        plan.exercises.map((planExercise) => {
          const sets = setsByExercise.get(planExercise.exercise.id) ?? [];
          return (
            <section key={planExercise.id} className="card stack">
              <div>
                <h3 className="card-title">{planExercise.exercise.name}</h3>
                <p className="muted">
                  {planExercise.targetSets} × {planExercise.targetReps}
                  {planExercise.targetWeightKg != null
                    ? ` @ ${planExercise.targetWeightKg} kg`
                    : ""}
                </p>
              </div>
              {sets.length === 0 ? (
                <p className="muted">No sets yet</p>
              ) : (
                sets.map((set) => <SetRow key={set.id} set={set} />)
              )}
            </section>
          );
        })
      ) : setsByExercise.size === 0 ? (
        <p className="empty">No sets logged yet</p>
      ) : (
        exercises
          .filter((exercise) => (setsByExercise.get(exercise.id) ?? []).length > 0)
          .map((exercise) => (
            <section key={exercise.id} className="card stack">
              <h3 className="card-title">{exercise.name}</h3>
              {(setsByExercise.get(exercise.id) ?? []).map((set) => (
                <SetRow key={set.id} set={set} />
              ))}
            </section>
          ))
      )}

      {error && <p className="error">{error}</p>}

      {!completed && (
        <form className="card stack" onSubmit={handleSubmit}>
          <h3 className="card-title">Log a set</h3>

          <label className="field">
            <span className="label">Exercise</span>
            <select
              className="input"
              value={exerciseId}
              onChange={(event) => setExerciseId(event.target.value)}
            >
              {selectableExercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>

          <div className="row">
            <label className="field grow">
              <span className="label">Weight (kg)</span>
              <input
                className="input"
                type="number"
                min={0}
                step={0.5}
                required
                value={weightKg}
                onChange={(event) => setWeightKg(event.target.value)}
              />
            </label>
            <label className="field grow">
              <span className="label">Reps</span>
              <input
                className="input"
                type="number"
                min={1}
                required
                value={reps}
                onChange={(event) => setReps(event.target.value)}
              />
            </label>
            <label className="field grow">
              <span className="label">RPE (optional)</span>
              <input
                className="input"
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={rpe}
                onChange={(event) => setRpe(event.target.value)}
              />
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={pending}>
            Log set
          </button>
        </form>
      )}
    </div>
  );
}

export default SessionView;
