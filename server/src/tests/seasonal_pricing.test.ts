
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { seasonalPricingTable, roomTypesTable } from '../db/schema';
import { type CreateSeasonalPricingInput } from '../schema';
import {
  createSeasonalPricing,
  getSeasonalPricing,
  getSeasonalPricingByRoomType,
  getActiveSeasonalPricing,
  updateSeasonalPricing,
  deleteSeasonalPricing
} from '../handlers/seasonal_pricing';
import { eq } from 'drizzle-orm';

// Test room type for foreign key reference
const testRoomType = {
  name: 'Test Room Type',
  type: 'deluxe' as const,
  description: 'A room type for testing',
  base_price: 100.00,
  max_occupancy: 2,
  amenities: ['wifi', 'tv'],
  image_urls: ['image1.jpg'],
  is_active: true
};

// Test seasonal pricing input
const testInput: CreateSeasonalPricingInput = {
  room_type_id: 1, // Will be set after creating room type
  season_name: 'High Season',
  price_multiplier: 1.5,
  start_date: new Date('2024-06-01'),
  end_date: new Date('2024-08-31'),
  is_active: true
};

describe('createSeasonalPricing', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create seasonal pricing', async () => {
    // Create room type first
    const roomTypeResult = await db.insert(roomTypesTable)
      .values({
        ...testRoomType,
        base_price: testRoomType.base_price.toString(),
        amenities: JSON.stringify(testRoomType.amenities),
        image_urls: JSON.stringify(testRoomType.image_urls)
      })
      .returning()
      .execute();

    const input = { ...testInput, room_type_id: roomTypeResult[0].id };
    const result = await createSeasonalPricing(input);

    expect(result.room_type_id).toEqual(roomTypeResult[0].id);
    expect(result.season_name).toEqual('High Season');
    expect(result.price_multiplier).toEqual(1.5);
    expect(typeof result.price_multiplier).toBe('number');
    expect(result.start_date).toEqual(new Date('2024-06-01'));
    expect(result.end_date).toEqual(new Date('2024-08-31'));
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save seasonal pricing to database', async () => {
    // Create room type first
    const roomTypeResult = await db.insert(roomTypesTable)
      .values({
        ...testRoomType,
        base_price: testRoomType.base_price.toString(),
        amenities: JSON.stringify(testRoomType.amenities),
        image_urls: JSON.stringify(testRoomType.image_urls)
      })
      .returning()
      .execute();

    const input = { ...testInput, room_type_id: roomTypeResult[0].id };
    const result = await createSeasonalPricing(input);

    const savedPricing = await db.select()
      .from(seasonalPricingTable)
      .where(eq(seasonalPricingTable.id, result.id))
      .execute();

    expect(savedPricing).toHaveLength(1);
    expect(savedPricing[0].season_name).toEqual('High Season');
    expect(parseFloat(savedPricing[0].price_multiplier)).toEqual(1.5);
    expect(savedPricing[0].start_date).toEqual('2024-06-01'); // Date stored as string
    expect(savedPricing[0].end_date).toEqual('2024-08-31'); // Date stored as string
    expect(savedPricing[0].is_active).toBe(true);
  });

  it('should throw error for non-existent room type', async () => {
    const input = { ...testInput, room_type_id: 999 };
    
    await expect(createSeasonalPricing(input)).rejects.toThrow(/Room type with id 999 not found/i);
  });
});

describe('getSeasonalPricing', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all seasonal pricing', async () => {
    // Create room type first
    const roomTypeResult = await db.insert(roomTypesTable)
      .values({
        ...testRoomType,
        base_price: testRoomType.base_price.toString(),
        amenities: JSON.stringify(testRoomType.amenities),
        image_urls: JSON.stringify(testRoomType.image_urls)
      })
      .returning()
      .execute();

    // Create multiple seasonal pricing records
    const input1 = { ...testInput, room_type_id: roomTypeResult[0].id, season_name: 'High Season' };
    const input2 = { ...testInput, room_type_id: roomTypeResult[0].id, season_name: 'Low Season', price_multiplier: 0.8 };

    await createSeasonalPricing(input1);
    await createSeasonalPricing(input2);

    const results = await getSeasonalPricing();

    expect(results).toHaveLength(2);
    expect(results[0].price_multiplier).toEqual(1.5);
    expect(typeof results[0].price_multiplier).toBe('number');
    expect(results[1].price_multiplier).toEqual(0.8);
    expect(typeof results[1].price_multiplier).toBe('number');
    expect(results[0].start_date).toBeInstanceOf(Date);
    expect(results[0].end_date).toBeInstanceOf(Date);
  });

  it('should return empty array when no seasonal pricing exists', async () => {
    const results = await getSeasonalPricing();
    expect(results).toHaveLength(0);
  });
});

