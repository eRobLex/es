// Configuration options for the multiplayer car simulator
export const config = {
  // Car appearance
  carColors: [
    0xff0000, // Red (default)
    0x0000ff, // Blue
    0x00ff00, // Green
    0xffff00, // Yellow
    0xff00ff, // Purple
    0x00ffff, // Cyan
    0xffa500  // Orange
  ],
  
  // Physics settings
  maxSteerVal: 0.5,
  maxForce: 500,
  
  // World settings
  tileSize: 500,
  maxTilesDistance: 2000,
  
  // Network update rate (ms)
  updateRate: 50,

  // Height tracking
  groundThreshold: 0.5, // Distance from ground to consider "airborne"
  minAirTimeToRecord: 0.1 // Minimum seconds of air time to record a jump
};
