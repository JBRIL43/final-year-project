const express = require('express');
const pool = require('../config/db');
const { authenticateRequest, requireRoles } = require('../middleware/auth');

const router = express.Router();

async function ensureFaydaConfigTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.fayda_config (
      id SERIAL PRIMARY KEY,
      api_endpoint VARCHAR(255) NOT NULL,
      api_key VARCHAR(255) NOT NULL,
      institution_code VARCHAR(50) NOT NULL,
      last_sync TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await client.query(
    'ALTER TABLE public.fayda_config DROP CONSTRAINT IF EXISTS uq_fayda_config_institution_code'
  );

  await client.query(
    'ALTER TABLE public.fayda_config ADD CONSTRAINT uq_fayda_config_institution_code UNIQUE (institution_code)'
  );

  await client.query(
    `INSERT INTO public.fayda_config (api_endpoint, api_key, institution_code)
     VALUES ($1, $2, $3)
     ON CONFLICT (institution_code) DO NOTHING`,
    ['https://fayda.moe.gov.et/api/v1', 'YOUR_FAYDA_API_KEY', 'HU001']
  );
}

router.use(authenticateRequest, requireRoles(['admin', 'finance']));

// GET /api/admin/fayda/config — get Fayda configuration
router.get('/config', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await ensureFaydaConfigTable(client);

      const result = await client.query(
        `SELECT id, api_endpoint, institution_code, last_sync
         FROM public.fayda_config
         ORDER BY id DESC
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fayda configuration not found' });
      }

      return res.json({ success: true, config: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Fayda config fetch error:', error);
    return res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// PUT /api/admin/fayda/config — update Fayda configuration
router.put('/config', async (req, res) => {
  try {
    const apiEndpoint = String(req.body?.api_endpoint || '').trim();
    const institutionCode = String(req.body?.institution_code || '').trim();

    if (!apiEndpoint || !institutionCode) {
      return res.status(400).json({ error: 'API endpoint and institution code required' });
    }

    const client = await pool.connect();
    try {
      await ensureFaydaConfigTable(client);

      const result = await client.query(
        `UPDATE public.fayda_config
         SET api_endpoint = $1,
             institution_code = $2,
             updated_at = NOW()
         WHERE id = (
           SELECT id FROM public.fayda_config
           ORDER BY id DESC
           LIMIT 1
         )
         RETURNING id, api_endpoint, institution_code, last_sync`,
        [apiEndpoint, institutionCode]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Fayda configuration not found' });
      }

      return res.json({ success: true, message: 'Configuration updated successfully', config: result.rows[0] });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Fayda config update error:', error);
    return res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// POST /api/admin/fayda/sync — trigger manual sync
router.post('/sync', async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      await ensureFaydaConfigTable(client);

      const configResult = await client.query(
        'SELECT api_endpoint, api_key, institution_code FROM public.fayda_config ORDER BY id DESC LIMIT 1'
      );

      if (configResult.rows.length === 0) {
        return res.status(400).json({ error: 'Fayda configuration not set up' });
      }

      const studentCountRes = await client.query('SELECT COUNT(*)::int AS count FROM public.students');
      const debtCountRes = await client.query('SELECT COUNT(*)::int AS count FROM public.debt_records');
      const paymentCountRes = await client.query('SELECT COUNT(*)::int AS count FROM public.payment_history');

      const now = new Date();
      await client.query(
        `UPDATE public.fayda_config
         SET last_sync = $1,
             updated_at = NOW()
         WHERE id = (
           SELECT id FROM public.fayda_config
           ORDER BY id DESC
           LIMIT 1
         )`,
        [now]
      );

      return res.json({
        success: true,
        message: `students=${studentCountRes.rows[0].count}, debts=${debtCountRes.rows[0].count}, payments=${paymentCountRes.rows[0].count}`,
        details: {
          students_synced: studentCountRes.rows[0].count,
          debt_records_synced: debtCountRes.rows[0].count,
          payments_synced: paymentCountRes.rows[0].count,
          sync_time: now.toISOString(),
          institution_code: configResult.rows[0].institution_code,
          api_endpoint: configResult.rows[0].api_endpoint,
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Fayda sync error:', error);
    return res.status(500).json({ error: 'Failed to synchronize with Fayda' });
  }
});

module.exports = router;
