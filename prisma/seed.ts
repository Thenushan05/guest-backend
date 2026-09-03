import { PrismaClient, Role, UserStatus, RoomStatus, DiscountType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Seeding database...');

  // ---------------- Admin user ----------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@guesthouse.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      firstName: 'Guest House',
      lastName: 'Admin',
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, SALT_ROUNDS),
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`✔ Admin user ready: ${admin.email}`);

  // ---------------- Sample customer ----------------
  const customer = await prisma.user.upsert({
    where: { email: 'customer@example.com' },
    update: {},
    create: {
      firstName: 'Jane',
      lastName: 'Customer',
      email: 'customer@example.com',
      phone: '+94770000000',
      passwordHash: await bcrypt.hash('Customer@12345', SALT_ROUNDS),
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`✔ Sample customer ready: ${customer.email}`);

  // ---------------- Room types ----------------
  const roomTypeNames = [
    { name: 'Standard Room', description: 'Comfortable and affordable, perfect for solo travelers or couples.' },
    { name: 'Deluxe Room', description: 'Extra space and premium furnishings with a scenic view.' },
    { name: 'Family Room', description: 'Spacious room designed to comfortably accommodate families.' },
    { name: 'Suite', description: 'Our most luxurious accommodation with a separate living area.' },
  ];

  const roomTypes = [];
  for (const rt of roomTypeNames) {
    roomTypes.push(
      await prisma.roomType.upsert({
        where: { name: rt.name },
        update: {},
        create: rt,
      }),
    );
  }
  console.log(`✔ ${roomTypes.length} room types ready`);

  // ---------------- Facilities ----------------
  const facilityDefs = [
    { name: 'WiFi', icon: 'wifi' },
    { name: 'Air Conditioning', icon: 'snowflake' },
    { name: 'TV', icon: 'tv' },
    { name: 'Hot Water', icon: 'droplet' },
    { name: 'Parking', icon: 'car' },
    { name: 'Balcony', icon: 'door-open' },
    { name: 'Kitchen', icon: 'utensils' },
    { name: 'Swimming Pool', icon: 'waves' },
  ];

  const facilities: { id: string; name: string }[] = [];
  for (const f of facilityDefs) {
    facilities.push(
      await prisma.facility.upsert({
        where: { name: f.name },
        update: {},
        create: f,
      }),
    );
  }
  console.log(`✔ ${facilities.length} facilities ready`);

const facilityByName = (name: string) => facilities.find((f) => f.name === name)!.id;
  // ---------------- Rooms ----------------
  const roomDefs = [
    {
      roomNumber: '101',
      name: 'Cozy Standard Room',
      description: 'A cozy room ideal for short stays.',
      roomTypeId: roomTypes[0].id,
      pricePerNight: 8000,
      maximumGuests: 2,
      numberOfBeds: 1,
      numberOfBathrooms: 1,
      roomSize: 180,
      facilities: ['WiFi', 'Air Conditioning', 'Hot Water'],
    },
    {
      roomNumber: '201',
      name: 'Garden View Deluxe',
      description: 'Deluxe room overlooking the garden with a private balcony.',
      roomTypeId: roomTypes[1].id,
      pricePerNight: 14000,
      maximumGuests: 3,
      numberOfBeds: 1,
      numberOfBathrooms: 1,
      roomSize: 320,
      facilities: ['WiFi', 'Air Conditioning', 'TV', 'Hot Water', 'Balcony'],
    },
    {
      roomNumber: '301',
      name: 'Family Comfort Room',
      description: 'Spacious family room with two queen beds.',
      roomTypeId: roomTypes[2].id,
      pricePerNight: 20000,
      maximumGuests: 5,
      numberOfBeds: 2,
      numberOfBathrooms: 2,
      roomSize: 450,
      facilities: ['WiFi', 'Air Conditioning', 'TV', 'Hot Water', 'Parking', 'Kitchen'],
    },
    {
      roomNumber: '401',
      name: 'Presidential Suite',
      description: 'Our finest suite with a private living room and pool access.',
      roomTypeId: roomTypes[3].id,
      pricePerNight: 35000,
      maximumGuests: 4,
      numberOfBeds: 2,
      numberOfBathrooms: 2,
      roomSize: 650,
      status: RoomStatus.AVAILABLE,
      facilities: ['WiFi', 'Air Conditioning', 'TV', 'Hot Water', 'Parking', 'Balcony', 'Swimming Pool'],
    },
    {
      roomNumber: '102',
      name: 'Standard Room Under Maintenance',
      description: 'Temporarily unavailable while we refresh the fittings.',
      roomTypeId: roomTypes[0].id,
      pricePerNight: 8000,
      maximumGuests: 2,
      numberOfBeds: 1,
      numberOfBathrooms: 1,
      roomSize: 180,
      status: RoomStatus.MAINTENANCE,
      facilities: ['WiFi', 'Air Conditioning'],
    },
  ];

  for (const def of roomDefs) {
    const { facilities: facilityNames, ...roomData } = def;
    const room = await prisma.room.upsert({
      where: { roomNumber: def.roomNumber },
      update: {},
      create: {
        ...roomData,
        facilities: {
          create: facilityNames.map((name) => ({ facilityId: facilityByName(name) })),
        },
      },
    });
    console.log(`✔ Room ready: ${room.roomNumber} - ${room.name}`);
  }

  // ---------------- Offer ----------------
  const now = new Date();
  const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0));

  await prisma.offer.upsert({
    where: { id: 'seed-early-bird-offer' },
    update: {},
    create: {
      id: 'seed-early-bird-offer',
      title: 'Early Bird Special',
      description: 'Book 2 nights or more and save 10% on your stay.',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      startDate,
      endDate,
      minimumNights: 2,
      isActive: true,
    },
  });
  console.log('✔ Sample offer ready');

  console.log('🌱 Seeding complete.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
