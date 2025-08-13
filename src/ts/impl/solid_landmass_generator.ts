import * as log from 'loglevel';
import Vector from '../vector';
import FieldIntegrator from './integrator';
import {StreamlineParams} from './streamlines';
import WaterGenerator, {WaterParams, NoiseStreamlineParams} from './water_generator';
import TensorField from './tensor_field';
import PolygonUtil from './polygon_util';

export interface SolidLandmassParams extends WaterParams {
    useSolidLandmasses: boolean;
    landmassGeneration: {
        landmassType: 'peninsula' | 'island_chain' | 'continent' | 'archipelago';
        primaryLandmassSize: number;        // 0.3-0.8 of world area
        coastalComplexity: number;          // 0.1-1.0 coastline detail level
        developableAreaRatio: number;       // 0.4-0.8 minimum flat land percentage
        naturalFeatures: {
            bays: { enabled: boolean; count: number; depth: number; };
            peninsulas: { enabled: boolean; count: number; length: number; };
            capes: { enabled: boolean; count: number; prominence: number; };
            inlets: { enabled: boolean; count: number; depth: number; };
        };
        secondaryLandmasses: {
            enabled: boolean;
            count: number;              // Number of smaller islands/landmasses
            sizeRange: [number, number]; // Size relative to primary landmass
            proximityFactor: number;     // How close to main landmass (0-1)
        };
    };
}

/**
 * Generates solid landmasses using a land-first approach
 * Prioritizes creating substantial, developable land areas
 */
export default class SolidLandmassGenerator extends WaterGenerator {
    private _primaryLandmass: Vector[] = [];
    private _secondaryLandmasses: Vector[][] = [];
    private _developableAreas: Vector[][] = [];
    private _naturalHarbors: Vector[] = [];

    constructor(integrator: FieldIntegrator,
                origin: Vector,
                worldDimensions: Vector,
                protected params: SolidLandmassParams,
                tensorField: TensorField) {
        super(integrator, origin, worldDimensions, params, tensorField);
    }

    get primaryLandmass(): Vector[] {
        return this._primaryLandmass;
    }

    get secondaryLandmasses(): Vector[][] {
        return this._secondaryLandmasses;
    }

    get developableAreas(): Vector[][] {
        return this._developableAreas;
    }

    get naturalHarbors(): Vector[] {
        return this._naturalHarbors;
    }

    /**
     * Override the coastline generation to use solid landmass approach
     */
    createCoast(): void {
        if (this.params.useSolidLandmasses) {
            this.createSolidLandmasses();
        } else {
            // Fall back to original coastline generation
            super.createCoast();
        }
    }

    private createSolidLandmasses(): void {
        log.info('Generating solid landmasses...');
        
        // Step 1: Generate primary landmass foundation
        this._primaryLandmass = this.generatePrimaryLandmass();
        
        // Step 2: Add natural coastal features
        this._primaryLandmass = this.addCoastalFeatures(this._primaryLandmass);
        
        // Step 3: Generate secondary landmasses if enabled
        if (this.params.landmassGeneration.secondaryLandmasses.enabled) {
            this._secondaryLandmasses = this.generateSecondaryLandmasses();
        }
        
        // Step 4: Identify and preserve developable areas
        this._developableAreas = this.identifyDevelopableAreas();
        
        // Step 5: Create natural harbors and bays
        this._naturalHarbors = this.createNaturalHarbors();
        
        // Step 6: Generate sea polygon as negative space
        this._seaPolygon = this.generateSeaFromLandmasses();
        
        // Step 7: Update tensor field with solid landmasses
        this.updateTensorFieldForLandmasses();
        
        // Step 8: Set coastline for compatibility
        this._coastline = this._primaryLandmass.slice();
        
        log.info(`Generated primary landmass with ${this._primaryLandmass.length} points`);
        log.info(`Generated ${this._secondaryLandmasses.length} secondary landmasses`);
        log.info(`Identified ${this._developableAreas.length} developable areas`);
        log.info(`Created ${this._naturalHarbors.length} natural harbors`);
    }

    private generatePrimaryLandmass(): Vector[] {
        const centerX = this.worldDimensions.x * 0.5;
        const centerY = this.worldDimensions.y * 0.5;
        const center = new Vector(centerX, centerY).add(this.origin);
        
        switch (this.params.landmassGeneration.landmassType) {
            case 'peninsula':
                return this.generatePeninsula(center);
            case 'continent':
                return this.generateContinent(center);
            case 'island_chain':
                return this.generateMainIsland(center);
            case 'archipelago':
                return this.generateArchipelagoCore(center);
            default:
                return this.generateContinent(center);
        }
    }

