
import { db } from '../db';
import { roomTypesTable } from '../db/schema';
import { type CreateRoomTypeInput, type UpdateRoomTypeInput, type RoomType } from '../schema';
import { eq } from 'drizzle-orm';

export const createRoomType = async (input: CreateRoomTypeInput): Promise<RoomType> => {
  try {
    const result = await db.insert(roomTypesTable)
      .values({
        name: input.name,
        type: input.type,
        description: input.description,
        base_price: input.base_price.toString(),
        max_occupancy: input.max_occupancy,
        amenities: input.amenities,
        image_urls: input.image_urls,
        is_active: input.is_active ?? true
      })
      .returning()
      .execute();

    const roomType = result[0];
    return {
      ...roomType,
      base_price: parseFloat(roomType.base_price),
      amenities: roomType.amenities as string[],
      image_urls: roomType.image_urls as string[]
    };
  } catch (error) {
    console.error('Room type creation failed:', error);
    throw error;
  }
};

export const getRoomTypes = async (): Promise<RoomType[]> => {
  try {
    const results = await db.select()
      .from(roomTypesTable)
      .where(eq(roomTypesTable.is_active, true))
      .execute();

    return results.map(roomType => ({
      ...roomType,
      base_price: parseFloat(roomType.base_price),
      amenities: roomType.amenities as string[],
      image_urls: roomType.image_urls as string[]
    }));
  } catch (error) {
    console.error('Fetching room types failed:', error);
    throw error;
  }
};

export const getRoomTypeById = async (id: number): Promise<RoomType | null> => {
  try {
    const results = await db.select()
      .from(roomTypesTable)
      .where(eq(roomTypesTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const roomType = results[0];
    return {
      ...roomType,
      base_price: parseFloat(roomType.base_price),
      amenities: roomType.amenities as string[],
      image_urls: roomType.image_urls as string[]
    };
  } catch (error) {
    console.error('Fetching room type by ID failed:', error);
    throw error;
  }
};

export const updateRoomType = async (input: UpdateRoomTypeInput): Promise<RoomType> => {
  try {
    const updateData: any = {};
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.type !== undefined) updateData.type = input.type;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.base_price !== undefined) updateData.base_price = input.base_price.toString();
    if (input.max_occupancy !== undefined) updateData.max_occupancy = input.max_occupancy;
    if (input.amenities !== undefined) updateData.amenities = input.amenities;
    if (input.image_urls !== undefined) updateData.image_urls = input.image_urls;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;
    
    updateData.updated_at = new Date();

    const result = await db.update(roomTypesTable)
      .set(updateData)
      .where(eq(roomTypesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Room type not found');
    }

    const roomType = result[0];
    return {
      ...roomType,
      base_price: parseFloat(roomType.base_price),
      amenities: roomType.amenities as string[],
      image_urls: roomType.image_urls as string[]
    };
  } catch (error) {
    console.error('Room type update failed:', error);
    throw error;
  }
};

export const deleteRoomType = async (id: number): Promise<boolean> => {
  try {
    const result = await db.update(roomTypesTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(roomTypesTable.id, id))
      .returning()
      .execute();

    return result.length > 0;
  } catch (error) {
    console.error('Room type deletion failed:', error);
    throw error;
  }
};
