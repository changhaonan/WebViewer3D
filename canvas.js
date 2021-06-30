import * as THREE from "./external/three.js/build/three.module.js.js";
import {TrackballControls} from "./external/three.js/examples/jsm/controls/TrackballControls.js.js";
import {OBJLoader} from "./external/three.js/examples/jsm/loaders/OBJLoader.js.js";
import {PCDLoader} from "./external/three.js/examples/jsm/loaders/PCDLoader.js.js";
import {TransformControls} from "./external/three.js/examples/jsm/controls/TransformControls.js.js";
import {VertexNormalsHelper} from "./external/three.js/examples/jsm/helpers/VertexNormalsHelper.js.js"


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
        camera.position.set(2.0, -2.0, 2.5);  // manually set start position

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
        // trackBall_control.target.set(0, 0, 0);
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

            $.each(data, (name, j) => {
                if(j.type == "info") {
                    if((name == "camera") && (!engine_data.camera_init)) {
                        updateCamera(j.vis.extrinsic, j.vis.target);
                        engine_data.camera_init = true;
                    }
                }
                else {
                    // console.log("%s loaded\n", name);
                    if(j.save != undefined) loadModel(name, j.save, j.vis);
                    if(j.vis != undefined) updateGuiVis(name, j.vis);  // update gui vis
                    if(j.interact != undefined) updateGuiInt(name, j.interact);  // update gui interaction
                }
            });
            
            // vis callback
            $.each(engine_data.vis_controls, (key, value) => {
                engine_data.controls[key].onChange(visibleCallBack(key));
            });

            // int callback
            $.each(engine_data.int_controls, (key, value) => {
                engine_data.controls[key].onChange((value) => {
                    if(value) initInt(key);
                });
            });
        });
    }

    parseId(id) {
        this.parseJson(engine_data.dir_prefix + id + "/context.json");
    }

    parsePosInList(pos) {
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
    if(name_section in engine_data.guis) {
        gui_section = engine_data.guis[name_section];
    }
    else {
        gui_section = engine_data.gui.addFolder(data.section);
        engine_data.guis[name_section] = gui_section;
    }  

    // control
    let name_control = data.control;
    let gui_control;
    if(name_control in engine_data.controls) {
        gui_control = engine_data.controls[name_control];
    }
    else {
        if(data.gui == "check_box") {
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
    if(data.enable) {
        let gui_control = updateGuiControl(data);
        let name_control = data.control;
        if(name_control in engine_data.vis_controls) {
            if(!(engine_data.vis_controls[name_control].includes(name))) {
                engine_data.vis_controls[name_control].push(name);
            }
        }
        else {
            engine_data.vis_controls[name_control] = [];
            engine_data.vis_controls[name_control].push(name);
        }
    }
}

function updateGuiInt(name, data) {
    if(data.enable) {
        let gui_control = updateGuiControl(data);
        let name_control = data.control;
        if(name_control in engine_data.int_controls) {
            if(!(engine_data.int_controls[name_control].includes(name))) {
                engine_data.int_controls[name_control].push(name);
            }
        }
        else {
            engine_data.int_controls[name_control] = [];
            engine_data.int_controls[name_control].push(name);
        }
    }
}

// model loading
function loadModel(name, data_save, data_vis) {
    if(data_vis.enable) {
        if(data_save.enable) {
            if(data_save.format == "obj") {
                loadModelOBJ(name, data_save.rel_path, data_vis.default, data_vis.intersectable);
            }
            else if(data_save.format == "pcd") {
                loadModelPCD(name, data_save.rel_path, data_vis.default, data_vis.intersectable);
            }
            else if(data_save.format == "json") {
                if(data_save.parse == "corr") {
                    loadModelCorr(name, data_save.rel_path, data_vis.default, data_vis.intersectable);
                }
            }
            else {
                console.log("Format %s is not supported.\n", data_save.format);
            }
        }
        else {  // save : false
            if(data_vis.mode == "geometry") {
                loadModelGeometry(name, data_vis.default, data_vis.intersectable);
            }
        }
    }
}

function loadModelOBJ(name, file_path, visible, intersectable) {
    const obj_loader = new OBJLoader();
    obj_loader.load(
        file_path, // URL
        (mesh) => {
            let obj = mesh.children[0];
            obj.material.side = THREE.DoubleSide;
            
            // add normal
            // const helper = new VertexNormalsHelper(obj, 0.04, 0x00ff00, 0.005);

            // set color
            obj.material.color.setHex(Math.random() * 0xffffff);
            obj.name = name;
            
            // set relative transform to parent
            let M = new THREE.Matrix4();  // relative transform
            M.elements = engine_data.data[name].vis.coordinate;
            obj.applyMatrix4(M);
            
            // existence check
            let obj_to_remove;
            if((obj_to_remove = scene.getObjectByName(name)) != undefined) {
                visible = obj_to_remove.visible;
                // color inherit
                obj.material.color = obj_to_remove.material.color;
                const index = engine_data.intersectable.indexOf(obj_to_remove);
                if(index > -1) {
                    engine_data.intersectable.splice(index, 1);
                }
                scene.remove(obj_to_remove);
            }
            
            obj.visible = visible;  // update visible status
            scene.add(obj);
            // scene.add(helper);

            if(intersectable) {
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

function loadModelPCD(name, file_path, visible, intersectable) {
    const pcd_loader = new PCDLoader();
    pcd_loader.load(
        file_path,
        (pcd) => {
            pcd.name = name;
            
            let M = new THREE.Matrix4();  // relative transform
            M.elements = engine_data.data[name].vis.coordinate;
            pcd.applyMatrix4(M);

            // size
            pcd.material.size = pcd.material.size * engine_data.data[name].vis.size;

            let pcd_to_remove;
            if((pcd_to_remove = scene.getObjectByName(name)) != undefined) {
                visible = pcd_to_remove.visible;
                // color inherit
                pcd.material.color = pcd_to_remove.material.color;
                const index = engine_data.intersectable.indexOf(pcd_to_remove);
                if(index > -1) {
                    engine_data.intersectable.splice(index, 1);
                }
                scene.remove(pcd_to_remove);
            }

            pcd.visible = visible;
            scene.add(pcd);

            if(intersectable) {
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

function loadModelCorr(name, file_path, visible, intersectable) {
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

            if(intersectable) {
                engine_data.intersectable.push(line);
            }

            let M = new THREE.Matrix4();  // relative transform
            M.elements = engine_data.data[name].vis.coordinate;
            line.applyMatrix4(M);

            let corr_to_remove;
            if((corr_to_remove = scene.getObjectByName(name)) != undefined) {
                visible = corr_to_remove.visible;
                // color inherit
                line.material.color = corr_to_remove.material.color;
                const index = engine_data.intersectable.indexOf(corr_to_remove);
                if(index > -1) {
                    engine_data.intersectable.splice(index, 1);
                }
                scene.remove(corr_to_remove);
            }

            line.visible = visible;
            scene.add(line);
        }
    );

}

function loadModelGeometry(name, visible, intersectable) { 
    let data_vis = engine_data.data[name].vis;
    let geometry_type = data_vis.geometry;
    
    let geo;
    if(geometry_type == "coord") {
        let scale = data_vis["scale"];
        const geometry = new THREE.SphereGeometry(0.001);  // small points
        const material = new THREE.MeshBasicMaterial({color: 0xffff00});
        geo = new THREE.Mesh(geometry, material);
        geo.add(new THREE.AxesHelper(scale));
    }
    else if(geometry_type == "box") {
        let width = data_vis["width"];
        let height = data_vis["height"];
        let depth = data_vis["depth"];
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshBasicMaterial({color: Math.random() * 0xffffff, side: THREE.DoubleSide});
        geo = new THREE.Mesh(geometry, material);
    }
    else if(geometry_type == "plane") {
        let width = data_vis["width"];
        let height = data_vis["height"];
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshBasicMaterial({color: Math.random() * 0xffffff, side: THREE.DoubleSide});
        geo = new THREE.Mesh(geometry, material);
    }

    // set name
    geo.name = name;

    if(intersectable) {
        engine_data.intersectable.push(geo);
    }

    let M = new THREE.Matrix4();  // relative transform
    M.elements = data_vis.coordinate;
    geo.applyMatrix4(M);

    let geo_to_remove;
    if((geo_to_remove = scene.getObjectByName(name)) != undefined) {
        visible = geo_to_remove.visible;
        // color inherit
        geo.material.color = geo_to_remove.material.color;
        const index = engine_data.intersectable.indexOf(geo_to_remove);
        if(index > -1) {
            engine_data.intersectable.splice(index, 1);
        }
        scene.remove(geo_to_remove);
    }

    geo.visible = visible;
    scene.add(geo);
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
        if(name_parent != null) {
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
                scene.getObjectByName(name).visible = value;
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
        if(!object.visible) continue;  // select the first visible one
        if(object.name == engine_data.last_pick) return;  // selected the same one
        console.log("Object: " + object.name + " selected.\n");
        // update color
        if(engine_data.last_pick != null) {
            // restore last pick color
            scene.getObjectByName(engine_data.last_pick).material.color = engine_data.last_color;
            // controller | if exists
            if(engine_data.last_pick in engine_data.t_controllers) {
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
        if(object.name in engine_data.t_controllers) {
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
    // engine.parseId(1101);
    // engine.parseLast();
})

animate();