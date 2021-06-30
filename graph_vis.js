// import three js
import * as THREE from './extern/three.js/build/three.module.js';
import {OrbitControls} from './extern/three.js/examples/jsm/controls/OrbitControls.js';
import {Lut} from '/extern/three.js/examples/jsm/math/Lut.js';
import {OBJLoader} from './extern/three.js/examples/jsm/loaders/OBJLoader.js';
import {PCDLoader} from './extern/three.js/examples/jsm/loaders/PCDLoader.js';


let camera, scene, renderer, lut, param, gui, raycaster;
let num_weight_e, mouse, last_picked, color_last;  // user defined
let info, id_attr, info_text;  // info-related
let color_min_max;
let num_part = 2;
let cent, size;  // position related
let graph_object_group = [];  // object group
let part_object_group = [];
let hist_data_array = [];

init("./data/graph.json");  // initialization
render();

function init(file_name) {   
    // info
    info = document.createElement("div");
    id_attr = document.createAttribute("id");
    id_attr.nodeValue = "graph-info";
    info.setAttributeNode(id_attr);
    document.body.appendChild(info);

    info_text = {};
    // init camera, scene, renderer
    scene = new THREE.Scene();
    // camera configuration
    camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
    // light control
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    camera.add(pointLight);
    scene.add(camera);

    // renderer configuration
    renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    document.body.appendChild(renderer.domElement);

    renderer.domElement.addEventListener('resize', onWindowResize);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);   // add to renderer to prevent bother gui
    window.addEventListener('keypress', keyboard);

    // raycaster
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // control
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.addEventListener('change', render); // use if there is no animation loop
    controls.minDistance = 0.5;
    controls.maxDistance = 10;
    controls.target.set(0, 0, 0.0);
    controls.update();

    // lut
    lut = new Lut('rainbow', 512);
    lut.setMax(1);
    lut.setMin(0);

    // gui
    param = new function() {
        this.weight_e = 0;
        this.weight_v = 0;
        this.graph_node = false;
    } 

    gui = new dat.GUI();
    gui.add(param, 'weight_e', [0, 1]).onChange((value)=>{
        updateEdgeColor(value);
        d3.selectAll('svg').remove();
        addHist(hist_data_array, value);
    });
    gui.add(param, 'weight_v', [0]);
    gui.add(param, 'graph_node', true).onChange((value)=>{
        graph_object_group.map((obj)=>{obj.visible = value});
        render();
    });

    // draw robot
    cent = new THREE.Vector3();
    size = new THREE.Vector3();
    LoadScene(file_name);
}

