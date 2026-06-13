// backend/controllers/mysql/settingController.js  (MySQL / Prisma)
const prisma = require('../../config/prisma');
const { mapSetting } = require('../../data/map');

const DEFAULTS = [
  { key: 'instapay_account_name', value: 'DomDom Store',      label: 'InstaPay Account Name' },
  { key: 'instapay_identifier',   value: '+201000000000',     label: 'InstaPay Phone / Username' },
  { key: 'vodafone_cash_number',  value: '+201000000000',     label: 'Vodafone Cash Number' },
  {
    key:   'payment_instructions',
    value: 'Please transfer the exact total amount and upload a clear screenshot as proof of payment.',
    label: 'Payment Instructions'
  }
];
const PUBLIC_KEYS = DEFAULTS.map(d => d.key);

// GET /api/settings  (public)
exports.getPublic = async (req, res) => {
  try {
    const docs = await prisma.setting.findMany({ where: { key: { in: PUBLIC_KEYS } } });
    const out  = {};
    for (const d of DEFAULTS) out[d.key] = d.value;   // seed defaults
    for (const s of docs)     out[s.key] = s.value;   // override with DB values
    res.json({ success: true, settings: out });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// GET /api/admin/settings  (admin)
exports.getAll = async (req, res) => {
  try {
    // Ensure all default keys exist (parity with $setOnInsert upsert)
    for (const d of DEFAULTS) {
      await prisma.setting.upsert({
        where:  { key: d.key },
        update: {},                                   // do not touch existing values
        create: { key: d.key, value: d.value, label: d.label }
      });
    }
    const settings = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    res.json({ success: true, settings: settings.map(mapSetting) });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// PUT /api/admin/settings  (admin)
exports.update = async (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'settings object required' });
    }
    await Promise.all(
      Object.entries(settings).map(([key, value]) =>
        prisma.setting.upsert({
          where:  { key },
          update: { value: String(value) },
          create: { key, value: String(value) }
        })
      )
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};
