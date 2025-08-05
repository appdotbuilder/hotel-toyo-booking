
import { db } from '../db';
import { seasonalPricingTable, roomTypesTable } from '../db/schema';
import { type CreateSeasonalPricingInput, type SeasonalPricing } from '../schema';
import { eq, and, lte, gte } from 'drizzle-orm';

export const createSeasonalPricing = async (input: CreateSeasonalPricingInput): Promise<SeasonalPricing> => {
  try {
    // Verify room type exists
    const roomType = await db.select()
      .from(roomTypesTable)
      .where(eq(roomTypesTable.id, input.room_type_id))
      .execute();

    if (roomType.length === 0) {
      throw new Error(`Room type with id ${input.room_type_id} not found`);
    }

    // Insert seasonal pricing record
    const result = await db.insert(seasonalPricingTable)
      .values({
        room_type_id: input.room_type_id,
        season_name: input.season_name,
        price_multiplier: input.price_multiplier.toString(),
        start_date: input.start_date.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
        end_date: input.end_date.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
        is_active: input.is_active ?? true
      })
      .returning()
      .execute();

    // Convert fields back to expected types before returning
    const seasonalPricing = result[0];
    return {
      ...seasonalPricing,
      price_multiplier: parseFloat(seasonalPricing.price_multiplier),
      start_date: new Date(seasonalPricing.start_date), // Convert string back to Date
      end_date: new Date(seasonalPricing.end_date) // Convert string back to Date
    };
  } catch (error) {
    console.error('Seasonal pricing creation failed:', error);
    throw error;
  }
};

export const getSeasonalPricing = async (): Promise<SeasonalPricing[]> => {
  try {
    const results = await db.select()
      .from(seasonalPricingTable)
      .execute();

    // Convert fields back to expected types
    return results.map(pricing => ({
      ...pricing,
      price_multiplier: parseFloat(pricing.price_multiplier),
      start_date: new Date(pricing.start_date), // Convert string back to Date
      end_date: new Date(pricing.end_date) // Convert string back to Date
    }));
  } catch (error) {
    console.error('Fetching seasonal pricing failed:', error);
    throw error;
  }
};

export const getSeasonalPricingByRoomType = async (roomTypeId: number): Promise<SeasonalPricing[]> => {
  try {
    const results = await db.select()
      .from(seasonalPricingTable)
      .where(eq(seasonalPricingTable.room_type_id, roomTypeId))
      .execute();

    // Convert fields back to expected types
    return results.map(pricing => ({
      ...pricing,
      price_multiplier: parseFloat(pricing.price_multiplier),
      start_date: new Date(pricing.start_date), // Convert string back to Date
      end_date: new Date(pricing.end_date) // Convert string back to Date
    }));
  } catch (error) {
    console.error('Fetching seasonal pricing by room type failed:', error);
    throw error;
  }
};

export const getActiveSeasonalPricing = async (roomTypeId: number, date: Date): Promise<SeasonalPricing | null> => {
  try {
    const dateString = date.toISOString().split('T')[0]; // Convert Date to YYYY-MM-DD string
    
    const results = await db.select()
      .from(seasonalPricingTable)
      .where(and(
        eq(seasonalPricingTable.room_type_id, roomTypeId),
        eq(seasonalPricingTable.is_active, true),
        lte(seasonalPricingTable.start_date, dateString),
        gte(seasonalPricingTable.end_date, dateString)
      ))
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Convert fields back to expected types
    const pricing = results[0];
    return {
      ...pricing,
      price_multiplier: parseFloat(pricing.price_multiplier),
      start_date: new Date(pricing.start_date), // Convert string back to Date
      end_date: new Date(pricing.end_date) // Convert string back to Date
    };
  } catch (error) {
    console.error('Fetching active seasonal pricing failed:', error);
    throw error;
  }
};

export const updateSeasonalPricing = async (id: number, priceMultiplier: number): Promise<SeasonalPricing> => {
  try {
    const result = await db.update(seasonalPricingTable)
      .set({
        price_multiplier: priceMultiplier.toString(),
        updated_at: new Date()
      })
      .where(eq(seasonalPricingTable.id, id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Seasonal pricing with id ${id} not found`);
    }

    // Convert fields back to expected types
    const pricing = result[0];
    return {
      ...pricing,
      price_multiplier: parseFloat(pricing.price_multiplier),
      start_date: new Date(pricing.start_date), // Convert string back to Date
      end_date: new Date(pricing.end_date) // Convert string back to Date
    };
  } catch (error) {
    console.error('Updating seasonal pricing failed:', error);
    throw error;
  }
};

export const deleteSeasonalPricing = async (id: number): Promise<boolean> => {
  try {
    const result = await db.update(seasonalPricingTable)
      .set({
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(seasonalPricingTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Deleting seasonal pricing failed:', error);
    throw error;
  }
};
