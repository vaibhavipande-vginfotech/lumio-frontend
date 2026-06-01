import { createMachine, assign } from 'xstate';

export const STEP_META = {
  step1: { number: 1, label: 'Import' },
  step2: { number: 2, label: 'EDA & Cleaning' },
  step3: { number: 3, label: 'Prompt & Config' },
  step4: { number: 4, label: 'Preview' },
  step5: { number: 5, label: 'Export' },
};

export const flowMachine = createMachine({
  id: 'bankReportFlow',
  initial: 'step1',

  context: {
    importedData: null,   // raw response from Step 1 procedure call
    edaResult:    null,   // confirmed cleaned data from Step 2
    promptConfig: null,   // matched config object from Step 3
    headerConfig: null,   // header/footer customization from Step 1
    columnConfig: null,   // column order/label/format from Step 2
    previewReady: false,  // true once Step 4 iframe signals load
    error:        null,   // last error message (any step)
  },

  on: {
    RESET: {
      target: '.step1',
      actions: assign({
        importedData: null,
        edaResult:    null,
        promptConfig: null,
        headerConfig: null,
        columnConfig: null,
        previewReady: false,
        error:        null,
      }),
    },
  },

  states: {

    /* ── Step 1: Import via Procedure Call ──────────────── */
    step1: {
      on: {
        IMPORT_SUCCESS: {
          target: 'step2',
          actions: assign({
            importedData: ({ event }) => event.data,
            headerConfig: ({ event }) => event.headerConfig ?? null,
            error:        null,
          }),
        },
        IMPORT_ERROR: {
          actions: assign({ error: ({ event }) => event.message }),
        },
      },
    },

    /* ── Step 2: EDA + Data Cleaning ────────────────────── */
    step2: {
      on: {
        EDA_CONFIRM: {
          target: 'step3',
          actions: assign({
            edaResult:    ({ event }) => event.data,
            columnConfig: ({ event }) => event.columnConfig ?? null,
            error:        null,
          }),
        },
        BACK: { target: 'step1' },
      },
    },

    /* ── Step 3: Prompt Parse + Config Match ────────────── */
    step3: {
      on: {
        PROMPT_MATCH_CONFIRMED: {
          target: 'step4',
          actions: assign({
            promptConfig: ({ event }) => event.config,
            error:        null,
          }),
        },
        BACK: { target: 'step2' },
      },
    },

    /* ── Step 4: Live Preview ───────────────────────────── */
    step4: {
      entry: assign({ previewReady: false, error: null }),
      on: {
        PREVIEW_READY: { actions: assign({ previewReady: true }) },
        PREVIEW_ERROR: { actions: assign({ error: ({ event }) => event.message }) },
        NEXT:          { target: 'step5', guard: ({ context }) => context.previewReady },
        BACK:          { target: 'step3' },
      },
    },

    /* ── Step 5: Export ─────────────────────────────────── */
    step5: {
      initial: 'idle',
      states: {
        idle:      { on: { EXPORT_START: 'exporting' } },
        exporting: {
          on: {
            EXPORT_SUCCESS: 'done',
            EXPORT_ERROR:   { target: 'idle', actions: assign({ error: ({ event }) => event.message }) },
          },
        },
        done: {},
      },
      on: { BACK: { target: 'step4' } },
    },

  },
});
