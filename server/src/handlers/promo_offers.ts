
import { db } from '../db';
import { promoOffersTable } from '../db/schema';
import { type CreatePromoOfferInput, type UpdatePromoOfferInput, type PromoOffer } from '../schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

export const createPromoOffer = async (input: CreatePromoOfferInput): Promise<PromoOffer> => {
  try {
    const result = await db.insert(promoOffersTable)
      .values({
        code: input.code,
        name: input.name,
        description: input.description,
        discount_type: input.discount_type,
        discount_value: input.discount_value.toString(),
        min_booking_amount: input.min_booking_amount?.toString() || null,
        max_discount: input.max_discount?.toString() || null,
        valid_from: input.valid_from.toISOString().split('T')[0], // Convert to YYYY-MM-DD
        valid_until: input.valid_until.toISOString().split('T')[0], // Convert to YYYY-MM-DD
        usage_limit: input.usage_limit,
        is_active: input.is_active ?? true
      })
      .returning()
      .execute();

    const offer = result[0];
    return {
      ...offer,
      discount_value: parseFloat(offer.discount_value),
      min_booking_amount: offer.min_booking_amount ? parseFloat(offer.min_booking_amount) : null,
      max_discount: offer.max_discount ? parseFloat(offer.max_discount) : null,
      valid_from: new Date(offer.valid_from),
      valid_until: new Date(offer.valid_until)
    };
  } catch (error) {
    console.error('Promo offer creation failed:', error);
    throw error;
  }
};

export const getPromoOffers = async (): Promise<PromoOffer[]> => {
  try {
    const results = await db.select()
      .from(promoOffersTable)
      .execute();

    return results.map(offer => ({
      ...offer,
      discount_value: parseFloat(offer.discount_value),
      min_booking_amount: offer.min_booking_amount ? parseFloat(offer.min_booking_amount) : null,
      max_discount: offer.max_discount ? parseFloat(offer.max_discount) : null,
      valid_from: new Date(offer.valid_from),
      valid_until: new Date(offer.valid_until)
    }));
  } catch (error) {
    console.error('Fetching promo offers failed:', error);
    throw error;
  }
};

export const getActivePromoOffers = async (): Promise<PromoOffer[]> => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    const results = await db.select()
      .from(promoOffersTable)
      .where(
        and(
          eq(promoOffersTable.is_active, true),
          lte(promoOffersTable.valid_from, today),
          gte(promoOffersTable.valid_until, today)
        )
      )
      .execute();

    return results.map(offer => ({
      ...offer,
      discount_value: parseFloat(offer.discount_value),
      min_booking_amount: offer.min_booking_amount ? parseFloat(offer.min_booking_amount) : null,
      max_discount: offer.max_discount ? parseFloat(offer.max_discount) : null,
      valid_from: new Date(offer.valid_from),
      valid_until: new Date(offer.valid_until)
    }));
  } catch (error) {
    console.error('Fetching active promo offers failed:', error);
    throw error;
  }
};

export const getPromoOfferByCode = async (code: string): Promise<PromoOffer | null> => {
  try {
    const results = await db.select()
      .from(promoOffersTable)
      .where(eq(promoOffersTable.code, code))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const offer = results[0];
    return {
      ...offer,
      discount_value: parseFloat(offer.discount_value),
      min_booking_amount: offer.min_booking_amount ? parseFloat(offer.min_booking_amount) : null,
      max_discount: offer.max_discount ? parseFloat(offer.max_discount) : null,
      valid_from: new Date(offer.valid_from),
      valid_until: new Date(offer.valid_until)
    };
  } catch (error) {
    console.error('Fetching promo offer by code failed:', error);
    throw error;
  }
};

export const updatePromoOffer = async (input: UpdatePromoOfferInput): Promise<PromoOffer> => {
  try {
    const updateData: any = {};
    
    if (input.code !== undefined) updateData.code = input.code;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.discount_type !== undefined) updateData.discount_type = input.discount_type;
    if (input.discount_value !== undefined) updateData.discount_value = input.discount_value.toString();
    if (input.min_booking_amount !== undefined) {
      updateData.min_booking_amount = input.min_booking_amount?.toString() || null;
    }
    if (input.max_discount !== undefined) {
      updateData.max_discount = input.max_discount?.toString() || null;
    }
    if (input.valid_from !== undefined) updateData.valid_from = input.valid_from.toISOString().split('T')[0];
    if (input.valid_until !== undefined) updateData.valid_until = input.valid_until.toISOString().split('T')[0];
    if (input.usage_limit !== undefined) updateData.usage_limit = input.usage_limit;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    updateData.updated_at = new Date();

    const result = await db.update(promoOffersTable)
      .set(updateData)
      .where(eq(promoOffersTable.id, input.id))
      .returning()
      .execute();

    const offer = result[0];
    return {
      ...offer,
      discount_value: parseFloat(offer.discount_value),
      min_booking_amount: offer.min_booking_amount ? parseFloat(offer.min_booking_amount) : null,
      max_discount: offer.max_discount ? parseFloat(offer.max_discount) : null,
      valid_from: new Date(offer.valid_from),
      valid_until: new Date(offer.valid_until)
    };
  } catch (error) {
    console.error('Promo offer update failed:', error);
    throw error;
  }
};

export const validatePromoCode = async (code: string, bookingAmount: number): Promise<{ valid: boolean; discount: number; offer: PromoOffer | null }> => {
  try {
    const offer = await getPromoOfferByCode(code);
    
    if (!offer) {
      return { valid: false, discount: 0, offer: null };
    }

    const today = new Date();
    
    // Check if offer is active
    if (!offer.is_active) {
      return { valid: false, discount: 0, offer };
    }

    // Check date validity
    if (today < offer.valid_from || today > offer.valid_until) {
      return { valid: false, discount: 0, offer };
    }

    // Check usage limit
    if (offer.usage_limit !== null && offer.used_count >= offer.usage_limit) {
      return { valid: false, discount: 0, offer };
    }

    // Check minimum booking amount
    if (offer.min_booking_amount !== null && bookingAmount < offer.min_booking_amount) {
      return { valid: false, discount: 0, offer };
    }

    // Calculate discount
    let discount = 0;
    if (offer.discount_type === 'percentage') {
      discount = (bookingAmount * offer.discount_value) / 100;
    } else {
      discount = offer.discount_value;
    }

    // Apply maximum discount limit
    if (offer.max_discount !== null && discount > offer.max_discount) {
      discount = offer.max_discount;
    }

    return { valid: true, discount, offer };
  } catch (error) {
    console.error('Promo code validation failed:', error);
    throw error;
  }
};

export const usePromoCode = async (code: string): Promise<PromoOffer> => {
  try {
    const result = await db.update(promoOffersTable)
      .set({
        used_count: sql`${promoOffersTable.used_count} + 1`,
        updated_at: new Date()
      })
      .where(eq(promoOffersTable.code, code))
      .returning()
      .execute();

    const offer = result[0];
    return {
      ...offer,
      discount_value: parseFloat(offer.discount_value),
      min_booking_amount: offer.min_booking_amount ? parseFloat(offer.min_booking_amount) : null,
      max_discount: offer.max_discount ? parseFloat(offer.max_discount) : null,
      valid_from: new Date(offer.valid_from),
      valid_until: new Date(offer.valid_until)
    };
  } catch (error) {
    console.error('Using promo code failed:', error);
    throw error;
  }
};
