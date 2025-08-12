# MapGenerator - Claude Memory File

## Project Overview

MapGenerator is a sophisticated procedural city map generation tool that creates American-style cities using tensor fields, streamline integration, and polygon finding algorithms. It generates both 2D visualizations and 3D models of procedural cities.

**Live Demo**: https://probabletrain.itch.io/city-generator  
**Documentation**: https://maps.probabletrain.com  
**Repository**: https://github.com/LudoBermejoES/MapGenerator  
**License**: LGPL-3.0

## Architecture & Core Components

### Core Generation Pipeline
1. **Tensor Field Creation** - Define flow fields using radial and grid basis fields
2. **Streamline Integration** - Generate road networks by integrating along tensor fields
3. **Graph Construction** - Create intersection graphs from streamlines
4. **Polygon Finding** - Extract blocks and lots from the road network
5. **Building Generation** - Create pseudo-3D buildings within lots

### File Structure
```
src/
├── main.ts                    # Application entry point and main controller
├── ts/
│   ├── impl/                  # Core algorithms and data structures
│   │   ├── tensor_field.ts    # Tensor field combination and sampling
│   │   ├── basis_field.ts     # Grid and radial basis field implementations
│   │   ├── streamlines.ts     # Road network generation via streamline integration
│   │   ├── integrator.ts      # Euler and RK4 integration methods
│   │   ├── graph.ts           # Intersection graph construction
│   │   ├── polygon_finder.ts  # Block and lot extraction from graphs
│   │   ├── water_generator.ts # Coastline and river generation
│   │   └── grid_storage.ts    # Spatial grid for efficient collision detection
│   ├── ui/                    # User interface and rendering
│   │   ├── main_gui.ts        # Orchestrates the generation pipeline
│   │   ├── tensor_field_gui.ts # Tensor field visualization and editing
│   │   ├── style.ts           # Rendering styles (Default, Rough, Heightmap)
│   │   ├── buildings.ts       # 3D building model generation
│   │   └── canvas_wrapper.ts  # Canvas and SVG rendering abstraction
│   ├── model_generator.ts     # 3D STL model export
│   ├── vector.ts              # 2D vector mathematics
│   └── util.ts                # Utility functions and CSS color parsing
├── html/
│   ├── index.html             # Main HTML template
│   └── style.css              # CSS styles
└── colour_schemes.json        # Predefined visual themes
```

## Key Technical Details

### Build System
- **Build Tool**: Gulp with TypeScript compilation
- **Bundler**: Browserify with Babel transformation
- **Development**: Watchify for hot reloading
- **Output**: `dist/bundle.js` and copied HTML/CSS

### Dependencies
- **Core Libraries**:
  - `three.js` - 3D model generation
  - `dat.gui` - Control panel interface
  - `d3-quadtree` - Spatial data structures
  - `simplex-noise` - Procedural noise
  - `jsts` - Computational geometry
  - `roughjs` - Hand-drawn style rendering
  - `@svgdotjs/svg.js` - SVG export

### Generation Parameters

#### Streamline Parameters (`StreamlineParams`)
```typescript
{
  dsep: number;          // Seed separation distance
  dtest: number;         // Integration collision distance
  dstep: number;         // Integration step size
  dcirclejoin: number;   // Circle joining threshold
  dlookahead: number;    // Dangling streamline extension distance
  joinangle: number;     // Road joining angle tolerance
  pathIterations: number; // Max integration steps
  seedTries: number;     // Max seed attempts
  simplifyTolerance: number; // Line simplification tolerance
  collideEarly: number;  // Early collision probability
}
```

#### Road Hierarchy
- **Main Roads**: `dsep=400, dtest=200, dlookahead=500`
- **Major Roads**: `dsep=100, dtest=30, dlookahead=200`  
- **Minor Roads**: `dsep=20, dtest=15, dlookahead=40`

### Tensor Field System
- **Grid Fields**: Create regular street grids with controllable angle
- **Radial Fields**: Generate radial/concentric road patterns
- **Combination**: Multiple fields are weighted and combined
- **Noise**: Park areas and global noise add variation to field directions

### Generation Workflow

#### Automatic Generation (`generateEverything()`)
1. Generate coastline/water bodies
2. Generate main road network
3. Generate major roads (includes park placement)
4. Generate minor roads  
5. Generate building lots and 3D models

#### Manual Control
Each step can be triggered individually through the GUI, allowing fine-tuned control over the generation process.

### Rendering Modes

#### Visual Styles
- **Default**: Clean vector-style maps
- **Apple/Google**: Map service inspired themes  
- **Drawn**: Hand-sketched appearance using RoughJS
- **Heightmap**: Building height visualization
- **Dark Modes**: Available for most themes

#### Export Formats
- **PNG**: Raster image export at configurable resolution
- **SVG**: Vector graphics export
- **STL**: 3D model export as ZIP containing separate components
- **Heightmap**: Special PNG export showing building heights

