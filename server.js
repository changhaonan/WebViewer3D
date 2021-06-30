// app
const express = require("express"); 
const app = express();
app.use(express.static(__dirname));
app.get("/3d", function(req, res) {
    res.sendFile("canvas.html", {root: __dirname})
});

app.post("/list_dir", function(req, res){
    const fs = require("fs");
    const list_dir = [];
    const dir_data = "./data/";
    // const dir_data = "./test/";
    const data = {};
    fs.readdir(dir_data, (err, dires) => {
        dires.forEach(dir => {
            list_dir.push(parseInt(dir));
        });
        list_dir.sort((a, b) => (a > b) ? 1 : -1);  // sort
        data.list_dir = list_dir;
        data.dir_data = dir_data;
        res.send(data);
    });
}) 

const server = app.listen(8080);