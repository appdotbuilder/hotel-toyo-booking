
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { promoOffersTable } from '../db/schema';
import { type CreatePromoOfferInput, type UpdatePromoOfferInput } from '../schema';
import { 
  createPromoOffer, 
  getPromoOffers, 
  getActivePromoOffers, 
  getPromoOfferByCode, 
  updatePromoOffer,
  validatePromoCode,
  usePromoCode
} from '../handlers/promo_offers';
import { eq } from 'drizzle-orm';

const testPromoInput: CreatePromoOfferInput = {
  code: 'SUMMER20',
  name: 'Summer Sale',
  description: 'Get 20% off your summer booking',
  discount_type: 'percentage',
  discount_value: 20,
  min_booking_amount: 100,
  max_discount: 50,
  valid_from: new Date('2024-06-01'),
  valid_until: new Date('2024-08-31'),
  usage_limit: 100,
  is_active: true
};

const testFixedDiscountInput: CreatePromoOfferInput = {
  code: 'FIXED10',
  name: 'Fixed Discount',
  description: 'Get $10 off',
  discount_type: 'fixed',
  discount_value: 10,
  min_booking_amount: null,
  max_discount: null,
  valid_from: new Date('2024-01-01'),
  valid_until: new Date('2024-12-31'),
  usage_limit: null,
  is_active: true
};

describe('createPromoOffer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a promo offer with percentage discount', async () => {
    const result = await createPromoOffer(testPromoInput);

    expect(result.code).toEqual('SUMMER20');
    expect(result.name).toEqual('Summer Sale');
    expect(result.description).toEqual('Get 20% off your summer booking');
    expect(result.discount_type).toEqual('percentage');
    expect(result.discount_value).toEqual(20);
    expect(result.min_booking_amount).toEqual(100);
    expect(result.max_discount).toEqual(50);
    expect(result.valid_from).toEqual(new Date('2024-06-01'));
    expect(result.valid_until).toEqual(new Date('2024-08-31'));
    expect(result.usage_limit).toEqual(100);
    expect(result.used_count).toEqual(0);
    expect(result.is_active).toBe(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a promo offer with fixed discount', async () => {
    const result = await createPromoOffer(testFixedDiscountInput);

    expect(result.discount_type).toEqual('fixed');
    expect(result.discount_value).toEqual(10);
    expect(result.min_booking_amount).toBeNull();
    expect(result.max_discount).toBeNull();
    expect(result.usage_limit).toBeNull();
    expect(typeof result.discount_value).toEqual('number');
  });

  it('should save promo offer to database', async () => {
    const result = await createPromoOffer(testPromoInput);

    const offers = await db.select()
      .from(promoOffersTable)
      .where(eq(promoOffersTable.id, result.id))
      .execute();

    expect(offers).toHaveLength(1);
    expect(offers[0].code).toEqual('SUMMER20');
    expect(parseFloat(offers[0].discount_value)).toEqual(20);
    expect(offers[0].min_booking_amount ? parseFloat(offers[0].min_booking_amount) : null).toEqual(100);
  });
});

describe('getPromoOffers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all promo offers', async () => {
    await createPromoOffer(testPromoInput);
    await createPromoOffer(testFixedDiscountInput);

    const results = await getPromoOffers();

    expect(results).toHaveLength(2);
    expect(results[0].discount_value).toEqual(20);
    expect(results[1].discount_value).toEqual(10);
    expect(typeof results[0].discount_value).toEqual('number');
    expect(typeof results[1].discount_value).toEqual('number');
  });

  it('should return empty array when no offers exist', async () => {
    const results = await getPromoOffers();
    expect(results).toHaveLength(0);
  });
});

describe('getActivePromoOffers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return only active offers within date range', async () => {
    // Create active offer
    const activeOffer = {
      ...testPromoInput,
      code: 'ACTIVE',
      valid_from: new Date(Date.now() - 86400000), // Yesterday
      valid_until: new Date(Date.now() + 86400000), // Tomorrow
      is_active: true
    };
    await createPromoOffer(activeOffer);

    // Create inactive offer
    const inactiveOffer = {
      ...testPromoInput,
      code: 'INACTIVE',
      is_active: false
    };
    await createPromoOffer(inactiveOffer);

    // Create expired offer
    const expiredOffer = {
      ...testPromoInput,
      code: 'EXPIRED',
      valid_from: new Date('2023-01-01'),
      valid_until: new Date('2023-01-31'),
      is_active: true
    };
    await createPromoOffer(expiredOffer);

    const results = await getActivePromoOffers();

    expect(results).toHaveLength(1);
    expect(results[0].code).toEqual('ACTIVE');
    expect(results[0].is_active).toBe(true);
  });
});

