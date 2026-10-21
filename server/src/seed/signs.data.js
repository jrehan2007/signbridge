/**
 * Starter ISL vocabulary. Hand-type / gesture-type values are editable defaults:
 * have them verified against the ISLRTC Indian Sign Language Dictionary before production use.
 */
const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((ch) => ({
  word: ch,
  category: 'alphabet',
  handType: 'two',
  gestureType: 'static',
  description: `Letter "${ch}" of the ISL manual (fingerspelling) alphabet. Used to spell names, places and words without a dedicated sign.`,
  howTo: [
    'Face the camera with both hands clearly inside the frame.',
    'Hold the hand-shape steady for about one second.',
    'Keep your hands at chest height with good front lighting.',
  ],
}));

const digits = Array.from({ length: 10 }, (_, n) => ({
  word: String(n),
  category: 'digit',
  handType: 'one',
  gestureType: 'static',
  description: `Number ${n} in Indian Sign Language, signed with one hand.`,
  howTo: [
    'Use your dominant hand, palm facing the camera.',
    n >= 1 && n <= 5 ? `Extend ${n} finger${n > 1 ? 's' : ''} clearly separated.` : 'Form the number hand-shape and keep the other fingers relaxed.',
    'Hold steady until the caption appears.',
  ],
}));

const words = [
  ['Hello', 'one', 'Greeting used when meeting someone.'],
  ['Thank You', 'one', 'Expresses gratitude.'],
  ['Please', 'one', 'Polite request marker.'],
  ['Sorry', 'one', 'Apology.'],
  ['Yes', 'one', 'Affirmative answer.'],
  ['No', 'one', 'Negative answer.'],
  ['Help', 'two', 'Request for assistance — important for emergencies.'],
  ['Water', 'one', 'Asking for or referring to water.'],
  ['Food', 'one', 'Asking for or referring to food / eating.'],
  ['Good', 'one', 'Positive quality or approval.'],
  ['Friend', 'two', 'Refers to a friend.'],
  ['Home', 'two', 'Refers to home or house.'],
  ['Name', 'two', 'Used in "What is your name?" / "My name is…".'],
  ['Stop', 'two', 'Instruction to stop.'],
  ['Doctor', 'one', 'Refers to a doctor or medical help.'],
].map(([word, handType, description]) => ({
  word,
  category: 'word',
  handType,
  gestureType: 'dynamic',
  description: `${description} The portal recognises the held key-pose of this sign.`,
  howTo: [
    'Watch the reference video from the ISLRTC dictionary.',
    'Perform the sign and pause on its final hand-shape.',
    'Keep both hands visible if the sign is two-handed.',
  ],
}));

export const SEED_SIGNS = [...letters, ...digits, ...words].map((s, i) => ({ ...s, labelIndex: i }));
