export default function PropertyMultiSelect({
  properties,
  value = [],
  onChange,
  disabled = false,
}) {
  const selectedIds = Array.isArray(value) ? value.map(String) : [];

  const toggleProperty = (propertyId) => {
    const id = String(propertyId);
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id]
    );
  };

  return (
    <div className="space-y-2">
      <div className="max-h-52 overflow-y-auto rounded-xl border border-[#e8f0e6] bg-white p-2">
        {properties.length ? properties.map((property) => {
          const id = String(property._id);
          return (
            <label
              key={id}
              className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 text-sm text-[#1a2e1a] hover:bg-[#fafffa]"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(id)}
                onChange={() => toggleProperty(id)}
                disabled={disabled}
                className="mt-0.5 accent-[#2d7a3a]"
              />
              <span>{property.title}{property.propertyId ? ` · ${property.propertyId}` : ''}</span>
            </label>
          );
        }) : (
          <p className="px-2 py-3 text-sm text-[#6a7f6a]">No available properties</p>
        )}
      </div>
      <p className="text-xs text-[#6a7f6a]">
        {selectedIds.length} {selectedIds.length === 1 ? 'property' : 'properties'} selected
      </p>
    </div>
  );
}
