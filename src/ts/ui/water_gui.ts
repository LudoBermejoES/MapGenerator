// import * as log from 'loglevel'; // Unused
// import CanvasWrapper from './canvas_wrapper'; // Unused  
// import DomainController from './domain_controller'; // Unused
import Util from '../util';
import FieldIntegrator from '../impl/integrator';
import {StreamlineParams} from '../impl/streamlines';
import {WaterParams, HeightmapIslandParams} from '../impl/water_generator';
import WaterGenerator from '../impl/water_generator';
import SolidLandmassGenerator, {SolidLandmassParams} from '../impl/solid_landmass_generator';
import HeightmapIslandGenerator from '../impl/heightmap_island_generator';
import Vector from '../vector';
// import PolygonFinder from '../impl/polygon_finder'; // Unused
// import PolygonUtil from '../impl/polygon_util'; // Unused
import RoadGUI from './road_gui';
// import {NoiseParams} from '../impl/tensor_field'; // Unused
import TensorField from '../impl/tensor_field';

/**
 * Handles generation of river and coastline
 */
export default class WaterGUI extends RoadGUI {
    protected streamlines: WaterGenerator;

    constructor(private tensorField: TensorField,
                protected params: WaterParams,
                integrator: FieldIntegrator,
                guiFolder: dat.GUI,
                closeTensorFolder: () => void,
                folderName: string,
                redraw: () => void) {
        super(params, integrator, guiFolder, closeTensorFolder, folderName, redraw);
        this.streamlines = this.createWaterGenerator();
    }

    private createWaterGenerator(): WaterGenerator {
        if (this.params.useSolidLandmasses) {
            return new SolidLandmassGenerator(
                this.integrator, this.domainController.origin,
                this.domainController.worldDimensions,
                Object.assign({}, this.params) as SolidLandmassParams, this.tensorField);
        } else if (this.params.useHeightmapIslands) {
            return new HeightmapIslandGenerator(
                this.integrator, this.domainController.origin,
                this.domainController.worldDimensions,
                Object.assign({}, this.params), this.tensorField);
        } else {
            return new WaterGenerator(
                this.integrator, this.domainController.origin,
                this.domainController.worldDimensions,
                Object.assign({}, this.params), this.tensorField);
        }
    }

    initFolder(): WaterGUI {
        const folder = this.guiFolder.addFolder(this.folderName);
        folder.add({Generate: () => this.generateRoads()}, 'Generate');
        
        // Island generation mode controls
        const islandModeFolder = folder.addFolder('Generation Mode');
        islandModeFolder.add(this.params, 'useSolidLandmasses').name('Solid Landmasses');
        islandModeFolder.add(this.params, 'useHeightmapIslands').name('Heightmap Islands');
        
        // Initialize island parameters if they don't exist
        if (!this.params.heightmapIslands) {
            this.params.heightmapIslands = {
                numIslands: 3,
                baseSize: 256,
                sizeVariation: 0.3,
                smoothness: 0.5,
                seaLevel: 0.0,
                beachLevel: 0.1,
                worldScale: 2.0,
                falloffFactor: 2.0,
                volcanoMode: false,
                atolloMode: false
            };
        }
        
        // Heightmap island controls
        const heightmapFolder = folder.addFolder('Heightmap Islands');
        heightmapFolder.add(this.params.heightmapIslands, 'numIslands').min(1).max(10).step(1);
        heightmapFolder.add(this.params.heightmapIslands, 'baseSize').min(64).max(512).step(1);
        heightmapFolder.add(this.params.heightmapIslands, 'sizeVariation').min(0).max(1).step(0.1);
        heightmapFolder.add(this.params.heightmapIslands, 'smoothness').min(0.1).max(2.0).step(0.1);
        heightmapFolder.add(this.params.heightmapIslands, 'seaLevel').min(-1).max(1).step(0.1);
        heightmapFolder.add(this.params.heightmapIslands, 'beachLevel').min(-1).max(1).step(0.1);
        heightmapFolder.add(this.params.heightmapIslands, 'worldScale').min(0.5).max(5.0).step(0.1);
        heightmapFolder.add(this.params.heightmapIslands, 'falloffFactor').min(0.5).max(5.0).step(0.1);
        heightmapFolder.add(this.params.heightmapIslands, 'volcanoMode').name('Volcano Mode');
        heightmapFolder.add(this.params.heightmapIslands, 'atolloMode').name('Atoll Mode');
        
        const coastParamsFolder = folder.addFolder('CoastParams');
        coastParamsFolder.add(this.params.coastNoise, 'noiseEnabled');
        coastParamsFolder.add(this.params.coastNoise, 'noiseSize');
        coastParamsFolder.add(this.params.coastNoise, 'noiseAngle');
        const riverParamsFolder = folder.addFolder('RiverParams');
        riverParamsFolder.add(this.params, 'numRivers').min(0).max(10).step(1);
        riverParamsFolder.add(this.params.riverNoise, 'noiseEnabled');
        riverParamsFolder.add(this.params.riverNoise, 'noiseSize');
        riverParamsFolder.add(this.params.riverNoise, 'noiseAngle');
        
        folder.add(this.params, 'simplifyTolerance');
        const devParamsFolder = folder.addFolder('Dev');
        this.addDevParamsToFolder(this.params, devParamsFolder);
        return this;
    }