### Performance Optimizations
- **Spatial Grids**: Efficient collision detection during streamline generation
- **Animation System**: Incremental generation with frame rate control
- **Canvas Scaling**: HiDPI display support
- **Polygon Simplification**: Reduced vertex counts for performance

## Development Patterns

### Class Hierarchy
- **Style Classes**: `Style` → `DefaultStyle`/`RoughStyle`
- **Integrator Classes**: `FieldIntegrator` → `EulerIntegrator`/`RK4Integrator`  
- **BasisField Classes**: `BasisField` → `Grid`/`Radial`

### Event System
- **Callbacks**: Pre/post generation hooks for coordinated updates
- **GUI Updates**: Automatic control panel refresh on parameter changes
- **Animation**: Promise-based async generation with update loops

### Coordinate Systems
- **World Space**: Algorithmic coordinate system for generation
- **Screen Space**: Display coordinates with zoom/pan transformations
- **Domain Controller**: Manages coordinate transformations and viewport

### Memory Management
- **Object Pooling**: Reuse of Vector and geometry objects where possible
- **Cleanup**: Explicit reset methods for major data structures
- **State Management**: Clear separation of generation state and display state

## Testing & Quality

### Available Commands
```bash
npm run lint    # ESLint code quality checks
gulp           # Build and watch for changes
```

### Code Style
- **TypeScript**: Strict typing with interface definitions
- **Modular Design**: Clear separation of concerns
- **Error Handling**: Graceful degradation and logging
- **Documentation**: Inline comments explaining complex algorithms

## Advanced Implementation Details

### Critical Mathematical Components

#### Tensor Mathematics (`tensor.ts`)
- **Matrix Representation**: 2x2 symmetric tensors stored as `[t11, t12]` format
- **Angle Calculation**: `theta = atan2(t12/r, t11/r) / 2` for tensor orientation
- **Major/Minor Eigenvectors**: Major at `theta`, minor at `theta + π/2`
- **Tensor Addition**: Weighted combination with optional smoothing normalization
- **Rotation**: Updates matrix components using `cos(2θ)` and `sin(2θ)` due to tensor double-angle property

#### Polygon Processing (`polygon_util.ts`)
- **Shrinking/Growing**: Uses JSTS buffer operations with configurable end caps
- **Subdivision Algorithm**: Recursively divides polygons along longest edge with 40-60% random split point
- **Area Constraints**: Shape index filtering `area/(perimeter²) >= 0.04` prevents thin slivers
- **Point-in-Polygon**: Ray casting algorithm for spatial queries
- **Polygon Intersection**: JSTS integration for complex geometric operations

#### Streamline Integration (`streamlines.ts`)
- **Bidirectional Growth**: Simultaneous forward/backward integration reduces circle-joining errors
- **Self-Intersection Prevention**: Uses `dcirclejoin` parameter and direction tracking
- **Adaptive Stepping**: RK4 integration with configurable step size (`dstep`)
- **Circle Detection**: Joins streamlines when endpoints approach within `dcirclejoin` distance
- **Dangling Extension**: `joinDanglingStreamlines()` extends incomplete roads using `dlookahead`

### Performance-Critical Systems

#### Spatial Grid Storage (`grid_storage.ts`)
- **Hash Grid**: World space divided into cells of size `dsep` for O(1) collision detection
- **Neighborhood Search**: 3x3 cell pattern for collision testing during integration
- **Memory Layout**: Pre-allocated 2D array structure for cache efficiency
- **Batch Operations**: `addAll()` for efficient grid merging during hierarchical road generation

#### Canvas Rendering System (`canvas_wrapper.ts`)
- **Dual Canvas Support**: Default (Canvas2D) and Rough (hand-drawn) rendering backends
- **Scale Management**: HiDPI support with automatic pixel ratio detection
- **SVG Export**: Parallel SVG generation during Canvas2D rendering
- **Vector Caching**: Scaled vector arrays cached to avoid repeated transformations

### Complex State Management

#### Generation Orchestration (`main_gui.ts`)
- **Dependency Chain**: Coastline → Main → Major → Minor → Buildings with automatic cleanup
- **Animation States**: Promise-based async generation with frame-rate controlled updates
- **Parameter Inheritance**: Streamline parameters cascade through road hierarchy
- **State Validation**: Pre/post generation callbacks ensure consistent world state

#### Coordinate System Management (`domain_controller.ts`)
- **Zoom-Aware Transformations**: `worldToScreen()` and `screenToWorld()` handle all coordinate conversion
- **Viewport Tracking**: Pan/zoom state management with bounds checking
- **Mouse Interaction**: Drag detection with world-space delta calculation
- **Camera Projection**: Orthographic/perspective modes for pseudo-3D building rendering

### GUI Interaction Patterns

