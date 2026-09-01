const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { DEFAULT_MENU } = require('../shared/defaultMenu');

router.use(authenticateToken);

// ~250KB is plenty for a resized photo (the frontend downsizes before upload)
const MAX_IMAGE_BYTES = 250 * 1024;

function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  );
}

// The register's smallest denomination is the quarter — prices must be
// 25¢ multiples or the change quiz/counting helper can't represent the change.
function quarterPrice(cost) {
  const price = Number(cost);
  if (!isFinite(price) || price < 0 || price > 999) return null;
  return Math.round(price * 4) / 4;
}

function validImage(imageData) {
  return (
    typeof imageData === 'string' &&
    /^data:image\/(png|jpe?g|webp|gif);base64,/.test(imageData) &&
    imageData.length <= MAX_IMAGE_BYTES * 1.4 // base64 overhead
  );
}

async function seedIfEmpty(coach) {
  const markerId = `menuMeta-${coach}`;
  const marker = await store.getMetaDoc(markerId, coach);
  const items = await store.listMenuItems(coach);

  // Already seeded once (or the coach built a menu before markers existed):
  // return whatever is there — an intentionally emptied menu STAYS empty.
  if (marker || items.length > 0) {
    if (!marker) {
      await store.upsertMetaDoc({ id: markerId, type: 'menuMeta', coach, seeded: true });
    }
    return items;
  }

  // First use: seed the defaults with DETERMINISTIC ids so two devices
  // seeding at the same moment converge on one set (duplicate id = 409).
  const now = new Date().toISOString();
  for (let i = 0; i < DEFAULT_MENU.length; i += 1) {
    const d = DEFAULT_MENU[i];
    try {
      await store.createMenuItem({
        id: `menu-${d.name}`,
        type: 'menuItem',
        coach,
        name: d.name, // stable stats key
        text: d.text,
        cost: d.cost,
        imageKey: d.imageKey, // bundled image in the app
        imageData: null, // or a coach-uploaded data URL
        order: i,
        createdAt: now,
        updatedAt: now
      });
    } catch (err) {
      const code = err.code || err.statusCode;
      if (code !== 409) throw err; // another device already seeded this item
    }
  }
  await store.upsertMetaDoc({ id: markerId, type: 'menuMeta', coach, seeded: true });
  return store.listMenuItems(coach); // the real, complete set
}

// The coach's menu (seeded from the built-in items on first use)
router.get('/', async (req, res) => {
  try {
    const items = await seedIfEmpty(req.user.coach);
    res.json({ items });
  } catch (error) {
    console.error('Get menu error:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// Add an item (coach only)
router.post('/', requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { text, cost, imageData } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'An item name is required' });
    }
    const price = quarterPrice(cost);
    if (price === null) {
      return res.status(400).json({ error: 'Price must be between $0 and $999, in 25¢ steps' });
    }
    if (imageData && !validImage(imageData)) {
      return res.status(400).json({ error: 'Image must be a small PNG/JPEG (try re-taking the photo)' });
    }

    const items = await seedIfEmpty(req.user.coach);
    const base = slugify(text);
    const taken = new Set(items.map((i) => i.name));
    let name = base;
    let n = 2;
    while (taken.has(name)) name = `${base}-${n++}`;

    const now = new Date().toISOString();
    const item = {
      id: uuidv4(),
      type: 'menuItem',
      coach: req.user.coach,
      name,
      text: String(text).trim(),
      cost: price,
      imageKey: null,
      imageData: imageData || null,
      order: items.length,
      createdAt: now,
      updatedAt: now
    };
    await store.createMenuItem(item);
    res.status(201).json({ item });
  } catch (error) {
    console.error('Create menu item error:', error);
    res.status(500).json({ error: 'Failed to add item' });
  }
});

// Reorder the whole menu (coach only): body { ids: [itemId, ...] } in the
// desired order. Items not listed keep their relative order at the end.
router.post('/reorder', requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
      return res.status(400).json({ error: 'ids must be an array of item ids' });
    }

    const items = await store.listMenuItems(req.user.coach);
    const byId = {};
    items.forEach((item) => {
      byId[item.id] = item;
    });

    let order = 0;
    const now = new Date().toISOString();
    for (const id of ids) {
      const item = byId[id];
      if (!item) continue; // stale id from another device — skip
      if (item.order !== order) {
        item.order = order;
        item.updatedAt = now;
        await store.replaceMenuItem(item);
      }
      order += 1;
      delete byId[id];
    }
    // Anything the client didn't mention (e.g. added meanwhile) goes after
    for (const item of items) {
      if (!byId[item.id]) continue;
      if (item.order !== order) {
        item.order = order;
        item.updatedAt = now;
        await store.replaceMenuItem(item);
      }
      order += 1;
    }

    res.json({ items: await store.listMenuItems(req.user.coach) });
  } catch (error) {
    console.error('Reorder menu error:', error);
    res.status(500).json({ error: 'Failed to reorder items' });
  }
});

// Edit an item (coach only)
router.put('/:id', requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const { text, cost, imageData, active } = req.body;
    const item = await store.getMenuItem(req.params.id, req.user.coach);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (text !== undefined) {
      if (!String(text).trim()) return res.status(400).json({ error: 'An item name is required' });
      item.text = String(text).trim();
    }
    if (cost !== undefined) {
      const price = quarterPrice(cost);
      if (price === null) {
        return res.status(400).json({ error: 'Price must be between $0 and $999, in 25¢ steps' });
      }
      item.cost = price;
    }
    if (imageData !== undefined && imageData !== null) {
      if (!validImage(imageData)) {
        return res.status(400).json({ error: 'Image must be a small PNG/JPEG (try re-taking the photo)' });
      }
      item.imageData = imageData;
      item.imageKey = null;
    }
    if (typeof active === 'boolean') {
      // Hidden (e.g. out of stock) items stay on the coach's list but are
      // filtered out of the student register
      item.active = active;
    }
    item.updatedAt = new Date().toISOString();

    const updated = await store.replaceMenuItem(item);
    res.json({ item: updated });
  } catch (error) {
    console.error('Update menu item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Remove an item (coach only)
router.delete('/:id', requireRole('admin', 'teacher'), async (req, res) => {
  try {
    const item = await store.getMenuItem(req.params.id, req.user.coach);
    await store.deleteMenuItem(req.params.id, req.user.coach);

    // Housekeeping: drop the item's name from every student's hiddenItems so a
    // later item reusing the slug doesn't come back mysteriously hidden.
    if (item) {
      try {
        const roster = await store.listUsersByCoach(req.user.coach);
        for (const user of roster) {
          const hidden = (user.accommodations && user.accommodations.hiddenItems) || [];
          if (Array.isArray(hidden) && hidden.includes(item.name)) {
            user.accommodations.hiddenItems = hidden.filter((n) => n !== item.name);
            user.updatedAt = new Date().toISOString();
            await store.replaceUser(user);
          }
        }
      } catch (err) {
        console.error('hiddenItems cleanup error:', err);
      }
    }

    res.json({ message: 'Item removed' });
  } catch (error) {
    console.error('Delete menu item error:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

module.exports = router;
