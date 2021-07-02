// app
const express = require("express"); 
const app = express();
app.use(express.static(__dirname));
app.get("/3d", function(req, res) {
    res.sendFile("canvas.html", {root: __dirname})
});

app.post("/list_dir", function(req, res){
    const fs = require("fs");
    // parse args
    let args = process.argv.slice(2);
    let dir_data;
    if (args.length == 0) {
        dir_data = "./test_data/";
    }
    else {
        dir_data = args[0] + "/";  // add a dash no matter exists
    }
    
    fs.readdir(dir_data, (err, dires) => {
        if (err) {
            console.log(err)
            throw err
        }
        else {
            // match the pattern
            dires.sort((dir_a, dir_b) => {
                let pattern = /.*0+(\d+).*/;
                let num_a = dir_a.replace(pattern, "$1");
                let num_b = dir_b.replace(pattern, "$1");
                if (parseInt(num_a) > parseInt(num_b)) return 1;
                else return -1;
            });  // sort

            const data = {};
            data.list_dir = dires;
            data.dir_data = dir_data;
            res.send(data);
        }
    });
}) 

const server = app.listen(8080);