#### Drag and Drop System (`drag_controller.ts`)
- **Multi-Target Registration**: Closest draggable within `MIN_DRAG_DISTANCE` gets control
- **Coordinate Transformation**: Screen mouse deltas converted to world space for field manipulation
- **State Switching**: Automatic map panning when no tensor field is being dragged
- **Zoom Compensation**: Drag distance threshold scales with zoom level

#### Field Manipulation (`tensor_field_gui.ts`)
- **Real-Time Visualization**: Grid overlay shows tensor field major/minor directions
- **Interactive Editing**: Click-drag to move field centers, GUI controls for parameters
- **Preset Configurations**: `setRecommended()` creates balanced 4-grid + 1-radial layout
- **Dynamic Addition**: Random placement within scaled viewport bounds

### Edge Cases and Error Handling

#### Geometric Robustness
- **Degenerate Polygons**: Empty polygon arrays handled gracefully in all processing functions
- **Division by Zero**: Vector normalization and mathematical operations check for zero-length vectors
- **Out-of-Bounds**: Grid storage clamps coordinates and handles edge cases
- **Self-Intersection**: JSTS validation prevents invalid polygon operations

#### Generation Failures
- **Seed Finding**: Falls back after `seedTries` attempts, continues with partial results
- **Water Generation**: Coastline/river generation with retry logic and edge-reaching validation
- **Polygon Extraction**: Graceful degradation when graph contains insufficient polygons
- **Memory Limits**: Large polygon operations wrapped in try-catch with error logging

### Known Technical Debt and TODOs

#### Algorithm Improvements Needed
- **Polygon Finding**: Current right-turn traversal fails with dead-end roads (line 202 in `polygon_finder.ts`)
- **Simplification Issues**: Line simplification breaks T-junctions, requiring dangling road extension workaround
- **Building Performance**: Rough style 3D building rendering needs better depth sorting (line 359 in `style.ts`)
- **Park Optimization**: Point-in-polygon tests for parks could use spatial indexing (line 101 in `tensor_field.ts`)

#### Architectural Considerations
- **Memory Management**: No explicit cleanup of large polygon arrays during generation
- **State Synchronization**: GUI reset mechanism relies on callback iteration rather than explicit state tracking
- **Async Error Handling**: Promise chains in generation pipeline need better error propagation
- **Performance Monitoring**: No built-in profiling or performance metrics collection

## Water Generation System - Deep Technical Analysis

### Overview and Architectural Design

The water generation system (`water_generator.ts`) creates realistic coastlines and rivers by extending the streamline generation framework with specialized algorithms for natural water feature creation. The system integrates deeply with the tensor field system to ensure water bodies properly influence road network generation.

#### Core Components and Data Flow
- **WaterGenerator Class**: Extends `StreamlineGenerator` with water-specific generation logic
- **WaterGUI Class**: Provides user interface controls and coordinate transformations  
- **TensorField Integration**: Water polygons stored as `sea` and `river` arrays affecting field sampling
- **Polygon Generation**: Complex geometric processing creates realistic shorelines and riverbanks

### Parameter System and Configuration

#### WaterParams Interface
```typescript
interface WaterParams extends StreamlineParams {
    coastNoise: NoiseStreamlineParams;    // Coastline irregularity control
    riverNoise: NoiseStreamlineParams;    // River meandering control  
    riverBankSize: number;                // Width of river bank areas
    riverSize: number;                    // Total river corridor width
}

interface NoiseStreamlineParams {
    noiseEnabled: boolean;                // Enable/disable noise application
    noiseSize: number;                    // Scale of noise features
    noiseAngle: number;                   // Maximum angular deviation (degrees)
}
```

#### Critical Parameter Relationships
- **River Sizing**: `riverSize` defines total corridor, `riverBankSize` creates inner water area
- **Noise Scale**: `noiseSize` controls feature frequency, smaller values = more detailed irregularity
- **Angle Control**: `noiseAngle` in degrees, converted to radians during application
- **Inheritance**: Water inherits all `StreamlineParams` controlling integration behavior

### Coastline Generation Algorithm (`createCoast()`)

#### Generation Process Overview
1. **Tensor Field Preparation**: Optionally enables global noise field modification
2. **Iterative Seed Finding**: Up to 100 attempts to find suitable coastline seed points
3. **Streamline Integration**: Bidirectional growth using tensor field sampling
4. **Edge Validation**: Ensures coastline reaches world boundaries for proper closure
5. **Geometric Processing**: Creates both visual coastline and sea polygon

#### Critical Implementation Details

**Random Major/Minor Selection**:
```typescript
major = Math.random() < 0.5;  // 50% chance of major/minor tensor direction
seed = this.getSeed(major);   // Find seed point for chosen direction
```