describe('getSeasonalPricingByRoomType', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return seasonal pricing for specific room type', async () => {
    // Create two room types
    const roomType1 = await db.insert(roomTypesTable)
      .values({
        ...testRoomType,
        name: 'Room Type 1',
        base_price: testRoomType.base_price.toString(),
        amenities: JSON.stringify(testRoomType.amenities),
        image_urls: JSON.stringify(testRoomType.image_urls)
      })
      .returning()
      .execute();

    const roomType2 = await db.insert(roomTypesTable)
      .values({
        ...testRoomType,
        name: 'Room Type 2',
        base_price: testRoomType.base_price.toString(),
        amenities: JSON.stringify(testRoomType.amenities),
        image_urls: JSON.stringify(testRoomType.image_urls)
      })
      .returning()
      .execute();

    // Create seasonal pricing for both room types
    await createSeasonalPricing({ ...testInput, room_type_id: roomType1[0].id });
    await createSeasonalPricing({ ...testInput, room_type_id: roomType2[0].id, season_name: 'Different Season' });

    const results = await getSeasonalPricingByRoomType(roomType1[0].id);

    expect(results).toHaveLength(1);
    expect(results[0].room_type_id).toEqual(roomType1[0].id);
    expect(results[0].season_name).toEqual('High Season');
    expect(results[0].price_multiplier).toEqual(1.5);
    expect(typeof results[0].price_multiplier).toBe('number');
    expect(results[0].start_date).toBeInstanceOf(Date);
    expect(results[0].end_date).toBeInstanceOf(Date);
  });

  it('should return empty array for room type with no seasonal pricing', async () => {
    const results = await getSeasonalPricingByRoomType(999);
    expect(results).toHaveLength(0);
  });
});

describe('getActiveSeasonalPricing', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return active seasonal pricing for date within range', async () => {
    // Create room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values({
        ...testRoomType,
        base_price: testRoomType.base_price.toString(),
        amenities: JSON.stringify(testRoomType.amenities),
        image_urls: JSON.stringify(testRoomType.image_urls)
      })
      .returning()
      .execute();

    await createSeasonalPricing({ ...testInput, room_type_id: roomTypeResult[0].id });

    // Test date within range
    const testDate = new Date('2024-07-15');
    const result = await getActiveSeasonalPricing(roomTypeResult[0].id, testDate);

    expect(result).not.toBeNull();
    expect(result!.season_name).toEqual('High Season');
    expect(result!.price_multiplier).toEqual(1.5);
    expect(typeof result!.price_multiplier).toBe('number');
    expect(result!.is_active).toBe(true);
    expect(result!.start_date).toBeInstanceOf(Date);
    expect(result!.end_date).toBeInstanceOf(Date);
  });

  it('should return null for date outside range', async () => {
    // Create room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values({
        ...testRoomType,
        base_price: testRoomType.base_price.toString(),
        amenities: JSON.stringify(testRoomType.amenities),
        image_urls: JSON.stringify(testRoomType.image_urls)
      })
      .returning()
      .execute();

    await createSeasonalPricing({ ...testInput, room_type_id: roomTypeResult[0].id });

    // Test date outside range
    const testDate = new Date('2024-12-15');
    const result = await getActiveSeasonalPricing(roomTypeResult[0].id, testDate);

    expect(result).toBeNull();
  });

  it('should return null for inactive seasonal pricing', async () => {
    // Create room type
    const roomTypeResult = await db.insert(roomTypesTable)
      .values({
        ...testRoomType,
        base_price: testRoomType.base_price.toString(),
        amenities: JSON.stringify(testRoomType.amenities),
        image_urls: JSON.stringify(testRoomType.image_urls)
      })
      .returning()
      .execute();

    await createSeasonalPricing({ ...testInput, room_type_id: roomTypeResult[0].id, is_active: false });

    // Test date within range but pricing is inactive
    const testDate = new Date('2024-07-15');
    const result = await getActiveSeasonalPricing(roomTypeResult[0].id, testDate);

    expect(result).toBeNull();
  });
});

describe('updateSeasonalPricing', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update seasonal pricing multiplier', async () => {
    // Create room type and seasonal pricing
    const roomTypeResult = await db.insert(roomTypesTable)
      .values({
        ...testRoomType,
        base_price: testRoomType.base_price.toString(),
        amenities: JSON.stringify(testRoomType.amenities),
        image_urls: JSON.stringify(testRoomType.image_urls)
      })
      .returning()
      .execute();

    const created = await createSeasonalPricing({ ...testInput, room_type_id: roomTypeResult[0].id });

    const result = await updateSeasonalPricing(created.id, 2.0);

    expect(result.id).toEqual(created.id);
    expect(result.price_multiplier).toEqual(2.0);
    expect(typeof result.price_multiplier).toBe('number');
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.start_date).toBeInstanceOf(Date);
    expect(result.end_date).toBeInstanceOf(Date);
  });

  it('should throw error for non-existent seasonal pricing', async () => {
    await expect(updateSeasonalPricing(999, 2.0)).rejects.toThrow(/Seasonal pricing with id 999 not found/i);
  });
});

describe('deleteSeasonalPricing', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should soft delete seasonal pricing', async () => {
    // Create room type and seasonal pricing
    const roomTypeResult = await db.insert(roomTypesTable)
      .values({
        ...testRoomType,
        base_price: testRoomType.base_price.toString(),
        amenities: JSON.stringify(testRoomType.amenities),
        image_urls: JSON.stringify(testRoomType.image_urls)
      })
      .returning()
      .execute();

    const created = await createSeasonalPricing({ ...testInput, room_type_id: roomTypeResult[0].id });

    const result = await deleteSeasonalPricing(created.id);

    expect(result).toBe(true);

    // Verify record is soft deleted
    const deleted = await db.select()
      .from(seasonalPricingTable)
      .where(eq(seasonalPricingTable.id, created.id))
      .execute();

    expect(deleted).toHaveLength(1);
    expect(deleted[0].is_active).toBe(false);
  });

  it('should return false for non-existent seasonal pricing', async () => {
    const result = await deleteSeasonalPricing(999);
    expect(result).toBe(false);
  });
});
