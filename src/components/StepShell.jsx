import { STEP_META } from '../machine/flowMachine';
import Step1Import from '../pages/Step1Import';
import Step2EDA from '../pages/Step2EDA';
import Step3Prompt from '../pages/Step3Prompt';
import Step4Preview from '../pages/Step4Preview';
import Step5Export from '../pages/Step5Export';
import './StepShell.css';

const STEP_COMPONENTS = {
  step1: Step1Import,
  step2: Step2EDA,
  step3: Step3Prompt,
  step4: Step4Preview,
  step5: Step5Export,
};

function resolveStepKey(stateValue) {
  return typeof stateValue === 'object' ? Object.keys(stateValue)[0] : stateValue;
}

export default function StepShell({ state, send }) {
  const stepKey       = resolveStepKey(state.value);
  const meta          = STEP_META[stepKey];
  const StepComponent = STEP_COMPONENTS[stepKey];

  return (
    <div className="shell">

      {/* ── Title bar ──────────────────────────────────── */}
      <div className="shell-titlebar">
        <div className="shell-titlebar__brand">
          <div className="shell-titlebar__logo">BRB</div>
          <span className="shell-titlebar__name">Bank Report Builder</span>
        </div>

        <nav className="shell-titlebar__tabs">
          {Object.entries(STEP_META).map(([key, m]) => {
            const isActive   = key === stepKey;
            const isComplete = m.number < meta.number;
            const isLocked   = m.number > meta.number;
            return (
              <div
                key={key}
                className={
                  'shell-tab' +
                  (isActive   ? ' shell-tab--active'   : '') +
                  (isComplete ? ' shell-tab--complete' : '') +
                  (isLocked   ? ' shell-tab--locked'   : '')
                }
              >
                <span className="shell-tab__num">{isComplete ? '✓' : m.number}</span>
                <span className="shell-tab__label">{m.label}</span>
              </div>
            );
          })}
        </nav>

        <div className="shell-titlebar__right">
          {state.context.error && (
            <span className="shell-titlebar__error">{state.context.error}</span>
          )}
        </div>
      </div>

      {/* ── Step body (ribbon + workspace rendered by each step) */}
      <div className="shell-body">
        {StepComponent && (
          <StepComponent state={state} send={send} context={state.context} />
        )}
      </div>

    </div>
  );
}
