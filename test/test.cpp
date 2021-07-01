#include "context.hpp"
using namespace WebViewer3D;

void test_add() {
    Context& context = Context::Instance();
    context.addPointCloud("measurement", 0.5);
    std::cout << context.at("measurement") << std::endl;
}

void test_save() {
    Context& context = Context::Instance();
    context.save(1);
}

int main() {
    Context& context = Context::Instance();
    context.setDir("/home/harvey/Project/WebViewer3D/test_data", "frame");
    
    test_add();

    test_save();

}