import type { VehicleType } from '@/api';

type Models = Partial<Record<VehicleType, readonly string[]>>;

/**
 * Vehicle brands and their models, grouped by body type, for the Brand / Model pickers
 * (Indian market, current plus common older models). The type is saved with the car, so it is
 * picked automatically from the model. MPVs count as SUVs and pick-ups as trucks, since that's
 * how they're sized for a wash. Anything missing can still be typed in — the pickers accept custom values.
 */
const CATALOG: Record<string, Models> = {
  'Maruti Suzuki': {
    HATCHBACK: ['800', 'A-Star', 'Alto', 'Alto 800', 'Alto K10', 'Baleno', 'Celerio', 'Ignis', 'Ritz', 'S-Presso', 'Swift', 'Wagon R', 'Zen', 'Zen Estilo'],
    SEDAN: ['Ciaz', 'Dzire', 'Esteem'],
    SUV: ['Brezza', 'Ertiga', 'Fronx', 'Grand Vitara', 'Gypsy', 'Invicto', 'Jimny', 'S-Cross', 'Vitara Brezza', 'XL6'],
    VAN: ['Eeco', 'Omni'],
  },
  Hyundai: {
    HATCHBACK: ['Eon', 'Getz', 'Grand i10', 'Grand i10 Nios', 'i10', 'i20', 'Santro'],
    SEDAN: ['Accent', 'Aura', 'Elantra', 'Sonata', 'Verna', 'Xcent'],
    SUV: ['Alcazar', 'Creta', 'Exter', 'Ioniq 5', 'Kona Electric', 'Santa Fe', 'Tucson', 'Venue'],
  },
  Tata: {
    HATCHBACK: ['Altroz', 'Bolt', 'Indica', 'Nano', 'Tiago', 'Tiago EV'],
    SEDAN: ['Indigo', 'Tigor', 'Tigor EV', 'Zest'],
    SUV: ['Aria', 'Curvv', 'Harrier', 'Hexa', 'Nexon', 'Nexon EV', 'Punch', 'Punch EV', 'Safari', 'Sumo'],
    TRUCK: ['Ace', 'Intra', 'Yodha'],
  },
  Mahindra: {
    SEDAN: ['Verito'],
    SUV: [
      'BE 6', 'Bolero', 'Bolero Neo', 'KUV100', 'Marazzo', 'Quanto', 'Scorpio', 'Scorpio Classic', 'Scorpio-N', 'Thar',
      'Thar Roxx', 'TUV300', 'XEV 9e', 'XUV 3XO', 'XUV300', 'XUV400', 'XUV500', 'XUV700', 'Xylo',
    ],
    TRUCK: ['Bolero Pik-Up'],
    VAN: ['Supro'],
  },
  Toyota: {
    HATCHBACK: ['Etios Liva', 'Glanza'],
    SEDAN: ['Camry', 'Corolla', 'Corolla Altis', 'Etios', 'Yaris'],
    SUV: ['Fortuner', 'Innova', 'Innova Crysta', 'Innova Hycross', 'Land Cruiser', 'Qualis', 'Rumion', 'Urban Cruiser', 'Urban Cruiser Hyryder'],
    TRUCK: ['Hilux'],
    VAN: ['Vellfire'],
  },
  Honda: {
    HATCHBACK: ['Brio', 'Jazz'],
    SEDAN: ['Amaze', 'City', 'Civic'],
    SUV: ['BR-V', 'CR-V', 'Elevate', 'Mobilio', 'WR-V'],
  },
  Kia: { SUV: ['Carens', 'EV6', 'Seltos', 'Sonet', 'Syros'], VAN: ['Carnival'] },
  Renault: { HATCHBACK: ['Kwid', 'Pulse', 'Triber'], SEDAN: ['Scala'], SUV: ['Duster', 'Kiger', 'Lodgy'] },
  Nissan: { HATCHBACK: ['Micra'], SEDAN: ['Sunny'], SUV: ['Kicks', 'Magnite', 'Terrano', 'X-Trail'] },
  Volkswagen: { HATCHBACK: ['Polo'], SEDAN: ['Ameo', 'Jetta', 'Passat', 'Vento', 'Virtus'], SUV: ['Taigun', 'Tiguan'] },
  Skoda: { HATCHBACK: ['Fabia'], SEDAN: ['Laura', 'Octavia', 'Rapid', 'Slavia', 'Superb'], SUV: ['Kodiaq', 'Kushaq', 'Kylaq', 'Yeti'] },
  Ford: { HATCHBACK: ['Figo', 'Freestyle'], SEDAN: ['Fiesta', 'Figo Aspire', 'Ikon'], SUV: ['EcoSport', 'Endeavour'] },
  Chevrolet: { HATCHBACK: ['Beat', 'Spark'], SEDAN: ['Aveo', 'Cruze', 'Sail'], SUV: ['Enjoy', 'Tavera', 'Trailblazer'] },
  MG: { HATCHBACK: ['Comet EV'], SUV: ['Astor', 'Gloster', 'Hector', 'Hector Plus', 'Windsor EV', 'ZS EV'] },
  Citroen: { HATCHBACK: ['C3', 'eC3'], SUV: ['Aircross', 'Basalt', 'C5 Aircross'] },
  Jeep: { SUV: ['Compass', 'Grand Cherokee', 'Meridian', 'Wrangler'] },
  Fiat: { HATCHBACK: ['Palio', 'Punto'], SEDAN: ['Linea'], SUV: ['Avventura'] },
  'Mercedes-Benz': { SEDAN: ['A-Class', 'C-Class', 'E-Class', 'EQS', 'S-Class'], SUV: ['G-Class', 'GLA', 'GLC', 'GLE', 'GLS'] },
  BMW: { HATCHBACK: ['1 Series'], SEDAN: ['2 Series', '3 Series', '5 Series', '7 Series', 'i4'], SUV: ['iX', 'X1', 'X3', 'X5', 'X7'] },
  Audi: { SEDAN: ['A3', 'A4', 'A6', 'A8'], SUV: ['e-tron', 'Q2', 'Q3', 'Q5', 'Q7', 'Q8'] },
  Volvo: { SEDAN: ['S60', 'S90'], SUV: ['C40 Recharge', 'XC40', 'XC60', 'XC90'] },
  'Land Rover': {
    SUV: ['Defender', 'Discovery', 'Discovery Sport', 'Range Rover', 'Range Rover Evoque', 'Range Rover Sport', 'Range Rover Velar'],
  },
  Jaguar: { SEDAN: ['XE', 'XF'], SUV: ['F-Pace'] },
  Lexus: { SEDAN: ['ES'], SUV: ['LX', 'NX', 'RX'] },
  Porsche: { SEDAN: ['Panamera', 'Taycan'], SUV: ['Cayenne', 'Macan'], OTHER: ['911'] },
  BYD: { SEDAN: ['Seal'], SUV: ['Atto 3', 'e6', 'Sealion 7'] },
  Isuzu: { SUV: ['MU-X'], TRUCK: ['D-Max', 'D-Max V-Cross'] },
  Force: { SUV: ['Gurkha', 'Trax'], VAN: ['Traveller', 'Urbania'] },
  'Ashok Leyland': { TRUCK: ['Bada Dost', 'Dost', 'Partner'] },
  Eicher: { TRUCK: ['Pro 2049', 'Pro 2059', 'Pro 3015'] },
  'Hindustan Motors': { SEDAN: ['Ambassador', 'Contessa'] },
  'Royal Enfield': {
    MOTORCYCLE: ['Bullet 350', 'Classic 350', 'Continental GT 650', 'Himalayan', 'Hunter 350', 'Interceptor 650', 'Meteor 350'],
  },
  'Honda Two Wheelers': { MOTORCYCLE: ['Activa', 'CB Shine', 'CB350', 'Dio', 'Hornet', 'SP 125', 'Unicorn'] },
  'Hero MotoCorp': { MOTORCYCLE: ['Destini', 'Glamour', 'HF Deluxe', 'Passion', 'Pleasure', 'Splendor', 'Xpulse', 'Xtreme'] },
  Bajaj: { MOTORCYCLE: ['Avenger', 'CT 100', 'Chetak', 'Dominar', 'Platina', 'Pulsar'] },
  TVS: { MOTORCYCLE: ['Apache', 'iQube', 'Jupiter', 'Ntorq', 'Raider', 'Ronin', 'Scooty Pep', 'XL100'] },
  Yamaha: { MOTORCYCLE: ['Aerox', 'Fascino', 'FZ', 'MT-15', 'R15', 'RayZR'] },
  'Suzuki Two Wheelers': { MOTORCYCLE: ['Access 125', 'Avenis', 'Burgman Street', 'Gixxer', 'V-Strom SX'] },
  KTM: { MOTORCYCLE: ['Adventure 390', 'Duke 200', 'Duke 390', 'RC 200', 'RC 390'] },
  Ather: { MOTORCYCLE: ['450S', '450X', 'Rizta'] },
  Ola: { MOTORCYCLE: ['S1 Air', 'S1 Pro', 'S1 X'] },
};

export const VEHICLE_BRANDS = Object.keys(CATALOG);

const byType = (brand: string) => Object.entries(CATALOG[brand] ?? {}) as [VehicleType, readonly string[]][];

export const modelsFor = (brand: string): string[] =>
  byType(brand)
    .flatMap(([, models]) => models)
    .sort((a, b) => a.localeCompare(b));

/**
 * Body type for a brand + model. Models not in the list get the brand's type when the brand only
 * makes one kind (e.g. any Royal Enfield is a motorcycle); otherwise it's left unset.
 */
export function vehicleTypeFor(brand: string, model: string): VehicleType | undefined {
  const groups = byType(brand);
  const m = model.trim().toLowerCase();
  const hit = groups.find(([, models]) => models.some((x) => x.toLowerCase() === m));
  if (hit) return hit[0];
  return groups.length === 1 ? groups[0][0] : undefined;
}

/** "HATCHBACK" → "Hatchback"; "SUV" stays as is. */
export const vehicleTypeLabel = (t: VehicleType) => (t === 'SUV' ? t : t.charAt(0) + t.slice(1).toLowerCase());
