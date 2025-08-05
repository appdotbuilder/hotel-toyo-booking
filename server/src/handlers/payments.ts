
import { db } from '../db';
import { paymentsTable, bookingsTable } from '../db/schema';
import { type CreatePaymentInput, type UpdatePaymentInput, type Payment } from '../schema';
import { eq } from 'drizzle-orm';

export const createPayment = async (input: CreatePaymentInput): Promise<Payment> => {
  try {
    // Verify booking exists
    const booking = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, input.booking_id))
      .execute();

    if (booking.length === 0) {
      throw new Error(`Booking with ID ${input.booking_id} not found`);
    }

    // Insert payment record
    const result = await db.insert(paymentsTable)
      .values({
        booking_id: input.booking_id,
        amount: input.amount.toString(),
        payment_method: input.payment_method,
        payment_status: 'pending',
        transaction_id: null,
        payment_details: input.payment_details
      })
      .returning()
      .execute();

    const payment = result[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount),
      payment_details: payment.payment_details as Record<string, any> | null
    };
  } catch (error) {
    console.error('Payment creation failed:', error);
    throw error;
  }
};

export const getPaymentsByBooking = async (bookingId: number): Promise<Payment[]> => {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.booking_id, bookingId))
      .execute();

    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount),
      payment_details: payment.payment_details as Record<string, any> | null
    }));
  } catch (error) {
    console.error('Failed to fetch payments by booking:', error);
    throw error;
  }
};

export const getPaymentById = async (id: number): Promise<Payment | null> => {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const payment = results[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount),
      payment_details: payment.payment_details as Record<string, any> | null
    };
  } catch (error) {
    console.error('Failed to fetch payment by ID:', error);
    throw error;
  }
};

export const updatePayment = async (input: UpdatePaymentInput): Promise<Payment> => {
  try {
    // Verify payment exists
    const existingPayment = await getPaymentById(input.id);
    if (!existingPayment) {
      throw new Error(`Payment with ID ${input.id} not found`);
    }

    // Build update values
    const updateValues: any = {
      payment_status: input.payment_status,
      updated_at: new Date()
    };

    if (input.transaction_id !== undefined) {
      updateValues.transaction_id = input.transaction_id;
    }

    if (input.payment_details !== undefined) {
      updateValues.payment_details = input.payment_details;
    }

    const result = await db.update(paymentsTable)
      .set(updateValues)
      .where(eq(paymentsTable.id, input.id))
      .returning()
      .execute();

    const payment = result[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount),
      payment_details: payment.payment_details as Record<string, any> | null
    };
  } catch (error) {
    console.error('Payment update failed:', error);
    throw error;
  }
};

export const processRefund = async (paymentId: number, amount: number): Promise<Payment> => {
  try {
    // Verify payment exists
    const existingPayment = await getPaymentById(paymentId);
    if (!existingPayment) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    // Verify refund amount is valid
    if (amount > existingPayment.amount) {
      throw new Error('Refund amount cannot exceed original payment amount');
    }

    if (amount <= 0) {
      throw new Error('Refund amount must be positive');
    }

    // Update payment to refunded status
    const result = await db.update(paymentsTable)
      .set({
        payment_status: 'refunded',
        transaction_id: `refund_${Date.now()}`,
        updated_at: new Date()
      })
      .where(eq(paymentsTable.id, paymentId))
      .returning()
      .execute();

    const payment = result[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount),
      payment_details: payment.payment_details as Record<string, any> | null
    };
  } catch (error) {
    console.error('Refund processing failed:', error);
    throw error;
  }
};
