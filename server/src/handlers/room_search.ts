
import { db } from '../db';
import { roomTypesTable, roomsTable, bookingsTable, seasonalPricingTable } from '../db/schema';
import { type SearchRoomsInput, type RoomType } from '../schema';
import { eq, and, gte, lte, lt, gt, sql, SQL } from 'drizzle-orm';

export const searchAvailableRooms = async (input: SearchRoomsInput): Promise<RoomType[]> => {
  try {
    // Build base query for room types
    const conditions: SQL<unknown>[] = [];

    // Filter by guest capacity
    conditions.push(gte(roomTypesTable.max_occupancy, input.guests));

    // Filter by room type if specified
    if (input.room_type) {
      conditions.push(eq(roomTypesTable.type, input.room_type));
    }

    // Only active room types
    conditions.push(eq(roomTypesTable.is_active, true));

    // Apply conditions
    const roomTypes = await db.select()
      .from(roomTypesTable)
      .where(and(...conditions))
      .execute();

    // Filter out room types that don't have availability
    const availableRoomTypes: RoomType[] = [];
    
    for (const roomType of roomTypes) {
      const isAvailable = await checkRoomAvailability(
        roomType.id, 
        input.check_in_date, 
        input.check_out_date
      );
      
      if (isAvailable) {
        availableRoomTypes.push({
          ...roomType,
          base_price: parseFloat(roomType.base_price),
          amenities: roomType.amenities as string[],
          image_urls: roomType.image_urls as string[]
        });
      }
    }

    return availableRoomTypes;
  } catch (error) {
    console.error('Room search failed:', error);
    throw error;
  }
};

export const checkRoomAvailability = async (roomTypeId: number, checkIn: Date, checkOut: Date): Promise<boolean> => {
  try {
    // Get total rooms of this type
    const totalRooms = await db.select({ count: sql<number>`count(*)` })
      .from(roomsTable)
      .where(and(
        eq(roomsTable.room_type_id, roomTypeId),
        eq(roomsTable.is_available, true)
      ))
      .execute();

    const totalRoomCount = Number(totalRooms[0].count);

    if (totalRoomCount === 0) {
      return false;
    }

    // Convert dates to ISO date strings for comparison with date columns
    const checkInStr = checkIn.toISOString().split('T')[0];
    const checkOutStr = checkOut.toISOString().split('T')[0];

    // Get booked rooms for the date range
    // A booking conflicts if it overlaps with the requested dates
    const bookedRooms = await db.select({ count: sql<number>`count(*)` })
      .from(bookingsTable)
      .where(and(
        eq(bookingsTable.room_type_id, roomTypeId),
        // Booking overlaps if: booking_start < requested_end AND booking_end > requested_start
        lt(bookingsTable.check_in_date, checkOutStr),
        gt(bookingsTable.check_out_date, checkInStr),
        // Only consider confirmed bookings and checked-in guests
        sql`${bookingsTable.status} IN ('confirmed', 'checked_in')`
      ))
      .execute();

    const bookedRoomCount = Number(bookedRooms[0].count);

    // Available if we have more total rooms than booked rooms
    return totalRoomCount > bookedRoomCount;
  } catch (error) {
    console.error('Room availability check failed:', error);
    throw error;
  }
};

export const calculateRoomPrice = async (roomTypeId: number, checkIn: Date, checkOut: Date): Promise<number> => {
  try {
    // Get base price for room type
    const roomType = await db.select()
      .from(roomTypesTable)
      .where(eq(roomTypesTable.id, roomTypeId))
      .execute();

    if (roomType.length === 0) {
      throw new Error(`Room type with id ${roomTypeId} not found`);
    }

    const basePrice = parseFloat(roomType[0].base_price);
    
    // Calculate number of nights
    const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) {
      throw new Error('Check-out date must be after check-in date');
    }

    // Convert dates to ISO date strings for comparison with date columns
    const checkInStr = checkIn.toISOString().split('T')[0];
    const checkOutStr = checkOut.toISOString().split('T')[0];

    // Check for seasonal pricing that applies to this date range
    const seasonalPricing = await db.select()
      .from(seasonalPricingTable)
      .where(and(
        eq(seasonalPricingTable.room_type_id, roomTypeId),
        eq(seasonalPricingTable.is_active, true),
        // Seasonal pricing applies if it overlaps with the booking dates
        lte(seasonalPricingTable.start_date, checkOutStr),
        gte(seasonalPricingTable.end_date, checkInStr)
      ))
      .execute();

    let totalPrice = 0;

    // If we have seasonal pricing, calculate day by day
    if (seasonalPricing.length > 0) {
      const currentDate = new Date(checkIn);
      
      while (currentDate < checkOut) {
        let dayMultiplier = 1; // Default multiplier
        const currentDateStr = currentDate.toISOString().split('T')[0];
        
        // Find applicable seasonal pricing for this day
        for (const pricing of seasonalPricing) {
          if (currentDateStr >= pricing.start_date && currentDateStr <= pricing.end_date) {
            dayMultiplier = parseFloat(pricing.price_multiplier);
            break;
          }
        }
        
        totalPrice += basePrice * dayMultiplier;
        currentDate.setDate(currentDate.getDate() + 1);
      }
    } else {
      // No seasonal pricing, use base price
      totalPrice = basePrice * nights;
    }

    return totalPrice;
  } catch (error) {
    console.error('Room price calculation failed:', error);
    throw error;
  }
};
