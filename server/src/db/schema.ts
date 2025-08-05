
import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  pgEnum,
  jsonb,
  varchar,
  date
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const roomTypeEnum = pgEnum('room_type', ['deluxe', 'superior', 'junior_suite']);
export const bookingStatusEnum = pgEnum('booking_status', ['pending', 'confirmed', 'cancelled', 'completed', 'checked_in', 'checked_out']);
export const paymentMethodEnum = pgEnum('payment_method', ['credit_card', 'bank_transfer', 'paypal', 'e_wallet', 'cash_on_arrival']);
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'completed', 'failed', 'refunded']);
export const notificationTypeEnum = pgEnum('notification_type', ['email', 'in_app']);
export const notificationStatusEnum = pgEnum('notification_status', ['pending', 'sent', 'failed']);
export const userRoleEnum = pgEnum('user_role', ['guest', 'admin', 'superuser']);
export const discountTypeEnum = pgEnum('discount_type', ['percentage', 'fixed']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: varchar('first_name', { length: 100 }).notNull(),
  last_name: varchar('last_name', { length: 100 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  role: userRoleEnum('role').notNull().default('guest'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Room Types table
export const roomTypesTable = pgTable('room_types', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  type: roomTypeEnum('type').notNull(),
  description: text('description'),
  base_price: numeric('base_price', { precision: 10, scale: 2 }).notNull(),
  max_occupancy: integer('max_occupancy').notNull(),
  amenities: jsonb('amenities').notNull().default('[]'),
  image_urls: jsonb('image_urls').notNull().default('[]'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Rooms table
export const roomsTable = pgTable('rooms', {
  id: serial('id').primaryKey(),
  room_number: varchar('room_number', { length: 10 }).notNull().unique(),
  room_type_id: integer('room_type_id').notNull().references(() => roomTypesTable.id),
  is_available: boolean('is_available').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Bookings table
export const bookingsTable = pgTable('bookings', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  room_type_id: integer('room_type_id').notNull().references(() => roomTypesTable.id),
  room_id: integer('room_id').references(() => roomsTable.id),
  check_in_date: date('check_in_date').notNull(),
  check_out_date: date('check_out_date').notNull(),
  guests: integer('guests').notNull(),
  total_amount: numeric('total_amount', { precision: 10, scale: 2 }).notNull(),
  status: bookingStatusEnum('status').notNull().default('pending'),
  special_requests: text('special_requests'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Payments table
export const paymentsTable = pgTable('payments', {
  id: serial('id').primaryKey(),
  booking_id: integer('booking_id').notNull().references(() => bookingsTable.id),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  payment_method: paymentMethodEnum('payment_method').notNull(),
  payment_status: paymentStatusEnum('payment_status').notNull().default('pending'),
  transaction_id: varchar('transaction_id', { length: 255 }),
  payment_details: jsonb('payment_details'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Notifications table
export const notificationsTable = pgTable('notifications', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id),
  booking_id: integer('booking_id').references(() => bookingsTable.id),
  type: notificationTypeEnum('type').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  status: notificationStatusEnum('status').notNull().default('pending'),
  sent_at: timestamp('sent_at'),
  created_at: timestamp('created_at').defaultNow().notNull()
});

// Promotional Offers table
export const promoOffersTable = pgTable('promo_offers', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  discount_type: discountTypeEnum('discount_type').notNull(),
  discount_value: numeric('discount_value', { precision: 10, scale: 2 }).notNull(),
  min_booking_amount: numeric('min_booking_amount', { precision: 10, scale: 2 }),
  max_discount: numeric('max_discount', { precision: 10, scale: 2 }),
  valid_from: date('valid_from').notNull(),
  valid_until: date('valid_until').notNull(),
  usage_limit: integer('usage_limit'),
  used_count: integer('used_count').notNull().default(0),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Seasonal Pricing table
export const seasonalPricingTable = pgTable('seasonal_pricing', {
  id: serial('id').primaryKey(),
  room_type_id: integer('room_type_id').notNull().references(() => roomTypesTable.id),
  season_name: varchar('season_name', { length: 100 }).notNull(),
  price_multiplier: numeric('price_multiplier', { precision: 5, scale: 2 }).notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  bookings: many(bookingsTable),
  notifications: many(notificationsTable)
}));

export const roomTypesRelations = relations(roomTypesTable, ({ many }) => ({
  rooms: many(roomsTable),
  bookings: many(bookingsTable),
  seasonalPricing: many(seasonalPricingTable)
}));

export const roomsRelations = relations(roomsTable, ({ one, many }) => ({
  roomType: one(roomTypesTable, {
    fields: [roomsTable.room_type_id],
    references: [roomTypesTable.id]
  }),
  bookings: many(bookingsTable)
}));

export const bookingsRelations = relations(bookingsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [bookingsTable.user_id],
    references: [usersTable.id]
  }),
  roomType: one(roomTypesTable, {
    fields: [bookingsTable.room_type_id],
    references: [roomTypesTable.id]
  }),
  room: one(roomsTable, {
    fields: [bookingsTable.room_id],
    references: [roomsTable.id]
  }),
  payments: many(paymentsTable),
  notifications: many(notificationsTable)
}));

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  booking: one(bookingsTable, {
    fields: [paymentsTable.booking_id],
    references: [bookingsTable.id]
  })
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [notificationsTable.user_id],
    references: [usersTable.id]
  }),
  booking: one(bookingsTable, {
    fields: [notificationsTable.booking_id],
    references: [bookingsTable.id]
  })
}));

export const seasonalPricingRelations = relations(seasonalPricingTable, ({ one }) => ({
  roomType: one(roomTypesTable, {
    fields: [seasonalPricingTable.room_type_id],
    references: [roomTypesTable.id]
  })
}));

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  roomTypes: roomTypesTable,
  rooms: roomsTable,
  bookings: bookingsTable,
  payments: paymentsTable,
  notifications: notificationsTable,
  promoOffers: promoOffersTable,
  seasonalPricing: seasonalPricingTable
};
