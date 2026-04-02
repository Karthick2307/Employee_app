import { useId, useMemo, useState } from "react";

const normalizeValue = (value) => String(value ?? "");

const getOptionValue = (option) => normalizeValue(option?.value ?? option?._id);
const getOptionLabel = (option) => option?.label || option?.name || getOptionValue(option);
const getOptionDescription = (option) => option?.description || "";

export default function SearchableCheckboxSelector({
  label,
  helperText = "",
  options = [],
  selectedValues = [],
  onChange,
  searchPlaceholder,
  emptyMessage = "No options available.",
  noResultsMessage = "No matching options found.",
  disabled = false,
}) {
  const searchId = useId();
  const [query, setQuery] = useState("");

  const normalizedSelectedValues = useMemo(
    () => (selectedValues || []).map(normalizeValue),
    [selectedValues]
  );
  const selectedSet = useMemo(
    () => new Set(normalizedSelectedValues),
    [normalizedSelectedValues]
  );
  const normalizedOptions = useMemo(
    () =>
      (options || []).map((option) => ({
        ...option,
        value: getOptionValue(option),
        label: getOptionLabel(option),
        description: getOptionDescription(option),
      })),
    [options]
  );
  const filteredOptions = useMemo(() => {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      return normalizedOptions;
    }

    return normalizedOptions.filter((option) =>
      [option.label, option.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(trimmedQuery))
    );
  }, [normalizedOptions, query]);
  const selectedLabels = useMemo(
    () =>
      normalizedOptions
        .filter((option) => selectedSet.has(option.value))
        .map((option) => option.label),
    [normalizedOptions, selectedSet]
  );

  const allFilteredSelected =
    filteredOptions.length > 0 && filteredOptions.every((option) => selectedSet.has(option.value));

  const toggleValue = (value) => {
    const normalizedValue = normalizeValue(value);

    onChange(
      selectedSet.has(normalizedValue)
        ? normalizedSelectedValues.filter((selectedValue) => selectedValue !== normalizedValue)
        : [...normalizedSelectedValues, normalizedValue]
    );
  };

  const toggleFilteredOptions = () => {
    const filteredValues = filteredOptions.map((option) => option.value);

    if (allFilteredSelected) {
      onChange(
        normalizedSelectedValues.filter((selectedValue) => !filteredValues.includes(selectedValue))
      );
      return;
    }

    const nextValues = new Set(normalizedSelectedValues);
    filteredValues.forEach((value) => nextValues.add(value));
    onChange(Array.from(nextValues));
  };

  const clearSelection = () => {
    onChange([]);
  };

  const previewLabels = selectedLabels.slice(0, 4);
  const hiddenCount = Math.max(selectedLabels.length - previewLabels.length, 0);

  return (
    <div className={`selection-panel ${disabled ? "selection-panel--disabled" : ""}`}>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <div className="form-label fw-semibold mb-1">{label}</div>
          {helperText ? <div className="form-help">{helperText}</div> : null}
        </div>

        <span className="selection-count-badge">
          {normalizedSelectedValues.length} selected
        </span>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-lg">
          <label className="visually-hidden" htmlFor={searchId}>
            Search {label}
          </label>
          <input
            id={searchId}
            type="text"
            className="form-control"
            placeholder={searchPlaceholder || `Search ${label.toLowerCase()}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={disabled}
          />
        </div>

        <div className="col-lg-auto d-flex flex-wrap gap-2 selection-panel__actions">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={toggleFilteredOptions}
            disabled={disabled || !filteredOptions.length}
          >
            {allFilteredSelected ? "Clear shown" : "Select shown"}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={clearSelection}
            disabled={disabled || !normalizedSelectedValues.length}
          >
            Clear all
          </button>
        </div>
      </div>

      {previewLabels.length ? (
        <div className="d-flex flex-wrap gap-2 mb-3">
          {previewLabels.map((selectedLabel) => (
            <span className="selection-chip" key={selectedLabel}>
              {selectedLabel}
            </span>
          ))}
          {hiddenCount ? <span className="selection-chip">+{hiddenCount} more</span> : null}
        </div>
      ) : null}

      <div className="selection-panel__list">
        {!normalizedOptions.length ? (
          <div className="empty-state small py-4">{emptyMessage}</div>
        ) : !filteredOptions.length ? (
          <div className="empty-state small py-4">{noResultsMessage}</div>
        ) : (
          filteredOptions.map((option) => {
            const checked = selectedSet.has(option.value);

            return (
              <label
                key={option.value}
                className={`selection-option ${checked ? "selection-option--active" : ""}`}
              >
                <input
                  className="form-check-input mt-1"
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggleValue(option.value)}
                />
                <span className="selection-option__body">
                  <span className="selection-option__label">{option.label}</span>
                  {option.description ? (
                    <span className="selection-option__meta">{option.description}</span>
                  ) : null}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
