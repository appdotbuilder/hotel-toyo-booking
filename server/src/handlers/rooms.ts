
import { db } from '../db';
import { roomsTable, roomTypesTable } from '../db/schema';
import { type CreateRoomInput, type Room } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const createRoom = async (input: CreateRoomInput): Promise<Room> => {
  try {
    // Verify room type exists
    const roomType = await db.select()
      .from(roomTypesTable)
      .where(eq(roomTypesTable.id, input.room_type_id))
      .execute();

    if (roomType.length === 0) {
      throw new Error(`Room type with ID ${input.room_type_id} not found`);
    }

    // Insert room record
    const result = await db.insert(roomsTable)
      .values({
        room_number: input.room_number,
        room_type_id: input.room_type_id,
        is_available: input.is_available ?? true
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Room creation failed:', error);
    throw error;
  }
};

export const getRooms = async (): Promise<Room[]> => {
  try {
    const results = await db.select()
      .from(roomsTable)
      .orderBy(desc(roomsTable.created_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    throw error;
  }
};

export const getRoomById = async (id: number): Promise<Room | null> => {
  try {
    const results = await db.select()
      .from(roomsTable)
      .where(eq(roomsTable.id, id))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch room by ID:', error);
    throw error;
  }
};

export const updateRoomAvailability = async (id: number, isAvailable: boolean): Promise<Room> => {
  try {
    // Verify room exists
    const existingRoom = await getRoomById(id);
    if (!existingRoom) {
      throw new Error(`Room with ID ${id} not found`);
    }

    // Update room availability
    const result = await db.update(roomsTable)
      .set({ 
        is_available: isAvailable,
        updated_at: new Date()
      })
      .where(eq(roomsTable.id, id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Room availability update failed:', error);
    throw error;
  }
};