**Streamline Extension Strategy**:
```typescript
coastStreamline = this.extendStreamline(this.integrateStreamline(seed, major));
```
- Base streamline integration follows tensor field
- `extendStreamline()` adds 5 × `dstep` extensions at both ends
- Extensions ensure coastline reaches screen edges for proper polygon closure

**Edge Reaching Validation**:
```typescript
private reachesEdges(streamline: Vector[]): boolean {
    return this.vectorOffScreen(streamline[0]) && this.vectorOffScreen(streamline[streamline.length - 1]);
}
```
- Both endpoints must be beyond world boundaries
- Failure triggers retry with new seed until max attempts reached
- Critical for creating closed sea polygons

#### Sea Polygon Creation Process
1. **Simplified Streamline**: Reduces vertex count using `simplifyTolerance` 
2. **Polygon Intersection**: `PolygonUtil.lineRectanglePolygonIntersection()` creates closed polygon
3. **Tensor Field Integration**: Sea polygon stored as `tensorField.sea` array
4. **Road Network Integration**: Coastline added to streamline collections for rendering

### River Generation Algorithm (`createRiver()`)

#### Generation Strategy and Constraints
- **Orthogonal to Coastline**: Uses `!coastlineMajor` to ensure perpendicular orientation
- **Sea Exclusion During Generation**: Temporarily removes sea polygon to prevent interference
- **Dual Road Creation**: Generates parallel roads on both river banks
- **Complex Filtering**: Multiple geometric constraints ensure proper road placement

#### Critical Implementation Phases

**Phase 1: Core River Integration**
```typescript
// Ignore sea temporarily for edge detection
const oldSea = this.tensorField.sea;
this.tensorField.sea = [];
riverStreamline = this.extendStreamline(this.integrateStreamline(seed, !coastlineMajor));
this.tensorField.sea = oldSea;
```
- Sea polygon temporarily disabled to allow river reaching edges
- River generated perpendicular to coastline direction
- Same edge-reaching validation as coastline

**Phase 2: River Corridor Creation**  
```typescript
const expandedNoisy = this.complexifyStreamline(
    PolygonUtil.resizeGeometry(riverStreamline, this.params.riverSize, false)
);
this._riverPolygon = PolygonUtil.resizeGeometry(
    riverStreamline, this.params.riverSize - this.params.riverBankSize, false
);
```
- `resizeGeometry()` creates parallel offset curves using JSTS buffering
- `complexifyStreamline()` adds intermediate points for collision detection
- Inner polygon represents actual water, outer area includes banks

**Phase 3: Dual Road Generation**
The system creates two parallel roads along the river banks through sophisticated filtering:

```typescript
const road1 = expandedNoisy.filter(v =>
    !PolygonUtil.insidePolygon(v, this._seaPolygon)  // Avoid sea overlap
    && !this.vectorOffScreen(v)                      // Stay within bounds  
    && PolygonUtil.insidePolygon(v, riverSplitPoly)  // One side of river
);
const road2 = expandedNoisy.filter(v =>
    !PolygonUtil.insidePolygon(v, this._seaPolygon)  // Avoid sea overlap
    && !this.vectorOffScreen(v)                      // Stay within bounds
    && !PolygonUtil.insidePolygon(v, riverSplitPoly) // Other side of river  
);
```

**Phase 4: Road Orientation Optimization**
```typescript
if (road1[0].distanceToSquared(road2[0]) < road1[0].distanceToSquared(road2[road2.length - 1])) {
    road2Simple.reverse();  // Ensure roads flow in same direction
}
```
- Prevents roads from creating awkward connections at intersections
- Maintains consistent flow direction for both river bank roads

### Tensor Field Integration and Feedback Loops

#### Land/Water Detection System
```typescript
onLand(point: Vector): boolean {
    const inSea = PolygonUtil.insidePolygon(point, this.sea);
    if (this.ignoreRiver) return !inSea;
    return !inSea && !PolygonUtil.insidePolygon(point, this.river);
}
```
- **Sea Exclusion**: Points in sea return degenerate tensors (zero field)
- **River Handling**: Optional river exclusion via `ignoreRiver` flag
- **Integration Impact**: Zero tensors halt streamline integration at water boundaries

#### Noise Application During Water Generation
```typescript
if (this.params.coastNoise.noiseEnabled) {
    this.tensorField.enableGlobalNoise(
        this.params.coastNoise.noiseAngle, 
        this.params.coastNoise.noiseSize
    );
}
```
- **Global Noise Override**: Temporarily modifies tensor field during generation
- **Rotational Perturbation**: `getRotationalNoise()` applies angular deviation
- **Selective Application**: Different noise settings for coast vs river
- **Cleanup Required**: Noise disabled after generation to prevent interference

### Geometric Processing and Coordinate Systems

