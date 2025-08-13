/**
 * Diamond-Square algorithm implementation for heightmap generation
 * Adapted from https://qiao.github.io/fractal-terrain-generator/
 */

export interface HeightmapOptions {
    size: number;        // Grid size (must be power of 2)
    smoothness: number;  // Controls terrain roughness (0.1-2.0)
    seed?: number;       // Random seed for reproducible results
}

export default class DiamondSquare {
    private rng: () => number;

    constructor(seed?: number) {
        if (seed !== undefined) {
            this.rng = this.seededRandom(seed);
        } else {
            this.rng = Math.random;
        }
    }

    /**
     * Generate heightmap using Diamond-Square algorithm
     * @param options Generation options
     * @returns 2D array of heights between -1 and 1
     */
    generateHeightmap(options: HeightmapOptions): number[][] {
        const { size, smoothness } = options;
        
        // Validate size is power of 2
        if (!this.isPowerOfTwo(size)) {
            throw new Error(`Size must be a power of 2, got ${size}`);
        }

        // Initialize heightmap grid
        const heightmap: number[][] = [];
        for (let i = 0; i <= size; i++) {
            heightmap[i] = new Array(size + 1).fill(0);
        }

        // Initialize corners with random values
        heightmap[0][0] = this.randomValue();
        heightmap[0][size] = this.randomValue();
        heightmap[size][0] = this.randomValue();
        heightmap[size][size] = this.randomValue();

        // Run Diamond-Square algorithm
        this.diamondSquare(heightmap, size, smoothness);

        return heightmap;
    }

    private diamondSquare(map: number[][], size: number, smoothness: number): void {
        let step = size;
        let scale = smoothness;

        while (step > 1) {
            const half = step / 2;

            // Diamond step: Calculate center points
            for (let x = half; x < size; x += step) {
                for (let y = half; y < size; y += step) {
                    const avg = (
                        map[x - half][y - half] +
                        map[x + half][y - half] +
                        map[x - half][y + half] +
                        map[x + half][y + half]
                    ) / 4;
                    
                    map[x][y] = avg + this.randomValue() * scale;
                }
            }

            // Square step: Calculate edge midpoints
            for (let x = 0; x <= size; x += half) {
                for (let y = (x + half) % step; y <= size; y += step) {
                    const avg = this.getSquareAverage(map, x, y, half, size);
                    map[x][y] = avg + this.randomValue() * scale;
                }
            }

            step /= 2;
            scale /= 2; // Reduce randomness at each iteration
        }
    }

    private getSquareAverage(map: number[][], x: number, y: number, half: number, size: number): number {
        let sum = 0;
        let count = 0;

        // Check all four neighbors with wrapping
        const neighbors = [
            [x - half, y],
            [x + half, y],
            [x, y - half],
            [x, y + half]
        ];

        for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx <= size && ny >= 0 && ny <= size) {
                sum += map[nx][ny];
                count++;
            }
        }

        return count > 0 ? sum / count : 0;
    }

    private randomValue(): number {
        return (this.rng() - 0.5) * 2; // Range: -1 to 1
    }

    private isPowerOfTwo(n: number): boolean {
        return n > 0 && (n & (n - 1)) === 0;
    }

    // Simple seeded random number generator
    private seededRandom(seed: number): () => number {
        let state = seed;
        return () => {
            state = (state * 1664525 + 1013904223) % 4294967296;
            return state / 4294967296;
        };
    }

    /**
     * Normalize heightmap values to specified range
     */
    static normalizeHeightmap(heightmap: number[][], min: number = 0, max: number = 1): number[][] {
        let minVal = Infinity;
        let maxVal = -Infinity;

        // Find actual min/max values
        for (let x = 0; x < heightmap.length; x++) {
            for (let y = 0; y < heightmap[x].length; y++) {
                minVal = Math.min(minVal, heightmap[x][y]);
                maxVal = Math.max(maxVal, heightmap[x][y]);
            }
        }

        const range = maxVal - minVal;
        if (range === 0) return heightmap;

        const targetRange = max - min;

        // Normalize to target range
        const normalized: number[][] = [];
        for (let x = 0; x < heightmap.length; x++) {
            normalized[x] = [];
            for (let y = 0; y < heightmap[x].length; y++) {
                const normalizedValue = ((heightmap[x][y] - minVal) / range) * targetRange + min;
                normalized[x][y] = normalizedValue;
            }
        }

        return normalized;
    }

    /**
     * Apply island mask to make heightmap suitable for islands
     * Creates much more solid landmasses with minimal water intrusion
     */
    static applyIslandMask(heightmap: number[][], falloffFactor: number = 2): number[][] {
        const size = heightmap.length - 1;
        const center = size / 2;
        const maxRadius = center * 0.9; // Use 90% of available radius

        const masked: number[][] = [];
        for (let x = 0; x < heightmap.length; x++) {
            masked[x] = [];
            for (let y = 0; y < heightmap[x].length; y++) {
                const dx = x - center;
                const dy = y - center;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const normalizedDistance = distance / maxRadius;
                
                let finalHeight;
                
                if (normalizedDistance <= 0.7) {
                    // Inner 70% - very solid landmass with high base elevation
                    const baseHeight = 0.6; // High base elevation
                    const terrainVariation = heightmap[x][y] * 0.4; // Reduced terrain variation
                    finalHeight = baseHeight + Math.max(0, terrainVariation);
                } else if (normalizedDistance <= 1.0) {
                    // Outer ring - controlled falloff
                    const falloffZone = (normalizedDistance - 0.7) / 0.3;
                    const falloffMultiplier = Math.max(0, 1 - Math.pow(falloffZone, falloffFactor));
                    
                    const baseHeight = 0.6 * falloffMultiplier;
                    const terrainVariation = heightmap[x][y] * 0.3 * falloffMultiplier;
                    finalHeight = baseHeight + Math.max(0, terrainVariation);
                } else {
                    // Beyond island - water
                    finalHeight = -0.5; // Ensure it's below any reasonable sea level
                }
                
                masked[x][y] = finalHeight;
            }
        }

        return masked;
    }
}