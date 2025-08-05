
import { db } from '../db';
import { notificationsTable, bookingsTable, usersTable } from '../db/schema';
import { type CreateNotificationInput, type Notification } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createNotification = async (input: CreateNotificationInput): Promise<Notification> => {
  try {
    const result = await db.insert(notificationsTable)
      .values({
        user_id: input.user_id,
        booking_id: input.booking_id,
        type: input.type,
        title: input.title,
        message: input.message
      })
      .returning()
      .execute();

    const notification = result[0];
    return {
      ...notification,
      sent_at: notification.sent_at
    };
  } catch (error) {
    console.error('Notification creation failed:', error);
    throw error;
  }
};

export const sendBookingConfirmation = async (bookingId: number): Promise<void> => {
  try {
    // Get booking details with user information
    const bookingResults = await db.select()
      .from(bookingsTable)
      .innerJoin(usersTable, eq(bookingsTable.user_id, usersTable.id))
      .where(eq(bookingsTable.id, bookingId))
      .execute();

    if (bookingResults.length === 0) {
      throw new Error(`Booking with id ${bookingId} not found`);
    }

    const booking = bookingResults[0].bookings;
    const user = bookingResults[0].users;

    // Create email notification
    await createNotification({
      user_id: user.id,
      booking_id: bookingId,
      type: 'email',
      title: 'Booking Confirmation',
      message: `Your booking has been confirmed for ${booking.check_in_date} to ${booking.check_out_date}. Booking ID: ${bookingId}`
    });

    // Create in-app notification
    await createNotification({
      user_id: user.id,
      booking_id: bookingId,
      type: 'in_app',
      title: 'Booking Confirmed',
      message: `Welcome ${user.first_name}! Your reservation is confirmed. Check-in: ${booking.check_in_date}`
    });
  } catch (error) {
    console.error('Booking confirmation sending failed:', error);
    throw error;
  }
};

export const sendPaymentReminder = async (bookingId: number): Promise<void> => {
  try {
    // Get booking details with user information
    const bookingResults = await db.select()
      .from(bookingsTable)
      .innerJoin(usersTable, eq(bookingsTable.user_id, usersTable.id))
      .where(eq(bookingsTable.id, bookingId))
      .execute();

    if (bookingResults.length === 0) {
      throw new Error(`Booking with id ${bookingId} not found`);
    }

    const booking = bookingResults[0].bookings;
    const user = bookingResults[0].users;

    // Create payment reminder notification
    await createNotification({
      user_id: user.id,
      booking_id: bookingId,
      type: 'email',
      title: 'Payment Reminder',
      message: `Payment reminder for your booking (ID: ${bookingId}). Amount due: $${parseFloat(booking.total_amount)}. Check-in date: ${booking.check_in_date}`
    });

    // Create in-app reminder
    await createNotification({
      user_id: user.id,
      booking_id: bookingId,
      type: 'in_app',
      title: 'Payment Due',
      message: `Payment of $${parseFloat(booking.total_amount)} is due for your upcoming stay`
    });
  } catch (error) {
    console.error('Payment reminder sending failed:', error);
    throw error;
  }
};

export const sendCheckInInstructions = async (bookingId: number): Promise<void> => {
  try {
    // Get booking details with user information
    const bookingResults = await db.select()
      .from(bookingsTable)
      .innerJoin(usersTable, eq(bookingsTable.user_id, usersTable.id))
      .where(eq(bookingsTable.id, bookingId))
      .execute();

    if (bookingResults.length === 0) {
      throw new Error(`Booking with id ${bookingId} not found`);
    }

    const booking = bookingResults[0].bookings;
    const user = bookingResults[0].users;

    // Create check-in instructions notification
    await createNotification({
      user_id: user.id,
      booking_id: bookingId,
      type: 'email',
      title: 'Check-in Instructions',
      message: `Check-in instructions for your stay starting ${booking.check_in_date}. Please arrive after 3:00 PM. Bring a valid ID and confirmation number: ${bookingId}`
    });

    // Create in-app instructions
    await createNotification({
      user_id: user.id,
      booking_id: bookingId,
      type: 'in_app',
      title: 'Ready for Check-in',
      message: `Your room will be ready after 3:00 PM on ${booking.check_in_date}. See you soon!`
    });
  } catch (error) {
    console.error('Check-in instructions sending failed:', error);
    throw error;
  }
};

export const getNotificationsByUser = async (userId: number): Promise<Notification[]> => {
  try {
    const results = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.user_id, userId))
      .execute();

    return results.map(notification => ({
      ...notification,
      sent_at: notification.sent_at
    }));
  } catch (error) {
    console.error('Fetching user notifications failed:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (id: number): Promise<Notification> => {
  try {
    const result = await db.update(notificationsTable)
      .set({
        status: 'sent',
        sent_at: new Date()
      })
      .where(eq(notificationsTable.id, id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Notification with id ${id} not found`);
    }

    const notification = result[0];
    return {
      ...notification,
      sent_at: notification.sent_at
    };
  } catch (error) {
    console.error('Marking notification as read failed:', error);
    throw error;
  }
};
