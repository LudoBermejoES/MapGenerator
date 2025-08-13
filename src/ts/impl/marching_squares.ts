import Vector from '../vector';

/**
 * Marching Squares algorithm implementation for contour extraction
 * Extracts coastlines and other contour lines from heightmaps
 */

interface LineSegment {
    start: Vector;
    end: Vector;
}

export interface ContourOptions {
    threshold: number;      // Height threshold for contour
    smoothing?: boolean;    // Apply smoothing to extracted contours
    minLength?: number;     // Minimum contour length to keep
}

export default class MarchingSquares {
    // Marching squares lookup table
    // Each index represents a 4-bit configuration of corners above/below threshold
    private static readonly EDGE_TABLE: Vector[][][] = [
        [],                                                                    // 0000
        [[new Vector(0, 0.5), new Vector(0.5, 0)]],                          // 0001
        [[new Vector(0.5, 0), new Vector(1, 0.5)]],                          // 0010
        [[new Vector(0, 0.5), new Vector(1, 0.5)]],                          // 0011
        [[new Vector(1, 0.5), new Vector(0.5, 1)]],                          // 0100
        [[new Vector(0, 0.5), new Vector(0.5, 0)], [new Vector(1, 0.5), new Vector(0.5, 1)]], // 0101 (ambiguous)
        [[new Vector(0.5, 0), new Vector(0.5, 1)]],                          // 0110
        [[new Vector(0, 0.5), new Vector(0.5, 1)]],                          // 0111
        [[new Vector(0.5, 1), new Vector(0, 0.5)]],                          // 1000
        [[new Vector(0.5, 0), new Vector(0.5, 1)]],                          // 1001
        [[new Vector(0.5, 1), new Vector(0, 0.5)], [new Vector(0.5, 0), new Vector(1, 0.5)]], // 1010 (ambiguous)
        [[new Vector(0.5, 0), new Vector(1, 0.5)]],                          // 1011
        [[new Vector(1, 0.5), new Vector(0, 0.5)]],                          // 1100
        [[new Vector(0.5, 0), new Vector(1, 0.5)]],                          // 1101
        [[new Vector(0, 0.5), new Vector(0.5, 0)]],                          // 1110
        []                                                                     // 1111
    ];

    /**
     * Extract contour lines from heightmap at specified threshold
     */
    extractContours(heightmap: number[][], options: ContourOptions): Vector[][] {
        const { threshold, smoothing = true, minLength = 5 } = options;
        
        // Extract line segments using marching squares
        const segments = this.extractSegments(heightmap, threshold);
        
        // Connect segments into continuous contours
        const contours = this.connectSegments(segments);
        
        // Filter out short contours
        const filteredContours = contours.filter(contour => contour.length >= minLength);
        
        // Apply smoothing if requested
        if (smoothing) {
            return filteredContours.map(contour => this.smoothContour(contour));
        }
        
        return filteredContours;
    }

    /**
     * Extract primary coastline (largest contour) from heightmap
     */
    extractCoastline(heightmap: number[][], threshold: number): Vector[] {
        const contours = this.extractContours(heightmap, { threshold, smoothing: true, minLength: 20 });
        
        if (contours.length === 0) {
            return [];
        }
        
        // Find the contour with the largest area (most enclosed land)
        let bestContour = contours[0];
        let maxArea = this.calculateContourArea(contours[0]);
        
        for (let i = 1; i < contours.length; i++) {
            const area = this.calculateContourArea(contours[i]);
            if (area > maxArea) {
                maxArea = area;
                bestContour = contours[i];
            }
        }
        
        return bestContour;
    }