#### Edge Detection and Boundary Management
```typescript
private vectorOffScreen(v: Vector): boolean {
    const toOrigin = v.clone().sub(this.origin);
    return toOrigin.x <= 0 || toOrigin.y <= 0 ||
           toOrigin.x >= this.worldDimensions.x || toOrigin.y >= this.worldDimensions.y;
}
```
- **World Space Coordinates**: Uses generation coordinate system, not screen space
- **Boundary Buffer**: Ensures streamlines extend beyond visible area
- **Critical for Closure**: Required for proper polygon formation

#### Streamline Complexification for Collision Detection
```typescript
private complexifyStreamlineRecursive(v1: Vector, v2: Vector): Vector[] {
    if (v1.distanceToSquared(v2) <= this.paramsSq.dstep) {
        return [v1, v2];
    }
    const halfway = v1.clone().add(d.multiplyScalar(0.5));
    // Recursive subdivision until segments <= dstep
}
```
- **Adaptive Subdivision**: Ensures consistent sample density for collision detection
- **Performance Trade-off**: More samples = better collision but slower generation
- **Grid Storage Integration**: Complexified points added to spatial grid for road generation

### Performance Characteristics and Optimization

#### Retry Logic and Failure Handling
- **100 Attempt Limit**: `TRIES = 100` for both coast and river generation
- **Graceful Degradation**: System continues with partial results on failure
- **Logging**: River failures logged as errors but don't halt generation
- **Seed Randomization**: Each attempt uses different random seed location

#### Polygon Processing Performance
- **JSTS Integration**: Heavy geometric operations use robust but slower JSTS library
- **Point-in-Polygon**: Critical bottleneck, performed frequently during filtering
- **Memory Allocation**: Large intermediate arrays created during road filtering
- **Simplification**: `simplifyTolerance` parameter controls vertex reduction

### Integration with Broader Road Network

#### Hierarchical Generation Dependencies
1. **Water First**: Coastline and river generated before any roads
2. **Tensor Field Updates**: Water polygons immediately available for road generation
3. **Collision Integration**: Water roads added to spatial grids for proper collision detection  
4. **Visual Separation**: Coast/river rendered separately from regular road network

#### Road Network Impact
- **Natural Barriers**: Water bodies create realistic road network discontinuities
- **Bridge Locations**: Road generation naturally creates bridge opportunities
- **Urban Planning**: Coastlines and rivers influence city layout and development patterns
- **Visual Hierarchy**: Water features rendered with different styling and colors

### Limitations and Edge Cases

#### Current System Constraints
- **Single Features**: Only one coastline and one river supported per generation
- **No Branching**: Rivers don't support tributaries or complex hydrology
- **Fixed Orientation**: River always perpendicular to coastline if both present
- **Edge Dependencies**: Both features must reach world boundaries or generation fails

#### Geometric Edge Cases
- **Self-Intersection**: Noise can create self-intersecting coastlines
- **Degenerate Polygons**: Very small noise values may create invalid geometry
- **Filter Failures**: Road filtering can result in empty arrays, handled gracefully
- **Coordinate Precision**: Floating point precision issues with very large world dimensions

### Future Enhancement Opportunities

#### Algorithmic Improvements
- **Multiple Rivers**: Array-based storage could support river networks
- **Tributary Systems**: Recursive generation could create realistic drainage basins
- **Lake Generation**: Closed water bodies using different geometric algorithms
- **Improved Noise**: Perlin noise could replace simplex for more natural coastlines

#### Performance Optimizations  
- **Spatial Indexing**: Point-in-polygon tests could use quadtree acceleration
- **Streaming Generation**: Large water features could use incremental processing
- **GPU Acceleration**: Geometric operations suitable for parallel processing
- **Memory Pooling**: Vector object reuse during intensive geometric processing

This water generation system demonstrates sophisticated procedural generation combining mathematical field theory, computational geometry, and careful state management to create realistic natural features that seamlessly integrate with the broader city generation pipeline.

## Coastline Generation System - Deep Technical Analysis

### Overview and Architectural Philosophy

The coastline generation system represents one of the most sophisticated aspects of MapGenerator's water features, creating realistic shorelines through tensor field integration, noise application, and complex geometric processing. Unlike simple line drawing, coastlines are generated as living streamlines that follow the mathematical flow field while incorporating natural irregularities through controlled noise injection.

#### Fundamental Design Principles
- **Field-Driven Generation**: Coastlines emerge naturally from tensor field integration, not predetermined paths
- **Edge-Boundary Constraints**: Coastlines must span the entire world boundary to create proper enclosed sea polygons
- **Noise-Enhanced Realism**: Controllable irregularity through simplex noise rotational perturbation
- **Geometric Precision**: Complex polygon operations ensure proper sea/land boundaries for road generation

### Coastline Generation Algorithm Deep Dive

#### Phase 1: Initialization and Parameter Setup
```typescript
createCoast(): void {
    let coastStreamline;
    let seed;
    let major;
    
    if (this.params.coastNoise.noiseEnabled) {
        this.tensorField.enableGlobalNoise(
            this.params.coastNoise.noiseAngle, 
            this.params.coastNoise.noiseSize
        );    
    }
```

