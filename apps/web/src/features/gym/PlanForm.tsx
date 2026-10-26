import { useState, type FormEvent } from "react";
import type { CreateWorkoutPlanInput, Exercise } from "@gymos/shared";

type PlanFormProps = {
  exercises: Exercise[];
  onSubmit: (input: CreateWorkoutPlanInput) => Promise<void>;
};

type ExerciseRow = {
  exerciseId: string;
  targetSets: number;
  targetReps: number;
  targetWeightKg: number | "";
};

function createRow(exercises: Exercise[]): ExerciseRow {
  return {
    exerciseId: exercises[0]?.id ?? "",
    targetSets: 3,
    targetReps: 8,
    targetWeightKg: "",
  };
}

export function PlanForm({ exercises, onSubmit }: PlanFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<ExerciseRow[]>(() => [createRow(exercises)]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (exercises.length === 0) {
    return <p className="empty">No exercises available. Run the seed.</p>;
  }

  function updateRow(index: number, patch: Partial<ExerciseRow>) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row))
    );
  }

  function addRow() {
    setRows((current) => [...current, createRow(exercises)]);
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        exercises: rows.map((row) => ({
          exerciseId: row.exerciseId,
          targetSets: row.targetSets,
          targetReps: row.targetReps,
          targetWeightKg: row.targetWeightKg === "" ? undefined : row.targetWeightKg,
        })),
      });
      setName("");
      setDescription("");
      setRows([createRow(exercises)]);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not create the plan"
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="card stack" onSubmit={handleSubmit}>
      <h3 className="card-title">New training plan</h3>

      <label className="field">
        <span className="label">Name</span>
        <input
          className="input"
          required
          maxLength={100}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="label">Description (optional)</span>
        <input
          className="input"
          maxLength={500}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>

      <div className="stack">
        {rows.map((row, index) => (
          <div key={index} className="plan-exercise stack">
            <div className="row">
              <label className="field grow">
                <span className="label">Exercise</span>
                <select
                  className="input"
                  required
                  value={row.exerciseId}
                  onChange={(event) =>
                    updateRow(index, { exerciseId: event.target.value })
                  }
                >
                  {exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={rows.length === 1}
                onClick={() => removeRow(index)}
              >
                Remove
              </button>
            </div>

            <div className="row">
              <label className="field grow">
                <span className="label">Sets</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={row.targetSets}
                  onChange={(event) =>
                    updateRow(index, { targetSets: Number(event.target.value) })
                  }
                />
              </label>
              <label className="field grow">
                <span className="label">Reps</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={row.targetReps}
                  onChange={(event) =>
                    updateRow(index, { targetReps: Number(event.target.value) })
                  }
                />
              </label>
              <label className="field grow">
                <span className="label">Weight (kg, optional)</span>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={0.5}
                  value={row.targetWeightKg}
                  onChange={(event) =>
                    updateRow(index, {
                      targetWeightKg:
                        event.target.value === "" ? "" : Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="row">
        <button type="button" className="btn btn-ghost" onClick={addRow}>
          Add exercise
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={pending || name.trim().length === 0 || rows.length === 0}
        >
          Save plan
        </button>
      </div>
    </form>
  );
}

export default PlanForm;
