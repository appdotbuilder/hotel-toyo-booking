
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, bookingsTable, roomTypesTable, notificationsTable } from '../db/schema';
import { type CreateNotificationInput } from '../schema';
import { 
  createNotification, 
  sendBookingConfirmation, 
  sendPaymentReminder, 
  sendCheckInInstructions, 
  getNotificationsByUser, 
  markNotificationAsRead 
} from '../handlers/notifications';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashedpassword',
  first_name: 'John',
  last_name: 'Doe',
  phone: '1234567890',
  role: 'guest' as const
};

const testRoomType = {
  name: 'Deluxe Room',
  type: 'deluxe' as const,
  description: 'A luxurious room',
  base_price: '199.99',
  max_occupancy: 2,
  amenities: '["wifi", "tv"]',
  image_urls: '["image1.jpg"]',
  is_active: true
};

const testBooking = {
  user_id: 0, // Will be set after user creation
  room_type_id: 0, // Will be set after room type creation
  room_id: null,
  check_in_date: '2024-12-25',
  check_out_date: '2024-12-27',
  guests: 2,
  total_amount: '399.98',
  status: 'confirmed' as const,
  special_requests: null
};

const testNotificationInput: CreateNotificationInput = {
  user_id: 0, // Will be set after user creation
  booking_id: null,
  type: 'email',
  title: 'Test Notification',
  message: 'This is a test notification'
};

