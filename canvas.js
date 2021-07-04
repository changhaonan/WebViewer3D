import * as THREE from "./external/three.js/build/three.module.js";
import {TrackballControls} from "./external/three.js/examples/jsm/controls/TrackballControls.js";
import {OBJLoader} from "./external/three.js/examples/jsm/loaders/OBJLoader.js";
import {PCDLoader} from "./external/three.js/examples/jsm/loaders/PCDLoader.js";
import {TransformControls} from "./external/three.js/examples/jsm/controls/TransformControls.js";
import {VertexNormalsHelper} from "./external/three.js/examples/jsm/helpers/VertexNormalsHelper.js"
import {Lut} from '/external/three.js/examples/jsm/math/Lut.js';

// global variable
var scene, camera, cam_helper, renderer, trackBall_control;

// engine data
var engine_data = {
    dir_prefix : "",
    p : 0,  // pos in list
    list_dir : [],
    data : null,
    models : {},
    controls : {},
    vis_controls : {},  // visible
    int_controls : {},
    t_controllers : {},
    params : {},
    gui : new dat.GUI(),
    guis : {},
    defaults : {},
    obj_loaded : [],
    offset : new THREE.Vector3(),
    intersectable : [],
    last_pick : null,
    last_color : null,
    canvas : {
        margin : 5,
        left : 0.2,
        top : 0.0,
        ratio_w : 0.75,
        ratio_h : 0.95
    },
    camera_init : false
};


class AVEngine {

    constructor() {
        // scene init
        this.initScene();
    }

    initScene() {
        scene = new THREE.Scene();
        
        // light
        const ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
        scene.add(ambientLight);

        // camera
        camera = new THREE.PerspectiveCamera(75, 
            (window.innerWidth*engine_data.canvas.ratio_w)/
            (window.innerHeight*engine_data.canvas.ratio_h), 0.1, 1000);
        camera.position.set(0.0, 0.0, 0.0);  // manually set start position
        camera.up = new THREE.Vector3(0.0, -1.0, 0.0);
        camera.lookAt(new THREE.Vector3(0.0, 0.0, 1.0));

        const pointLight = new THREE.PointLight(0xffffff, 0.8);
        camera.add(pointLight);
        scene.add(camera);
        
        // global axis
        scene.add(new THREE.AxesHelper(1.0));

        // renderer
        renderer = new THREE.WebGLRenderer();
        renderer.setSize((window.innerWidth*engine_data.canvas.ratio_w), 
            (window.innerHeight*engine_data.canvas.ratio_h));
        renderer.outputEncoding = THREE.sRGBEncoding;
        $("#canvas").append(renderer.domElement);
        renderer.domElement.addEventListener("resize", onWindowResize);
        renderer.domElement.addEventListener("pointerdown", onPointerDown);  

        // trackball control
        trackBall_control = new TrackballControls(camera, renderer.domElement);
        trackBall_control.addEventListener("change", render); // use if there is no animation loop
        trackBall_control.rotateSpeed = 5.0;
        trackBall_control.panSpeed = 1.0;
        trackBall_control.zoomSpeed = 2.0;
        trackBall_control.target.set(0.0, 0.0, 1.0);  // look at z-axis
        trackBall_control.staticMoving = true;
        trackBall_control.update();
        
        // window callback
        window.addEventListener('keypress', onKeyDown);

        // render
        render();
    }

    parseJson(file_path) {
        // remove previous

        // add new controllers
        $.getJSON(file_path).done(function(data) {
            console.log(file_path + " loaded.\n");
            // save data
            engine_data.data = data;

            // update gui
            $.each(data, (name, j) => {
                if (j.vis != undefined) updateGuiVis(name, j.vis);  // update gui vis
                if (j.interact != undefined) updateGuiInt(name, j.interact);  // update gui interaction
            });
            
            // vis callback
            $.each(engine_data.vis_controls, (key) => {
                engine_data.controls[key].onChange(visibleCallBack(key));
            });

            // int callback
            $.each(engine_data.int_controls, (key) => {
                engine_data.controls[key].onChange((value) => {
                    if (value) initInt(key);
                });
            });

            // active load model
            engine_data.obj_loaded = [];  // clean active
            $.each(engine_data.vis_controls, (key) => {
                if (engine_data.controls[key].getValue()) {
                    $.each(engine_data.vis_controls[key], 
                        (_i, name) => {
                            loadModel(name, engine_data.data[name]);
                            engine_data.obj_loaded.push(name);
                        })
                    render();
                }
            });

        });
    }

