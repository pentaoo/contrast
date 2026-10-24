// A completed performance advances the story; stopping never does.
export function createListeningState() {
  return { phase: 'intro', heardMistake: false, heardCorrect: false };
}

export function finishMelody(state, version) {
  if (version === 'mistake' && state.phase === 'intro') {
    return { ...state, phase: 'explanation', heardMistake: true };
  }
  if (version === 'correct' && state.phase === 'explanation' && !state.heardCorrect) {
    return { ...state, heardCorrect: true };
  }
  return state;
}

export function skipListening(state) {
  return state.phase !== 'explanation' ? { ...state, phase: 'explanation' } : state;
}
