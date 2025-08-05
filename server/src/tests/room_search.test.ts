
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { roomTypesTable, roomsTable, bookingsTable, seasonalPricingTable, usersTable } from '../db/schema';
import { type SearchRoomsInput } from '../schema';
import { searchAvailableRooms, checkRoomAvailability, calculateRoomPrice } from '../handlers/room_search';

describe('Room Search Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('searchAvailableRooms', () => {
    it('should find available rooms for given dates and guest count', async () => {
      // Create test room type
      const roomType = await db.insert(roomTypesTable)
        .values({
          name: 'Deluxe Room',
          type: 'deluxe',
          description: 'A luxurious room',
          base_price: '150.00',
          max_occupancy: 2,
          amenities: JSON.stringify(['wifi', 'tv']),
          image_urls: JSON.stringify(['image1.jpg']),
          is_active: true
        })
        .returning()
        .execute();

      // Create rooms of this type
      await db.insert(roomsTable)
        .values([
          { room_number: '101', room_type_id: roomType[0].id, is_available: true },
          { room_number: '102', room_type_id: roomType[0].id, is_available: true }
        ])
        .execute();

      const searchInput: SearchRoomsInput = {
        check_in_date: new Date('2024-03-01'),
        check_out_date: new Date('2024-03-03'),
        guests: 2
      };

      const results = await searchAvailableRooms(searchInput);

      expect(results).toHaveLength(1);
      expect(results[0].name).toEqual('Deluxe Room');
      expect(results[0].type).toEqual('deluxe');
      expect(results[0].max_occupancy).toEqual(2);
      expect(typeof results[0].base_price).toBe('number');
      expect(results[0].base_price).toEqual(150);
      expect(Array.isArray(results[0].amenities)).toBe(true);
      expect(Array.isArray(results[0].image_urls)).toBe(true);
    });

    it('should filter by room type when specified', async () => {
      // Create multiple room types
      const roomTypes = await db.insert(roomTypesTable)
        .values([
          {
            name: 'Deluxe Room',
            type: 'deluxe',
            description: 'A deluxe room',
            base_price: '150.00',
            max_occupancy: 2,
            amenities: JSON.stringify(['wifi']),
            image_urls: JSON.stringify(['image1.jpg']),
            is_active: true
          },
          {
            name: 'Superior Room',
            type: 'superior',
            description: 'A superior room',
            base_price: '200.00',
            max_occupancy: 3,
            amenities: JSON.stringify(['wifi', 'balcony']),
            image_urls: JSON.stringify(['image2.jpg']),
            is_active: true
          }
        ])
        .returning()
        .execute();

      // Create rooms for both types
      await db.insert(roomsTable)
        .values([
          { room_number: '101', room_type_id: roomTypes[0].id, is_available: true },
          { room_number: '201', room_type_id: roomTypes[1].id, is_available: true }
        ])
        .execute();

      const searchInput: SearchRoomsInput = {
        check_in_date: new Date('2024-03-01'),
        check_out_date: new Date('2024-03-03'),
        guests: 2,
        room_type: 'superior'
      };

      const results = await searchAvailableRooms(searchInput);

      expect(results).toHaveLength(1);
      expect(results[0].type).toEqual('superior');
      expect(results[0].name).toEqual('Superior Room');
    });

    it('should exclude rooms with insufficient capacity', async () => {
      // Create room type with max occupancy 1
      await db.insert(roomTypesTable)
        .values({
          name: 'Single Room',
          type: 'deluxe',
          description: 'A single room',
          base_price: '100.00',
          max_occupancy: 1,
          amenities: JSON.stringify(['wifi']),
          image_urls: JSON.stringify(['image1.jpg']),
          is_active: true
        })
        .execute();

      const searchInput: SearchRoomsInput = {
        check_in_date: new Date('2024-03-01'),
        check_out_date: new Date('2024-03-03'),
        guests: 2 // More guests than max occupancy
      };

      const results = await searchAvailableRooms(searchInput);

      expect(results).toHaveLength(0);
    });

    it('should exclude inactive room types', async () => {
      await db.insert(roomTypesTable)
        .values({
          name: 'Inactive Room',
          type: 'deluxe',
          description: 'An inactive room',
          base_price: '150.00',
          max_occupancy: 2,
          amenities: JSON.stringify(['wifi']),
          image_urls: JSON.stringify(['image1.jpg']),
          is_active: false
        })
        .execute();

      const searchInput: SearchRoomsInput = {
        check_in_date: new Date('2024-03-01'),
        check_out_date: new Date('2024-03-03'),
        guests: 2
      };

      const results = await searchAvailableRooms(searchInput);

      expect(results).toHaveLength(0);
    });
  });

  describe('checkRoomAvailability', () => {
    it('should return true when rooms are available', async () => {
      // Create room type and rooms
      const roomType = await db.insert(roomTypesTable)
        .values({
          name: 'Test Room',
          type: 'deluxe',
          description: 'A test room',
          base_price: '150.00',
          max_occupancy: 2,
          amenities: JSON.stringify(['wifi']),
          image_urls: JSON.stringify(['image1.jpg']),
          is_active: true
        })
        .returning()
        .execute();

      await db.insert(roomsTable)
        .values({
          room_number: '101',
          room_type_id: roomType[0].id,
          is_available: true
        })
        .execute();

      const isAvailable = await checkRoomAvailability(
        roomType[0].id,
        new Date('2024-03-01'),
        new Date('2024-03-03')
      );

      expect(isAvailable).toBe(true);
    });

    it('should return false when no rooms exist', async () => {
      const isAvailable = await checkRoomAvailability(
        999, // Non-existent room type
        new Date('2024-03-01'),
        new Date('2024-03-03')
      );

      expect(isAvailable).toBe(false);
    });

    it('should return false when all rooms are booked', async () => {
      // Create user first
      const user = await db.insert(usersTable)
        .values({
          email: 'test@example.com',
          password_hash: 'hashedpassword',
          first_name: 'Test',
          last_name: 'User',
          phone: null,
          role: 'guest'
        })
        .returning()
        .execute();

      // Create room type and one room
      const roomType = await db.insert(roomTypesTable)
        .values({
          name: 'Test Room',
          type: 'deluxe',
          description: 'A test room',
          base_price: '150.00',
          max_occupancy: 2,
          amenities: JSON.stringify(['wifi']),
          image_urls: JSON.stringify(['image1.jpg']),
          is_active: true
        })
        .returning()
        .execute();

      await db.insert(roomsTable)
        .values({
          room_number: '101',
          room_type_id: roomType[0].id,
          is_available: true
        })
        .execute();

      // Create overlapping booking
      await db.insert(bookingsTable)
        .values({
          user_id: user[0].id,
          room_type_id: roomType[0].id,
          room_id: null,
          check_in_date: '2024-03-01',
          check_out_date: '2024-03-04',
          guests: 2,
          total_amount: '300.00',
          status: 'confirmed',
          special_requests: null
        })
        .execute();

      const isAvailable = await checkRoomAvailability(
        roomType[0].id,
        new Date('2024-03-02'), // Overlaps with existing booking
        new Date('2024-03-05')
      );

      expect(isAvailable).toBe(false);
    });

    it('should ignore cancelled bookings', async () => {
      // Create user and room setup
      const user = await db.insert(usersTable)
        .values({
          email: 'test@example.com',
          password_hash: 'hashedpassword',
          first_name: 'Test',
          last_name: 'User',
          phone: null,
          role: 'guest'
        })
        .returning()
        .execute();

      const roomType = await db.insert(roomTypesTable)
        .values({
          name: 'Test Room',
          type: 'deluxe',
          description: 'A test room',
          base_price: '150.00',
          max_occupancy: 2,
          amenities: JSON.stringify(['wifi']),
          image_urls: JSON.stringify(['image1.jpg']),
          is_active: true
        })
        .returning()
        .execute();

      await db.insert(roomsTable)
        .values({
          room_number: '101',
          room_type_id: roomType[0].id,
          is_available: true
        })
        .execute();

      // Create cancelled booking
      await db.insert(bookingsTable)
        .values({
          user_id: user[0].id,
          room_type_id: roomType[0].id,
          room_id: null,
          check_in_date: '2024-03-01',
          check_out_date: '2024-03-04',
          guests: 2,
          total_amount: '300.00',
          status: 'cancelled', // Cancelled booking should not block availability
          special_requests: null
        })
        .execute();

      const isAvailable = await checkRoomAvailability(
        roomType[0].id,
        new Date('2024-03-02'),
        new Date('2024-03-05')
      );

      expect(isAvailable).toBe(true);
    });
  });

  describe('calculateRoomPrice', () => {
    it('should calculate basic price without seasonal pricing', async () => {
      const roomType = await db.insert(roomTypesTable)
        .values({
          name: 'Test Room',
          type: 'deluxe',
          description: 'A test room',
          base_price: '100.00',
          max_occupancy: 2,
          amenities: JSON.stringify(['wifi']),
          image_urls: JSON.stringify(['image1.jpg']),
          is_active: true
        })
        .returning()
        .execute();

      const price = await calculateRoomPrice(
        roomType[0].id,
        new Date('2024-03-01'),
        new Date('2024-03-03') // 2 nights
      );

      expect(price).toEqual(200); // 100 * 2 nights
    });

    it('should apply seasonal pricing multiplier', async () => {
      const roomType = await db.insert(roomTypesTable)
        .values({
          name: 'Test Room',
          type: 'deluxe',
          description: 'A test room',
          base_price: '100.00',
          max_occupancy: 2,
          amenities: JSON.stringify(['wifi']),
          image_urls: JSON.stringify(['image1.jpg']),
          is_active: true
        })
        .returning()
        .execute();

      // Create seasonal pricing with 1.5x multiplier
      await db.insert(seasonalPricingTable)
        .values({
          room_type_id: roomType[0].id,
          season_name: 'Peak Season',
          price_multiplier: '1.50',
          start_date: '2024-03-01',
          end_date: '2024-03-31',
          is_active: true
        })
        .execute();

      const price = await calculateRoomPrice(
        roomType[0].id,
        new Date('2024-03-01'),
        new Date('2024-03-03') // 2 nights in peak season
      );

      expect(price).toEqual(300); // 100 * 1.5 * 2 nights
    });

    it('should throw error for non-existent room type', async () => {
      await expect(calculateRoomPrice(
        999, // Non-existent room type
        new Date('2024-03-01'),
        new Date('2024-03-03')
      )).rejects.toThrow(/Room type with id 999 not found/i);
    });

    it('should throw error for invalid date range', async () => {
      const roomType = await db.insert(roomTypesTable)
        .values({
          name: 'Test Room',
          type: 'deluxe',
          description: 'A test room',
          base_price: '100.00',
          max_occupancy: 2,
          amenities: JSON.stringify(['wifi']),
          image_urls: JSON.stringify(['image1.jpg']),
          is_active: true
        })
        .returning()
        .execute();

      await expect(calculateRoomPrice(
        roomType[0].id,
        new Date('2024-03-03'),
        new Date('2024-03-01') // Check-out before check-in
      )).rejects.toThrow(/Check-out date must be after check-in date/i);
    });
  });
});