**Critical Implementation Details:**
- **Noise State Management**: Global noise temporarily modifies the entire tensor field during coastline generation
- **Parameter Isolation**: Coast noise parameters are independent of river noise settings
- **Field Modification**: `enableGlobalNoise()` affects all tensor field sampling until explicitly disabled

#### Phase 2: Iterative Coastline Discovery
```typescript
for (let i = 0; i < this.TRIES; i++) {
    major = Math.random() < 0.5;  // 50% probability of major vs minor direction
    seed = this.getSeed(major);   // Find valid seed point
    coastStreamline = this.extendStreamline(this.integrateStreamline(seed, major));
    
    if (this.reachesEdges(coastStreamline)) {
        break;  // Success - coastline spans world boundaries
    }
}
```

**Sophisticated Retry Logic:**
- **Direction Randomization**: Each attempt randomly selects major or minor tensor field direction
- **Seed Discovery**: `getSeed()` performs spatial sampling with collision avoidance
- **Edge Validation**: `reachesEdges()` ensures both endpoints extend beyond world boundaries
- **Failure Tolerance**: Up to 100 attempts before accepting failure (no error thrown)

### Seed Point Discovery System

#### Random Spatial Sampling Strategy
```typescript
protected samplePoint(): Vector {
    return new Vector(
        Math.random() * this.worldDimensions.x,
        Math.random() * this.worldDimensions.y)
        .add(this.origin);
}
```
- **Uniform Distribution**: Simple uniform random sampling across world space
- **Origin Translation**: Sampling relative to world origin, not (0,0)
- **TODO Note**: Comments indicate "better seeding scheme" needed for improved results

#### Seed Validation Process
```typescript
protected getSeed(major: boolean): Vector {
    let seed = this.samplePoint();
    let i = 0;
    while (!this.isValidSample(major, seed, this.paramsSq.dsep)) {
        if (i >= this.params.seedTries) {
            return null;  // Failure after maximum attempts
        }
        seed = this.samplePoint();
        i++;
    }
    return seed;
}
```

**Multi-Criteria Validation:**
- **Spatial Collision**: `grid(major).isValidSample()` ensures minimum separation from existing streamlines
- **Land Constraint**: `integrator.onLand(point)` prevents seeds in existing water bodies
- **Retry Limit**: `seedTries` parameter controls maximum seed attempts (typically 100)
- **Graceful Failure**: Returns `null` rather than throwing exceptions

### Streamline Integration Deep Analysis

#### Bidirectional Growth Strategy
The `integrateStreamline()` method implements sophisticated bidirectional integration:

```typescript
const d = this.integrator.integrate(seed, major);

const forwardParams: StreamlineIntegration = {
    seed: seed,
    originalDir: d,
    streamline: [seed],
    previousDirection: d,
    previousPoint: seed.clone().add(d),
    valid: true,
}

const backwardParams: StreamlineIntegration = {
    seed: seed,
    originalDir: negD,  // Opposite direction
    streamline: [],
    previousDirection: negD,
    previousPoint: seed.clone().add(negD),
    valid: true,
}
```

**Integration Physics:**
- **Tensor Field Sampling**: Each step samples the tensor field to determine flow direction
- **Step Size Control**: `dstep` parameter controls integration granularity
- **Direction Continuity**: Previous direction influences next step to prevent sudden direction changes
- **Boundary Detection**: Integration stops when points leave world bounds or hit invalid regions

#### Circle Detection and Closure
```typescript
const sqDistanceBetweenPoints = forwardParams.previousPoint.distanceToSquared(backwardParams.previousPoint);

if (!pointsEscaped && sqDistanceBetweenPoints > this.paramsSq.dcirclejoin) {
    pointsEscaped = true;
}

if (pointsEscaped && sqDistanceBetweenPoints <= this.paramsSq.dcirclejoin) {
    // Join the circle
    forwardParams.streamline.push(forwardParams.previousPoint);
    forwardParams.streamline.push(backwardParams.previousPoint);
    break;
}
```

**Sophisticated Circle Logic:**
- **Escape Detection**: Tracks when integration fronts move apart by `dcirclejoin` distance
- **Closure Opportunity**: Only attempts closure after fronts have separated and come back together
- **Prevents Premature Closure**: Avoids tiny loops by requiring initial separation
- **Natural Termination**: Creates closed coastlines when field conditions favor circular patterns

### Coastline Extension and Edge-Reaching Logic

#### Extension Strategy for Boundary Spanning
```typescript
private extendStreamline(streamline: Vector[]): Vector[] {
    streamline.unshift(streamline[0].clone().add(
        streamline[0].clone().sub(streamline[1]).setLength(this.params.dstep * 5)
    ));
    streamline.push(streamline[streamline.length - 1].clone().add(
        streamline[streamline.length - 1].clone().sub(streamline[streamline.length - 2]).setLength(this.params.dstep * 5)
    ));
    return streamline;
}
```

