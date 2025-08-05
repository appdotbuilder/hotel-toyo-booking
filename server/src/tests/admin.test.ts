
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, roomTypesTable, roomsTable, bookingsTable, paymentsTable } from '../db/schema';
import { getAllUsers, updateUserRole, getDashboardStats, getRevenueReport, getOccupancyReport } from '../handlers/admin';
import { eq } from 'drizzle-orm';

describe('Admin Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let roomCounter = 1;

  // Helper function to create test user
  const createTestUser = async (role: 'guest' | 'admin' | 'superuser' = 'guest') => {
    const result = await db.insert(usersTable)
      .values({
        email: `user-${Date.now()}-${Math.random()}@example.com`,
        password_hash: 'hashed_password',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+1234567890',
        role: role
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create test room type
  const createTestRoomType = async () => {
    const result = await db.insert(roomTypesTable)
      .values({
        name: 'Standard Room',
        type: 'deluxe',
        description: 'A comfortable deluxe room',
        base_price: '150.00',
        max_occupancy: 2,
        amenities: ['wifi', 'tv'],
        image_urls: ['image1.jpg']
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create test room
  const createTestRoom = async (roomTypeId: number) => {
    const result = await db.insert(roomsTable)
      .values({
        room_number: `R${roomCounter++}`,
        room_type_id: roomTypeId,
        is_available: true
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create test booking
  const createTestBooking = async (userId: number, roomTypeId: number, roomId?: number) => {
    const result = await db.insert(bookingsTable)
      .values({
        user_id: userId,
        room_type_id: roomTypeId,
        room_id: roomId || null,
        check_in_date: '2024-01-15',
        check_out_date: '2024-01-17',
        guests: 2,
        total_amount: '300.00',
        status: 'confirmed'
      })
      .returning()
      .execute();
    return result[0];
  };

  // Helper function to create test payment with specific date
  const createTestPayment = async (
    bookingId: number, 
    status: 'pending' | 'completed' | 'failed' | 'refunded' = 'completed',
    createdAt?: Date
  ) => {
    const result = await db.insert(paymentsTable)
      .values({
        booking_id: bookingId,
        amount: '300.00',
        payment_method: 'credit_card',
        payment_status: status,
        transaction_id: 'txn_123',
        created_at: createdAt || new Date()
      })
      .returning()
      .execute();
    return result[0];
  };

  describe('getAllUsers', () => {
    it('should return all users', async () => {
      // Create test users
      await createTestUser('guest');
      await createTestUser('admin');
      await createTestUser('superuser');

      const users = await getAllUsers();

      expect(users).toHaveLength(3);
      expect(users[0].email).toBeDefined();
      expect(users[0].first_name).toBe('John');
      expect(users[0].last_name).toBe('Doe');
      expect(['guest', 'admin', 'superuser']).toContain(users[0].role);
    });

    it('should return empty array when no users exist', async () => {
      const users = await getAllUsers();
      expect(users).toHaveLength(0);
    });
  });

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const user = await createTestUser('guest');

      const updatedUser = await updateUserRole(user.id, 'admin');

      expect(updatedUser.id).toBe(user.id);
      expect(updatedUser.role).toBe('admin');
      expect(updatedUser.updated_at).toBeInstanceOf(Date);

      // Verify in database
      const dbUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, user.id))
        .execute();

      expect(dbUser[0].role).toBe('admin');
    });

    it('should throw error for non-existent user', async () => {
      await expect(updateUserRole(999, 'admin')).rejects.toThrow(/not found/i);
    });

    it('should update to superuser role', async () => {
      const user = await createTestUser('guest');

      const updatedUser = await updateUserRole(user.id, 'superuser');

      expect(updatedUser.role).toBe('superuser');
    });
  });

  describe('getDashboardStats', () => {
    it('should return dashboard statistics', async () => {
      // Create test data
      const user = await createTestUser();
      const roomType = await createTestRoomType();
      const room1 = await createTestRoom(roomType.id);
      const room2 = await createTestRoom(roomType.id);
      
      // Make one room unavailable for occupancy calculation
      await db.update(roomsTable)
        .set({ is_available: false })
        .where(eq(roomsTable.id, room1.id))
        .execute();

      const booking = await createTestBooking(user.id, roomType.id, room1.id);
      await createTestPayment(booking.id, 'completed');
      await createTestPayment(booking.id, 'pending');

      const stats = await getDashboardStats();

      expect(stats.totalBookings).toBe(1);
      expect(stats.totalRevenue).toBe(300);
      expect(stats.occupancyRate).toBe(50); // 1 out of 2 rooms occupied
      expect(stats.pendingPayments).toBe(1);
    });

    it('should return zero stats when no data exists', async () => {
      const stats = await getDashboardStats();

      expect(stats.totalBookings).toBe(0);
      expect(stats.totalRevenue).toBe(0);
      expect(stats.occupancyRate).toBe(0);
      expect(stats.pendingPayments).toBe(0);
    });
  });

  describe('getRevenueReport', () => {
    it('should generate revenue report for date range', async () => {
      // Create test data
      const user = await createTestUser();
      const roomType1 = await createTestRoomType();
      
      // Create second room type
      const roomType2Result = await db.insert(roomTypesTable)
        .values({
          name: 'Superior Room',
          type: 'superior',
          description: 'A superior room',
          base_price: '200.00',
          max_occupancy: 3,
          amenities: ['wifi', 'tv', 'minibar'],
          image_urls: ['image2.jpg']
        })
        .returning()
        .execute();
      const roomType2 = roomType2Result[0];

      const booking1 = await createTestBooking(user.id, roomType1.id);
      const booking2 = await createTestBooking(user.id, roomType2.id);
      
      // Create payments with dates within the report range
      const paymentDate = new Date('2024-01-15');
      await createTestPayment(booking1.id, 'completed', paymentDate);
      await createTestPayment(booking2.id, 'completed', paymentDate);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await getRevenueReport(startDate, endDate);

      expect(report.totalRevenue).toBe(600);
      expect(report.bookingCount).toBe(2);
      expect(report.averageBookingValue).toBe(300);
      expect(report.revenueByRoomType).toHaveLength(2);
      
      const deluxeRevenue = report.revenueByRoomType.find(r => r.roomType === 'deluxe');
      const superiorRevenue = report.revenueByRoomType.find(r => r.roomType === 'superior');
      
      expect(deluxeRevenue?.revenue).toBe(300);
      expect(deluxeRevenue?.count).toBe(1);
      expect(superiorRevenue?.revenue).toBe(300);
      expect(superiorRevenue?.count).toBe(1);
    });

    it('should return zero values when no data in date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      const report = await getRevenueReport(startDate, endDate);

      expect(report.totalRevenue).toBe(0);
      expect(report.bookingCount).toBe(0);
      expect(report.averageBookingValue).toBe(0);
      expect(report.revenueByRoomType).toHaveLength(0);
    });

    it('should only include completed payments', async () => {
      const user = await createTestUser();
      const roomType = await createTestRoomType();
      const booking = await createTestBooking(user.id, roomType.id);
      
      // Create payments with different statuses, all within the date range
      const paymentDate = new Date('2024-01-15');
      await createTestPayment(booking.id, 'completed', paymentDate);
      await createTestPayment(booking.id, 'pending', paymentDate);
      await createTestPayment(booking.id, 'failed', paymentDate);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await getRevenueReport(startDate, endDate);

      // Only completed payment should be counted
      expect(report.totalRevenue).toBe(300);
      expect(report.bookingCount).toBe(1);
    });
  });

  describe('getOccupancyReport', () => {
    it('should generate occupancy report for date range', async () => {
      // Create test data
      const user = await createTestUser();
      const roomType1 = await createTestRoomType();
      
      // Create second room type
      const roomType2Result = await db.insert(roomTypesTable)
        .values({
          name: 'Superior Room',
          type: 'superior',
          description: 'A superior room',
          base_price: '200.00',
          max_occupancy: 3,
          amenities: ['wifi', 'tv', 'minibar'],
          image_urls: ['image2.jpg']
        })
        .returning()
        .execute();
      const roomType2 = roomType2Result[0];

      const room1 = await createTestRoom(roomType1.id);
      const room2 = await createTestRoom(roomType1.id);
      const room3 = await createTestRoom(roomType2.id);

      // Create bookings - some confirmed, some not
      await createTestBooking(user.id, roomType1.id, room1.id);
      await createTestBooking(user.id, roomType2.id, room3.id);

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await getOccupancyReport(startDate, endDate);

      expect(report.totalRooms).toBe(3);
      expect(report.occupiedRooms).toBe(2);
      expect(report.occupancyRate).toBeCloseTo(66.67, 1);
      expect(report.occupancyByRoomType).toHaveLength(2);

      const deluxeOccupancy = report.occupancyByRoomType.find(r => r.roomType === 'deluxe');
      const superiorOccupancy = report.occupancyByRoomType.find(r => r.roomType === 'superior');

      expect(deluxeOccupancy?.totalRooms).toBe(2);
      expect(deluxeOccupancy?.occupiedRooms).toBe(1);
      expect(deluxeOccupancy?.rate).toBe(50);

      expect(superiorOccupancy?.totalRooms).toBe(1);
      expect(superiorOccupancy?.occupiedRooms).toBe(1);
      expect(superiorOccupancy?.rate).toBe(100);
    });

    it('should return zero values when no rooms exist', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await getOccupancyReport(startDate, endDate);

      expect(report.totalRooms).toBe(0);
      expect(report.occupiedRooms).toBe(0);
      expect(report.occupancyRate).toBe(0);
      expect(report.occupancyByRoomType).toHaveLength(0);
    });

    it('should only count confirmed bookings', async () => {
      const user = await createTestUser();
      const roomType = await createTestRoomType();
      const room1 = await createTestRoom(roomType.id);
      const room2 = await createTestRoom(roomType.id);

      // Create confirmed booking
      await createTestBooking(user.id, roomType.id, room1.id);

      // Create cancelled booking
      const cancelledBooking = await db.insert(bookingsTable)
        .values({
          user_id: user.id,
          room_type_id: roomType.id,
          room_id: room2.id,
          check_in_date: '2024-01-15',
          check_out_date: '2024-01-17',
          guests: 2,
          total_amount: '300.00',
          status: 'cancelled'
        })
        .returning()
        .execute();

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      const report = await getOccupancyReport(startDate, endDate);

      expect(report.totalRooms).toBe(2);
      expect(report.occupiedRooms).toBe(1); // Only confirmed booking counted
      expect(report.occupancyRate).toBe(50);
    });
  });
});
