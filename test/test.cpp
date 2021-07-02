#include "context.hpp"
using namespace WebViewer3D;

void test_add() {
    Context& context = Context::Instance();
    context.addPointCloud("measurement", 0.5);
    std::cout << context.at("measurement") << std::endl;
}

void test_open() {
    Context& context = Context::Instance();
    context.open(1);
}

void test_close() {
    Context& context = Context::Instance();
    context.close();
}

int main() {
    Context& context = Context::Instance();
    context.setDir("/home/harvey/Project/WebViewer3D/test_data", "frame");
    
    test_open();
    test_add();
    test_close();
}