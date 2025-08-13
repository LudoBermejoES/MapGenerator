import * as log from 'loglevel';
import Vector from '../vector';
import FieldIntegrator from './integrator';
import WaterGenerator, { WaterParams, HeightmapIslandParams } from './water_generator';
import TensorField from './tensor_field';
import DiamondSquare from './diamond_square';
import MarchingSquares from './marching_squares';

export interface IslandFeatures {
    coastline: Vector[];
    beaches: Vector[][];        // Multiple beach elevation bands
    peaks: Vector[];            // Mountain/volcano peaks
    valleys: Vector[][];        // River valleys
    heightmap: number[][];      // Original elevation data
    center: Vector;             // Island center in world coordinates
}

/**
 * Generates islands using heightmaps and the Diamond-Square algorithm
 * Extends WaterGenerator to provide heightmap-based island generation
 */
export default class HeightmapIslandGenerator extends WaterGenerator {
    private _islands: IslandFeatures[] = [];
    private diamondSquare: DiamondSquare;
    private marchingSquares: MarchingSquares;

    constructor(integrator: FieldIntegrator,
                origin: Vector,
                worldDimensions: Vector,
                params: WaterParams,
                tensorField: TensorField) {
        super(integrator, origin, worldDimensions, params, tensorField);
        this.diamondSquare = new DiamondSquare();
        this.marchingSquares = new MarchingSquares();
    }

    get islands(): IslandFeatures[] {
        return this._islands;
    }

    /**
     * Override createCoast to use heightmap islands when enabled
     */
    createCoast(): void {
        if (this.params.useHeightmapIslands) {
            this.createHeightmapIslands();
        } else {
            // Fall back to original streamline-based coastline generation
            super.createCoast();
        }
    }

    /**
     * Override createRiver to disable rivers when using heightmap islands
     * Rivers don't work well with island generation as they expect edge-reaching streamlines
     */
    createRiver(): void {
        if (this.params.useHeightmapIslands) {
            // Clear rivers for island mode
            this._riverPolygons = [];
            this._riverSecondaryRoads = [];
            this.tensorField.river = [];
            return;
        } else {
            // Use original river generation for coastline mode
            super.createRiver();
        }
    }

    private createHeightmapIslands(): void {
        this._islands = [];
        
        // Start with entire world as sea
        this._seaPolygon = this.createFullWorldSea();
        
        const { numIslands } = this.params.heightmapIslands;
        
        for (let i = 0; i < numIslands; i++) {
            const island = this.createSingleHeightmapIsland(i);
            if (island) {
                this._islands.push(island);
                
                // Subtract island from sea polygon using JSTS boolean operations
                // For now, we'll add island coastlines to the streamline system
                this.addIslandToSystem(island, i % 2 === 0); // Alternate major/minor
            }
        }
        
        // Update tensor field with island data
        this.updateTensorFieldWithIslands();
    }

    private createSingleHeightmapIsland(islandIndex: number): IslandFeatures | null {
        const params = this.params.heightmapIslands;
        
        // Generate island center position
        const center = this.generateIslandCenter(islandIndex);
        if (!center) {
            log.warn(`Could not find valid position for island ${islandIndex + 1}`);
            return null;
        }
        
        // Calculate island size with variation
        const sizeVariation = (Math.random() - 0.5) * 2 * params.sizeVariation;
        const actualSize = Math.round(params.baseSize * (1 + sizeVariation));
        const size = this.nearestPowerOfTwo(Math.max(64, actualSize)); // Minimum size 64
        
        try {
            // Generate heightmap
            const heightmap = this.diamondSquare.generateHeightmap({
                size: size,
                smoothness: params.smoothness,
                seed: islandIndex * 1337 // Deterministic seed per island
            });
            
            // Apply island-specific modifications
            let modifiedHeightmap = heightmap;
            
            if (params.volcanoMode) {
                modifiedHeightmap = this.applyVolcanicProfile(modifiedHeightmap);
            } else if (params.atolloMode) {
                modifiedHeightmap = this.applyAtollProfile(modifiedHeightmap);
            }
            
            // Apply island mask for natural falloff at edges with minimal randomness
            const falloffVariation = 0.9 + Math.random() * 0.2; // 0.9 to 1.1 multiplier (less random)
            modifiedHeightmap = DiamondSquare.applyIslandMask(modifiedHeightmap, params.falloffFactor * falloffVariation);
            
            // Normalize to ensure sea level threshold works correctly
            modifiedHeightmap = DiamondSquare.normalizeHeightmap(modifiedHeightmap, -1, 1);
            
            // Extract island features
            const features = this.extractIslandFeatures(modifiedHeightmap, center, params);
            
            if (!this.isValidIsland(features)) {
                log.warn(`Generated invalid island ${islandIndex + 1}`);
                return null;
            }
            
            log.info(`Generated island ${islandIndex + 1} at (${center.x.toFixed(0)}, ${center.y.toFixed(0)}) with ${features.coastline.length} coastline points`);
            return features;
            
        } catch (error) {
            log.error(`Failed to generate island ${islandIndex + 1}:`, error);
            return null;
        }
    }

