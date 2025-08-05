
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, roomTypesTable, bookingsTable, paymentsTable } from '../db/schema';
import { type CreatePaymentInput, type UpdatePaymentInput } from '../schema';
import { createPayment, getPaymentsByBooking, getPaymentById, updatePayment, processRefund } from '../handlers/payments';
import { eq } from 'drizzle-orm';

describe('Payment handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let roomTypeId: number;
  let bookingId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'Test',
        last_name: 'User',
        phone: '+1234567890',
        role: 'guest'
      })
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values({
        name: 'Deluxe Room',
        type: 'deluxe',
        description: 'A luxury room',
        base_price: '200.00',
        max_occupancy: 2,
        amenities: ['wifi', 'tv'],
        image_urls: ['image1.jpg'],
        is_active: true
      })
      .returning()
      .execute();
    roomTypeId = roomTypeResult[0].id;

    // Create test booking
    const bookingResult = await db.insert(bookingsTable)
      .values({
        user_id: userId,
        room_type_id: roomTypeId,
        room_id: null,
        check_in_date: '2024-06-01',
        check_out_date: '2024-06-03',
        guests: 2,
        total_amount: '400.00',
        status: 'confirmed',
        special_requests: null
      })
      .returning()
      .execute();
    bookingId = bookingResult[0].id;
  });

  describe('createPayment', () => {
    const testInput: CreatePaymentInput = {
      booking_id: 0, // Will be set in test
      amount: 400.00,
      payment_method: 'credit_card',
      payment_details: { card_last_four: '1234' }
    };

    it('should create a payment', async () => {
      const input = { ...testInput, booking_id: bookingId };
      const result = await createPayment(input);

      expect(result.booking_id).toEqual(bookingId);
      expect(result.amount).toEqual(400.00);
      expect(typeof result.amount).toBe('number');
      expect(result.payment_method).toEqual('credit_card');
      expect(result.payment_status).toEqual('pending');
      expect(result.transaction_id).toBeNull();
      expect(result.payment_details).toEqual({ card_last_four: '1234' });
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save payment to database', async () => {
      const input = { ...testInput, booking_id: bookingId };
      const result = await createPayment(input);

      const payments = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, result.id))
        .execute();

      expect(payments).toHaveLength(1);
      expect(payments[0].booking_id).toEqual(bookingId);
      expect(parseFloat(payments[0].amount)).toEqual(400.00);
      expect(payments[0].payment_method).toEqual('credit_card');
      expect(payments[0].payment_status).toEqual('pending');
    });

    it('should throw error for non-existent booking', async () => {
      const input = { ...testInput, booking_id: 99999 };
      
      await expect(createPayment(input)).rejects.toThrow(/booking.*not found/i);
    });
  });

  describe('getPaymentsByBooking', () => {
    it('should return payments for a booking', async () => {
      // Create test payments
      await db.insert(paymentsTable)
        .values([
          {
            booking_id: bookingId,
            amount: '200.00',
            payment_method: 'credit_card',
            payment_status: 'completed',
            transaction_id: 'txn_123',
            payment_details: null
          },
          {
            booking_id: bookingId,
            amount: '200.00',
            payment_method: 'bank_transfer',
            payment_status: 'pending',
            transaction_id: null,
            payment_details: null
          }
        ])
        .execute();

      const results = await getPaymentsByBooking(bookingId);

      expect(results).toHaveLength(2);
      expect(results[0].booking_id).toEqual(bookingId);
      expect(results[0].amount).toEqual(200.00);
      expect(typeof results[0].amount).toBe('number');
      expect(results[1].booking_id).toEqual(bookingId);
      expect(results[1].amount).toEqual(200.00);
    });

    it('should return empty array for booking with no payments', async () => {
      const results = await getPaymentsByBooking(bookingId);
      expect(results).toHaveLength(0);
    });
  });

  describe('getPaymentById', () => {
    it('should return payment by ID', async () => {
      const paymentResult = await db.insert(paymentsTable)
        .values({
          booking_id: bookingId,
          amount: '150.00',
          payment_method: 'paypal',
          payment_status: 'completed',
          transaction_id: 'paypal_123',
          payment_details: { paypal_id: 'pp_456' }
        })
        .returning()
        .execute();

      const result = await getPaymentById(paymentResult[0].id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(paymentResult[0].id);
      expect(result!.booking_id).toEqual(bookingId);
      expect(result!.amount).toEqual(150.00);
      expect(typeof result!.amount).toBe('number');
      expect(result!.payment_method).toEqual('paypal');
      expect(result!.payment_status).toEqual('completed');
      expect(result!.transaction_id).toEqual('paypal_123');
      expect(result!.payment_details).toEqual({ paypal_id: 'pp_456' });
    });

    it('should return null for non-existent payment', async () => {
      const result = await getPaymentById(99999);
      expect(result).toBeNull();
    });
  });

  describe('updatePayment', () => {
    let paymentId: number;

    beforeEach(async () => {
      const paymentResult = await db.insert(paymentsTable)
        .values({
          booking_id: bookingId,
          amount: '300.00',
          payment_method: 'credit_card',
          payment_status: 'pending',
          transaction_id: null,
          payment_details: null
        })
        .returning()
        .execute();
      paymentId = paymentResult[0].id;
    });

    it('should update payment status', async () => {
      const input: UpdatePaymentInput = {
        id: paymentId,
        payment_status: 'completed',
        transaction_id: 'txn_success_123',
        payment_details: { confirmation: 'confirmed' }
      };

      const result = await updatePayment(input);

      expect(result.id).toEqual(paymentId);
      expect(result.payment_status).toEqual('completed');
      expect(result.transaction_id).toEqual('txn_success_123');
      expect(result.payment_details).toEqual({ confirmation: 'confirmed' });
      expect(result.amount).toEqual(300.00);
      expect(typeof result.amount).toBe('number');
    });

    it('should update only provided fields', async () => {
      const input: UpdatePaymentInput = {
        id: paymentId,
        payment_status: 'failed'
      };

      const result = await updatePayment(input);

      expect(result.payment_status).toEqual('failed');
      expect(result.transaction_id).toBeNull();
      expect(result.payment_details).toBeNull();
    });

    it('should throw error for non-existent payment', async () => {
      const input: UpdatePaymentInput = {
        id: 99999,
        payment_status: 'completed'
      };

      await expect(updatePayment(input)).rejects.toThrow(/payment.*not found/i);
    });
  });

  describe('processRefund', () => {
    let paymentId: number;

    beforeEach(async () => {
      const paymentResult = await db.insert(paymentsTable)
        .values({
          booking_id: bookingId,
          amount: '500.00',
          payment_method: 'credit_card',
          payment_status: 'completed',
          transaction_id: 'txn_original_123',
          payment_details: null
        })
        .returning()
        .execute();
      paymentId = paymentResult[0].id;
    });

    it('should process refund successfully', async () => {
      const result = await processRefund(paymentId, 500.00);

      expect(result.id).toEqual(paymentId);
      expect(result.payment_status).toEqual('refunded');
      expect(result.transaction_id).toMatch(/^refund_/);
      expect(result.amount).toEqual(500.00);
      expect(typeof result.amount).toBe('number');
    });

    it('should process partial refund', async () => {
      const result = await processRefund(paymentId, 250.00);

      expect(result.payment_status).toEqual('refunded');
      expect(result.transaction_id).toMatch(/^refund_/);
    });

    it('should throw error for refund amount exceeding original', async () => {
      await expect(processRefund(paymentId, 600.00))
        .rejects.toThrow(/refund amount cannot exceed/i);
    });

    it('should throw error for negative refund amount', async () => {
      await expect(processRefund(paymentId, -100.00))
        .rejects.toThrow(/refund amount must be positive/i);
    });

    it('should throw error for zero refund amount', async () => {
      await expect(processRefund(paymentId, 0))
        .rejects.toThrow(/refund amount must be positive/i);
    });

    it('should throw error for non-existent payment', async () => {
      await expect(processRefund(99999, 100.00))
        .rejects.toThrow(/payment.*not found/i);
    });
  });
});
