
import { z } from 'zod';

// Enums
export const roomTypeEnum = z.enum(['deluxe', 'superior', 'junior_suite']);
export const bookingStatusEnum = z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'checked_in', 'checked_out']);
export const paymentMethodEnum = z.enum(['credit_card', 'bank_transfer', 'paypal', 'e_wallet', 'cash_on_arrival']);
export const paymentStatusEnum = z.enum(['pending', 'completed', 'failed', 'refunded']);
export const notificationTypeEnum = z.enum(['email', 'in_app']);
export const notificationStatusEnum = z.enum(['pending', 'sent', 'failed']);
export const userRoleEnum = z.enum(['guest', 'admin', 'superuser']);

// User schemas
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  role: userRoleEnum,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  role: userRoleEnum.optional()
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Room Type schemas
export const roomTypeSchema = z.object({
  id: z.number(),
  name: z.string(),
  type: roomTypeEnum,
  description: z.string().nullable(),
  base_price: z.number(),
  max_occupancy: z.number().int(),
  amenities: z.array(z.string()),
  image_urls: z.array(z.string()),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type RoomType = z.infer<typeof roomTypeSchema>;

export const createRoomTypeInputSchema = z.object({
  name: z.string(),
  type: roomTypeEnum,
  description: z.string().nullable(),
  base_price: z.number().positive(),
  max_occupancy: z.number().int().positive(),
  amenities: z.array(z.string()),
  image_urls: z.array(z.string()),
  is_active: z.boolean().optional()
});

export type CreateRoomTypeInput = z.infer<typeof createRoomTypeInputSchema>;

export const updateRoomTypeInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  type: roomTypeEnum.optional(),
  description: z.string().nullable().optional(),
  base_price: z.number().positive().optional(),
  max_occupancy: z.number().int().positive().optional(),
  amenities: z.array(z.string()).optional(),
  image_urls: z.array(z.string()).optional(),
  is_active: z.boolean().optional()
});

export type UpdateRoomTypeInput = z.infer<typeof updateRoomTypeInputSchema>;

// Room schemas
export const roomSchema = z.object({
  id: z.number(),
  room_number: z.string(),
  room_type_id: z.number(),
  is_available: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Room = z.infer<typeof roomSchema>;

export const createRoomInputSchema = z.object({
  room_number: z.string(),
  room_type_id: z.number(),
  is_available: z.boolean().optional()
});

export type CreateRoomInput = z.infer<typeof createRoomInputSchema>;

// Booking schemas
export const bookingSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  room_type_id: z.number(),
  room_id: z.number().nullable(),
  check_in_date: z.coerce.date(),
  check_out_date: z.coerce.date(),
  guests: z.number().int(),
  total_amount: z.number(),
  status: bookingStatusEnum,
  special_requests: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Booking = z.infer<typeof bookingSchema>;

export const createBookingInputSchema = z.object({
  user_id: z.number(),
  room_type_id: z.number(),
  check_in_date: z.coerce.date(),
  check_out_date: z.coerce.date(),
  guests: z.number().int().positive(),
  special_requests: z.string().nullable()
});

export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

export const updateBookingInputSchema = z.object({
  id: z.number(),
  room_id: z.number().nullable().optional(),
  status: bookingStatusEnum.optional(),
  special_requests: z.string().nullable().optional()
});

export type UpdateBookingInput = z.infer<typeof updateBookingInputSchema>;

export const searchRoomsInputSchema = z.object({
  check_in_date: z.coerce.date(),
  check_out_date: z.coerce.date(),
  guests: z.number().int().positive(),
  room_type: roomTypeEnum.optional()
});

export type SearchRoomsInput = z.infer<typeof searchRoomsInputSchema>;

// Payment schemas
export const paymentSchema = z.object({
  id: z.number(),
  booking_id: z.number(),
  amount: z.number(),
  payment_method: paymentMethodEnum,
  payment_status: paymentStatusEnum,
  transaction_id: z.string().nullable(),
  payment_details: z.record(z.any()).nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Payment = z.infer<typeof paymentSchema>;

export const createPaymentInputSchema = z.object({
  booking_id: z.number(),
  amount: z.number().positive(),
  payment_method: paymentMethodEnum,
  payment_details: z.record(z.any()).nullable()
});

export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;

export const updatePaymentInputSchema = z.object({
  id: z.number(),
  payment_status: paymentStatusEnum,
  transaction_id: z.string().nullable().optional(),
  payment_details: z.record(z.any()).nullable().optional()
});

export type UpdatePaymentInput = z.infer<typeof updatePaymentInputSchema>;

// Notification schemas
export const notificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  booking_id: z.number().nullable(),
  type: notificationTypeEnum,
  title: z.string(),
  message: z.string(),
  status: notificationStatusEnum,
  sent_at: z.coerce.date().nullable(),
  created_at: z.coerce.date()
});

export type Notification = z.infer<typeof notificationSchema>;

export const createNotificationInputSchema = z.object({
  user_id: z.number(),
  booking_id: z.number().nullable(),
  type: notificationTypeEnum,
  title: z.string(),
  message: z.string()
});

export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;

// Promotional Offer schemas
export const promoOfferSchema = z.object({
  id: z.number(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number(),
  min_booking_amount: z.number().nullable(),
  max_discount: z.number().nullable(),
  valid_from: z.coerce.date(),
  valid_until: z.coerce.date(),
  usage_limit: z.number().nullable(),
  used_count: z.number().int(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type PromoOffer = z.infer<typeof promoOfferSchema>;

export const createPromoOfferInputSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  discount_type: z.enum(['percentage', 'fixed']),
  discount_value: z.number().positive(),
  min_booking_amount: z.number().positive().nullable(),
  max_discount: z.number().positive().nullable(),
  valid_from: z.coerce.date(),
  valid_until: z.coerce.date(),
  usage_limit: z.number().int().positive().nullable(),
  is_active: z.boolean().optional()
});

export type CreatePromoOfferInput = z.infer<typeof createPromoOfferInputSchema>;

export const updatePromoOfferInputSchema = z.object({
  id: z.number(),
  code: z.string().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  discount_type: z.enum(['percentage', 'fixed']).optional(),
  discount_value: z.number().positive().optional(),
  min_booking_amount: z.number().positive().nullable().optional(),
  max_discount: z.number().positive().nullable().optional(),
  valid_from: z.coerce.date().optional(),
  valid_until: z.coerce.date().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdatePromoOfferInput = z.infer<typeof updatePromoOfferInputSchema>;

// Pricing schemas
export const seasonalPricingSchema = z.object({
  id: z.number(),
  room_type_id: z.number(),
  season_name: z.string(),
  price_multiplier: z.number(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type SeasonalPricing = z.infer<typeof seasonalPricingSchema>;

export const createSeasonalPricingInputSchema = z.object({
  room_type_id: z.number(),
  season_name: z.string(),
  price_multiplier: z.number().positive(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  is_active: z.boolean().optional()
});

export type CreateSeasonalPricingInput = z.infer<typeof createSeasonalPricingInputSchema>;
