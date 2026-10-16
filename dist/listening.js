export const impressions = {
  calm: 'спокойно',
  tense: 'напряжённо',
  other: 'неопределённо'
};

export function createListeningState() {
  return { step: 0, heard: [false, false], responses: [null, null], revealed: false };
}

export function finishSample(state) {
  if (state.revealed) return state;
  const heard = [...state.heard];
  heard[state.step] = true;
  return { ...state, heard };
}

export function respondToSample(state, impression) {
  if (state.revealed || !state.heard[state.step] || !Object.hasOwn(impressions, impression)) return state;
  const responses = [...state.responses];
  responses[state.step] = impression;
  const step = state.step + 1;
  return { ...state, responses, step, revealed: step === 2 };
}

export function skipListening(state) {
  return { ...state, step: 2, revealed: true };
}