    private generateIslandCenter(islandIndex: number): Vector | null {
        const attempts = 50;
        const minDistance = 800; // Minimum distance between islands
        
        for (let i = 0; i < attempts; i++) {
            const candidate = new Vector(
                this.origin.x + Math.random() * this.worldDimensions.x,
                this.origin.y + Math.random() * this.worldDimensions.y
            );
            
            // Check distance from existing islands
            let validPosition = true;
            for (const existingIsland of this._islands) {
                if (candidate.distanceTo(existingIsland.center) < minDistance) {
                    validPosition = false;
                    break;
                }
            }
            
            if (validPosition) {
                return candidate;
            }
        }
        
        return null; // Could not find valid position
    }

    private extractIslandFeatures(heightmap: number[][], center: Vector, params: HeightmapIslandParams): IslandFeatures {
        // Extract main coastline
        const coastlineHeightmap = this.marchingSquares.extractCoastline(heightmap, params.seaLevel);
        const coastline = MarchingSquares.heightmapToWorld(coastlineHeightmap, center, heightmap.length - 1, params.worldScale);
        
        // Extract beach zones
        const beachThresholds = [
            params.seaLevel + 0.1,
            params.seaLevel + 0.2,
            params.beachLevel
        ];
        const beachContoursHeightmap = this.marchingSquares.extractMultipleContours(heightmap, beachThresholds);
        const beaches = beachContoursHeightmap.map(contourSet => 
            contourSet.map(contour => 
                MarchingSquares.heightmapToWorld(contour, center, heightmap.length - 1, params.worldScale)
            )
        ).flat();
        
        // Find peaks (local maxima above threshold)
        const peaksHeightmap = this.findPeaks(heightmap, 0.6);
        const peaks = peaksHeightmap.map(peak => 
            MarchingSquares.heightmapToWorld([peak], center, heightmap.length - 1, params.worldScale)[0]
        );
        
        // Find valleys (connected low areas)
        const valleysHeightmap = this.findValleys(heightmap, params.seaLevel + 0.3);
        const valleys = valleysHeightmap.map(valley => 
            MarchingSquares.heightmapToWorld(valley, center, heightmap.length - 1, params.worldScale)
        );
        
        return {
            coastline,
            beaches,
            peaks,
            valleys,
            heightmap,
            center
        };
    }

    private applyVolcanicProfile(heightmap: number[][]): number[][] {
        const size = heightmap.length - 1;
        const center = size / 2;
        const maxRadius = center * 0.8;
        
        const modified: number[][] = [];
        
        for (let x = 0; x < heightmap.length; x++) {
            modified[x] = [];
            for (let y = 0; y < heightmap[x].length; y++) {
                const dx = x - center;
                const dy = y - center;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const normalizedDistance = Math.min(1, distance / maxRadius);
                
                // Volcanic elevation profile with steep central peak
                const volcanoHeight = Math.pow(1 - normalizedDistance, 1.5) * 0.8;
                modified[x][y] = heightmap[x][y] + volcanoHeight;
            }
        }
        
        return modified;
    }

    private applyAtollProfile(heightmap: number[][]): number[][] {
        const size = heightmap.length - 1;
        const center = size / 2;
        const innerRadius = center * 0.3;
        const outerRadius = center * 0.8;
        
        const modified: number[][] = [];
        
        for (let x = 0; x < heightmap.length; x++) {
            modified[x] = [];
            for (let y = 0; y < heightmap[x].length; y++) {
                const dx = x - center;
                const dy = y - center;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                let heightModification = 0;
                
                if (distance >= innerRadius && distance <= outerRadius) {
                    // Ring elevation (coral reef)
                    const ringPosition = (distance - innerRadius) / (outerRadius - innerRadius);
                    heightModification = Math.sin(ringPosition * Math.PI) * 0.4;
                } else if (distance < innerRadius) {
                    // Central lagoon (below sea level)
                    const lagoonDepth = (1 - distance / innerRadius) * 0.5;
                    heightModification = -lagoonDepth;
                }
                
                modified[x][y] = heightmap[x][y] + heightModification;
            }
        }
        
        return modified;
    }

    private findPeaks(heightmap: number[][], minHeight: number): Vector[] {
        const peaks: Vector[] = [];
        const width = heightmap.length;
        const height = heightmap[0].length;
        
        for (let x = 1; x < width - 1; x++) {
            for (let y = 1; y < height - 1; y++) {
                const elevation = heightmap[x][y];
                
                if (elevation > minHeight && this.isLocalMaximum(heightmap, x, y)) {
                    peaks.push(new Vector(x, y));
                }
            }
        }
        
        return peaks;
    }

