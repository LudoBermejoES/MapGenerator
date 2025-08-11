import * as log from 'loglevel';
import * as THREE from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import JSZip from 'jszip';
import Vector from './vector';
import { CSG } from 'three-csg-ts';
import {BuildingModel} from './ui/buildings';

enum ModelGeneratorStates {
    WAITING,
    SUBTRACT_OCEAN,
    ADD_COASTLINE,
    SUBTRACT_RIVER,
    ADD_ROADS,
    ADD_BLOCKS,
    ADD_BUILDINGS,
    CREATE_ZIP,
}

export default class ModelGenerator {
    private readonly groundLevel = 20;  // Thickness of groundMesh

    private readonly stlExporter = new STLExporter();
    private resolve: (blob: Blob) => void = _b => {};
    private zip: JSZip;
    private state: ModelGeneratorStates = ModelGeneratorStates.WAITING;


    private groundMesh: THREE.Mesh;
    private groundBsp: CSG;
    private polygonsToProcess: Vector[][] = [];
    private roadsMeshes: THREE.Mesh[] = [];
    private blocksMeshes: THREE.Mesh[] = [];
    private roadsBsp: CSG;
    private buildingsMeshes: THREE.Mesh[] = [];
    private buildingsToProcess: BuildingModel[];


    constructor(private ground: Vector[],
                private sea: Vector[],
                private coastline: Vector[],
                private river: Vector[],
                private mainRoads: Vector[][],
                private majorRoads: Vector[][],
                private minorRoads: Vector[][],
                private buildings: BuildingModel[],
                private blocks: Vector[][]) {
    }

    public async getSTL(): Promise<Blob> {
        return new Promise<Blob>(resolve => {
            this.resolve = resolve;
            this.zip = new JSZip();
            this.zip.file("model/README.txt", "For a tutorial on putting these models together to create a city, go to https://maps.probabletrain.com/#/stl");

            this.groundMesh = this.polygonToMesh(this.ground, this.groundLevel);
            this.groundBsp = CSG.fromMesh(this.groundMesh);
            this.setState(ModelGeneratorStates.SUBTRACT_OCEAN);
        });
    }

    private setState(s: ModelGeneratorStates): void {
        this.state = s;
        log.info(ModelGeneratorStates[s]);
    }