function draw_graph(g) {
    // draw nodes
    $.each(g.nodes, function(i, node) {
        const geometry = new THREE.SphereGeometry(0.001, 16, 16);
        // assign color
        const weight_v = g.weight_v[i][0];  // default
        const v_color = lut.getColor(weight_v);

        const material = new THREE.MeshBasicMaterial({color: v_color});
        const sphere = new THREE.Mesh(geometry, material);
        // set position
        sphere.position.x = node[0] - cent.x;
        sphere.position.y = node[1] - cent.y;
        sphere.position.z = node[2] - cent.z;

        sphere.name = "node_" + i;
        sphere.visible = false;

        scene.add(sphere);
        graph_object_group.push(sphere);
    });
   
    // draw edges
    {
        const points = [];
        $.each(g.edges, function(i, edge) {
            let v1 = edge[0];
            let v2 = edge[1];
            points.push(
                new THREE.Vector3(
                    g.nodes[v1][0]-cent.x, 
                    g.nodes[v1][1]-cent.y, 
                    g.nodes[v1][2]-cent.z));
            points.push(
                new THREE.Vector3(
                    g.nodes[v2][0]-cent.x, 
                    g.nodes[v2][1]-cent.y, 
                    g.nodes[v2][2]-cent.z));   
        });

        const material = new THREE.LineBasicMaterial({vertexColors: THREE.VertexColors});
        
        // geometry set
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const colors = [];
        const weight_e = [];
        num_weight_e = g.weight_e[0].length;
        
        // min & max for lut
        let max_val = g.weight_e.reduce((max, current) => Math.max(max, current[0]), -Infinity);
        let min_val = g.weight_e.reduce((min, current) => Math.min(min, current[0]), Infinity);
        lut.setMax(max_val);
        lut.setMin(min_val);
        for(let i = 0; i < g.edges.length; ++i) {
            let weight_e_value = g.weight_e[i][0];  // default
            let color = lut.getColor(weight_e_value);

            // push color
            colors.push(color.r, color.g, color.b);
            colors.push(color.r, color.g, color.b);

            // push weight_e
            for(let j = 0; j < num_weight_e; ++j) {
                weight_e.push(g.weight_e[i][j]);
            }
        }

        color_min_max = [];
        for(let i = 0; i < num_weight_e; ++i) {
            // min & max in each dim
            let max_val = g.weight_e.reduce((max, current) => Math.max(max, current[i]), -Infinity);
            let min_val = g.weight_e.reduce((min, current) => Math.min(min, current[i]), Infinity);
            color_min_max.push([min_val, max_val]);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('weight_e', new THREE.Float32BufferAttribute(weight_e, num_weight_e));

        const lines = new THREE.LineSegments(geometry, material);
        lines.name = 'edges';  // set name
        lines.visible = false;

        scene.add(lines);
        graph_object_group.push(lines);
    }

    render();

    // prepare data
    let weight_e_0 = [];
    g.weight_e.map((e)=>{weight_e_0.push(e[0])});
    hist_data_array.push(weight_e_0);

    let weight_e_1 = [];
    g.weight_e.map((e)=>{weight_e_1.push(e[1])});
    hist_data_array.push(weight_e_1);
    // add graph
    addHist(hist_data_array, 0);
}

function render() {
    renderer.render(scene, camera);
}

// window resize
function onWindowResize() {
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    render();
}

// update color
function updateEdgeColor(weight_e_id) {
    // set min & max
    lut.setMin(color_min_max[weight_e_id][0]);
    lut.setMax(color_min_max[weight_e_id][1]);

    let edges =  scene.getObjectByName('edges');
    const colors = edges.geometry.attributes.color;
    for(let i = 0; i < edges.geometry.attributes.weight_e.count; ++i) {
        const weight_e 
            = edges.geometry.attributes.weight_e.array[num_weight_e*i+parseInt(weight_e_id)];
        const color = lut.getColor(weight_e);
        colors.setXYZ(2*i, color.r, color.g, color.b);
        colors.setXYZ(2*i+1, color.r, color.g, color.b);
    }

    colors.needsUpdate = true;
    render();
}

// selection callback
function onPointerDown(event) {
    event.preventDefault();

    mouse.x = (event.clientX/window.innerWidth)*2-1;
    mouse.y = -(event.clientY/window.innerHeight)*2+1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children);
   
    for(let i = 0; i < intersects.length; ++i) {
        const object = intersects[i].object;
        if(object.type == 'Mesh') {
            console.log("object: " + object.name + " selected.\n");
            // restore old color
            if(last_picked != undefined) {
                scene.getObjectByName(last_picked).material.color = color_last;
            }

            // update last
            last_picked = object.name;
            color_last = object.material.color.clone();
            object.material.color.setHex(0xffffcc);

            // update info_text
            info_text = {};
            info_text.select = "Select: " + object.name;
            printInfo();
            render();
            break;  // only update the first one
        }
    }
}

function printInfo() {
    var str = '';
    for(var index in info_text) {
      if(str !== '' && info_text[index] !== '') {
        str += " - ";
      }
      str += info_text[index];
    }
    document.getElementById("graph-info").innerHTML = str;
}

// keyboard callback
function keyboard(ev) {
    let parts = [];
    for(let ip = 0; ip <= num_part; ++ip) {
        parts.push(scene.getObjectByName('part_' + ip));
    }

    switch(ev.key || String.fromCharCode(ev.keyCode || ev.charCode)) {
        // case '+':
        //     pcd.material.size *= 1.2;
        //     pcd.material.needsUpdate = true;
        //     break;
        // case '-':
        //     pcd.material.size /= 1.2;
        //     pcd.material.needsUpdate = true;
        //     break;
        case 'c':
            for(let ip = 0; ip <= num_part; ++ip) {
                parts[ip].material.color.setHex(Math.random() * 0xffffff);
                parts[ip].material.needsUpdate = true;
            }
            break;
        case 's':
            part_object_group.map((obj)=>{obj.visible = !obj.visible});
            break;
    }
    render();
}

// loading function