    private isLocalMaximum(heightmap: number[][], x: number, y: number): boolean {
        const center = heightmap[x][y];
        
        // Check 3x3 neighborhood
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                if (x + dx < 0 || x + dx >= heightmap.length) continue;
                if (y + dy < 0 || y + dy >= heightmap[0].length) continue;
                
                if (heightmap[x + dx][y + dy] >= center) {
                    return false;
                }
            }
        }
        
        return true;
    }

    private findValleys(heightmap: number[][], maxHeight: number): Vector[][] {
        const valleys: Vector[][] = [];
        const visited = this.createBooleanGrid(heightmap.length, heightmap[0].length);
        
        for (let x = 0; x < heightmap.length; x++) {
            for (let y = 0; y < heightmap[0].length; y++) {
                if (!visited[x][y] && heightmap[x][y] < maxHeight) {
                    const valley = this.floodFillValley(heightmap, visited, x, y, maxHeight);
                    if (valley.length > 5) { // Minimum valley size
                        valleys.push(valley);
                    }
                }
            }
        }
        
        return valleys;
    }

    private floodFillValley(heightmap: number[][], visited: boolean[][], startX: number, startY: number, maxHeight: number): Vector[] {
        const valley: Vector[] = [];
        const stack: Vector[] = [new Vector(startX, startY)];
        
        while (stack.length > 0) {
            const current = stack.pop()!;
            const x = Math.floor(current.x);
            const y = Math.floor(current.y);
            
            if (x < 0 || x >= heightmap.length || y < 0 || y >= heightmap[0].length) continue;
            if (visited[x][y] || heightmap[x][y] >= maxHeight) continue;
            
            visited[x][y] = true;
            valley.push(new Vector(x, y));
            
            // Add neighbors to stack
            stack.push(new Vector(x - 1, y), new Vector(x + 1, y), new Vector(x, y - 1), new Vector(x, y + 1));
        }
        
        return valley;
    }

    private createBooleanGrid(width: number, height: number): boolean[][] {
        const grid: boolean[][] = [];
        for (let i = 0; i < width; i++) {
            grid[i] = new Array(height).fill(false);
        }
        return grid;
    }

    private addIslandToSystem(island: IslandFeatures, major: boolean): void {
        if (island.coastline.length === 0) return;
        
        // Add coastline to streamline system for collision detection
        // Note: Islands don't need edge-reaching extensions like continental coastlines
        const simplified = this.simplifyStreamline(island.coastline);
        this.allStreamlinesSimple.push(simplified);
        
        // Create intermediate samples for collision detection without edge extensions
        const complex = this.complexifyStreamlineForIsland(simplified);
        this.grid(major).addPolyline(complex);
        this.streamlines(major).push(complex);
        this.allStreamlines.push(complex);
    }

    /**
     * Island-specific complexification that doesn't apply edge-reaching extensions
     * Override parent method to prevent thin extensions to screen boundaries
     */
    private complexifyStreamlineForIsland(s: Vector[]): Vector[] {
        const out: Vector[] = [];
        for (let i = 0; i < s.length - 1; i++) {
            out.push(...this.complexifyStreamlineRecursive(s[i], s[i+1]));
        }
        // For closed island coastlines, connect back to start
        if (s.length > 2) {
            out.push(...this.complexifyStreamlineRecursive(s[s.length - 1], s[0]));
        }
        return out;
    }

    /**
     * Recursive helper for island streamline complexification
     * Replicates parent logic without edge-reaching modifications
     */
    private complexifyStreamlineRecursive(v1: Vector, v2: Vector): Vector[] {
        if (v1.distanceToSquared(v2) <= this.params.dstep * this.params.dstep) {
            return [v1, v2];
        }
        const d = v2.clone().sub(v1);
        const halfway = v1.clone().add(d.multiplyScalar(0.5));
        
        const complex = this.complexifyStreamlineRecursive(v1, halfway);
        complex.push(...this.complexifyStreamlineRecursive(halfway, v2));
        return complex;
    }

    private updateTensorFieldWithIslands(): void {
        // Update tensor field to recognize islands as land
        const islandCoastlines = this._islands.map(island => island.coastline);
        this.tensorField.islands = islandCoastlines;
        
        // Keep sea polygon as full world since we're subtracting islands
        this.tensorField.sea = this._seaPolygon;
    }

    private createFullWorldSea(): Vector[] {
        return [
            this.origin.clone(),
            new Vector(this.origin.x + this.worldDimensions.x, this.origin.y),
            new Vector(this.origin.x + this.worldDimensions.x, this.origin.y + this.worldDimensions.y),
            new Vector(this.origin.x, this.origin.y + this.worldDimensions.y)
        ];
    }

    private isValidIsland(island: IslandFeatures): boolean {
        if (!island.coastline || island.coastline.length < 10) {
            return false;
        }
        
        // Check if coastline forms a reasonable polygon
        const area = this.calculatePolygonArea(island.coastline);
        return area > 1000; // Minimum reasonable area
    }

    private calculatePolygonArea(polygon: Vector[]): number {
        if (polygon.length < 3) return 0;
        
        let area = 0;
        for (let i = 0; i < polygon.length; i++) {
            const j = (i + 1) % polygon.length;
            area += polygon[i].x * polygon[j].y;
            area -= polygon[j].x * polygon[i].y;
        }
        return Math.abs(area) / 2;
    }

    private nearestPowerOfTwo(n: number): number {
        return Math.pow(2, Math.round(Math.log2(n)));
    }
}