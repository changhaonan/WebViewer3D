/**
 * @file context.hpp
 * @author Haonan Chang (chnme40cs@gmail.com)
 * @brief 
 * @version 0.1
 * @date 2021-06-30
 * 
 * @copyright Copyright (c) 2021
 * 
 */
#pragma once

#include <memory>
#include <string>
#include <iomanip> 
#include <stdexcept>
#include <fstream>
#include <iostream>
#include <boost/filesystem.hpp>
#include <Eigen/Eigen>

#include <nlohmann/json.hpp>
using json = nlohmann::json;


template<typename ... Args>
std::string stringFormat(const std::string& format, Args ... args) {
    int size_s = std::snprintf( nullptr, 0, format.c_str(), args ...) + 1; // Extra space for '\0'
    if(size_s <= 0){ throw std::runtime_error("Error during formatting."); }
    auto size = static_cast<size_t>(size_s);
    auto buf = std::make_unique<char[]>(size);
    std::snprintf(buf.get(), size, format.c_str(), args ...);
    return std::string(buf.get(), buf.get() + size - 1); // We don't want the '\0' inside
}


class Context {
public:
    explicit Context() {};
    void setDir(
        const std::string& data_root_dir, 
        const std::string& dir_prefix = "",
        const std::string& dir_suffix = "") {
        m_data_root_dir = data_root_dir;
        m_dir_prefix = dir_prefix;
        m_dir_suffix = dir_suffix;

        if(boost::filesystem::exists(m_data_root_dir)) {
            clearDir();
        }
        else {
            boost::filesystem::create_directory(m_data_root_dir);
        }
    }

private: 
    boost::filesystem::path m_data_root_dir;
    std::string m_dir_prefix;
    std::string m_dir_suffix;

public:
    // generate file path
    std::string at(const std::string& name) {
        if(m_context_info.contains(name)) {
            return currentFile(name).string();
        }
        else {
            std::cout << "Warning: " << name << " is not founded." << std::endl;
            return "";
        }
    }

    // adding function
    void addPointCloud(const std::string& name, const float size = 1.f, 
        const Eigen::Matrix4f& coordinate = Eigen::Matrix4f::Identity()) {
        json info_data;
        info_data["file_type"] = "pcd";
        info_data["file_name"] = (name + ".pcd");
        info_data["section"] = "Point-Cloud";
        info_data["control"] = name;
        info_data["mode"] = "point";
        info_data["gui"] = "check_box";
        info_data["default"] = false;
        info_data["intersectable"] = false;
        info_data["coordinate"] = std::vector<float>(coordinate.data(), coordinate.data()+16);
        info_data["size"] = size;
        addData(name, info_data);
    }

    // void addMeshObj(const std::string& name, const json& info);
private:
    void addData(const std::string& name, const json& info) {
        m_context_info[name] = info;
    }

    boost::filesystem::path currentFile(const std::string& name) {
        boost::filesystem::path data_dir = currentDir();
        
        std::string file_name;
        if(name.find(".") == std::string::npos) {
            std::string file_type = m_context_info[name]["file_type"];
            std::string file_name = name + "." + file_type;
        }
        else  {
            file_name = name;
        }
         
        boost::filesystem::path file_path = data_dir / file_name;
        return file_path;
    }

    boost::filesystem::path currentDir() {
        std::string dir_name;
        if((m_dir_prefix == "") && (m_dir_suffix == ""))
            dir_name = stringFormat("%06d", m_id);
        else if(m_dir_prefix == "")
            dir_name = stringFormat("%06d_%s", m_id, m_dir_suffix.c_str());
        else if(m_dir_suffix == "")
            dir_name = stringFormat("%s_%06d", m_dir_prefix.c_str(), m_id);
        else 
            dir_name = stringFormat("%s_%06d_%s", m_dir_prefix.c_str(), m_id, m_dir_suffix.c_str());
        boost::filesystem::path data_dir = m_data_root_dir / dir_name;
        return data_dir;
    }

    int m_id;
    json m_context_info;

public:
    void save(const int id) {
        m_id = id;
        save();
    }

    void clearDir() {
        for (boost::filesystem::directory_iterator end_dir_it, it(m_data_root_dir); it!=end_dir_it; ++it) {
            boost::filesystem::remove_all(it->path());
        }
    }

private:
    void save() {
        // check existence
        boost::filesystem::path current_dir;
        if(!boost::filesystem::exists(current_dir = currentDir())) {
            boost::filesystem::create_directory(current_dir);
        }

        std::string file_name = (current_dir / "context.json").string();
        std::ofstream o(file_name);
        o << std::setw(4) << m_context_info << std::endl;
        o.close();
    }

public:
    static Context& Instance() {
        static Context context;
        return context;
    }
};