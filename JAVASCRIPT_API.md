# MapGenerator JavaScript API

This document describes the JavaScript API for programmatically generating maps and islands without using the UI interface.

## Getting Started

The API is automatically available in the browser console when you load the MapGenerator application. Access it via `window.MapGeneratorAPI` or simply `MapGeneratorAPI`.

```javascript
// Check if API is available
console.log(MapGeneratorAPI); // Shows available methods

// Get list of available methods
console.log(Object.keys(MapGeneratorAPI));
```

## Available Methods

### Island Generation

#### `generateHeightmapIslands(config)`

Generate procedural islands using Diamond-Square heightmaps and marching squares for coastline extraction.

**Parameters:**
```javascript
{
  numIslands?: number,      // Number of islands (default: 3)
  baseSize?: number,        // Base size in pixels (default: 256)
  sizeVariation?: number,   // Size variation 0-1 (default: 0.3)
  smoothness?: number,      // Heightmap smoothness 0-1 (default: 0.5)
  seaLevel?: number,        // Sea level threshold -1 to 1 (default: 0.0)
  beachLevel?: number,      // Beach level -1 to 1 (default: 0.1)
  worldScale?: number,      // Scale to world coordinates (default: 2.0)
  falloffFactor?: number,   // Edge falloff steepness (default: 2.0)
  volcanoMode?: boolean,    // Create volcanic islands (default: false)
  atolloMode?: boolean,     // Create atoll-style islands (default: false)
  noiseEnabled?: boolean,   // Enable coastline noise (default: true)
  noiseSize?: number,       // Noise frequency (default: 30)
  noiseAngle?: number       // Max noise angle in degrees (default: 20)
}
```

**Examples:**
```javascript
// Generate basic islands
await MapGeneratorAPI.generateHeightmapIslands();

// Generate volcanic islands
await MapGeneratorAPI.generateHeightmapIslands({
  numIslands: 2,
  volcanoMode: true,
  falloffFactor: 1.5,
  baseSize: 300
});

// Generate atoll islands with custom noise
await MapGeneratorAPI.generateHeightmapIslands({
  numIslands: 4,
  atolloMode: true,
  noiseSize: 15,
  noiseAngle: 25
});
```

#### `generateSolidLandmasses(config)`

Generate solid landmasses using geometric algorithms for creating continents, peninsulas, and archipelagos.

**Parameters:**
```javascript
{
  landmassType?: 'peninsula' | 'island_chain' | 'continent' | 'archipelago',
  primaryLandmassSize?: number,        // 0.3-0.8 of world area (default: 0.6)
  coastalComplexity?: number,          // 0.1-1.0 detail level (default: 0.7)
  developableAreaRatio?: number,       // 0.4-0.8 flat land percentage (default: 0.6)
  secondaryLandmassesEnabled?: boolean, // Enable secondary landmasses (default: false)
  secondaryLandmassCount?: number      // Number of secondary landmasses (default: 2)
}
```

**Examples:**
```javascript
// Generate a basic continent
await MapGeneratorAPI.generateSolidLandmasses({
  landmassType: 'continent'
});

// Generate an archipelago with secondary islands
await MapGeneratorAPI.generateSolidLandmasses({
  landmassType: 'archipelago',
  primaryLandmassSize: 0.4,
  secondaryLandmassesEnabled: true,
  secondaryLandmassCount: 5
});

// Generate a complex peninsula
await MapGeneratorAPI.generateSolidLandmasses({
  landmassType: 'peninsula',
  coastalComplexity: 0.9,
  primaryLandmassSize: 0.8
});
```

### Coastline Generation

#### `generateCoastline(config)`

Generate traditional coastlines (continental mode) with optional rivers.

**Parameters:**
```javascript
{
  noiseEnabled?: boolean,  // Enable coastline noise (default: true)
  noiseSize?: number,      // Noise frequency (default: 30)
  noiseAngle?: number,     // Max noise angle in degrees (default: 20)
  numRivers?: number       // Number of rivers (default: 1)
}
```