    private generateContinent(center: Vector): Vector[] {
        const size = this.params.landmassGeneration.primaryLandmassSize;
        const baseRadius = Math.min(this.worldDimensions.x, this.worldDimensions.y) * size * 0.4;
        
        // Create organic continent shape using multiple overlapping circles
        const controlPoints = this.generateContinentControlPoints(center, baseRadius);
        const roughShape = this.createOrganicShape(controlPoints, baseRadius);
        
        // Ensure continent reaches at least one world edge for realistic geography
        return this.extendToWorldEdge(roughShape);
    }

    private generatePeninsula(center: Vector): Vector[] {
        const size = this.params.landmassGeneration.primaryLandmassSize;
        const baseRadius = Math.min(this.worldDimensions.x, this.worldDimensions.y) * size * 0.3;
        
        // Peninsula extends from one edge of the world
        const edgeConnection = this.selectRandomWorldEdge();
        const peninsulaBase = this.createPeninsulaBase(edgeConnection);
        const peninsulaBody = this.createOrganicShape([center], baseRadius);
        
        // Connect base to body with natural transition
        return this.connectLandmassShapes(peninsulaBase, peninsulaBody);
    }

    private generateMainIsland(center: Vector): Vector[] {
        const size = this.params.landmassGeneration.primaryLandmassSize;
        const baseRadius = Math.min(this.worldDimensions.x, this.worldDimensions.y) * size * 0.35;
        
        // Create main island as organic circle
        return this.createOrganicCircle(center, baseRadius);
    }

    private generateArchipelagoCore(center: Vector): Vector[] {
        // Similar to main island but slightly larger to accommodate secondary landmasses
        const size = this.params.landmassGeneration.primaryLandmassSize;
        const baseRadius = Math.min(this.worldDimensions.x, this.worldDimensions.y) * size * 0.3;
        
        return this.createOrganicCircle(center, baseRadius);
    }

    private generateContinentControlPoints(center: Vector, baseRadius: number): Vector[] {
        const numPoints = 8 + Math.floor(Math.random() * 4); // 8-12 control points
        const points: Vector[] = [];
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const radiusVariation = 0.7 + Math.random() * 0.6; // 70%-130% of base radius
            const radius = baseRadius * radiusVariation;
            
            const x = center.x + Math.cos(angle) * radius;
            const y = center.y + Math.sin(angle) * radius;
            points.push(new Vector(x, y));
        }
        