**Mathematical Extension Process:**
- **Direction Calculation**: Uses vector subtraction to determine end-point directions
- **Fixed Extension Length**: Always extends by `5 × dstep` regardless of field conditions
- **Linear Projection**: Extension follows straight line, not tensor field (avoids infinite loops)
- **Bidirectional**: Both start and end points extended simultaneously

#### Edge-Reaching Validation
```typescript
private reachesEdges(streamline: Vector[]): boolean {
    return this.vectorOffScreen(streamline[0]) && this.vectorOffScreen(streamline[streamline.length - 1]);
}

private vectorOffScreen(v: Vector): boolean {
    const toOrigin = v.clone().sub(this.origin);
    return toOrigin.x <= 0 || toOrigin.y <= 0 ||
           toOrigin.x >= this.worldDimensions.x || toOrigin.y >= this.worldDimensions.y;
}
```

**Precise Boundary Detection:**
- **World Space Coordinates**: Uses generation coordinate system, not screen coordinates
- **Strict Requirements**: Both endpoints must be beyond world boundaries
- **Buffer Zone**: Points must be outside world dimensions, not just at edges
- **Critical for Success**: Failure to reach edges triggers complete retry with new seed

### Sea Polygon Creation and Geometric Processing

#### Advanced Polygon Construction
```typescript
const road = this.simplifyStreamline(coastStreamline);
this._seaPolygon = this.getSeaPolygon(road);
```

The `getSeaPolygon()` method uses sophisticated JSTS geometric operations:

```typescript
private getSeaPolygon(polyline: Vector[]): Vector[] {
    return PolygonUtil.lineRectanglePolygonIntersection(this.origin, this.worldDimensions, polyline);
}
```

**Complex JSTS Integration Process:**
1. **Line to JSTS Conversion**: Coastline converted to JSTS LineString geometry
2. **World Boundary Creation**: Rectangle bounds created as JSTS Polygon
3. **Union Operation**: `boundingPoly.getExteriorRing().union(jstsLine)` combines line and boundary
4. **Polygonization**: `jsts.operation.polygonize.Polygonizer` extracts closed polygons
5. **Area Selection**: Smallest resulting polygon selected as sea area

**Geometric Robustness:**
- **Self-Intersection Handling**: JSTS automatically handles self-intersecting coastlines
- **Multiple Polygon Support**: Polygonizer can create multiple closed regions
- **Area-Based Selection**: Selects smallest polygon to represent sea (not land)
- **Precision Management**: JSTS provides robust floating-point geometry operations

### Noise Application and Field Modification

#### Global Noise System Architecture
```typescript
enableGlobalNoise(angle: number, size: number): void {
    this.noiseParams.globalNoise = true;
    this.noiseParams.noiseAngleGlobal = angle;
    this.noiseParams.noiseSizeGlobal = size;
}
```

**Noise Integration in Tensor Field Sampling:**
```typescript
if (this.noiseParams.globalNoise) {
    tensorAcc.rotate(this.getRotationalNoise(point, this.noiseParams.noiseSizeGlobal, this.noiseParams.noiseAngleGlobal));
}

getRotationalNoise(point: Vector, noiseSize: number, noiseAngle: number): number {
    return this.noise(point.x / noiseSize, point.y / noiseSize) * noiseAngle * Math.PI / 180;
}
```

**Sophisticated Noise Mathematics:**
- **Simplex Noise Sampling**: Uses `createNoise2D()` for smooth, natural variation
- **Coordinate Scaling**: `point.x / noiseSize` controls noise frequency (smaller = more detail)
- **Angular Perturbation**: Noise rotates tensor field directions by up to `noiseAngle` degrees
- **Radian Conversion**: Degrees converted to radians for mathematical operations
- **Tensor Rotation**: Applied to entire tensor, affecting both major and minor directions

#### Noise Parameters and Effects
- **noiseSize**: Controls frequency of coastal irregularities (30 = moderate detail)
- **noiseAngle**: Maximum angular deviation in degrees (20° = subtle variation)
- **noiseEnabled**: Boolean toggle for noise application during generation

**Visual Impact:**
- Small `noiseSize` values create highly detailed, jagged coastlines
- Large `noiseSize` values create gentle, sweeping coastal curves  
- High `noiseAngle` values create dramatic directional changes
- Low `noiseAngle` values create subtle coastal variations

### Coastline Simplification and Road Integration

#### Douglas-Peucker Simplification
```typescript
protected simplifyStreamline(streamline: Vector[]): Vector[] {
    const simplified = [];
    for (const point of simplify(streamline, this.params.simplifyTolerance)) {
        simplified.push(new Vector(point.x, point.y));
    }
    return simplified;
}
```

