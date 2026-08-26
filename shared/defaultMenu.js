/**
 * The built-in menu that seeds a new coach's item list.
 * imageKey refers to a bundled image in the frontend (register/src/images);
 * coach-uploaded items use imageData (a data: URL) instead.
 * `name` is the stable stats key — itemBreakdown in daily totals is keyed by it.
 */
const DEFAULT_MENU = [
  { name: 'coffee', text: 'coffee', cost: 2, imageKey: 'coffee' },
  { name: 'icedCoffee', text: 'iced coffee', cost: 2, imageKey: 'icedCoffee' },
  { name: 'tea', text: 'Tea', cost: 2, imageKey: 'tea' },
  { name: 'waterBottle', text: 'water bottle', cost: 1, imageKey: 'water' },
  { name: 'pop', text: 'pop', cost: 1, imageKey: 'pop_image' },
  { name: 'orangeJuice', text: 'orange juice', cost: 1, imageKey: 'orangeJuice' },
  { name: 'punchCard', text: 'punch card', cost: 10, imageKey: 'punch_card_image' },
  { name: 'giftCard', text: 'gift card', cost: 1, imageKey: 'gift_card_image' },
  { name: 'flavorPacket', text: 'flavor packet', cost: 0.5, imageKey: 'crystalLight' },
  { name: 'muffins', text: 'muffins', cost: 2, imageKey: 'littleBites' },
  { name: 'cookies', text: 'cookies', cost: 1, imageKey: 'belvita' },
  { name: 'oatMeal', text: 'oat meal', cost: 3, imageKey: 'walnutBanana' },
  { name: 'cards', text: 'cards', cost: 2, imageKey: 'cards_image' },
  { name: 'sticker', text: 'sticker', cost: 0.25, imageKey: 'stickers' },
  { name: 'bracelet', text: 'bracelet', cost: 2, imageKey: 'bracelet' },
  { name: 'earring', text: 'earring', cost: 2, imageKey: 'earrings' }
];

module.exports = { DEFAULT_MENU };