    /**
     * Return true if processing a model
     * Work done in update loop so main thread isn't swamped
     */
    public update(): boolean {
        switch(this.state) {
            case ModelGeneratorStates.WAITING: {
                return false;
            }
            case ModelGeneratorStates.SUBTRACT_OCEAN: {
                const seaLevelMesh = this.polygonToMesh(this.ground, 0);
                if (seaLevelMesh) {
                    this.threeToBlender(seaLevelMesh);
                    const seaLevelSTL = this.stlExporter.parse(seaLevelMesh);
                    this.zip.file("model/domain.stl", seaLevelSTL);
                }

                const seaMesh = this.polygonToMesh(this.sea, 0);
                if (seaMesh) {
                    this.threeToBlender(seaMesh);
                    const seaMeshSTL = this.stlExporter.parse(seaMesh);
                    this.zip.file("model/sea.stl", seaMeshSTL);
                }
                this.setState(ModelGeneratorStates.ADD_COASTLINE);
                break;
            }
            case ModelGeneratorStates.ADD_COASTLINE: {
                const coastlineMesh = this.polygonToMesh(this.coastline, 0);
                if (coastlineMesh) {
                    this.threeToBlender(coastlineMesh);
                    const coastlineSTL = this.stlExporter.parse(coastlineMesh);
                    this.zip.file("model/coastline.stl", coastlineSTL);
                }
                this.setState(ModelGeneratorStates.SUBTRACT_RIVER);
                break;
            }
            case ModelGeneratorStates.SUBTRACT_RIVER: {
                const riverMesh = this.polygonToMesh(this.river, 0);
                if (riverMesh) {
                    this.threeToBlender(riverMesh);
                    const riverSTL = this.stlExporter.parse(riverMesh);
                    this.zip.file("model/river.stl", riverSTL);
                }
                this.setState(ModelGeneratorStates.ADD_ROADS);
                this.polygonsToProcess = this.minorRoads.concat(this.majorRoads).concat(this.mainRoads);
                break;
            }
            case ModelGeneratorStates.ADD_ROADS: {
                if (this.polygonsToProcess.length === 0) {
                    // Create a group with all road meshes
                    const group = new THREE.Group();
                    this.roadsMeshes.forEach(mesh => {
                        const clonedMesh = mesh.clone();
                        clonedMesh.applyMatrix4(this.groundMesh.matrix);
                        group.add(clonedMesh);
                    });
                    this.threeToBlender(group);
                    const buildingsSTL = this.stlExporter.parse(group);
                    this.zip.file("model/roads.stl", buildingsSTL);
                    
                    this.setState(ModelGeneratorStates.ADD_BLOCKS);
                    this.polygonsToProcess = [...this.blocks];
                    break;
                }

                const road = this.polygonsToProcess.pop();
                const roadsMesh = this.polygonToMesh(road, 0);
                if (roadsMesh) {
                    this.roadsMeshes.push(roadsMesh);
                }
                break;
            }
            case ModelGeneratorStates.ADD_BLOCKS: {
                if (this.polygonsToProcess.length === 0) {
                    // Create a group with all block meshes
                    const group = new THREE.Group();
                    this.blocksMeshes.forEach(mesh => {
                        const clonedMesh = mesh.clone();
                        clonedMesh.applyMatrix4(this.groundMesh.matrix);
                        group.add(clonedMesh);
                    });
                    this.threeToBlender(group);
                    const blocksSTL = this.stlExporter.parse(group);
                    this.zip.file("model/blocks.stl", blocksSTL);

                    this.setState(ModelGeneratorStates.ADD_BUILDINGS);
                    this.buildingsToProcess = [...this.buildings];
                    break; 
                }

                const block = this.polygonsToProcess.pop();
                const blockMesh = this.polygonToMesh(block, 1);
                if (blockMesh) {
                    this.blocksMeshes.push(blockMesh);
                }
                break;
            }
            case ModelGeneratorStates.ADD_BUILDINGS: {
                if (this.buildingsToProcess.length === 0) {
                    // Create a group with all building meshes
                    const group = new THREE.Group();
                    this.buildingsMeshes.forEach(mesh => {
                        const clonedMesh = mesh.clone();
                        clonedMesh.applyMatrix4(this.groundMesh.matrix);
                        group.add(clonedMesh);
                    });
                    this.threeToBlender(group);
                    const buildingsSTL = this.stlExporter.parse(group);
                    this.zip.file("model/buildings.stl", buildingsSTL);
                    this.setState(ModelGeneratorStates.CREATE_ZIP);
                    break;
                }

                const b = this.buildingsToProcess.pop();
                const buildingMesh = this.polygonToMesh(b.lotScreen, b.height);
                if (buildingMesh) {
                    this.buildingsMeshes.push(buildingMesh);
                }
                break;
            }
            case ModelGeneratorStates.CREATE_ZIP: {
                this.zip.generateAsync({type:"blob"}).then((blob: Blob) => this.resolve(blob));
                this.setState(ModelGeneratorStates.WAITING);
                break;
            }
            default: {
                break;
            }
        }
        return true;
    }

    /**
     * Rotate and scale mesh so up is in the right direction
     */
    private threeToBlender(mesh: THREE.Object3D): void {
        mesh.scale.multiplyScalar(0.02);
        mesh.updateMatrixWorld(true);
    }

    /**
     * Extrude a polygon into a THREE.js mesh
     */
    private polygonToMesh(polygon: Vector[], height: number): THREE.Mesh | null {
        if (polygon.length < 3) {
            log.error("Tried to export empty polygon as OBJ");
            return null;
        }
        const shape = new THREE.Shape();
        shape.moveTo(polygon[0].x, polygon[0].y);
        for (let i = 1; i < polygon.length; i++) {
            shape.lineTo(polygon[i].x, polygon[i].y);
        }
        shape.lineTo(polygon[0].x, polygon[0].y);

        if (height === 0) {
            return new THREE.Mesh(new THREE.ShapeGeometry(shape));
        }

        const extrudeSettings = {
            steps: 1,
            depth: height,
            bevelEnabled: false,
        };

        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const mesh = new THREE.Mesh(geometry);
        // mesh.translateZ(-height);
        mesh.updateMatrixWorld(true);
        return mesh;
    }
}
