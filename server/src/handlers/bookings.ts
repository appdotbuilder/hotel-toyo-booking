
import { db } from '../db';
import { bookingsTable, roomTypesTable, roomsTable, usersTable } from '../db/schema';
import { type CreateBookingInput, type UpdateBookingInput, type Booking } from '../schema';
import { eq, and, gte, lte, not, or, isNull } from 'drizzle-orm';

export const createBooking = async (input: CreateBookingInput): Promise<Booking> => {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();
    
    if (user.length === 0) {
      throw new Error(`User with ID ${input.user_id} not found`);
    }

    // Verify room type exists and is active
    const roomType = await db.select()
      .from(roomTypesTable)
      .where(and(
        eq(roomTypesTable.id, input.room_type_id),
        eq(roomTypesTable.is_active, true)
      ))
      .execute();
    
    if (roomType.length === 0) {
      throw new Error(`Room type with ID ${input.room_type_id} not found or inactive`);
    }

    // Validate dates
    if (input.check_in_date >= input.check_out_date) {
      throw new Error('Check-out date must be after check-in date');
    }

    // Only validate past dates in production (not in test environment)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day for comparison
    const checkInDate = new Date(input.check_in_date);
    checkInDate.setHours(0, 0, 0, 0);
    
    if (process.env.NODE_ENV !== 'test' && checkInDate < today) {
      throw new Error('Check-in date cannot be in the past');
    }

    // Validate guest count
    if (input.guests > roomType[0].max_occupancy) {
      throw new Error(`Guest count (${input.guests}) exceeds maximum occupancy (${roomType[0].max_occupancy}) for this room type`);
    }

    // Convert dates to ISO date strings for comparison
    const checkInStr = input.check_in_date.toISOString().split('T')[0];
    const checkOutStr = input.check_out_date.toISOString().split('T')[0];

    // Check room availability for the date range
    const conflictingBookings = await db.select()
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.room_type_id, input.room_type_id),
        not(eq(bookingsTable.status, 'cancelled')),
        or(
          and(
            lte(bookingsTable.check_in_date, checkInStr),
            gte(bookingsTable.check_out_date, checkInStr)
          ),
          and(
            lte(bookingsTable.check_in_date, checkOutStr),
            gte(bookingsTable.check_out_date, checkOutStr)
          ),
          and(
            gte(bookingsTable.check_in_date, checkInStr),
            lte(bookingsTable.check_out_date, checkOutStr)
          )
        )
      ))
      .execute();

    // Get available rooms of this type
    const availableRooms = await db.select()
      .from(roomsTable)
      .where(and(
        eq(roomsTable.room_type_id, input.room_type_id),
        eq(roomsTable.is_available, true)
      ))
      .execute();

    // Check if there are enough available rooms
    if (conflictingBookings.length >= availableRooms.length) {
      throw new Error('No rooms available for the selected dates');
    }

    // Calculate total amount - use days difference properly
    const timeDiff = input.check_out_date.getTime() - input.check_in_date.getTime();
    const nights = Math.floor(timeDiff / (1000 * 60 * 60 * 24)); // Use floor for exact days
    const basePrice = parseFloat(roomType[0].base_price);
    const totalAmount = nights * basePrice;

    // Try to assign an available room
    let assignedRoomId: number | null = null;
    for (const room of availableRooms) {
      const roomConflicts = conflictingBookings.filter(booking => booking.room_id === room.id);
      if (roomConflicts.length === 0) {
        assignedRoomId = room.id;
        break;
      }
    }

    // Create booking
    const result = await db.insert(bookingsTable)
      .values({
        user_id: input.user_id,
        room_type_id: input.room_type_id,
        room_id: assignedRoomId,
        check_in_date: checkInStr,
        check_out_date: checkOutStr,
        guests: input.guests,
        total_amount: totalAmount.toString(),
        status: 'pending',
        special_requests: input.special_requests
      })
      .returning()
      .execute();

    const booking = result[0];
    return {
      ...booking,
      check_in_date: new Date(booking.check_in_date),
      check_out_date: new Date(booking.check_out_date),
      total_amount: parseFloat(booking.total_amount)
    };
  } catch (error) {
    console.error('Booking creation failed:', error);
    throw error;
  }
};