**Examples:**
```javascript
// Generate smooth coastline with river
await MapGeneratorAPI.generateCoastline({
  noiseEnabled: false,
  numRivers: 1
});

// Generate complex coastline with multiple rivers
await MapGeneratorAPI.generateCoastline({
  noiseSize: 15,
  noiseAngle: 30,
  numRivers: 3
});
```

### Complete Generation

#### `generateEverything()`

Generate a complete map with coastline, roads, parks, and buildings using current settings.

```javascript
// Generate complete map
await MapGeneratorAPI.generateEverything();
```

### Utility Methods

#### `clearAll()`

Clear all generated content and reset the map.

```javascript
MapGeneratorAPI.clearAll();
```

#### `setTensorField(config)`

Configure the tensor field that controls road generation patterns.

**Parameters:**
```javascript
{
  useRecommended?: boolean, // Use recommended field setup (default: false)
  addGrid?: boolean,        // Add grid field (default: false)
  addRadial?: boolean       // Add radial field (default: false)
}
```

**Examples:**
```javascript
// Reset to recommended tensor field
MapGeneratorAPI.setTensorField({ useRecommended: true });

// Add additional field components
MapGeneratorAPI.setTensorField({ 
  addGrid: true,
  addRadial: true 
});
```

## Advanced Usage

### Chaining Operations

```javascript
// Generate islands then add roads
await MapGeneratorAPI.generateHeightmapIslands({
  numIslands: 3,
  volcanoMode: true
});

// Wait for generation to complete then add everything else
await MapGeneratorAPI.generateEverything();
```

### Custom Workflows

```javascript
// Custom island generation workflow
async function generateCustomIslands() {
  // Clear previous generation
  MapGeneratorAPI.clearAll();
  
  // Set up tensor field
  MapGeneratorAPI.setTensorField({ useRecommended: true });
  
  // Generate volcanic archipelago
  await MapGeneratorAPI.generateHeightmapIslands({
    numIslands: 5,
    volcanoMode: true,
    baseSize: 200,
    sizeVariation: 0.4,
    falloffFactor: 1.2
  });
  
  console.log('Islands generated successfully!');
}

generateCustomIslands();
```

### Error Handling

```javascript
try {
  await MapGeneratorAPI.generateHeightmapIslands({
    numIslands: 10,
    baseSize: 500
  });
  console.log('Generation successful!');
} catch (error) {
  console.error('Generation failed:', error);
}
```

## Technical Notes

### Performance Considerations

- Large `baseSize` values (>400) may cause slower generation
- High `numIslands` counts (>5) require more processing time
- Complex coastlines (`coastalComplexity` > 0.8) increase generation time

### Parameter Interactions

- `volcanoMode` and `atolloMode` are mutually exclusive
- `falloffFactor` values < 1.0 create gentler island edges
- `seaLevel` affects how much of the island appears above water
- Noise parameters significantly impact coastline appearance

### Browser Console Usage

Open the browser's developer console (F12) and try these examples:

```javascript
// Quick volcanic island generation
await MapGeneratorAPI.generateHeightmapIslands({ 
  numIslands: 2, 
  volcanoMode: true 
});

// Generate and inspect tensor field
MapGeneratorAPI.setTensorField({ useRecommended: true });
console.log(MapGeneratorAPI.getTensorField());

// Access low-level components for advanced usage
const mainGUI = MapGeneratorAPI.getMainGUI();
const coastlineParams = mainGUI.getCoastlineParams();
console.log(coastlineParams);
```

## Fixed Issues

- **Thin Extensions**: Islands now generate with proper closed coastlines without thin extensions reaching screen edges
- **Parameter Configuration**: All island parameters are properly configured and accessible
- **Tensor Field Integration**: Islands correctly integrate with the road generation system

This JavaScript API provides complete programmatic control over the MapGenerator without requiring UI interaction, making it perfect for automated generation, testing, or integration with other tools.