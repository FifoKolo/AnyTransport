# Mapbox Setup Guide for AnyTransport

## Overview
The create-job.html form now uses **Mapbox GL JS** to display an interactive map for route visualization. This replaces the previous Google Maps implementation.

## Quick Start

### 1. Get Your Mapbox Access Token
1. Visit [Mapbox Account Tokens](https://account.mapbox.com/tokens/)
2. Sign up or log in to your Mapbox account
3. Create a new **Public token** (if you don't have one)
4. Copy your access token

### 2. Add Token to Your Project
Open `js/create-job.js` and find the `initRoutePlanner()` function (around line 475).

Replace this line:
```javascript
mapboxgl.accessToken = 'pk.eyJ1IjoibWluY3JhZnQiLCJhIjoiY201Zjlpajhq'; // Replace with your actual token
```

With your actual token:
```javascript
mapboxgl.accessToken = 'pk.YOUR_ACTUAL_TOKEN_HERE';
```

### 3. Test the Map
1. Open `create-job.html` in your browser
2. Fill in pickup and delivery addresses
3. The map should display the route automatically

## Features Implemented

✅ **Eircode & City Area Autocomplete**
- Combined "City Area or Eircode" fields use Mapbox Geocoding API
- Partial Eircode typing (e.g. `D02`, `D02 X285`) shows Irish postcode suggestions
- City areas and localities (e.g. `Ballinteer`, `Galway`) also suggest while typing
- Full Eircode lookup geocodes coordinates for route calculation

✅ **Interactive Map Display**
- Mapbox GL JS v2.14.1 integrated
- Street map style with navigation controls

✅ **Route Visualization**
- Geocodes addresses to coordinates using Mapbox Geocoding API
- Calculates driving route using Mapbox Directions API
- Displays route as a blue line on the map
- Green marker for pickup location
- Red marker for delivery location

✅ **Distance & Duration Calculation**
- Extracts distance in kilometers from API response
- Calculates estimated travel duration
- Updates the form with calculated values
- Estimates price based on distance

✅ **Error Handling**
- Falls back to basic estimation if geocoding fails
- Handles missing API responses gracefully
- Provides console logging for debugging

## API Endpoints Used

1. **Mapbox Geocoding API**
   ```
   https://api.mapbox.com/geocoding/v5/mapbox.places/{address}.json
   ```
   - Converts addresses to [longitude, latitude] coordinates
   - Limited to Ireland and UK

2. **Mapbox Directions API**
   ```
   https://api.mapbox.com/directions/v5/mapbox/driving/{start};{end}
   ```
   - Calculates driving distance and duration
   - Returns GeoJSON route geometry

## Customization Options

### Change Map Style
In `initRoutePlanner()`, modify the style:
```javascript
style: 'mapbox://styles/mapbox/streets-v12', // Current
// Other options:
// 'mapbox://styles/mapbox/outdoors-v12'
// 'mapbox://styles/mapbox/light-v11'
// 'mapbox://styles/mapbox/dark-v11'
// 'mapbox://styles/mapbox/satellite-v9'
```

### Change Default Map Center
```javascript
center: [-6.2603, 53.3498], // Dublin [longitude, latitude]
```

### Change Default Zoom Level
```javascript
zoom: 7, // Adjust as needed (0-24)
```

### Customize Marker Colors
In `drawMapRoute()`:
```javascript
// Pickup marker
new mapboxgl.Marker({ color: '#10B981' }) // Green

// Delivery marker
new mapboxgl.Marker({ color: '#EF4444' }) // Red
```

## Pricing Configuration

The route distance is used to calculate quotes. Modify `priceConfig` in the form initialization:
```javascript
const priceConfig = {
    base: 15,      // Base price in €
    perKm: 1.5,    // Price per kilometer
    minimum: 25    // Minimum price
};
```

## Troubleshooting

### Map doesn't display
- Check that you've added your Mapbox access token
- Open browser console (F12) and look for errors
- Verify the access token is valid and not revoked

### Routes not showing
- Ensure addresses are in Ireland (IE) or UK (GB)
- Check browser console for geocoding errors
- Try entering full address with city and postcode

### High API usage
- Mapbox Geocoding API: ~$0.50 per 1000 requests
- Mapbox Directions API: ~$0.60 per 1000 requests
- Monitor usage in your Mapbox account dashboard

## Files Modified

- `create-job.html` - Added Mapbox CSS/JS libraries and map container
- `js/create-job.js` - Implemented Mapbox integration
- `css/create-job.css` - Updated map card styling

## Next Steps

1. Add your Mapbox token
2. Test with various addresses
3. Monitor Mapbox API usage
4. Consider implementing caching to reduce API calls
5. Add address autocomplete using Mapbox Search Box (optional)

## Resources

- [Mapbox GL JS Documentation](https://docs.mapbox.com/mapbox-gl-js/)
- [Mapbox Geocoding API](https://docs.mapbox.com/api/search/geocoding/)
- [Mapbox Directions API](https://docs.mapbox.com/api/navigation/directions/)
- [Mapbox Pricing](https://www.mapbox.com/pricing/)
