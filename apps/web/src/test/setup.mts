import "@testing-library/jest-dom/vitest";

// happy-dom compares steps with a binary float modulo (65 % 0.01 !== 0), so
// valid two-decimal weights report a step mismatch. Browsers use decimal steps.
const stepMismatch = Object.getOwnPropertyDescriptor(
  ValidityState.prototype,
  "stepMismatch"
)?.get;

if (stepMismatch) {
  Object.defineProperty(ValidityState.prototype, "stepMismatch", {
    configurable: true,
    get(this: ValidityState & { element: HTMLInputElement }) {
      const element = this.element;
      const step = element.getAttribute("step");
      const numeric =
        element.localName === "input" &&
        (element.type === "number" || element.type === "range");
      if (!numeric || !step || step === "any" || element.value === "") {
        return stepMismatch.call(this);
      }
      const base = Number(element.getAttribute("min") ?? 0);
      const steps = (Number(element.value) - base) / Number(step);
      return Math.abs(steps - Math.round(steps)) > 1e-9;
    },
  });
}
