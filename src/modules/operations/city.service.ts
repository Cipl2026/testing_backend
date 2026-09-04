import { ErrorCode } from '@ghaarfix/shared-types';
import { slugify } from '@/utils/catalog.js';
import { AppError } from '@/utils/AppError.js';
import { City, type ICity } from '@/models/City.js';

function serializeCity(city: ICity) {
  return {
    id: city._id.toString(),
    name: city.name,
    slug: city.slug,
    state: city.state,
    country: city.country,
    center: city.center,
    isActive: city.isActive,
  };
}

export async function listCities(activeOnly = true) {
  const filter = activeOnly ? { isActive: true } : {};
  const cities = await City.find(filter).sort({ name: 1 });
  return cities.map(serializeCity);
}

export async function getCityById(id: string) {
  const city = await City.findById(id);
  if (!city) throw new AppError('City not found.', 404, ErrorCode.NOT_FOUND);
  return serializeCity(city);
}

export async function createCity(input: {
  name: string;
  state: string;
  country?: string;
  center?: { latitude: number; longitude: number };
  isActive?: boolean;
}) {
  const slug = slugify(input.name);
  const existing = await City.findOne({ slug });
  if (existing) throw new AppError('City already exists.', 409, ErrorCode.CONFLICT);
  const city = await City.create({
    name: input.name,
    slug,
    state: input.state,
    country: input.country ?? 'IN',
    center: input.center,
    isActive: input.isActive ?? true,
  });
  return serializeCity(city);
}

export async function updateCity(
  id: string,
  input: Partial<{
    name: string;
    state: string;
    country: string;
    center: { latitude: number; longitude: number };
    isActive: boolean;
  }>,
) {
  const city = await City.findById(id);
  if (!city) throw new AppError('City not found.', 404, ErrorCode.NOT_FOUND);
  if (input.name) {
    city.name = input.name;
    city.slug = slugify(input.name);
  }
  if (input.state !== undefined) city.state = input.state;
  if (input.country !== undefined) city.country = input.country;
  if (input.center !== undefined) city.center = input.center;
  if (input.isActive !== undefined) city.isActive = input.isActive;
  await city.save();
  return serializeCity(city);
}

export async function deleteCity(id: string) {
  const city = await City.findByIdAndDelete(id);
  if (!city) throw new AppError('City not found.', 404, ErrorCode.NOT_FOUND);
}