    parsePosInList(pos) {
        engine_data.p = pos;  // update pos
        this.parseJson(engine_data.dir_prefix + engine_data.list_dir[pos] + "/context.json");
    }

    parseThis() {
        this.parsePosInList(engine_data.p);
    }

    parseNext() {
        engine_data.p = (engine_data.p + 1) % engine_data.list_dir.length;
        this.parsePosInList(engine_data.p);
    }

    parseLast() {
        engine_data.p = (engine_data.p - 1 + engine_data.list_dir.length) % engine_data.list_dir.length;
        this.parsePosInList(engine_data.p);
    }
}


// Gui-related
function updateGuiControl(data) {
    // section
    let gui_section;
    let name_section = data.section;
    if (name_section in engine_data.guis) {
        gui_section = engine_data.guis[name_section];
    }
    else {
        gui_section = engine_data.gui.addFolder(data.section);
        engine_data.guis[name_section] = gui_section;
    }  

    // control
    let name_control = data.control;
    let gui_control;
    if (name_control in engine_data.controls) {
        gui_control = engine_data.controls[name_control];
    }
    else {
        if (data.gui == "check_box") {
            engine_data.defaults[name_control] = data.default;
            gui_control = gui_section.add(
                engine_data.defaults, name_control
            );
            engine_data.controls[name_control] = gui_control;
        }
    }
    return gui_control;
}

function updateGuiVis(name, data) {
    let gui_control = updateGuiControl(data);
    let name_control = data.control;
    if (name_control in engine_data.vis_controls) {
        if (!(engine_data.vis_controls[name_control].includes(name))) {
            engine_data.vis_controls[name_control].push(name);
        }
    }
    else {
        engine_data.vis_controls[name_control] = [];
        engine_data.vis_controls[name_control].push(name);
    }
}

function updateGuiInt(name, data) {
    let gui_control = updateGuiControl(data);
    let name_control = data.control;
    if (name_control in engine_data.int_controls) {
        if (!(engine_data.int_controls[name_control].includes(name))) {
            engine_data.int_controls[name_control].push(name);
        }
    }
    else {
        engine_data.int_controls[name_control] = [];
        engine_data.int_controls[name_control].push(name);
    }
}

// model loading
function loadModel(name, data) {
    if (data.file_type == "obj") {
        loadModelOBJ(name, data.file_name, data.vis);
        console.log("Obj: ", name, " loaded.\n");
    }
    else if (data.file_type == "pcd") {
        loadModelPCD(name, data.file_name, data.vis);
        console.log("Pcd: ", name, " loaded.\n");
    }
    else if (data.file_type == "json") {
        if (data.vis.mode == "corr") {
            loadModelCorr(name, data.file_name, data.vis);
            console.log("Corr: ", name, " loaded.\n");
        }
        else if (data.vis.mode == "graph") {
            loadModelGraph(name, data.file_name, data.vis);
            console.log("Graph: ", name, " loaded.\n");
        }
    }
    else if (data.vis.mode == "geometry") {
        loadModelGeometry(name, data.vis);
        console.log("Geometry: ", name, " loaded.\n");
    }
    else {
        console.log("Format %s is not supported.\n", data_save.format);
    }
}

function loadModelOBJ(name, file_name, data_vis) {
    // get full path
    let file_path = engine_data.dir_prefix + engine_data.list_dir[engine_data.p] + "/" + file_name;

    const obj_loader = new OBJLoader();
    obj_loader.load(
        file_path, // URL
        (mesh) => {
            let obj = mesh.children[0];
            obj.material.side = THREE.DoubleSide;
            
            // set color
            obj.material.color.setHex(Math.random() * 0xffffff);
            obj.name = name;
            
            // set relative transform to parent
            let M = new THREE.Matrix4();  // relative transform
            M.elements = data_vis.coordinate;
            obj.applyMatrix4(M);
            
            // existence check
            let obj_to_remove;
            if ((obj_to_remove = scene.getObjectByName(name)) != undefined) {
                // color inherit
                obj.material.color = obj_to_remove.material.color;
                const index = engine_data.intersectable.indexOf(obj_to_remove);
                if (index > -1) {
                    engine_data.intersectable.splice(index, 1);
                }
                scene.remove(obj_to_remove);
            }
            
            obj.visible = true;  // update visible status
            scene.add(obj);

            if (data_vis.intersectable) {
                engine_data.intersectable.push(obj);
            }
        },
        // called while loading is progressing
        (xhr) => {
            // console.log("%s " + (xhr.loaded/xhr.total*100) + "% loaded", name);
        },
        // called when loading has errors
        (error) => {
            console.log("Obj loading failed.\n");
        }
    );
}

