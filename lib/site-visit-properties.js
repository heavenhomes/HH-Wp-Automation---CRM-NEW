import Property from '@/lib/models/Property';

export function getSiteVisitPropertyIds(body) {
  if (body.propertyIds !== undefined && !Array.isArray(body.propertyIds)) return null;
  const ids = Array.isArray(body.propertyIds)
    ? body.propertyIds
    : body.propertyId
      ? [body.propertyId]
      : [];
  if (!ids.length || ids.some((id) => typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id))) {
    return null;
  }
  return [...new Set(ids.map((id) => id.toLowerCase()))];
}

export async function findAvailableSiteVisitProperties(ids) {
  const properties = await Property.find({
    _id: { $in: ids },
    status: 'available',
  }).lean();
  const propertyById = new Map(properties.map((property) => [String(property._id), property]));
  return ids.map((id) => propertyById.get(id)).filter(Boolean);
}
