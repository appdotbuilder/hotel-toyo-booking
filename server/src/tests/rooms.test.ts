
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { roomsTable, roomTypesTable } from '../db/schema';
import { type CreateRoomInput } from '../schema';
import { createRoom, getRooms, getRoomById, updateRoomAvailability } from '../handlers/rooms';
import { eq } from 'drizzle-orm';

// Test room type for foreign key reference
const testRoomType = {
  name: 'Test Room Type',
  type: 'deluxe' as const,
  description: 'A test room type',
  base_price: '199.99',
  max_occupancy: 2,
  amenities: ['wifi', 'tv'],
  image_urls: ['test.jpg'],
  is_active: true
};

// Test input for room creation
const testRoomInput: CreateRoomInput = {
  room_number: '101',
  room_type_id: 1,
  is_available: true
};

describe('createRoom', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a room', async () => {
    // Create prerequisite room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values(testRoomType)
      .returning()
      .execute();

    const input = { ...testRoomInput, room_type_id: roomTypeResult[0].id };
    const result = await createRoom(input);

    expect(result.room_number).toEqual('101');
    expect(result.room_type_id).toEqual(roomTypeResult[0].id);
    expect(result.is_available).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save room to database', async () => {
    // Create prerequisite room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values(testRoomType)
      .returning()
      .execute();

    const input = { ...testRoomInput, room_type_id: roomTypeResult[0].id };
    const result = await createRoom(input);

    const rooms = await db.select()
      .from(roomsTable)
      .where(eq(roomsTable.id, result.id))
      .execute();

    expect(rooms).toHaveLength(1);
    expect(rooms[0].room_number).toEqual('101');
    expect(rooms[0].room_type_id).toEqual(roomTypeResult[0].id);
    expect(rooms[0].is_available).toEqual(true);
  });

  it('should throw error for non-existent room type', async () => {
    const input = { ...testRoomInput, room_type_id: 999 };
    
    await expect(createRoom(input)).rejects.toThrow(/room type.*not found/i);
  });

  it('should use default availability when not specified', async () => {
    // Create prerequisite room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values(testRoomType)
      .returning()
      .execute();

    const input = {
      room_number: '102',
      room_type_id: roomTypeResult[0].id
    };
    
    const result = await createRoom(input);
    expect(result.is_available).toEqual(true);
  });
});

describe('getRooms', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no rooms exist', async () => {
    const result = await getRooms();
    expect(result).toEqual([]);
  });

  it('should return all rooms', async () => {
    // Create prerequisite room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values(testRoomType)
      .returning()
      .execute();

    // Create multiple rooms
    await db.insert(roomsTable)
      .values([
        {
          room_number: '101',
          room_type_id: roomTypeResult[0].id,
          is_available: true
        },
        {
          room_number: '102',
          room_type_id: roomTypeResult[0].id,
          is_available: false
        }
      ])
      .execute();

    const result = await getRooms();
    
    expect(result).toHaveLength(2);
    expect(result[0].room_number).toBeDefined();
    expect(result[0].room_type_id).toEqual(roomTypeResult[0].id);
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return rooms ordered by creation date descending', async () => {
    // Create prerequisite room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values(testRoomType)
      .returning()
      .execute();

    // Create rooms with slight delay to ensure different timestamps
    const room1 = await db.insert(roomsTable)
      .values({
        room_number: '101',
        room_type_id: roomTypeResult[0].id,
        is_available: true
      })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const room2 = await db.insert(roomsTable)
      .values({
        room_number: '102',
        room_type_id: roomTypeResult[0].id,
        is_available: true
      })
      .returning()
      .execute();

    const result = await getRooms();
    
    expect(result).toHaveLength(2);
    expect(result[0].created_at >= result[1].created_at).toBe(true);
  });
});

describe('getRoomById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return null for non-existent room', async () => {
    const result = await getRoomById(999);
    expect(result).toBeNull();
  });

  it('should return room by ID', async () => {
    // Create prerequisite room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values(testRoomType)
      .returning()
      .execute();

    // Create room
    const roomResult = await db.insert(roomsTable)
      .values({
        room_number: '101',
        room_type_id: roomTypeResult[0].id,
        is_available: true
      })
      .returning()
      .execute();

    const result = await getRoomById(roomResult[0].id);
    
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(roomResult[0].id);
    expect(result!.room_number).toEqual('101');
    expect(result!.room_type_id).toEqual(roomTypeResult[0].id);
    expect(result!.is_available).toEqual(true);
  });
});

describe('updateRoomAvailability', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should throw error for non-existent room', async () => {
    await expect(updateRoomAvailability(999, false)).rejects.toThrow(/room.*not found/i);
  });

  it('should update room availability', async () => {
    // Create prerequisite room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values(testRoomType)
      .returning()
      .execute();

    // Create room
    const roomResult = await db.insert(roomsTable)
      .values({
        room_number: '101',
        room_type_id: roomTypeResult[0].id,
        is_available: true
      })
      .returning()
      .execute();

    const result = await updateRoomAvailability(roomResult[0].id, false);
    
    expect(result.id).toEqual(roomResult[0].id);
    expect(result.is_available).toEqual(false);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save availability update to database', async () => {
    // Create prerequisite room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values(testRoomType)
      .returning()
      .execute();

    // Create room
    const roomResult = await db.insert(roomsTable)
      .values({
        room_number: '101',
        room_type_id: roomTypeResult[0].id,
        is_available: true
      })
      .returning()
      .execute();

    await updateRoomAvailability(roomResult[0].id, false);

    // Verify in database
    const updatedRoom = await db.select()
      .from(roomsTable)
      .where(eq(roomsTable.id, roomResult[0].id))
      .execute();

    expect(updatedRoom[0].is_available).toEqual(false);
    expect(updatedRoom[0].updated_at > roomResult[0].updated_at).toBe(true);
  });
});
