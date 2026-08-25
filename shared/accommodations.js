/**
 * Accommodation defaults + normalizer (backend copy).
 * Keep in sync with register/src/data/accommodations.js.
 *
 * Adding a new accommodation later = add a default here (and in the frontend
 * copy) and wire up the UI; old student records pick up the default
 * automatically through normalizeAccommodations().
 */
const DEFAULT_ACCOMMODATIONS = {
  // How the student signs in: 'tap' (tap their name), 'type' (type their name),
  // 'pin' (type their name + 4-digit passcode). A skill ladder students climb.
  loginMethod: 'tap',
  loginPin: '',

  // Display supports
  largeText: false,
  largeButtons: false,
  showPrices: true,

  // Payment screen input: 'both' | 'bills' | 'keypad'
  paymentInput: 'both',

  // Change step
  changeQuiz: true, // off = register just shows the change owed
  changeChoices: 3, // 2 or 3 answer buttons on the change quiz
  countingHelper: true // the "need help counting your change?" step
};

/**
 * Merge stored accommodations (any age/shape) with defaults.
 * Also migrates the legacy shape:
 *   { registerKeyboard: ['bills','keypad'], buttonSize: bool, minimizeChoices: n }
 */
function normalizeAccommodations(stored) {
  const acc = { ...DEFAULT_ACCOMMODATIONS };
  if (!stored || typeof stored !== 'object') return acc;

  // Legacy migration
  if (Array.isArray(stored.registerKeyboard)) {
    const kb = stored.registerKeyboard;
    if (kb.includes('bills') && kb.includes('keypad')) acc.paymentInput = 'both';
    else if (kb.includes('keypad')) acc.paymentInput = 'keypad';
    else if (kb.includes('bills')) acc.paymentInput = 'bills';
  }
  if (typeof stored.buttonSize === 'boolean') acc.largeButtons = stored.buttonSize;
  if (typeof stored.minimizeChoices === 'number') {
    acc.changeChoices = Math.max(2, 3 - stored.minimizeChoices);
  }

  // Current fields override
  for (const key of Object.keys(DEFAULT_ACCOMMODATIONS)) {
    if (stored[key] !== undefined && stored[key] !== null) acc[key] = stored[key];
  }

  // Sanity clamps
  if (!['tap', 'type', 'pin'].includes(acc.loginMethod)) acc.loginMethod = 'tap';
  if (!['both', 'bills', 'keypad'].includes(acc.paymentInput)) acc.paymentInput = 'both';
  acc.changeChoices = Number(acc.changeChoices) === 2 ? 2 : 3;
  acc.loginPin = String(acc.loginPin || '').replace(/\D/g, '').slice(0, 4);
  // A passcode sign-in without a full 4-digit passcode would lock the student
  // out — fall back to typing their name until the coach sets a passcode.
  if (acc.loginMethod === 'pin' && acc.loginPin.length !== 4) acc.loginMethod = 'type';

  return acc;
}

module.exports = { DEFAULT_ACCOMMODATIONS, normalizeAccommodations };