    private extractSegments(heightmap: number[][], threshold: number): LineSegment[] {
        const segments: LineSegment[] = [];
        const width = heightmap.length - 1;
        const height = heightmap[0].length - 1;

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const config = this.getGridConfiguration(heightmap, x, y, threshold);
                const edgeSegments = MarchingSquares.EDGE_TABLE[config];
                
                for (const edge of edgeSegments) {
                    const start = new Vector(x + edge[0].x, y + edge[0].y);
                    const end = new Vector(x + edge[1].x, y + edge[1].y);
                    segments.push({ start, end });
                }
            }
        }

        return segments;
    }

    private getGridConfiguration(heightmap: number[][], x: number, y: number, threshold: number): number {
        let config = 0;
        
        // Check 2x2 grid cell corners (clockwise from bottom-left)
        if (heightmap[x][y] >= threshold) config |= 1;           // Bottom-left
        if (heightmap[x + 1][y] >= threshold) config |= 2;       // Bottom-right  
        if (heightmap[x + 1][y + 1] >= threshold) config |= 4;   // Top-right
        if (heightmap[x][y + 1] >= threshold) config |= 8;       // Top-left
        
        return config;
    }

    private connectSegments(segments: LineSegment[]): Vector[][] {
        if (segments.length === 0) return [];
        
        const contours: Vector[][] = [];
        const used = new Set<number>();
        
        for (let i = 0; i < segments.length; i++) {
            if (used.has(i)) continue;
            
            const contour = this.buildContour(segments, i, used);
            if (contour.length > 0) {
                contours.push(contour);
            }
        }
        
        return contours;
    }

    private buildContour(segments: LineSegment[], startIndex: number, used: Set<number>): Vector[] {
        const contour: Vector[] = [];
        const epsilon = 0.01; // Tolerance for connecting segments
        
        let currentSegment = segments[startIndex];
        used.add(startIndex);
        
        contour.push(currentSegment.start.clone());
        contour.push(currentSegment.end.clone());
        
        let current = currentSegment.end;
        let foundConnection = true;
        
        // Build contour by connecting segments
        while (foundConnection) {
            foundConnection = false;
            
            for (let i = 0; i < segments.length; i++) {
                if (used.has(i)) continue;
                
                const segment = segments[i];
                
                // Check if segment connects to current endpoint
                if (current.distanceTo(segment.start) < epsilon) {
                    contour.push(segment.end.clone());
                    current = segment.end;
                    used.add(i);
                    foundConnection = true;
                    break;
                } else if (current.distanceTo(segment.end) < epsilon) {
                    contour.push(segment.start.clone());
                    current = segment.start;
                    used.add(i);
                    foundConnection = true;
                    break;
                }
            }
        }
        
        // Try to close the contour if possible
        if (contour.length > 2) {
            const first = contour[0];
            const last = contour[contour.length - 1];
            if (first.distanceTo(last) < epsilon * 5) {
                contour.push(first.clone()); // Close the contour
            }
        }
        
        return contour;
    }

    private calculateContourLength(contour: Vector[]): number {
        let length = 0;
        for (let i = 0; i < contour.length - 1; i++) {
            length += contour[i].distanceTo(contour[i + 1]);
        }
        return length;
    }

    private calculateContourArea(contour: Vector[]): number {
        if (contour.length < 3) return 0;
        
        // Use shoelace formula to calculate polygon area
        let area = 0;
        for (let i = 0; i < contour.length - 1; i++) {
            area += contour[i].x * contour[i + 1].y - contour[i + 1].x * contour[i].y;
        }
        // Close the polygon if not already closed
        if (contour[0].distanceTo(contour[contour.length - 1]) > 0.1) {
            const last = contour.length - 1;
            area += contour[last].x * contour[0].y - contour[0].x * contour[last].y;
        }
        return Math.abs(area) / 2;
    }

    private smoothContour(contour: Vector[]): Vector[] {
        if (contour.length < 3) return contour;
        
        const smoothed: Vector[] = [];
        const alpha = 0.5; // Smoothing factor
        
        // Keep first point
        smoothed.push(contour[0].clone());
        
        // Apply simple moving average smoothing
        for (let i = 1; i < contour.length - 1; i++) {
            const prev = contour[i - 1];
            const curr = contour[i];
            const next = contour[i + 1];
            
            const smoothedPoint = new Vector(
                curr.x * (1 - alpha) + (prev.x + next.x) * alpha * 0.5,
                curr.y * (1 - alpha) + (prev.y + next.y) * alpha * 0.5
            );
            
            smoothed.push(smoothedPoint);
        }
        
        // Keep last point
        smoothed.push(contour[contour.length - 1].clone());
        
        return smoothed;
    }

    /**
     * Convert heightmap coordinates to world coordinates
     */
    static heightmapToWorld(heightmapPoints: Vector[], center: Vector, heightmapSize: number, worldScale: number): Vector[] {
        return heightmapPoints.map(point => {
            const worldX = center.x + (point.x - heightmapSize / 2) * worldScale;
            const worldY = center.y + (point.y - heightmapSize / 2) * worldScale;
            return new Vector(worldX, worldY);
        });
    }

    /**
     * Extract multiple contour levels from heightmap
     */
    extractMultipleContours(heightmap: number[][], thresholds: number[]): Vector[][][] {
        return thresholds.map(threshold => 
            this.extractContours(heightmap, { threshold, smoothing: true })
        );
    }
}