**Critical Simplification Process:**
- **Library Integration**: Uses `simplify-js` library implementing Douglas-Peucker algorithm
- **Tolerance Control**: `simplifyTolerance` parameter (typically 10) controls vertex reduction
- **Performance Trade-off**: Fewer vertices = better performance, less detail
- **Vector Conversion**: Converts simplified points back to Vector objects

#### Road Network Integration
```typescript
const complex = this.complexifyStreamline(road);
this.grid(major).addPolyline(complex);
this.streamlines(major).push(complex);
this.allStreamlines.push(complex);
```

**Complexification for Collision Detection:**
- **Reverse Simplification**: Adds intermediate points between simplified vertices
- **Uniform Spacing**: Ensures points separated by at most `dstep` distance
- **Spatial Grid Integration**: Complex coastline added to collision detection grid
- **Road Generation Impact**: Prevents road streamlines from crossing coastline

### Performance Characteristics and Optimization

#### Computational Complexity
- **Seed Discovery**: O(seedTries) random sampling attempts
- **Integration Steps**: O(pathIterations) tensor field evaluations
- **JSTS Operations**: O(n log n) for polygon construction and intersection
- **Noise Evaluation**: O(1) per integration step
- **Simplification**: O(n log n) Douglas-Peucker algorithm

#### Memory Usage Patterns
- **Streamline Storage**: Full-resolution coastline kept for visual rendering
- **Simplified Storage**: Reduced-vertex version for geometric operations
- **Complex Storage**: High-density version for collision detection
- **Spatial Indexing**: Grid storage for O(1) collision queries

#### Critical Performance Bottlenecks
1. **JSTS Polygon Operations**: Most expensive single operation
2. **Integration Steps**: Can require thousands of tensor field samples
3. **Retry Logic**: Up to 100 failed attempts in worst case
4. **Noise Evaluation**: Simplex noise calculation per integration step

### Edge Cases and Failure Modes

#### Geometric Failure Scenarios
- **No Valid Seeds**: All random points within collision distance of existing features
- **Field Singularities**: Tensor field regions with zero or undefined directions
- **Edge Escape Failure**: Streamlines that curve back before reaching boundaries
- **Self-Intersection**: Coastlines that intersect themselves (handled by JSTS)

#### Parameter Sensitivity Analysis
- **Low dstep**: High detail but expensive computation and potential precision issues
- **High dstep**: Fast generation but chunky, unrealistic coastlines
- **High noiseAngle**: Dramatic variation but potential for wild, unrealistic shapes
- **Low noiseSize**: Extremely detailed but potentially chaotic coastlines
- **High simplifyTolerance**: Fast processing but loss of coastal character

#### Robustness Mechanisms
- **Graceful Degradation**: System continues with partial failures
- **Parameter Validation**: Automatic adjustment of conflicting parameters
- **State Cleanup**: Noise disabled after generation to prevent interference
- **Memory Management**: Temporary structures cleaned up after polygon creation

### Integration with Broader Generation Pipeline

#### Tensor Field Feedback Loop
```typescript
this.tensorField.sea = (this._seaPolygon);
```
- **Immediate Integration**: Sea polygon immediately affects subsequent road generation
- **Land/Water Boundaries**: `onLand()` method uses sea polygon for spatial queries
- **Road Collision**: Streamline generation automatically avoids sea areas
- **Visual Hierarchy**: Coastline rendered before roads for proper layering

#### Coordinate System Management
- **World Space Generation**: All coastline operations in generation coordinates
- **Screen Space Rendering**: Coastline converted to screen coordinates for display
- **Zoom Independence**: Generation parameters independent of display zoom level
- **Origin Handling**: Proper translation for non-zero world origins

### Future Enhancement Opportunities

#### Algorithmic Improvements
- **Adaptive Seeding**: Intelligent seed placement based on existing features
- **Multi-Scale Noise**: Combination of different noise frequencies for realistic detail
- **Tidal Zones**: Support for variable coastline positions
- **Erosion Simulation**: Time-based coastline modification

#### Performance Optimizations
- **Incremental Generation**: Streaming generation for large worlds
- **GPU Acceleration**: Parallel integration and noise evaluation
- **Spatial Caching**: Reuse of tensor field evaluations
- **Adaptive Tolerance**: Dynamic simplification based on zoom level

#### Enhanced Realism Features
- **Cliff Detection**: Vertical coastline features
- **Beach Generation**: Shallow water and sandy areas
- **Coastal Vegetation**: Automatic placement of coastal features
- **Wave Physics**: Directional wave influence on coastline shape

This coastline generation system represents a sophisticated fusion of mathematical field theory, computational geometry, and procedural generation techniques, creating natural-looking shorelines that seamlessly integrate with the urban planning algorithms while maintaining high performance and geometric robustness.