describe('Notifications', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createNotification', () => {
    it('should create a notification', async () => {
      // Create prerequisite user
      const userResult = await db.insert(usersTable).values(testUser).returning().execute();
      const user = userResult[0];

      const input = {
        ...testNotificationInput,
        user_id: user.id
      };

      const result = await createNotification(input);

      expect(result.id).toBeDefined();
      expect(result.user_id).toEqual(user.id);
      expect(result.booking_id).toBeNull();
      expect(result.type).toEqual('email');
      expect(result.title).toEqual('Test Notification');
      expect(result.message).toEqual('This is a test notification');
      expect(result.status).toEqual('pending');
      expect(result.sent_at).toBeNull();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should save notification to database', async () => {
      // Create prerequisite user
      const userResult = await db.insert(usersTable).values(testUser).returning().execute();
      const user = userResult[0];

      const input = {
        ...testNotificationInput,
        user_id: user.id
      };

      const result = await createNotification(input);

      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, result.id))
        .execute();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].user_id).toEqual(user.id);
      expect(notifications[0].title).toEqual('Test Notification');
      expect(notifications[0].status).toEqual('pending');
    });
  });

  describe('sendBookingConfirmation', () => {
    it('should create confirmation notifications for a booking', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable).values(testUser).returning().execute();
      const user = userResult[0];

      const roomTypeResult = await db.insert(roomTypesTable).values(testRoomType).returning().execute();
      const roomType = roomTypeResult[0];

      const bookingResult = await db.insert(bookingsTable).values({
        ...testBooking,
        user_id: user.id,
        room_type_id: roomType.id
      }).returning().execute();
      const booking = bookingResult[0];

      await sendBookingConfirmation(booking.id);

      // Check that notifications were created
      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.booking_id, booking.id))
        .execute();

      expect(notifications).toHaveLength(2);

      // Check email notification
      const emailNotification = notifications.find(n => n.type === 'email');
      expect(emailNotification).toBeDefined();
      expect(emailNotification!.title).toEqual('Booking Confirmation');
      expect(emailNotification!.message).toMatch(/booking has been confirmed/i);
      expect(emailNotification!.user_id).toEqual(user.id);

      // Check in-app notification
      const inAppNotification = notifications.find(n => n.type === 'in_app');
      expect(inAppNotification).toBeDefined();
      expect(inAppNotification!.title).toEqual('Booking Confirmed');
      expect(inAppNotification!.message).toMatch(/Welcome John/);
      expect(inAppNotification!.user_id).toEqual(user.id);
    });

    it('should throw error for non-existent booking', async () => {
      await expect(sendBookingConfirmation(99999)).rejects.toThrow(/booking.*not found/i);
    });
  });

  describe('sendPaymentReminder', () => {
    it('should create payment reminder notifications', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable).values(testUser).returning().execute();
      const user = userResult[0];

      const roomTypeResult = await db.insert(roomTypesTable).values(testRoomType).returning().execute();
      const roomType = roomTypeResult[0];

      const bookingResult = await db.insert(bookingsTable).values({
        ...testBooking,
        user_id: user.id,
        room_type_id: roomType.id
      }).returning().execute();
      const booking = bookingResult[0];

      await sendPaymentReminder(booking.id);

      // Check that notifications were created
      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.booking_id, booking.id))
        .execute();

      expect(notifications).toHaveLength(2);

      // Check email notification
      const emailNotification = notifications.find(n => n.type === 'email');
      expect(emailNotification).toBeDefined();
      expect(emailNotification!.title).toEqual('Payment Reminder');
      expect(emailNotification!.message).toMatch(/payment reminder/i);
      expect(emailNotification!.message).toMatch(/399.98/);

      // Check in-app notification
      const inAppNotification = notifications.find(n => n.type === 'in_app');
      expect(inAppNotification).toBeDefined();
      expect(inAppNotification!.title).toEqual('Payment Due');
      expect(inAppNotification!.message).toMatch(/payment.*due/i);
    });
  });

  describe('sendCheckInInstructions', () => {
    it('should create check-in instruction notifications', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable).values(testUser).returning().execute();
      const user = userResult[0];

      const roomTypeResult = await db.insert(roomTypesTable).values(testRoomType).returning().execute();
      const roomType = roomTypeResult[0];

      const bookingResult = await db.insert(bookingsTable).values({
        ...testBooking,
        user_id: user.id,
        room_type_id: roomType.id
      }).returning().execute();
      const booking = bookingResult[0];

      await sendCheckInInstructions(booking.id);

      // Check that notifications were created
      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.booking_id, booking.id))
        .execute();

      expect(notifications).toHaveLength(2);

      // Check email notification
      const emailNotification = notifications.find(n => n.type === 'email');
      expect(emailNotification).toBeDefined();
      expect(emailNotification!.title).toEqual('Check-in Instructions');
      expect(emailNotification!.message).toMatch(/check-in instructions/i);
      expect(emailNotification!.message).toMatch(/3:00 PM/);

      // Check in-app notification
      const inAppNotification = notifications.find(n => n.type === 'in_app');
      expect(inAppNotification).toBeDefined();
      expect(inAppNotification!.title).toEqual('Ready for Check-in');
      expect(inAppNotification!.message).toMatch(/room will be ready/i);
    });
  });

  describe('getNotificationsByUser', () => {
    it('should return notifications for a specific user', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable).values(testUser).returning().execute();
      const user = userResult[0];

      // Create another user to ensure we only get notifications for the target user
      const anotherUserResult = await db.insert(usersTable).values({
        ...testUser,
        email: 'another@example.com'
      }).returning().execute();
      const anotherUser = anotherUserResult[0];

      // Create notifications for target user
      await createNotification({
        ...testNotificationInput,
        user_id: user.id,
        title: 'First Notification'
      });

      await createNotification({
        ...testNotificationInput,
        user_id: user.id,
        title: 'Second Notification'
      });

      // Create notification for another user
      await createNotification({
        ...testNotificationInput,
        user_id: anotherUser.id,
        title: 'Other User Notification'
      });

      const results = await getNotificationsByUser(user.id);

      expect(results).toHaveLength(2);
      expect(results.every(n => n.user_id === user.id)).toBe(true);
      expect(results.some(n => n.title === 'First Notification')).toBe(true);
      expect(results.some(n => n.title === 'Second Notification')).toBe(true);
    });

    it('should return empty array for user with no notifications', async () => {
      // Create user with no notifications
      const userResult = await db.insert(usersTable).values(testUser).returning().execute();
      const user = userResult[0];

      const results = await getNotificationsByUser(user.id);

      expect(results).toHaveLength(0);
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as sent with timestamp', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable).values(testUser).returning().execute();
      const user = userResult[0];

      const notification = await createNotification({
        ...testNotificationInput,
        user_id: user.id
      });

      const result = await markNotificationAsRead(notification.id);

      expect(result.id).toEqual(notification.id);
      expect(result.status).toEqual('sent');
      expect(result.sent_at).toBeInstanceOf(Date);
      expect(result.sent_at).toBeTruthy();
    });

    it('should update notification in database', async () => {
      // Create prerequisite data
      const userResult = await db.insert(usersTable).values(testUser).returning().execute();
      const user = userResult[0];

      const notification = await createNotification({
        ...testNotificationInput,
        user_id: user.id
      });

      await markNotificationAsRead(notification.id);

      const updatedNotifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, notification.id))
        .execute();

      expect(updatedNotifications).toHaveLength(1);
      expect(updatedNotifications[0].status).toEqual('sent');
      expect(updatedNotifications[0].sent_at).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent notification', async () => {
      await expect(markNotificationAsRead(99999)).rejects.toThrow(/notification.*not found/i);
    });
  });
});
