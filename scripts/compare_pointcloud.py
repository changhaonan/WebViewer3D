#!/usr/bin/python3

import open3d as o3d
import numpy as np


def ComparePointCloud(pcd_file_ref, pcd_file_tar, transform_ref, transform_tar):
    pcd_ref = o3d.io.read_point_cloud(pcd_file_ref).transform(transform_ref)
    pcd_tar = o3d.io.read_point_cloud(pcd_file_tar).transform(transform_tar)
    pcd_diff = pcd_tar.compute_point_cloud_distance(pcd_ref)  # distance from tar to ref
    pcd_diff_np = np.array(pcd_diff)
    return pcd_diff_np.mean(), pcd_diff_np.max(), pcd_diff_np.min()


if __name__ == "__main__":
    pcd_file_ref =  "/home/harvey/Data/Duck/Canonical_Duck/DuckCanonical.pcd"
    pcd_file_tar = "/home/harvey/Project/WebViewer3D/test_data/frame_000400/live.pcd"

    transform_ref = np.identity(4)
    transform_tar = np.array([
        [0.719687938690, 0.116411156952, -0.684468924999, 0.361054748297],
        [0.248617812991, -0.963680744171, 0.097512155771, -0.063018575311],
        [-0.648258030415, -0.240349501371, -0.722491264343, 0.989448845387],
        [0.000000000000, 0.000000000000, 0.000000000000, 1.000000000000]
    ])

    mean_val, max_val, min_val = ComparePointCloud(pcd_file_ref, pcd_file_tar, transform_ref, transform_tar)

    print("Mean: {}, Max: {}, Min: {}".format(mean_val, max_val, min_val))