describe('getPromoOfferByCode', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return promo offer by code', async () => {
    await createPromoOffer(testPromoInput);

    const result = await getPromoOfferByCode('SUMMER20');

    expect(result).not.toBeNull();
    expect(result!.code).toEqual('SUMMER20');
    expect(result!.discount_value).toEqual(20);
    expect(typeof result!.discount_value).toEqual('number');
  });

  it('should return null for non-existent code', async () => {
    const result = await getPromoOfferByCode('NONEXISTENT');
    expect(result).toBeNull();
  });
});

describe('updatePromoOffer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update promo offer fields', async () => {
    const created = await createPromoOffer(testPromoInput);

    const updateInput: UpdatePromoOfferInput = {
      id: created.id,
      name: 'Updated Summer Sale',
      discount_value: 25,
      is_active: false
    };

    const result = await updatePromoOffer(updateInput);

    expect(result.name).toEqual('Updated Summer Sale');
    expect(result.discount_value).toEqual(25);
    expect(result.is_active).toBe(false);
    expect(result.code).toEqual('SUMMER20'); // Unchanged
    expect(typeof result.discount_value).toEqual('number');
  });

  it('should update nullable fields to null', async () => {
    const created = await createPromoOffer(testPromoInput);

    const updateInput: UpdatePromoOfferInput = {
      id: created.id,
      min_booking_amount: null,
      max_discount: null
    };

    const result = await updatePromoOffer(updateInput);

    expect(result.min_booking_amount).toBeNull();
    expect(result.max_discount).toBeNull();
  });
});

describe('validatePromoCode', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should validate percentage discount code', async () => {
    const activeOffer = {
      ...testPromoInput,
      valid_from: new Date(Date.now() - 86400000), // Yesterday
      valid_until: new Date(Date.now() + 86400000), // Tomorrow
    };
    await createPromoOffer(activeOffer);

    const result = await validatePromoCode('SUMMER20', 200);

    expect(result.valid).toBe(true);
    expect(result.discount).toEqual(40); // 20% of 200
    expect(result.offer).not.toBeNull();
    expect(result.offer!.code).toEqual('SUMMER20');
  });

  it('should validate fixed discount code', async () => {
    const activeOffer = {
      ...testFixedDiscountInput,
      valid_from: new Date(Date.now() - 86400000), // Yesterday
      valid_until: new Date(Date.now() + 86400000), // Tomorrow
    };
    await createPromoOffer(activeOffer);

    const result = await validatePromoCode('FIXED10', 50);

    expect(result.valid).toBe(true);
    expect(result.discount).toEqual(10);
    expect(result.offer!.discount_type).toEqual('fixed');
  });

  it('should apply maximum discount limit', async () => {
    const activeOffer = {
      ...testPromoInput,
      valid_from: new Date(Date.now() - 86400000), // Yesterday
      valid_until: new Date(Date.now() + 86400000), // Tomorrow
    };
    await createPromoOffer(activeOffer);

    const result = await validatePromoCode('SUMMER20', 500); // 20% would be 100, but max is 50

    expect(result.valid).toBe(true);
    expect(result.discount).toEqual(50); // Capped at max_discount
  });

  it('should reject invalid code', async () => {
    const result = await validatePromoCode('INVALID', 100);

    expect(result.valid).toBe(false);
    expect(result.discount).toEqual(0);
    expect(result.offer).toBeNull();
  });

  it('should reject if booking amount below minimum', async () => {
    const activeOffer = {
      ...testPromoInput,
      valid_from: new Date(Date.now() - 86400000), // Yesterday
      valid_until: new Date(Date.now() + 86400000), // Tomorrow
    };
    await createPromoOffer(activeOffer);

    const result = await validatePromoCode('SUMMER20', 50); // Below min_booking_amount of 100

    expect(result.valid).toBe(false);
    expect(result.discount).toEqual(0);
  });

  it('should reject expired code', async () => {
    const expiredOffer = {
      ...testPromoInput,
      valid_from: new Date('2023-01-01'),
      valid_until: new Date('2023-01-31')
    };
    await createPromoOffer(expiredOffer);

    const result = await validatePromoCode('SUMMER20', 200);

    expect(result.valid).toBe(false);
    expect(result.discount).toEqual(0);
  });
});

describe('usePromoCode', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should increment used_count', async () => {
    await createPromoOffer(testPromoInput);

    const result = await usePromoCode('SUMMER20');

    expect(result.used_count).toEqual(1);
    expect(result.code).toEqual('SUMMER20');
    expect(typeof result.discount_value).toEqual('number');

    // Verify in database
    const dbOffer = await db.select()
      .from(promoOffersTable)
      .where(eq(promoOffersTable.code, 'SUMMER20'))
      .execute();

    expect(dbOffer[0].used_count).toEqual(1);
  });
});
