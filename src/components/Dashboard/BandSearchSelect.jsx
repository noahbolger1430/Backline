import React, { useState, useEffect, useRef } from "react";
import { bandService } from "../../services/bandService";
import "./Dashboard.css";

const BandSearchSelect = ({ selectedBands, onBandsChange }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [bands, setBands] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    // Close dropdown when clicking outside
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (searchTerm.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchBands(searchTerm);
      }, 300);
    } else if (searchTerm.trim().length === 0) {
      setBands([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm]);

  const searchBands = async (term) => {
    try {
      setLoading(true);
      const results = await bandService.searchBands(term);
      // Filter out already selected bands
      const filtered = results.filter(
        (band) => !selectedBands.some((selected) => selected.id === band.id)
      );
      setBands(filtered);
      setIsOpen(true);
    } catch (error) {
      console.error("Error searching bands:", error);
      setBands([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBand = (band) => {
    if (!selectedBands.some((b) => b.id === band.id)) {
      onBandsChange([...selectedBands, band]);
    }
    setSearchTerm("");
    setBands([]);
    setIsOpen(false);
  };

  const handleRemoveBand = (bandId) => {
    onBandsChange(selectedBands.filter((b) => b.id !== bandId));
  };

  return (
    <div className="band-search-select" ref={dropdownRef}>
      <label htmlFor="band-search">Bands</label>
      <div className="band-search-input-container">
        <input
          type="text"
          id="band-search"
          className="band-search-input"
          placeholder="Search for bands to add..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => {
            if (bands.length > 0) setIsOpen(true);
          }}
        />
        {loading && <div className="band-search-loading">Searching...</div>}
      </div>

      {isOpen && bands.length > 0 && (
        <div className="band-search-dropdown">
          {bands.map((band) => (
            <div
              key={band.id}
              className="band-search-option"
              onClick={() => handleSelectBand(band)}
            >
              <div className="band-search-option-name">{band.name}</div>
              {band.genre && (
                <div className="band-search-option-genre">{band.genre}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedBands.length > 0 && (
        <div className="selected-bands-list">
          {selectedBands.map((band) => (
            <div key={band.id} className="selected-band-tag">
              <span>{band.name}</span>
              <button
                type="button"
                className="remove-band-button"
                onClick={() => handleRemoveBand(band.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default BandSearchSelect;

