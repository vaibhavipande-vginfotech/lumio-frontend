import { useMachine } from '@xstate/react';
import { flowMachine } from './machine/flowMachine';
import StepShell from './components/StepShell';

export default function App() {
  const [state, send] = useMachine(flowMachine);
  return <StepShell state={state} send={send} />;
}
