'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGoogleMaps } from '@/lib/useGoogleMaps';

declare global {
  interface Window {
    google: any;
  }
}

interface SearchBarProps {
  onSearchResult?: (lat: number, lng: number, address: string) => void;
  placeholder?: string;
  value?: string;
  onClear?: () => void;
  showClearButton?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({ 
  onSearchResult,
  placeholder = 'Enter your location to find centers near you...',
  value,
  onClear,
  showClearButton = false
}) => {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(value || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const { isLoaded, loadError, hasValidKey } = useGoogleMaps();
  
  useEffect(() => {
    // Only initialize autocomplete after Google Maps is loaded
    if (isLoaded && inputRef.current) {
      initAutocomplete();
    }
  }, [isLoaded]);
  
  useEffect(() => {
    // Initialize from URL parameters
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const addressParam = params.get('address');
      
      if (addressParam) {
        setInputValue(decodeURIComponent(addressParam));
      }
    }
  }, []);
  
  // Update internal state when value prop changes
  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value);
    }
  }, [value]);
  
  const initAutocomplete = () => {
    if (!inputRef.current || !window.google?.maps?.places) return;
    
    try {
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'in' },
        fields: ['geometry', 'formatted_address'],
      });
      
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry || !place.geometry.location) {
          console.error('No details available for the place you searched');
          return;
        }
        
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const address = place.formatted_address;
        
        // Update input value to match selected place
        setInputValue(address);
        
        if (onSearchResult) {
          onSearchResult(lat, lng, address);
        } else {
          // Navigate to results page with query params
          router.push(`/centers?lat=${lat}&lng=${lng}&address=${encodeURIComponent(address)}`);
          
          // Also update URL for shareability without page reload
          const url = `/centers?lat=${lat}&lng=${lng}&address=${encodeURIComponent(address)}`;
          window.history.pushState({ path: url }, '', url);
        }
      });
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error);
    }
  };
  
  const handleGetCurrentLocation = () => {
    setIsLocating(true);
    setLocationError(null);
    
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setIsLocating(false);
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          
          // Try to get address from coordinates using Google's Geocoding API
          let address = "Current Location";
          
          if (window.google?.maps?.Geocoder) {
            const geocoder = new window.google.maps.Geocoder();
            const response = await new Promise((resolve, reject) => {
              geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results: any, status: any) => {
                if (status === "OK" && results[0]) {
                  resolve(results[0].formatted_address);
                } else {
                  reject("Unable to find address for this location");
                }
              });
            });
            
            address = response as string;
            
            // Update the input field with the resolved address
            if (inputRef.current) {
              inputRef.current.value = address;
              setInputValue(address);
            }
          }
          
          if (onSearchResult) {
            onSearchResult(latitude, longitude, address);
          } else {
            // Navigate to results page with query params
            router.push(`/centers?lat=${latitude}&lng=${longitude}&address=${encodeURIComponent(address)}`);
            
            // Also update URL for shareability without page reload
            const url = `/centers?lat=${latitude}&lng=${longitude}&address=${encodeURIComponent(address)}`;
            window.history.pushState({ path: url }, '', url);
          }
          
          setIsLocating(false);
        } catch (error) {
          console.error("Error getting location address:", error);
          setLocationError("Could not determine your address");
          setIsLocating(false);
        }
      },
      (error) => {
        console.error("Error getting location:", error);
        let errorMessage = "Failed to get your location";
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied. Please allow location access in your browser.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }
        
        setLocationError(errorMessage);
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };
  
  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };
  
  // Show loading state while Google Maps is loading
  useEffect(() => {
    setIsLoading(!isLoaded);
  }, [isLoaded]);
  
  return (
    <div className="w-full relative">
      <div className="relative flex-grow">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          className="w-full p-4 pr-10 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#FF7F50] focus:border-transparent"
          placeholder={!hasValidKey ? "Location search unavailable (API key missing)" : placeholder}
          disabled={isLoading || !hasValidKey || !!loadError}
        />
        
        <div className="absolute right-3 top-4">
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#FF7F50]"></div>
          ) : showClearButton && inputValue ? (
            <button 
              onClick={onClear}
              className="focus:outline-none"
              aria-label="Clear search"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 hover:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : (
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-6 w-6 text-gray-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" 
              />
            </svg>
          )}
        </div>
      </div>
      
      {locationError && (
        <div className="absolute -bottom-6 left-0 text-red-500 text-sm">
          {locationError}
        </div>
      )}
      
      {!hasValidKey && (
        <p className="mt-2 text-xs text-red-500">
          Google Maps API key is missing or invalid. Please add a valid key to enable location search.
        </p>
      )}
      
      {loadError && (
        <p className="mt-2 text-xs text-red-500">
          Failed to load Google Maps. Please try again later.
        </p>
      )}
    </div>
  );
};

export default SearchBar; 