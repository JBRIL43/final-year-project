/**
 * HU Student Debt Management - Soft Delete Verification Script
 * This script tests the soft delete mechanism including views,
 * automatic filtering, and admin endpoints logic.
 */

const pool = require('../config/db');

async function runTests() {
  console.log('🧪 Starting Soft Delete Mechanism Tests...');

  try {
    // 1. Create a dummy user for testing
    console.log('\n--- Test 1: Basic Soft Delete ---');
    const email = `test-sd-${Date.now()}@example.com`;
    await pool.query(
      "INSERT INTO public.users (email, full_name, role) VALUES ($1, 'SD Test User', 'student')",
      [email]
    );

    const user = (await pool.query('SELECT * FROM public.users WHERE email = $1', [email])).rows[0];
    console.log('✅ Created user:', user.user_id);

    // Soft delete via the view
    await pool.query('UPDATE public.users SET deleted_at = NOW() WHERE user_id = $1', [user.user_id]);
    console.log('🗑️ Soft deleted user');

    // Verify user is gone from the view
    const viewResult = await pool.query('SELECT * FROM public.users WHERE user_id = $1', [user.user_id]);
    if (viewResult.rows.length === 0) {
      console.log('✅ User correctly hidden from view');
    } else {
      throw new Error('❌ User still visible in view after soft delete');
    }

    // Verify user still exists in the raw table
    const rawResult = await pool.query('SELECT * FROM public._users_data WHERE user_id = $1', [user.user_id]);
    if (rawResult.rows.length === 1) {
      console.log('✅ User still exists in raw table');
    } else {
      throw new Error('❌ User missing from raw table');
    }

    // 2. Test Restore
    console.log('\n--- Test 2: Restore Mechanism ---');
    await pool.query('UPDATE public._users_data SET deleted_at = NULL WHERE user_id = $1', [user.user_id]);
    const restored = await pool.query('SELECT * FROM public.users WHERE user_id = $1', [user.user_id]);
    if (restored.rows.length === 1) {
      console.log('✅ User successfully restored and visible in view');
    } else {
      throw new Error('❌ User not visible in view after restore');
    }

    // 3. Test Permanent Delete Safety
    console.log('\n--- Test 3: Permanent Delete Safety ---');
    // Create a student and a debt record
    const studentNum = `SN-${Date.now()}`;
    const studentRes = await pool.query(
      "INSERT INTO public.students (user_id, student_number, full_name) VALUES ($1, $2, 'Student SD') RETURNING student_id",
      [user.user_id, studentNum]
    );
    const studentId = studentRes.rows[0].student_id;

    await pool.query(
      "INSERT INTO public.debt_records (student_id, initial_amount, current_balance) VALUES ($1, 1000, 1000)",
      [studentId]
    );
    console.log('✅ Created student with active debt:', studentId);

    // Mock the safety check in the permanent delete endpoint
    const debtCheck = await pool.query(
      'SELECT 1 FROM public._debt_records_data WHERE student_id = $1 AND current_balance > 0 AND deleted_at IS NULL LIMIT 1',
      [studentId]
    );

    if (debtCheck.rows.length > 0) {
      console.log('✅ Safety check correctly detected active debt');
    } else {
      throw new Error('❌ Safety check failed to detect active debt');
    }

    // 4. Clean up
    console.log('\n--- Cleaning Up ---');
    await pool.query('DELETE FROM public._debt_records_data WHERE student_id = $1', [studentId]);
    await pool.query('DELETE FROM public._students_data WHERE student_id = $1', [studentId]);
    await pool.query('DELETE FROM public._users_data WHERE user_id = $1', [user.user_id]);
    console.log('✅ Test data removed');

    console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
