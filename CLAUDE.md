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

This system represents a sophisticated implementation of procedural city generation with careful attention to mathematical correctness, performance optimization, and user interaction design.