
import { db } from '../db';
import { usersTable, bookingsTable, roomTypesTable, paymentsTable, roomsTable } from '../db/schema';
import { type User } from '../schema';
import { eq, and, gte, lte, count, sum, avg } from 'drizzle-orm';

export const getAllUsers = async (): Promise<User[]> => {
  try {
    const users = await db.select()
      .from(usersTable)
      .execute();

    return users;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
};

export const updateUserRole = async (userId: number, role: 'guest' | 'admin' | 'superuser'): Promise<User> => {
  try {
    const result = await db.update(usersTable)
      .set({ 
        role: role,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Failed to update user role:', error);
    throw error;
  }
};

export const getDashboardStats = async (): Promise<{
  totalBookings: number;
  totalRevenue: number;
  occupancyRate: number;
  pendingPayments: number;
}> => {
  try {
    // Get total bookings count
    const bookingCountResult = await db.select({ count: count() })
      .from(bookingsTable)
      .execute();
    const totalBookings = bookingCountResult[0]?.count || 0;

    // Get total revenue from completed payments
    const revenueResult = await db.select({ total: sum(paymentsTable.amount) })
      .from(paymentsTable)
      .where(eq(paymentsTable.payment_status, 'completed'))
      .execute();
    const totalRevenue = revenueResult[0]?.total ? parseFloat(revenueResult[0].total) : 0;

    // Get pending payments count
    const pendingPaymentsResult = await db.select({ count: count() })
      .from(paymentsTable)
      .where(eq(paymentsTable.payment_status, 'pending'))
      .execute();
    const pendingPayments = pendingPaymentsResult[0]?.count || 0;

    // Calculate occupancy rate
    const totalRoomsResult = await db.select({ count: count() })
      .from(roomsTable)
      .execute();
    const totalRooms = totalRoomsResult[0]?.count || 0;

    const occupiedRoomsResult = await db.select({ count: count() })
      .from(roomsTable)
      .where(eq(roomsTable.is_available, false))
      .execute();
    const occupiedRooms = occupiedRoomsResult[0]?.count || 0;

    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    return {
      totalBookings,
      totalRevenue,
      occupancyRate,
      pendingPayments
    };
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error);
    throw error;
  }
};

export const getRevenueReport = async (startDate: Date, endDate: Date): Promise<{
  totalRevenue: number;
  bookingCount: number;
  averageBookingValue: number;
  revenueByRoomType: Array<{ roomType: string; revenue: number; count: number }>;
}> => {
  try {
    // Get total revenue and booking count for the date range
    // Filter by payment creation date instead of booking creation date
    const revenueAndCountResult = await db.select({
      totalRevenue: sum(paymentsTable.amount),
      bookingCount: count(paymentsTable.id),
      averageBookingValue: avg(paymentsTable.amount)
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.booking_id, bookingsTable.id))
    .where(
      and(
        eq(paymentsTable.payment_status, 'completed'),
        gte(paymentsTable.created_at, startDate),
        lte(paymentsTable.created_at, endDate)
      )
    )
    .execute();

    const totalRevenue = revenueAndCountResult[0]?.totalRevenue ? parseFloat(revenueAndCountResult[0].totalRevenue) : 0;
    const bookingCount = revenueAndCountResult[0]?.bookingCount || 0;
    const averageBookingValue = revenueAndCountResult[0]?.averageBookingValue ? parseFloat(revenueAndCountResult[0].averageBookingValue) : 0;

    // Get revenue by room type
    const revenueByRoomTypeResult = await db.select({
      roomType: roomTypesTable.type,
      revenue: sum(paymentsTable.amount),
      count: count(paymentsTable.id)
    })
    .from(paymentsTable)
    .innerJoin(bookingsTable, eq(paymentsTable.booking_id, bookingsTable.id))
    .innerJoin(roomTypesTable, eq(bookingsTable.room_type_id, roomTypesTable.id))
    .where(
      and(
        eq(paymentsTable.payment_status, 'completed'),
        gte(paymentsTable.created_at, startDate),
        lte(paymentsTable.created_at, endDate)
      )
    )
    .groupBy(roomTypesTable.type)
    .execute();

    const revenueByRoomType = revenueByRoomTypeResult.map(row => ({
      roomType: row.roomType,
      revenue: row.revenue ? parseFloat(row.revenue) : 0,
      count: row.count || 0
    }));

    return {
      totalRevenue,
      bookingCount,
      averageBookingValue,
      revenueByRoomType
    };
  } catch (error) {
    console.error('Failed to generate revenue report:', error);
    throw error;
  }
};

export const getOccupancyReport = async (startDate: Date, endDate: Date): Promise<{
  totalRooms: number;
  occupiedRooms: number;
  occupancyRate: number;
  occupancyByRoomType: Array<{ roomType: string; totalRooms: number; occupiedRooms: number; rate: number }>;
}> => {
  try {
    // Convert dates to strings for comparison with date columns
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    // Get total rooms count
    const totalRoomsResult = await db.select({ count: count() })
      .from(roomsTable)
      .execute();
    const totalRooms = totalRoomsResult[0]?.count || 0;

    // Get occupied rooms count during the date range
    const occupiedRoomsResult = await db.select({ count: count() })
      .from(roomsTable)
      .innerJoin(bookingsTable, eq(roomsTable.id, bookingsTable.room_id))
      .where(
        and(
          gte(bookingsTable.check_in_date, startDateStr),
          lte(bookingsTable.check_out_date, endDateStr),
          eq(bookingsTable.status, 'confirmed')
        )
      )
      .execute();
    const occupiedRooms = occupiedRoomsResult[0]?.count || 0;

    const occupancyRate = totalRooms > 0 ? (occupiedRooms / totalRooms) * 100 : 0;

    // Get occupancy by room type - simplified approach
    const roomTypeStats = await db.select({
      roomType: roomTypesTable.type,
      totalRooms: count(roomsTable.id)
    })
    .from(roomTypesTable)
    .leftJoin(roomsTable, eq(roomTypesTable.id, roomsTable.room_type_id))
    .groupBy(roomTypesTable.type)
    .execute();

    // Get occupied rooms by room type
    const occupiedByType = await db.select({
      roomType: roomTypesTable.type,
      occupiedRooms: count(bookingsTable.id)
    })
    .from(roomTypesTable)
    .innerJoin(roomsTable, eq(roomTypesTable.id, roomsTable.room_type_id))
    .innerJoin(bookingsTable, eq(roomsTable.id, bookingsTable.room_id))
    .where(
      and(
        gte(bookingsTable.check_in_date, startDateStr),
        lte(bookingsTable.check_out_date, endDateStr),
        eq(bookingsTable.status, 'confirmed')
      )
    )
    .groupBy(roomTypesTable.type)
    .execute();

    const occupancyByRoomType = roomTypeStats.map(roomTypeStat => {
      const occupiedStat = occupiedByType.find(o => o.roomType === roomTypeStat.roomType);
      const totalRoomsForType = roomTypeStat.totalRooms || 0;
      const occupiedRoomsForType = occupiedStat?.occupiedRooms || 0;
      const rate = totalRoomsForType > 0 ? (occupiedRoomsForType / totalRoomsForType) * 100 : 0;

      return {
        roomType: roomTypeStat.roomType,
        totalRooms: totalRoomsForType,
        occupiedRooms: occupiedRoomsForType,
        rate
      };
    });

    return {
      totalRooms,
      occupiedRooms,
      occupancyRate,
      occupancyByRoomType
    };
  } catch (error) {
    console.error('Failed to generate occupancy report:', error);
    throw error;
  }
};