function loadModelPCD(name, file_name, data_vis) {
    // get full path
    let file_path = engine_data.dir_prefix + engine_data.list_dir[engine_data.p] + "/" + file_name;

    const pcd_loader = new PCDLoader();
    pcd_loader.load(
        file_path,
        (pcd) => {
            pcd.name = name;
            
            let M = new THREE.Matrix4();  // relative transform
            M.elements = data_vis.coordinate;
            pcd.applyMatrix4(M);

            // size
            pcd.material.size = pcd.material.size * data_vis.size;

            let pcd_to_remove;
            if ((pcd_to_remove = scene.getObjectByName(name)) != undefined) {
                // color inherit
                pcd.material.color = pcd_to_remove.material.color;
                const index = engine_data.intersectable.indexOf(pcd_to_remove);
                if (index > -1) {
                    engine_data.intersectable.splice(index, 1);
                }
                scene.remove(pcd_to_remove);
            }

            pcd.visible = true;
            scene.add(pcd);

            if (data_vis.intersectable) {
                engine_data.intersectable.push(pcd);
            }
        },
        // called while loading is progressing
        (xhr) => {
            // console.log("%s " + (xhr.loaded/xhr.total*100) + "% loaded", name);
        },
        // called when loading has errors
        (error) => {
            console.log("Pcd loading failed.\n");
        }
    )
}

