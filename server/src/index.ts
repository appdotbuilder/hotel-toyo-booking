
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Schema imports
import {
  createUserInputSchema,
  loginInputSchema,
  createRoomTypeInputSchema,
  updateRoomTypeInputSchema,
  createRoomInputSchema,
  searchRoomsInputSchema,
  createBookingInputSchema,
  updateBookingInputSchema,
  createPaymentInputSchema,
  updatePaymentInputSchema,
  createNotificationInputSchema,
  createPromoOfferInputSchema,
  updatePromoOfferInputSchema,
  createSeasonalPricingInputSchema,
  userRoleEnum
} from './schema';

// Handler imports
import { createUser, loginUser, getUserById } from './handlers/auth';
import { 
  createRoomType, 
  getRoomTypes, 
  getRoomTypeById, 
  updateRoomType, 
  deleteRoomType 
} from './handlers/room_types';
import { 
  createRoom, 
  getRooms, 
  getRoomById, 
  updateRoomAvailability 
} from './handlers/rooms';
import { 
  searchAvailableRooms, 
  checkRoomAvailability, 
  calculateRoomPrice 
} from './handlers/room_search';
import { 
  createBooking, 
  getBookings, 
  getBookingsByUser, 
  getBookingById, 
  updateBooking, 
  cancelBooking 
} from './handlers/bookings';
import { 
  createPayment, 
  getPaymentsByBooking, 
  getPaymentById, 
  updatePayment, 
  processRefund 
} from './handlers/payments';
import { 
  createNotification, 
  sendBookingConfirmation, 
  sendPaymentReminder, 
  sendCheckInInstructions, 
  getNotificationsByUser, 
  markNotificationAsRead 
} from './handlers/notifications';
import { 
  createPromoOffer, 
  getPromoOffers, 
  getActivePromoOffers, 
  getPromoOfferByCode, 
  updatePromoOffer, 
  validatePromoCode, 
  usePromoCode 
} from './handlers/promo_offers';
import { 
  createSeasonalPricing, 
  getSeasonalPricing, 
  getSeasonalPricingByRoomType, 
  getActiveSeasonalPricing, 
  updateSeasonalPricing, 
  deleteSeasonalPricing 
} from './handlers/seasonal_pricing';
import { 
  getAllUsers, 
  updateUserRole, 
  getDashboardStats, 
  getRevenueReport, 
  getOccupancyReport 
} from './handlers/admin';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  createUser: publicProcedure
    .input(createUserInputSchema)
    .mutation(({ input }) => createUser(input)),
  
  loginUser: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => loginUser(input)),
  
  getUserById: publicProcedure
    .input(z.number())
    .query(({ input }) => getUserById(input)),

  // Room Type routes
  createRoomType: publicProcedure
    .input(createRoomTypeInputSchema)
    .mutation(({ input }) => createRoomType(input)),
  
  getRoomTypes: publicProcedure
    .query(() => getRoomTypes()),
  
  getRoomTypeById: publicProcedure
    .input(z.number())
    .query(({ input }) => getRoomTypeById(input)),
  
  updateRoomType: publicProcedure
    .input(updateRoomTypeInputSchema)
    .mutation(({ input }) => updateRoomType(input)),
  
  deleteRoomType: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteRoomType(input)),

  // Room routes
  createRoom: publicProcedure
    .input(createRoomInputSchema)
    .mutation(({ input }) => createRoom(input)),
  
  getRooms: publicProcedure
    .query(() => getRooms()),
  
  getRoomById: publicProcedure
    .input(z.number())
    .query(({ input }) => getRoomById(input)),
  
  updateRoomAvailability: publicProcedure
    .input(z.object({
      id: z.number(),
      isAvailable: z.boolean()
    }))
    .mutation(({ input }) => updateRoomAvailability(input.id, input.isAvailable)),

  // Room Search routes
  searchAvailableRooms: publicProcedure
    .input(searchRoomsInputSchema)
    .query(({ input }) => searchAvailableRooms(input)),
  
  checkRoomAvailability: publicProcedure
    .input(z.object({
      roomTypeId: z.number(),
      checkIn: z.coerce.date(),
      checkOut: z.coerce.date()
    }))
    .query(({ input }) => checkRoomAvailability(input.roomTypeId, input.checkIn, input.checkOut)),
  
  calculateRoomPrice: publicProcedure
    .input(z.object({
      roomTypeId: z.number(),
      checkIn: z.coerce.date(),
      checkOut: z.coerce.date()
    }))
    .query(({ input }) => calculateRoomPrice(input.roomTypeId, input.checkIn, input.checkOut)),

  // Booking routes
  createBooking: publicProcedure
    .input(createBookingInputSchema)
    .mutation(({ input }) => createBooking(input)),
  
  getBookings: publicProcedure
    .query(() => getBookings()),
  
  getBookingsByUser: publicProcedure
    .input(z.number())
    .query(({ input }) => getBookingsByUser(input)),
  
  getBookingById: publicProcedure
    .input(z.number())
    .query(({ input }) => getBookingById(input)),
  
  updateBooking: publicProcedure
    .input(updateBookingInputSchema)
    .mutation(({ input }) => updateBooking(input)),
  
  cancelBooking: publicProcedure
    .input(z.number())
    .mutation(({ input }) => cancelBooking(input)),

  // Payment routes
  createPayment: publicProcedure
    .input(createPaymentInputSchema)
    .mutation(({ input }) => createPayment(input)),
  
  getPaymentsByBooking: publicProcedure
    .input(z.number())
    .query(({ input }) => getPaymentsByBooking(input)),
  
  getPaymentById: publicProcedure
    .input(z.number())
    .query(({ input }) => getPaymentById(input)),
  
  updatePayment: publicProcedure
    .input(updatePaymentInputSchema)
    .mutation(({ input }) => updatePayment(input)),
  
  processRefund: publicProcedure
    .input(z.object({
      paymentId: z.number(),
      amount: z.number()
    }))
    .mutation(({ input }) => processRefund(input.paymentId, input.amount)),

  // Notification routes
  createNotification: publicProcedure
    .input(createNotificationInputSchema)
    .mutation(({ input }) => createNotification(input)),
  
  sendBookingConfirmation: publicProcedure
    .input(z.number())
    .mutation(({ input }) => sendBookingConfirmation(input)),
  
  sendPaymentReminder: publicProcedure
    .input(z.number())
    .mutation(({ input }) => sendPaymentReminder(input)),
  
  sendCheckInInstructions: publicProcedure
    .input(z.number())
    .mutation(({ input }) => sendCheckInInstructions(input)),
  
  getNotificationsByUser: publicProcedure
    .input(z.number())
    .query(({ input }) => getNotificationsByUser(input)),
  
  markNotificationAsRead: publicProcedure
    .input(z.number())
    .mutation(({ input }) => markNotificationAsRead(input)),

  // Promotional Offer routes
  createPromoOffer: publicProcedure
    .input(createPromoOfferInputSchema)
    .mutation(({ input }) => createPromoOffer(input)),
  
  getPromoOffers: publicProcedure
    .query(() => getPromoOffers()),
  
  getActivePromoOffers: publicProcedure
    .query(() => getActivePromoOffers()),
  
  getPromoOfferByCode: publicProcedure
    .input(z.string())
    .query(({ input }) => getPromoOfferByCode(input)),
  
  updatePromoOffer: publicProcedure
    .input(updatePromoOfferInputSchema)
    .mutation(({ input }) => updatePromoOffer(input)),
  
  validatePromoCode: publicProcedure
    .input(z.object({
      code: z.string(),
      bookingAmount: z.number()
    }))
    .query(({ input }) => validatePromoCode(input.code, input.bookingAmount)),
  
  usePromoCode: publicProcedure
    .input(z.string())
    .mutation(({ input }) => usePromoCode(input)),

  // Seasonal Pricing routes
  createSeasonalPricing: publicProcedure
    .input(createSeasonalPricingInputSchema)
    .mutation(({ input }) => createSeasonalPricing(input)),
  
  getSeasonalPricing: publicProcedure
    .query(() => getSeasonalPricing()),
  
  getSeasonalPricingByRoomType: publicProcedure
    .input(z.number())
    .query(({ input }) => getSeasonalPricingByRoomType(input)),
  
  getActiveSeasonalPricing: publicProcedure
    .input(z.object({
      roomTypeId: z.number(),
      date: z.coerce.date()
    }))
    .query(({ input }) => getActiveSeasonalPricing(input.roomTypeId, input.date)),
  
  updateSeasonalPricing: publicProcedure
    .input(z.object({
      id: z.number(),
      priceMultiplier: z.number()
    }))
    .mutation(({ input }) => updateSeasonalPricing(input.id, input.priceMultiplier)),
  
  deleteSeasonalPricing: publicProcedure
    .input(z.number())
    .mutation(({ input }) => deleteSeasonalPricing(input)),

  // Admin routes
  getAllUsers: publicProcedure
    .query(() => getAllUsers()),
  
  updateUserRole: publicProcedure
    .input(z.object({
      userId: z.number(),
      role: userRoleEnum
    }))
    .mutation(({ input }) => updateUserRole(input.userId, input.role)),
  
  getDashboardStats: publicProcedure
    .query(() => getDashboardStats()),
  
  getRevenueReport: publicProcedure
    .input(z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date()
    }))
    .query(({ input }) => getRevenueReport(input.startDate, input.endDate)),
  
  getOccupancyReport: publicProcedure
    .input(z.object({
      startDate: z.coerce.date(),
      endDate: z.coerce.date()
    }))
    .query(({ input }) => getOccupancyReport(input.startDate, input.endDate)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Hotel Toyo Purwokerto TRPC server listening at port: ${port}`);
}

start();