        return points;
    }

    private createOrganicShape(controlPoints: Vector[], baseRadius: number): Vector[] {
        if (controlPoints.length === 1) {
            // Single point - create circular base with organic variation
            return this.createOrganicCircle(controlPoints[0], baseRadius);
        }
        
        // Multiple points - create convex hull then add organic variation
        const hull = this.computeConvexHull(controlPoints);
        return this.addOrganicVariation(hull, baseRadius * 0.2);
    }

    private createOrganicCircle(center: Vector, radius: number): Vector[] {
        const points: Vector[] = [];
        const numSegments = 32 + Math.floor(Math.random() * 16); // 32-48 segments
        
        for (let i = 0; i < numSegments; i++) {
            const angle = (i / numSegments) * Math.PI * 2;
            
            // Add organic variation using multiple noise octaves
            const radiusVariation = this.getOrganicRadiusVariation(angle, radius);
            const actualRadius = radius * radiusVariation;
            
            const x = center.x + Math.cos(angle) * actualRadius;
            const y = center.y + Math.sin(angle) * actualRadius;
            points.push(new Vector(x, y));
        }
        
        return points;
    }

    private getOrganicRadiusVariation(angle: number, baseRadius: number): number {
        // Multiple octaves of noise for natural coastline variation
        let variation = 1.0;
        
        // Large-scale features (bays, peninsulas)
        variation += Math.sin(angle * 3 + Math.random() * Math.PI) * 0.3;
        variation += Math.cos(angle * 5 + Math.random() * Math.PI) * 0.2;
        
        // Medium-scale features (headlands, coves)
        variation += Math.sin(angle * 8 + Math.random() * Math.PI) * 0.15;
        variation += Math.cos(angle * 12 + Math.random() * Math.PI) * 0.1;
        
        // Small-scale features (detailed coastline)
        if (this.params.landmassGeneration.coastalComplexity > 0.5) {
            variation += Math.sin(angle * 20 + Math.random() * Math.PI) * 0.08;
            variation += Math.cos(angle * 30 + Math.random() * Math.PI) * 0.05;
        }
        
        // Ensure variation stays within reasonable bounds
        return Math.max(0.4, Math.min(1.6, variation));
    }

    // Placeholder methods - will implement in subsequent phases
    private addCoastalFeatures(landmass: Vector[]): Vector[] {
        // Phase 2 implementation
        return landmass;
    }

    private generateSecondaryLandmasses(): Vector[][] {
        // Phase 2 implementation
        return [];
    }

    private identifyDevelopableAreas(): Vector[][] {
        // Phase 3 implementation
        return [];
    }

    private createNaturalHarbors(): Vector[] {
        // Phase 2 implementation
        return [];
    }

    private generateSeaFromLandmasses(): Vector[] {
        // Create world boundary rectangle
        const worldBounds = [
            this.origin.clone(),
            new Vector(this.origin.x + this.worldDimensions.x, this.origin.y),
            new Vector(this.origin.x + this.worldDimensions.x, this.origin.y + this.worldDimensions.y),
            new Vector(this.origin.x, this.origin.y + this.worldDimensions.y)
        ];
        
        // For now, use simple approach - sea is everything not in primary landmass
        // TODO: Implement proper boolean operations for multiple landmasses
        try {
            return PolygonUtil.subtractPolygons(worldBounds, this._primaryLandmass);
        } catch (error) {
            log.warn('Failed to create sea polygon, using world bounds:', error);
            return worldBounds;
        }
    }

    private updateTensorFieldForLandmasses(): void {
        // Update tensor field with landmass information
        this.tensorField.sea = this._seaPolygon;
        
        // Add landmasses to tensor field for land detection
        // This will require extending TensorField to support multiple landmasses
        if (this.tensorField.setLandmasses) {
            this.tensorField.setLandmasses([this._primaryLandmass, ...this._secondaryLandmasses]);
        }
    }

    // Helper methods - simplified implementations for Phase 1
    private computeConvexHull(points: Vector[]): Vector[] {
        // Simple convex hull using gift wrapping algorithm
        if (points.length < 3) return points;
        
        // Find leftmost point
        let leftmost = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].x < points[leftmost].x) {
                leftmost = i;
            }
        }
        
        const hull: Vector[] = [];
        let current = leftmost;
        
        do {
            hull.push(points[current]);
            let next = (current + 1) % points.length;
            
            for (let i = 0; i < points.length; i++) {
                if (this.orientation(points[current], points[i], points[next]) === 2) {
                    next = i;
                }
            }
            
            current = next;
        } while (current !== leftmost);
        
        return hull;
    }

    private orientation(p: Vector, q: Vector, r: Vector): number {
        const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
        if (val === 0) return 0;  // collinear
        return (val > 0) ? 1 : 2; // clockwise or counterclockwise
    }

    private addOrganicVariation(polygon: Vector[], maxVariation: number): Vector[] {
        // Add small random variations to polygon points
        return polygon.map(point => {
            const variation = (Math.random() - 0.5) * maxVariation;
            const angle = Math.random() * Math.PI * 2;
            return point.clone().add(new Vector(
                Math.cos(angle) * variation,
                Math.sin(angle) * variation
            ));
        });
    }

    private extendToWorldEdge(shape: Vector[]): Vector[] {
        // For Phase 1, return shape as-is
        // TODO: Implement proper edge extension
        return shape;
    }

    private selectRandomWorldEdge(): string {
        const edges = ['north', 'south', 'east', 'west'];
        return edges[Math.floor(Math.random() * edges.length)];
    }

    private createPeninsulaBase(edge: string): Vector[] {
        // Simplified peninsula base creation
        const baseWidth = this.worldDimensions.x * 0.3;
        const baseHeight = this.worldDimensions.y * 0.1;
        
        switch (edge) {
            case 'north':
                return [
                    new Vector(this.origin.x, this.origin.y + this.worldDimensions.y),
                    new Vector(this.origin.x + baseWidth, this.origin.y + this.worldDimensions.y),
                    new Vector(this.origin.x + baseWidth, this.origin.y + this.worldDimensions.y - baseHeight),
                    new Vector(this.origin.x, this.origin.y + this.worldDimensions.y - baseHeight)
                ];
            default:
                // Default to south edge
                return [
                    new Vector(this.origin.x, this.origin.y),
                    new Vector(this.origin.x + baseWidth, this.origin.y),
                    new Vector(this.origin.x + baseWidth, this.origin.y + baseHeight),
                    new Vector(this.origin.x, this.origin.y + baseHeight)
                ];
        }
    }

    private connectLandmassShapes(base: Vector[], body: Vector[]): Vector[] {
        // Simple connection - just concatenate for now
        // TODO: Implement proper shape merging
        return [...base, ...body];
    }
}