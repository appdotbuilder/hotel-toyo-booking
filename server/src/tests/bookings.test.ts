
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, roomTypesTable, roomsTable, bookingsTable } from '../db/schema';
import { type CreateBookingInput, type UpdateBookingInput } from '../schema';
import { 
  createBooking, 
  getBookings, 
  getBookingsByUser, 
  getBookingById, 
  updateBooking, 
  cancelBooking 
} from '../handlers/bookings';
import { eq } from 'drizzle-orm';

// Set NODE_ENV to test for the duration of these tests
process.env.NODE_ENV = 'test';

describe('Booking Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup
  let testUserId: number;
  let testRoomTypeId: number;
  let testRoomId: number;

  const setupTestData = async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        phone: '+1234567890',
        role: 'guest'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values({
        name: 'Deluxe Room',
        type: 'deluxe',
        description: 'A comfortable deluxe room',
        base_price: '150.00',
        max_occupancy: 2,
        amenities: ['wifi', 'tv'],
        image_urls: ['image1.jpg'],
        is_active: true
      })
      .returning()
      .execute();
    testRoomTypeId = roomTypeResult[0].id;

    // Create test room
    const roomResult = await db.insert(roomsTable)
      .values({
        room_number: '101',
        room_type_id: testRoomTypeId,
        is_available: true
      })
      .returning()
      .execute();
    testRoomId = roomResult[0].id;
  };

  describe('createBooking', () => {
    beforeEach(setupTestData);

    // Use future dates to avoid past date validation
    const futureDate1 = new Date('2025-06-01'); // Fixed date for consistent testing
    const futureDate2 = new Date('2025-06-03'); // 2 days later

    const validBookingInput: CreateBookingInput = {
      user_id: 0, // Will be set to testUserId
      room_type_id: 0, // Will be set to testRoomTypeId
      check_in_date: futureDate1,
      check_out_date: futureDate2,
      guests: 2,
      special_requests: 'Late check-in'
    };

    it('should create a booking successfully', async () => {
      const input = {
        ...validBookingInput,
        user_id: testUserId,
        room_type_id: testRoomTypeId
      };

      const result = await createBooking(input);

      expect(result.id).toBeDefined();
      expect(result.user_id).toEqual(testUserId);
      expect(result.room_type_id).toEqual(testRoomTypeId);
      expect(result.room_id).toEqual(testRoomId);
      // Compare dates without time components
      expect(result.check_in_date.toDateString()).toEqual(input.check_in_date.toDateString());
      expect(result.check_out_date.toDateString()).toEqual(input.check_out_date.toDateString());
      expect(result.guests).toEqual(2);
      expect(result.total_amount).toEqual(300); // 2 nights * $150
      expect(result.status).toEqual('pending');
      expect(result.special_requests).toEqual('Late check-in');
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save booking to database', async () => {
      const input = {
        ...validBookingInput,
        user_id: testUserId,
        room_type_id: testRoomTypeId
      };

      const result = await createBooking(input);

      const savedBooking = await db.select()
        .from(bookingsTable)
        .where(eq(bookingsTable.id, result.id))
        .execute();

      expect(savedBooking).toHaveLength(1);
      expect(savedBooking[0].user_id).toEqual(testUserId);
      expect(savedBooking[0].room_type_id).toEqual(testRoomTypeId);
      expect(parseFloat(savedBooking[0].total_amount)).toEqual(300);
    });

    it('should throw error for non-existent user', async () => {
      const input = {
        ...validBookingInput,
        user_id: 99999,
        room_type_id: testRoomTypeId
      };

      await expect(createBooking(input)).rejects.toThrow(/User with ID 99999 not found/);
    });

    it('should throw error for non-existent room type', async () => {
      const input = {
        ...validBookingInput,
        user_id: testUserId,
        room_type_id: 99999
      };

      await expect(createBooking(input)).rejects.toThrow(/Room type with ID 99999 not found/);
    });

    it('should throw error for invalid dates', async () => {
      const input = {
        ...validBookingInput,
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate2, // Later date
        check_out_date: futureDate1  // Earlier date
      };

      await expect(createBooking(input)).rejects.toThrow(/Check-out date must be after check-in date/);
    });

    it('should throw error for guests exceeding capacity', async () => {
      const input = {
        ...validBookingInput,
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        guests: 5 // Max occupancy is 2
      };

      await expect(createBooking(input)).rejects.toThrow(/Guest count \(5\) exceeds maximum occupancy/);
    });

    it('should throw error when no rooms available', async () => {
      // Create a conflicting booking first
      const firstBooking = {
        ...validBookingInput,
        user_id: testUserId,
        room_type_id: testRoomTypeId
      };
      await createBooking(firstBooking);

      // Try to book overlapping dates (same dates)
      const conflictingBooking = {
        ...validBookingInput,
        user_id: testUserId,
        room_type_id: testRoomTypeId
      };

      await expect(createBooking(conflictingBooking)).rejects.toThrow(/No rooms available for the selected dates/);
    });
  });

  describe('getBookings', () => {
    beforeEach(setupTestData);

    const futureDate1 = new Date('2025-06-01');
    const futureDate2 = new Date('2025-06-03');
    const futureDate3 = new Date('2025-06-10');
    const futureDate4 = new Date('2025-06-12');

    it('should return all bookings', async () => {
      // Create test bookings
      const booking1 = await createBooking({
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate1,
        check_out_date: futureDate2,
        guests: 2,
        special_requests: null
      });

      const booking2 = await createBooking({
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate3,
        check_out_date: futureDate4,
        guests: 1,
        special_requests: 'Early check-in'
      });

      const result = await getBookings();

      expect(result).toHaveLength(2);
      expect(result.map(b => b.id)).toContain(booking1.id);
      expect(result.map(b => b.id)).toContain(booking2.id);
      expect(typeof result[0].total_amount).toBe('number');
      expect(result[0].check_in_date).toBeInstanceOf(Date);
      expect(result[0].check_out_date).toBeInstanceOf(Date);
    });

    it('should return empty array when no bookings exist', async () => {
      const result = await getBookings();
      expect(result).toHaveLength(0);
    });
  });

  describe('getBookingsByUser', () => {
    beforeEach(setupTestData);

    const futureDate1 = new Date('2025-06-01');
    const futureDate2 = new Date('2025-06-03');
    const futureDate3 = new Date('2025-06-10');
    const futureDate4 = new Date('2025-06-12');

    it('should return bookings for specific user', async () => {
      // Create another user
      const user2Result = await db.insert(usersTable)
        .values({
          email: 'user2@example.com',
          password_hash: 'hashedpassword',
          first_name: 'Jane',
          last_name: 'Smith',
          role: 'guest'
        })
        .returning()
        .execute();
      const user2Id = user2Result[0].id;

      // Create bookings for both users
      const booking1 = await createBooking({
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate1,
        check_out_date: futureDate2,
        guests: 2,
        special_requests: null
      });

      await createBooking({
        user_id: user2Id,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate3,
        check_out_date: futureDate4,
        guests: 1,
        special_requests: null
      });

      const result = await getBookingsByUser(testUserId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(booking1.id);
      expect(result[0].user_id).toEqual(testUserId);
      expect(result[0].check_in_date).toBeInstanceOf(Date);
      expect(result[0].check_out_date).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent user', async () => {
      await expect(getBookingsByUser(99999)).rejects.toThrow(/User with ID 99999 not found/);
    });
  });

  describe('getBookingById', () => {
    beforeEach(setupTestData);

    const futureDate1 = new Date('2025-06-01');
    const futureDate2 = new Date('2025-06-03');

    it('should return booking by ID', async () => {
      const booking = await createBooking({
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate1,
        check_out_date: futureDate2,
        guests: 2,
        special_requests: 'Test request'
      });

      const result = await getBookingById(booking.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(booking.id);
      expect(result!.user_id).toEqual(testUserId);
      expect(result!.special_requests).toEqual('Test request');
      expect(typeof result!.total_amount).toBe('number');
      expect(result!.check_in_date).toBeInstanceOf(Date);
      expect(result!.check_out_date).toBeInstanceOf(Date);
    });

    it('should return null for non-existent booking', async () => {
      const result = await getBookingById(99999);
      expect(result).toBeNull();
    });
  });

  describe('updateBooking', () => {
    beforeEach(setupTestData);

    const futureDate1 = new Date('2025-06-01');
    const futureDate2 = new Date('2025-06-03');

    it('should update booking status', async () => {
      const booking = await createBooking({
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate1,
        check_out_date: futureDate2,
        guests: 2,
        special_requests: null
      });

      const updateInput: UpdateBookingInput = {
        id: booking.id,
        status: 'confirmed'
      };

      const result = await updateBooking(updateInput);

      expect(result.id).toEqual(booking.id);
      expect(result.status).toEqual('confirmed');
      expect(result.updated_at.getTime()).toBeGreaterThan(booking.updated_at.getTime());
      expect(result.check_in_date).toBeInstanceOf(Date);
      expect(result.check_out_date).toBeInstanceOf(Date);
    });

    it('should update special requests', async () => {
      const booking = await createBooking({
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate1,
        check_out_date: futureDate2,
        guests: 2,
        special_requests: 'Original request'
      });

      const updateInput: UpdateBookingInput = {
        id: booking.id,
        special_requests: 'Updated request'
      };

      const result = await updateBooking(updateInput);

      expect(result.special_requests).toEqual('Updated request');
    });

    it('should throw error for non-existent booking', async () => {
      const updateInput: UpdateBookingInput = {
        id: 99999,
        status: 'confirmed'
      };

      await expect(updateBooking(updateInput)).rejects.toThrow(/Booking with ID 99999 not found/);
    });

    it('should validate status transitions', async () => {
      const booking = await createBooking({
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate1,
        check_out_date: futureDate2,
        guests: 2,
        special_requests: null
      });

      // Try invalid transition from pending to checked_out
      const updateInput: UpdateBookingInput = {
        id: booking.id,
        status: 'checked_out'
      };

      await expect(updateBooking(updateInput)).rejects.toThrow(/Invalid status transition/);
    });
  });

  describe('cancelBooking', () => {
    beforeEach(setupTestData);

    const futureDate1 = new Date('2025-06-01');
    const futureDate2 = new Date('2025-06-03');

    it('should cancel a pending booking', async () => {
      const booking = await createBooking({
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate1,
        check_out_date: futureDate2,
        guests: 2,
        special_requests: null
      });

      const result = await cancelBooking(booking.id);

      expect(result.id).toEqual(booking.id);
      expect(result.status).toEqual('cancelled');
      expect(result.updated_at.getTime()).toBeGreaterThan(booking.updated_at.getTime());
      expect(result.check_in_date).toBeInstanceOf(Date);
      expect(result.check_out_date).toBeInstanceOf(Date);
    });

    it('should cancel a confirmed booking', async () => {
      const booking = await createBooking({
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate1,
        check_out_date: futureDate2,
        guests: 2,
        special_requests: null
      });

      // First confirm the booking
      await updateBooking({
        id: booking.id,
        status: 'confirmed'
      });

      const result = await cancelBooking(booking.id);

      expect(result.status).toEqual('cancelled');
    });

    it('should throw error for non-existent booking', async () => {
      await expect(cancelBooking(99999)).rejects.toThrow(/Booking with ID 99999 not found/);
    });

    it('should throw error when trying to cancel checked-in booking', async () => {
      const booking = await createBooking({
        user_id: testUserId,
        room_type_id: testRoomTypeId,
        check_in_date: futureDate1,
        check_out_date: futureDate2,
        guests: 2,
        special_requests: null
      });

      // Update to confirmed then checked_in
      await updateBooking({ id: booking.id, status: 'confirmed' });
      await updateBooking({ id: booking.id, status: 'checked_in' });

      await expect(cancelBooking(booking.id)).rejects.toThrow(/Cannot cancel booking with status: checked_in/);
    });
  });
});