    generateRoads(): Promise<void> {
        this.preGenerateCallback();

        this.domainController.zoom = this.domainController.zoom / Util.DRAW_INFLATE_AMOUNT;
        this.streamlines = this.createWaterGenerator();
        this.domainController.zoom = this.domainController.zoom * Util.DRAW_INFLATE_AMOUNT;

        this.streamlines.createCoast();
        this.streamlines.createRiver();
       
        this.closeTensorFolder();
        this.redraw();
        this.postGenerateCallback();
        return new Promise<void>(resolve => resolve());
    }

    /**
     * Secondary road runs along other side of river
     */
    get streamlinesWithSecondaryRoad(): Vector[][] {
        const withSecondary = this.streamlines.allStreamlinesSimple.slice();
        // Add all secondary roads
        this.streamlines.riverSecondaryRoads.forEach(road => {
            withSecondary.push(road);
        });
        return withSecondary;
    }

    get rivers(): Vector[][] {
        return this.streamlines.riverPolygons.map(river =>
            river.map(v => this.domainController.worldToScreen(v.clone()))
        );
    }

    get secondaryRivers(): Vector[][] {
        return this.streamlines.riverSecondaryRoads.map(road =>
            road.map(v => this.domainController.worldToScreen(v.clone()))
        );
    }

    // Backward compatibility - returns first river or empty array
    get river(): Vector[] {
        const rivers = this.rivers;
        return rivers.length > 0 ? rivers[0] : [];
    }

    get secondaryRiver(): Vector[] {
        const secondaryRivers = this.secondaryRivers;
        return secondaryRivers.length > 0 ? secondaryRivers[0] : [];
    }

    get coastline(): Vector[] {
        // Use unsimplified noisy streamline as coastline
        // Visual only, no road logic performed using this
        return this.streamlines.coastline.map(v => this.domainController.worldToScreen(v.clone()));
    }

    get seaPolygon(): Vector[] {
        return this.streamlines.seaPolygon.map(v => this.domainController.worldToScreen(v.clone()));
    }

    protected addDevParamsToFolder(params: StreamlineParams, folder: dat.GUI): void {
        folder.add(params, 'dsep');
        folder.add(params, 'dtest');
        folder.add(params, 'pathIterations');
        folder.add(params, 'seedTries');
        folder.add(params, 'dstep');
        folder.add(params, 'dlookahead');
        folder.add(params, 'dcirclejoin');
        folder.add(params, 'joinangle');
    }
    
}
