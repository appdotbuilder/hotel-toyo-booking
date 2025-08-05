
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { roomTypesTable } from '../db/schema';
import { type CreateRoomTypeInput, type UpdateRoomTypeInput } from '../schema';
import { 
  createRoomType, 
  getRoomTypes, 
  getRoomTypeById, 
  updateRoomType, 
  deleteRoomType 
} from '../handlers/room_types';
import { eq } from 'drizzle-orm';

const testInput: CreateRoomTypeInput = {
  name: 'Luxury Suite',
  type: 'deluxe',
  description: 'A beautiful luxury suite with ocean view',
  base_price: 299.99,
  max_occupancy: 4,
  amenities: ['WiFi', 'Air Conditioning', 'Ocean View', 'Mini Bar'],
  image_urls: ['https://example.com/room1.jpg', 'https://example.com/room2.jpg'],
  is_active: true
};

describe('Room Types Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createRoomType', () => {
    it('should create a room type successfully', async () => {
      const result = await createRoomType(testInput);

      expect(result.name).toEqual('Luxury Suite');
      expect(result.type).toEqual('deluxe');
      expect(result.description).toEqual('A beautiful luxury suite with ocean view');
      expect(result.base_price).toEqual(299.99);
      expect(typeof result.base_price).toBe('number');
      expect(result.max_occupancy).toEqual(4);
      expect(result.amenities).toEqual(['WiFi', 'Air Conditioning', 'Ocean View', 'Mini Bar']);
      expect(result.image_urls).toEqual(['https://example.com/room1.jpg', 'https://example.com/room2.jpg']);
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save room type to database', async () => {
      const result = await createRoomType(testInput);

      const roomTypes = await db.select()
        .from(roomTypesTable)
        .where(eq(roomTypesTable.id, result.id))
        .execute();

      expect(roomTypes).toHaveLength(1);
      expect(roomTypes[0].name).toEqual('Luxury Suite');
      expect(parseFloat(roomTypes[0].base_price)).toEqual(299.99);
      expect(roomTypes[0].amenities).toEqual(['WiFi', 'Air Conditioning', 'Ocean View', 'Mini Bar']);
    });

    it('should use default is_active when not provided', async () => {
      const inputWithoutActive = { ...testInput };
      delete inputWithoutActive.is_active;

      const result = await createRoomType(inputWithoutActive);
      expect(result.is_active).toBe(true);
    });
  });

  describe('getRoomTypes', () => {
    it('should return empty array when no room types exist', async () => {
      const result = await getRoomTypes();
      expect(result).toEqual([]);
    });

    it('should return all active room types', async () => {
      await createRoomType(testInput);
      await createRoomType({
        ...testInput,
        name: 'Standard Room',
        type: 'superior',
        base_price: 150.00
      });

      const result = await getRoomTypes();
      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Luxury Suite');
      expect(result[1].name).toEqual('Standard Room');
      expect(typeof result[0].base_price).toBe('number');
      expect(typeof result[1].base_price).toBe('number');
    });

    it('should not return inactive room types', async () => {
      const activeRoom = await createRoomType(testInput);
      await createRoomType({
        ...testInput,
        name: 'Inactive Room',
        is_active: false
      });

      const result = await getRoomTypes();
      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(activeRoom.id);
    });
  });

  describe('getRoomTypeById', () => {
    it('should return null when room type does not exist', async () => {
      const result = await getRoomTypeById(999);
      expect(result).toBeNull();
    });

    it('should return room type when it exists', async () => {
      const created = await createRoomType(testInput);
      const result = await getRoomTypeById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Luxury Suite');
      expect(result!.base_price).toEqual(299.99);
      expect(typeof result!.base_price).toBe('number');
      expect(result!.amenities).toEqual(['WiFi', 'Air Conditioning', 'Ocean View', 'Mini Bar']);
    });

    it('should return inactive room types by ID', async () => {
      const created = await createRoomType({ ...testInput, is_active: false });
      const result = await getRoomTypeById(created.id);

      expect(result).not.toBeNull();
      expect(result!.is_active).toBe(false);
    });
  });

  describe('updateRoomType', () => {
    it('should update room type successfully', async () => {
      const created = await createRoomType(testInput);
      
      const updateInput: UpdateRoomTypeInput = {
        id: created.id,
        name: 'Updated Luxury Suite',
        base_price: 349.99,
        amenities: ['WiFi', 'Air Conditioning', 'Balcony']
      };

      const result = await updateRoomType(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('Updated Luxury Suite');
      expect(result.type).toEqual('deluxe'); // unchanged
      expect(result.base_price).toEqual(349.99);
      expect(typeof result.base_price).toBe('number');
      expect(result.amenities).toEqual(['WiFi', 'Air Conditioning', 'Balcony']);
      expect(result.updated_at.getTime()).toBeGreaterThan(created.updated_at.getTime());
    });

    it('should throw error when room type does not exist', async () => {
      const updateInput: UpdateRoomTypeInput = {
        id: 999,
        name: 'Non-existent Room'
      };

      await expect(updateRoomType(updateInput)).rejects.toThrow(/room type not found/i);
    });

    it('should update only provided fields', async () => {
      const created = await createRoomType(testInput);
      
      const updateInput: UpdateRoomTypeInput = {
        id: created.id,
        name: 'Partially Updated'
      };

      const result = await updateRoomType(updateInput);

      expect(result.name).toEqual('Partially Updated');
      expect(result.type).toEqual(created.type);
      expect(result.base_price).toEqual(created.base_price);
      expect(result.amenities).toEqual(created.amenities);
    });
  });

  describe('deleteRoomType', () => {
    it('should soft delete room type successfully', async () => {
      const created = await createRoomType(testInput);
      
      const result = await deleteRoomType(created.id);
      expect(result).toBe(true);

      // Verify it's soft deleted
      const roomType = await getRoomTypeById(created.id);
      expect(roomType).not.toBeNull();
      expect(roomType!.is_active).toBe(false);

      // Verify it doesn't appear in active list
      const activeRoomTypes = await getRoomTypes();
      expect(activeRoomTypes).toHaveLength(0);
    });

    it('should return false when room type does not exist', async () => {
      const result = await deleteRoomType(999);
      expect(result).toBe(false);
    });

    it('should update the updated_at timestamp', async () => {
      const created = await createRoomType(testInput);
      const originalUpdatedAt = created.updated_at;

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await deleteRoomType(created.id);

      const deleted = await getRoomTypeById(created.id);
      expect(deleted!.updated_at.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
    });
  });
});
