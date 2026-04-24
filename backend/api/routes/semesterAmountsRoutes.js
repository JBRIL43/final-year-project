const express = require('express');
const pool = require('../config/db');
const { authenticateRequest, requireRoles } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateRequest, requireRoles(['admin', 'finance']));

// GET /api/admin/semester-amounts — list all semester amount configurations
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         academic_year,
         campus,
         program_type,
         tuition_cost_per_year,
         boarding_cost_per_year,
         food_cost_per_month,
         health_insurance_fee,
         other_fees,
         effective_from,
         created_at,
         updated_at
       FROM public.semester_amounts
       ORDER BY academic_year DESC, campus ASC, program_type ASC`
    );

    return res.json({ success: true, amounts: result.rows });
  } catch (error) {
    console.error('Semester amounts fetch error:', error);
    return res.status(500).json({ error: 'Failed to load semester amounts' });
  }
});

// POST /api/admin/semester-amounts — create a new semester amount configuration
router.post('/', async (req, res) => {
  try {
    const {
      academic_year,
      campus,
      program_type,
      tuition_cost_per_year,
      boarding_cost_per_year,
      food_cost_per_month,
      health_insurance_fee = 0,
      other_fees = 0,
      effective_from,
    } = req.body || {};

    if (!academic_year || !campus || !program_type || !effective_from) {
      return res.status(400).json({
        error: 'academic_year, campus, program_type, and effective_from are required',
      });
    }

    const tuitionCost = Number(tuition_cost_per_year);
    const boardingCost = Number(boarding_cost_per_year);
    const foodCost = Number(food_cost_per_month);
    const healthFee = Number(health_insurance_fee);
    const otherFee = Number(other_fees);

    if (
      [tuitionCost, boardingCost, foodCost, healthFee, otherFee].some(
        (value) => Number.isNaN(value) || value < 0
      )
    ) {
      return res.status(400).json({
        error: 'All fee values must be valid non-negative numbers',
      });
    }

    const result = await pool.query(
      `INSERT INTO public.semester_amounts (
         academic_year,
         campus,
         program_type,
         tuition_cost_per_year,
         boarding_cost_per_year,
         food_cost_per_month,
         health_insurance_fee,
         other_fees,
         effective_from,
         created_at,
         updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING *`,
      [
        String(academic_year).trim(),
        String(campus).trim(),
        String(program_type).trim(),
        tuitionCost,
        boardingCost,
        foodCost,
        healthFee,
        otherFee,
        effective_from,
      ]
    );

    return res.status(201).json({ success: true, amount: result.rows[0] });
  } catch (error) {
    console.error('Semester amount creation error:', error);

    if (error && error.code === '23505') {
      return res.status(409).json({
        error: 'Configuration already exists for this academic year, campus, and program type',
      });
    }

    return res.status(500).json({ error: 'Failed to create semester amount' });
  }
});

// DELETE /api/admin/semester-amounts/:id — remove a semester amount configuration
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({ error: 'Invalid semester amount id' });
    }

    const result = await pool.query(
      'DELETE FROM public.semester_amounts WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Semester amount configuration not found' });
    }

    return res.json({ success: true, message: 'Semester amount deleted successfully' });
  } catch (error) {
    console.error('Semester amount deletion error:', error);
    return res.status(500).json({ error: 'Failed to delete semester amount' });
  }
});

module.exports = router;