function LoadScene(file_name) {
    const obj_loader = new OBJLoader();
    // whole model
    obj_loader.load(
        'data/model_s.obj', // URL
        (obj) => {
            let mesh_maj = obj.children[0];
            mesh_maj.material.side = THREE.DoubleSide;

            // get center deviation
            let bbox = new THREE.Box3().setFromObject(obj.children[0]);
            bbox.getCenter(cent);
            bbox.getSize(size);
            
            // move
            mesh_maj.position.x = -cent.x;
            mesh_maj.position.y = -cent.y;
            mesh_maj.position.z = -cent.z;

            mesh_maj.material.color.setHex(Math.random() * 0xffffff);
            mesh_maj.name = 'robot';
            // scene.add(mesh_maj);

            // load part after load robot
            LoadPart();
            // load graph
            $.getJSON(file_name).done(function(data) {
                draw_graph(data); 
            });
            render();
        
        },
        // called while loading is progressing
        (xhr) => {
            console.log('Whole Robot ' + (xhr.loaded/xhr.total*100) + '% loaded');
        },
        // called when loading has errors
        (error) => {
            console.log('An error happened');
        }
    );
}

function LoadPart() {
    const part_loader = new OBJLoader().setPath('data/');
    for(let c = 0; c <= num_part; ++c) {
        // await new Promise(r => setTimeout(r, 100));
        part_loader.load(
            ('model_' + c + '.obj'), // URL
            (obj) => {
                let mesh_maj = obj.children[0];
                mesh_maj.material.side = THREE.DoubleSide;

                // move by cent of whole robot
                mesh_maj.position.x = -cent.x;
                mesh_maj.position.y = -cent.y;
                mesh_maj.position.z = -cent.z;

                // set color
                mesh_maj.material.color.setHex(Math.random() * 0xffffff);
                mesh_maj.name = ('part_' + c);

                mesh_maj.visible = true;  // add as invisible
                scene.add(mesh_maj);

                part_object_group.push(mesh_maj);
            },
            // called while loading is progressing
            (xhr) => {
                console.log('Part ' + (xhr.loaded/xhr.total*100) + '% loaded');
            },
            // called when loading has errors
            (error) => {
                console.log('An error happened');
            }
        );
    }

    render();
}

function LoadPointCloud() {
    const pcd_loader = new PCDLoader().setPath('data/');
    pcd_loader.load(
        'point.pcd',
        (pcd) => {
            pcd.position.x = -cent.x;
            pcd.position.y = -cent.y;
            pcd.position.z = -cent.z;

            pcd.name = 'point_cloud';
            scene.add(pcd);
            render();
        },
        // called while loading is progressing
        (xhr) => {
            console.log((xhr.loaded/xhr.total*100) + '% loaded');
        },
        // called when loading has errors
        (error) => {
            console.log('An error happened');
        }
    )
}

function addHist(data_array, id) {
    // the size of the canvas
    let width = Math.floor(window.innerWidth * 0.8);
    let height = window.innerHeight * 0.2;

    // append the svg object to the body of the page
    let svg = d3.select("#inner_graph")
        .append("svg")
            .attr("width", width)
            .attr("height", height)

    // draw hist    
    let data = data_array[id];
    // determine the size of each figure
    let margin = {top: 20, right: 30, bottom: 20, left: 40};
    let width_graph = width - margin.left - margin.right;
    let height_graph = height - margin.top - margin.bottom;

    // x-axis
    let pos_start = margin.left;  
    let x = d3.scaleLinear()
        .domain([d3.min(data), d3.max(data)])
        .range([pos_start, pos_start+width_graph]);
    
    
    svg.append("g")
        .attr("transform", "translate(0 ," + (Math.floor(height_graph)+ margin.top) + ")")
        .call(d3.axisBottom(x));

    // set the parameters for the histogram
    let histogram = d3.histogram()  // I need to give the vector of value
        .domain(x.domain())  // then the domain of the graphic
        .thresholds(x.ticks(50)); // then the numbers of bins

    let bins = histogram(data);

    // y-axis
    let y = d3.scaleLinear().range([height_graph+margin.top, margin.top]);
    y.domain([0, d3.max(bins, function(d) {return d.length;})]);   // d3.hist has to be called before the Y axis obviously
    svg.append("g")
        .attr("transform", "translate(" + pos_start + ", 0)")
        .call(d3.axisLeft(y));

    // append the bar into the graph
    svg.selectAll("rect")
        .data(bins)
        .enter()
        .append("rect")
            .attr("x", 1)
            .attr("transform", function(d) {return "translate(" + x(d.x0) + "," + y(d.length) + ")"; })
            .attr("width", function(d) {
                if((x(d.x1) - x(d.x0)) > 1)
                    return x(d.x1) - x(d.x0) - 1;
                else 
                    return 0;  // for those out liers.
                })
            .attr("height", function(d) {return height_graph + margin.top - y(d.length);})
            .style("fill", "#69b3a2");

}