function loadModelCorr(name, file_name, data_vis) {
    // get full path
    let file_path = engine_data.dir_prefix + engine_data.list_dir[engine_data.p] + "/" + file_name;

    $.getJSON(file_path).done(
        function(data) {
            const material = new THREE.LineBasicMaterial();
            material.color.setHex(Math.random() * 0xffffff);
            
            let points_vec = data.set.data;
            let num_pairs = points_vec.length/6;
            
            const points = [];
            for(let i = 0; i < num_pairs; ++i) {
                points.push(new THREE.Vector3(points_vec[3*i+0], points_vec[3*i+1], points_vec[3*i+2]));
                points.push(new THREE.Vector3(points_vec[3*(i+num_pairs)+0], points_vec[3*(i+num_pairs)+1], points_vec[3*(i+num_pairs)+2]));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.LineSegments(geometry, material);
            line.name = name;

            if (data_vis.intersectable) {
                engine_data.intersectable.push(line);
            }

            let M = new THREE.Matrix4();  // relative transform
            M.elements = data_vis.coordinate;
            line.applyMatrix4(M);

            let corr_to_remove;
            if ((corr_to_remove = scene.getObjectByName(name)) != undefined) {
                // color inherit
                line.material.color = corr_to_remove.material.color;
                const index = engine_data.intersectable.indexOf(corr_to_remove);
                if (index > -1) {
                    engine_data.intersectable.splice(index, 1);
                }
                scene.remove(corr_to_remove);
            }

            line.visible = true;
            scene.add(line);
        }
    );
}

function loadModelGeometry(name, data_vis) { 
    let geometry_type = data_vis.geometry;
    
    let geo;
    if (geometry_type == "coord") {
        let scale = data_vis["scale"];
        const geometry = new THREE.SphereGeometry(0.001);  // small points
        const material = new THREE.MeshBasicMaterial({color: 0xffff00});
        geo = new THREE.Mesh(geometry, material);
        geo.add(new THREE.AxesHelper(scale));
    }
    else if (geometry_type == "box") {
        let width = data_vis["width"];
        let height = data_vis["height"];
        let depth = data_vis["depth"];
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshBasicMaterial({color: Math.random() * 0xffffff, side: THREE.DoubleSide});
        geo = new THREE.Mesh(geometry, material);
    }
    else if (geometry_type == "plane") {
        let width = data_vis["width"];
        let height = data_vis["height"];
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({color: Math.random() * 0xffffff, side: THREE.DoubleSide});
        geo = new THREE.Mesh(geometry, material);
    }

    // set name
    geo.name = name;

    if (data_vis.intersectable) {
        engine_data.intersectable.push(geo);
    }

    let M = new THREE.Matrix4();  // relative transform
    M.elements = data_vis.coordinate;
    geo.applyMatrix4(M);

    let geo_to_remove;
    if ((geo_to_remove = scene.getObjectByName(name)) != undefined) {
        visible = geo_to_remove.visible;
        // color inherit
        geo.material.color = geo_to_remove.material.color;
        const index = engine_data.intersectable.indexOf(geo_to_remove);
        if (index > -1) {
            engine_data.intersectable.splice(index, 1);
        }
        scene.remove(geo_to_remove);
    }

    geo.visible = visible;
    scene.add(geo);
}

function loadModelGraph(name, file_name, data_vis) {
    // get full path
    let file_path = engine_data.dir_prefix + engine_data.list_dir[engine_data.p] + "/" + file_name;

    $.getJSON(file_path).done(
        function(data) {
            // vertices 
            const vertices = [];
            const color_v = [];
            $.each(data.vertices, (i, vertex)=>{
                vertices.push(
                    new THREE.Vector3(
                        vertex[0], vertex[1], vertex[2]));
                if (data.color_v != undefined) 
                    color_v.push(data.color_v[i][0], data.color_v[i][1], data.color_v[i][2]);
                else 
                    color_v.push(1.0, 1.0, 1.0);
            });

            const geometry_v = new THREE.BufferGeometry().setFromPoints(vertices);
            geometry_v.setAttribute("color", new THREE.Float32BufferAttribute(color_v, 3));
            
            const material_v = new THREE.PointsMaterial({vertexColors: THREE.VertexColors});
            material_v.size = 0.005 * data_vis.size;  // relative size
            const points = new THREE.Points(geometry_v, material_v);
            
            // edges
            const lut = new Lut('rainbow', 512);
            lut.setMax(data_vis.max_val);
            lut.setMin(data_vis.min_val);

            const edges = [];
            const color_e = [];
            $.each(data.edges, (i, edge)=>{
                let id_e0 = edge[0];
                let id_e1 = edge[1];

                edges.push(
                    new THREE.Vector3(
                        data.vertices[id_e0][0],
                        data.vertices[id_e0][1],
                        data.vertices[id_e0][2]));
                edges.push(
                    new THREE.Vector3(
                        data.vertices[id_e1][0],
                        data.vertices[id_e1][1],
                        data.vertices[id_e1][2]));
                
                let color;
                if (data.weight_e != undefined) 
                    color = lut.getColor(data.weight_e[i]);
                else 
                    color = {"r": 1.0, "g": 1.0, "b": 1.0};
                
                color_e.push(color.r, color.g, color.b);
                color_e.push(color.r, color.g, color.b);
            });

            const geometry_e = new THREE.BufferGeometry().setFromPoints(edges);
            geometry_e.setAttribute("color", new THREE.Float32BufferAttribute(color_e, 3));
            
            const material_e = new THREE.PointsMaterial({vertexColors: THREE.VertexColors});
            const lines = new THREE.LineSegments(geometry_e, material_e);

            // group
            const graph = new THREE.Group();
            graph.add(points);
            graph.add(lines);

            graph.name = name;
            if (data_vis.intersectable) {
                engine_data.intersectable.push(graph);
            }

            let M = new THREE.Matrix4();  // relative transform
            M.elements = data_vis.coordinate;
            graph.applyMatrix4(M);

            let graph_to_remove;
            if ((graph_to_remove = scene.getObjectByName(name)) != undefined) {
                const index = engine_data.intersectable.indexOf(graph_to_remove);
                if (index > -1) {
                    engine_data.intersectable.splice(index, 1);
                }
                scene.remove(graph_to_remove);
            }

            graph.visible = true;
            scene.add(graph);
        }
    );
}

function initInt(name_group) {
    $.each(engine_data.int_controls[name_group], (_i, name) => {
        // apply transform
        let obj = scene.getObjectByName(name);

        let t_control = new TransformControls(camera, renderer.domElement);
        t_control.addEventListener("change", render);
        t_control.addEventListener("dragging-changed", (e) => {
            trackBall_control.enabled = !e.value;
        });
        t_control.setMode(engine_data.data[name].interact.joint);
        t_control.setSize(0.5);
        t_control.enabled = false;
        t_control.name = "T_" + name;

        t_control.attach(obj);

        // parent
        let name_parent = engine_data.data[name].interact.parent;
        if (name_parent != null) {
            scene.getObjectByName(name_parent).add(obj);
        }   
        
        engine_data.t_controllers[name] = t_control;
        scene.add(t_control);
    })
}

// Call-back function
function visibleCallBack(name_control) {
    return function(value) {
        $.each(engine_data.vis_controls[name_control], 
            (_i, name) => {
                if (engine_data.obj_loaded.includes(name)) {
                    scene.getObjectByName(name).visible = value;
                }
                else {
                    // If it doesn't exist. Show it.
                    loadModel(name, engine_data.data[name]); 
                    engine_data.obj_loaded.push(name);
                }
            })
        render();
    }
}

// selection callback over Mesh
function onPointerDown(event) {
    event.preventDefault();

    // transform e -> render.position
    let mouse = new THREE.Vector2();

    let W = window.innerWidth;
    let H = window.innerHeight;
    let x_loc = event.clientX - engine_data.canvas.margin - engine_data.canvas.left * W;
    let y_loc = event.clientY - engine_data.canvas.margin - engine_data.canvas.top * H;
    let width = W * engine_data.canvas.ratio_w;
    let height = H * engine_data.canvas.ratio_h;

    mouse.x = (x_loc/width)*2-1;
    mouse.y = -(y_loc/height)*2+1;
    // console.log("(%d, %d), (%f, %f)", event.clientX, event.clientY, mouse.x, mouse.y);

    let raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(engine_data.intersectable);
   
    for(let i = 0; i < intersects.length; ++i) {
        const object = intersects[i].object;
        if (!object.visible) continue;  // select the first visible one
        if (object.name == engine_data.last_pick) return;  // selected the same one
        console.log("Object: " + object.name + " selected.\n");
        // update color
        if (engine_data.last_pick != null) {
            // restore last pick color
            scene.getObjectByName(engine_data.last_pick).material.color = engine_data.last_color;
            // controller | if exists
            if (engine_data.last_pick in engine_data.t_controllers) {
                engine_data.t_controllers[engine_data.last_pick].enabled = false;
                // scene.remove(engine_data.t_controllers[engine_data.last_pick]);
            }
        }
        engine_data.last_pick = object.name;
        engine_data.last_color = object.material.color.clone();
        object.material.color.setHex(0xffffcc);

        // update info
        let str_select = object.name;
        document.getElementById("select").innerHTML = str_select;

        $("#info_select").empty();
        $.each(engine_data.data[object.name].stat_info, (key, value) => {
            let str_stat = "<p>" + key + ": " + value + "</p>";
            $("#info_select").append(str_stat);
        } );

        // enable controller | if exists
        if (object.name in engine_data.t_controllers) {
            engine_data.t_controllers[object.name].enabled = true;
            // scene.add(engine_data.t_controllers[object.name]);
        }
        
        // render
        render();
        return;  // only update the first one
    }
}

function onKeyDown(event) {
    switch(event.key) {
        case "d": // right
            engine.parseNext();
            break;
        case "a":
            engine.parseLast();
            break;
        // case " ":
        //     trackBall_control.reset();
        //     break;
    }
}

// window resize
function onWindowResize() {
    camera.aspect = (window.innerWidth*engine_data.canvas.ratio_w)/
        (window.innerHeight*engine_data.canvas.ratio_h);
    camera.updateProjectionMatrix();
    renderer.setSize((window.innerWidth*engine_data.canvas.ratio_w), 
        (window.innerHeight*engine_data.canvas.ratio_h));
    trackBall_control.handleResize();
}

// render function
function render() {
    // update world matrix
    $.each(engine_data.t_controllers, (key, controller) => {
        controller.updateMatrixWorld(true);
    })
    renderer.render(scene, camera);
}

function animate() {
    requestAnimationFrame(animate);
    trackBall_control.update();
    render();
}

function updateCamera(coordinate, target) {
    trackBall_control.target.set(target[0], target[1], target[2]);
    trackBall_control.update();

    // let M = new THREE.Matrix4();  // relative transform
    // M.elements = coordinate;
    
    // let M_cur = camera.matrix.clone();
    // M_cur.invert();

    // camera.applyMatrix4(M_cur);  // transfrom back to ID
    // camera.applyMatrix4(M);

    // trackBall_control.update();

    render();
    // console.log("Camera pose update.\n");
}


var engine = new AVEngine();
$.post("/list_dir", function(data, status) {
    engine_data.dir_prefix = data.dir_data;
    engine_data.list_dir = data.list_dir;
    engine_data.p = 0;

    engine.parseThis();
})

animate();