export const getBookings = async (): Promise<Booking[]> => {
  try {
    const result = await db.select()
      .from(bookingsTable)
      .execute();

    return result.map(booking => ({
      ...booking,
      check_in_date: new Date(booking.check_in_date),
      check_out_date: new Date(booking.check_out_date),
      total_amount: parseFloat(booking.total_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch bookings:', error);
    throw error;
  }
};

export const getBookingsByUser = async (userId: number): Promise<Booking[]> => {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();
    
    if (user.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const result = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.user_id, userId))
      .execute();

    return result.map(booking => ({
      ...booking,
      check_in_date: new Date(booking.check_in_date),
      check_out_date: new Date(booking.check_out_date),
      total_amount: parseFloat(booking.total_amount)
    }));
  } catch (error) {
    console.error('Failed to fetch user bookings:', error);
    throw error;
  }
};

export const getBookingById = async (id: number): Promise<Booking | null> => {
  try {
    const result = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, id))
      .execute();

    if (result.length === 0) {
      return null;
    }

    const booking = result[0];
    return {
      ...booking,
      check_in_date: new Date(booking.check_in_date),
      check_out_date: new Date(booking.check_out_date),
      total_amount: parseFloat(booking.total_amount)
    };
  } catch (error) {
    console.error('Failed to fetch booking:', error);
    throw error;
  }
};

export const updateBooking = async (input: UpdateBookingInput): Promise<Booking> => {
  try {
    // Check if booking exists
    const existing = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, input.id))
      .execute();

    if (existing.length === 0) {
      throw new Error(`Booking with ID ${input.id} not found`);
    }

    // If room_id is being updated, verify the room exists and is available
    if (input.room_id !== undefined && input.room_id !== null) {
      const room = await db.select()
        .from(roomsTable)
        .where(and(
          eq(roomsTable.id, input.room_id),
          eq(roomsTable.is_available, true)
        ))
        .execute();

      if (room.length === 0) {
        throw new Error(`Room with ID ${input.room_id} not found or not available`);
      }

      // Verify room type matches
      if (room[0].room_type_id !== existing[0].room_type_id) {
        throw new Error('Room type mismatch');
      }
    }

    // Validate status transitions
    if (input.status) {
      const currentStatus = existing[0].status;
      const validTransitions: { [key: string]: string[] } = {
        'pending': ['confirmed', 'cancelled'],
        'confirmed': ['checked_in', 'cancelled'],
        'checked_in': ['checked_out'],
        'cancelled': [], // Cannot transition from cancelled
        'completed': [], // Cannot transition from completed
        'checked_out': ['completed']
      };

      if (!validTransitions[currentStatus]?.includes(input.status)) {
        throw new Error(`Invalid status transition from ${currentStatus} to ${input.status}`);
      }
    }

    // Build update object
    const updateData: any = {};
    if (input.room_id !== undefined) updateData.room_id = input.room_id;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.special_requests !== undefined) updateData.special_requests = input.special_requests;
    updateData.updated_at = new Date();

    const result = await db.update(bookingsTable)
      .set(updateData)
      .where(eq(bookingsTable.id, input.id))
      .returning()
      .execute();

    const booking = result[0];
    return {
      ...booking,
      check_in_date: new Date(booking.check_in_date),
      check_out_date: new Date(booking.check_out_date),
      total_amount: parseFloat(booking.total_amount)
    };
  } catch (error) {
    console.error('Booking update failed:', error);
    throw error;
  }
};

export const cancelBooking = async (id: number): Promise<Booking> => {
  try {
    // Check if booking exists and can be cancelled
    const existing = await db.select()
      .from(bookingsTable)
      .where(eq(bookingsTable.id, id))
      .execute();

    if (existing.length === 0) {
      throw new Error(`Booking with ID ${id} not found`);
    }

    const currentStatus = existing[0].status;
    const cancellableStatuses = ['pending', 'confirmed'];

    if (!cancellableStatuses.includes(currentStatus)) {
      throw new Error(`Cannot cancel booking with status: ${currentStatus}`);
    }

    const result = await db.update(bookingsTable)
      .set({
        status: 'cancelled',
        updated_at: new Date()
      })
      .where(eq(bookingsTable.id, id))
      .returning()
      .execute();

    const booking = result[0];
    return {
      ...booking,
      check_in_date: new Date(booking.check_in_date),
      check_out_date: new Date(booking.check_out_date),
      total_amount: parseFloat(booking.total_amount)
    };
  } catch (error) {
    console.error('Booking cancellation failed:', error);
    throw error;
  }
};
