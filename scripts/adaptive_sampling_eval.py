#!/usr/bin/python3

import os
import sys
import json
import pandas as pd
import numpy as np
from compare_pointcloud import ComparePointCloud

PCD_REF_DICT = {
    "Duck" : "/home/harvey/Data/Duck/Canonical_Duck/DuckCanonical.pcd",
    "Ur5e" : "/home/harvey/Project/WebViewer3D/data/Ur5eS/frame_002609/reference.pcd"
}

TRANS_TAR_DICT = {
    "Duck" : np.array([
        [0.719687938690, 0.116411156952, -0.684468924999, 0.361054748297],
        [0.248617812991, -0.963680744171, 0.097512155771, -0.063018575311],
        [-0.648258030415, -0.240349501371, -0.722491264343, 0.989448845387],
        [0.000000000000, 0.000000000000, 0.000000000000, 1.000000000000]
    ]),
    "Ur5e" : np.identity(4)
}


if __name__ == "__main__":
    stats_package = {}
    data_types = []
    root_dir = sys.argv[1] if (len(sys.argv) > 1) else "data"
    
    for dir_name in sorted(os.listdir(root_dir)):
        print("{} is in processing.".format(dir_name))
        data_type = dir_name.split("_")[0]
        
        if data_type not in stats_package:
            stats_package[data_type] = {
                "method" : [],
                "tracking [mean]" : [],
                "tracking [max]" : [],
                "tracking [min]" : [],
                "time [mean]" : [],
                "time [max]" : [],
                "time [min]" : []
            }

            stats_package[data_type + " Time line"] = {}
            data_types.append(data_type)

        frame_dir = sorted(os.listdir(root_dir + "/" + dir_name))[-1]  # Latest frame
        if data_type in PCD_REF_DICT.keys():
            # Reconstruction error
            pcd_file_ref = PCD_REF_DICT[data_type]
            transform_ref = np.identity(4)

            pcd_file_tar = "{}/{}/{}/live.pcd".format(root_dir, dir_name, frame_dir)
            transform_tar = TRANS_TAR_DICT[data_type]

            reconstruction_error_mean_val, reconstruction_error_max_val, reconstruction_error_min_val = ComparePointCloud(pcd_file_ref, pcd_file_tar, transform_ref, transform_tar)

            if "recon [mean]" not in stats_package[data_type].keys():  
                stats_package[data_type]["recon [mean]"] = []
                stats_package[data_type]["recon [max]"] = []
                stats_package[data_type]["recon [min]"] = []

            stats_package[data_type]["recon [mean]"].append(reconstruction_error_mean_val)
            stats_package[data_type]["recon [max]"].append(reconstruction_error_max_val)
            stats_package[data_type]["recon [min]"].append(reconstruction_error_min_val)

        # Json
        json_file = open("{}/{}/{}/context.json".format(root_dir, dir_name, frame_dir))
        context_dict = json.load(json_file)
        # Time
        time_array = np.array(context_dict["solving_time"]["data"])

        # Tracking error
        tracking_error_array = np.array(context_dict["alignment_error"]["data"])

        json_file.close()

        # Log part1: statics
        stats_package[data_type]["method"].append(dir_name)
        
        stats_package[data_type]["tracking [mean]"].append(tracking_error_array.mean())
        stats_package[data_type]["tracking [max]"].append(tracking_error_array.max())
        stats_package[data_type]["tracking [min]"].append(tracking_error_array.min())

        stats_package[data_type]["time [mean]"].append(time_array.mean())
        stats_package[data_type]["time [max]"].append(time_array.max())
        stats_package[data_type]["time [min]"].append(time_array.min())

        # Log part2: comparison
        stats_package[data_type + " Time line"]["Time: " + dir_name] = time_array
        stats_package[data_type + " Time line"]["Tracking: " + dir_name] = tracking_error_array
        # Delta Tracking
        d_tracking_error_array = tracking_error_array[10:] - tracking_error_array[:-10]
        d_tracking_error_array = np.append(d_tracking_error_array, np.zeros(tracking_error_array.size - d_tracking_error_array.size))
        stats_package[data_type + " Time line"]["De: " + dir_name] = d_tracking_error_array

    # Write to excel
    writer = pd.ExcelWriter('log/evaluate.xlsx', engine='xlsxwriter')
    for data_type in data_types:
        df = pd.DataFrame(stats_package[data_type])
        df.to_excel(writer, sheet_name=data_type)

        df_timeline = pd.DataFrame(stats_package[data_type + " Time line"], columns=sorted(stats_package[data_type + " Time line"].keys()))
        df_timeline.to_excel(writer, sheet_name=data_type + " Time line")

    writer.save()
